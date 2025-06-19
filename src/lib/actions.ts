
// This file contains server actions.
"use server";

import type { PurchaseFormData, SettingsFormData, AddMerchantFormData, ContactFormData } from '@/lib/schemas';
import type { Purchase, BenefitSettings, Merchant } from '@/types';
import { revalidatePath } from 'next/cache';
import { backupDataToDrive, type DriveBackupInput, type DriveBackupOutput } from '@/ai/flows/driveBackupFlow';
import { restoreDataFromDrive, type DriveRestoreInput, type DriveRestoreOutput } from '@/ai/flows/restoreDataFromDriveFlow';
import { APP_NAME } from '@/config/constants';
import { Resend } from 'resend';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, writeBatch, query, where, deleteDoc } from "firebase/firestore";
import { ensureFirebaseInitialized } from '@/lib/firebase'; // No usar {db} directamente aquí porque es una acción de servidor

// Helper para obtener la instancia de DB en acciones de servidor
async function getDbInstance() {
  const { db } = ensureFirebaseInitialized(); // Esto se ejecutará en el entorno del servidor de acciones
  if (!db) {
    throw new Error("Firestore no está inicializado en la acción del servidor.");
  }
  return db;
}

export async function addPurchaseAction(userId: string, data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string; purchaseId?: string }> {
  console.log("[Server Action] addPurchaseAction called for userID:", userId, "with data:", data);
  if (!userId) return { success: false, message: "Usuario no autenticado." };
  
  const db = await getDbInstance();
  const receiptImageUrl: string | undefined = undefined;

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
    revalidatePath('/');
    revalidatePath('/history');
    revalidatePath('/merchants');
    return { success: true, message: "Compra registrada exitosamente en Firestore.", purchaseId: docRef.id };
  } catch (error: any) {
    console.error("[Server Action] Error adding purchase to Firestore:", error);
    return { success: false, message: `Error al registrar la compra: ${error.message}` };
  }
}

export async function editPurchaseAction(userId: string, purchaseId: string, data: PurchaseFormData, currentSettings: BenefitSettings): Promise<{ success: boolean; message: string }> {
  console.log("[Server Action] editPurchaseAction called for userID:", userId, "purchaseID:", purchaseId, "with data:", data);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  const receiptImageUrl: string | undefined = undefined;

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
    await setDoc(purchaseDocRef, updatedPurchaseData, { merge: true }); // merge:true para actualizar o crear si no existe
    revalidatePath('/');
    revalidatePath('/history');
    revalidatePath('/merchants');
    return { success: true, message: "Compra actualizada exitosamente en Firestore." };
  } catch (error: any) {
    console.error("[Server Action] Error updating purchase in Firestore:", error);
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
    return { success: true, message: "Compra eliminada exitosamente de Firestore." };
  } catch (error: any) {
    console.error(`[Server Action] Error deleting purchase ${purchaseId} from Firestore:`, error);
    return { success: false, message: `Error al eliminar la compra: ${error.message}` };
  }
}

export async function updateSettingsAction(userId: string, data: SettingsFormData): Promise<{ success: boolean; message: string; settings?: BenefitSettings }> {
  console.log("[Server Action] updateSettingsAction called for userID:", userId, "with data:", data);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  const settingsToSave: BenefitSettings = {
    monthlyAllowance: data.monthlyAllowance,
    discountPercentage: data.discountPercentage,
    alertThresholdPercentage: data.alertThresholdPercentage,
    autoBackupToDrive: data.autoBackupToDrive,
    lastBackupTimestamp: data.lastBackupTimestamp || 0, // Asegurar que siempre sea un número
    enableEndOfMonthReminder: data.enableEndOfMonthReminder,
    daysBeforeEndOfMonthToRemind: data.daysBeforeEndOfMonthToRemind,
  };

  try {
    const settingsDocRef = doc(db, "users", userId, "settings", "main");
    await setDoc(settingsDocRef, settingsToSave);
    revalidatePath('/');
    revalidatePath('/settings');
    return { success: true, message: "Configuración actualizada exitosamente en Firestore.", settings: settingsToSave };
  } catch (error: any) {
    console.error("[Server Action] Error updating settings in Firestore:", error);
    return { success: false, message: `Error al actualizar la configuración: ${error.message}` };
  }
}

export async function addManualMerchantAction(userId: string, data: AddMerchantFormData): Promise<{ success: boolean; message: string; merchantId?: string, merchant?: Merchant }> {
  console.log("[Server Action] addManualMerchantAction called for userID:", userId, "with data:", data);
  if (!userId) return { success: false, message: "Usuario no autenticado." };

  const db = await getDbInstance();
  const newMerchantData = { // No incluimos 'id' aquí, Firestore lo genera
    name: data.name.trim(),
    location: data.location?.trim() || undefined,
  };

  try {
    // Verificar si ya existe un comerciante con el mismo nombre y ubicación
    const merchantsColRef = collection(db, "users", userId, "merchants");
    let q = query(merchantsColRef, where("name", "==", newMerchantData.name));
    if (newMerchantData.location) {
        q = query(q, where("location", "==", newMerchantData.location));
    } else {
        // Si no hay ubicación, buscamos uno con el mismo nombre y sin ubicación o ubicación vacía.
        // Firestore no permite where 'location' '==' undefined directamente de forma sencilla.
        // Esta lógica se simplifica asumiendo que si location es undefined/vacío, es único por nombre.
        // Para una búsqueda más precisa de "sin ubicación", se almacenaría un valor placeholder o se filtraría en cliente.
        // Por ahora, si newMerchantData.location es undefined, solo buscamos por nombre.
        // Esta lógica se perfeccionará en el store del cliente.
    }

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        // Si location está definido y encontramos una coincidencia exacta, ya existe.
        // Si location no está definido y encontramos una coincidencia por nombre, ya existe (bajo la simplificación actual).
        if (newMerchantData.location || (!newMerchantData.location && querySnapshot.docs.some(d => !(d.data().location)))) {
            const existingDoc = querySnapshot.docs[0];
            return { 
                success: false, 
                message: `El comercio "${newMerchantData.name}" ${newMerchantData.location ? `en "${newMerchantData.location}"` : ''} ya existe.`,
                merchantId: existingDoc.id,
                merchant: { id: existingDoc.id, ...existingDoc.data() } as Merchant
            };
        }
    }

    const docRef = await addDoc(merchantsColRef, newMerchantData);
    revalidatePath('/merchants');
    return { 
        success: true, 
        message: `Comercio "${newMerchantData.name}" añadido exitosamente a Firestore.`, 
        merchantId: docRef.id,
        merchant: { id: docRef.id, ...newMerchantData }
    };
  } catch (error: any) {
    console.error("[Server Action] Error adding merchant to Firestore:", error);
    return { success: false, message: `Error al añadir el comercio: ${error.message}` };
  }
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
        const db = await getDbInstance();
        const settingsDocRef = doc(db, "users", userId, "settings", "main");
        await setDoc(settingsDocRef, { lastBackupTimestamp: Date.now() }, { merge: true });
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

    if (result.success && result.purchasesData && result.merchantsData && result.settingsData) {
        const db = await getDbInstance();
        const batch = writeBatch(db);

        // Restaurar settings
        const settingsDocRef = doc(db, "users", userId, "settings", "main");
        const parsedSettings = JSON.parse(result.settingsData);
        batch.set(settingsDocRef, parsedSettings);

        // Limpiar y restaurar purchases
        const purchasesColRef = collection(db, "users", userId, "purchases");
        const currentPurchasesSnapshot = await getDocs(purchasesColRef);
        currentPurchasesSnapshot.forEach(d => batch.delete(d.ref));
        const parsedPurchases: Purchase[] = JSON.parse(result.purchasesData);
        parsedPurchases.forEach(p => {
            const { id, ...purchaseData } = p; // Firestore autogenerará IDs si no se especifica uno en addDoc
            batch.set(doc(purchasesColRef, p.id || undefined), purchaseData); // Usar el ID original si existe
        });

        // Limpiar y restaurar merchants
        const merchantsColRef = collection(db, "users", userId, "merchants");
        const currentMerchantsSnapshot = await getDocs(merchantsColRef);
        currentMerchantsSnapshot.forEach(d => batch.delete(d.ref));
        const parsedMerchants: Merchant[] = JSON.parse(result.merchantsData);
        parsedMerchants.forEach(m => {
            const { id, ...merchantData } = m;
            batch.set(doc(merchantsColRef, m.id || undefined), merchantData);
        });
        
        await batch.commit();
        revalidatePath('/', 'layout'); // Revalidar todas las rutas
    }
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
    return { success: false, message: "El servicio de envío de correo no está configurado correctamente. Por favor, contacta al administrador." };
  }

  const resend = new Resend(resendApiKey);

  try {
    const emailData = await resend.emails.send({
      from: `Contacto ${APP_NAME} <onboarding@resend.dev>`, 
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

    console.log(`[Server Action] Correo enviado exitosamente a ${targetEmail} a través de Resend. ID: ${emailData.data?.id}`);
    return { success: true, message: `Gracias por tu mensaje sobre "${data.reason}". Ha sido enviado.` };

  } catch (error: any) {
    console.error("[Server Action] Excepción al intentar enviar correo con Resend:", error);
    return { success: false, message: "Hubo un problema inesperado al intentar enviar tu mensaje. Por favor, intenta más tarde." };
  }
}
