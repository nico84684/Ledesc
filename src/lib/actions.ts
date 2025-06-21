
'use server';

import type { AppState } from '@/types';
import type { ContactFormData } from '@/lib/schemas';
import { APP_NAME } from '@/config/constants';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'Ledesc Sync';
const FILE_NAME = 'ledesc_app_data.json';

// Helper function to find the app folder
async function _getAppFolderId(accessToken: string): Promise<string | null> {
    const response = await fetch(`${DRIVE_API_URL}/files?q=mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false&spaces=drive`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        console.error("Drive API Error (_getAppFolderId):", await response.text());
        return null;
    }
    const { files } = await response.json();
    return files.length > 0 ? files[0].id : null;
}

// Helper function to create the app folder
async function _createAppFolder(accessToken: string): Promise<string | null> {
    const response = await fetch(`${DRIVE_API_URL}/files`, {
        method: 'POST',
        headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        }),
    });
    if (!response.ok) {
        console.error("Drive API Error (_createAppFolder):", await response.text());
        return null;
    }
    const folder = await response.json();
    return folder.id;
}

/**
 * Finds or creates the app data file in the dedicated app folder in Google Drive.
 */
export async function getDriveData(accessToken: string): Promise<{ fileId: string | null; data: AppState | null; error?: string }> {
    try {
        const folderId = await _getAppFolderId(accessToken);
        if (!folderId) {
            // Folder doesn't exist, so file can't exist. This is a valid state for a new user.
            return { fileId: null, data: null };
        }

        const fileQuery = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`;
        const fileSearchRes = await fetch(`${DRIVE_API_URL}/files?q=${encodeURIComponent(fileQuery)}&fields=files(id,name)&spaces=drive`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!fileSearchRes.ok) throw new Error(`Error searching for file: ${await fileSearchRes.text()}`);
        
        const { files } = await fileSearchRes.json();
        if (files.length === 0) {
            // File doesn't exist yet. Valid for a user who has used app before folder feature.
            return { fileId: null, data: null };
        }

        const fileId = files[0].id;
        const fileDataRes = await fetch(`${DRIVE_API_URL}/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!fileDataRes.ok) throw new Error(`Error fetching file data: ${await fileDataRes.text()}`);

        const data = await fileDataRes.json() as AppState;
        return { fileId, data };

    } catch (error: any) {
        console.error("[Action] getDriveData failed:", error.message);
        return { fileId: null, data: null, error: "No se pudieron obtener los datos de Google Drive." };
    }
}

/**
 * Saves the entire application state to a JSON file in Google Drive.
 */
export async function saveDriveData(accessToken: string, fileId: string | null, data: AppState): Promise<{ fileId: string | null; error?: string; lastBackupTimestamp?: number }> {
    try {
        let folderId = await _getAppFolderId(accessToken);
        if (!folderId) {
            folderId = await _createAppFolder(accessToken);
            if (!folderId) throw new Error("Could not create app folder in Drive.");
        }
        
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;
        
        const metadata = {
            name: FILE_NAME,
            mimeType: 'application/json',
            // If we are creating a new file, specify the parent folder.
            // If updating, the parent doesn't change.
            ...(!fileId && { parents: [folderId] })
        };
        
        const updatedTimestamp = Date.now();
        const dataToSave: AppState = { ...data, settings: { ...data.settings, lastBackupTimestamp: updatedTimestamp }};
        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(dataToSave, null, 2) +
            close_delim;

        const method = fileId ? 'PATCH' : 'POST';
        const url = `${DRIVE_UPLOAD_URL}/files${fileId ? `/${fileId}` : ''}?uploadType=multipart`;

        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
        });

        if (!response.ok) throw new Error(`Drive save failed: ${await response.text()}`);
        
        const returnedFile = await response.json();
        return { fileId: returnedFile.id, lastBackupTimestamp: updatedTimestamp };

    } catch (error: any) {
        console.error("[Action] saveDriveData failed:", error.message);
        return { fileId, error: "No se pudieron guardar los datos en Google Drive.", lastBackupTimestamp: data.settings.lastBackupTimestamp };
    }
}


/**
 * Handles the submission of the contact form.
 * @param data The form data.
 * @returns A result object indicating success or failure.
 */
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
