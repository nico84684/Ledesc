"use client";

import { useAppState } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, PieChart, TrendingUp } from 'lucide-react';
import { format, parseISO, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

export function BenefitUsageSummary() {
  const { purchases, settings } = useAppState();
  const isMobile = useIsMobile();

  const currentMonth = new Date();
  const totalSpentThisMonth = purchases
    .filter(p => isSameMonth(parseISO(p.date), currentMonth))
    .reduce((sum, p) => sum + p.finalAmount, 0);

  const remainingBalance = Math.max(0, settings.monthlyAllowance - totalSpentThisMonth);
  const percentageUsed = settings.monthlyAllowance > 0 ? (totalSpentThisMonth / settings.monthlyAllowance) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  if (!settings) {
    return <p>Cargando configuración del beneficio...</p>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Resumen del Beneficio Mensual</CardTitle>
        <CardDescription>
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col items-start p-4 border rounded-lg bg-card shadow-sm">
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-medium text-muted-foreground">Gastado este Mes</span>
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSpentThisMonth)}</p>
          </div>

          <div className="flex flex-col items-start p-4 border rounded-lg bg-card shadow-sm">
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-medium text-muted-foreground">Saldo Restante</span>
              <PieChart className="h-5 w-5 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(remainingBalance)}</p>
          </div>
          
          <div className="flex flex-col items-start p-4 border rounded-lg bg-card shadow-sm">
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-medium text-muted-foreground">Beneficio Total</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(settings.monthlyAllowance)}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-muted-foreground">Porcentaje Utilizado</span>
            <span className="text-sm font-semibold text-foreground">{percentageUsed.toFixed(isMobile ? 0 : 1)}%</span>
          </div>
          <Progress value={percentageUsed} aria-label={`${percentageUsed.toFixed(1)}% del beneficio utilizado`} className="h-3" />
        </div>
      </CardContent>
    </Card>
  );
}
