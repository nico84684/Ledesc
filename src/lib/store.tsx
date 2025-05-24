
// This file simulates a client-side store. In a real app, this would be replaced by a backend.
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Purchase, BenefitSettings, AppState, Merchant } from '@/types';
import { DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useRouter, usePathname } from 'next/navigation';

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<{
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => void;
  updateSettings: (newSettings: BenefitSettings) => void;
  addMerchant: (merchantName: string) => { success: boolean; merchant?: Merchant; message?: string };
  exportToCSV: () => void;
  isInitialized: boolean;
} | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ledescAppState';
const INITIAL_SETUP_COMPLETE_KEY = 'initialSetupComplete';

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: DEFAULT_BENEFIT_SETTINGS,
    merchants: [], // Inicializar lista de comercios
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Effect for loading from localStorage (runs once on mount)
  useEffect(() => {
    const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState);
        parsedState.purchases = parsedState.purchases.map((p: Purchase) => ({
          ...p,
          date: p.date,
        }));
        // Asegurar que merchants sea un array, incluso si no estaba en el estado guardado previo
        parsedState.merchants = parsedState.merchants || [];
        setState(parsedState);
      } catch (error) {
        console.error("Failed to parse state from localStorage", error);
      }
    }
    setIsInitialized(true);
  }, []);

  // Effect for saving state to localStorage and handling initial setup redirect
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

  const addMerchantInternal = useCallback((merchantName: string, currentState: AppState): { updatedMerchants: Merchant[], newMerchant?: Merchant, alreadyExists: boolean } => {
    const trimmedName = merchantName.trim();
    const existingMerchant = currentState.merchants.find(
      (m) => m.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingMerchant) {
      return { updatedMerchants: currentState.merchants, alreadyExists: true };
    }

    const newMerchant: Merchant = {
      id: new Date().toISOString() + Math.random().toString(),
      name: trimmedName,
    };
    return { updatedMerchants: [...currentState.merchants, newMerchant].sort((a, b) => a.name.localeCompare(b.name)), newMerchant, alreadyExists: false };
  }, []);


  const addPurchase = useCallback((purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => {
    setState(prevState => {
      const discountAmount = (purchaseData.amount * prevState.settings.discountPercentage) / 100;
      const newPurchase: Purchase = {
        ...purchaseData,
        id: new Date().toISOString() + Math.random().toString(),
        description: purchaseData.description || undefined,
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
      };
      const updatedPurchases = [newPurchase, ...prevState.purchases];

      // Añadir comercio si es nuevo
      const { updatedMerchants: merchantsAfterPurchase, newMerchant: addedMerchantFromPurchase } = addMerchantInternal(newPurchase.merchantName, prevState);
      if (addedMerchantFromPurchase) {
         toast({ title: "Nuevo Comercio Añadido", description: `El comercio "${addedMerchantFromPurchase.name}" ha sido añadido a la lista de adheridos.`});
      }
      
      const currentMonth = format(new Date(), 'yyyy-MM');
      const spentThisMonth = updatedPurchases
        .filter(p => format(new Date(p.date), 'yyyy-MM') === currentMonth)
        .reduce((sum, p) => sum + p.finalAmount, 0);
      
      const usagePercentage = (spentThisMonth / prevState.settings.monthlyAllowance) * 100;

      if (prevState.settings.monthlyAllowance > 0 && usagePercentage >= prevState.settings.alertThresholdPercentage) {
        toast({
          title: "Alerta de Límite de Beneficio",
          description: `Has utilizado ${usagePercentage.toFixed(0)}% de tu beneficio mensual.`,
          variant: "destructive",
        });
      }
      
      return { ...prevState, purchases: updatedPurchases, merchants: merchantsAfterPurchase };
    });
  }, [toast, addMerchantInternal]);

  const updateSettings = useCallback((newSettings: BenefitSettings) => {
    setState(prevState => ({ ...prevState, settings: newSettings }));
  }, []);

  const addMerchant = useCallback((merchantName: string): { success: boolean; merchant?: Merchant; message?: string } => {
    let result: { success: boolean; merchant?: Merchant; message?: string } = { success: false };
    setState(prevState => {
      const { updatedMerchants, newMerchant, alreadyExists } = addMerchantInternal(merchantName, prevState);
      if (alreadyExists) {
        result = { success: false, message: `El comercio "${merchantName.trim()}" ya existe.` };
        return prevState;
      }
      if (newMerchant) {
        result = { success: true, merchant: newMerchant, message: `Comercio "${newMerchant.name}" añadido exitosamente.` };
      }
      return { ...prevState, merchants: updatedMerchants };
    });
    return result;
  }, [addMerchantInternal]);
  
  const exportToCSV = useCallback(() => {
    if (state.purchases.length === 0) {
      toast({ title: "Sin Datos", description: "No hay transacciones para exportar.", variant: "default"});
      return;
    }
    const headers = ["ID", "Monto Original", "Fecha", "Comercio", "Descripción", "Descuento Aplicado", "Monto Final", "URL Recibo"];
    const csvRows = [
      headers.join(','),
      ...state.purchases.map(p => [
        p.id,
        p.amount,
        format(new Date(p.date), 'yyyy-MM-dd'),
        `"${p.merchantName.replace(/"/g, '""')}"`,
        `"${p.description ? p.description.replace(/"/g, '""') : ''}"`,
        p.discountApplied,
        p.finalAmount,
        p.receiptImageUrl || ''
      ].join(','))
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ledesc_transacciones_${format(new Date(), 'yyyyMMdd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Exportación Exitosa", description: "Los datos se han exportado a CSV."});
    } else {
      toast({ title: "Error de Exportación", description: "Tu navegador no soporta la descarga directa.", variant: "destructive"});
    }
  }, [state.purchases, toast]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={{ addPurchase, updateSettings, addMerchant, exportToCSV, isInitialized }}>
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
