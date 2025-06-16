
"use client";

import { useState } from 'react';
import { PurchaseForm } from './PurchaseForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Purchase } from '@/types';
import type { PurchaseFormData } from '@/lib/schemas';
import { editPurchaseAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

interface EditPurchaseDialogProps {
  purchase: Purchase;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPurchaseDialog({ purchase, isOpen, onOpenChange }: EditPurchaseDialogProps) {
  const { editPurchase: editPurchaseInStore } = useAppDispatch();
  const { settings } = useAppState();
  const { toast } = useToast();

  const handleEditSubmit = async (data: PurchaseFormData, purchaseId?: string): Promise<{success: boolean, message: string}> => {
    if (!purchaseId) {
        return { success: false, message: "ID de compra no encontrado para la edición."};
    }
    try {
      const result = await editPurchaseAction(purchaseId, data, settings);
      if (result.success && result.purchase) {
        // The store needs the raw form data to recalculate finalAmount etc.
        const storeData: Omit<Purchase, 'id' | 'discountApplied' | 'finalAmount'> = {
            amount: result.purchase.amount,
            date: result.purchase.date,
            merchantName: result.purchase.merchantName,
            merchantLocation: result.purchase.merchantLocation,
            description: result.purchase.description,
            receiptImageUrl: result.purchase.receiptImageUrl,
        };
        editPurchaseInStore(purchaseId, storeData);
        onOpenChange(false); // Close dialog on success
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message || "Error desconocido al editar la compra." };
      }
    } catch (error: any) {
      console.error("Error submitting edit purchase:", error);
      return { success: false, message: error.message || "Error inesperado al editar la compra."};
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Editar Compra</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la compra realizada el {new Date(purchase.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}.
          </DialogDescription>
        </DialogHeader>
        <PurchaseForm
          isEditMode
          initialData={purchase}
          onSubmitPurchase={handleEditSubmit}
          onCancel={() => onOpenChange(false)}
          className="pt-4"
        />
      </DialogContent>
    </Dialog>
  );
}
