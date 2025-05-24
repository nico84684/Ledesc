
// This file simulates a client-side store. In a real app, this would be replaced by a backend.
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Purchase, BenefitSettings, AppState, Merchant } from '@/types';
import { DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { useRouter, usePathname } from 'next/navigation';
import * as XLSX from 'xlsx';

interface AppDispatchContextType {
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> & { merchantLocation?: string }) => void;
  updateSettings: (newSettings: BenefitSettings) => void;
  addMerchant: (merchantName: string, merchantLocation?: string) => { success: boolean; merchant?: Merchant; message?: string };
  exportToCSV: () => void;
  isInitialized: boolean;
  backupToExcel: () => void;
  restoreFromExcel: (file: File) => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AppDispatchContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ledescAppState';
const INITIAL_SETUP_COMPLETE_KEY = 'initialSetupComplete';

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: DEFAULT_BENEFIT_SETTINGS,
    merchants: [],
  });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState);
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
        setState(parsedState);
      } catch (error) {
        console.error("Failed to parse state from localStorage", error);
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));

      if (router && pathname) {
        const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
        if (!setupComplete && pathname !== '/settings') {
          router.push('/settings');
        }
      }
    }
  }, [state, isInitialized, router, pathname]);

  const addMerchantInternal = useCallback((merchantName: string, merchantLocationParam: string | undefined, currentState: AppState): {
    updatedMerchants: Merchant[],
    newMerchant?: Merchant,
    alreadyExists: boolean
  } => {
    const trimmedName = merchantName.trim();
    const normalizedLocation = (merchantLocationParam || '').trim();

    const existingMerchantIndex = currentState.merchants.findIndex(
      (m) => m.name.toLowerCase() === trimmedName.toLowerCase() &&
             (m.location || '').toLowerCase() === normalizedLocation.toLowerCase()
    );

    if (existingMerchantIndex > -1) {
      return { updatedMerchants: currentState.merchants, alreadyExists: true };
    }

    const newMerchant: Merchant = {
      id: new Date().toISOString() + Math.random().toString(),
      name: trimmedName,
      location: normalizedLocation || undefined,
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
        merchantLocation: purchaseData.merchantLocation, // Guardar la ubicación de la compra
        description: purchaseData.description || undefined,
        receiptImageUrl: purchaseData.receiptImageUrl,
        id: new Date().toISOString() + Math.random().toString(),
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
      };
      const updatedPurchases = [newPurchase, ...prevState.purchases];

      const {
        updatedMerchants: merchantsAfterPurchase,
        newMerchant: addedMerchantFromPurchase,
      } = addMerchantInternal(newPurchase.merchantName, purchaseData.merchantLocation, prevState);

      if (addedMerchantFromPurchase) {
        setTimeout(() => {
           toast({ title: "Nuevo Comercio Registrado", description: `El comercio "${addedMerchantFromPurchase.name}" ${addedMerchantFromPurchase.location ? `en "${addedMerchantFromPurchase.location}"` : ''} ha sido añadido.`});
        }, 0);
      }

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

  const updateSettings = useCallback((newSettings: BenefitSettings) => {
    setState(prevState => ({ ...prevState, settings: newSettings }));
  }, []);

  const addMerchant = useCallback((merchantName: string, merchantLocation?: string): { success: boolean; merchant?: Merchant; message?: string } => {
    let result: { success: boolean; merchant?: Merchant; message?: string } = { success: false };
    setState(prevState => {
      const { updatedMerchants, newMerchant, alreadyExists } = addMerchantInternal(merchantName, merchantLocation, prevState);

      if (newMerchant) {
        result = { success: true, merchant: newMerchant, message: `Comercio "${newMerchant.name}" ${newMerchant.location ? `en "${newMerchant.location}"` : ''} añadido exitosamente.` };
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
    const headers = ["ID", "Monto Original", "Fecha", "Comercio", "Ubicación Comercio", "Descripción", "Descuento Aplicado", "Monto Final", "URL Recibo"];
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
        'Ubicación Comercio': p.merchantLocation || '',
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
      
      setTimeout(() => {
        toast({ title: "Backup Exitoso", description: "Los datos se han exportado a un archivo Excel." });
      }, 0);

    } catch (error) {
      console.error("Error al generar backup Excel:", error);
      setTimeout(() => {
        toast({ title: "Error de Backup", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
      }, 0);
    }
  }, [state.purchases, state.merchants, toast]);

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
          let purchaseDate = new Date().toISOString(); // Default date
          if (p.Fecha) {
            const parsedDate = p.Fecha instanceof Date ? p.Fecha : parseISO(p.Fecha as string);
            if (isValid(parsedDate)) {
              purchaseDate = parsedDate.toISOString();
            } else {
               console.warn(`Fila ${index+2} (Compras): Fecha inválida "${p.Fecha}", se usará fecha actual.`);
            }
          } else {
            console.warn(`Fila ${index+2} (Compras): Fecha no encontrada, se usará fecha actual.`);
          }
          
          return {
            id: p.ID || `restored_purchase_${Date.now()}_${index}`,
            amount: typeof p['Monto Original'] === 'number' ? p['Monto Original'] : 0,
            date: purchaseDate,
            merchantName: String(p.Comercio || 'Desconocido'),
            merchantLocation: String(p['Ubicación Comercio'] || ''),
            description: String(p.Descripción || ''),
            receiptImageUrl: String(p['URL Recibo'] || ''),
            discountApplied: typeof p['Descuento Aplicado'] === 'number' ? p['Descuento Aplicado'] : 0,
            finalAmount: typeof p['Monto Final'] === 'number' ? p['Monto Final'] : 0,
          };
        });

        const restoredMerchants: Merchant[] = merchantsFromExcel.map((m: any, index: number) => ({
          id: m.ID || `restored_merchant_${Date.now()}_${index}`,
          name: String(m.Nombre || 'Desconocido'),
          location: String(m.Ubicación || ''),
        }));
        
        // Validar que los datos restaurados sean arrays
        if (!Array.isArray(restoredPurchases) || !Array.isArray(restoredMerchants)) {
            throw new Error("Los datos leídos del Excel no tienen el formato esperado (no son arrays).");
        }


        setState(prevState => ({
          ...prevState,
          purchases: restoredPurchases,
          merchants: restoredMerchants,
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


  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={{ addPurchase, updateSettings, addMerchant, exportToCSV, isInitialized, backupToExcel, restoreFromExcel }}>
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
