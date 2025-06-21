
"use client"; // Asegura que AppShell y sus contextos se ejecuten en el cliente

import type { ReactNode } from 'react';
import { Header } from './Header';
import { SidebarNav } from './SidebarNav';
import { Toaster } from "@/components/ui/toaster";
import { AppProvider } from '@/lib/store';
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';


interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AppProvider>
      <SidebarProvider>
        <Sidebar variant="sidebar" collapsible="icon" side="left">
          <SidebarNav />
        </Sidebar>
        <SidebarInset>
          <Header />
          <main className="flex-1 p-4 md:p-6 lg:p-8 bg-background">
            {children}
          </main>
          <Toaster />
        </SidebarInset>
      </SidebarProvider>
    </AppProvider>
  );
}
