import Link from 'next/link';
import { APP_NAME } from '@/config/constants';
import { SidebarTrigger } from '@/components/ui/sidebar'; 
import { MountainSnow } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <SidebarTrigger />
      </div>
      <Link href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} homepage`}>
        <MountainSnow className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold text-foreground">{APP_NAME}</span>
      </Link>
      {/* Future: User menu or other header items can go here */}
    </header>
  );
}
