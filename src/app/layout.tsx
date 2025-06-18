
import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import '@/app/globals.css'; // Usar alias para la importación
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { APP_NAME } from '@/config/constants';
import { Providers } from '@/components/layout/Providers';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
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
      <head>
        <meta name="application-name" content={APP_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" /> {/* Asumiendo que tendrás este archivo en public/icons/ */}
        <meta name="msapplication-TileColor" content="#73A8B8" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#73A8B8" />

        {/* Favicon general para navegadores, apuntando a public/images/ */}
        <link rel="icon" href="/images/icono-alta512.png" type="image/png" />

        {/* Iconos para Apple, apuntando a public/images/ */}
        <link rel="apple-touch-icon" href="/images/icono-alta512.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/images/icono-alta512.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/images/icono-alta512.png" />
        
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          fontSans.variable
        )}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
