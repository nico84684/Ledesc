
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
          className="text-xl dark:px-2 dark:py-0.5 dark:bg-gradient-to-r dark:from-slate-200/70 dark:via-slate-200/50 dark:to-transparent dark:rounded-md"
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
