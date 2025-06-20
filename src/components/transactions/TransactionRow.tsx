
"use client";

import React from 'react';
import type { Purchase } from '@/types';
import type { User } from 'firebase/auth';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Edit3, Trash2, Loader2 } from 'lucide-react';
import { formatCurrencyARS, formatDateSafe } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TransactionRowProps {
  purchase: Purchase;
  onDetailsClick: (purchase: Purchase) => void;
  onEditClick: (purchase: Purchase) => void;
  onDeleteClick: (purchase: Purchase) => void;
  isDeleting: boolean;
  selectedPurchaseForDeleteId: string | null;
  user: User | null;
  cellPadding?: string;
}

const TransactionRowComponent: React.FC<TransactionRowProps> = ({
  purchase,
  onDetailsClick,
  onEditClick,
  onDeleteClick,
  isDeleting,
  selectedPurchaseForDeleteId,
  user,
  cellPadding = "px-1 py-2 sm:px-2 sm:py-3",
}) => {
  return (
    <TableRow key={purchase.id} className="text-xxs sm:text-sm">
      <TableCell className={cellPadding}>
        <span className="hidden sm:inline">{formatDateSafe(purchase.date, 'dd MMM yy')}</span>
        <span className="sm:hidden">{formatDateSafe(purchase.date, 'dd/MM/yy')}</span>
      </TableCell>
      <TableCell className={cn("font-medium", cellPadding)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate block max-w-[40px] xs:max-w-[60px] sm:max-w-[150px] cursor-default">
              {purchase.merchantName}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            <p className="max-w-xs whitespace-normal break-words">{purchase.merchantName}</p>
            {purchase.merchantLocation && <p className="text-xs text-muted-foreground">{purchase.merchantLocation}</p>}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className={cn("text-right whitespace-nowrap", cellPadding)}>{formatCurrencyARS(purchase.amount)}</TableCell>
      <TableCell className={cn("text-right text-green-600 dark:text-green-400 whitespace-nowrap", cellPadding)}>-{formatCurrencyARS(purchase.discountApplied)}</TableCell>
      <TableCell className={cn("text-right font-semibold whitespace-nowrap", cellPadding)}>{formatCurrencyARS(purchase.finalAmount)}</TableCell>
      <TableCell className={cn("text-center", cellPadding)}>
        <div className="flex items-center justify-center space-x-0 md:space-x-px">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => onDetailsClick(purchase)}>
                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Ver Detalles</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => onEditClick(purchase)} disabled={!user}>
                <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Editar Compra</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:text-destructive"
                onClick={() => onDeleteClick(purchase)}
                disabled={isDeleting && selectedPurchaseForDeleteId === purchase.id || !user}
              >
                {isDeleting && selectedPurchaseForDeleteId === purchase.id ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Eliminar Compra</p></TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const TransactionRow = React.memo(TransactionRowComponent);
