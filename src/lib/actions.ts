
// This file contains server actions.
"use server";

import type { PurchaseFormData, AddMerchantFormData, ContactFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';
import { restoreDataFromDrive, type DriveRestoreInput, type DriveRestoreOutput } from '@/ai/flows/restoreDataFromDriveFlow';
import { APP_NAME, DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';
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
  const newPurchaseData: Omit<Purchase, 'id' | 'receiptImageUrl'> = {
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
  const updatedPurchaseData: Omit<Purchase, 'id' | 'receiptImageUrl'> = {
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
  console.log("[Server Action] updateSettingsAction called for userID:", userId);
  console.log("[Server Action] updateSettingsAction received data:", JSON.stringify(data, null, 2));


  if (!userId) {
    console.error("[Server Action] updateSettingsAction: userId is missing.");
    return { success: false, message: "Usuario no autenticado. Esta acción requiere autenticación." };
  }

  const { db } = ensureFirebaseInitialized();
  if (!db) {
    console.error("[Server Action] updateSettingsAction: Firestore DB instance is not available.");
    return { success: false, message: "Error interno del servidor: Base de datos no disponible." };
  }

  const settingsToSave: Partial<BenefitSettings> = {};

  // Required numeric fields
  if (typeof data.monthlyAllowance === 'number') settingsToSave.monthlyAllowance = data.monthlyAllowance;
  else settingsToSave.monthlyAllowance = DEFAULT_BENEFIT_SETTINGS.monthlyAllowance;

  if (typeof data.discountPercentage === 'number') settingsToSave.discountPercentage = data.discountPercentage;
  else settingsToSave.discountPercentage = DEFAULT_BENEFIT_SETTINGS.discountPercentage;

  if (typeof data.alertThresholdPercentage === 'number') settingsToSave.alertThresholdPercentage = data.alertThresholdPercentage;
  else settingsToSave.alertThresholdPercentage = DEFAULT_BENEFIT_SETTINGS.alertThresholdPercentage;
  
  if (typeof data.daysBeforeEndOfMonthToRemind === 'number') settingsToSave.daysBeforeEndOfMonthToRemind = data.daysBeforeEndOfMonthToRemind;
  else settingsToSave.daysBeforeEndOfMonthToRemind = DEFAULT_BENEFIT_SETTINGS.daysBeforeEndOfMonthToRemind;

  // Required boolean fields
  if (typeof data.autoBackupToDrive === 'boolean') settingsToSave.autoBackupToDrive = data.autoBackupToDrive;
  else settingsToSave.autoBackupToDrive = DEFAULT_BENEFIT_SETTINGS.autoBackupToDrive;

  if (typeof data.enableEndOfMonthReminder === 'boolean') settingsToSave.enableEndOfMonthReminder = data.enableEndOfMonthReminder;
  else settingsToSave.enableEndOfMonthReminder = DEFAULT_BENEFIT_SETTINGS.enableEndOfMonthReminder;
  
  // Optional fields
  if (typeof data.lastBackupTimestamp === 'number') settingsToSave.lastBackupTimestamp = data.lastBackupTimestamp;
  else settingsToSave.lastBackupTimestamp = 0; // Default to 0 if not provided or incorrect type

  if (typeof data.lastEndOfMonthReminderShownForMonth === 'string' && data.lastEndOfMonthReminderShownForMonth.trim() !== '') {
    settingsToSave.lastEndOfMonthReminderShownForMonth = data.lastEndOfMonthReminderShownForMonth;
  } else if (data.lastEndOfMonthReminderShownForMonth === null) {
     // If explicitly null, we let Firestore remove it or store it as null if the field exists
     // For 'merge: true', omitting it is often cleaner if the intent is to not set it.
     // However, if we want to explicitly clear it in Firestore, we might need to send null,
     // but the type BenefitSettings suggests it's optional (string | undefined).
     // For now, if it's null, we'll treat it as undefined by not setting it.
  }
  // lastLocalSaveTimestamp is not saved to Firestore from this action.

  console.log("[Server Action] updateSettingsAction - Object to be saved to Firestore:", JSON.stringify(settingsToSave, null, 2));

  try {
    const settingsDocRef = doc(db, "users", userId, "settings", "main");
    await setDoc(settingsDocRef, settingsToSave, { merge: true });
    
    console.log("[Server Action] updateSettingsAction: Firestore setDoc successful.");
    revalidatePath('/');
    revalidatePath('/settings');
    const currentSettingsDoc = await getDoc(settingsDocRef);
    const fetchedSettings = currentSettingsDoc.exists() ? currentSettingsDoc.data() as BenefitSettings : undefined;
    
    return { success: true, message: "Configuración actualizada en Firestore.", settings: fetchedSettings || data };
  } catch (error: any) {
    console.error(
        "[Server Action] updateSettingsAction Firestore Error:", 
        error.message, 
        "Code:", error.code, 
        "Details:", error.details, 
        "Stack:", error.stack
    );
    return { 
        success: false, 
        message: `Error al actualizar configuración en Firestore: ${error.message}${error.code ? ` (Código: ${error.code})` : ''}` 
    };
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
      const completeSettings: BenefitSettings = {
        monthlyAllowance: typeof settingsFromDrive.monthlyAllowance === 'number' ? settingsFromDrive.monthlyAllowance : DEFAULT_BENEFIT_SETTINGS.monthlyAllowance,
        discountPercentage: typeof settingsFromDrive.discountPercentage === 'number' ? settingsFromDrive.discountPercentage : DEFAULT_BENEFIT_SETTINGS.discountPercentage,
        alertThresholdPercentage: typeof settingsFromDrive.alertThresholdPercentage === 'number' ? settingsFromDrive.alertThresholdPercentage : DEFAULT_BENEFIT_SETTINGS.alertThresholdPercentage,
        autoBackupToDrive: typeof settingsFromDrive.autoBackupToDrive === 'boolean' ? settingsFromDrive.autoBackupToDrive : DEFAULT_BENEFIT_SETTINGS.autoBackupToDrive,
        lastBackupTimestamp: typeof settingsFromDrive.lastBackupTimestamp === 'number' ? settingsFromDrive.lastBackupTimestamp : Date.now(),
        enableEndOfMonthReminder: typeof settingsFromDrive.enableEndOfMonthReminder === 'boolean' ? settingsFromDrive.enableEndOfMonthReminder : DEFAULT_BENEFIT_SETTINGS.enableEndOfMonthReminder,
        daysBeforeEndOfMonthToRemind: typeof settingsFromDrive.daysBeforeEndOfMonthToRemind === 'number' ? settingsFromDrive.daysBeforeEndOfMonthToRemind : DEFAULT_BENEFIT_SETTINGS.daysBeforeEndOfMonthToRemind,
        lastEndOfMonthReminderShownForMonth: (settingsFromDrive.lastEndOfMonthReminderShownForMonth === undefined || settingsFromDrive.lastEndOfMonthReminderShownForMonth === null) ? undefined : String(settingsFromDrive.lastEndOfMonthReminderShownForMonth),
      };
      batch.set(doc(db, "users", userId, "settings", "main"), completeSettings);

      const purchasesCol = collection(db, "users", userId, "purchases");
      const existingPurchases = await getDocs(purchasesCol);
      existingPurchases.forEach(d => batch.delete(d.ref));
      JSON.parse(result.purchasesData).forEach((p: any) => { 
          const { id, ...purchaseItemData } = p;
          const docRef = id ? doc(purchasesCol, id) : doc(purchasesCol); 
          batch.set(docRef, purchaseItemData);
      });
      
      const merchantsCol = collection(db, "users", userId, "merchants");
      const existingMerchants = await getDocs(merchantsCol);
      existingMerchants.forEach(d => batch.delete(d.ref));
      JSON.parse(result.merchantsData).forEach((m: any) => { 
          const { id, ...merchantItemData } = m;
          const docRef = id ? doc(merchantsCol, id) : doc(merchantsCol); 
          batch.set(docRef, merchantItemData);
      });
      
      await batch.commit();
      console.log("[Server Action] triggerGoogleDriveRestoreAction - Firestore batch write completed.");
      revalidatePath('/', 'layout'); 
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
