
// This file contains server actions.
// For this prototype, they will interact with the client-side store via context/hooks.
// In a real application, these would interact with a database.
"use server";

import type { PurchaseFormData, SettingsFormData, AddMerchantFormData, ContactFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';
import { restoreDataFromDrive, type DriveRestoreInput, type DriveRestoreOutput } from '@/ai/flows/restoreDataFromDriveFlow';

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
  const developerEmail = "nicolas.s.fernandez@gmail.com";
  console.log(`Server Action: contactFormAction called. Data received:`, data);
  console.log(`Intention: Send email to ${developerEmail} with the following details:`);
  console.log(`From: ${data.email}`);
  console.log(`Reason: ${data.reason}`);
  console.log(`Message: ${data.message}`);
  
  // Simular procesamiento y (futuro) envío de correo
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Aquí iría la lógica real para enviar el correo electrónico.
  // Por ejemplo, usando un servicio como Resend, Nodemailer, o una API de backend.
  // try {
  //   await sendEmail({
  //     to: developerEmail,
  //     from: 'noreply@yourdomain.com', // O una dirección de envío configurada
  //     subject: `Nuevo mensaje de contacto: ${data.reason} - ${APP_NAME}`,
  //     html: `<p>Has recibido un nuevo mensaje de contacto de: ${data.email}</p>
  //            <p><strong>Motivo:</strong> ${data.reason}</p>
  //            <p><strong>Mensaje:</strong></p>
  //            <p>${data.message.replace(/\n/g, '<br>')}</p>`,
  //   });
  //   return { success: true, message: `Gracias por tu mensaje sobre "${data.reason}". Ha sido enviado.` };
  // } catch (error) {
  //   console.error("Error sending contact email:", error);
  //   return { success: false, message: "Hubo un problema al enviar tu mensaje. Por favor, intenta más tarde." };
  // }

  // Mensaje genérico de éxito para el usuario (simulado)
  return { success: true, message: `Gracias por tu mensaje sobre "${data.reason}". Nos pondremos en contacto contigo pronto si es necesario.` };
}
