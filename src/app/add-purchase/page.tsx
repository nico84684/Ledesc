
"use client";

import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { useAppDispatch } from '@/lib/store';
import type { PurchaseFormData } from '@/lib/schemas';
import { useAuth } from '@/components/layout/Providers';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function AddPurchasePage() {
  const { addPurchase } = useAppDispatch();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleAddSubmit = async (data: PurchaseFormData): Promise<{success: boolean, message: string}> => {
    try {
      // The addPurchase dispatch now handles all logic, including state update and persistence.
      addPurchase(data);
      // The success toast is now shown from the form itself upon successful submission.
      // We can navigate away after submission.
      router.push('/');
      return { success: true, message: "Compra registrada y programada para sincronización." };
    } catch (error: any) {
      console.error("Error submitting new purchase:", error);
      toast({ title: 'Error', description: error.message || "Error inesperado al registrar la compra.", variant: 'destructive'});
      return { success: false, message: error.message || "Error inesperado al registrar la compra."};
    }
  };

  return (
    <div className="container mx-auto py-8">
      <PurchaseForm onSubmitPurchase={handleAddSubmit} />
    </div>
  );
}
