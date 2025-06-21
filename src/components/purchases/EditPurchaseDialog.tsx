
"use client";

import { PurchaseForm } from './PurchaseForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Purchase } from '@/types';
import type { PurchaseFormData } from '@/lib/schemas';
import { useAppDispatch } from '@/lib/store';

interface EditPurchaseDialogProps {
  purchase: Purchase;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPurchaseDialog({ purchase, isOpen, onOpenChange }: EditPurchaseDialogProps) {
  const { editPurchase } = useAppDispatch();

  const handleEditSubmit = async (data: PurchaseFormData, purchaseIdFromForm?: string): Promise<{success: boolean, message: string}> => {
    const purchaseIdToEdit = purchaseIdFromForm || purchase.id;

    if (!purchaseIdToEdit) {
        return { success: false, message: "ID de compra no encontrado para la edición."};
    }
    
    try {
      editPurchase(purchaseIdToEdit, data);
      onOpenChange(false); // Close dialog on success
      return { success: true, message: "Compra actualizada y programada para sincronización." };
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
