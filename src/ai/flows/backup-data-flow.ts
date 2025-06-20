"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Purchase, BenefitSettings, AppState, Merchant } from '@/types';
import { DEFAULT_BENEFIT_SETTINGS, APP_NAME } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, getDaysInMonth, getDate, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter, usePathname } from 'next/navigation';
import * as XLSX from 'xlsx';
// import { triggerGoogleDriveBackupAction } from '@/lib/actions'; // Comentado para evitar el crash del servidor
import { useAuth } from '@/components/layout/Providers';
import { ensureFirebaseInitialized } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy, where, type Firestore } from "firebase/firestore";
import { updateSettingsAction as serverUpdateSettingsAction, addPurchaseAction as serverAddPurchaseAction, editPurchaseAction as serverEditPurchaseAction, deletePurchaseAction as serverDeletePurchaseAction, addManualMerchantAction as serverAddManualMerchantAction } from '@/lib/actions';


interface AppDispatchContextType {
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'> & { merchantLocation?: string, amount: number, date: string, merchantName: string, description?: string }) => Promise<{success: boolean, message: string, purchaseId?: string}>;
  editPurchase: (purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'> & { merchantLocation?: string, amount: number, date: string, merchantName: string, description?: string }) => Promise<{success: boolean, message: string}>;
  deletePurchase: (purchaseId: string) => Promise<{success: boolean, message: string}>;
  updateSettings: (newSettings: Partial<BenefitSettings>) => Promise<{success: boolean, message: string, settings?: BenefitSettings}>;
  addMerchant: (merchantName: string, merchantLocation?: string) => Promise<{ success: boolean; merchant?: Merchant; message?: string }>;
  exportToCSV: () => void;
  isInitialized: boolean;
  backupToExcel: () => void;
  restoreFromExcel: (file: File) => void;
  restoreFromDrive: (purchasesDataStr?: string, merchantsDataStr?: string, settingsDataStr?: string) => void;
  updateLastBackupTimestamp: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AppDispatchContextType | undefined>(undefined);

const LOCAL_STORAGE_SETTINGS_KEY = `${APP_NAME}_settings_v2`;
const LOCAL_STORAGE_PURCHASES_KEY = `${APP_NAME}_purchases_v2`;
const LOCAL_STORAGE_MERCHANTS_KEY = `${APP_NAME}_merchants_v2`;
const INITIAL_SETUP_COMPLETE_KEY = `initialSetupComplete_${APP_NAME}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user, accessToken, isFirebaseAuthReady } = useAuth();

  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: { ...DEFAULT_BENEFIT_SETTINGS, lastEndOfMonthReminderShownForMonth: undefined, lastLocalSaveTimestamp: 0 },
    merchants: [],
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFirestoreLoading, setIsFirestoreLoading] = useState(true);

  const isMounted = useRef(false);
  const previousPurchasesRef = useRef<Purchase[]>();
  const previousMerchantsRef = useRef<Merchant[]>();
  const firestoreUnsubscribersRef = useRef<(() => void)[]>([]);


  useEffect(() => {
    const loadData = async () => {
      // console.log("[AppStore] useEffect loadData. User:", user?.uid, "isFirebaseAuthReady:", isFirebaseAuthReady, "pathname:", pathname);
      if (isFirebaseAuthReady) {
        const { db: firestoreDb } = ensureFirebaseInitialized();

        if (user && user.uid && firestoreDb) {
          // console.log(`[AppStore] User ${user.uid} authenticated. Initializing Firestore listeners.`);
          setIsFirestoreLoading(true);
          firestoreUnsubscribersRef.current.forEach(unsub => unsub());
          firestoreUnsubscribersRef.current = [];

          const settingsDocRef = doc(firestoreDb, "users", user.uid, "settings", "main");
          const purchasesColRef = collection(firestoreDb, "users", user.uid, "purchases");
          const purchasesQuery = query(purchasesColRef, orderBy("date", "desc"));
          const merchantsColRef = collection(firestoreDb, "users", user.uid, "merchants");
          const merchantsQuery = query(merchantsColRef, orderBy("name"));

          const settingsUnsub = onSnapshot(settingsDocRef, (docSnap) => {
            const newSettings = docSnap.exists()
              ? { ...DEFAULT_BENEFIT_SETTINGS, ...(docSnap.data() as BenefitSettings), lastLocalSaveTimestamp: state.settings.lastLocalSaveTimestamp }
              : { ...DEFAULT_BENEFIT_SETTINGS, lastEndOfMonthReminderShownForMonth: undefined, lastLocalSaveTimestamp: state.settings.lastLocalSaveTimestamp };
            setState(prevState => ({ ...prevState, settings: newSettings }));
            if (docSnap.exists() && typeof window !== 'undefined') localStorage.setItem(INITIAL_SETUP_COMPLETE_KEY, 'true');
            else if (!docSnap.exists() && typeof window !== 'undefined' && localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) !== 'true' && pathname !== '/settings') {
                // console.log("[AppStore] No Firestore settings, setup not complete, redirecting to /settings");
                router.push('/settings');
            }
          }, (error) => console.error("[AppStore] Error listening to settings:", error));
          firestoreUnsubscribersRef.current.push(settingsUnsub);

          const purchasesUnsub = onSnapshot(purchasesQuery, (snapshot) => {
            const purchasesFromFirestore = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
            setState(prevState => ({ ...prevState, purchases: purchasesFromFirestore }));
            previousPurchasesRef.current = purchasesFromFirestore;
          }, (error) => console.error("[AppStore] Error listening to purchases:", error));
          firestoreUnsubscribersRef.current.push(purchasesUnsub);

          const merchantsUnsub = onSnapshot(merchantsQuery, (snapshot) => {
            const merchantsFromFirestore = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Merchant));
            setState(prevState => ({ ...prevState, merchants: merchantsFromFirestore }));
            previousMerchantsRef.current = merchantsFromFirestore;
          }, (error) => console.error("[AppStore] Error listening to merchants:", error));
          firestoreUnsubscribersRef.current.push(merchantsUnsub);

          try {
            await Promise.all([getDoc(settingsDocRef), getDocs(purchasesQuery), getDocs(merchantsQuery)]);
          } catch (error: any) {
            console.error("[AppStore] Error during initial Firestore batch load:", error);
            // Display a user-friendly toast for persistent connection issues
            if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
               toast({
                title: 'Error de Conexión con Firestore',
                description: 'No se pudieron cargar los datos. Esto puede deberse a un problema de red o a la configuración de tu proyecto Firebase (verifica que la API de Firestore esté habilitada y que tu clave de API no tenga restricciones de dominio).',
                variant: 'destructive',
                duration: 20000,
              });
            }
          } finally { 
            setIsFirestoreLoading(false);
            setIsInitialized(true); 
          }

        } else {
          // console.log("[AppStore] No authenticated user or Firestore DB not ready. Loading from localStorage.");
          setIsFirestoreLoading(false);
          if (typeof window !== 'undefined') {
            const localSettingsStr = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
            const localPurchasesStr = localStorage.getItem(LOCAL_STORAGE_PURCHASES_KEY);
            const localMerchantsStr = localStorage.getItem(LOCAL_STORAGE_MERCHANTS_KEY);
            const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';

            const loadedSettings = localSettingsStr ? JSON.parse(localSettingsStr) : { ...DEFAULT_BENEFIT_SETTINGS, lastEndOfMonthReminderShownForMonth: undefined, lastLocalSaveTimestamp: 0 };

            setState({
              settings: loadedSettings,
              purchases: localPurchasesStr ? JSON.parse(localPurchasesStr) : [],
              merchants: localMerchantsStr ? JSON.parse(localMerchantsStr) : [],
            });
            if (!setupComplete && pathname !== '/settings') {
              // console.log("[AppStore] localStorage setup not complete, redirecting to /settings");
              router.push('/settings');
            }
          }
          setIsInitialized(true);
        }
      }
    };
    loadData();
    return () => {
      firestoreUnsubscribersRef.current.forEach(unsub => unsub());
      firestoreUnsubscribersRef.current = [];
    };
  }, [user, isFirebaseAuthReady, router, pathname]);


  useEffect(() => {
    if (isInitialized && !user && typeof window !== 'undefined' && isMounted.current) {
      // console.log("[AppStore Persist Local] Saving state to localStorage when user is not logged in.");
      try {
        const settingsForLocalStorage = { ...state.settings };
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settingsForLocalStorage));
        localStorage.setItem(LOCAL_STORAGE_PURCHASES_KEY, JSON.stringify(state.purchases));
        localStorage.setItem(LOCAL_STORAGE_MERCHANTS_KEY, JSON.stringify(state.merchants));
      } catch (error) {
        console.error("[AppStore Persist Local] FAILED to save state to localStorage:", error);
        toast({
          title: "Error de Guardado Local",
          description: "No se pudo guardar el estado de la aplicación localmente.",
          variant: "destructive",
        });
      }
    }
    if (!isMounted.current && isInitialized) {
        isMounted.current = true;
    }
  }, [state.settings, state.purchases, state.merchants, user, isInitialized, toast]);


  const updateLastBackupTimestamp = useCallback(async () => {
    if (!user || !user.uid) return;
    const { db: firestoreDb } = ensureFirebaseInitialized();
    if (!firestoreDb) return;
    try {
      const settingsDocRef = doc(firestoreDb, "users", user.uid, "settings", "main");
      await setDoc(settingsDocRef, { lastBackupTimestamp: Date.now() }, { merge: true });
      // onSnapshot will update local state.settings
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar la fecha del último backup en la nube.", variant: "destructive" });
    }
  }, [user, toast]);

  /* // Lógica de Auto-Backup deshabilitada para prevenir crashes del servidor
  const handleAutoBackup = useCallback(async () => {
    if (!state.settings.autoBackupToDrive || !user || !user.uid || !user.email || !accessToken) return;
    const { db: firestoreDb } = ensureFirebaseInitialized();
    if (!firestoreDb) return;
    // console.log("[AppStore AutoBackup] Triggering auto backup to Drive.");
    try {
      await triggerGoogleDriveBackupAction(
        user.uid, user.email, JSON.stringify(state.purchases),
        JSON.stringify(state.merchants), JSON.stringify(state.settings), accessToken
      );
      // The updateLastBackupTimestamp is implicitly handled by the server action if successful,
      // which then triggers onSnapshot for settings.
    } catch (error: any) {
      toast({ title: "Error de Auto-Backup a Drive", description: error.message || "Error inesperado.", variant: "destructive" });
    }
  }, [state.settings, state.purchases, state.merchants, user, accessToken, toast]);

  useEffect(() => {
    if (!isInitialized || !isMounted.current || !state.settings.autoBackupToDrive || !user) return;
    
    const purchasesChanged = JSON.stringify(state.purchases) !== JSON.stringify(previousPurchasesRef.current);
    const merchantsChanged = JSON.stringify(state.merchants) !== JSON.stringify(previousMerchantsRef.current);
    
    if (purchasesChanged || merchantsChanged) {
      // console.log("[AppStore AutoBackup] Data changed, scheduling auto backup.");
      handleAutoBackup();
    }
    previousPurchasesRef.current = state.purchases;
    previousMerchantsRef.current = state.merchants;
  }, [state.purchases, state.merchants, state.settings.autoBackupToDrive, isInitialized, user, handleAutoBackup]);
  */

  useEffect(() => {
    if (!isInitialized || !state.settings.enableEndOfMonthReminder || isFirestoreLoading ) return;
    
    let firestoreDbInstance: Firestore | undefined;
    if (user && user.uid) {
        const { db } = ensureFirebaseInitialized();
        firestoreDbInstance = db;
        if (!firestoreDbInstance && !isFirestoreLoading) return;
    }

    const now = new Date();
    const currentMonthYear = format(now, 'yyyy-MM');
    if (state.settings.lastEndOfMonthReminderShownForMonth === currentMonthYear) return;

    const daysRemainingInMonth = getDaysInMonth(now) - getDate(now);
    if (daysRemainingInMonth >= 0 && daysRemainingInMonth <= state.settings.daysBeforeEndOfMonthToRemind) {
      const totalSpentThisMonth = state.purchases
        .filter(p => isSameMonth(parseISO(p.date), now))
        .reduce((sum, p) => sum + p.finalAmount, 0);
      const remainingBalance = Math.max(0, state.settings.monthlyAllowance - totalSpentThisMonth);

      if (remainingBalance > 0) {
        setTimeout(() => toast({
          title: "Recordatorio de Beneficio",
          description: `Quedan ${daysRemainingInMonth} día(s) en ${format(now, "MMMM", { locale: es })} y tienes ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(remainingBalance)} de beneficio.`,
          duration: 10000,
        }), 0);

        const newLastReminderMonth = currentMonthYear;
        // Update settings in memory and persist if necessary
        const newSettings = { ...state.settings, lastEndOfMonthReminderShownForMonth: newLastReminderMonth };
        if (user && user.uid && firestoreDbInstance) {
          const settingsDocRef = doc(firestoreDbInstance, "users", user.uid, "settings", "main");
          setDoc(settingsDocRef, { lastEndOfMonthReminderShownForMonth: newLastReminderMonth }, { merge: true });
          // onSnapshot will update local state
        } else if (!user && typeof window !== 'undefined') {
           setState(prevState => ({ ...prevState, settings: newSettings }));
           // The localStorage persistence useEffect will pick this change up.
        }
      }
    }
  }, [isInitialized, state.settings, state.purchases, toast, user, isFirestoreLoading]);

  const addPurchase = useCallback(async (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'> & { merchantLocation?: string, amount: number, date: string, merchantName: string, description?: string }): Promise<{success: boolean, message: string, purchaseId?: string}> => {
    const { db: firestoreDb } = ensureFirebaseInitialized();
    // Calculations are now primarily done in server action or Firestore trigger if more complex.
    // For local (non-user) mode, calculations are still needed here.
    const discountAmount = (purchaseData.amount * state.settings.discountPercentage) / 100;
    const newPurchaseCoreData: Omit<Purchase, 'id'> = {
      amount: purchaseData.amount, date: purchaseData.date, merchantName: purchaseData.merchantName.trim(),
      merchantLocation: purchaseData.merchantLocation?.trim() || undefined, description: purchaseData.description || undefined,
      receiptImageUrl: undefined, // Assuming no image upload for now
      discountApplied: parseFloat(discountAmount.toFixed(2)),
      finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
    };

    if (user && user.uid && firestoreDb) {
      // For logged-in users, server action handles Firestore write.
      // onSnapshot will update local state.
      return serverAddPurchaseAction(user.uid, purchaseData, state.settings);
    } else {
      // For non-logged-in users, update local state.
      const newPurchase: Purchase = { id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, ...newPurchaseCoreData };
      setState(prevState => {
        const updatedPurchases = [...prevState.purchases, newPurchase].sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
        const merchantExists = prevState.merchants.some(m => m.name === newPurchase.merchantName && (m.location || undefined) === (newPurchase.merchantLocation || undefined));
        let updatedMerchants = prevState.merchants;
        if (!merchantExists) {
            updatedMerchants = [...prevState.merchants, { id: `local_m_${Date.now()}`, name: newPurchase.merchantName, location: newPurchase.merchantLocation }].sort((a,b) => a.name.localeCompare(b.name));
        }
        return { ...prevState, purchases: updatedPurchases, merchants: updatedMerchants };
      });
      return { success: true, message: "Compra registrada localmente.", purchaseId: newPurchase.id };
    }
  }, [user, state.settings]);

  const editPurchase = useCallback(async (purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'> & { merchantLocation?: string, amount: number, date: string, merchantName: string, description?: string }): Promise<{success: boolean, message: string}> => {
    const { db: firestoreDb } = ensureFirebaseInitialized();
    const discountAmount = (purchaseData.amount * state.settings.discountPercentage) / 100;
    const updatedPurchaseCoreData: Omit<Purchase, 'id'> = {
      amount: purchaseData.amount, date: purchaseData.date, merchantName: purchaseData.merchantName.trim(),
      merchantLocation: purchaseData.merchantLocation?.trim() || undefined, description: purchaseData.description || undefined,
      receiptImageUrl: undefined,
      discountApplied: parseFloat(discountAmount.toFixed(2)),
      finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
    };

    if (user && user.uid && firestoreDb) {
      return serverEditPurchaseAction(user.uid, purchaseId, purchaseData, state.settings);
    } else {
      setState(prevState => {
        const updatedPurchases = prevState.purchases.map(p => p.id === purchaseId ? { ...p, ...updatedPurchaseCoreData } : p).sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
        const merchantExists = prevState.merchants.some(m => m.name === updatedPurchaseCoreData.merchantName && (m.location || undefined) === (updatedPurchaseCoreData.merchantLocation || undefined));
        let updatedMerchants = prevState.merchants;
        if (!merchantExists) {
             updatedMerchants = [...prevState.merchants, { id: `local_m_${Date.now()}`, name: updatedPurchaseCoreData.merchantName, location: updatedPurchaseCoreData.merchantLocation }].sort((a,b) => a.name.localeCompare(b.name));
        }
        return { ...prevState, purchases: updatedPurchases, merchants: updatedMerchants };
      });
      return { success: true, message: "Compra actualizada localmente." };
    }
  }, [user, state.settings]);

  const deletePurchase = useCallback(async (purchaseId: string): Promise<{success: boolean, message: string}> => {
    const { db: firestoreDb } = ensureFirebaseInitialized();
    // console.log(`[AppStore] deletePurchase called for ID: ${purchaseId}. User: ${user?.uid}`);
    if (user && user.uid && firestoreDb) {
      // For logged-in users, server action handles Firestore delete.
      // onSnapshot will update local state.
      return serverDeletePurchaseAction(user.uid, purchaseId);
    } else {
      // For non-logged-in users, update local state.
      setState(prevState => ({ ...prevState, purchases: prevState.purchases.filter(p => p.id !== purchaseId) }));
      return { success: true, message: "Compra eliminada localmente." };
    }
  }, [user]);

  const updateSettings = useCallback(async (newSettingsData: Partial<BenefitSettings>): Promise<{success: boolean, message: string, settings?: BenefitSettings}> => {
    const { db: firestoreDb } = ensureFirebaseInitialized();
    const currentSettingsInMemory = state.settings; // Get current settings from memory
    const mergedSettings = { ...currentSettingsInMemory, ...newSettingsData };

    if (user && user.uid && firestoreDb) {
      // serverUpdateSettingsAction will write to Firestore.
      // onSnapshot for settings will then update the local state.
      const actionResult = await serverUpdateSettingsAction(user.uid, mergedSettings);
      return { ...actionResult, settings: actionResult.success ? (actionResult.settings || mergedSettings) : currentSettingsInMemory };
    } else {
      // For non-logged-in users, update local state directly.
      // The useEffect will persist it to localStorage.
      setState(prevState => ({ ...prevState, settings: mergedSettings }));
      return { success: true, message: "Configuración actualizada localmente.", settings: mergedSettings };
    }
  }, [user, state.settings]); // Ensure state.settings is a dependency

  const addMerchant = useCallback(async (merchantName: string, merchantLocationInput?: string): Promise<{ success: boolean; merchant?: Merchant; message?: string }> => {
    const { db: firestoreDb } = ensureFirebaseInitialized();
    const trimmedName = merchantName.trim();
    const trimmedLocation = merchantLocationInput?.trim() || undefined;
    if (user && user.uid && firestoreDb) {
      // For logged-in users, server action handles Firestore write.
      // onSnapshot will update local state.
      return serverAddManualMerchantAction(user.uid, { name: trimmedName, location: trimmedLocation });
    } else {
      const existingMerchant = state.merchants.find(m => m.name === trimmedName && (m.location || undefined) === trimmedLocation);
      if (existingMerchant) return { success: false, merchant: existingMerchant, message: `El comercio ya existe localmente.` };
      const newMerchant: Merchant = { id: `local_m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name: trimmedName, location: trimmedLocation };
      setState(prevState => ({ ...prevState, merchants: [...prevState.merchants, newMerchant].sort((a,b)=> a.name.localeCompare(b.name)) }));
      return { success: true, merchant: newMerchant, message: `Comercio añadido localmente.` };
    }
  }, [user, state.merchants]);

  const exportToCSV = useCallback(() => {
    if (state.purchases.length === 0) { toast({ title: "Sin Datos", description: "No hay transacciones para exportar."}); return; }
    const csvRows = [
      ["ID", "Monto Original", "Fecha", "Comercio", "Ubicación Compra", "Descripción", "Descuento Aplicado", "Monto Final", "URL Recibo"].join(','),
      ...state.purchases.map(p => [
        p.id, p.amount, format(parseISO(p.date), 'yyyy-MM-dd HH:mm:ss'),
        `"${p.merchantName.replace(/"/g, '""')}"`, `"${(p.merchantLocation || '').replace(/"/g, '""')}"`,
        `"${(p.description || '').replace(/"/g, '""')}"`, p.discountApplied, p.finalAmount, p.receiptImageUrl || ''
      ].join(','))
    ];
    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ledesc_transacciones_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Exportación Exitosa", description: "Datos exportados a CSV."});
  }, [state.purchases, toast]);

  const backupToExcel = useCallback(async () => {
    if (!user && state.purchases.length === 0 && state.merchants.length === 0) {
        toast({ title: "Sin Datos", description: "No hay datos locales para exportar." }); return;
    }
    // Timestamp update for Drive is handled by its action.
    // For local Excel backup, we update lastLocalSaveTimestamp in localStorage via the persistence effect.
    if (user && user.uid) {
        await updateLastBackupTimestamp();
    } else if (typeof window !== 'undefined') {
        const settingsForLocalStorage = { ...state.settings, lastLocalSaveTimestamp: Date.now() };
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settingsForLocalStorage));
        // No need to setState here for lastLocalSaveTimestamp for local users,
        // as it's primarily for the "last saved to disk" info.
        // If displayed in UI, it would be from the loaded settings.
    }

    const purchasesSheet = XLSX.utils.json_to_sheet(state.purchases.map(p => ({
        ID: p.id, 'Monto Original': p.amount, Fecha: format(parseISO(p.date), 'yyyy-MM-dd HH:mm:ss'),
        Comercio: p.merchantName, 'Ubicación Compra': p.merchantLocation || '', Descripción: p.description || '',
        'URL Recibo': p.receiptImageUrl || '', 'Descuento Aplicado': p.discountApplied, 'Monto Final': p.finalAmount,
    })));
    const merchantsSheet = XLSX.utils.json_to_sheet(state.merchants.map(m => ({ ID: m.id, Nombre: m.name, Ubicación: m.location || '' })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, purchasesSheet, "Compras");
    XLSX.utils.book_append_sheet(wb, merchantsSheet, "Comercios");
    XLSX.writeFile(wb, `LEDESC_Backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    toast({ title: "Backup Exitoso", description: "Datos exportados a Excel." });
  }, [state.purchases, state.merchants, state.settings, toast, updateLastBackupTimestamp, user]);

  const restoreFromExcel = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { db: firestoreDb } = ensureFirebaseInitialized();
        const data = e.target?.result; if (!data) throw new Error("No se pudo leer archivo.");
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        if (!wb.SheetNames.includes("Compras") || !wb.SheetNames.includes("Comercios")) throw new Error("Hojas 'Compras'/'Comercios' no encontradas.");
        const purchasesJSON: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Compras"]);
        const merchantsJSON: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Comercios"]);
        
        const restoredPurchases: Purchase[] = purchasesJSON.map((p: any, i) => {
            let dateValue = p.Fecha;
            if (typeof dateValue === 'number') { // Excel date serial number
                dateValue = XLSX.SSF.parse_date_code(dateValue);
                dateValue = new Date(dateValue.y, dateValue.m - 1, dateValue.d, dateValue.H, dateValue.M, dateValue.S);
            } else if (typeof dateValue === 'string') {
                dateValue = parseISO(dateValue); // Attempt to parse ISO string
            }
            // Ensure dateValue is a Date object before calling toISOString
            const finalDateString = (dateValue instanceof Date && isValid(dateValue)) ? dateValue.toISOString() : new Date().toISOString();

            return {
                id: String(p.ID || `xl_p_${Date.now()}_${i}`), amount: Number(p['Monto Original'])||0,
                date: finalDateString,
                merchantName: String(p.Comercio||"N/A"), merchantLocation: String(p['Ubicación Compra']||"")||undefined,
                description: String(p.Descripción||"")||undefined, receiptImageUrl: String(p['URL Recibo']||"")||undefined,
                discountApplied: Number(p['Descuento Aplicado'])||0, finalAmount: Number(p['Monto Final'])||0,
            };
        });

        const restoredMerchants: Merchant[] = merchantsJSON.map((m: any, i) => ({
            id: String(m.ID || `xl_m_${Date.now()}_${i}`), name: String(m.Nombre||"N/A"),
            location: String(m.Ubicación||"")||undefined,
        }));

        if (user && user.uid && firestoreDb) {
          const batch = writeBatch(firestoreDb);
          const purchasesCol = collection(firestoreDb, "users", user.uid, "purchases");
          const merchantsCol = collection(firestoreDb, "users", user.uid, "merchants");
          (await getDocs(purchasesCol)).forEach(docSnap => batch.delete(docSnap.ref));
          (await getDocs(merchantsCol)).forEach(docSnap => batch.delete(docSnap.ref));
          restoredPurchases.forEach(p => { const {id, ...dataToSet} = p; batch.set(doc(purchasesCol, id), dataToSet); });
          restoredMerchants.forEach(m => { const {id, ...dataToSet} = m; batch.set(doc(merchantsCol, id), dataToSet); });
          await batch.commit();
          // onSnapshot will update local state
        } else {
          setState(prevState => ({ ...prevState, purchases: restoredPurchases.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()), merchants: restoredMerchants.sort((a,b) => a.name.localeCompare(b.name)) }));
        }
        toast({ title: "Restauración Exitosa", description: `Datos restaurados desde Excel ${user ? 'a Firestore' : 'localmente'}.`});
      } catch (error: any) { toast({ title: "Error de Restauración", description: `No se pudo restaurar: ${error.message}`, variant: "destructive" }); }
    };
    reader.onerror = () => toast({ title: "Error de Lectura", description: "No se pudo leer el archivo.", variant: "destructive" });
    reader.readAsArrayBuffer(file);
  }, [toast, user]);

  const restoreFromDrive = useCallback(async (purchasesDataStr?: string, merchantsDataStr?: string, settingsDataStr?: string) => {
    // This function is primarily called after a server action completes the Drive restore.
    // The server action updates Firestore. onSnapshot handles updating local state for logged-in users.
    // For non-logged-in users, this path shouldn't be hit as Drive restore requires auth.
    if (user && purchasesDataStr && merchantsDataStr && settingsDataStr) {
      // console.log("[AppStore] restoreFromDrive: Data received. Firestore updated by server action, local state by onSnapshot.");
      // Potentially, could force a re-fetch or rely on onSnapshot.
    } else if (user) {
      // console.warn("[AppStore] restoreFromDrive: Called for authenticated user but data strings missing.");
    }
  }, [user]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={{
        addPurchase, editPurchase, deletePurchase, updateSettings, addMerchant,
        exportToCSV, isInitialized: isInitialized && !isFirestoreLoading, backupToExcel, restoreFromExcel,
        restoreFromDrive, updateLastBackupTimestamp
      }}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) throw new Error('useAppState must be used within an AppProvider');
  return context;
}

export function useAppDispatch() {
  const context = useContext(AppDispatchContext);
  if (context === undefined) throw new Error('useAppDispatch must be used within an AppProvider');
  return context;
}