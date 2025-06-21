
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Purchase, BenefitSettings, AppState, Merchant } from '@/types';
import { DEFAULT_BENEFIT_SETTINGS, APP_NAME } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
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
  forceSync: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AppDispatchContextType | undefined>(undefined);

const LOCAL_STORAGE_STATE_KEY = `${APP_NAME}_state_v3`;

export function AppProvider({ children }: { children: ReactNode }) {
  const { toast, dismiss } = useToast();
  const { user, accessToken, isFirebaseAuthReady } = useAuth();
  
  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: { ...DEFAULT_BENEFIT_SETTINGS, lastEndOfMonthReminderShownForMonth: undefined, lastLocalSaveTimestamp: 0 },
    merchants: [],
    isStateDirty: false,
  });
  
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Use a ref to store the latest auth data to prevent stale closures in callbacks.
  const authDataRef = useRef({ user, accessToken });
  useEffect(() => {
    authDataRef.current = { user, accessToken };
  }, [user, accessToken]);
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Stable sync function to avoid dependency loops.
  const syncToDrive = useCallback(async (currentState: AppState, currentFileId: string | null, isManual: boolean = false) => {
    const { user: currentUser, accessToken: currentAccessToken } = authDataRef.current;

    if (!currentUser || !currentAccessToken) {
        if(isManual) toast({ title: "Inicia Sesión", description: "Debes iniciar sesión con Google para sincronizar.", variant: "destructive" });
        return;
    };
    if (isSavingRef.current && !isManual) return;
    
    isSavingRef.current = true;
    setIsSyncing(true);
    if (isManual) {
        toast({ title: 'Sincronizando...', description: 'Guardando datos en Google Drive.' });
    }
    
    const { fileId: newFileId, error, lastBackupTimestamp } = await saveDriveData(currentAccessToken, currentFileId, currentState);
    
    if (isManual) dismiss();
    setIsSyncing(false);
    isSavingRef.current = false;

    if (error) {
      console.error("[AutoSync] Drive sync failed:", error);
      toast({
          title: "Fallo de Sincronización",
          description: "No se pudieron guardar los cambios en Google Drive. Tus datos están seguros localmente y se intentará sincronizar de nuevo más tarde.",
          variant: "destructive",
          duration: 10000,
      });
    } else {
      if (isManual) {
          toast({ title: 'Sincronización Manual Completa', description: 'Tus datos se guardaron en Google Drive.', duration: 4000 });
      }
      if (newFileId) setDriveFileId(newFileId);
      setState(prevState => ({
        ...prevState,
        settings: { ...prevState.settings, lastBackupTimestamp },
        isStateDirty: false,
      }));
    }
  }, [toast, dismiss]);

  // Effect for initial data loading and reconciliation.
  useEffect(() => {
    const loadData = async () => {
      const localStateJSON = localStorage.getItem(LOCAL_STORAGE_STATE_KEY);
      let localState: AppState | null = localStateJSON ? JSON.parse(localStateJSON) : null;
      if (localState) {
        setState(localState);
      }

      if (user && accessToken) {
        toast({ title: 'Sincronizando...', description: 'Buscando datos en Google Drive.' });
        const { data: driveData, fileId: currentFileId, error } = await getDriveData(accessToken);
        dismiss();

        if (error) {
          toast({ title: 'Error de Sincronización', description: `No se pudo conectar con Drive: ${error}. Usando datos locales.`, variant: 'destructive' });
        } else {
          setDriveFileId(currentFileId);

          if (driveData) {
            const driveTimestamp = driveData.settings.lastBackupTimestamp || 0;
            const localTimestamp = localState?.settings.lastBackupTimestamp || 0;
            
            if (driveTimestamp > localTimestamp) {
              const cleanState = { ...driveData, isStateDirty: false };
              setState(cleanState);
              localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(cleanState));
              toast({ title: 'Sincronización Completa', description: 'Datos actualizados desde Google Drive.', duration: 3000 });
            } else if (localState?.isStateDirty) {
              syncToDrive(localState, currentFileId, false);
            }
          } else {
            if (localState && (localState.purchases.length > 0 || localState.merchants.length > 0)) {
              syncToDrive(localState, null, false);
            }
          }
        }
      }
      setIsInitialized(true);
    };

    if (isFirebaseAuthReady) {
      loadData();
    }
  }, [isFirebaseAuthReady, user, accessToken, toast, dismiss, syncToDrive]);

  // Effect for saving data on state change.
  useEffect(() => {
    if (!isInitialized) return;

    localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(state));
    const { user: currentUser, accessToken: currentAccessToken } = authDataRef.current;

    if (currentUser && currentAccessToken && state.isStateDirty) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        syncToDrive(state, driveFileId, false);
      }, 2500);
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [state, isInitialized, driveFileId, syncToDrive]);

  const addPurchase = useCallback((purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'>) => {
    setState(prevState => {
      const discountAmount = (purchaseData.amount * prevState.settings.discountPercentage) / 100;
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
      
      const updatedPurchases = [...prevState.purchases, newPurchase].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
      const merchantExists = prevState.merchants.some(m => m.name.toLowerCase() === newPurchase.merchantName.toLowerCase() && (m.location || '').toLowerCase() === (newPurchase.merchantLocation || '').toLowerCase());
      let updatedMerchants = prevState.merchants;
      if (!merchantExists) {
        const newMerchant: Merchant = { id: `local_m_${Date.now()}`, name: newPurchase.merchantName, location: newPurchase.merchantLocation };
        updatedMerchants = [...prevState.merchants, newMerchant].sort((a, b) => a.name.localeCompare(b.name));
      }
      return { ...prevState, purchases: updatedPurchases, merchants: updatedMerchants, isStateDirty: true };
    });
  }, []);

  const editPurchase = useCallback((purchaseId: string, purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount' | 'receiptImageUrl'>) => {
    setState(prevState => {
      const discountAmount = (purchaseData.amount * prevState.settings.discountPercentage) / 100;
      const updatedCoreData = {
          ...purchaseData,
          discountApplied: parseFloat(discountAmount.toFixed(2)),
          finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
      };
      return {
        ...prevState,
        purchases: prevState.purchases.map(p => p.id === purchaseId ? { ...p, ...updatedCoreData } : p),
        isStateDirty: true,
      };
    });
  }, []);

  const deletePurchase = useCallback((purchaseId: string) => {
    setState(prevState => ({ ...prevState, purchases: prevState.purchases.filter(p => p.id !== purchaseId), isStateDirty: true }));
  }, []);

  const updateSettings = useCallback((newSettingsData: Partial<BenefitSettings>) => {
    setState(prevState => ({ ...prevState, settings: { ...prevState.settings, ...newSettingsData }, isStateDirty: true }));
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
        return { ...prevState, merchants: updatedMerchants, isStateDirty: true };
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
        
        setState({ purchases: restoredPurchases, merchants: restoredMerchants, settings: restoredSettings, isStateDirty: true });
        toast({ title: "Restauración Exitosa", description: "Datos restaurados desde Excel. Los cambios se guardarán en Drive si has iniciado sesión." });

      } catch (error: any) {
        toast({ title: "Error de Restauración", description: `No se pudo restaurar: ${error.message}`, variant: "destructive" });
      }
    };
    reader.onerror = () => toast({ title: "Error de Lectura", description: "No se pudo leer el archivo.", variant: "destructive" });
    reader.readAsArrayBuffer(file);
  }, [toast, state.settings]);

  const forceSyncCallback = useCallback(() => {
    const { user: currentUser } = authDataRef.current;
    if (!currentUser) {
        toast({ title: "Inicia Sesión", description: "Debes iniciar sesión con Google para sincronizar.", variant: "destructive" });
        return;
    }
    if (isSyncing) {
        toast({ title: "Sincronización en Progreso", description: "Por favor, espera a que la sincronización actual termine.", duration: 3000 });
        return;
    }
    syncToDrive(state, driveFileId, true);
  }, [state, driveFileId, syncToDrive, isSyncing, toast]);


  return (
    <AppStateContext.Provider value={{...state, isSyncing}}>
      <AppDispatchContext.Provider value={{
        addPurchase, editPurchase, deletePurchase, updateSettings, addMerchant,
        exportToCSV, isInitialized, backupToExcel, restoreFromExcel, forceSync: forceSyncCallback
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
