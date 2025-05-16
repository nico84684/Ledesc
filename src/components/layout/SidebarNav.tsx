"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, History, Settings as SettingsIcon, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
// APP_NAME ya no se usa directamente en el renderizado del logo aquí si el logo lo incluye.

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/add-purchase', label: 'Registrar Compra', icon: PlusCircle },
  { href: '/history', label: 'Historial', icon: History },
  { href: '/settings', label: 'Configuración', icon: SettingsIcon },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full">
      <div className="flex items-center justify-center px-4 py-4 border-b border-sidebar-border h-16">
         {/* Ajusta width/height según el aspecto deseado del logo */}
         <Image src="/images/ledesma-logo.png" alt="Ledesma Logo" width={171} height={36} priority />
      </div>
      <div className="flex-1 py-4">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className={cn(
                  "justify-start",
                  pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
                tooltip={item.label}
              >
                <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                  <item.icon className="mr-2 h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
      {/* Optional: Sidebar Footer */}
      {/* <div className="mt-auto p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-muted-foreground">© {new Date().getFullYear()} APP_NAME_AQUI</p>
      </div> */}
    </nav>
  );
}
