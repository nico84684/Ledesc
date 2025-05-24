
"use client";

import { useState, useMemo } from 'react';
import { useAppState } from '@/lib/store';
import type { Merchant } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store, Search, Info } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAppDispatch } from '@/lib/store';

const ITEMS_PER_PAGE = 10;

export function MerchantListTable() {
  const { merchants } = useAppState();
  const { isInitialized } = useAppDispatch(); // Para saber si el store está listo
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredMerchants = useMemo(() => {
    return merchants.filter(merchant =>
      merchant.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name)); // Asegurar orden alfabético
  }, [merchants, searchTerm]);

  const paginatedMerchants = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMerchants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMerchants, currentPage]);

  const totalPages = Math.ceil(filteredMerchants.length / ITEMS_PER_PAGE);

  if (!isInitialized) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Store className="h-5 w-5 text-primary" />
            Lista de Comercios Adheridos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <LoadingSpinner size={32} />
          <p className="ml-2 text-muted-foreground">Cargando comercios...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Store className="h-5 w-5 text-primary" />
          Lista de Comercios Adheridos
        </CardTitle>
        <CardDescription>
          Busca y visualiza los comercios donde puedes usar tu beneficio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar comercio por nombre..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8 w-full"
          />
        </div>

        {filteredMerchants.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Info className="mx-auto h-10 w-10 mb-2" />
            <p className="font-medium">No se encontraron comercios.</p>
            <p className="text-sm">
              {searchTerm ? "Intenta con otro término de búsqueda." : "Registra compras o añade comercios manualmente."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableCaption>
                Mostrando {paginatedMerchants.length} de {filteredMerchants.length} comercios.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID (Interno)</TableHead>
                  <TableHead>Nombre del Comercio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMerchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell className="font-mono text-xs opacity-75 truncate" title={merchant.id}>
                      {merchant.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-medium">{merchant.name}</TableCell>
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
      </CardContent>
    </Card>
  );
}
