import { TransactionHistoryTable } from '@/components/transactions/TransactionHistoryTable';
import { Metadata } from 'next';
import { APP_NAME } from '@/config/constants';

export const metadata: Metadata = {
  title: `Historial de Transacciones - ${APP_NAME}`,
  description: 'Consulta todas tus compras y transacciones pasadas.',
};

export default function HistoryPage() {
  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Historial de Transacciones
        </h1>
        <p className="text-muted-foreground">
          Aquí puedes ver todas tus compras registradas, filtrarlas y exportar los datos.
        </p>
      </div>
      <TransactionHistoryTable />
    </div>
  );
}
