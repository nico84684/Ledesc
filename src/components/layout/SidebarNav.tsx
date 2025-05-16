"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, Settings as SettingsIcon, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { APP_NAME } from '@/config/constants';
import { MountainSnow } from 'lucide-react';


const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/add-purchase', label: 'Registrar Compra', icon: PlusCircle }, // Separate page for form for better UX
  { href: '/history', label: 'Historial', icon: History },
  { href: '/settings', label: 'Configuración', icon: SettingsIcon },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
         <MountainSnow className="h-7 w-7 text-sidebar-primary" />
         <span className="text-xl font-semibold text-sidebar-foreground">{APP_NAME}</span>
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
        <p className="text-xs text-sidebar-muted-foreground">© {new Date().getFullYear()} {APP_NAME}</p>
      </div> */}
    </nav>
  );
}
