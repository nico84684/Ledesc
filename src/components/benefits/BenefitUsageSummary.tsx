
"use client";

import { useState, useEffect } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, PieChart, TrendingUp, CalendarClock, Calculator } from 'lucide-react';
import { format, parseISO, isSameMonth, getDaysInMonth, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile'; // Corrected import path
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn, formatCurrencyARS, formatDateSafe } from '@/lib/utils'; // Import formatCurrencyARS

interface ClientCalculatedData {
  formattedMonthYear: string;
  totalSpentThisMonth: number;
  remainingBalance: number;
  percentageUsed: number;
  remainingDaysInMonth: number;
  requiredPurchaseValue: number;
}

export function BenefitUsageSummary() {
  const { purchases, settings } = useAppState();
  const { isInitialized: isAppStoreInitialized } = useAppDispatch();
  const isMobile = useIsMobile();

  const [clientData, setClientData] = useState<ClientCalculatedData | null>(null);

  useEffect(() => {
    if (!isAppStoreInitialized || !settings) {
      setClientData(null); 
      return;
    }

    const currentMonthDate = new Date();
    
    const totalSpent = purchases
      .filter(p => {
          try {
            return isSameMonth(parseISO(p.date), currentMonthDate);
          } catch {
            return false;
          }
      })
      .reduce((sum, p) => sum + p.discountApplied, 0);
    
    const balance = Math.max(0, settings.monthlyAllowance - totalSpent);
    const percentUsed = settings.monthlyAllowance > 0 ? (totalSpent / settings.monthlyAllowance) * 100 : 0;
    
    const daysInMonth = getDaysInMonth(currentMonthDate);
    const currentDayOfMonth = getDate(currentMonthDate);
    const daysLeft = daysInMonth - currentDayOfMonth;

    const requiredPurchaseValue = settings.discountPercentage > 0
      ? balance / (settings.discountPercentage / 100)
      : 0;

    setClientData({
      formattedMonthYear: formatDateSafe(currentMonthDate.toISOString(), "MMMM yyyy", es),
      totalSpentThisMonth: totalSpent,
      remainingBalance: balance,
      percentageUsed: percentUsed,
      remainingDaysInMonth: daysLeft,
      requiredPurchaseValue: requiredPurchaseValue,
    });

  }, [purchases, settings, isAppStoreInitialized]);


  if (!isAppStoreInitialized || !clientData) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Resumen del Beneficio Mensual</CardTitle>
          <CardDescription>Calculando...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-10 flex flex-col justify-center items-center min-h-[200px]">
          <LoadingSpinner size={32} />
          <p className="ml-2 text-muted-foreground mt-2">Cargando resumen...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Resumen del Beneficio Mensual</CardTitle>
        <CardDescription>
          {clientData.formattedMonthYear}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div 
            className={cn(
              "flex flex-col items-start p-4 border rounded-lg shadow-sm",
              "bg-[hsl(var(--indicator-spent-bg-light))] dark:bg-[hsl(var(--indicator-spent-bg-dark))]",
              "border-[hsl(var(--indicator-spent-border-light))] dark:border-[hsl(var(--indicator-spent-border-dark))]"
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-medium text-muted-foreground">Gastado este Mes</span>
              <DollarSign className={cn("h-5 w-5", "text-[hsl(var(--indicator-spent-text-light))] dark:text-[hsl(var(--indicator-spent-text-dark))]")} />
            </div>
            <p className={cn("text-2xl font-bold", "text-[hsl(var(--indicator-spent-text-light))] dark:text-[hsl(var(--indicator-spent-text-dark))]")}>
              {formatCurrencyARS(clientData.totalSpentThisMonth)}
            </p>
          </div>

          <div 
            className={cn(
              "flex flex-col items-start p-4 border rounded-lg shadow-sm",
              "bg-[hsl(var(--indicator-remaining-bg-light))] dark:bg-[hsl(var(--indicator-remaining-bg-dark))]",
              "border-[hsl(var(--indicator-remaining-border-light))] dark:border-[hsl(var(--indicator-remaining-border-dark))]"
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-medium text-muted-foreground">Saldo Restante</span>
              <PieChart className={cn("h-5 w-5", "text-[hsl(var(--indicator-remaining-text-light))] dark:text-[hsl(var(--indicator-remaining-text-dark))]")} />
            </div>
            <p className={cn("text-2xl font-bold", "text-[hsl(var(--indicator-remaining-text-light))] dark:text-[hsl(var(--indicator-remaining-text-dark))]")}>
              {formatCurrencyARS(clientData.remainingBalance)}
            </p>
          </div>
          
          <div 
            className={cn(
              "flex flex-col items-start p-4 border rounded-lg shadow-sm",
              "bg-[hsl(var(--indicator-total-bg-light))] dark:bg-[hsl(var(--indicator-total-bg-dark))]",
              "border-[hsl(var(--indicator-total-border-light))] dark:border-[hsl(var(--indicator-total-border-dark))]"
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-medium text-muted-foreground">Beneficio Total</span>
              <TrendingUp className={cn("h-5 w-5", "text-[hsl(var(--indicator-total-text-light))] dark:text-[hsl(var(--indicator-total-text-dark))]")} />
            </div>
            <p className={cn("text-2xl font-bold", "text-[hsl(var(--indicator-total-text-light))] dark:text-[hsl(var(--indicator-total-text-dark))]")}>
              {formatCurrencyARS(settings.monthlyAllowance)}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-muted-foreground">Porcentaje Utilizado</span>
            <span className="text-sm font-semibold text-foreground">{clientData.percentageUsed.toFixed(isMobile ? 0 : 1)}%</span>
          </div>
          <Progress value={clientData.percentageUsed} aria-label={`${clientData.percentageUsed.toFixed(1)}% del beneficio utilizado`} className="h-3" />
        </div>

        {clientData.requiredPurchaseValue > 0 && (
          <div className="flex items-center justify-center gap-3 p-3 text-sm text-center border rounded-lg bg-muted/50">
            <Calculator className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">
              Compra por <span className="font-semibold text-foreground">{formatCurrencyARS(clientData.requiredPurchaseValue)}</span> para consumir el saldo restante.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center text-center sm:text-left justify-center p-3 border rounded-lg bg-card shadow-sm">
          <CalendarClock className="h-6 w-6 text-primary mb-2 sm:mb-0 sm:mr-3" />
          <div>
            <p className="text-lg font-semibold text-foreground">
              {clientData.remainingDaysInMonth} día{clientData.remainingDaysInMonth !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-muted-foreground">restantes en el mes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
