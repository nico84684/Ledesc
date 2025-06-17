
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, History, Settings as SettingsIcon, PlusCircle, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar, 
} from '@/components/ui/sidebar';
import { APP_NAME } from '@/config/constants'; 

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/add-purchase', label: 'Registrar Compra', icon: PlusCircle },
  { href: '/history', label: 'Historial', icon: History },
  { href: '/merchants', label: 'Comercios', icon: Store }, // Nuevo ítem
  { href: '/settings', label: 'Configuración', icon: SettingsIcon },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar(); 

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false); 
    }
  };

  return (
    <nav className="flex flex-col h-full">
      <div className="flex items-center justify-center px-4 py-4 border-b border-sidebar-border h-16">
         <Link href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} homepage`} onClick={handleLinkClick}>
            <Image 
              src="/icono-alta512.png" 
              alt="LEDESC Icon" 
              width={32} 
              height={32} 
              data-ai-hint="logo abstract"
              className="h-8 w-8"
            />
            <span 
              style={{ color: '#2f4c92', fontFamily: 'Avenir Heavy, Helvetica, Arial, sans-serif', fontWeight: 900 }} 
              className="text-xl"
            >
              {APP_NAME}
            </span>
          </Link>
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
                <Link 
                  href={item.href} 
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={handleLinkClick} 
                >
                  <item.icon className="mr-2 h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
    </nav>
  );
}
