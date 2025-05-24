
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
import { Loader2, PlusCircle, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AddMerchantForm() {
  const { addMerchant: addMerchantToStore } = useAppDispatch();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddMerchantFormData>({
    resolver: zodResolver(AddMerchantFormSchema),
    defaultValues: {
      name: '',
    },
  });

  async function onSubmit(data: AddMerchantFormData) {
    setIsSubmitting(true);
    try {
      // Llamar a la acción del servidor (que actualmente solo simula)
      const actionResult = await addManualMerchantAction(data);

      if (actionResult.success && actionResult.merchant) {
        // Intentar añadir al store del cliente, el store maneja duplicados
        const storeResult = addMerchantToStore(actionResult.merchant.name);
        if (storeResult.success && storeResult.merchant) {
          toast({ title: "Éxito", description: `Comercio "${storeResult.merchant.name}" añadido.` });
          form.reset();
        } else {
          toast({ title: "Información", description: storeResult.message || "El comercio ya existe o no se pudo añadir.", variant: 'default' });
        }
      } else {
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
        <CardDescription>Registra un nuevo comercio manualmente.</CardDescription>
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
                    <Input placeholder="Ej: Café Martínez Central" {...field} />
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
