
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
import { useAuth } from '@/components/layout/Providers';
import { getDriveData, saveDriveData } from '@/lib/actions';

interface AppDispatchContextType {
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'> & { amount: number; date: string; merchantName: string; description?: string; }) => void;
  editPurchase: (purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'> & { amount: number; date: string; merchantName: string; description?: string; }) => void;
  deletePurchase: (purchaseId: string) => void;
  updateSettings: (newSettings: Partial<BenefitSettings>) => void;
  addMerchant: (merchantName: string, merchantLocation?: string) => void;
  exportToCSV: () => void;
  isInitialized: boolean;
  backupToExcel: () => void;
  restoreFromExcel: (file: File) => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AppDispatchContextType | undefined>(undefined);

const LOCAL_STORAGE_STATE_KEY = `${APP_NAME}_state_v3`;
const INITIAL_SETUP_COMPLETE_KEY = `initialSetupComplete_${APP_NAME}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  const { user, accessToken, isFirebaseAuthReady } = useAuth();
  
  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: { ...DEFAULT_BENEFIT_SETTINGS, lastEndOfMonthReminderShownForMonth: undefined, lastLocalSaveTimestamp: 0 },
    merchants: [],
  });
  
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(false);

  // Load data: From Drive if logged in, otherwise from localStorage
  useEffect(() => {
    const loadData = async () => {
      if (!isFirebaseAuthReady) return;

      if (user && accessToken) {
        setIsSyncing(true);
        toast({ title: 'Sincronizando...', description: 'Cargando datos desde Google Drive.' });
        const { data, fileId, error } = await getDriveData(accessToken);
        setIsSyncing(false);
        if (error) {
          toast({ title: 'Error de Sincronización', description: `No se pudieron cargar los datos de Drive: ${error}. Usando datos locales.`, variant: 'destructive', duration: 10000 });
          // Fallback to local storage if drive fails
          const localState = localStorage.getItem(LOCAL_STORAGE_STATE_KEY);
          if (localState) setState(JSON.parse(localState));
        } else if (data && fileId) {
          setState(data);
          setDriveFileId(fileId);
          dismiss();
          toast({ title: 'Sincronización Completa', description: 'Datos cargados desde Google Drive.', duration: 3000});
        } else {
            // New user on Drive, load local data to upload it.
            const localState = localStorage.getItem(LOCAL_STORAGE_STATE_KEY);
            if (localState) setState(JSON.parse(localState));
            toast({ title: 'Bienvenido', description: 'Se creará un nuevo archivo de datos en tu Google Drive.' });
        }
      } else {
        // Not logged in, load from local storage
        const localState = localStorage.getItem(LOCAL_STORAGE_STATE_KEY);
        if (localState) setState(JSON.parse(localState));
      }
      
      setIsInitialized(true);
    };

    loadData();
  }, [user, accessToken, isFirebaseAuthReady, toast, dismiss]);

  // Persist data: To Drive if logged in, otherwise to localStorage
  useEffect(() => {
    if (!isInitialized || !isMounted.current) {
        if(isInitialized) isMounted.current = true;
        return;
    }

    if (user && accessToken) {
      // Debounced save to Google Drive
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        setIsSyncing(true);
        const { fileId: newFileId, error, lastBackupTimestamp } = await saveDriveData(accessToken, driveFileId, state);
        setIsSyncing(false);
        if (error) {
          toast({ title: 'Error de Sincronización', description: `No se pudieron guardar los cambios en Drive: ${error}`, variant: 'destructive' });
        } else if (newFileId) {
          if (!driveFileId) setDriveFileId(newFileId);
          // Optimistically update timestamp to avoid waiting for next load
          setState(prevState => ({...prevState, settings: {...prevState.settings, lastBackupTimestamp}}))
        }
      }, 2000); // 2-second debounce
    } else {
      // Save to local storage immediately
      try {
        localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error("[AppStore] Failed to save state to localStorage:", error);
        toast({ title: "Error de Guardado Local", description: "No se pudo guardar el estado de la aplicación.", variant: "destructive" });
      }
    }
  }, [state, user, accessToken, driveFileId, isInitialized, toast]);

  // End of month reminder logic (unchanged)
  useEffect(() => {
    if (!isInitialized || !state.settings.enableEndOfMonthReminder) return;
    
    const now = new Date();
    const currentMonthYear = format(now, 'yyyy-MM');
    if (state.settings.lastEndOfMonthReminderShownForMonth === currentMonthYear) return;

    const daysRemainingInMonth = getDaysInMonth(now) - getDate(now);
    if (daysRemainingInMonth >= 0 && daysRemainingInMonth <= state.settings.daysBeforeEndOfMonthToRemind) {
      const totalSpentThisMonth = state.purchases
        .filter(p => {
          try {
            return isSameMonth(parseISO(p.date), now);
          } catch {
            return false;
          }
        })
        .reduce((sum, p) => sum + p.finalAmount, 0);
      const remainingBalance = Math.max(0, state.settings.monthlyAllowance - totalSpentThisMonth);

      if (remainingBalance > 0) {
        toast({
          title: "Recordatorio de Beneficio",
          description: `Quedan ${daysRemainingInMonth} día(s) en ${format(now, "MMMM", { locale: es })} y tienes ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(remainingBalance)} de beneficio.`,
          duration: 10000,
        });
        updateSettings({ lastEndOfMonthReminderShownForMonth: currentMonthYear });
      }
    }
  }, [isInitialized, state.settings, state.purchases, toast]);

  const addPurchase = useCallback((purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'>) => {
    const discountAmount = (purchaseData.amount * state.settings.discountPercentage) / 100;
    const newPurchase: Purchase = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: purchaseData.amount,
      date: purchaseData.date,
      merchantName: purchaseData.merchantName.trim(),
      merchantLocation: purchaseData.merchantLocation?.trim() || undefined,
      description: purchaseData.description || undefined,
      receiptImageUrl: undefined,
      discountApplied: parseFloat(discountAmount.toFixed(2)),
      finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
    };

    setState(prevState => {
      const updatedPurchases = [...prevState.purchases, newPurchase].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
      const merchantExists = prevState.merchants.some(m => m.name.toLowerCase() === newPurchase.merchantName.toLowerCase() && (m.location || '').toLowerCase() === (newPurchase.merchantLocation || '').toLowerCase());
      let updatedMerchants = prevState.merchants;
      if (!merchantExists) {
        const newMerchant: Merchant = { id: `local_m_${Date.now()}`, name: newPurchase.merchantName, location: newPurchase.merchantLocation };
        updatedMerchants = [...prevState.merchants, newMerchant].sort((a, b) => a.name.localeCompare(b.name));
      }
      return { ...prevState, purchases: updatedPurchases, merchants: updatedMerchants };
    });
  }, [state.settings.discountPercentage]);

  const editPurchase = useCallback((purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'>) => {
    const discountAmount = (purchaseData.amount * state.settings.discountPercentage) / 100;
    const updatedCoreData = {
        ...purchaseData,
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
    };
    setState(prevState => ({
      ...prevState,
      purchases: prevState.purchases.map(p => p.id === purchaseId ? { ...p, ...updatedCoreData } : p)
    }));
  }, [state.settings.discountPercentage]);

  const deletePurchase = useCallback((purchaseId: string) => {
    setState(prevState => ({ ...prevState, purchases: prevState.purchases.filter(p => p.id !== purchaseId) }));
  }, []);

  const updateSettings = useCallback((newSettingsData: Partial<BenefitSettings>) => {
    setState(prevState => ({ ...prevState, settings: { ...prevState.settings, ...newSettingsData } }));
  }, []);

  const addMerchant = useCallback((merchantName: string, merchantLocation?: string) => {
    const trimmedName = merchantName.trim();
    const trimmedLocation = merchantLocation?.trim() || undefined;

    setState(prevState => {
        const existingMerchant = prevState.merchants.find(m => m.name.toLowerCase() === trimmedName.toLowerCase() && (m.location || '').toLowerCase() === (trimmedLocation || '').toLowerCase());
        if (existingMerchant) {
            toast({ title: 'Comercio Duplicado', description: 'Este comercio ya existe.', variant: 'destructive' });
            return prevState;
        }
        const newMerchant: Merchant = { id: `local_m_${Date.now()}`, name: trimmedName, location: trimmedLocation };
        const updatedMerchants = [...prevState.merchants, newMerchant].sort((a,b) => a.name.localeCompare(b.name));
        return { ...prevState, merchants: updatedMerchants };
    });
  }, [toast]);

  const exportToCSV = useCallback(() => {
    if (state.purchases.length === 0) { toast({ title: "Sin Datos", description: "No hay transacciones para exportar." }); return; }
    const csvRows = [
      ["ID", "Monto Original", "Fecha", "Comercio", "Ubicación Compra", "Descripción", "Descuento Aplicado", "Monto Final"].join(','),
      ...state.purchases.map(p => [
        p.id, p.amount, format(parseISO(p.date), 'yyyy-MM-dd HH:mm:ss'),
        `"${(p.merchantName || '').replace(/"/g, '""')}"`, `"${(p.merchantLocation || '').replace(/"/g, '""')}"`,
        `"${(p.description || '').replace(/"/g, '""')}"`, p.discountApplied, p.finalAmount
      ].join(','))
    ];
    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ledesc_transacciones_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Exportación Exitosa", description: "Datos exportados a CSV." });
  }, [state.purchases, toast]);
  
  const backupToExcel = useCallback(() => {
    const purchasesSheet = XLSX.utils.json_to_sheet(state.purchases.map(p => ({...p})));
    const merchantsSheet = XLSX.utils.json_to_sheet(state.merchants.map(m => ({...m})));
    const settingsSheet = XLSX.utils.json_to_sheet([state.settings]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, purchasesSheet, "Compras");
    XLSX.utils.book_append_sheet(wb, merchantsSheet, "Comercios");
    XLSX.utils.book_append_sheet(wb, settingsSheet, "Configuracion");
    XLSX.writeFile(wb, `LEDESC_Backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    toast({ title: "Backup Exitoso", description: "Datos exportados a Excel." });
  }, [state, toast]);

  const restoreFromExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result; if (!data) throw new Error("No se pudo leer archivo.");
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        
        const purchasesJSON: any[] = wb.SheetNames.includes("Compras") ? XLSX.utils.sheet_to_json(wb.Sheets["Compras"]) : [];
        const merchantsJSON: any[] = wb.SheetNames.includes("Comercios") ? XLSX.utils.sheet_to_json(wb.Sheets["Comercios"]) : [];
        const settingsJSON: any[] = wb.SheetNames.includes("Configuracion") ? XLSX.utils.sheet_to_json(wb.Sheets["Configuracion"]) : [];

        const restoredPurchases: Purchase[] = purchasesJSON.map((p, i) => {
             let dateValue = p.date || p.Fecha;
             if (typeof dateValue === 'number') dateValue = new Date(Math.round((dateValue - 25569)*86400*1000));
             const finalDate = (dateValue instanceof Date && isValid(dateValue)) ? dateValue.toISOString() : new Date().toISOString();
             return { ...p, date: finalDate, id: p.id || `xl_p_${Date.now()}_${i}` };
        });

        const restoredMerchants: Merchant[] = merchantsJSON.map((m, i) => ({ ...m, id: m.id || `xl_m_${Date.now()}_${i}` }));
        const restoredSettings = settingsJSON.length > 0 ? { ...DEFAULT_BENEFIT_SETTINGS, ...settingsJSON[0]} : state.settings;
        
        setState({ purchases: restoredPurchases, merchants: restoredMerchants, settings: restoredSettings });
        toast({ title: "Restauración Exitosa", description: "Datos restaurados desde Excel. Los cambios se guardarán en Drive si has iniciado sesión." });

      } catch (error: any) {
        toast({ title: "Error de Restauración", description: `No se pudo restaurar: ${error.message}`, variant: "destructive" });
      }
    };
    reader.onerror = () => toast({ title: "Error de Lectura", description: "No se pudo leer el archivo.", variant: "destructive" });
    reader.readAsArrayBuffer(file);
  }, [toast, state.settings]);

  return (
    <AppStateContext.Provider value={{...state, isSyncing}}>
      <AppDispatchContext.Provider value={{
        addPurchase, editPurchase, deletePurchase, updateSettings, addMerchant,
        exportToCSV, isInitialized, backupToExcel, restoreFromExcel
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
