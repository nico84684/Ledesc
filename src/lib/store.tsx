// This file simulates a client-side store. In a real app, this would be replaced by a backend.
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Purchase, BenefitSettings, AppState } from '@/types';
import { DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<{
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => void;
  updateSettings: (newSettings: BenefitSettings) => void;
  exportToCSV: () => void;
  isInitialized: boolean;
} | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ledescAppState';

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    purchases: [],
    settings: DEFAULT_BENEFIT_SETTINGS,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState);
        // Ensure date objects are correctly handled if stored as strings
        parsedState.purchases = parsedState.purchases.map((p: Purchase) => ({
          ...p,
          date: p.date, // Assuming dates are stored as ISO strings
        }));
        setState(parsedState);
      } catch (error) {
        console.error("Failed to parse state from localStorage", error);
        setState({ purchases: [], settings: DEFAULT_BENEFIT_SETTINGS });
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isInitialized]);

  const addPurchase = useCallback((purchaseData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'>) => {
    setState(prevState => {
      const discountAmount = (purchaseData.amount * prevState.settings.discountPercentage) / 100;
      const newPurchase: Purchase = {
        ...purchaseData,
        id: new Date().toISOString() + Math.random().toString(), // Simple unique ID
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat((purchaseData.amount - discountAmount).toFixed(2)),
      };
      const updatedPurchases = [newPurchase, ...prevState.purchases];
      
      // Check alert threshold
      const currentMonth = format(new Date(), 'yyyy-MM');
      const spentThisMonth = updatedPurchases
        .filter(p => format(new Date(p.date), 'yyyy-MM') === currentMonth)
        .reduce((sum, p) => sum + p.finalAmount, 0);
      
      const usagePercentage = (spentThisMonth / prevState.settings.monthlyAllowance) * 100;

      if (usagePercentage >= prevState.settings.alertThresholdPercentage) {
        toast({
          title: "Alerta de Límite de Beneficio",
          description: `Has utilizado ${usagePercentage.toFixed(0)}% de tu beneficio mensual.`,
          variant: "destructive",
        });
      }
      
      // Simulate weekly reminder logic (very basic)
      if (prevState.settings.enableWeeklyReminders) {
        const lastPurchaseDate = updatedPurchases.length > 0 ? new Date(updatedPurchases[0].date) : new Date(0);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        if (lastPurchaseDate < oneWeekAgo && updatedPurchases.length > 0) { // only if there's a purchase to compare against
           // This logic is flawed for actual weekly reminders, as it only triggers on new purchase
           // A real implementation would use a cron job or background task.
           // For now, we'll just log it or show a one-time toast if no purchase in 7 days after a purchase.
           // This part is complex to implement correctly client-side.
        }
      }

      return { ...prevState, purchases: updatedPurchases };
    });
  }, [toast]);

  const updateSettings = useCallback((newSettings: BenefitSettings) => {
    setState(prevState => ({ ...prevState, settings: newSettings }));
  }, []);
  
  const exportToCSV = useCallback(() => {
    if (state.purchases.length === 0) {
      toast({ title: "Sin Datos", description: "No hay transacciones para exportar.", variant: "default"});
      return;
    }
    const headers = ["ID", "Monto Total", "Fecha", "Comercio", "Descuento Aplicado", "Monto Final", "URL Recibo"];
    const csvRows = [
      headers.join(','),
      ...state.purchases.map(p => [
        p.id,
        p.amount,
        format(new Date(p.date), 'yyyy-MM-dd'),
        `"${p.merchantName.replace(/"/g, '""')}"`, // Escape double quotes
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
      <AppDispatchContext.Provider value={{ addPurchase, updateSettings, exportToCSV, isInitialized }}>
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
