
"use client";

import { useState, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import type { Purchase } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FilterX, CalendarDays, Store, Tag, Edit3, Trash2, Eye } from 'lucide-react'; 
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

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
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditPurchaseDialog } from '@/components/purchases/EditPurchaseDialog';
import { TransactionDetailsDialog } from './TransactionDetailsDialog'; 
import { deletePurchaseAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;
const ALL_MONTHS_FILTER_VALUE = "__ALL_MONTHS__"; 

export function TransactionHistoryTable() {
  const { purchases, settings } = useAppState();
  const { exportToCSV, isInitialized, deletePurchase: deletePurchaseFromStore } = useAppDispatch();
  const { toast } = useToast();
  
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterMerchant, setFilterMerchant] = useState<string>('');
  const [filterAmount, setFilterAmount] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<Purchase | null>(null);
  
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedPurchaseForDetails, setSelectedPurchaseForDetails] = useState<Purchase | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);


  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    purchases.forEach(p => months.add(format(parseISO(p.date), 'yyyy-MM')));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [purchases]);


  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const purchaseDate = parseISO(p.date);
      const matchesMonth = filterMonth ? format(purchaseDate, 'yyyy-MM') === filterMonth : true;
      const matchesMerchant = filterMerchant ? p.merchantName.toLowerCase().includes(filterMerchant.toLowerCase()) : true;
      const matchesAmount = filterAmount ? p.finalAmount >= parseFloat(filterAmount) : true;
      return matchesMonth && matchesMerchant && matchesAmount;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [purchases, filterMonth, filterMerchant, filterAmount]);

  const paginatedPurchases = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPurchases.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPurchases, currentPage]);

  const totalPages = Math.ceil(filteredPurchases.length / ITEMS_PER_PAGE);

  const clearFilters = () => {
    setFilterMonth('');
    setFilterMerchant('');
    setFilterAmount('');
    setCurrentPage(1);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  const handleEditClick = (purchase: Purchase) => {
    setSelectedPurchaseForEdit(purchase);
    setIsEditDialogOpen(true);
  };
  
  const handleDetailsClick = (purchase: Purchase) => {
    setSelectedPurchaseForDetails(purchase);
    setIsDetailsDialogOpen(true);
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    setIsDeleting(true);
    try {
      const result = await deletePurchaseAction(purchaseId);
      if (result.success) {
        deletePurchaseFromStore(purchaseId);
        toast({ title: "Éxito", description: result.message });
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error Inesperado", description: "No se pudo eliminar la compra.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };


  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-muted-foreground">Cargando transacciones...</p>
      </div>
    );
  }

  const cellPadding = "px-1 py-2 sm:px-2 sm:py-3";
  const headPadding = "px-1 py-2 sm:px-2 sm:py-3 h-auto md:h-10";

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 p-2 sm:p-4 border rounded-lg shadow-sm bg-card">
        <div>
          <Label htmlFor="filter-month" className="text-sm font-medium">Mes</Label>
          <Select
            value={filterMonth === "" ? ALL_MONTHS_FILTER_VALUE : filterMonth}
            onValueChange={(value) => {
              setFilterMonth(value === ALL_MONTHS_FILTER_VALUE ? "" : value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger id="filter-month">
              <SelectValue placeholder="Todos los meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MONTHS_FILTER_VALUE}>Todos los meses</SelectItem>
              {uniqueMonths.map(month => (
                <SelectItem key={month} value={month}>
                  {format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: es })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-merchant" className="text-sm font-medium">Comercio</Label>
          <Input
            id="filter-merchant"
            placeholder="Buscar por comercio..."
            value={filterMerchant}
            onChange={e => {
              setFilterMerchant(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div>
          <Label htmlFor="filter-amount" className="text-sm font-medium">Monto Mínimo (Final)</Label>
          <Input
            id="filter-amount"
            type="number"
            placeholder="Ej: 1000"
            value={filterAmount}
            onChange={e => {
              setFilterAmount(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
          <Button onClick={clearFilters} variant="outline" className="w-full sm:w-auto">
            <FilterX className="mr-2 h-4 w-4" /> Limpiar
          </Button>
          <Button onClick={exportToCSV} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      {paginatedPurchases.length === 0 ? (
        <div className="text-center py-10">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">No se encontraron transacciones.</p>
          <p className="text-sm text-muted-foreground">Intenta ajustar los filtros o registra una nueva compra.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableCaption>
              Mostrando {paginatedPurchases.length} de {filteredPurchases.length} transacciones.
              Descuento aplicado: {settings.discountPercentage}%.
            </TableCaption>
            <TableHeader>
              <TableRow className="text-xxs sm:text-sm">
                <TableHead className={cn("min-w-[65px] w-[75px]", headPadding)}>
                  <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left">
                    <CalendarDays className="h-4 w-4 md:mr-1 mb-0.5 md:mb-0" />
                    <span>Fecha</span>
                  </div>
                </TableHead>
                <TableHead className={headPadding}>
                  <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left">
                    <Store className="h-4 w-4 md:mr-1 mb-0.5 md:mb-0" />
                    <span>Comercio</span>
                  </div>
                </TableHead>
                <TableHead className={cn("text-right", headPadding)}>
                  <span className="hidden sm:inline">Monto Original</span>
                  <span className="sm:hidden">Original</span>
                </TableHead>
                <TableHead className={cn("text-right", headPadding)}>
                  <span className="hidden sm:inline">Descuento</span>
                  <span className="sm:hidden">Desc.</span>
                </TableHead>
                <TableHead className={cn("text-right font-semibold", headPadding)}>
                   <span className="hidden sm:inline">Monto Final</span>
                   <span className="sm:hidden">Final</span>
                </TableHead>
                <TableHead className={cn("text-center w-[90px] sm:w-[110px]", headPadding)}>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPurchases.map((purchase) => (
                <TableRow key={purchase.id} className="text-xxs sm:text-sm">
                  <TableCell className={cellPadding}>
                    <span className="hidden sm:inline">{format(parseISO(purchase.date), 'dd MMM yy', { locale: es })}</span>
                    <span className="sm:hidden">{format(parseISO(purchase.date), 'dd/MM/yy', { locale: es })}</span>
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
                  <TableCell className={cn("text-right whitespace-nowrap", cellPadding)}>{formatCurrency(purchase.amount)}</TableCell>
                  <TableCell className={cn("text-right text-green-600 dark:text-green-400 whitespace-nowrap", cellPadding)}>-{formatCurrency(purchase.discountApplied)}</TableCell>
                  <TableCell className={cn("text-right font-semibold whitespace-nowrap", cellPadding)}>{formatCurrency(purchase.finalAmount)}</TableCell>
                  <TableCell className={cn("text-center", cellPadding)}>
                    <div className="flex items-center justify-center space-x-0 md:space-x-px">
                       <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => handleDetailsClick(purchase)}>
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ver Detalles</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => handleEditClick(purchase)}>
                            <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Editar Compra</p>
                        </TooltipContent>
                      </Tooltip>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Eliminar Compra</p>
                            </TooltipContent>
                          </Tooltip>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente la compra de
                              "{purchase.merchantName}" por {formatCurrency(purchase.finalAmount)} del {format(parseISO(purchase.date), 'dd/MM/yyyy')}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePurchase(purchase.id)}
                              disabled={isDeleting}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              {isDeleting ? <LoadingSpinner size={16} className="mr-2" /> : null}
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {selectedPurchaseForEdit && (
        <EditPurchaseDialog
          purchase={selectedPurchaseForEdit}
          isOpen={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedPurchaseForEdit(null);
          }}
        />
      )}

      {selectedPurchaseForDetails && (
        <TransactionDetailsDialog
          purchase={selectedPurchaseForDetails}
          isOpen={isDetailsDialogOpen}
          onOpenChange={(open) => {
            setIsDetailsDialogOpen(open);
            if (!open) setSelectedPurchaseForDetails(null);
          }}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
