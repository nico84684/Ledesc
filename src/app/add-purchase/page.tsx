import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { Metadata } from 'next';
import { APP_NAME } from '@/config/constants';

export const metadata: Metadata = {
  title: `Registrar Compra - ${APP_NAME}`,
  description: 'Registra una nueva compra gastronómica.',
};

export default function AddPurchasePage() {
  return (
    <div className="container mx-auto py-8">
      <PurchaseForm />
    </div>
  );
}
