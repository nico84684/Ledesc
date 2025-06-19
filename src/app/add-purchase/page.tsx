
"use client";

import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { addPurchaseAction } from '@/lib/actions';
import { useAppState, useAppDispatch } from '@/lib/store';
import type { PurchaseFormData } from '@/lib/schemas';
import { useAuth } from '@/components/layout/Providers';
import { useToast } from '@/hooks/use-toast';
import { APP_NAME } from '@/config/constants'; // Importar APP_NAME
import { format, parseISO } from 'date-fns';


export default function AddPurchasePage() {
  const { settings } = useAppState();
  const { addPurchase: addPurchaseToStore } = useAppDispatch(); // El store ahora maneja la escritura a Firestore
  const { user } = useAuth();
  const { toast } = useToast();

  const handleAddSubmit = async (data: PurchaseFormData): Promise<{success: boolean, message: string}> => {
    if (!user || !user.uid) {
        return { success: false, message: "Debes iniciar sesión para registrar una compra."};
    }
    if (!settings) {
        return { success: false, message: "Error: Configuración no disponible."};
    }
    try {
      // La acción del servidor ahora requiere userId
      const result = await addPurchaseAction(user.uid, data, settings);
      if (result.success && result.purchaseId) {
        // addPurchaseToStore en el cliente ya no es estrictamente necesario si confiamos en onSnapshot,
        // pero puede usarse para una actualización optimista o si onSnapshot no está implementado para todo.
        // Por ahora, la acción del servidor escribe en Firestore, y onSnapshot debería actualizar el estado.
        // El toast de éxito se mostrará desde PurchaseForm.

        // Lógica de alerta de límite:
        const currentMonth = format(parseISO(data.date), 'yyyy-MM');
        // Necesitamos leer las compras del estado actual para calcular el gasto del mes.
        // Esto es un poco complicado porque el estado se actualiza asíncronamente por onSnapshot.
        // Una solución más robusta sería que la server action o una función en la nube calcule esto
        // o que el cliente espere la actualización del estado.
        // Por simplicidad inmediata, omitiremos la alerta de límite aquí,
        // ya que el estado local inmediato puede no reflejar la nueva compra hasta que onSnapshot actúe.
        // La alerta de límite se podría reimplementar observando los cambios en `state.purchases` en `AppProvider`.
        
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
      <PurchaseForm onSubmitPurchase={handleAddSubmit} />
    </div>
  );
}
