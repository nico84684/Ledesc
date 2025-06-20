
"use client";

import { useState, useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import type { Purchase } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FilterX, CalendarDays, Store, Tag, Loader2 } from 'lucide-react'; 
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Label } from '@/components/ui/label';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditPurchaseDialog } from '@/components/purchases/EditPurchaseDialog';
import { TransactionDetailsDialog } from './TransactionDetailsDialog'; 
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrencyARS, formatDateSafe } from '@/lib/utils';
import { TransactionRow } from './TransactionRow'; // Import the new component
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deletePurchaseAction } from '@/lib/actions';
import { useAuth } from '@/components/layout/Providers';

const ITEMS_PER_PAGE = 10;
const ALL_MONTHS_FILTER_VALUE = "__ALL_MONTHS__"; 

export function TransactionHistoryTable() {
  const { purchases, settings } = useAppState();
  const { exportToCSV, isInitialized, deletePurchase: deletePurchaseFromStoreAndFirestore } = useAppDispatch();
  const { user } = useAuth();
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
  const [selectedPurchaseForDelete, setSelectedPurchaseForDelete] = useState<Purchase | null>(null);


  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    purchases.forEach(p => {
      try {
        months.add(format(parseISO(p.date), 'yyyy-MM'));
      } catch (error) {
        console.warn(`Invalid date format for purchase ID ${p.id}: ${p.date}`);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [purchases]);


  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      let purchaseDate;
      try {
        purchaseDate = parseISO(p.date);
        if (isNaN(purchaseDate.getTime())) throw new Error('Invalid date');
      } catch {
        return false; // Skip invalid date entries
      }
      const matchesMonth = filterMonth ? format(purchaseDate, 'yyyy-MM') === filterMonth : true;
      const matchesMerchant = filterMerchant ? p.merchantName.toLowerCase().includes(filterMerchant.toLowerCase()) : true;
      const matchesAmount = filterAmount ? p.finalAmount >= parseFloat(filterAmount) : true;
      return matchesMonth && matchesMerchant && matchesAmount;
    }).sort((a, b) => {
        try {
            return parseISO(b.date).getTime() - parseISO(a.date).getTime();
        } catch {
            return 0;
        }
    });
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
  
  const handleEditClick = (purchase: Purchase) => {
    if (!user) {
        toast({title: "Acción no permitida", description: "Debes iniciar sesión para editar compras.", variant: "destructive"});
        return;
    }
    setSelectedPurchaseForEdit(purchase);
    setIsEditDialogOpen(true);
  };
  
  const handleDetailsClick = (purchase: Purchase) => {
    setSelectedPurchaseForDetails(purchase);
    setIsDetailsDialogOpen(true);
  };

  const handleDeleteClick = (purchase: Purchase) => {
    if (!user) {
        toast({title: "Acción no permitida", description: "Debes iniciar sesión para eliminar compras.", variant: "destructive"});
        return;
    }
    setSelectedPurchaseForDelete(purchase);
  };

  const confirmDeletePurchase = async () => {
    if (!selectedPurchaseForDelete || !user || !user.uid) {
        toast({title: "Error", description: "No se seleccionó compra o usuario no autenticado.", variant: "destructive"});
        return;
    }
    const purchaseIdToDelete = selectedPurchaseForDelete.id;
    setIsDeleting(true);
    try {
      const result = await deletePurchaseAction(user.uid, purchaseIdToDelete);
      if (result.success) {
        await deletePurchaseFromStoreAndFirestore(purchaseIdToDelete); 
        toast({ title: "Eliminación Exitosa", description: result.message });
      } else {
        toast({ title: "Error al Eliminar", description: result.message || "No se pudo eliminar la compra.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error(`[TransactionHistoryTable] Error deleting purchase ID ${purchaseIdToDelete}:`, error);
      toast({ title: "Error Inesperado", description: `Ocurrió un error al intentar eliminar la compra: ${error.message}`, variant: "destructive" });
    } finally {
      setSelectedPurchaseForDelete(null);
      setIsDeleting(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-muted-foreground">Cargando transacciones desde la nube...</p>
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
                  {formatDateSafe(`${month}-01`, 'MMMM yyyy', es)}
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
          <Button onClick={exportToCSV} className="w-full sm:w-auto" disabled={!user}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      {paginatedPurchases.length === 0 ? (
        <div className="text-center py-10">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            { user ? "No se encontraron transacciones." : "Inicia sesión para ver tus transacciones."}
          </p>
          <p className="text-sm text-muted-foreground">
           { user ? "Intenta ajustar los filtros o registra una nueva compra." : "Tus datos se guardan en la nube de forma segura."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableCaption>
              Mostrando {paginatedPurchases.length} de {filteredPurchases.length} transacciones.
              {settings && ` Descuento aplicado: ${settings.discountPercentage}%.`}
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
                <TransactionRow
                  key={purchase.id}
                  purchase={purchase}
                  onDetailsClick={handleDetailsClick}
                  onEditClick={handleEditClick}
                  onDeleteClick={handleDeleteClick}
                  isDeleting={isDeleting}
                  selectedPurchaseForDeleteId={selectedPurchaseForDelete ? selectedPurchaseForDelete.id : null}
                  user={user}
                  cellPadding={cellPadding}
                />
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
      
      {selectedPurchaseForDelete && (
        <AlertDialog open={!!selectedPurchaseForDelete} onOpenChange={(open) => { if (!open) setSelectedPurchaseForDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta compra?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La compra realizada el {formatDateSafe(selectedPurchaseForDelete.date, "dd 'de' MMMM 'de' yyyy")} por {formatCurrencyARS(selectedPurchaseForDelete.amount)} en "{selectedPurchaseForDelete.merchantName}" será eliminada permanentemente de la nube.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedPurchaseForDelete(null)} disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePurchase} disabled={isDeleting} className={buttonVariants({ variant: "destructive" })}>
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
    </TooltipProvider>
  );
}
