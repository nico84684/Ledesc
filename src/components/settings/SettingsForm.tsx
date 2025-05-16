"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsFormSchema, type SettingsFormData } from '@/lib/schemas';
import { updateSettingsAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label'; // No longer needed directly here due to FormLabel
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function SettingsForm() {
  const { settings, purchases } = useAppState();
  const { updateSettings: updateSettingsInStore, isInitialized } = useAppDispatch();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: settings, // Initialize with current settings
  });
  
  // Effect to reset form when settings change from provider (e.g. on initial load)
  useEffect(() => {
    if (isInitialized && settings) {
      form.reset(settings);
    }
  }, [settings, form, isInitialized]);

  async function onSubmit(data: SettingsFormData) {
    setIsSubmitting(true);
    try {
      const result = await updateSettingsAction(data);
      if (result.success && result.settings) {
        updateSettingsInStore(result.settings);
        toast({ title: "Éxito", description: result.message });
      } else {
        toast({ title: "Error", description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al actualizar la configuración.", variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
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
        <CardTitle className="text-2xl">Configuración del Beneficio</CardTitle>
        <CardDescription>Ajusta los parámetros de tu beneficio gastronómico.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="monthlyAllowance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beneficio Mensual Total ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ej: 50000" {...field} step="0.01" />
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
                    <Input type="number" placeholder="Ej: 15" {...field} min="0" max="100" />
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
                    <Input type="number" placeholder="Ej: 80" {...field} min="0" max="100" />
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
              {isSubmitting ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
