
// This file contains server actions.
// For this prototype, they will interact with the client-side store via context/hooks.
// In a real application, these would interact with a database.
"use server";

import type { PurchaseFormData, SettingsFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, AppState } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type BackupDataInput, type BackupDataOutput } from '@/ai/flows/backup-data-flow';

// Note: Since server actions can't directly call client-side context,
// the actual state update will happen on the client after the action resolves.
// This simulation works by having the client call its context update methods.
// A real app would have these actions update a DB, and client would refetch or use optimistic updates.

export async function addPurchaseAction(data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchase?: Purchase }> {
  console.log("Server Action: addPurchaseAction called with data:", data);
  
  // Simulate image upload if a file is present
  let receiptImageUrl: string | undefined = undefined;
  if (data.receiptImage && data.receiptImage.size > 0) {
    // In a real app, upload to cloud storage and get URL
    // For simulation, use a placeholder or a data URL (if small enough, but not recommended for real use)
    receiptImageUrl = `https://placehold.co/300x200.png?text=Recibo&font=roboto`; // Simple placeholder
  }

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const newPurchase: Purchase = {
    id: new Date().toISOString() + Math.random().toString(), // Temporary ID
    amount: data.amount,
    date: data.date, // Assuming date is already ISO string from form
    merchantName: data.merchantName,
    description: data.description || undefined, // Add description
    receiptImageUrl,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };

  // In a real app: await db.insertPurchase(newPurchase);
  // For simulation, the client will handle adding this to its state.
  // We return the processed purchase data.
  
  revalidatePath('/');
  revalidatePath('/history');
  
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

  // In a real app: await db.updateUserSettings(newSettings);
  // For simulation, client will handle updating its state.

  revalidatePath('/');
  revalidatePath('/settings');

  return { success: true, message: "Configuración actualizada exitosamente.", settings: newSettings };
}

export async function backupToGoogleDriveAction(appData: AppState): Promise<BackupDataOutput> {
  console.log("Server Action: backupToGoogleDriveAction llamada. Se invocará el flujo de Genkit.");
  
  if (!appData || !appData.purchases || !appData.settings) {
    console.error("Datos de la aplicación incompletos para el backup.");
    return { success: false, message: "Error: Datos de la aplicación incompletos para el backup." };
  }

  const flowInput: BackupDataInput = {
    purchases: appData.purchases,
    settings: appData.settings,
  };

  try {
    // Llamar al flujo de Genkit
    const result = await backupDataToDrive(flowInput);
    console.log("Resultado del flujo de Genkit backupDataToDrive:", result);
    return result;
  } catch (error: any) {
    console.error("Error al invocar el flujo de Genkit backupDataToDrive:", error);
    return { success: false, message: `Error al procesar el respaldo: ${error.message || 'Error desconocido del flujo'}` };
  }
}
