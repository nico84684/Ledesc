
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsFormSchema, type SettingsFormData } from '@/lib/schemas';
import { updateSettingsAction, triggerGoogleDriveBackupAction, triggerGoogleDriveRestoreAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, AlertTriangle, FileUp, FileDown, AlertCircle, ShoppingCart, UploadCloud, DownloadCloud, RefreshCw, CalendarClock } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BenefitSettings } from '@/types';
import { useAuth } from '@/components/layout/Providers';
import { DEFAULT_BENEFIT_SETTINGS, APP_NAME } from '@/config/constants';

const INITIAL_SETUP_COMPLETE_KEY = `initialSetupComplete_${APP_NAME}`;


interface CountersState {
  newPurchasesCount: number;
  newMerchantsCount: number;
}

export function SettingsForm() {
  const { settings, purchases, merchants } = useAppState(); 
  const { 
    isInitialized, // Usar isInitialized del store que ahora considera Firestore
    backupToExcel, 
    restoreFromExcel: restoreFromExcelStore,
    // restoreFromDrive no se usa directamente, se llama a la acción del servidor
    updateSettings: updateSettingsInStore, // Para actualizar localmente si es necesario tras la acción
  } = useAppDispatch();
  const { user, accessToken, loading: authLoading, isFirebaseAuthReady } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false); // Se determina al cargar
  const [isBackingUpToDrive, setIsBackingUpToDrive] = useState(false);
  const [isRestoringFromDrive, setIsRestoringFromDrive] = useState(false);
  const [isRestoringFromExcel, setIsRestoringFromExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [counters, setCounters] = useState<CountersState>({
    newPurchasesCount: 0,
    newMerchantsCount: 0,
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: settings || DEFAULT_BENEFIT_SETTINGS, 
  });

  const watchEnableEndOfMonthReminder = form.watch("enableEndOfMonthReminder");
  const watchAutoBackupToDrive = form.watch("autoBackupToDrive");


  // Efecto para resetear el formulario cuando settings (del store, sincronizado con Firestore) cambie
  // y para determinar si es la configuración inicial.
  useEffect(() => {
    if (isInitialized && settings) { // isInitialized ahora significa que los datos de Firestore (o defaults) están listos
      console.log("[SettingsForm Effect] Settings loaded, resetting form:", settings);
      form.reset({
        ...DEFAULT_BENEFIT_SETTINGS, 
        ...settings,
      });

      // Verificar si es la configuración inicial después de que los settings de Firestore se cargaron (o se usaron defaults)
      if (typeof window !== 'undefined') {
        const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
        if (!setupComplete && (settings.monthlyAllowance === DEFAULT_BENEFIT_SETTINGS.monthlyAllowance)) { 
          // Si no está completo Y los settings actuales son los default (indicando que no hay nada en Firestore)
          setIsInitialSetup(true);
           if (router.pathname !== '/settings') router.push('/settings');
        } else if (setupComplete) {
           setIsInitialSetup(false);
        }
      }
    } else if (isInitialized && !settings && !user) {
        // Si está inicializado, no hay settings (porque no hay user), usar defaults
        form.reset(DEFAULT_BENEFIT_SETTINGS);
        if (typeof window !== 'undefined') {
            const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
            if (!setupComplete && router.pathname !== '/settings') router.push('/settings');
        }
    }
  }, [isInitialized, settings, form, user, router]);


  // Efecto para calcular contadores de "nuevos desde último backup"
  useEffect(() => {
    if (isInitialized && settings && settings.lastBackupTimestamp && settings.lastBackupTimestamp > 0) {
      const newPurchases = purchases.filter(p => parseISO(p.date).getTime() > (settings.lastBackupTimestamp || 0));
      const newMerchantsSet = new Set<string>();
      
      // Contar nuevos merchants basados en si su ID está en una compra nueva o si el merchant es completamente nuevo
      const existingMerchantIdsInOldPurchases = new Set<string>();
      purchases.forEach(p => {
        if(parseISO(p.date).getTime() <= (settings.lastBackupTimestamp || 0)) {
            // Esto es simplificado, idealmente se buscaría el ID del merchant asociado a la compra.
            // Por ahora, usamos nombre+ubicación como proxy.
            const merchantKey = `${p.merchantName}-${p.merchantLocation || ''}`;
            existingMerchantIdsInOldPurchases.add(merchantKey);
        }
      });

      purchases.forEach(p => {
        if (parseISO(p.date).getTime() > (settings.lastBackupTimestamp || 0)) {
            newMerchantsSet.add(`${p.merchantName}-${p.merchantLocation || ''}`);
        }
      });
      merchants.forEach(m => {
         const merchantKey = `${m.name}-${m.location || ''}`;
         if (!existingMerchantIdsInOldPurchases.has(merchantKey)) {
             newMerchantsSet.add(merchantKey);
         }
      });


      setCounters({
        newPurchasesCount: newPurchases.length,
        newMerchantsCount: newMerchantsSet.size,
      });

    } else if (isInitialized) { // Si no hay backup previo, todo es nuevo
      setCounters({
        newPurchasesCount: purchases.length,
        newMerchantsCount: merchants.length,
      });
    }
  }, [isInitialized, settings, purchases, merchants]);

  async function onSubmitSettings(data: SettingsFormData) {
    if (!user || !user.uid) {
        toast({ title: "Error", description: "Debes iniciar sesión para guardar la configuración.", variant: "destructive"});
        return;
    }
    setIsSubmittingSettings(true);
    let wasInitialSetupPending = false;
    if (typeof window !== 'undefined') {
      wasInitialSetupPending = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) !== 'true';
    }

    try {
      // Los datos ya incluyen los valores actuales de lastBackupTimestamp etc. del form.reset(settings)
      const result = await updateSettingsAction(user.uid, data); 
      
      if (result.success && result.settings) {
        // updateSettingsInStore(result.settings); // El listener de onSnapshot en AppProvider se encargará de actualizar el estado
        if (wasInitialSetupPending && typeof window !== 'undefined') {
          localStorage.setItem(INITIAL_SETUP_COMPLETE_KEY, 'true');
          setIsInitialSetup(false); 
          toast({
            title: "¡Configuración Guardada!",
            description: "Tu beneficio ha sido configurado. Serás redirigido al dashboard.",
          });
          router.push('/');
        } else {
          toast({ title: "Éxito", description: "Configuración principal guardada exitosamente." });
        }
      } else {
        toast({ title: "Error", description: result.message || "No se pudo actualizar la configuración.", variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al actualizar la configuración.", variant: 'destructive' });
    } finally {
      setIsSubmittingSettings(false);
    }
  }

  const handleExcelBackup = () => {
    if (!user) {
        toast({ title: "Error", description: "Debes iniciar sesión para realizar un backup.", variant: "destructive"});
        return;
    }
    backupToExcel(); // Esta función ya usa el estado del AppProvider, que viene de Firestore
  };

  const handleExcelRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
        toast({ title: "Error", description: "Debes iniciar sesión para restaurar desde Excel.", variant: "destructive"});
        return;
    }
    const file = event.target.files?.[0];
    if (file) {
      setIsRestoringFromExcel(true);
      try {
        restoreFromExcelStore(file); // Esta función ahora escribirá en Firestore
      } catch (error: any) {
         toast({ title: "Error de Restauración", description: error.message || "Ocurrió un error inesperado.", variant: 'destructive' });
      } finally {
        setIsRestoringFromExcel(false);
         if(fileInputRef.current) {
           fileInputRef.current.value = "";
         }
      }
    }
  };

  const handleGoogleDriveBackup = async () => {
    if (!user || !user.uid || !user.email || !accessToken) {
      toast({ title: "Autenticación Requerida", description: "Debes iniciar sesión con Google y permitir acceso a Drive.", variant: "destructive" });
      return;
    }
    setIsBackingUpToDrive(true);
    try {
      // Pasar los datos actuales del estado (que vienen de Firestore)
      const result = await triggerGoogleDriveBackupAction(user.uid, user.email, JSON.stringify(purchases), JSON.stringify(merchants), JSON.stringify(settings), accessToken);
      if (result.success) {
        // El timestamp se actualiza en Firestore por la acción, onSnapshot lo traerá al cliente.
        toast({ title: "Backup a Drive Exitoso", description: result.message });
      } else {
        toast({ title: "Error de Backup a Drive", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error de Backup a Drive", description: error.message || "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsBackingUpToDrive(false);
    }
  };

  const handleGoogleDriveRestore = async () => {
    if (!user || !user.uid || !user.email || !accessToken) {
       toast({ title: "Autenticación Requerida", description: "Debes iniciar sesión con Google y permitir acceso a Drive.", variant: "destructive" });
      return;
    }
    setIsRestoringFromDrive(true);
    try {
      const result = await triggerGoogleDriveRestoreAction(user.uid, user.email, accessToken);
      if (result.success) {
        // La acción del servidor ya escribe en Firestore. onSnapshot actualizará el estado local.
        toast({ title: "Restauración desde Drive Exitosa", description: result.message });
      } else {
        toast({ title: "Error de Restauración desde Drive", description: result.message || "No se encontraron datos o ocurrió un error.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error de Restauración desde Drive", description: error.message || "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsRestoringFromDrive(false);
    }
  };

  // Handler para los switches que necesitan actualizar el estado y persistir en Firestore inmediatamente.
  const handleSwitchChange = async (field: keyof Pick<BenefitSettings, "enableEndOfMonthReminder" | "autoBackupToDrive">, checked: boolean) => {
    if (!user || !user.uid) {
        toast({ title: "Error", description: "Debes iniciar sesión para cambiar esta configuración.", variant: "destructive" });
        form.setValue(field, !checked); // Revertir el cambio en el formulario
        return;
    }
    
    // Actualizar el formulario de forma optimista
    form.setValue(field, checked, { shouldDirty: true, shouldValidate: true });
    
    const currentFormValues = form.getValues();
    const settingsPayload: SettingsFormData = {
        ...settings, // Usar settings del estado como base para no perder otros valores
        ...currentFormValues, // Aplicar valores actuales del formulario
        [field]: checked, // Asegurar que el valor del switch esté actualizado
    };

    try {
        const result = await updateSettingsAction(user.uid, settingsPayload);
        if (result.success) {
            let message = "";
            if (field === "enableEndOfMonthReminder") message = `Recordatorio de fin de mes ${checked ? 'activado' : 'desactivado'}.`;
            if (field === "autoBackupToDrive") message = `Backup automático a Google Drive ${checked ? 'activado' : 'desactivado'}.`;
            toast({ title: "Configuración Actualizada", description: message });
        } else {
            toast({ title: "Error", description: result.message || "No se pudo actualizar la configuración.", variant: "destructive" });
            form.setValue(field, !checked); // Revertir en caso de error
        }
    } catch (error) {
        toast({ title: "Error Inesperado", description: "Ocurrió un error al actualizar la configuración.", variant: "destructive" });
        form.setValue(field, !checked); // Revertir en caso de error
    }
  };


  if (!isInitialized || authLoading && !isFirebaseAuthReady) { // Mostrar carga si el store no está listo O si auth está cargando Y Firebase no está listo.
     return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }
  
  const lastBackupDisplay = settings?.lastBackupTimestamp && settings.lastBackupTimestamp > 0
    ? `Último backup (Excel/Drive): ${format(new Date(settings.lastBackupTimestamp), "dd MMM yyyy, HH:mm", { locale: es })}`
    : "Nunca se ha realizado un backup.";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isInitialSetup ? "Configuración Inicial del Beneficio" : "Configuración del Beneficio"}
          </CardTitle>
          <CardDescription>
            {isInitialSetup ? "Por favor, establece los parámetros iniciales de tu beneficio. Estos se guardarán en la nube." : "Ajusta los parámetros de tu beneficio gastronómico. Los cambios se guardan en la nube."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitSettings)} className="space-y-8">
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
                  name="enableEndOfMonthReminder"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center">
                          <CalendarClock className="mr-2 h-4 w-4" />
                          Recordatorio de Fin de Mes
                        </FormLabel>
                        <FormDescription>
                          Recibir una notificación si queda saldo pendiente cerca de fin de mes.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => handleSwitchChange("enableEndOfMonthReminder", checked)}
                          aria-label="Activar recordatorio de fin de mes"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchEnableEndOfMonthReminder && ( // Usar el valor del formulario (form.watch)
                  <FormField
                    control={form.control}
                    name="daysBeforeEndOfMonthToRemind"
                    render={({ field }) => (
                      <FormItem className="pl-4 pr-4 pb-2 -mt-3 border border-t-0 rounded-b-lg pt-3">
                        <FormLabel>Días antes de fin de mes para recordar</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Ej: 3" {...field} min="1" max="15" value={field.value || ''} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                        </FormControl>
                        <FormDescription>Se te recordará cuando falten estos días para terminar el mes, si tienes saldo. (Se guarda con el botón principal)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                 <FormField
                  control={form.control}
                  name="autoBackupToDrive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Backup Automático a Google Drive</FormLabel>
                        <FormDescription>
                          Guardar automáticamente en Drive tras cada compra o cambio en comercios. Requiere inicio de sesión.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => handleSwitchChange("autoBackupToDrive", checked)}
                          aria-label="Activar backup automático a Google Drive"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmittingSettings || (!user && !isInitialSetup) }>
                {isSubmittingSettings ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Save className="mr-2 h-4 w-4" />)}
                {isSubmittingSettings ? 'Guardando...' : (isInitialSetup ? 'Guardar Configuración Inicial' : 'Guardar Configuración Principal')}
              </Button>
              {!user && !isInitialSetup && <p className="text-sm text-destructive text-center mt-2">Debes iniciar sesión para guardar cambios.</p>}
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Gestión de Datos (Backup y Restauración)</CardTitle>
          <CardDescription>Realiza backups y restaura tus datos. Los datos se guardan y leen desde la nube.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 border rounded-md bg-muted/50 text-sm">
            <p className="mb-2 font-medium">{lastBackupDisplay}</p>
            <div className="flex items-center">
              <ShoppingCart className="h-4 w-4 mr-2 text-primary" /> 
              <span>{counters.newPurchasesCount} compras y {counters.newMerchantsCount} comercios nuevos desde el último backup (basado en datos actuales).</span>
            </div>
             {watchAutoBackupToDrive && user && (
              <div className="flex items-center mt-2 text-green-700 dark:text-green-400">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                <span>Backup automático a Google Drive está ACTIVO.</span>
              </div>
            )}
            {watchAutoBackupToDrive && !user && (
              <div className="flex items-center mt-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span>Backup automático activo, pero requiere iniciar sesión con Google.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border rounded-lg shadow-sm">
              <h4 className="font-semibold text-lg flex items-center"><UploadCloud className="mr-2 h-5 w-5 text-primary"/>Realizar Backup</h4>
              <Separator />
              <div className="space-y-3">
                <Button onClick={handleExcelBackup} className="w-full" variant="outline" disabled={!user}>
                  <FileDown className="mr-2 h-4 w-4" />
                  A Excel (Local)
                </Button>
                <Button 
                  onClick={handleGoogleDriveBackup} 
                  className="w-full" 
                  variant="outline"
                  disabled={!user || isBackingUpToDrive || authLoading}
                >
                  {isBackingUpToDrive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  {isBackingUpToDrive ? 'Realizando backup...' : 'A Google Drive'}
                </Button>
                {!user && !authLoading && <p className="text-xs text-muted-foreground text-center">Inicia sesión con Google para backup en Drive.</p>}
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg shadow-sm">
              <h4 className="font-semibold text-lg flex items-center"><DownloadCloud className="mr-2 h-5 w-5 text-primary"/>Restaurar Datos</h4>
              <Separator />
              <div className="space-y-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="outline" disabled={isRestoringFromExcel || !user}>
                      {isRestoringFromExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                      {isRestoringFromExcel ? 'Restaurando...' : 'Desde Excel (Local)'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Restauración desde Excel</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción reemplazará todos tus datos en la nube (compras y comercios) con los datos del archivo Excel.
                        ¿Estás seguro? Se recomienda hacer un backup primero.
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
                <input type="file" ref={fileInputRef} onChange={handleExcelRestoreFileSelect} accept=".xlsx, .xls" className="hidden" disabled={isRestoringFromExcel}/>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button 
                        className="w-full" 
                        variant="outline"
                        disabled={!user || isRestoringFromDrive || authLoading}
                      >
                        {isRestoringFromDrive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
                        {isRestoringFromDrive ? 'Restaurando...' : 'Desde Google Drive'}
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Restauración desde Google Drive</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción reemplazará todos tus datos en la nube (compras, comercios y configuración) con la última versión guardada en Google Drive.
                        ¿Estás seguro? Se recomienda hacer un backup (Excel o Drive) primero si tienes cambios locales importantes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleGoogleDriveRestore}>
                        Continuar con la Restauración
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {!user && !authLoading && <p className="text-xs text-muted-foreground text-center">Inicia sesión con Google para restaurar desde Drive.</p>}
              </div>
            </div>
          </div>
          
          <Separator />

          <div className="flex items-start p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
            <AlertCircle className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Nota sobre Restauración desde Excel:</span>
              <ul className="list-disc list-inside pl-2 mt-1 space-y-0.5">
                <li>El archivo debe contener hojas llamadas "Compras" y "Comercios".</li>
                <li>Las columnas deben coincidir con el formato de backup (ID, Fecha, Monto Original, etc.).</li>
                <li>Las fechas en la hoja "Compras" deben estar en formato 'AAAA-MM-DD HH:MM:SS' o ser fechas válidas de Excel.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
