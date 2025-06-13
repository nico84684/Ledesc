
// This file contains server actions.
// For this prototype, they will interact with the client-side store via context/hooks.
// In a real application, these would interact with a database.
"use server";

import type { PurchaseFormData, SettingsFormData, AddMerchantFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';

export async function addPurchaseAction(data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchase?: Purchase }> {
  console.log("Server Action: addPurchaseAction called with data:", data);
  
  let receiptImageUrl: string | undefined = undefined;
  if (data.receiptImage && data.receiptImage.size > 0) {
    // Simulate image upload and URL generation
    // In a real app, this would involve uploading to a storage service (e.g., Firebase Storage)
    // For now, using a placeholder with dynamic text to make it somewhat unique for testing
    const timestamp = Date.now();
    receiptImageUrl = `https://placehold.co/300x200.png?text=Recibo_${timestamp}&font=roboto`;
  }

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const newPurchase: Purchase = {
    id: new Date().toISOString() + Math.random().toString(), // Generate unique ID
    amount: data.amount,
    date: data.date, 
    merchantName: data.merchantName.trim(),
    merchantLocation: data.merchantLocation?.trim() || undefined,
    description: data.description || undefined,
    receiptImageUrl,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };
  
  revalidatePath('/'); // Revalidate dashboard
  revalidatePath('/history'); // Revalidate history page
  revalidatePath('/merchants'); // Revalidate merchants page if a new merchant might be added
  
  return { success: true, message: "Compra registrada exitosamente.", purchase: newPurchase };
}

export async function updateSettingsAction(data: SettingsFormData): Promise<{ success: boolean; message: string; settings?: BenefitSettings }> {
  console.log("Server Action: updateSettingsAction called with data:", data);
  
  // Create a BenefitSettings object, ensuring all required fields are present
  // lastBackupTimestamp should be preserved from existing settings or handled separately
  const newSettings: BenefitSettings = {
    monthlyAllowance: data.monthlyAllowance,
    discountPercentage: data.discountPercentage,
    alertThresholdPercentage: data.alertThresholdPercentage,
    enableWeeklyReminders: data.enableWeeklyReminders,
    // lastBackupTimestamp is not part of SettingsFormData directly for update
    // It's managed by backup functions.
  };

  revalidatePath('/'); // Revalidate dashboard if settings affect summary
  revalidatePath('/settings');

  return { success: true, message: "Configuración actualizada exitosamente.", settings: newSettings };
}

export async function addManualMerchantAction(data: AddMerchantFormData): Promise<{ success: boolean; message: string; merchant?: Merchant }> {
  console.log("Server Action: addManualMerchantAction called with data:", data);

  const newMerchant: Merchant = {
    id: new Date().toISOString() + Math.random().toString(), // Generate unique ID
    name: data.name.trim(),
    location: data.location?.trim() || undefined,
  };

  revalidatePath('/merchants'); // Revalidate merchants page

  return { success: true, message: `Solicitud para añadir "${newMerchant.name}" procesada.`, merchant: newMerchant };
}

export async function triggerGoogleDriveBackupAction(
  userId: string,
  userEmail: string,
  purchasesData: string,
  merchantsData: string,
  settingsData: string
): Promise<DriveBackupOutput> {
  if (!userId || !userEmail) {
    return { success: false, message: "User not authenticated or email missing." };
  }

  try {
    const backupInput: DriveBackupInput = {
      userId,
      userEmail,
      purchasesData,
      merchantsData,
      settingsData,
    };
    // This directly calls the Genkit flow's exported wrapper function
    const result = await backupDataToDrive(backupInput); 
    return result;
  } catch (error: any) {
    console.error("Error triggering Google Drive backup flow from server action:", error);
    return { success: false, message: error.message || "Failed to trigger Google Drive backup." };
  }
}
