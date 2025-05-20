
"use client";

import type { ReactNode } from 'react';
// SessionProvider ya no es necesario aquí si solo usamos Firebase Auth para el login
// import { SessionProvider } from "next-auth/react"; 

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Si tienes otros proveedores de contexto global, pueden ir aquí.
  // Por ahora, solo devolvemos children ya que SessionProvider fue removido.
  return <>{children}</>;
}
