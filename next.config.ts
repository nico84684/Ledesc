
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const pwaConfig = {
  dest: 'public',
  disable: false, // Habilitar PWA incluso en desarrollo para pruebas en Firebase Studio
  register: true, // Registra el service worker
  skipWaiting: true, // Instala el nuevo SW inmediatamente
  cacheOnFrontEndNav: true, // Cachea navegaciones del lado del cliente (App Router)
  aggressiveFrontEndNavCaching: true, // Cacheo agresivo de navegaciones (App Router)
  reloadOnOnline: true, // Recarga la página cuando se recupera la conexión
  swcMinify: true, // Habilitar minificación con SWC
  icons: [ // Especificación explícita de los íconos para el manifest.json
    {
      src: '/images/ledesc-icon.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable', // 'any' o 'maskable' o 'any maskable'
    },
    {
      src: '/images/ledesc-icon.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
  workboxOptions: {
    disableDevLogs: true, // Deshabilita logs de Workbox en producción
    runtimeCaching: [
      {
        // Cachear imágenes de placehold.co
        // Se usa CacheFirst porque estas imágenes de placeholder no cambian.
        urlPattern: /^https:\/\/placehold\.co\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'placeholder-images',
          expiration: {
            maxEntries: 200, // Puede haber muchos recibos
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
          },
        },
      },
      {
        // Cachear las páginas HTML/documentos de navegación.
        // NetworkFirst asegura que el usuario obtenga la versión más reciente si está online,
        // pero sirve desde caché si está offline o la red es lenta.
        urlPattern: ({ request }) => request.destination === 'document',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache-v2', // Modificado para intentar forzar actualización de SW
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
          },
          networkTimeoutSeconds: 3, // Intenta la red por 3 segundos, luego usa caché
        },
      },
      // Las fuentes de Google (si se usan directamente) o fuentes auto-alojadas por next/font
      // se pueden cachear aquí también. next/font ya optimiza esto bastante bien.
      {
        urlPattern: /\.(?:woff|woff2|eot|ttf|otf)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Año
          },
        },
      },
      // NUEVAS REGLAS para el ícono principal y el manifest
      {
        urlPattern: /\/images\/ledesc-icon\.(?:png|ico|svg)$/i, // Cachear el icono principal
        handler: 'NetworkFirst', // Priorizar la red para obtener la versión más reciente
        options: {
          cacheName: 'app-main-icon-cache',
          expiration: {
            maxEntries: 5, 
            maxAgeSeconds: 1 * 24 * 60 * 60, // 1 Día (actualizaciones más frecuentes)
          },
          networkTimeoutSeconds: 2, // Intentar red por 2 segundos, luego caché
        },
      },
      {
        urlPattern: /\/manifest\.(?:json|webmanifest)$/i, // Cachear el manifest
        handler: 'NetworkFirst', // Priorizar la red
        options: {
          cacheName: 'app-manifest-cache',
          expiration: {
            maxEntries: 2, 
            maxAgeSeconds: 12 * 60 * 60, // 12 Horas (actualizaciones más frecuentes)
          },
          networkTimeoutSeconds: 2,
        },
      },
    ],
  },
};

const withPWA = withPWAInit(pwaConfig);

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true, // Mantenemos esto por ahora, según diagnóstico previo.
  },
};

export default withPWA(nextConfig);
