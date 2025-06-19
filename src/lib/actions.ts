
// This file contains server actions.
"use server";

import type { PurchaseFormData, AddMerchantFormData, ContactFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';
import { restoreDataFromDrive, type DriveRestoreInput, type DriveRestoreOutput } from '@/ai/flows/restoreDataFromDriveFlow';
import { APP_NAME } from '@/config/constants';
import { Resend } from 'resend';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, writeBatch, query, where, deleteDoc, orderBy } from "firebase/firestore";
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

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const newPurchaseData: Omit<Purchase, 'id' | 'receiptImageUrl'> = { // receiptImageUrl is not part of PurchaseFormData
    amount: data.amount,
    date: data.date,
    merchantName: data.merchantName.trim(),
    merchantLocation: data.merchantLocation?.trim() || undefined,
    description: data.description || undefined,
    discountApplied: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat((data.amount - discountAmount).toFixed(2)),
  };

  try {
    const userPurchasesCol = collection(db, "users", userId, "purchases");
    const docRef = await addDoc(userPurchasesCol, newPurchaseData);

    const merchantName = newPurchaseData.merchantName;
    const merchantLocation = newPurchaseData.merchantLocation;
    const merchantsCol = collection(db, "users", userId, "merchants");
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
    console.error("[Server Action] addPurchaseAction Error:", error);
    return { success: false, message: `Error al registrar la compra: ${error.message}` };
  }
}

export async function editPurchaseAction(userId: string, purchaseId: string, data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string }> {
  console.log("[Server Action] editPurchaseAction called for userID:", userId, "purchaseID:", purchaseId);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();

  const discountAmount = (data.amount * currentSettings.discountPercentage) / 100;
  const updatedPurchaseData: Omit<Purchase, 'id' | 'receiptImageUrl'> = { // receiptImageUrl is not part of PurchaseFormData
    amount: data.amount,
    date: data.date,
    merchantName: data.merchantName.trim(),
    merchantLocation: data.merchantLocation?.trim() || undefined,
    description: data.description || undefined,
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
    console.error("[Server Action] editPurchaseAction Error:", error);
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
    console.error("[Server Action] deletePurchaseAction Error:", error);
    return { success: false, message: `Error al eliminar la compra: ${error.message}` };
  }
}

export async function updateSettingsAction(userId: string, data: BenefitSettings): Promise<{ success: boolean; message: string; settings?: BenefitSettings }> {
  console.log("[Server Action] updateSettingsAction called for userID:", userId, "with data:", JSON.stringify(data));
  if (!userId) {
    console.error("[Server Action] updateSettingsAction: userId is missing.");
    return { success: false, message: "Usuario no autenticado. Esta acción requiere autenticación." };
  }

  const db = await getDbInstance();

  // Construct the object to save, only including defined properties from BenefitSettings relevant to Firestore.
  // lastLocalSaveTimestamp is client-side only and not saved to Firestore.
  const settingsToSave: Partial<BenefitSettings> = {
    monthlyAllowance: data.monthlyAllowance,
    discountPercentage: data.discountPercentage,
    alertThresholdPercentage: data.alertThresholdPercentage,
    autoBackupToDrive: data.autoBackupToDrive,
    enableEndOfMonthReminder: data.enableEndOfMonthReminder,
    daysBeforeEndOfMonthToRemind: data.daysBeforeEndOfMonthToRemind,
  };

  if (data.lastBackupTimestamp !== undefined) {
    settingsToSave.lastBackupTimestamp = data.lastBackupTimestamp;
  } else {
    settingsToSave.lastBackupTimestamp = 0; // Default to 0 if undefined
  }

  if (data.lastEndOfMonthReminderShownForMonth !== undefined) {
    settingsToSave.lastEndOfMonthReminderShownForMonth = data.lastEndOfMonthReminderShownForMonth;
  } else {
     // If undefined, Firestore will omit this field when merging, which is fine.
     // Or set to null if you prefer explicit nulls: settingsToSave.lastEndOfMonthReminderShownForMonth = null;
  }
  
  console.log("[Server Action] updateSettingsAction - settingsToSave for Firestore:", JSON.stringify(settingsToSave));

  try {
    const settingsDocRef = doc(db, "users", userId, "settings", "main");
    await setDoc(settingsDocRef, settingsToSave, { merge: true });
    
    revalidatePath('/');
    revalidatePath('/settings');
    // Return the full 'data' (BenefitSettings type) that was intended to be saved,
    // as onSnapshot will eventually provide the true state from Firestore.
    return { success: true, message: "Configuración actualizada en Firestore.", settings: data };
  } catch (error: any) {
    console.error("[Server Action] updateSettingsAction Firestore Error:", error, "Stack:", error.stack);
    return { success: false, message: `Error al actualizar configuración en Firestore: ${error.message}` };
  }
}

export async function addManualMerchantAction(userId: string, data: AddMerchantFormData): Promise<{ success: boolean; message: string; merchantId?: string, merchant?: Merchant }> {
  console.log("[Server Action] addManualMerchantAction for userID:", userId);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  const newMerchantData = {
    name: data.name.trim(),
    location: data.location?.trim() || null, // Firestore stores null for empty optional location
  };

  try {
    const merchantsColRef = collection(db, "users", userId, "merchants");
    const q = query(merchantsColRef, where("name", "==", newMerchantData.name), where("location", "==", newMerchantData.location));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingDoc = querySnapshot.docs[0];
      return {
        success: false, message: `El comercio "${newMerchantData.name}" ${newMerchantData.location ? `en "${newMerchantData.location}"` : ''} ya existe.`,
        merchantId: existingDoc.id, merchant: { id: existingDoc.id, ...existingDoc.data() } as Merchant
      };
    }

    const docRef = await addDoc(merchantsColRef, newMerchantData);
    revalidatePath('/merchants');
    return {
      success: true, message: `Comercio "${newMerchantData.name}" añadido a Firestore.`,
      merchantId: docRef.id, merchant: { id: docRef.id, name: newMerchantData.name, location: newMerchantData.location || undefined }
    };
  } catch (error: any) {
    console.error("[Server Action] addManualMerchantAction Error:", error);
    return { success: false, message: `Error al añadir comercio: ${error.message}` };
  }
}

export async function triggerGoogleDriveBackupAction(
  userId: string, userEmail: string, purchasesData: string, merchantsData: string, settingsData: string, accessToken?: string
): Promise<DriveBackupOutput> {
  if (!userId || !userEmail || !accessToken) return { success: false, message: "Autenticación o token de acceso faltante." };
  console.log("[Server Action] triggerGoogleDriveBackupAction called for userID:", userId);
  try {
    const result = await backupDataToDrive({ userId, userEmail, purchasesData, merchantsData, settingsData, accessToken });
    if (result.success) {
      const db = await getDbInstance();
      await setDoc(doc(db, "users", userId, "settings", "main"), { lastBackupTimestamp: Date.now() }, { merge: true });
      console.log("[Server Action] triggerGoogleDriveBackupAction - Updated lastBackupTimestamp in Firestore.");
    }
    return result;
  } catch (error: any) {
    console.error("[Server Action] triggerGoogleDriveBackupAction Error:", error);
    return { success: false, message: error.message || "Fallo en triggerGoogleDriveBackupAction." };
  }
}

export async function triggerGoogleDriveRestoreAction(
  userId: string, userEmail: string, accessToken?: string
): Promise<DriveRestoreOutput> {
  if (!userId || !userEmail || !accessToken) return { success: false, message: "Autenticación o token de acceso faltante." };
  console.log("[Server Action] triggerGoogleDriveRestoreAction called for userID:", userId);
  try {
    const result = await restoreDataFromDrive({ userId, userEmail, accessToken });
    if (result.success && result.purchasesData && result.merchantsData && result.settingsData) {
      console.log("[Server Action] triggerGoogleDriveRestoreAction - Data received from Drive, preparing Firestore batch write.");
      const db = await getDbInstance();
      const batch = writeBatch(db);
      
      const settingsFromDrive = JSON.parse(result.settingsData);
      // Ensure all BenefitSettings fields are present or defaulted if necessary for Firestore
      const completeSettings: BenefitSettings = {
        monthlyAllowance: settingsFromDrive.monthlyAllowance || 0,
        discountPercentage: settingsFromDrive.discountPercentage || 0,
        alertThresholdPercentage: settingsFromDrive.alertThresholdPercentage || 0,
        autoBackupToDrive: settingsFromDrive.autoBackupToDrive || false,
        lastBackupTimestamp: settingsFromDrive.lastBackupTimestamp || Date.now(), // Set to now if missing
        enableEndOfMonthReminder: settingsFromDrive.enableEndOfMonthReminder || false,
        daysBeforeEndOfMonthToRemind: settingsFromDrive.daysBeforeEndOfMonthToRemind || 3,
        lastEndOfMonthReminderShownForMonth: settingsFromDrive.lastEndOfMonthReminderShownForMonth || null,
        // lastLocalSaveTimestamp is not part of Firestore data
      };
      batch.set(doc(db, "users", userId, "settings", "main"), completeSettings);

      const purchasesCol = collection(db, "users", userId, "purchases");
      const existingPurchases = await getDocs(purchasesCol);
      existingPurchases.forEach(d => batch.delete(d.ref));
      JSON.parse(result.purchasesData).forEach((p: any) => { // Use 'any' for flexibility from backup
          const { id, ...purchaseItemData } = p;
          const docRef = id ? doc(purchasesCol, id) : doc(purchasesCol); // Generate new ID if missing
          batch.set(docRef, purchaseItemData);
      });
      
      const merchantsCol = collection(db, "users", userId, "merchants");
      const existingMerchants = await getDocs(merchantsCol);
      existingMerchants.forEach(d => batch.delete(d.ref));
      JSON.parse(result.merchantsData).forEach((m: any) => { // Use 'any' for flexibility from backup
          const { id, ...merchantItemData } = m;
          const docRef = id ? doc(merchantsCol, id) : doc(merchantsCol); // Generate new ID if missing
          batch.set(docRef, merchantItemData);
      });
      
      await batch.commit();
      console.log("[Server Action] triggerGoogleDriveRestoreAction - Firestore batch write completed.");
      revalidatePath('/', 'layout'); // Revalidate all paths
    }
    return result;
  } catch (error: any) {
    console.error("[Server Action] triggerGoogleDriveRestoreAction Error:", error);
    return { success: false, message: error.message || "Fallo en triggerGoogleDriveRestoreAction." };
  }
}

export async function contactFormAction(data: ContactFormData): Promise<{ success: boolean; message: string }> {
  const targetEmail = "nicolas.s.fernandez@gmail.com";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("[Server Action] contactFormAction: RESEND_API_KEY is not set.");
    return { success: false, message: "Servicio de correo no configurado correctamente." };
  }

  const resend = new Resend(resendApiKey);
  try {
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
