
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsFormSchema, type SettingsFormData } from '@/lib/schemas';
import { updateSettingsAction, backupToGoogleDriveAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, AlertTriangle, CloudUpload, FileUp, FileDown, AlertCircle, Clock } from 'lucide-react';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const INITIAL_SETUP_COMPLETE_KEY = 'initialSetupComplete';

export function SettingsForm() {
  const { settings, purchases } = useAppState(); 
  const { updateSettings: updateSettingsInStore, isInitialized, backupToExcel, restoreFromExcel: restoreFromExcelStore } = useAppDispatch();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: {
      ...settings,
      preferredBackupTime: settings?.preferredBackupTime || '', // Asegurar que sea un string vacío si es undefined
    },
  });
  
  useEffect(() => {
    if (isInitialized) {
      const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
      setIsInitialSetup(!setupComplete);
      if (settings) {
        form.reset({
          ...settings,
          preferredBackupTime: settings.preferredBackupTime || '',
        });
      }
    }
  }, [settings, form, isInitialized]);

  async function onSubmit(data: SettingsFormData) {
    setIsSubmitting(true);
    const wasInitialSetupPending = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) !== 'true';

    try {
      const result = await updateSettingsAction({
        ...data,
        preferredBackupTime: data.preferredBackupTime === '' ? undefined : data.preferredBackupTime,
      });
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
        toast({ title: "Error", description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al actualizar la configuración.", variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleDriveBackup() {
    setIsBackingUp(true);
    try {
      const result = await backupToGoogleDriveAction({ purchases, settings });
      if (result.success) {
        toast({ title: "Backup (Simulación Google Drive)", description: result.message });
      } else {
        toast({ title: "Error de Backup (Simulación Google Drive)", description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error durante el backup (simulación Google Drive).", variant: 'destructive' });
    } finally {
      setIsBackingUp(false);
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

  if (!isInitialized) {
     return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }
  
  const lastBackupInfo = settings.lastBackupTimestamp && settings.lastBackupTimestamp > 0
    ? `Último backup: ${format(new Date(settings.lastBackupTimestamp), "dd MMM yyyy, HH:mm", { locale: es })}`
    : "Nunca se ha realizado un backup.";

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

              <FormField
                control={form.control}
                name="preferredBackupTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      Hora Preferida para Recordatorio de Backup Diario
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field}
                        value={field.value || ''} // Asegurar que el valor no sea undefined
                      />
                    </FormControl>
                    <FormDescription>
                      Si la app está abierta, se te recordará hacer un backup si ha pasado esta hora. Deja vacío para no programar recordatorios.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
          <p className="text-sm text-muted-foreground">{lastBackupInfo}</p>
          
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


          <Separator className="my-6" />
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              (Simulación) Realiza un backup de tus datos en Google Drive.
            </p>
            <Button onClick={handleGoogleDriveBackup} className="w-full" variant="outline" disabled={isBackingUp}>
              {isBackingUp ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="mr-2 h-4 w-4" />
              )}
              {isBackingUp ? 'Realizando Backup...' : 'Backup en Google Drive (Simulación)'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
