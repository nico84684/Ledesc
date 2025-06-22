
import type { Metadata } from 'next';
import { APP_NAME } from '@/config/constants';
import { MerchantManagement } from '@/components/merchants/MerchantManagement';

export const metadata: Metadata = {
  title: `Comercios Adheridos - ${APP_NAME}`,
  description: 'Consulta y gestiona los comercios adheridos al beneficio.',
};

export default function MerchantsPage() {
  return (
    <div className="container mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Comercios Adheridos
        </h1>
        <p className="text-muted-foreground">
          Visualiza, busca y añade nuevos comercios al programa de beneficios.
        </p>
      </div>
      <MerchantManagement />
    </div>
  );
}
