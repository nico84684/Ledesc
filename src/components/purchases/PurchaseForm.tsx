
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PurchaseFormSchema, type PurchaseFormData } from '@/lib/schemas';
import { useAppDispatch, useAppState } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // CardFooter removed as not used in this version
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CalendarIcon, Loader2, CheckCircle, MessageSquareText, MapPin, ChevronsUpDown, Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { Merchant, Purchase } from '@/types';

interface PurchaseFormProps {
  isEditMode?: boolean;
  initialData?: Purchase; // Use full Purchase type for initialData in edit mode
  onSubmitPurchase: (data: PurchaseFormData, purchaseId?: string) => Promise<{success: boolean, message: string}>;
  onCancel?: () => void; // For closing dialog/modal
  className?: string;
}

export function PurchaseForm({ 
  isEditMode = false, 
  initialData, 
  onSubmitPurchase,
  onCancel,
  className 
}: PurchaseFormProps) {
  const { settings, merchants } = useAppState(); // Get settings for discount calculation preview if needed
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const formDefaultValues: PurchaseFormData = {
    amount: (initialData?.amount as unknown as number) ?? ('' as unknown as number),
    date: initialData?.date ? format(parseISO(initialData.date), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
    merchantName: initialData?.merchantName ?? '',
    merchantLocation: initialData?.merchantLocation ?? '',
    description: initialData?.description ?? '',
  };
  
  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: formDefaultValues,
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        amount: initialData.amount,
        date: initialData.date ? format(parseISO(initialData.date), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        merchantName: initialData.merchantName,
        merchantLocation: initialData.merchantLocation || '',
        description: initialData.description || '',
      });
    }
  }, [initialData, form]);


  async function handleSubmit(data: PurchaseFormData) {
    setIsSubmitting(true);
    try {
      const result = await onSubmitPurchase(data, initialData?.id);
      
      if (result.success) {
        toast({ title: isEditMode ? "Actualización Exitosa" : "Registro Exitoso", description: result.message });
        if (!isEditMode) {
          form.reset({
            amount: '' as unknown as number,
            date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
            merchantName: '',
            merchantLocation: '',
            description: '',
          });
        }
        onCancel?.(); // Close dialog/modal on success
      } else {
        toast({ title: isEditMode ? "Error al Actualizar" : "Error al Registrar", description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: `Ocurrió un error al ${isEditMode ? 'actualizar' : 'registrar'} la compra.`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const cardTitle = isEditMode ? "Editar Compra" : "Registrar Nueva Compra";
  const cardDescription = isEditMode ? "Modifica los detalles de la compra." : "Completa los detalles de tu compra gastronómica.";
  const buttonIcon = isEditMode ? <Save className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />;
  const buttonText = isEditMode ? 'Guardar Cambios' : 'Registrar Compra';

  return (
    <Card className={cn("w-full shadow-lg", className, isEditMode ? 'border-0 shadow-none' : 'max-w-lg mx-auto')}>
      {!isEditMode && (
        <CardHeader>
          <CardTitle className="text-2xl">{cardTitle}</CardTitle>
          <CardDescription>{cardDescription}</CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(isEditMode && "p-0")}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                      value={field.value === undefined || field.value === null ? '' : String(field.value)}
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
                <FormItem className="flex flex-col">
                  <FormLabel>Nombre del Comercio</FormLabel>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            {field.value
                              ? merchants.find(
                                  (merchant) => merchant.name.toLowerCase() === field.value.toLowerCase() &&
                                                 (merchant.location || '').toLowerCase() === (form.getValues('merchantLocation') || '').toLowerCase()
                                )?.name ?? field.value 
                              : "Seleccionar o escribir comercio..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Buscar o escribir nuevo..."
                          value={field.value || ''}
                          onValueChange={(currentValue) => {
                            field.onChange(currentValue);
                            // Check if typed value matches an existing merchant to auto-fill location
                            const matchedMerchant = merchants.find(m => m.name.toLowerCase() === currentValue.toLowerCase());
                            if (matchedMerchant && !form.getValues('merchantLocation')) { // Only fill if location is empty
                                form.setValue('merchantLocation', matchedMerchant.location || '');
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {field.value ? `"${field.value}" se registrará como nuevo.` : "No se encontraron comercios. Escribe para añadir uno nuevo."}
                          </CommandEmpty>
                          <CommandGroup>
                            {merchants.map((merchant: Merchant) => (
                              <CommandItem
                                key={merchant.id}
                                value={`${merchant.name}${merchant.location ? ` (${merchant.location})` : ''}`}
                                onSelect={() => {
                                  form.setValue("merchantName", merchant.name);
                                  form.setValue("merchantLocation", merchant.location || "");
                                  setComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value && field.value.toLowerCase() === merchant.name.toLowerCase() &&
                                    (form.getValues('merchantLocation') || '').toLowerCase() === (merchant.location || '').toLowerCase()
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{merchant.name}</span>
                                  {merchant.location && (
                                    <span className="text-xs text-muted-foreground ml-0">
                                      <MapPin className="inline-block h-3 w-3 mr-1" />
                                      {merchant.location}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                    <Input placeholder="Ej: Av. Siempre Viva 742" {...field} value={field.value || ''} />
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
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className={cn("flex gap-2", isEditMode ? "justify-end" : "justify-start")}>
              {isEditMode && onCancel && (
                 <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                   Cancelar
                 </Button>
              )}
              <Button type="submit" className={cn(!isEditMode && "w-full")} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  buttonIcon
                )}
                {isSubmitting ? (isEditMode ? 'Guardando...' : 'Registrando...') : buttonText}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
