
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PurchaseFormSchema, type PurchaseFormData } from '@/lib/schemas';
import { addPurchaseAction } from '@/lib/actions';
import { useAppDispatch, useAppState } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, Image as ImageIcon, Loader2, CheckCircle, MessageSquareText, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export function PurchaseForm() {
  const { addPurchase: addPurchaseToStore } = useAppDispatch();
  const { settings } = useAppState();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: {
      amount: '' as unknown as number, 
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"), 
      merchantName: '',
      merchantLocation: '', // Inicializar merchantLocation
      description: '',
      receiptImage: undefined,
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
      form.setValue('receiptImage', file); 
    } else {
      setSelectedFileName(null);
      setPreviewUrl(null);
      form.setValue('receiptImage', undefined);
    }
  };
  
  async function onSubmit(data: PurchaseFormData) {
    setIsSubmitting(true);
    setSubmissionStatus('idle');
    try {
      const dateToSend = typeof data.date === 'string' ? data.date : format(data.date as unknown as Date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
      
      const result = await addPurchaseAction(data, settings); // data ya incluye merchantLocation

      if (result.success && result.purchase) {
        addPurchaseToStore({ // Pasar merchantLocation a addPurchaseToStore
          amount: result.purchase.amount,
          date: result.purchase.date, 
          merchantName: result.purchase.merchantName,
          merchantLocation: data.merchantLocation, // Añadir merchantLocation aquí
          description: result.purchase.description,
          receiptImageUrl: result.purchase.receiptImageUrl,
        });
        toast({ title: "Éxito", description: result.message, variant: 'default' });
        form.reset({
          amount: '' as unknown as number, 
          date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          merchantName: '',
          merchantLocation: '', // Resetear merchantLocation
          description: '',
          receiptImage: undefined,
        });
        setSelectedFileName(null);
        setPreviewUrl(null);
        setSubmissionStatus('success');
      } else {
        toast({ title: "Error", description: result.message, variant: 'destructive' });
        setSubmissionStatus('error');
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al registrar la compra.", variant: 'destructive' });
      setSubmissionStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  useEffect(() => {
    if (submissionStatus === 'success' || submissionStatus === 'error') {
      const timer = setTimeout(() => setSubmissionStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [submissionStatus]);


  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Registrar Nueva Compra</CardTitle>
        <CardDescription>Completa los detalles de tu compra gastronómica.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto Total ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Ej: 2500.50" 
                      {...field} 
                      step="0.01" 
                      value={field.value === undefined || field.value === null ? '' : field.value} 
                      onChange={e => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Compra</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(parseISO(field.value), "PPP", { locale: es })
                          ) : (
                            <span>Selecciona una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseISO(field.value) : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '')}
                        disabled={(date) =>
                          date > new Date() || date < new Date("2000-01-01")
                        }
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="merchantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Comercio</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Restaurante El Sabor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="merchantLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                     <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    Ubicación del Comercio (Opcional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Av. Siempre Viva 742" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <MessageSquareText className="mr-2 h-4 w-4 text-muted-foreground" />
                    Descripción de la Compra (Opcional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: Almuerzo con equipo, Cena aniversario..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="receiptImage"
              render={({ field }) => ( 
                <FormItem>
                  <FormLabel>Imagen del Recibo (Opcional)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" asChild className="relative">
                        <div>
                          <ImageIcon className="mr-2 h-4 w-4" />
                          {selectedFileName ? 'Cambiar archivo' : 'Subir archivo'}
                          <input 
                            type="file" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={handleFileChange}
                          />
                        </div>
                      </Button>
                      {selectedFileName && <span className="text-sm text-muted-foreground truncate max-w-[150px]">{selectedFileName}</span>}
                    </div>
                  </FormControl>
                  {previewUrl && (
                    <div className="mt-2">
                      <Image src={previewUrl} alt="Vista previa del recibo" width={100} height={100} className="rounded-md object-cover" data-ai-hint="receipt document" />
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Registrando...' : 'Registrar Compra'}
            </Button>
          </form>
        </Form>
      </CardContent>
       {submissionStatus === 'success' && (
        <CardFooter>
          <p className="text-sm text-green-600">Compra registrada exitosamente.</p>
        </CardFooter>
      )}
      {submissionStatus === 'error' && (
         <CardFooter>
          <p className="text-sm text-destructive">Error al registrar la compra. Inténtalo de nuevo.</p>
        </CardFooter>
      )}
    </Card>
  );
}
