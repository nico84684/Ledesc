
import { BenefitUsageSummary } from '@/components/benefits/BenefitUsageSummary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, History, Settings } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@/config/constants';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `Dashboard - ${APP_NAME}`,
  description: 'Tu panel de control para gestionar beneficios gastronómicos.',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="text-center md:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Bienvenido a {APP_NAME}
        </h1>
        <p className="text-muted-foreground">
          Gestiona tus compras y beneficios gastronómicos de forma sencilla.
        </p>
      </div>

      <BenefitUsageSummary />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Nueva Compra
            </CardTitle>
            <CardDescription>Registra tus gastos gastronómicos fácil y rápido.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/add-purchase">Registrar Compra</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow hover:border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <History className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
              Historial
            </CardTitle>
            <CardDescription>Consulta todas tus transacciones pasadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/history">Ver Historial</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow hover:border-emerald-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
              Configuración
            </CardTitle>
            <CardDescription>Ajusta los parámetros de tu beneficio.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/settings">Ir a Configuración</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
