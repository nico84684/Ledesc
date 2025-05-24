
// This file simulates a client-side store. In a real app, this would be replaced by a backend.
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Purchase, BenefitSettings, AppState, Merchant } from '@/types';
import { DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useRouter, usePathname } from 'next/navigation';

// Extender la firma de addPurchase para incluir merchantLocation
interface AppDispatchContextType {
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> & { merchantLocation?: string }) => void;
  updateSettings: (newSettings: BenefitSettings) => void;
  addMerchant: (merchantName: string, merchantLocation?: string) => { success: boolean; merchant?: Merchant; message?: string };
  exportToCSV: () => void;
  isInitialized: boolean;
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

  const addMerchantInternal = useCallback((merchantName: string, merchantLocation: string | undefined, currentState: AppState): { updatedMerchants: Merchant[], newMerchant?: Merchant, alreadyExists: boolean } => {
    const trimmedName = merchantName.trim();
    const existingMerchant = currentState.merchants.find(
      (m) => m.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingMerchant) {
      // Si el comercio existe y no tiene ubicación, pero se proporciona una ahora, podríamos actualizarlo.
      // Por simplicidad, si existe, no lo actualizamos con la ubicación de la compra.
      // El usuario puede añadir la ubicación desde la pantalla de Comercios si lo desea.
      return { updatedMerchants: currentState.merchants, alreadyExists: true };
    }

    const newMerchant: Merchant = {
      id: new Date().toISOString() + Math.random().toString(),
      name: trimmedName,
      location: merchantLocation?.trim() || undefined,
    };
    return { updatedMerchants: [...currentState.merchants, newMerchant].sort((a, b) => a.name.localeCompare(b.name)), newMerchant, alreadyExists: false };
  }, []);


  const addPurchase = useCallback((purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> & { merchantLocation?: string }) => {
    setState(prevState => {
      const discountAmount = (purchaseData.amount * prevState.settings.discountPercentage) / 100;
      const newPurchase: Purchase = {
        amount: purchaseData.amount,
        date: purchaseData.date,
        merchantName: purchaseData.merchantName,
        description: purchaseData.description || undefined,
        receiptImageUrl: purchaseData.receiptImageUrl,
        id: new Date().toISOString() + Math.random().toString(),
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
      };
      const updatedPurchases = [newPurchase, ...prevState.purchases];
      
      // Usar la merchantLocation de purchaseData para el nuevo comercio
      const { updatedMerchants: merchantsAfterPurchase, newMerchant: addedMerchantFromPurchase } = addMerchantInternal(newPurchase.merchantName, purchaseData.merchantLocation, prevState);
      
      if (addedMerchantFromPurchase) {
        setTimeout(() => {
           toast({ title: "Nuevo Comercio Añadido", description: `El comercio "${addedMerchantFromPurchase.name}" ${addedMerchantFromPurchase.location ? `en "${addedMerchantFromPurchase.location}"` : ''} ha sido añadido a la lista.`});
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
        format(parseISO(p.date), 'yyyy-MM-dd HH:mm:ss'), 
        `"${p.merchantName.replace(/"/g, '""')}"`, 
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
