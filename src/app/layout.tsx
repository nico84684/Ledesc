import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google'; // Using Inter as a clean sans-serif
import './globals.css';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { APP_NAME } from '@/config/constants';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-geist-sans', // Keep variable name for compatibility if geist was intended
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Gestiona tus beneficios gastronómicos de forma sencilla.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          fontSans.variable
        )}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
