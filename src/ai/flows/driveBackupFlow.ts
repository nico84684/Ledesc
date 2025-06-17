
'use server';
/**
 * @fileOverview Flow for backing up data to Google Drive.
 * - backupDataToDrive - A function that handles backing up data.
 * - DriveBackupInput - The input type for the backupDataToDrive function.
 * - DriveBackupOutput - The return type for the backupDataToDrive function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';

const DriveBackupInputSchema = z.object({
  userId: z.string().describe('The ID of the user performing the backup.'),
  userEmail: z.string().email().describe('The email of the user performing the backup.'),
  purchasesData: z.string().describe('JSON string of purchases data.'),
  merchantsData: z.string().describe('JSON string of merchants data.'),
  settingsData: z.string().describe('JSON string of settings data.'),
  accessToken: z.string().optional().describe('OAuth2 access token for Google Drive API.'),
});
export type DriveBackupInput = z.infer<typeof DriveBackupInputSchema>;

const DriveBackupOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  fileId: z.string().optional().describe('The ID of the file created/updated in Google Drive.'),
});
export type DriveBackupOutput = z.infer<typeof DriveBackupOutputSchema>;

export async function backupDataToDrive(input: DriveBackupInput): Promise<DriveBackupOutput> {
  console.log(`[backupDataToDrive Function] Called for user: ${input.userEmail}`);
  if (!input.accessToken) {
    console.warn('[backupDataToDrive Function] OAuth Access Token NOT received.');
    return {
      success: false,
      message: 'Backup to Google Drive requires a valid OAuth access token. Please sign in again.',
    };
  }
  return await _backupDataToDriveFlow(input);
}

const _backupDataToDriveFlow = ai.defineFlow(
  {
    name: 'backupDataToDriveFlow',
    inputSchema: DriveBackupInputSchema,
    outputSchema: DriveBackupOutputSchema,
  },
  async (input) => {
    console.log(`[Genkit Flow: backupDataToDriveFlow] Received backup request for user ID: ${input.userId}, Email: ${input.userEmail}`);
    if (!input.accessToken) {
        return { success: false, message: 'Critical: Access token missing within the flow execution.' };
    }

    let drive;
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: input.accessToken });
      drive = google.drive({ version: 'v3', auth: oauth2Client });
    } catch (error: any) {
      console.error('[Genkit Flow] Error initializing Google Drive client:', error);
      return { success: false, message: `Error initializing Google Drive client: ${error.message}` };
    }

    const APP_FOLDER_NAME = 'LEDESC_App_Backups';
    const BACKUP_FILE_NAME = `ledesc_backup_${input.userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const BACKUP_FILE_MIME_TYPE = 'application/json';

    let folderId = '';
    try {
      console.log(`[Genkit Flow] Searching for Drive folder: ${APP_FOLDER_NAME}`);
      const folderSearchResponse = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (folderSearchResponse.data.files && folderSearchResponse.data.files.length > 0) {
        folderId = folderSearchResponse.data.files[0].id!;
        console.log(`[Genkit Flow] Found existing folder with ID: ${folderId}`);
      } else {
        console.log(`[Genkit Flow] Folder not found, creating new folder: ${APP_FOLDER_NAME}`);
        const folderMetadata = {
          name: APP_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        };
        const createdFolder = await drive.files.create({
          requestBody: folderMetadata,
          fields: 'id',
        });
        folderId = createdFolder.data.id!;
        console.log(`[Genkit Flow] Created new folder with ID: ${folderId}`);
      }
    } catch (error: any) {
      console.error('[Genkit Flow] Error managing Drive folder:', error);
      if (error.message && error.message.includes("invalid_grant")) {
        return { success: false, message: `Error de autenticación con Google Drive. Es posible que necesites iniciar sesión de nuevo o que los permisos hayan cambiado. Detalles: ${error.message}` };
      }
      return { success: false, message: `Error gestionando la carpeta de Google Drive: ${error.message}` };
    }

    const backupDataObject = {
      purchases: JSON.parse(input.purchasesData),
      merchants: JSON.parse(input.merchantsData),
      settings: JSON.parse(input.settingsData),
      backupMetadata: {
        timestamp: new Date().toISOString(),
        userEmail: input.userEmail,
        appName: "LEDESC",
      }
    };
    const backupJsonString = JSON.stringify(backupDataObject, null, 2);

    let fileIdToUpdate: string | undefined;
    try {
      console.log(`[Genkit Flow] Searching for backup file: ${BACKUP_FILE_NAME} in folder ID: ${folderId}`);
      const fileSearchResponse = await drive.files.list({
        q: `name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (fileSearchResponse.data.files && fileSearchResponse.data.files.length > 0) {
        fileIdToUpdate = fileSearchResponse.data.files[0].id!;
        console.log(`[Genkit Flow] Found existing backup file with ID: ${fileIdToUpdate}`);
      } else {
         console.log(`[Genkit Flow] Backup file not found. Will create a new one.`);
      }
    } catch (error: any) {
      console.warn('[Genkit Flow] Error searching for existing backup file (will attempt to create):', error.message);
    }

    try {
      const media = {
        mimeType: BACKUP_FILE_MIME_TYPE,
        body: backupJsonString,
      };

      if (fileIdToUpdate) {
        console.log(`[Genkit Flow] Updating existing file ID: ${fileIdToUpdate}`);
        const updatedFile = await drive.files.update({
          fileId: fileIdToUpdate,
          media: media,
          fields: 'id, name, webViewLink',
        });
        console.log(`[Genkit Flow] File updated successfully. ID: ${updatedFile.data.id}`);
        return { success: true, message: `Datos actualizados en Google Drive (${updatedFile.data.name}).`, fileId: updatedFile.data.id! };
      } else {
        console.log(`[Genkit Flow] Creating new file: ${BACKUP_FILE_NAME}`);
        const fileMetadata = {
          name: BACKUP_FILE_NAME,
          parents: [folderId],
        };
        const createdFile = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink',
        });
        console.log(`[Genkit Flow] New file created successfully. ID: ${createdFile.data.id}`);
        return { success: true, message: `Datos guardados en Google Drive (${createdFile.data.name}).`, fileId: createdFile.data.id! };
      }
    } catch (error: any) {
      console.error('[Genkit Flow] Error creating/updating backup file in Drive:', error);
       if (error.message && error.message.includes("invalid_grant")) {
        return { success: false, message: `Error de autenticación con Google Drive al guardar el archivo. Es posible que necesites iniciar sesión de nuevo o que los permisos hayan cambiado. Detalles: ${error.message}` };
      }
      return { success: false, message: `Error al guardar el archivo en Google Drive: ${error.message}` };
    }
  }
);

