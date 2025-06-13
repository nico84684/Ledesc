
// This file contains server actions.
// For this prototype, they will interact with the client-side store via context/hooks.
// In a real application, these would interact with a database.
"use server";

import type { PurchaseFormData, SettingsFormData, AddMerchantFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';
import { restoreDataFromDrive, type DriveRestoreInput, type DriveRestoreOutput } from '@/ai/flows/restoreDataFromDriveFlow';

export async function addPurchaseAction(data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchase?: Purchase }> {
  console.log("Server Action: addPurchaseAction called with data:", data);
  
  let receiptImageUrl: string | undefined = undefined;
  if (data.receiptImage && data.receiptImage.size > 0) {
    const timestamp = Date.now();
    receiptImageUrl = `https://placehold.co/300x200.png?text=Recibo_${timestamp}&font=roboto`;
  }

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

export async function updateSettingsAction(data: SettingsFormData): Promise<{ success: boolean; message: string; settings?: BenefitSettings }> {
  console.log("Server Action: updateSettingsAction called with data:", data);
  
  const newSettings: BenefitSettings = {
    monthlyAllowance: data.monthlyAllowance,
    discountPercentage: data.discountPercentage,
    alertThresholdPercentage: data.alertThresholdPercentage,
    enableWeeklyReminders: data.enableWeeklyReminders,
  };

  revalidatePath('/');
  revalidatePath('/settings');

  return { success: true, message: "Configuración actualizada exitosamente.", settings: newSettings };
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
    // If backup is successful, update the lastBackupTimestamp in settings
    if (result.success) {
        // Here, ideally, we would update the settings in the database/store.
        // For now, we'll rely on the client to update its local settings state
        // or we could return a new timestamp for the client to use.
        // However, this action primarily triggers the backup.
        // The client-side SettingsForm will update its lastBackupTimestamp on successful backup.
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
    // The actual data restoration (updating client state) will happen client-side
    // using the data returned in 'result'.
    return result;
  } catch (error: any) {
    console.error("Error al disparar el flujo de restauración desde Google Drive (acción del servidor):", error);
    return { success: false, message: error.message || "Falló al disparar la restauración desde Google Drive." };
  }
}
