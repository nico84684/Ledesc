
// This file contains server actions.
// For this prototype, they will interact with the client-side store via context/hooks.
// In a real application, these would interact with a database.
"use server";

import type { PurchaseFormData, SettingsFormData, AddMerchantFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, AppState, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type BackupDataInput, type BackupDataOutput } from '@/ai/flows/backup-data-flow';

export async function addPurchaseAction(data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchase?: Purchase }> {
  console.log("Server Action: addPurchaseAction called with data:", data);
  
  let receiptImageUrl: string | undefined = undefined;
  if (data.receiptImage && data.receiptImage.size > 0) {
    receiptImageUrl = `https://placehold.co/300x200.png?text=Recibo&font=roboto`;
  }

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const newPurchase: Purchase = {
    id: new Date().toISOString() + Math.random().toString(),
    amount: data.amount,
    date: data.date, 
    merchantName: data.merchantName.trim(), // Trim merchant name
    description: data.description || undefined,
    receiptImageUrl,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };
  
  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/merchants'); // Revalidar merchants page
  
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
  };

  // En una app real: await db.insertMerchant(newMerchant) y verificar duplicados en DB.
  // Aquí, la verificación de duplicados y la adición al estado se harán en el cliente (store).

  revalidatePath('/merchants');

  // Devolvemos el merchant para que el cliente lo pueda usar para actualizar el store,
  // pero el store será el que realmente decida si lo añade o no (por si ya existe).
  return { success: true, message: `Solicitud para añadir "${newMerchant.name}" procesada.`, merchant: newMerchant };
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
    const result = await backupDataToDrive(flowInput);
    console.log("Resultado del flujo de Genkit backupDataToDrive:", result);
    return result;
  } catch (error: any) {
    console.error("Error al invocar el flujo de Genkit backupDataToDrive:", error);
    return { success: false, message: `Error al procesar el respaldo: ${error.message || 'Error desconocido del flujo'}` };
  }
}
