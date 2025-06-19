
"use client";

import { useState } from 'react';
import { PurchaseForm } from './PurchaseForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Purchase } from '@/types';
import type { PurchaseFormData } from '@/lib/schemas';
import { editPurchaseAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/layout/Providers';

interface EditPurchaseDialogProps {
  purchase: Purchase;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPurchaseDialog({ purchase, isOpen, onOpenChange }: EditPurchaseDialogProps) {
  const { editPurchase: editPurchaseInStore } = useAppDispatch(); // El store ahora maneja la escritura a Firestore
  const { settings } = useAppState();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleEditSubmit = async (data: PurchaseFormData, purchaseIdFromForm?: string): Promise<{success: boolean, message: string}> => {
    const purchaseIdToEdit = purchaseIdFromForm || purchase.id;

    if (!user || !user.uid) {
        return { success: false, message: "Debes iniciar sesión para editar una compra."};
    }
    if (!purchaseIdToEdit) {
        return { success: false, message: "ID de compra no encontrado para la edición."};
    }
    if (!settings) {
        return { success: false, message: "Error: Configuración no disponible para editar."};
    }
    try {
      // La acción del servidor ahora requiere userId
      const result = await editPurchaseAction(user.uid, purchaseIdToEdit, data, settings);
      if (result.success) {
        // editPurchaseInStore en el cliente ya no es estrictamente necesario si confiamos en onSnapshot.
        // El toast de éxito se mostrará desde PurchaseForm.
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
          initialData={purchase} // PurchaseForm usará purchase.id
          onSubmitPurchase={handleEditSubmit}
          onCancel={() => onOpenChange(false)}
          className="pt-4"
        />
      </DialogContent>
    </Dialog>
  );
}
