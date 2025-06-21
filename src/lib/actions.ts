
'use server';

import type { AppState } from '@/types';
import type { ContactFormData } from '@/lib/schemas';
// import { google } from 'googleapis'; // Temporarily disabled
import { APP_NAME } from '@/config/constants';

// --- Google Drive Functionality is temporarily disabled to troubleshoot server startup issues. ---
// The presence of the 'googleapis' library appears to be causing silent crashes in the Vercel environment.
// The functions below will return a "disabled" state to ensure the app remains functional.

/**
 * Finds the app data file in the dedicated app folder in Google Drive.
 * This function is temporarily disabled.
 */
export async function getDriveData(accessToken: string): Promise<{ fileId: string | null; data: AppState | null; error?: string }> {
    console.warn("[Action] getDriveData is temporarily disabled to troubleshoot server startup.");
    return { fileId: null, data: null, error: "La sincronización con Google Drive está temporalmente desactivada." };
}

/**
 * Saves the entire application state to a JSON file in Google Drive.
 * This function is temporarily disabled.
 */
export async function saveDriveData(accessToken: string, fileId: string | null, data: AppState): Promise<{ fileId: string | null; error?: string; lastBackupTimestamp?: number }> {
    console.warn("[Action] saveDriveData is temporarily disabled to troubleshoot server startup.");
    return { fileId, error: "La sincronización con Google Drive está temporalmente desactivada.", lastBackupTimestamp: data.settings.lastBackupTimestamp };
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
