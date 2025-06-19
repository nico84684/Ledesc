
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsFormSchema, type SettingsFormData } from '@/lib/schemas';
import { triggerGoogleDriveBackupAction, triggerGoogleDriveRestoreAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, AlertTriangle, FileUp, FileDown, AlertCircle, ShoppingCart, UploadCloud, DownloadCloud, RefreshCw, CalendarClock, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useRouter, usePathname } from 'next/navigation';
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
import { DEFAULT_BENEFIT_SETTINGS, APP_NAME } from '@/config/constants';

const INITIAL_SETUP_COMPLETE_KEY = `initialSetupComplete_${APP_NAME}`;


interface CountersState {
  newPurchasesCount: number;
  newMerchantsCount: number;
}

export function SettingsForm() {
  const { settings, purchases, merchants } = useAppState();
  const {
    isInitialized: isAppStoreInitialized,
    backupToExcel,
    restoreFromExcel: restoreFromExcelStore,
    updateSettings: updateSettingsInStoreAndPotentiallyFirestore,
    restoreFromDrive: restoreFromDriveInStore,
  } = useAppDispatch();
  const { user, accessToken, loading: authLoading, isFirebaseAuthReady, signIn } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);
  const [isInitialSetupScreen, setIsInitialSetupScreen] = useState(false);
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

  useEffect(() => {
    if (isAppStoreInitialized && settings) {
      form.reset({ ...DEFAULT_BENEFIT_SETTINGS, ...settings });
      if (typeof window !== 'undefined') {
        const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
        const stillDefaultSettings = settings.monthlyAllowance === DEFAULT_BENEFIT_SETTINGS.monthlyAllowance &&
                                   settings.discountPercentage === DEFAULT_BENEFIT_SETTINGS.discountPercentage;
        
        if (!setupComplete && stillDefaultSettings && !user) { // Only force initial setup screen if not logged in and settings are default
          setIsInitialSetupScreen(true);
          if (pathname !== '/settings') router.push('/settings');
        } else if (!setupComplete && user && pathname !== '/settings') { // If logged in but setup not complete, still go to settings.
           setIsInitialSetupScreen(true);
           if (pathname !== '/settings') router.push('/settings');
        }
        else {
          setIsInitialSetupScreen(false);
        }
      }
    }
  }, [isAppStoreInitialized, settings, form, router, pathname, user]);


  useEffect(() => {
    if (isAppStoreInitialized && settings) {
        const backupTimestamp = user ? settings.lastBackupTimestamp : settings.lastLocalSaveTimestamp;
        
        if (backupTimestamp && backupTimestamp > 0) {
            const newPurchases = purchases.filter(p => parseISO(p.date).getTime() > backupTimestamp);
            
            const oldPurchaseMerchantKeys = new Set<string>();
            purchases.forEach(p => { if(parseISO(p.date).getTime() <= backupTimestamp) oldPurchaseMerchantKeys.add(`${p.merchantName.toLowerCase()}-${(p.merchantLocation || '').toLowerCase()}`); });
            
            const newOrUpdatedMerchants = new Set<string>();
            // Count merchants from new purchases that weren't in old purchases
            newPurchases.forEach(p => {
                const key = `${p.merchantName.toLowerCase()}-${(p.merchantLocation || '').toLowerCase()}`;
                if(!oldPurchaseMerchantKeys.has(key)) newOrUpdatedMerchants.add(key);
            });
            // Count merchants from the global list that are not associated with old purchases
            merchants.forEach(m => { 
                const key = `${m.name.toLowerCase()}-${(m.location || '').toLowerCase()}`;
                if(!oldPurchaseMerchantKeys.has(key)) newOrUpdatedMerchants.add(key); 
            });
            
            setCounters({ newPurchasesCount: newPurchases.length, newMerchantsCount: newOrUpdatedMerchants.size });
        } else {
             setCounters({ newPurchasesCount: purchases.length, newMerchantsCount: merchants.length });
        }
    }
  }, [isAppStoreInitialized, settings, purchases, merchants, user]);


  async function onSubmitSettings(data: SettingsFormData) {
    setIsSubmittingSettings(true);
    let wasInitialSetupScreenBeforeSave = isInitialSetupScreen;

    try {
      // The updateSettingsInStoreAndPotentiallyFirestore function now expects Partial<BenefitSettings>
      // data is SettingsFormData. We need to merge it with existing settings if necessary or pass it as is
      // if it covers all fields for non-Firestore updates.
      // Since updateSettingsInStoreAndPotentiallyFirestore internally merges with state.settings,
      // passing data (SettingsFormData) directly is fine for its logic.
      const result = await updateSettingsInStoreAndPotentiallyFirestore(data as Partial<BenefitSettings>);

      if (result.success) {
        if (typeof window !== 'undefined') localStorage.setItem(INITIAL_SETUP_COMPLETE_KEY, 'true');
        setIsInitialSetupScreen(false);

        if (!user) { // User not logged in, settings saved locally
            toast({
                title: "Configuración Guardada Localmente",
                description: (
                    <div>
                        <p>Tus configuraciones se han guardado en este navegador.</p>
                        <p className="mt-2">
                            <Info className="inline-block h-4 w-4 mr-1 align-text-bottom text-primary" />
                            Para sincronizar tus datos y habilitar backups en la nube, puedes {" "}
                            <Button variant="link" className="p-0 h-auto ml-0 inline text-primary hover:underline" onClick={signIn}>
                                iniciar sesión con Google.
                            </Button>
                        </p>
                    </div>
                ),
                duration: 10000,
            });
        } else { // User logged in, settings saved to Firestore
            toast({ title: "Éxito", description: result.message || "Configuración guardada exitosamente." });
        }
        if (wasInitialSetupScreenBeforeSave) router.push('/');

      } else {
        toast({ title: "Error", description: result.message || "No se pudo actualizar la configuración.", variant: 'destructive' });
      }
    } catch (error: any) {
      console.error("Error submitting settings form:", error, "Stack:", error.stack);
      toast({ title: "Error Inesperado", description: "Ocurrió un error al actualizar la configuración.", variant: 'destructive' });
    } finally {
      setIsSubmittingSettings(false);
    }
  }

  const handleExcelBackup = () => { backupToExcel(); };

  const handleExcelRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsRestoringFromExcel(true);
      try { restoreFromExcelStore(file); }
      catch (error: any) { toast({ title: "Error de Restauración", description: error.message || "Error inesperado.", variant: 'destructive' }); }
      finally { setIsRestoringFromExcel(false); if(fileInputRef.current) fileInputRef.current.value = ""; }
    } else { toast({ title: "Información", description: "No se seleccionó ningún archivo."}); }
  };

  const handleGoogleDriveBackup = async () => {
    if (!user || !user.uid || !user.email || !accessToken) { toast({ title: "Autenticación Requerida", description: "Debes iniciar sesión con Google.", variant: "destructive" }); return; }
    setIsBackingUpToDrive(true);
    try {
      const result = await triggerGoogleDriveBackupAction(user.uid, user.email, JSON.stringify(purchases), JSON.stringify(merchants), JSON.stringify(settings), accessToken);
      if (result.success) toast({ title: "Backup a Drive Exitoso", description: result.message });
      else toast({ title: "Error de Backup a Drive", description: result.message, variant: "destructive" });
    } catch (error: any) { toast({ title: "Error de Backup a Drive", description: error.message || "Error inesperado.", variant: "destructive" });
    } finally { setIsBackingUpToDrive(false); }
  };

  const handleGoogleDriveRestore = async () => {
    if (!user || !user.uid || !user.email || !accessToken) { toast({ title: "Autenticación Requerida", description: "Debes iniciar sesión con Google.", variant: "destructive" }); return; }
    setIsRestoringFromDrive(true);
    try {
      const result = await triggerGoogleDriveRestoreAction(user.uid, user.email, accessToken);
      if (result.success) {
        // The restoreFromDriveInStore function in the store will be called by onSnapshot reacting to Firestore changes
        // So, we don't need to call it directly here if the server action updated Firestore.
        // However, the server action for restore *does* return the data.
        // For now, the store's restoreFromDrive is a no-op if user is logged in as onSnapshot handles it.
        // If it were to apply local state changes, it would be:
        // restoreFromDriveInStore(result.purchasesData, result.merchantsData, result.settingsData);
        toast({ title: "Restauración desde Drive Exitosa", description: result.message });
      } else { toast({ title: "Error de Restauración desde Drive", description: result.message || "No se encontraron datos o error.", variant: "destructive" }); }
    } catch (error: any) { toast({ title: "Error de Restauración desde Drive", description: error.message || "Error inesperado.", variant: "destructive" });
    } finally { setIsRestoringFromDrive(false); }
  };

  const handleSwitchChange = async (field: keyof Pick<BenefitSettings, "enableEndOfMonthReminder" | "autoBackupToDrive">, checked: boolean) => {
    form.setValue(field, checked, { shouldDirty: true, shouldValidate: true });
    const currentFormValues = form.getValues(); // SettingsFormData
    
    // We need to pass a Partial<BenefitSettings> to updateSettingsInStoreAndPotentiallyFirestore
    // So we create an object that only contains the changed field.
    const settingsPayload: Partial<BenefitSettings> = { [field]: checked };

    const result = await updateSettingsInStoreAndPotentiallyFirestore(settingsPayload);
    if (result.success) {
        let message = field === "enableEndOfMonthReminder" ? `Recordatorio fin de mes ${checked ? 'activado' : 'desactivado'}.` : `Backup automático a Drive ${checked ? 'activado' : 'desactivado'}.`;
        toast({ title: "Configuración Actualizada", description: message });
    } else {
        toast({ title: "Error", description: result.message || "No se pudo actualizar.", variant: "destructive" });
        form.setValue(field, !checked); // Revert
    }
  };

  if (!isAppStoreInitialized || (authLoading && !isFirebaseAuthReady && !user)) {
     return ( <div className="flex justify-center items-center h-64"> <LoadingSpinner size={48} /> <p className="ml-4 text-lg text-muted-foreground">Cargando...</p> </div> );
  }

  const lastBackupSource = user ? "Nube (Drive/Excel)" : "Local (Excel)";
  const backupTimestampToDisplay = user ? settings?.lastBackupTimestamp : settings?.lastLocalSaveTimestamp;
  const lastBackupDisplay = backupTimestampToDisplay && backupTimestampToDisplay > 0
    ? `Último backup (${lastBackupSource}): ${format(new Date(backupTimestampToDisplay), "dd MMM yyyy, HH:mm", { locale: es })}`
    : `Nunca se ha realizado un backup ${user ? 'en la nube' : 'local'}.`;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 pb-8">
      {isInitialSetupScreen && (
        <Card className="border-primary shadow-lg animate-in fade-in-50 duration-500">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center">
              <Info className="h-5 w-5 mr-2" />
              ¡Bienvenido/a a {APP_NAME}!
            </CardTitle>
            <CardDescription>
              Para comenzar, revisa y guarda tu configuración inicial. Si deseas, puedes
              <Button variant="link" className="p-0 h-auto mx-1 inline text-primary hover:underline" onClick={signIn}>
                 iniciar sesión con Google
              </Button>
              para guardar tus datos en la nube y acceder desde múltiples dispositivos. De lo contrario, tus datos se guardarán solo en este navegador.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isInitialSetupScreen ? "Configuración Inicial del Beneficio" : "Configuración del Beneficio"}
          </CardTitle>
          <CardDescription>
            {isInitialSetupScreen ? "Establece los parámetros iniciales de tu beneficio." : "Ajusta los parámetros de tu beneficio gastronómico."}
            {!user && " Los cambios se guardarán localmente en este navegador."}
            {user && " Los cambios se guardarán en la nube."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitSettings)} className="space-y-8">
              <div className="space-y-6">
                <FormField control={form.control} name="monthlyAllowance" render={({ field }) => ( <FormItem> <FormLabel>Beneficio Mensual Total ($)</FormLabel> <FormControl><Input type="number" placeholder="Ej: 68500" {...field} step="0.01" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl> <FormDescription>Monto total disponible cada mes.</FormDescription> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="discountPercentage" render={({ field }) => ( <FormItem> <FormLabel>Porcentaje de Descuento (%)</FormLabel> <FormControl><Input type="number" placeholder="Ej: 70" {...field} min="0" max="100" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl> <FormDescription>Descuento a aplicar en cada compra.</FormDescription> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="alertThresholdPercentage" render={({ field }) => ( <FormItem> <FormLabel>Umbral de Alerta de Límite (%)</FormLabel> <FormControl><Input type="number" placeholder="Ej: 80" {...field} min="0" max="100" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl> <FormDescription>Notificar cuando se alcance este porcentaje del límite.</FormDescription> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="enableEndOfMonthReminder" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm"> <div className="space-y-0.5"> <FormLabel className="text-base flex items-center"><CalendarClock className="mr-2 h-4 w-4" />Recordatorio de Fin de Mes</FormLabel> <FormDescription>Recibir notificación si queda saldo pendiente.</FormDescription> </div> <FormControl><Switch checked={field.value} onCheckedChange={(c) => handleSwitchChange("enableEndOfMonthReminder", c)} /></FormControl> </FormItem> )} />
                {watchEnableEndOfMonthReminder && ( <FormField control={form.control} name="daysBeforeEndOfMonthToRemind" render={({ field }) => ( <FormItem className="pl-4 pr-4 pb-2 -mt-3 border border-t-0 rounded-b-lg pt-3"> <FormLabel>Días antes para recordar</FormLabel> <FormControl><Input type="number" placeholder="Ej: 3" {...field} min="1" max="15" value={field.value || ''} onChange={e => field.onChange(parseInt(e.target.value) || 1)} /></FormControl><FormMessage /></FormItem> )} /> )}
                <FormField control={form.control} name="autoBackupToDrive" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm"> <div className="space-y-0.5"> <FormLabel className="text-base">Backup Automático a Google Drive</FormLabel> <FormDescription>Requiere inicio de sesión con Google.</FormDescription> </div> <FormControl><Switch checked={field.value} disabled={!user} onCheckedChange={(c) => handleSwitchChange("autoBackupToDrive", c)} /></FormControl> </FormItem> )} />
                {!user && watchAutoBackupToDrive && form.getValues("autoBackupToDrive") && ( <p className="text-xs text-orange-600 dark:text-orange-400 px-4 -mt-3"><AlertTriangle className="inline-block h-3 w-3 mr-1" />Backup automático requiere inicio de sesión.</p> )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmittingSettings}> {isSubmittingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isSubmittingSettings ? 'Guardando...' : (isInitialSetupScreen ? 'Guardar y Continuar' : 'Guardar Configuración')} </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader> <CardTitle className="text-xl">Gestión de Datos</CardTitle> <CardDescription>Realiza backups y restaura tus datos.</CardDescription> </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 border rounded-md bg-muted/50 text-sm"> <p className="mb-2 font-medium">{lastBackupDisplay}</p> <div className="flex items-center"><ShoppingCart className="h-4 w-4 mr-2 text-primary" /><span>{counters.newPurchasesCount} compras y {counters.newMerchantsCount} comercios nuevos desde el último backup.</span></div> {watchAutoBackupToDrive && user && form.getValues("autoBackupToDrive") && ( <div className="flex items-center mt-2 text-green-700 dark:text-green-400"><RefreshCw className="h-4 w-4 mr-2 animate-spin" /><span>Backup automático a Drive ACTIVO.</span></div> )} {watchAutoBackupToDrive && !user && form.getValues("autoBackupToDrive") && ( <div className="flex items-center mt-2 text-orange-600 dark:text-orange-400"><AlertTriangle className="h-4 w-4 mr-2" /><span>Backup automático a Drive requiere inicio de sesión.</span></div> )} </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border rounded-lg shadow-sm"> <h4 className="font-semibold text-lg flex items-center"><UploadCloud className="mr-2 h-5 w-5 text-primary"/>Realizar Backup</h4> <Separator /> <div className="space-y-3"> <Button onClick={handleExcelBackup} className="w-full" variant="outline"><FileDown className="mr-2 h-4 w-4" />A Excel (Local)</Button> <Button onClick={handleGoogleDriveBackup} className="w-full" variant="outline" disabled={!user || isBackingUpToDrive || authLoading}>{isBackingUpToDrive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{isBackingUpToDrive ? 'Realizando backup...' : 'A Google Drive'}</Button> {!user && !authLoading && <p className="text-xs text-muted-foreground text-center">Inicia sesión para backup en Drive.</p>} </div> </div>
            <div className="space-y-4 p-4 border rounded-lg shadow-sm"> <h4 className="font-semibold text-lg flex items-center"><DownloadCloud className="mr-2 h-5 w-5 text-primary"/>Restaurar Datos</h4> <Separator /> <div className="space-y-3">
                <AlertDialog> <AlertDialogTrigger asChild><Button className="w-full" variant="outline" disabled={isRestoringFromExcel}>{isRestoringFromExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}{isRestoringFromExcel ? 'Restaurando...' : 'Desde Excel (Local)'}</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurar desde Excel</AlertDialogTitle><AlertDialogDescription>Esto reemplazará tus datos {user ? "en la nube" : "locales"} con los del archivo. ¿Seguro?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => fileInputRef.current?.click()}>Continuar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog> <input type="file" ref={fileInputRef} onChange={handleExcelRestoreFileSelect} accept=".xlsx,.xls" className="hidden" disabled={isRestoringFromExcel}/>
                <AlertDialog> <AlertDialogTrigger asChild><Button className="w-full" variant="outline" disabled={!user || isRestoringFromDrive || authLoading}>{isRestoringFromDrive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}{isRestoringFromDrive ? 'Restaurando...' : 'Desde Google Drive'}</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurar desde Google Drive</AlertDialogTitle><AlertDialogDescription>Esto reemplazará tus datos en la nube con los de Drive. ¿Seguro?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleGoogleDriveRestore}>Continuar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog> {!user && !authLoading && <p className="text-xs text-muted-foreground text-center">Inicia sesión para restaurar desde Drive.</p>}
            </div> </div> </div>
          <Separator />
          <div className="flex items-start p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"> <AlertCircle className="h-5 w-5 mr-2 shrink-0 mt-0.5" /> <div><span className="font-semibold">Nota sobre Restauración desde Excel:</span><ul className="list-disc list-inside pl-2 mt-1 space-y-0.5"><li>Debe contener hojas "Compras" y "Comercios".</li><li>Columnas deben coincidir con formato de backup.</li><li>Fechas en "Compras" como 'AAAA-MM-DD HH:MM:SS' o válidas de Excel.</li></ul></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
