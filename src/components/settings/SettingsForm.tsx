
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
import { Loader2, Save, AlertTriangle, CloudUpload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';

const INITIAL_SETUP_COMPLETE_KEY = 'initialSetupComplete';

export function SettingsForm() {
  const { settings, purchases } = useAppState(); 
  const { updateSettings: updateSettingsInStore, isInitialized } = useAppDispatch();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: settings,
  });
  
  useEffect(() => {
    if (isInitialized) {
      const setupComplete = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) === 'true';
      setIsInitialSetup(!setupComplete);
      if (settings) {
        form.reset(settings);
      }
    }
  }, [settings, form, isInitialized]);

  async function onSubmit(data: SettingsFormData) {
    setIsSubmitting(true);
    const wasInitialSetupPending = localStorage.getItem(INITIAL_SETUP_COMPLETE_KEY) !== 'true';

    try {
      const result = await updateSettingsAction(data);
      if (result.success && result.settings) {
        updateSettingsInStore(result.settings);

        if (wasInitialSetupPending) {
          localStorage.setItem(INITIAL_SETUP_COMPLETE_KEY, 'true');
          setIsInitialSetup(false); // Update state to reflect setup is complete
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

  async function handleBackup() {
    setIsBackingUp(true);
    try {
      // Pass current purchases and settings to the action
      const result = await backupToGoogleDriveAction({ purchases, settings });
      if (result.success) {
        toast({ title: "Backup (Simulación)", description: result.message });
      } else {
        toast({ title: "Error de Backup (Simulación)", description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error durante el backup (simulación).", variant: 'destructive' });
    } finally {
      setIsBackingUp(false);
    }
  }

  if (!isInitialized) {
     return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isInitialSetup ? "Configuración Inicial del Beneficio" : "Configuración del Beneficio"}
        </CardTitle>
        <CardDescription>
          {isInitialSetup ? "Por favor, establece los parámetros iniciales de tu beneficio." : "Ajusta los parámetros de tu beneficio gastronómico."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="monthlyAllowance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beneficio Mensual Total ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ej: 50000" {...field} step="0.01" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
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
                    <Input type="number" placeholder="Ej: 15" {...field} min="0" max="100" value={field.value || ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
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
                      Recibir un recordatorio si no se usa el beneficio. (Función en desarrollo)
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

        <div>
          <h3 className="text-lg font-medium mb-2">Backup de Datos</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Realiza un backup (simulado) de tus compras y configuración en Google Drive.
            La funcionalidad real de conexión con Google Drive requiere configuración adicional.
          </p>
          <Button onClick={handleBackup} className="w-full" variant="outline" disabled={isBackingUp}>
            {isBackingUp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="mr-2 h-4 w-4" />
            )}
            {isBackingUp ? 'Realizando Backup...' : 'Backup en Google Drive (Simulación)'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
