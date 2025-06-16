"use client";

import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { APP_NAME } from '@/config/constants';
import { addPurchaseAction } from '@/lib/actions';
import { useAppState, useAppDispatch } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseFormData } from '@/lib/schemas';
import type { Metadata } from 'next'; // Import Metadata

// Static metadata can still be exported from a page file that uses "use client"
export const metadata: Metadata = {
  title: `Registrar Compra - ${APP_NAME}`,
  description: 'Registra una nueva compra gastronómica.',
};

export default function AddPurchasePage() {
  const { settings } = useAppState();
  const { addPurchase: addPurchaseToStore } = useAppDispatch();
  // const { toast } = useToast(); // Toast is handled by PurchaseForm internally

  const handleAddSubmit = async (data: PurchaseFormData): Promise<{success: boolean, message: string}> => {
    if (!settings) {
        // This case should ideally not happen if useAppState provides default settings
        return { success: false, message: "Error: Configuración no disponible."};
    }
    try {
      // Server action call
      const result = await addPurchaseAction(data, settings);
      if (result.success && result.purchase) {
        // Update client-side store
        // The store's addPurchase function expects the raw data and calculates discount/finalAmount
        const storeData = {
            amount: result.purchase.amount,
            date: result.purchase.date,
            merchantName: result.purchase.merchantName,
            merchantLocation: result.purchase.merchantLocation,
            description: result.purchase.description,
            receiptImageUrl: result.purchase.receiptImageUrl,
        };
        addPurchaseToStore(storeData);
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message || "No se pudo registrar la compra." };
      }
    } catch (error: any) {
      console.error("Error submitting new purchase:", error);
      return { success: false, message: error.message || "Error inesperado al registrar la compra."};
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* Pass the handler to PurchaseForm */}
      <PurchaseForm onSubmitPurchase={handleAddSubmit} />
    </div>
  );
}
