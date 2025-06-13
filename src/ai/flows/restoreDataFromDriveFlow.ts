
'use server';
/**
 * @fileOverview Flow for restoring data from Google Drive.
 * - restoreDataFromDrive - A function that handles restoring data.
 * - DriveRestoreInput - The input type for the restoreDataFromDrive function.
 * - DriveRestoreOutput - The return type for the restoreDataFromDrive function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';

const DriveRestoreInputSchema = z.object({
  userId: z.string().describe('The ID of the user performing the restore.'),
  userEmail: z.string().email().describe('The email of the user performing the restore.'),
  accessToken: z.string().optional().describe('OAuth2 access token for Google Drive API.'),
});
export type DriveRestoreInput = z.infer<typeof DriveRestoreInputSchema>;

const DriveRestoreOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  purchasesData: z.string().optional().describe('JSON string of purchases data.'),
  merchantsData: z.string().optional().describe('JSON string of merchants data.'),
  settingsData: z.string().optional().describe('JSON string of settings data.'),
});
export type DriveRestoreOutput = z.infer<typeof DriveRestoreOutputSchema>;

export async function restoreDataFromDrive(input: DriveRestoreInput): Promise<DriveRestoreOutput> {
  console.log(`[restoreDataFromDrive Function] Called for user: ${input.userEmail}`);
  if (!input.accessToken) {
    console.warn('[restoreDataFromDrive Function] OAuth Access Token NOT received.');
    return {
      success: false,
      message: 'Restore from Google Drive requires a valid OAuth access token. Please sign in again.',
    };
  }
  return await _restoreDataFromDriveFlow(input);
}

const _restoreDataFromDriveFlow = ai.defineFlow(
  {
    name: 'restoreDataFromDriveFlow',
    inputSchema: DriveRestoreInputSchema,
    outputSchema: DriveRestoreOutputSchema,
  },
  async (input) => {
    console.log(`[Genkit Flow: restoreDataFromDriveFlow] Received restore request for user ID: ${input.userId}, Email: ${input.userEmail}`);
    if (!input.accessToken) {
      return { success: false, message: 'Critical: Access token missing within the flow execution.' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: input.accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const APP_FOLDER_NAME = 'LEDESC_App_Backups';
    const BACKUP_FILE_NAME = `ledesc_backup_${input.userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.json`;

    let folderId = '';
    try {
      console.log(`[Genkit Flow Restore] Searching for Drive folder: ${APP_FOLDER_NAME}`);
      const folderSearchResponse = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (folderSearchResponse.data.files && folderSearchResponse.data.files.length > 0) {
        folderId = folderSearchResponse.data.files[0].id!;
        console.log(`[Genkit Flow Restore] Found folder with ID: ${folderId}`);
      } else {
        console.log(`[Genkit Flow Restore] Folder '${APP_FOLDER_NAME}' not found.`);
        return { success: false, message: `No se encontró la carpeta de backup '${APP_FOLDER_NAME}' en Google Drive.` };
      }
    } catch (error: any) {
      console.error('[Genkit Flow Restore] Error finding Drive folder:', error);
      return { success: false, message: `Error al buscar la carpeta de backup en Google Drive: ${error.message}` };
    }

    let backupFileId: string | undefined;
    try {
      console.log(`[Genkit Flow Restore] Searching for backup file: ${BACKUP_FILE_NAME} in folder ID: ${folderId}`);
      const fileSearchResponse = await drive.files.list({
        q: `name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (fileSearchResponse.data.files && fileSearchResponse.data.files.length > 0) {
        backupFileId = fileSearchResponse.data.files[0].id!;
        console.log(`[Genkit Flow Restore] Found backup file with ID: ${backupFileId}`);
      } else {
        console.log(`[Genkit Flow Restore] Backup file '${BACKUP_FILE_NAME}' not found in folder.`);
        return { success: false, message: `No se encontró el archivo de backup '${BACKUP_FILE_NAME}' en Google Drive.` };
      }
    } catch (error: any) {
      console.error('[Genkit Flow Restore] Error searching for backup file:', error);
      return { success: false, message: `Error al buscar el archivo de backup: ${error.message}` };
    }

    try {
      console.log(`[Genkit Flow Restore] Downloading file ID: ${backupFileId}`);
      const fileResponse = await drive.files.get(
        { fileId: backupFileId, alt: 'media' },
        { responseType: 'json' } // Get response as parsed JSON directly if it's text/json
      );
      
      // The Drive API for 'media' often returns the raw content.
      // If responseType: 'json' doesn't parse it for application/json, we parse manually.
      let backupDataObject: any;
      if (typeof fileResponse.data === 'string') {
         backupDataObject = JSON.parse(fileResponse.data);
      } else if (typeof fileResponse.data === 'object' && fileResponse.data !== null) {
         backupDataObject = fileResponse.data; // Already an object
      } else {
        throw new Error("Backup file content is not in expected format.");
      }

      const purchasesData = JSON.stringify(backupDataObject.purchases || []);
      const merchantsData = JSON.stringify(backupDataObject.merchants || []);
      const settingsData = JSON.stringify(backupDataObject.settings || {}); // Settings might be an object

      console.log(`[Genkit Flow Restore] File content downloaded and parsed successfully.`);
      return {
        success: true,
        message: 'Datos restaurados exitosamente desde Google Drive.',
        purchasesData,
        merchantsData,
        settingsData,
      };
    } catch (error: any) {
      console.error('[Genkit Flow Restore] Error downloading/parsing backup file:', error);
      return { success: false, message: `Error al leer el archivo de backup desde Google Drive: ${error.message}` };
    }
  }
);

