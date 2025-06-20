import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, type Locale } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
}

// Helper function to safely parse and format dates, returning a fallback if invalid
export function formatDateSafe(dateString: string | undefined | null, formatPattern: string = 'dd MMM yy', locale: Locale = es): string {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida'; // Check if date is valid
    return format(date, formatPattern, { locale });
  } catch (error) {
    console.warn(`Error parsing date: ${dateString}`, error);
    return 'Error de fecha';
  }
}
