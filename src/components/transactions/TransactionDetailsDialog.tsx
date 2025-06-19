
"use client";

import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Purchase } from '@/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Store, MapPin, Tag, MessageSquareText, Receipt, DollarSign, Percent, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface TransactionDetailsDialogProps {
  purchase: Purchase;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export function TransactionDetailsDialog({ purchase, isOpen, onOpenChange }: TransactionDetailsDialogProps) {
  if (!purchase) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5 text-primary" />
            Detalles de la Transacción
          </DialogTitle>
          <DialogDescription>
            Resumen de la compra realizada.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center">
              <Store className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="font-semibold mr-1">Comercio:</span>
              <span>{purchase.merchantName}</span>
            </div>
            {purchase.merchantLocation && (
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-semibold mr-1">Ubicación:</span>
                <span>{purchase.merchantLocation}</span>
              </div>
            )}
            <div className="flex items-center">
              <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="font-semibold mr-1">Fecha:</span>
              <span>{format(parseISO(purchase.date), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
             <h4 className="font-medium text-sm text-muted-foreground mb-2">Información del Monto:</h4>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />Monto Original:</span>
              <span>{formatCurrency(purchase.amount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center"><Percent className="h-4 w-4 mr-1 text-muted-foreground" />Descuento Aplicado:</span>
              <span className="text-green-600 dark:text-green-400">-{formatCurrency(purchase.discountApplied)}</span>
            </div>
            <div className="flex justify-between items-center text-md font-semibold">
              <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-primary" />Monto Final:</span>
              <span>{formatCurrency(purchase.finalAmount)}</span>
            </div>
          </div>

          {purchase.description && (
            <>
              <Separator />
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center">
                    <MessageSquareText className="h-4 w-4 mr-2" />
                    Descripción Adicional:
                </h4>
                <p className="text-sm whitespace-pre-wrap break-words bg-muted/50 p-2 rounded-md">
                  {purchase.description}
                </p>
              </div>
            </>
          )}

          {purchase.receiptImageUrl && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center">
                    <Receipt className="h-4 w-4 mr-2" />
                    Recibo Adjunto:
                </h4>
                <div className="flex justify-center items-center p-2 border rounded-md bg-muted/20">
                  <Image
                    src={purchase.receiptImageUrl}
                    alt={`Recibo de ${purchase.merchantName}`}
                    width={250}
                    height={350}
                    className="rounded-md object-contain max-h-[300px]"
                    data-ai-hint="receipt document"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
