
// This file contains server actions.
// For this prototype, they will interact with the client-side store via context/hooks.
// In a real application, these would interact with a database.
"use server";

import type { PurchaseFormData, SettingsFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, AppState } from '@/types';
import { revalidatePath } from 'next/cache';

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

export async function backupToGoogleDriveAction(appData: AppState): Promise<{ success: boolean; message: string }> {
  console.log("Server Action: backupToGoogleDriveAction called.");
  // This is a simulation. In a real app, this would:
  // 1. Authenticate with Google (OAuth2)
  // 2. Use Google Drive API to create/find a folder
  // 3. Use Google Sheets API to create/update a Sheet with appData.purchases and appData.settings
  
  console.log("Simulating backup of data to Google Drive:");
  console.log("Settings:", JSON.stringify(appData.settings, null, 2));
  console.log(`Purchases (${appData.purchases.length} items):`, JSON.stringify(appData.purchases.slice(0, 2), null, 2) + (appData.purchases.length > 2 ? "\n... (and more purchases)" : ""));

  // Simulate a delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // The "sync when mobile has connection" part is very complex and would involve
  // background sync capabilities, likely with a Service Worker, not covered here.

  return { success: true, message: "Backup (simulado) a Google Drive iniciado. Revise la consola del servidor para ver los datos." };
}
