
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AddMerchantFormSchema, type AddMerchantFormData } from '@/lib/schemas';
import { addManualMerchantAction } from '@/lib/actions';
import { useAppDispatch } from '@/lib/store'; // El store ahora maneja la escritura a Firestore
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Building2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/layout/Providers';

export function AddMerchantForm() {
  const { addMerchant: addMerchantToStoreAndFirestore } = useAppDispatch(); // Renombrado para claridad
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddMerchantFormData>({
    resolver: zodResolver(AddMerchantFormSchema),
    defaultValues: {
      name: '',
      location: '',
    },
  });

  async function onSubmit(data: AddMerchantFormData) {
    if (!user || !user.uid) {
        toast({ title: "Error", description: "Debes iniciar sesión para añadir comercios.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
      // La función addMerchant del store ahora se encarga de llamar a la acción del servidor
      // (que escribe en Firestore) y de actualizar el estado local si es necesario (o confiar en onSnapshot).
      const storeResult = await addMerchantToStoreAndFirestore(data.name, data.location);

      if (storeResult.success && storeResult.merchant) {
          toast({ title: "Éxito", description: storeResult.message });
          form.reset();
      } else {
          toast({ title: "Información", description: storeResult.message || "No se pudo añadir el comercio.", variant: storeResult.success ? 'default' : 'destructive' });
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
        <CardDescription>Registra un nuevo comercio manualmente. Se considera único por nombre y ubicación. Se guardará en la nube.</CardDescription>
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
            <Button type="submit" className="w-full" disabled={isSubmitting || !user}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Registrando...' : 'Añadir Comercio'}
            </Button>
            {!user && <p className="text-sm text-center text-destructive mt-2">Debes iniciar sesión para añadir comercios.</p>}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
