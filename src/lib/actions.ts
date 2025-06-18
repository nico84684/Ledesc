
// This file contains server actions.
// For this prototype, they will interact with the client-side store via context/hooks.
// In a real application, these would interact with a database.
"use server";

import type { PurchaseFormData, SettingsFormData, AddMerchantFormData, ContactFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';
import { restoreDataFromDrive, type DriveRestoreInput, type DriveRestoreOutput } from '@/ai/flows/restoreDataFromDriveFlow';
import { APP_NAME } from '@/config/constants';
import { Resend } from 'resend';

export async function addPurchaseAction(data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchase?: Purchase }> {
  console.log("Server Action: addPurchaseAction called with data:", data);
  
  const receiptImageUrl: string | undefined = undefined;

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const newPurchase: Purchase = {
    id: new Date().toISOString() + Math.random().toString(),
    amount: data.amount,
    date: data.date, 
    merchantName: data.merchantName.trim(),
    merchantLocation: data.merchantLocation?.trim() || undefined,
    description: data.description || undefined,
    receiptImageUrl,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };
  
  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/merchants');
  
  return { success: true, message: "Compra registrada exitosamente.", purchase: newPurchase };
}

export async function editPurchaseAction(purchaseId: string, data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchase?: Purchase }> {
  console.log("Server Action: editPurchaseAction called for ID:", purchaseId, "with data:", data);

  const receiptImageUrl: string | undefined = undefined; // Asumimos que no se edita la imagen o se maneja por separado

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const updatedPurchase: Purchase = {
    id: purchaseId, // El ID no cambia
    amount: data.amount,
    date: data.date,
    merchantName: data.merchantName.trim(),
    merchantLocation: data.merchantLocation?.trim() || undefined,
    description: data.description || undefined,
    receiptImageUrl,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/merchants');

  return { success: true, message: "Compra actualizada exitosamente.", purchase: updatedPurchase };
}

export async function deletePurchaseAction(purchaseId: string): Promise<{ success: boolean; message: string; purchaseId?: string }> {
  console.log("Server Action: deletePurchaseAction called for ID:", purchaseId);

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/merchants');

  return { success: true, message: "Compra eliminada exitosamente.", purchaseId };
}


export async function updateSettingsAction(data: SettingsFormData): Promise<{ success: boolean; message: string; settings?: BenefitSettings }> {
  console.log("Server Action: updateSettingsAction called with data:", data);
  
  const updatedSettings: BenefitSettings = {
    monthlyAllowance: data.monthlyAllowance,
    discountPercentage: data.discountPercentage,
    alertThresholdPercentage: data.alertThresholdPercentage,
    autoBackupToDrive: data.autoBackupToDrive,
    lastBackupTimestamp: data.lastBackupTimestamp,
    enableEndOfMonthReminder: data.enableEndOfMonthReminder,
    daysBeforeEndOfMonthToRemind: data.daysBeforeEndOfMonthToRemind,
  };

  revalidatePath('/');
  revalidatePath('/settings');

  return { success: true, message: "Configuración actualizada exitosamente.", settings: updatedSettings };
}

export async function addManualMerchantAction(data: AddMerchantFormData): Promise<{ success: boolean; message: string; merchant?: Merchant }> {
  console.log("Server Action: addManualMerchantAction called with data:", data);

  const newMerchant: Merchant = {
    id: new Date().toISOString() + Math.random().toString(),
    name: data.name.trim(),
    location: data.location?.trim() || undefined,
  };

  revalidatePath('/merchants');

  return { success: true, message: `Solicitud para añadir "${newMerchant.name}" procesada.`, merchant: newMerchant };
}

export async function triggerGoogleDriveBackupAction(
  userId: string,
  userEmail: string,
  purchasesData: string,
  merchantsData: string,
  settingsData: string,
  accessToken?: string
): Promise<DriveBackupOutput> {
  if (!userId || !userEmail) {
    return { success: false, message: "User not authenticated or email missing." };
  }
  if (!accessToken) {
    return { success: false, message: "Missing OAuth access token for Google Drive." };
  }

  try {
    const backupInput: DriveBackupInput = {
      userId,
      userEmail,
      purchasesData,
      merchantsData,
      settingsData,
      accessToken,
    };
    const result = await backupDataToDrive(backupInput); 
    if (result.success) {
        // Client-side will update lastBackupTimestamp
    }
    return result;
  } catch (error: any) {
    console.error("Error triggering Google Drive backup flow from server action:", error);
    return { success: false, message: error.message || "Failed to trigger Google Drive backup." };
  }
}


export async function triggerGoogleDriveRestoreAction(
  userId: string,
  userEmail: string,
  accessToken?: string
): Promise<DriveRestoreOutput> {
  if (!userId || !userEmail) {
    return { success: false, message: "Usuario no autenticado o email no encontrado." };
  }
  if (!accessToken) {
    return { success: false, message: "Falta el token de acceso OAuth para Google Drive." };
  }

  try {
    const restoreInput: DriveRestoreInput = {
      userId,
      userEmail,
      accessToken,
    };
    const result = await restoreDataFromDrive(restoreInput);
    return result;
  } catch (error: any) {
    console.error("Error al disparar el flujo de restauración desde Google Drive (acción del servidor):", error);
    return { success: false, message: error.message || "Falló al disparar la restauración desde Google Drive." };
  }
}

export async function contactFormAction(data: ContactFormData): Promise<{ success: boolean; message: string }> {
  const targetEmail = "nicolas.s.fernandez@gmail.com";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("Error: RESEND_API_KEY no está configurada en las variables de entorno.");
    // En producción, es crucial no exponer detalles del error al cliente.
    // Podrías retornar un mensaje genérico o loggear el error internamente.
    return { success: false, message: "El servicio de envío de correo no está configurado correctamente. Por favor, contacta al administrador." };
  }

  const resend = new Resend(resendApiKey);

  try {
    const emailData = await resend.emails.send({
      from: `Contacto ${APP_NAME} <onboarding@resend.dev>`, // Puedes cambiar 'onboarding@resend.dev' si verificas un dominio en Resend
      to: [targetEmail],
      subject: `Nuevo mensaje de Contacto (${APP_NAME}): ${data.reason}`,
      reply_to: data.email,
      html: `
        <h1>Nuevo Mensaje de Contacto desde ${APP_NAME}</h1>
        <p><strong>De:</strong> ${data.email}</p>
        <p><strong>Motivo:</strong> ${data.reason}</p>
        <hr />
        <p><strong>Mensaje:</strong></p>
        <p>${data.message.replace(/\n/g, "<br>")}</p>
      `,
    });

    if (emailData.error) {
      console.error("Error al enviar correo con Resend:", emailData.error);
      return { success: false, message: `Hubo un problema al enviar tu mensaje: ${emailData.error.message}` };
    }

    console.log(`Correo enviado exitosamente a ${targetEmail} a través de Resend. ID: ${emailData.data?.id}`);
    return { success: true, message: `Gracias por tu mensaje sobre "${data.reason}". Ha sido enviado.` };

  } catch (error: any) {
    console.error("Excepción al intentar enviar correo con Resend:", error);
    // Aquí también, cuidado con exponer detalles del error al cliente.
    return { success: false, message: "Hubo un problema inesperado al intentar enviar tu mensaje. Por favor, intenta más tarde." };
  }
}
