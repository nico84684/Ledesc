
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AddMerchantFormSchema, type AddMerchantFormData } from '@/lib/schemas';
import { addManualMerchantAction } from '@/lib/actions';
import { useAppDispatch } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Building2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AddMerchantForm() {
  const { addMerchant: addMerchantToStore } = useAppDispatch();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddMerchantFormData>({
    resolver: zodResolver(AddMerchantFormSchema),
    defaultValues: {
      name: '',
      location: '',
    },
  });

  async function onSubmit(data: AddMerchantFormData) {
    setIsSubmitting(true);
    try {
      // La acción del servidor solo procesa la solicitud, la lógica de unicidad está en el store
      const actionResult = await addManualMerchantAction(data); 

      if (actionResult.success && actionResult.merchant) {
        // addMerchantToStore ahora maneja la lógica de unicidad (nombre + ubicación)
        const storeResult = addMerchantToStore(actionResult.merchant.name, actionResult.merchant.location);
        if (storeResult.success && storeResult.merchant) {
          toast({ title: "Éxito", description: storeResult.message });
          form.reset();
        } else {
          // Si el store indica que ya existe o hubo otro problema
          toast({ title: "Información", description: storeResult.message || "No se pudo añadir el comercio.", variant: 'default' });
        }
      } else {
        // Error de la acción del servidor (poco probable en este setup simple)
        toast({ title: "Error", description: actionResult.message || "No se pudo procesar el registro del comercio.", variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al registrar el comercio.", variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className="h-5 w-5 text-primary" />
          Añadir Nuevo Comercio
        </CardTitle>
        <CardDescription>Registra un nuevo comercio manualmente. Se considera único por nombre y ubicación.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Comercio</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Café Martínez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    Ubicación (Opcional, pero ayuda a distinguir sucursales)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Av. Corrientes 1234, CABA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Registrando...' : 'Añadir Comercio'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
