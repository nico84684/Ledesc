
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
      purpose: 'any',
    },
    {
      src: '/images/ledesc-icon.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
  ],
  workboxOptions: {
    disableDevLogs: true, // Deshabilita logs de Workbox en producción
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/placehold\.co\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'placeholder-images',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
          },
        },
      },
      {
        urlPattern: ({ request }) => request.destination === 'document',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache-v3', // Nombre de caché modificado para intentar forzar actualización
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
          },
          networkTimeoutSeconds: 3,
        },
      },
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
      {
        urlPattern: /\/images\/ledesc-icon\.(?:png|ico|svg)$/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'app-main-icon-cache',
          expiration: {
            maxEntries: 5, 
            maxAgeSeconds: 1 * 24 * 60 * 60, // 1 Día
          },
          networkTimeoutSeconds: 2,
        },
      },
      {
        urlPattern: /\/manifest\.(?:json|webmanifest)$/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'app-manifest-cache',
          expiration: {
            maxEntries: 2, 
            maxAgeSeconds: 12 * 60 * 60, // 12 Horas
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
    ignoreBuildErrors: false, // Cambiado a false
  },
  eslint: {
    ignoreDuringBuilds: false, // Cambiado a false
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
    unoptimized: true,
  },
};

export default withPWA(nextConfig);
