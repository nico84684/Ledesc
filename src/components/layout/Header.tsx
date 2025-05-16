import Link from 'next/link';
import Image from 'next/image';
import { APP_NAME } from '@/config/constants'; // Sigue siendo útil para aria-label si APP_NAME se actualiza
import { SidebarTrigger } from '@/components/ui/sidebar';

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <SidebarTrigger />
      </div>
      <Link href="/" className="flex items-center" aria-label={`${APP_NAME} homepage`}>
        <Image src="/images/ledesma-logo.png" alt="Ledesma Logo" width={143} height={30} priority />
        {/* El nombre APP_NAME ya no se muestra aquí porque está en el logo */}
      </Link>
      {/* Future: User menu or other header items can go here */}
    </header>
  );
}
