
// This file simulates a client-side store. In a real app, this would be replaced by a backend.
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Purchase, BenefitSettings, AppState, Merchant } from '@/types';
import { DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, getDaysInMonth, getDate, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter, usePathname } from 'next/navigation';
import * as XLSX from 'xlsx';
import { triggerGoogleDriveBackupAction } from '@/lib/actions'; 
import { useAuth } from '@/components/layout/Providers'; 
import type { PurchaseFormData } from './schemas'; // Import PurchaseFormData

interface AppDispatchContextType {
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> & { merchantLocation?: string }) => void;
  editPurchase: (purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => void;
  deletePurchase: (purchaseId: string) => void;
  updateSettings: (newSettings: Partial<BenefitSettings>) => void;
  addMerchant: (merchantName: string, merchantLocation?: string) => { success: boolean; merchant?: Merchant; message?: string };
  exportToCSV: () => void;
  isInitialized: boolean;
  backupToExcel: () => void;
  restoreFromExcel: (file: File) => void;
  restoreFromDrive: (purchasesData: string, merchantsData: string, settingsData: string) => void;
  updateLastBackupTimestamp: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AppDispatchContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ledescAppState';
const INITIAL_SETUP_COMPLETE_KEY = 'initialSetupComplete';

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user, accessToken } = useAuth(); 

  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: DEFAULT_BENEFIT_SETTINGS,
    merchants: [],
    lastEndOfMonthReminderShownForMonth: undefined,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const isMounted = useRef(false);
  const previousPurchasesRef = useRef<Purchase[]>();
  const previousMerchantsRef = useRef<Merchant[]>();


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedState) {
        try {
          const parsedState = JSON.parse(storedState) as AppState;
          const currentSettings = { 
            ...DEFAULT_BENEFIT_SETTINGS, 
            ...parsedState.settings,
            autoBackupToDrive: parsedState.settings.autoBackupToDrive === undefined ? DEFAULT_BENEFIT_SETTINGS.autoBackupToDrive : parsedState.settings.autoBackupToDrive,
            lastBackupTimestamp: parsedState.settings.lastBackupTimestamp || DEFAULT_BENEFIT_SETTINGS.lastBackupTimestamp,
            enableEndOfMonthReminder: parsedState.settings.enableEndOfMonthReminder === undefined ? DEFAULT_BENEFIT_SETTINGS.enableEndOfMonthReminder : parsedState.settings.enableEndOfMonthReminder,
            daysBeforeEndOfMonthToRemind: parsedState.settings.daysBeforeEndOfMonthToRemind === undefined ? DEFAULT_BENEFIT_SETTINGS.daysBeforeEndOfMonthToRemind : parsedState.settings.daysBeforeEndOfMonthToRemind,
          };
          
          parsedState.purchases = parsedState.purchases.map((p: Purchase) => ({
            ...p,
            date: p.date,
          }));
          parsedState.merchants = parsedState.merchants || [];
          parsedState.merchants = parsedState.merchants.map((m: Merchant) => ({
            id: m.id,
            name: m.name,
            location: m.location,
          }));
          setState({ 
            ...parsedState, 
            settings: currentSettings,
            lastEndOfMonthReminderShownForMonth: parsedState.lastEndOfMonthReminderShownForMonth 
          });
          previousPurchasesRef.current = parsedState.purchases; 
          previousMerchantsRef.current = parsedState.merchants;
        } catch (error) {
          console.error("Failed to parse state from localStorage", error);
          setState(prevState => ({
            ...prevState, 
            settings: { ...DEFAULT_BENEFIT_SETTINGS, ...prevState.settings },
            lastEndOfMonthReminderShownForMonth: undefined,
          }));
          previousPurchasesRef.current = []; 
          previousMerchantsRef.current = [];
        }
      } else {
        setState(prevState => ({
          ...prevState, 
          settings: DEFAULT_BENEFIT_SETTINGS,
          lastEndOfMonthReminderShownForMonth: undefined,
        }));
        previousPurchasesRef.current = [];
        previousMerchantsRef.current = [];
      }
    }
    setIsInitialized(true);
  }, []); 

  const updateLastBackupTimestamp = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      settings: {
        ...prevState.settings,
        lastBackupTimestamp: Date.now(),
      }
    }));
  }, []);

  const handleAutoBackup = useCallback(async () => {
    if (!state.settings.autoBackupToDrive || !user || !user.uid || !user.email || !accessToken) {
      if (state.settings.autoBackupToDrive && isMounted.current) { 
         console.warn('[Auto Backup] Conditions for auto backup not met (user/token missing or feature disabled).');
      }
      return;
    }

    console.log('[Auto Backup] Triggering auto backup to Google Drive...');
    try {
      const result = await triggerGoogleDriveBackupAction(
        user.uid,
        user.email,
        JSON.stringify(state.purchases),
        JSON.stringify(state.merchants),
        JSON.stringify(state.settings),
        accessToken
      );
      if (result.success) {
        updateLastBackupTimestamp();
        console.log('[Auto Backup] Auto backup to Drive successful.');
      } else {
        console.error('[Auto Backup] Auto backup to Drive failed:', result.message);
        toast({ title: "Error de Auto-Backup a Drive", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      console.error('[Auto Backup] Exception during auto backup to Drive:', error);
      toast({ title: "Error de Auto-Backup a Drive", description: error.message || "Ocurrió un error inesperado.", variant: "destructive" });
    }
  }, [state.settings, state.purchases, state.merchants, user, accessToken, toast, updateLastBackupTimestamp]);


  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
        if (!setupComplete && pathname !== '/settings') {
            if (typeof window !== 'undefined') router.push('/settings');
        }

        if (isMounted.current) { 
            const purchasesActuallyChanged = JSON.stringify(state.purchases) !== JSON.stringify(previousPurchasesRef.current);
            const merchantsActuallyChanged = JSON.stringify(state.merchants) !== JSON.stringify(previousMerchantsRef.current);

            if (state.settings.autoBackupToDrive && (purchasesActuallyChanged || merchantsActuallyChanged)) {
                if (user && user.uid && user.email && accessToken) {
                    console.log('[Auto Backup] Detected data change, attempting auto backup to Drive...');
                    handleAutoBackup();
                } else if (state.settings.autoBackupToDrive) {
                    console.warn('[Auto Backup] Auto backup enabled but user not authenticated or token missing.');
                }
            }
        } else {
             if (typeof window !== 'undefined' && !localStorage.getItem(LOCAL_STORAGE_KEY)) { 
                previousPurchasesRef.current = [];
                previousMerchantsRef.current = [];
            }
            isMounted.current = true;
        }
        previousPurchasesRef.current = state.purchases;
        previousMerchantsRef.current = state.merchants;
    }
  }, [state, isInitialized, router, pathname, user, accessToken, handleAutoBackup]);

  // Effect for End of Month Reminder
  useEffect(() => {
    if (!isInitialized || !state.settings.enableEndOfMonthReminder) {
      return;
    }

    const now = new Date();
    const currentMonthYear = format(now, 'yyyy-MM');

    if (state.lastEndOfMonthReminderShownForMonth === currentMonthYear) {
      return; // Reminder already shown for this month
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
            duration: 10000, // Longer duration for important reminder
          });
        },0);
        
        setState(prevState => ({
          ...prevState,
          lastEndOfMonthReminderShownForMonth: currentMonthYear,
        }));
      }
    }
  }, [isInitialized, state.settings, state.purchases, state.lastEndOfMonthReminderShownForMonth, toast]);


  const addMerchantInternal = useCallback((merchantName: string, merchantLocationParam: string | undefined, currentState: AppState): {
    updatedMerchants: Merchant[],
    newMerchant?: Merchant,
    alreadyExists: boolean,
    updatedExistingMerchant?: Merchant
  } => {
    const trimmedName = merchantName.trim();
    const normalizedNameKey = trimmedName.toLowerCase();
    const normalizedLocationKey = (merchantLocationParam || '').trim().toLowerCase() || undefined;

    const existingMerchantIndex = currentState.merchants.findIndex(
        (m) => m.name.toLowerCase() === normalizedNameKey &&
               ((m.location || '').toLowerCase() || undefined) === normalizedLocationKey
    );

    if (existingMerchantIndex > -1) {
      return { updatedMerchants: currentState.merchants, alreadyExists: true };
    }
    
    if (normalizedLocationKey) {
      const sameNameNoLocationMerchantIndex = currentState.merchants.findIndex(
        m => m.name.toLowerCase() === normalizedNameKey && !((m.location || '').trim())
      );

      if (sameNameNoLocationMerchantIndex > -1) {
        const updatedMerchants = [...currentState.merchants];
        const merchantToUpdate = { ...updatedMerchants[sameNameNoLocationMerchantIndex], location: merchantLocationParam?.trim() };
        updatedMerchants[sameNameNoLocationMerchantIndex] = merchantToUpdate;
        return { 
          updatedMerchants: updatedMerchants.sort((a,b) => a.name.localeCompare(b.name) || (a.location || '').localeCompare(b.location || '')), 
          updatedExistingMerchant: merchantToUpdate, 
          alreadyExists: false 
        };
      }
    }

    const newMerchant: Merchant = {
      id: new Date().toISOString() + Math.random().toString(),
      name: trimmedName,
      location: merchantLocationParam?.trim() || undefined,
    };
    return {
      updatedMerchants: [...currentState.merchants, newMerchant].sort((a, b) => a.name.localeCompare(b.name) || (a.location || '').localeCompare(b.location || '')),
      newMerchant,
      alreadyExists: false
    };
  }, []);


  const addPurchase = useCallback((purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> & { merchantLocation?: string }) => {
    setState(prevState => {
      const discountAmount = (purchaseData.amount * prevState.settings.discountPercentage) / 100;
      const newPurchase: Purchase = {
        amount: purchaseData.amount,
        date: purchaseData.date,
        merchantName: purchaseData.merchantName,
        merchantLocation: purchaseData.merchantLocation,
        description: purchaseData.description || undefined,
        receiptImageUrl: purchaseData.receiptImageUrl,
        id: new Date().toISOString() + Math.random().toString(),
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
      };
      const updatedPurchases = [newPurchase, ...prevState.purchases].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());


      const {
        updatedMerchants: merchantsAfterPurchase,
        newMerchant: addedMerchantFromPurchase,
        updatedExistingMerchant
      } = addMerchantInternal(newPurchase.merchantName, purchaseData.merchantLocation, prevState);
      
      setTimeout(() => {
        if (addedMerchantFromPurchase) {
            toast({ title: "Nuevo Comercio Registrado", description: `El comercio "${addedMerchantFromPurchase.name}" ${addedMerchantFromPurchase.location ? `en "${addedMerchantFromPurchase.location}"` : ''} ha sido añadido a la lista de comercios.`});
        } else if (updatedExistingMerchant) {
            toast({ title: "Comercio Actualizado", description: `Se actualizó la ubicación de "${updatedExistingMerchant.name}" a "${updatedExistingMerchant.location}".`});
        }
      },0);

      const currentMonth = format(parseISO(newPurchase.date), 'yyyy-MM');
      const spentThisMonth = updatedPurchases
        .filter(p => format(parseISO(p.date), 'yyyy-MM') === currentMonth)
        .reduce((sum, p) => sum + p.finalAmount, 0);

      const usagePercentage = (prevState.settings.monthlyAllowance > 0) ? (spentThisMonth / prevState.settings.monthlyAllowance) * 100 : 0;

      if (prevState.settings.monthlyAllowance > 0 && usagePercentage >= prevState.settings.alertThresholdPercentage) {
         setTimeout(() => {
          toast({
            title: "Alerta de Límite de Beneficio",
            description: `Has utilizado ${usagePercentage.toFixed(0)}% de tu beneficio mensual.`,
            variant: "destructive",
          });
        }, 0);
      }

      return { ...prevState, purchases: updatedPurchases, merchants: merchantsAfterPurchase };
    });
  }, [toast, addMerchantInternal]);

  const editPurchase = useCallback((purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => {
    setState(prevState => {
      const purchaseIndex = prevState.purchases.findIndex(p => p.id === purchaseId);
      if (purchaseIndex === -1) {
        setTimeout(() => toast({ title: "Error", description: "No se encontró la compra para editar.", variant: "destructive" }), 0);
        return prevState;
      }

      const discountAmount = (purchaseData.amount * prevState.settings.discountPercentage) / 100;
      const updatedPurchase: Purchase = {
        ...prevState.purchases[purchaseIndex],
        ...purchaseData,
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
      };

      const updatedPurchases = [...prevState.purchases];
      updatedPurchases[purchaseIndex] = updatedPurchase;
      updatedPurchases.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

      const {
        updatedMerchants: merchantsAfterEdit,
        newMerchant: addedMerchantFromEdit,
        updatedExistingMerchant
      } = addMerchantInternal(updatedPurchase.merchantName, updatedPurchase.merchantLocation, prevState);

      setTimeout(() => {
        if (addedMerchantFromEdit) {
            toast({ title: "Nuevo Comercio Registrado", description: `El comercio "${addedMerchantFromEdit.name}" ${addedMerchantFromEdit.location ? `en "${addedMerchantFromEdit.location}"` : ''} ha sido añadido por la edición.`});
        } else if (updatedExistingMerchant) {
             toast({ title: "Comercio Actualizado", description: `Se actualizó la ubicación de "${updatedExistingMerchant.name}" a "${updatedExistingMerchant.location}" por la edición.`});
        }
      },0);
      
      return { ...prevState, purchases: updatedPurchases, merchants: merchantsAfterEdit };
    });
  }, [toast, addMerchantInternal]);

  const deletePurchase = useCallback((purchaseId: string) => {
    console.log(`[AppStore] deletePurchase called for ID: ${purchaseId}`);
    setState(prevState => {
      const initialPurchases = prevState.purchases;
      const updatedPurchases = initialPurchases.filter(p => p.id !== purchaseId);

      if (initialPurchases.length === updatedPurchases.length) {
        // Esto significa que la compra no se encontró o el ID no coincidió.
        // Podría ser un indicio de un problema si se esperaba que la compra existiera.
        console.warn(`[AppStore] Purchase with ID: ${purchaseId} not found in state, or filter did not remove it. No state change.`);
        return prevState; // Devuelve el estado anterior para evitar re-renders innecesarios.
      }
      
      console.log(`[AppStore] Purchase with ID: ${purchaseId} removed from state. Old count: ${initialPurchases.length}, New count: ${updatedPurchases.length}`);
      return { ...prevState, purchases: updatedPurchases };
    });
  }, []);


  const updateSettings = useCallback((newSettingsData: Partial<BenefitSettings>) => {
    setState(prevState => ({ 
      ...prevState, 
      settings: {
        ...prevState.settings,
        ...newSettingsData 
      } 
    }));
  }, []);

  const addMerchant = useCallback((merchantName: string, merchantLocation?: string): { success: boolean; merchant?: Merchant; message?: string } => {
    let result: { success: boolean; merchant?: Merchant; message?: string } = { success: false };
    setState(prevState => {
      const { updatedMerchants, newMerchant, alreadyExists, updatedExistingMerchant } = addMerchantInternal(merchantName, merchantLocation, prevState);

      if (newMerchant) {
        result = { success: true, merchant: newMerchant, message: `Comercio "${newMerchant.name}" ${newMerchant.location ? `en "${newMerchant.location}"` : ''} añadido exitosamente.` };
         return { ...prevState, merchants: updatedMerchants };
      } else if (updatedExistingMerchant) {
        result = { success: true, merchant: updatedExistingMerchant, message: `Se actualizó la ubicación del comercio "${updatedExistingMerchant.name}" a "${updatedExistingMerchant.location}".` };
        return { ...prevState, merchants: updatedMerchants };
      } else if (alreadyExists) {
        const locationMsg = (merchantLocation || '').trim() ? `en "${(merchantLocation || '').trim()}"` : '';
        result = { success: false, message: `El comercio "${merchantName.trim()}" ${locationMsg} ya existe.` };
        return prevState;
      }
      result = { success: false, message: 'No se pudo procesar la solicitud del comercio.'}
      return prevState;
    });
    return result;
  }, [addMerchantInternal]);

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

  const backupToExcel = useCallback(() => {
    try {
      const purchasesForExcel = state.purchases.map(p => ({
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
      
      updateLastBackupTimestamp();
      
      setTimeout(() => {
        toast({ title: "Backup Exitoso", description: "Los datos se han exportado a un archivo Excel." });
      }, 0);

    } catch (error) {
      console.error("Error al generar backup Excel:", error);
      setTimeout(() => {
        toast({ title: "Error de Backup", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
      }, 0);
    }
  }, [state.purchases, state.merchants, toast, updateLastBackupTimestamp]);

  const restoreFromExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
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
            id: String(p.ID || `restored_purchase_${Date.now()}_${index}`),
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
          id: String(m.ID || `restored_merchant_${Date.now()}_${index}`),
          name: String(m.Nombre || 'Desconocido'),
          location: String(m.Ubicación || '') || undefined,
        }));
        
        if (!Array.isArray(restoredPurchases) || !Array.isArray(restoredMerchants)) {
            throw new Error("Los datos leídos del Excel no tienen el formato esperado (no son arrays).");
        }

        setState(prevState => ({
          ...prevState,
          purchases: restoredPurchases.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
          merchants: restoredMerchants.sort((a,b) => a.name.localeCompare(b.name) || (a.location || '').localeCompare(b.location || '')),
        }));

        setTimeout(() => {
          toast({ title: "Restauración Exitosa", description: "Los datos se han restaurado desde el archivo Excel. Los datos anteriores han sido reemplazados." });
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
  }, [toast]);

  const restoreFromDrive = useCallback((purchasesDataStr?: string, merchantsDataStr?: string, settingsDataStr?: string) => {
    try {
      const restoredPurchasesRaw: Purchase[] = purchasesDataStr ? JSON.parse(purchasesDataStr) : [];
      const restoredMerchantsRaw: Merchant[] = merchantsDataStr ? JSON.parse(merchantsDataStr) : [];
      const restoredSettingsPartial: Partial<BenefitSettings> = settingsDataStr ? JSON.parse(settingsDataStr) : {};
      
      // Asegurar ordenamiento después de restaurar
      const restoredPurchases = restoredPurchasesRaw.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
      const restoredMerchants = restoredMerchantsRaw.sort((a,b) => a.name.localeCompare(b.name) || (a.location || '').localeCompare(b.location || ''));


      setState(prevState => ({
        ...prevState,
        purchases: restoredPurchases,
        merchants: restoredMerchants,
        settings: {
          ...DEFAULT_BENEFIT_SETTINGS, 
          ...prevState.settings,     
          ...restoredSettingsPartial, 
          autoBackupToDrive: restoredSettingsPartial.autoBackupToDrive === undefined ? prevState.settings.autoBackupToDrive : restoredSettingsPartial.autoBackupToDrive,
          lastBackupTimestamp: prevState.settings.lastBackupTimestamp, 
          enableEndOfMonthReminder: restoredSettingsPartial.enableEndOfMonthReminder === undefined ? prevState.settings.enableEndOfMonthReminder : restoredSettingsPartial.enableEndOfMonthReminder,
          daysBeforeEndOfMonthToRemind: restoredSettingsPartial.daysBeforeEndOfMonthToRemind === undefined ? prevState.settings.daysBeforeEndOfMonthToRemind : restoredSettingsPartial.daysBeforeEndOfMonthToRemind,
        },
      }));
      
      setTimeout(() => {
        toast({ title: "Restauración Exitosa", description: "Los datos se han restaurado desde Google Drive. Los datos anteriores han sido reemplazados." });
      }, 0);

    } catch (error: any) {
      console.error("Error al procesar datos restaurados de Drive:", error);
      setTimeout(() => {
        toast({ title: "Error de Restauración", description: `No se pudieron procesar los datos de Google Drive: ${error.message}`, variant: "destructive" });
      }, 0);
    }
  }, [toast]);


  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={{ addPurchase, editPurchase, deletePurchase, updateSettings, addMerchant, exportToCSV, isInitialized, backupToExcel, restoreFromExcel, restoreFromDrive, updateLastBackupTimestamp }}>
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

