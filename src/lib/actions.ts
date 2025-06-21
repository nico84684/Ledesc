// This file contains server actions.
"use server";

import type { AppState, ContactFormData } from '@/types';
import { google } from 'googleapis';
import { APP_NAME } from '@/config/constants';

const APP_DATA_FILENAME = 'ledesc_app_data.json';
const APP_DATA_MIME_TYPE = 'application/json';

async function getOauth2Client(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return oauth2Client;
}

/**
 * Finds the app data file in Google Drive and returns its content.
 * @param accessToken The user's Google access token.
 * @returns An object containing the fileId and the file content (as AppState).
 */
export async function getDriveData(accessToken: string): Promise<{ fileId: string | null; data: AppState | null; error?: string }> {
    try {
        const oauth2Client = await getOauth2Client(accessToken);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const res = await drive.files.list({
            q: `name='${APP_DATA_FILENAME}' and mimeType='${APP_DATA_MIME_TYPE}' and 'root' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
            pageSize: 1,
        });

        if (res.data.files && res.data.files.length > 0) {
            const file = res.data.files[0];
            const fileId = file.id;

            if (!fileId) {
                return { fileId: null, data: null, error: 'File found but ID is missing.' };
            }

            const fileContentRes = await drive.files.get({
                fileId: fileId,
                alt: 'media',
            });
            
            const fileData = fileContentRes.data as any;

            if (typeof fileData === 'object') {
                 return { fileId, data: fileData as AppState };
            }
            return { fileId, data: JSON.parse(fileData) as AppState };

        } else {
            // File not found, which is a normal case for a new user.
            return { fileId: null, data: null };
        }
    } catch (error: any) {
        console.error('[Action] Error getting data from Google Drive:', error.message);
        return { fileId: null, data: null, error: `Failed to get data from Drive: ${error.message}` };
    }
}


/**
 * Saves the entire application state to a JSON file in Google Drive.
 * Creates the file if it doesn't exist (fileId is null).
 * @param accessToken The user's Google access token.
 * @param fileId The ID of the file to update. If null, a new file will be created.
 * @param data The AppState to save.
 * @returns An object containing the fileId of the saved file.
 */
export async function saveDriveData(accessToken: string, fileId: string | null, data: AppState): Promise<{ fileId: string | null; error?: string; lastBackupTimestamp?: number }> {
    try {
        const oauth2Client = await getOauth2Client(accessToken);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const timestamp = Date.now();
        const dataToSave = {
            ...data,
            settings: {
                ...data.settings,
                lastBackupTimestamp: timestamp,
            }
        };

        const fileMetadata = {
            name: APP_DATA_FILENAME,
            mimeType: APP_DATA_MIME_TYPE,
        };

        const media = {
            mimeType: APP_DATA_MIME_TYPE,
            body: JSON.stringify(dataToSave, null, 2),
        };

        if (fileId) {
            // Update existing file
            const res = await drive.files.update({
                fileId: fileId,
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
            });
            return { fileId: res.data.id || null, lastBackupTimestamp: timestamp };
        } else {
            // Create new file
            const res = await drive.files.create({
                requestBody: {
                    ...fileMetadata,
                    parents: ['root'],
                },
                media: media,
                fields: 'id',
            });
            return { fileId: res.data.id || null, lastBackupTimestamp: timestamp };
        }
    } catch (error: any) {
        console.error('[Action] Error saving data to Google Drive:', error.message);
        return { fileId: null, error: `Failed to save data to Drive: ${error.message}` };
    }
}


export async function contactFormAction(data: ContactFormData): Promise<{ success: boolean; message: string }> {
  const targetEmail = "nicolas.s.fernandez@gmail.com";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("[Server Action] contactFormAction: RESEND_API_KEY is not set.");
    return { success: false, message: "Servicio de correo no configurado correctamente." };
  }
  
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);
    const emailPayload = {
      from: `Contacto ${APP_NAME} <onboarding@resend.dev>`,
      to: [targetEmail],
      subject: `Contacto (${APP_NAME}): ${data.reason}`,
      reply_to: data.email,
      html: `<h1>Mensaje Recibido - ${APP_NAME}</h1>
             <p><strong>De:</strong> ${data.email}</p>
             <p><strong>Motivo:</strong> ${data.reason}</p>
             <hr/>
             <p><strong>Mensaje:</strong></p>
             <p style="white-space: pre-wrap;">${data.message}</p>`,
    };
    console.log("[Server Action] contactFormAction: Sending email with payload:", JSON.stringify(emailPayload, null, 2));
    const emailData = await resend.emails.send(emailPayload);

    if (emailData.error) {
      console.error("[Server Action] contactFormAction: Resend API Error:", emailData.error);
      return { success: false, message: `Error al enviar el correo: ${emailData.error.message}` };
    }
    console.log("[Server Action] contactFormAction: Email sent successfully. ID:", emailData.data?.id);
    return { success: true, message: `Tu mensaje sobre "${data.reason}" ha sido enviado correctamente.` };
  } catch (error: any) {
    console.error("[Server Action] contactFormAction: Unexpected Error:", error);
    return { success: false, message: "Ocurrió un error inesperado al intentar enviar el mensaje." };
  }
}
