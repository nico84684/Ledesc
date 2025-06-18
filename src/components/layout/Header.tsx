
import Link from 'next/link';
import Image from 'next/image';
import { APP_NAME } from '@/config/constants';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AuthButton } from '@/components/auth/AuthComponents';
import { ThemeToggleButton } from './ThemeToggleButton';

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <SidebarTrigger />
      </div>
      <Link href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} homepage`}>
        <Image
          src="/images/icono-alta512.png"
          alt="LEDESC Icon"
          width={32}
          height={32}
          data-ai-hint="logo abstract"
        />
        <span
          style={{ color: '#2f4c92', fontFamily: 'Avenir Heavy, Helvetica, Arial, sans-serif', fontWeight: 900 }}
          className="text-xl px-3 py-1 rounded-lg bg-gradient-to-r from-white/50 via-white/20 to-white/0 dark:from-slate-100/60 dark:via-slate-100/30 dark:to-slate-100/0"
        >
          {APP_NAME}
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggleButton />
        <AuthButton />
      </div>
    </header>
  );
}

