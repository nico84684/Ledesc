
import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google'; // Using Inter as a clean sans-serif
import './globals.css';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { APP_NAME } from '@/config/constants';
import { Providers } from '@/components/layout/Providers'; // Importar el nuevo Providers

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-geist-sans', // Keep variable name for compatibility if geist was intended
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Gestiona tus beneficios gastronómicos de forma sencilla.',
  manifest: '/manifest.json', // Added manifest link
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="application-name" content={APP_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#73A8B8" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#73A8B8" />

        <link rel="apple-touch-icon" href="/images/ledesc-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/images/ledesc-icon.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/images/ledesc-icon.png" />
        
        {/* Add more icon sizes for apple-touch-icon if needed */}
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          fontSans.variable
        )}
      >
        <Providers> {/* Usar el componente Providers para envolver AppShell */}
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
