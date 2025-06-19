
// This file contains server actions.
"use server";

import type { PurchaseFormData, SettingsFormData, AddMerchantFormData, ContactFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';
import { restoreDataFromDrive, type DriveRestoreInput, type DriveRestoreOutput } from '@/ai/flows/restoreDataFromDriveFlow';
import { APP_NAME } from '@/config/constants';
import { Resend } from 'resend';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, writeBatch, query, where, deleteDoc, orderBy } from "firebase/firestore"; // Added orderBy
import { ensureFirebaseInitialized } from '@/lib/firebase';

// Helper para obtener la instancia de DB en acciones de servidor
async function getDbInstance() {
  const { db } = ensureFirebaseInitialized();
  if (!db) {
    throw new Error("Firestore no está inicializado en la acción del servidor.");
  }
  return db;
}

export async function addPurchaseAction(userId: string, data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchaseId?: string }> {
  console.log("[Server Action] addPurchaseAction called for userID:", userId);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  const receiptImageUrl: string | undefined = (data as any).receiptImageUrl || undefined; // Cast if not in PurchaseFormData directly

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const newPurchaseData: Omit<Purchase, 'id'> = {
    amount: data.amount,
    date: data.date,
    merchantName: data.merchantName.trim(),
    merchantLocation: data.merchantLocation?.trim() || undefined,
    description: data.description || undefined,
    receiptImageUrl,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };

  try {
    const userPurchasesCol = collection(db, "users", userId, "purchases");
    const docRef = await addDoc(userPurchasesCol, newPurchaseData);

    const merchantName = newPurchaseData.merchantName;
    const merchantLocation = newPurchaseData.merchantLocation;
    const merchantsCol = collection(db, "users", userId, "merchants");
    // Firestore treats undefined as null for query purposes sometimes, ensure consistency
    const q = query(merchantsCol, where("name", "==", merchantName), where("location", "==", merchantLocation || null));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        await addDoc(merchantsCol, { name: merchantName, location: merchantLocation || null });
    }

    revalidatePath('/');
    revalidatePath('/history');
    revalidatePath('/merchants');
    return { success: true, message: "Compra registrada exitosamente.", purchaseId: docRef.id };
  } catch (error: any) {
    return { success: false, message: `Error al registrar la compra: ${error.message}` };
  }
}

export async function editPurchaseAction(userId: string, purchaseId: string, data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string }> {
  console.log("[Server Action] editPurchaseAction called for userID:", userId, "purchaseID:", purchaseId);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  const receiptImageUrl: string | undefined = (data as any).receiptImageUrl || undefined;

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const updatedPurchaseData: Omit<Purchase, 'id'> = {
    amount: data.amount,
    date: data.date,
    merchantName: data.merchantName.trim(),
    merchantLocation: data.merchantLocation?.trim() || undefined,
    description: data.description || undefined,
    receiptImageUrl,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };

  try {
    const purchaseDocRef = doc(db, "users", userId, "purchases", purchaseId);
    await setDoc(purchaseDocRef, updatedPurchaseData, { merge: true });

    const merchantName = updatedPurchaseData.merchantName;
    const merchantLocation = updatedPurchaseData.merchantLocation;
    const merchantsCol = collection(db, "users", userId, "merchants");
    const q = query(merchantsCol, where("name", "==", merchantName), where("location", "==", merchantLocation || null));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        await addDoc(merchantsCol, { name: merchantName, location: merchantLocation || null });
    }

    revalidatePath('/');
    revalidatePath('/history');
    revalidatePath('/merchants');
    return { success: true, message: "Compra actualizada exitosamente." };
  } catch (error: any) {
    return { success: false, message: `Error al actualizar la compra: ${error.message}` };
  }
}

export async function deletePurchaseAction(userId: string, purchaseId: string): Promise<{ success: boolean; message: string }> {
  console.log(`[Server Action] deletePurchaseAction called for userID: ${userId}, purchaseID: ${purchaseId}`);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  try {
    const purchaseDocRef = doc(db, "users", userId, "purchases", purchaseId);
    await deleteDoc(purchaseDocRef);
    revalidatePath('/');
    revalidatePath('/history');
    return { success: true, message: "Compra eliminada exitosamente." };
  } catch (error: any) {
    return { success: false, message: `Error al eliminar la compra: ${error.message}` };
  }
}

export async function updateSettingsAction(userId: string, data: SettingsFormData): Promise<{ success: boolean; message: string; settings?: BenefitSettings }> {
  console.log("[Server Action] updateSettingsAction called for userID:", userId, "with data:", data);
  if (!userId) {
    console.error("[Server Action] updateSettingsAction: userId is missing. This action should only be called for authenticated users.");
    return { success: false, message: "Usuario no autenticado. Esta acción requiere autenticación." };
  }

  const db = await getDbInstance();
  // Create a BenefitSettings compatible object from SettingsFormData
  const settingsToSave: BenefitSettings = {
    monthlyAllowance: data.monthlyAllowance,
    discountPercentage: data.discountPercentage,
    alertThresholdPercentage: data.alertThresholdPercentage,
    autoBackupToDrive: data.autoBackupToDrive,
    lastBackupTimestamp: data.lastBackupTimestamp || 0, // from form or default to 0
    enableEndOfMonthReminder: data.enableEndOfMonthReminder,
    daysBeforeEndOfMonthToRemind: data.daysBeforeEndOfMonthToRemind,
    // lastEndOfMonthReminderShownForMonth and lastLocalSaveTimestamp are part of BenefitSettings type
    // but might not be in SettingsFormData directly if not relevant for form submission.
    // We ensure they are part of the object passed to Firestore, defaulting if necessary.
    lastEndOfMonthReminderShownForMonth: (data as any).lastEndOfMonthReminderShownForMonth || undefined, // if form doesn't send it
    // lastLocalSaveTimestamp is purely client-side, so not saved to Firestore via this action.
  };


  try {
    const settingsDocRef = doc(db, "users", userId, "settings", "main");
    await setDoc(settingsDocRef, settingsToSave, { merge: true });
    revalidatePath('/');
    revalidatePath('/settings');
    return { success: true, message: "Configuración actualizada en Firestore.", settings: settingsToSave };
  } catch (error: any) {
    return { success: false, message: `Error al actualizar configuración en Firestore: ${error.message}` };
  }
}

export async function addManualMerchantAction(userId: string, data: AddMerchantFormData): Promise<{ success: boolean; message: string; merchantId?: string, merchant?: Merchant }> {
  console.log("[Server Action] addManualMerchantAction for userID:", userId);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  const newMerchantData = {
    name: data.name.trim(),
    location: data.location?.trim() || null,
  };

  try {
    const merchantsColRef = collection(db, "users", userId, "merchants");
    const q = query(merchantsColRef, where("name", "==", newMerchantData.name), where("location", "==", newMerchantData.location));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingDoc = querySnapshot.docs[0];
      return {
        success: false, message: `El comercio ya existe.`,
        merchantId: existingDoc.id, merchant: { id: existingDoc.id, ...existingDoc.data() } as Merchant
      };
    }

    const docRef = await addDoc(merchantsColRef, newMerchantData);
    revalidatePath('/merchants');
    return {
      success: true, message: `Comercio añadido a Firestore.`,
      merchantId: docRef.id, merchant: { id: docRef.id, name: newMerchantData.name, location: newMerchantData.location || undefined }
    };
  } catch (error: any) {
    return { success: false, message: `Error al añadir comercio: ${error.message}` };
  }
}

export async function triggerGoogleDriveBackupAction(
  userId: string, userEmail: string, purchasesData: string, merchantsData: string, settingsData: string, accessToken?: string
): Promise<DriveBackupOutput> {
  if (!userId || !userEmail || !accessToken) return { success: false, message: "Autenticación o token de acceso faltante." };
  try {
    const result = await backupDataToDrive({ userId, userEmail, purchasesData, merchantsData, settingsData, accessToken });
    if (result.success) {
      const db = await getDbInstance();
      await setDoc(doc(db, "users", userId, "settings", "main"), { lastBackupTimestamp: Date.now() }, { merge: true });
    }
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || "Fallo en triggerGoogleDriveBackupAction." };
  }
}

export async function triggerGoogleDriveRestoreAction(
  userId: string, userEmail: string, accessToken?: string
): Promise<DriveRestoreOutput> {
  if (!userId || !userEmail || !accessToken) return { success: false, message: "Autenticación o token de acceso faltante." };
  try {
    const result = await restoreDataFromDrive({ userId, userEmail, accessToken });
    if (result.success && result.purchasesData && result.merchantsData && result.settingsData) {
      const db = await getDbInstance();
      const batch = writeBatch(db);
      batch.set(doc(db, "users", userId, "settings", "main"), JSON.parse(result.settingsData));
      const purchasesCol = collection(db, "users", userId, "purchases");
      (await getDocs(purchasesCol)).forEach(d => batch.delete(d.ref));
      JSON.parse(result.purchasesData).forEach((p: Purchase) => batch.set(doc(purchasesCol, p.id || undefined), { ...p, id: undefined }));
      const merchantsCol = collection(db, "users", userId, "merchants");
      (await getDocs(merchantsCol)).forEach(d => batch.delete(d.ref));
      JSON.parse(result.merchantsData).forEach((m: Merchant) => batch.set(doc(merchantsCol, m.id || undefined), { ...m, id: undefined }));
      await batch.commit();
      revalidatePath('/', 'layout');
    }
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || "Fallo en triggerGoogleDriveRestoreAction." };
  }
}

export async function contactFormAction(data: ContactFormData): Promise<{ success: boolean; message: string }> {
  const targetEmail = "nicolas.s.fernandez@gmail.com";
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, message: "Servicio de correo no configurado." };
  const resend = new Resend(resendApiKey);
  try {
    const emailData = await resend.emails.send({
      from: `Contacto ${APP_NAME} <onboarding@resend.dev>`, to: [targetEmail],
      subject: `Contacto (${APP_NAME}): ${data.reason}`, reply_to: data.email,
      html: `<h1>Mensaje ${APP_NAME}</h1><p><strong>De:</strong> ${data.email}</p><p><strong>Motivo:</strong> ${data.reason}</p><hr/><p><strong>Mensaje:</strong></p><p>${data.message.replace(/\n/g, "<br>")}</p>`,
    });
    if (emailData.error) return { success: false, message: `Error: ${emailData.error.message}` };
    return { success: true, message: `Mensaje sobre "${data.reason}" enviado.` };
  } catch (error: any) { return { success: false, message: "Error inesperado." }; }
}
