
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
import { triggerGoogleDriveBackupAction } from '@/lib/actions'; 
import { useAuth } from '@/components/layout/Providers'; 
import { ensureFirebaseInitialized } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy } from "firebase/firestore";

interface AppDispatchContextType {
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> & { merchantLocation?: string }) => Promise<void>;
  editPurchase: (purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<void>;
  updateSettings: (newSettings: Partial<BenefitSettings>) => Promise<void>;
  addMerchant: (merchantName: string, merchantLocation?: string) => Promise<{ success: boolean; merchant?: Merchant; message?: string }>;
  exportToCSV: () => void;
  isInitialized: boolean;
  backupToExcel: () => void;
  restoreFromExcel: (file: File) => void;
  restoreFromDrive: (purchasesDataStr?: string, merchantsDataStr?: string, settingsDataStr?: string) => void; // Mantener opcional por ahora
  updateLastBackupTimestamp: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AppDispatchContextType | undefined>(undefined);

const INITIAL_SETUP_COMPLETE_KEY = `initialSetupComplete_${APP_NAME}`; // App-specific key

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user, accessToken, isFirebaseAuthReady } = useAuth(); 
  const { db } = ensureFirebaseInitialized(); // Obtener db aquí

  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: DEFAULT_BENEFIT_SETTINGS,
    merchants: [],
    lastEndOfMonthReminderShownForMonth: undefined,
  });
  const [isInitialized, setIsInitialized] = useState(false); // Indica si la carga inicial (localStorage o Firestore) ha terminado
  const [isFirestoreLoading, setIsFirestoreLoading] = useState(true); // Específico para la carga de Firestore

  const isMounted = useRef(false);
  const previousPurchasesRef = useRef<Purchase[]>();
  const previousMerchantsRef = useRef<Merchant[]>();


  // Carga inicial de datos desde Firestore y configuración del listener
  useEffect(() => {
    if (!isFirebaseAuthReady || !user || !user.uid || !db) {
      if (isFirebaseAuthReady && !user) { // Si Firebase Auth está listo pero no hay usuario, la carga de Firestore no es necesaria
        setIsFirestoreLoading(false);
        setIsInitialized(true); // Considerar inicializado sin datos de Firestore
        // Comprobar si es la configuración inicial
        if (typeof window !== 'undefined') {
            const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
            if (!setupComplete && pathname !== '/settings') {
                router.push('/settings');
            }
        }
      }
      return;
    }

    console.log(`[AppStore] User ${user.uid} detected. Initializing Firestore data load and listeners.`);
    setIsFirestoreLoading(true);

    const unsubscribers: (() => void)[] = [];

    // Cargar y escuchar Settings
    const settingsDocRef = doc(db, "users", user.uid, "settings", "main");
    unsubscribers.push(onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const firestoreSettings = docSnap.data() as BenefitSettings;
        setState(prevState => ({
          ...prevState,
          settings: { ...DEFAULT_BENEFIT_SETTINGS, ...firestoreSettings },
        }));
        if (typeof window !== 'undefined') {
            localStorage.setItem(INITIAL_SETUP_COMPLETE_KEY, 'true'); // Marcar como configurado si se cargan settings
        }
      } else {
        // No settings in Firestore, use defaults and potentially redirect to settings page.
        setState(prevState => ({ ...prevState, settings: DEFAULT_BENEFIT_SETTINGS }));
        if (typeof window !== 'undefined') {
            const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
            if (!setupComplete && pathname !== '/settings') {
                router.push('/settings');
            }
        }
      }
    }, (error) => {
      console.error("[AppStore] Error listening to settings:", error);
      toast({ title: "Error de Sincronización", description: "No se pudo cargar la configuración.", variant: "destructive" });
    }));

    // Cargar y escuchar Purchases
    const purchasesColRef = collection(db, "users", user.uid, "purchases");
    const purchasesQuery = query(purchasesColRef, orderBy("date", "desc"));
    unsubscribers.push(onSnapshot(purchasesQuery, (snapshot) => {
      const purchasesFromFirestore = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
      setState(prevState => ({ ...prevState, purchases: purchasesFromFirestore }));
      previousPurchasesRef.current = purchasesFromFirestore;
    }, (error) => {
      console.error("[AppStore] Error listening to purchases:", error);
      toast({ title: "Error de Sincronización", description: "No se pudieron cargar las compras.", variant: "destructive" });
    }));

    // Cargar y escuchar Merchants
    const merchantsColRef = collection(db, "users", user.uid, "merchants");
    const merchantsQuery = query(merchantsColRef, orderBy("name"));
    unsubscribers.push(onSnapshot(merchantsQuery, (snapshot) => {
      const merchantsFromFirestore = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Merchant));
      setState(prevState => ({ ...prevState, merchants: merchantsFromFirestore }));
      previousMerchantsRef.current = merchantsFromFirestore;
    }, (error) => {
      console.error("[AppStore] Error listening to merchants:", error);
      toast({ title: "Error de Sincronización", description: "No se pudieron cargar los comercios.", variant: "destructive" });
    }));
    
    Promise.all([
        getDoc(settingsDocRef), 
        getDocs(purchasesQuery), 
        getDocs(merchantsQuery)
    ]).then(() => {
        setIsFirestoreLoading(false);
        setIsInitialized(true);
        console.log("[AppStore] Initial data load from Firestore complete.");
    }).catch(error => {
        console.error("[AppStore] Error during initial batch data load from Firestore:", error);
        setIsFirestoreLoading(false);
        setIsInitialized(true); // Aún inicializado, pero con error.
        toast({ title: "Error de Carga Inicial", description: "No se pudieron cargar todos los datos iniciales.", variant: "destructive" });
    });


    return () => {
      console.log("[AppStore] Unsubscribing Firestore listeners for user:", user.uid);
      unsubscribers.forEach(unsub => unsub());
    };

  }, [user, isFirebaseAuthReady, db, router, pathname, toast]);


  const updateLastBackupTimestamp = useCallback(async () => {
    if (!user || !user.uid || !db) return;
    try {
      const settingsDocRef = doc(db, "users", user.uid, "settings", "main");
      await setDoc(settingsDocRef, { lastBackupTimestamp: Date.now() }, { merge: true });
      // El listener de onSnapshot actualizará el estado local.
    } catch (error) {
      console.error("[AppStore] Error updating lastBackupTimestamp in Firestore:", error);
      toast({ title: "Error", description: "No se pudo actualizar la fecha del último backup.", variant: "destructive" });
    }
  }, [user, db, toast]);

  const handleAutoBackup = useCallback(async () => {
    if (!state.settings.autoBackupToDrive || !user || !user.uid || !user.email || !accessToken || !db) {
      if (state.settings.autoBackupToDrive && isMounted.current) { 
         console.warn('[Auto Backup] Conditions for auto backup not met (user/token/db missing or feature disabled).');
      }
      return;
    }

    console.log('[Auto Backup] Triggering auto backup to Google Drive...');
    try {
      // Preparamos los datos directamente del estado actual, que ya está sincronizado (o debería estarlo) con Firestore
      const result = await triggerGoogleDriveBackupAction(
        user.uid,
        user.email,
        JSON.stringify(state.purchases), // Usa el estado actual
        JSON.stringify(state.merchants), // Usa el estado actual
        JSON.stringify(state.settings),  // Usa el estado actual
        accessToken
      );
      if (result.success) {
        // updateLastBackupTimestamp ya no es necesario aquí directamente, triggerGoogleDriveBackupAction lo hace.
        console.log('[Auto Backup] Auto backup to Drive successful. Timestamp updated via action.');
      } else {
        console.error('[Auto Backup] Auto backup to Drive failed:', result.message);
        toast({ title: "Error de Auto-Backup a Drive", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      console.error('[Auto Backup] Exception during auto backup to Drive:', error);
      toast({ title: "Error de Auto-Backup a Drive", description: error.message || "Ocurrió un error inesperado.", variant: "destructive" });
    }
  }, [state.settings, state.purchases, state.merchants, user, accessToken, db, toast]);


  // Efecto para Auto-Backup: Se dispara si cambian las compras o los comerciantes Y el auto-backup está activo.
  useEffect(() => {
    if (!isInitialized || !isMounted.current || !state.settings.autoBackupToDrive || !user || !db) {
      if (!isMounted.current && isInitialized) {
        isMounted.current = true; // Marcar como montado después de la carga inicial
      }
      return;
    }

    // Comparamos el estado actual con el snapshot anterior para ver si hubo cambios reales que justifiquen un backup.
    const purchasesChanged = JSON.stringify(state.purchases) !== JSON.stringify(previousPurchasesRef.current);
    const merchantsChanged = JSON.stringify(state.merchants) !== JSON.stringify(previousMerchantsRef.current);

    if (purchasesChanged || merchantsChanged) {
      console.log("[AppStore AutoBackup Effect] Data changed, triggering auto-backup if enabled.");
      handleAutoBackup();
    }
    
    // Actualizar refs para la próxima comparación
    previousPurchasesRef.current = state.purchases;
    previousMerchantsRef.current = state.merchants;

  }, [state.purchases, state.merchants, state.settings.autoBackupToDrive, isInitialized, user, db, handleAutoBackup]);


  // Effect for End of Month Reminder
  useEffect(() => {
    if (!isInitialized || !state.settings.enableEndOfMonthReminder || isFirestoreLoading) {
      return;
    }

    const now = new Date();
    const currentMonthYear = format(now, 'yyyy-MM');

    if (state.lastEndOfMonthReminderShownForMonth === currentMonthYear) {
      return; 
    }

    const daysInCurrentMonth = getDaysInMonth(now);
    const currentDayOfMonth = getDate(now);
    const daysRemainingInMonth = daysInCurrentMonth - currentDayOfMonth;

    if (daysRemainingInMonth >= 0 && daysRemainingInMonth <= state.settings.daysBeforeEndOfMonthToRemind) {
      const totalSpentThisMonth = state.purchases
        .filter(p => isSameMonth(parseISO(p.date), now))
        .reduce((sum, p) => sum + p.finalAmount, 0);
      
      const remainingBalance = Math.max(0, state.settings.monthlyAllowance - totalSpentThisMonth);

      if (remainingBalance > 0) {
        setTimeout(() => {
          toast({
            title: "Recordatorio de Beneficio",
            description: `¡Atención! Quedan ${daysRemainingInMonth} día(s) para que termine ${format(now, "MMMM", { locale: es })} y aún tienes ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(remainingBalance)} de beneficio disponible.`,
            variant: "default",
            duration: 10000, 
          });
        },0);
        
        setState(prevState => ({
          ...prevState,
          lastEndOfMonthReminderShownForMonth: currentMonthYear,
        }));
        // Persistir este cambio en settings en Firestore también
        if (user && user.uid && db) {
            const settingsDocRef = doc(db, "users", user.uid, "settings", "main");
            setDoc(settingsDocRef, { lastEndOfMonthReminderShownForMonth: currentMonthYear }, { merge: true }).catch(err => console.error("Failed to save lastEndOfMonthReminderShownForMonth to Firestore", err));
        }
      }
    }
  }, [isInitialized, state.settings, state.purchases, state.lastEndOfMonthReminderShownForMonth, toast, user, db, isFirestoreLoading]);


  const addPurchase = useCallback(async (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> & { merchantLocation?: string }) => {
    if (!user || !user.uid || !db) {
      toast({ title: "Error", description: "Debes iniciar sesión para registrar compras.", variant: "destructive" });
      return;
    }
    
    const discountAmount = (purchaseData.amount * state.settings.discountPercentage) / 100;
    const newPurchaseDocData: Omit<Purchase, 'id'> = { // Datos para Firestore, sin ID
      amount: purchaseData.amount,
      date: purchaseData.date,
      merchantName: purchaseData.merchantName.trim(),
      merchantLocation: purchaseData.merchantLocation?.trim() || undefined,
      description: purchaseData.description || undefined,
      receiptImageUrl: purchaseData.receiptImageUrl,
      discountApplied: parseFloat(discountAmount.toFixed(2)),
      finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
    };

    try {
      const purchasesColRef = collection(db, "users", user.uid, "purchases");
      const docRef = await addDoc(purchasesColRef, newPurchaseDocData);
      
      // El listener onSnapshot actualizará el estado local.
      // Mostrar toast de éxito
      // toast({ title: "Éxito", description: "Compra registrada." }); // Ya se muestra desde la acción del servidor o el componente

      // Lógica de añadir/actualizar comerciante (similar a antes, pero podría simplificarse si la acción del servidor ya lo hace)
      const merchantName = newPurchaseDocData.merchantName;
      const merchantLocation = newPurchaseDocData.merchantLocation;
      const merchantsCol = collection(db, "users", user.uid, "merchants");
      const q = query(merchantsCol, where("name", "==", merchantName), where("location", "==", merchantLocation || null)); // Firestore trata undefined como null en queries
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await addDoc(merchantsCol, { name: merchantName, location: merchantLocation || null });
        // toast({ title: "Nuevo Comercio", description: `"${merchantName}" añadido.` });
      }
      // La notificación de alerta de límite se gestiona en el componente AddPurchasePage
    } catch (error) {
      console.error("Error adding purchase to Firestore from store:", error);
      toast({ title: "Error", description: "No se pudo registrar la compra en la base de datos.", variant: "destructive" });
    }
  }, [user, db, state.settings.discountPercentage, toast]);

  const editPurchase = useCallback(async (purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => {
    if (!user || !user.uid || !db) {
      toast({ title: "Error", description: "Debes iniciar sesión para editar compras.", variant: "destructive" });
      return;
    }

    const discountAmount = (purchaseData.amount * state.settings.discountPercentage) / 100;
    const updatedPurchaseDocData: Omit<Purchase, 'id'> = {
      amount: purchaseData.amount,
      date: purchaseData.date,
      merchantName: purchaseData.merchantName.trim(),
      merchantLocation: purchaseData.merchantLocation?.trim() || undefined,
      description: purchaseData.description || undefined,
      receiptImageUrl: purchaseData.receiptImageUrl,
      discountApplied: parseFloat(discountAmount.toFixed(2)),
      finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
    };
    
    try {
      const purchaseDocRef = doc(db, "users", user.uid, "purchases", purchaseId);
      await setDoc(purchaseDocRef, updatedPurchaseDocData, { merge: true });
      // El listener onSnapshot actualizará el estado local.
      // toast({ title: "Éxito", description: "Compra actualizada." }); // Ya se muestra desde el componente

      // Lógica de añadir/actualizar comerciante
      const merchantName = updatedPurchaseDocData.merchantName;
      const merchantLocation = updatedPurchaseDocData.merchantLocation;
      const merchantsCol = collection(db, "users", user.uid, "merchants");
      const q = query(merchantsCol, where("name", "==", merchantName), where("location", "==", merchantLocation || null));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        await addDoc(merchantsCol, { name: merchantName, location: merchantLocation || null });
      }
    } catch (error) {
       console.error("Error updating purchase in Firestore from store:", error);
      toast({ title: "Error", description: "No se pudo actualizar la compra en la base de datos.", variant: "destructive" });
    }
  }, [user, db, state.settings.discountPercentage, toast]);

  const deletePurchase = useCallback(async (purchaseId: string) => {
    if (!user || !user.uid || !db) {
      toast({ title: "Error", description: "Debes iniciar sesión para eliminar compras.", variant: "destructive" });
      return;
    }
    console.log(`[AppStore] deletePurchase called for ID: ${purchaseId}, UserID: ${user.uid}`);
    try {
      const purchaseDocRef = doc(db, "users", user.uid, "purchases", purchaseId);
      await deleteDoc(purchaseDocRef);
      // El listener onSnapshot actualizará el estado local.
      // El toast de éxito lo maneja el componente TransactionHistoryTable.
      console.log(`[AppStore] Purchase with ID: ${purchaseId} request sent to Firestore for deletion.`);
    } catch (error) {
      console.error(`[AppStore] Error deleting purchase ${purchaseId} from Firestore:`, error);
      toast({ title: "Error", description: "No se pudo eliminar la compra de la base de datos.", variant: "destructive" });
    }
  }, [user, db, toast]);


  const updateSettings = useCallback(async (newSettingsData: Partial<BenefitSettings>) => {
    if (!user || !user.uid || !db) {
      toast({ title: "Error", description: "Debes iniciar sesión para actualizar la configuración.", variant: "destructive" });
      return;
    }
    
    const settingsToSave = {
        ...state.settings, // Coge la configuración actual del estado (que debería estar actualizada por onSnapshot)
        ...newSettingsData // Sobrescribe con los nuevos datos
    };

    try {
        const settingsDocRef = doc(db, "users", user.uid, "settings", "main");
        await setDoc(settingsDocRef, settingsToSave);
        // El listener onSnapshot actualizará el estado local.
        // El toast de éxito lo maneja el SettingsForm.
    } catch (error) {
        console.error("[AppStore] Error updating settings in Firestore:", error);
        toast({ title: "Error", description: "No se pudo guardar la configuración en la base de datos.", variant: "destructive" });
    }
  }, [user, db, state.settings, toast]);

  const addMerchant = useCallback(async (merchantName: string, merchantLocationInput?: string): Promise<{ success: boolean; merchant?: Merchant; message?: string }> => {
    if (!user || !user.uid || !db) {
      toast({ title: "Error", description: "Debes iniciar sesión para añadir comercios.", variant: "destructive" });
      return { success: false, message: "Usuario no autenticado." };
    }

    const trimmedName = merchantName.trim();
    const trimmedLocation = merchantLocationInput?.trim() || null; // Usar null para Firestore si está vacío o es undefined

    const merchantData = {
        name: trimmedName,
        location: trimmedLocation,
    };
    
    try {
        const merchantsCol = collection(db, "users", user.uid, "merchants");
        // Verificar si ya existe
        const q = query(merchantsCol, where("name", "==", trimmedName), where("location", "==", trimmedLocation));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const existingDoc = querySnapshot.docs[0];
            return { 
                success: false, 
                merchant: { id: existingDoc.id, ...existingDoc.data() } as Merchant,
                message: `El comercio "${trimmedName}" ${trimmedLocation ? `en "${trimmedLocation}"` : ''} ya existe.`
            };
        }
        
        // Si no existe, añadirlo
        const docRef = await addDoc(merchantsCol, merchantData);
        // El listener onSnapshot actualizará el estado local.
        return { 
            success: true, 
            merchant: { id: docRef.id, ...merchantData } as Merchant, // Construir el objeto merchant con el ID
            message: `Comercio "${trimmedName}" añadido.`
        };
    } catch (error) {
        console.error("Error adding merchant to Firestore from store:", error);
        toast({ title: "Error", description: "No se pudo añadir el comercio a la base de datos.", variant: "destructive" });
        return { success: false, message: "Error al contactar la base de datos." };
    }
  }, [user, db, toast]);

  const exportToCSV = useCallback(() => {
    if (state.purchases.length === 0) {
      setTimeout(() => {
        toast({ title: "Sin Datos", description: "No hay transacciones para exportar.", variant: "default"});
      },0);
      return;
    }
    const headers = ["ID", "Monto Original", "Fecha", "Comercio", "Ubicación Compra", "Descripción", "Descuento Aplicado", "Monto Final", "URL Recibo"];
    const csvRows = [
      headers.join(','),
      ...state.purchases.map(p => [
        p.id,
        p.amount,
        format(parseISO(p.date), 'yyyy-MM-dd HH:mm:ss'),
        `"${p.merchantName.replace(/"/g, '""')}"`,
        `"${p.merchantLocation ? p.merchantLocation.replace(/"/g, '""') : ''}"`,
        `"${p.description ? p.description.replace(/"/g, '""') : ''}"`,
        p.discountApplied,
        p.finalAmount,
        p.receiptImageUrl || ''
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ledesc_transacciones_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        toast({ title: "Exportación Exitosa", description: "Los datos se han exportado a CSV."});
      },0);
    } else {
      setTimeout(() => {
        toast({ title: "Error de Exportación", description: "Tu navegador no soporta la descarga directa.", variant: "destructive"});
      },0);
    }
  }, [state.purchases, toast]);

  const backupToExcel = useCallback(async () => {
    if (!user || !user.uid || !db) {
        toast({ title: "Error", description: "Debes iniciar sesión para realizar un backup.", variant: "destructive" });
        return;
    }
    try {
      const purchasesForExcel = state.purchases.map(p => ({ // Usa el estado local que es reflejo de Firestore
        ID: p.id,
        'Monto Original': p.amount,
        Fecha: format(parseISO(p.date), 'yyyy-MM-dd HH:mm:ss'),
        Comercio: p.merchantName,
        'Ubicación Compra': p.merchantLocation || '',
        Descripción: p.description || '',
        'URL Recibo': p.receiptImageUrl || '',
        'Descuento Aplicado': p.discountApplied,
        'Monto Final': p.finalAmount,
      }));

      const merchantsForExcel = state.merchants.map(m => ({
        ID: m.id,
        Nombre: m.name,
        Ubicación: m.location || '',
      }));

      const wb = XLSX.utils.book_new();
      const wsPurchases = XLSX.utils.json_to_sheet(purchasesForExcel);
      const wsMerchants = XLSX.utils.json_to_sheet(merchantsForExcel);

      XLSX.utils.book_append_sheet(wb, wsPurchases, "Compras");
      XLSX.utils.book_append_sheet(wb, wsMerchants, "Comercios");

      XLSX.writeFile(wb, `LEDESC_Backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
      
      await updateLastBackupTimestamp(); // Llama a la función que actualiza en Firestore
      
      setTimeout(() => {
        toast({ title: "Backup Exitoso", description: "Los datos se han exportado a un archivo Excel." });
      }, 0);

    } catch (error) {
      console.error("Error al generar backup Excel:", error);
      setTimeout(() => {
        toast({ title: "Error de Backup", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
      }, 0);
    }
  }, [state.purchases, state.merchants, toast, updateLastBackupTimestamp, user, db]);

  const restoreFromExcel = useCallback(async (file: File) => {
    if (!user || !user.uid || !db) {
        toast({ title: "Error", description: "Debes iniciar sesión para restaurar datos.", variant: "destructive" });
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("No se pudieron leer los datos del archivo.");
        }
        const wb = XLSX.read(data, { type: 'array', cellDates: true });

        if (!wb.SheetNames.includes("Compras") || !wb.SheetNames.includes("Comercios")) {
          throw new Error("El archivo Excel no contiene las hojas 'Compras' y 'Comercios' requeridas.");
        }

        const wsPurchases = wb.Sheets["Compras"];
        const wsMerchants = wb.Sheets["Comercios"];

        const purchasesFromExcel: any[] = XLSX.utils.sheet_to_json(wsPurchases);
        const merchantsFromExcel: any[] = XLSX.utils.sheet_to_json(wsMerchants);

        const restoredPurchases: Purchase[] = purchasesFromExcel.map((p: any, index: number) => {
          let purchaseDate = new Date().toISOString(); 
          if (p.Fecha) {
            const parsedDate = p.Fecha instanceof Date ? p.Fecha : parseISO(String(p.Fecha));
            if (isValid(parsedDate)) {
              purchaseDate = parsedDate.toISOString();
            } else {
               console.warn(`Fila ${index+2} (Compras): Fecha inválida "${p.Fecha}", se usará fecha actual.`);
            }
          } else {
            console.warn(`Fila ${index+2} (Compras): Fecha no encontrada, se usará fecha actual.`);
          }
          
          return {
            id: String(p.ID || `excel_restored_purchase_${Date.now()}_${index}`),
            amount: typeof p['Monto Original'] === 'number' ? p['Monto Original'] : 0,
            date: purchaseDate,
            merchantName: String(p.Comercio || 'Desconocido'),
            merchantLocation: String(p['Ubicación Compra'] || '') || undefined,
            description: String(p.Descripción || ''),
            receiptImageUrl: String(p['URL Recibo'] || ''),
            discountApplied: typeof p['Descuento Aplicado'] === 'number' ? p['Descuento Aplicado'] : 0,
            finalAmount: typeof p['Monto Final'] === 'number' ? p['Monto Final'] : 0,
          };
        });

        const restoredMerchants: Merchant[] = merchantsFromExcel.map((m: any, index: number) => ({
          id: String(m.ID || `excel_restored_merchant_${Date.now()}_${index}`),
          name: String(m.Nombre || 'Desconocido'),
          location: String(m.Ubicación || '') || undefined,
        }));
        
        if (!Array.isArray(restoredPurchases) || !Array.isArray(restoredMerchants)) {
            throw new Error("Los datos leídos del Excel no tienen el formato esperado (no son arrays).");
        }
        
        // Escribir en batch a Firestore
        const batch = writeBatch(db);

        // Limpiar colecciones existentes
        const currentPurchasesRef = collection(db, "users", user.uid, "purchases");
        const currentPurchasesSnap = await getDocs(currentPurchasesRef);
        currentPurchasesSnap.forEach(doc => batch.delete(doc.ref));

        const currentMerchantsRef = collection(db, "users", user.uid, "merchants");
        const currentMerchantsSnap = await getDocs(currentMerchantsRef);
        currentMerchantsSnap.forEach(doc => batch.delete(doc.ref));
        
        // Añadir nuevos datos
        restoredPurchases.forEach(p => {
            const {id, ...purchaseData} = p;
            batch.set(doc(currentPurchasesRef, id), purchaseData);
        });
        restoredMerchants.forEach(m => {
            const {id, ...merchantData} = m;
            batch.set(doc(currentMerchantsRef, id), merchantData);
        });
        
        await batch.commit();
        // Los listeners onSnapshot actualizarán el estado local.

        setTimeout(() => {
          toast({ title: "Restauración Exitosa", description: "Los datos se han restaurado desde Excel a Firestore." });
        }, 0);

      } catch (error: any) {
        console.error("Error al restaurar desde Excel:", error);
        setTimeout(() => {
          toast({ title: "Error de Restauración", description: `No se pudo restaurar desde el archivo: ${error.message}`, variant: "destructive" });
        }, 0);
      }
    };
    reader.onerror = (error) => {
        console.error("Error al leer el archivo:", error);
        setTimeout(() => {
          toast({ title: "Error de Lectura", description: "No se pudo leer el archivo seleccionado.", variant: "destructive" });
        }, 0);
    };
    reader.readAsArrayBuffer(file);
  }, [toast, user, db]);

  const restoreFromDrive = useCallback(async (purchasesDataStr?: string, merchantsDataStr?: string, settingsDataStr?: string) => {
    // Esta función ahora es llamada por la server action triggerGoogleDriveRestoreAction,
    // la cual ya escribe los datos en Firestore. Este lado del cliente ya no necesita
    // parsear y escribir, solo debe confiar en que onSnapshot actualizará el estado.
    // El propósito principal de esta función en el cliente sería mostrar un toast de éxito/error
    // basado en el resultado de la server action.
    // Sin embargo, la server action ya maneja la escritura y revalidación.
    // Por lo tanto, esta función en el AppDispatchContext podría simplificarse o eliminarse si
    // la acción del servidor es la única responsable de la restauración de Drive.

    // Si la acción del servidor (triggerGoogleDriveRestoreAction) ya actualiza Firestore,
    // y tenemos listeners (onSnapshot) en AppProvider, el estado se actualizará automáticamente.
    // No necesitamos parsear y setState aquí.

    // La lógica de parseo y escritura a Firestore ahora reside en triggerGoogleDriveRestoreAction.
    // Aquí solo confiamos en que el estado se actualice via onSnapshot.
    
    if (purchasesDataStr && merchantsDataStr && settingsDataStr) {
        // Este log es solo para confirmar que la data llegó al cliente, aunque no la usemos directamente para setState.
        console.log("[AppStore] restoreFromDrive: Data received, Firestore update handled by server action and onSnapshot.");
        // El toast de éxito ya se muestra en SettingsForm basado en el resultado de la acción del servidor.
    } else {
        console.warn("[AppStore] restoreFromDrive: No data received. This might be normal if server action handles all.");
    }
    
  }, []);


  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={{ addPurchase, editPurchase, deletePurchase, updateSettings, addMerchant, exportToCSV, isInitialized: isInitialized && !isFirestoreLoading, backupToExcel, restoreFromExcel, restoreFromDrive, updateLastBackupTimestamp }}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}

export function useAppDispatch() {
  const context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error('useAppDispatch must be used within an AppProvider');
  }
  return context;
}
