
import type { Metadata, Viewport } from 'next';
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
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: 'Gestiona tus beneficios gastronómicos de forma sencilla.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/images/icono-alta512.png', type: 'image/png', sizes: '512x512' },
      { url: '/images/icono-alta512.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/images/icono-alta512.png', sizes: '512x512' },
      { url: '/images/icono-alta512.png', sizes: '192x192' },
    ],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#73A8B8', // Color principal de la app para la barra de estado del navegador
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* La etiqueta <head> ya no se renderiza manualmente aquí.
          Next.js la construirá basándose en el objeto metadata
          y cualquier elemento <head> de páginas/layouts hijos.
      */}
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
