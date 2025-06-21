
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsFormSchema, type SettingsFormData } from '@/lib/schemas';
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

export function SettingsForm() {
  const { settings, isSyncing } = useAppState();
  const {
    isInitialized,
    backupToExcel,
    restoreFromExcel,
    updateSettings,
  } = useAppDispatch();
  const { user, loading: authLoading, isFirebaseAuthReady, signIn } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);
  const [isInitialSetupScreen, setIsInitialSetupScreen] = useState(false);
  const [isRestoringFromExcel, setIsRestoringFromExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: settings || DEFAULT_BENEFIT_SETTINGS,
  });

  const watchEnableEndOfMonthReminder = form.watch("enableEndOfMonthReminder");

  useEffect(() => {
    if (isInitialized && settings) {
      form.reset({ ...DEFAULT_BENEFIT_SETTINGS, ...settings });
      if (typeof window !== 'undefined') {
        const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
        if (!setupComplete) {
            setIsInitialSetupScreen(true);
            if (pathname !== '/settings') router.push('/settings');
        } else {
            setIsInitialSetupScreen(false);
        }
      }
    }
  }, [isInitialized, settings, form, router, pathname, user]);

  async function onSubmitSettings(data: SettingsFormData) {
    setIsSubmittingSettings(true);
    let wasInitialSetupScreenBeforeSave = isInitialSetupScreen;

    try {
      updateSettings(data); // This now updates local state, and a useEffect handles persistence
      
      if (typeof window !== 'undefined') localStorage.setItem(INITIAL_SETUP_COMPLETE_KEY, 'true');
      setIsInitialSetupScreen(false);
      
      toast({
          title: "Configuración Guardada",
          description: user ? "Tus cambios se guardarán en Google Drive en breve." : "Tus configuraciones se han guardado en este navegador.",
      });

      if (wasInitialSetupScreenBeforeSave) router.push('/');

    } catch (error: any) {
      console.error("Error submitting settings form:", error);
      toast({ title: "Error Inesperado", description: "Ocurrió un error al actualizar la configuración.", variant: 'destructive' });
    } finally {
      setIsSubmittingSettings(false);
    }
  }

  const handleExcelRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsRestoringFromExcel(true);
      try { restoreFromExcel(file); }
      catch (error: any) { toast({ title: "Error de Restauración", description: error.message || "Error inesperado.", variant: 'destructive' }); }
      finally { setIsRestoringFromExcel(false); if(fileInputRef.current) fileInputRef.current.value = ""; }
    } else { toast({ title: "Información", description: "No se seleccionó ningún archivo."}); }
  };

  const handleSwitchChange = (field: keyof Pick<BenefitSettings, "enableEndOfMonthReminder">, checked: boolean) => {
    form.setValue(field, checked, { shouldDirty: true, shouldValidate: true });
    updateSettings({ [field]: checked });
    toast({ title: "Configuración Actualizada", description: `Recordatorio fin de mes ${checked ? 'activado' : 'desactivado'}.` });
  };
  
  if (!isInitialized || (authLoading && !isFirebaseAuthReady)) {
     return ( <div className="flex justify-center items-center h-64"> <LoadingSpinner size={48} /> <p className="ml-4 text-lg text-muted-foreground">Cargando...</p> -</div> );
  }

  const lastSyncTimestamp = settings?.lastBackupTimestamp;
  const lastSyncDisplay = user && lastSyncTimestamp && lastSyncTimestamp > 0
    ? `Última sincronización con Drive: ${format(new Date(lastSyncTimestamp), "dd MMM yyyy, HH:mm", { locale: es })}`
    : user ? `Pendiente de sincronización con Google Drive.` : `Los datos se guardan localmente.`;

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
              para guardar tus datos en Google Drive y acceder desde múltiples dispositivos. De lo contrario, tus datos se guardarán solo en este navegador.
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
            {user ? " Los cambios se guardarán automáticamente en tu archivo de Google Drive." : " Los cambios se guardarán localmente en este navegador."}
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
              </div>
              <Button type="submit" className="w-full" disabled={isSubmittingSettings}> {isSubmittingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isSubmittingSettings ? 'Guardando...' : (isInitialSetupScreen ? 'Guardar y Continuar' : 'Guardar Configuración')} </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader> <CardTitle className="text-xl">Gestión de Datos</CardTitle> <CardDescription>Realiza backups y restaura tus datos desde archivos Excel.</CardDescription> </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 border rounded-md bg-muted/50 text-sm"> 
            <div className="flex items-center">
              {isSyncing && user ? <RefreshCw className="h-4 w-4 mr-2 text-primary animate-spin" /> : <Info className="h-4 w-4 mr-2 text-primary"/>}
              <span>{isSyncing && user ? "Sincronizando con Google Drive..." : lastSyncDisplay}</span>
            </div>
           </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border rounded-lg shadow-sm"> <h4 className="font-semibold text-lg flex items-center"><FileUp className="mr-2 h-5 w-5 text-primary"/>Backup a Excel</h4> <Separator />
              <Button onClick={backupToExcel} className="w-full" variant="outline"><DownloadCloud className="mr-2 h-4 w-4" />Guardar a Excel (Local)</Button>
            </div>
            <div className="space-y-4 p-4 border rounded-lg shadow-sm"> <h4 className="font-semibold text-lg flex items-center"><FileDown className="mr-2 h-5 w-5 text-primary"/>Restaurar desde Excel</h4> <Separator /> 
                <AlertDialog> <AlertDialogTrigger asChild><Button className="w-full" variant="outline" disabled={isRestoringFromExcel}>{isRestoringFromExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{isRestoringFromExcel ? 'Restaurando...' : 'Seleccionar archivo...'}</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurar desde Excel</AlertDialogTitle><AlertDialogDescription>Esta acción reemplazará todos tus datos actuales (compras, comercios y configuración) con el contenido del archivo. ¿Estás seguro?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => fileInputRef.current?.click()}>Continuar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog> <input type="file" ref={fileInputRef} onChange={handleExcelRestoreFileSelect} accept=".xlsx,.xls" className="hidden" disabled={isRestoringFromExcel}/>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
