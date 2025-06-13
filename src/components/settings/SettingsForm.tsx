
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsFormSchema, type SettingsFormData } from '@/lib/schemas';
import { updateSettingsAction, triggerGoogleDriveBackupAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, AlertTriangle, FileUp, FileDown, AlertCircle, ShoppingCart, Store as StoreIcon, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BenefitSettings } from '@/types';
import { useAuth } from '@/components/layout/Providers';
import { DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';

const INITIAL_SETUP_COMPLETE_KEY = 'initialSetupComplete';

interface CountersState {
  newPurchasesCount: number;
  newMerchantsCount: number;
}

export function SettingsForm() {
  const { settings, purchases, merchants } = useAppState(); 
  const { updateSettings: updateSettingsInStore, isInitialized, backupToExcel, restoreFromExcel: restoreFromExcelStore } = useAppDispatch();
  const { user, accessToken, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [isBackingUpToDrive, setIsBackingUpToDrive] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [counters, setCounters] = useState<CountersState>({
    newPurchasesCount: 0,
    newMerchantsCount: 0,
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: {
      monthlyAllowance: settings?.monthlyAllowance || DEFAULT_BENEFIT_SETTINGS.monthlyAllowance,
      discountPercentage: settings?.discountPercentage || DEFAULT_BENEFIT_SETTINGS.discountPercentage,
      alertThresholdPercentage: settings?.alertThresholdPercentage || DEFAULT_BENEFIT_SETTINGS.alertThresholdPercentage,
      enableWeeklyReminders: settings?.enableWeeklyReminders || DEFAULT_BENEFIT_SETTINGS.enableWeeklyReminders,
    },
  });

  useEffect(() => {
    if (isInitialized) {
      const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
      if (!setupComplete) {
        setIsInitialSetup(true);
      }
      // Siempre resetear el formulario con los datos del store (o por defecto) cuando se inicializa
      form.reset({
        monthlyAllowance: settings?.monthlyAllowance || DEFAULT_BENEFIT_SETTINGS.monthlyAllowance,
        discountPercentage: settings?.discountPercentage || DEFAULT_BENEFIT_SETTINGS.discountPercentage,
        alertThresholdPercentage: settings?.alertThresholdPercentage || DEFAULT_BENEFIT_SETTINGS.alertThresholdPercentage,
        enableWeeklyReminders: settings?.enableWeeklyReminders || DEFAULT_BENEFIT_SETTINGS.enableWeeklyReminders,
      });
    }
  }, [isInitialized, settings, form]);


  useEffect(() => {
    if (isInitialized && settings && settings.lastBackupTimestamp && settings.lastBackupTimestamp > 0) {
      const newPurchases = purchases.filter(p => parseISO(p.date).getTime() > (settings.lastBackupTimestamp || 0));
      const newMerchants = merchants.filter(m => {
        const purchaseUsingMerchant = purchases.find(p => p.merchantName === m.name && (p.merchantLocation || '') === (m.location || ''));
        return purchaseUsingMerchant ? parseISO(purchaseUsingMerchant.date).getTime() > (settings.lastBackupTimestamp || 0) : true;
      });
      setCounters({
        newPurchasesCount: newPurchases.length,
        newMerchantsCount: newMerchants.length,
      });
    } else if (isInitialized) {
      setCounters({
        newPurchasesCount: purchases.length,
        newMerchantsCount: merchants.length,
      });
    }
  }, [isInitialized, settings, purchases, merchants]);


  async function onSubmit(data: SettingsFormData) {
    setIsSubmitting(true);
    const wasInitialSetupPending = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) !== 'true';

    try {
      const dataToUpdate: Partial<BenefitSettings> = {
        monthlyAllowance: data.monthlyAllowance,
        discountPercentage: data.discountPercentage,
        alertThresholdPercentage: data.alertThresholdPercentage,
        enableWeeklyReminders: data.enableWeeklyReminders,
      };
      const result = await updateSettingsAction(dataToUpdate);
      if (result.success && result.settings) {
        updateSettingsInStore(result.settings);

        if (wasInitialSetupPending) {
          localStorage.setItem(INITIAL_SETUP_COMPLETE_KEY, 'true');
          setIsInitialSetup(false); 
          toast({
            title: "¡Configuración Guardada!",
            description: "Tu beneficio ha sido configurado. Serás redirigido al dashboard.",
          });
          router.push('/');
        } else {
          toast({ title: "Éxito", description: "Configuración actualizada exitosamente." });
        }
      } else {
        toast({ title: "Error", description: result.message || "No se pudo actualizar la configuración.", variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al actualizar la configuración.", variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleExcelBackup = () => {
    backupToExcel();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsRestoring(true);
      try {
        restoreFromExcelStore(file);
      } catch (error: any) {
         toast({ title: "Error de Restauración", description: error.message || "Ocurrió un error inesperado.", variant: 'destructive' });
      } finally {
        setIsRestoring(false);
         if(fileInputRef.current) {
           fileInputRef.current.value = "";
         }
      }
    }
  };

  const handleGoogleDriveBackup = async () => {
    if (!user || !user.uid || !user.email) {
      toast({ title: "Autenticación Requerida", description: "Debes iniciar sesión con Google para usar esta función.", variant: "destructive" });
      return;
    }
    if (!accessToken) {
      toast({ title: "Token de Acceso Faltante", description: "No se pudo obtener el token de acceso para Google Drive. Intenta iniciar sesión de nuevo.", variant: "destructive" });
      return;
    }

    setIsBackingUpToDrive(true);
    try {
      const purchasesData = JSON.stringify(purchases);
      const merchantsData = JSON.stringify(merchants);
      const settingsData = JSON.stringify(settings);

      const result = await triggerGoogleDriveBackupAction(user.uid, user.email, purchasesData, merchantsData, settingsData, accessToken);
      if (result.success) {
        toast({ title: "Backup a Drive (Simulado)", description: result.message });
      } else {
        toast({ title: "Error de Backup a Drive", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error de Backup a Drive", description: error.message || "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsBackingUpToDrive(false);
    }
  };


  if (!isInitialized || authLoading) {
     return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }
  
  const lastBackupDisplay = settings?.lastBackupTimestamp && settings.lastBackupTimestamp > 0
    ? `Último backup (Excel/Restore): ${format(new Date(settings.lastBackupTimestamp), "dd MMM yyyy, HH:mm", { locale: es })}`
    : "Nunca se ha realizado un backup (Excel/Restore).";

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isInitialSetup ? "Configuración Inicial del Beneficio" : "Configuración del Beneficio"}
        </CardTitle>
        <CardDescription>
          {isInitialSetup ? "Por favor, establece los parámetros iniciales de tu beneficio." : "Ajusta los parámetros de tu beneficio gastronómico y gestiona tus datos."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="monthlyAllowance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beneficio Mensual Total ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 68500" {...field} step="0.01" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormDescription>Monto total disponible cada mes.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porcentaje de Descuento (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 70" {...field} min="0" max="100" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormDescription>Descuento a aplicar en cada compra.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="alertThresholdPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Umbral de Alerta de Límite (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 80" {...field} min="0" max="100" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormDescription>Notificar cuando se alcance este porcentaje del límite.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="enableWeeklyReminders"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Recordatorios Semanales</FormLabel>
                      <FormDescription>
                        Recibir un recordatorio si no se usa el beneficio. (Función simulada)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Activar recordatorios semanales"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {form.getValues("enableWeeklyReminders") && (
                <div className="flex items-center p-3 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
                  <span>Los recordatorios semanales son una funcionalidad simulada y no enviarán notificaciones reales en esta versión.</span>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Guardando...' : (isInitialSetup ? 'Guardar Configuración Inicial' : 'Guardar Configuración')}
            </Button>
          </form>
        </Form>
        
        <Separator className="my-8" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Gestión de Datos</h3>
          <div className="p-3 border rounded-md bg-muted/50 text-sm">
            <p className="mb-1">{lastBackupDisplay}</p>
            <div className="flex items-center">
              <ShoppingCart className="h-4 w-4 mr-2 text-primary" /> 
              <span>{counters.newPurchasesCount} compras nuevas desde el último backup.</span>
            </div>
            <div className="flex items-center mt-1">
              <StoreIcon className="h-4 w-4 mr-2 text-primary" />
              <span>{counters.newMerchantsCount} comercios nuevos desde el último backup.</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Realiza un backup de tus compras y comercios en un archivo Excel.
            </p>
            <Button onClick={handleExcelBackup} className="w-full" variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Backup a Excel Ahora
            </Button>
          </div>

           <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Haz un backup (simulado) de tus datos en tu Google Drive. Debes iniciar sesión con Google.
            </p>
            <Button 
              onClick={handleGoogleDriveBackup} 
              className="w-full" 
              variant="outline"
              disabled={!user || isBackingUpToDrive || authLoading}
            >
              {isBackingUpToDrive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {isBackingUpToDrive ? 'Realizando backup...' : 'Backup a Google Drive'}
            </Button>
            {!user && !authLoading && <p className="text-xs text-muted-foreground">Inicia sesión con Google para habilitar esta opción.</p>}
            {authLoading && <p className="text-xs text-muted-foreground">Verificando estado de autenticación...</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Restaura tus datos desde un archivo Excel. Esto reemplazará todos los datos actuales.
            </p>
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="outline" disabled={isRestoring}>
                  {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                  {isRestoring ? 'Restaurando...' : 'Restaurar desde Excel'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Restauración de Datos</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción reemplazará todas tus compras y comercios actuales con los datos del archivo Excel seleccionado.
                    ¿Estás seguro de que quieres continuar? Se recomienda hacer un backup primero.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => fileInputRef.current?.click()}>
                    Continuar y Seleccionar Archivo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".xlsx, .xls" 
              className="hidden" 
              disabled={isRestoring}
            />
          </div>
           <div className="flex items-start p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
              <AlertCircle className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Nota sobre Excel:</span>
                <ul className="list-disc list-inside pl-2 mt-1">
                  <li>El archivo debe contener hojas llamadas "Compras" y "Comercios".</li>
                  <li>Las columnas deben coincidir con el formato de backup (ID, Fecha, Monto Original, etc.).</li>
                  <li>Las fechas en la hoja "Compras" deben estar en formato 'AAAA-MM-DD HH:MM:SS' o ser fechas válidas de Excel.</li>
                </ul>
              </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

    
