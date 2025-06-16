
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
// Tipos PluginOptions y RuntimeCaching eliminados de la importación directa

// Define the runtimeCaching configuration with explicit types for its content
const runtimeCachingEntries = [ // Ya no se anota explícitamente como RuntimeCaching[] aquí
  {
    urlPattern: /^https:\/\/placehold\.co\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'placeholder-images',
      expiration: {
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
      },
    },
  },
  {
    urlPattern: ({ request }: { request: Request }) => request.destination === 'document',
    handler: 'NetworkFirst' as const,
    options: {
      cacheName: 'pages-cache-v3',
      expiration: {
        maxEntries: 30,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
      },
      networkTimeoutSeconds: 3,
    },
  },
  {
    urlPattern: /\.(?:woff|woff2|eot|ttf|otf)$/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'fonts-cache',
      expiration: {
        maxEntries: 10,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Año
      },
    },
  },
  {
    urlPattern: /\/icono-alta512\.png$/i, // Específico para icono-alta512.png
    handler: 'NetworkFirst' as const,
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
    handler: 'NetworkFirst' as const,
    options: {
      cacheName: 'app-manifest-cache',
      expiration: {
        maxEntries: 2,
        maxAgeSeconds: 12 * 60 * 60, // 12 Horas
      },
      networkTimeoutSeconds: 2,
    },
  },
];

const pwaConfig = { // Ya no se anota explícitamente como PluginOptions aquí
  dest: 'public',
  disable: false, // Habilitar PWA incluso en desarrollo para pruebas en Firebase Studio
  register: true, // Registra el service worker
  skipWaiting: true, // Instala el nuevo SW inmediatamente
  cacheOnFrontEndNav: true, // Cachea navegaciones del lado del cliente (App Router)
  aggressiveFrontEndNavCaching: true, // Cacheo agresivo de navegaciones (App Router)
  reloadOnOnline: true, // Recarga la página cuando se recupera la conexión
  swcMinify: true, // Habilitar minificación con SWC
  manifest: { // Configuración explícita del manifiesto
    name: 'LEDESC',
    short_name: 'LEDESC',
    description: 'Gestiona tus beneficios gastronómicos de forma sencilla.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0F4F5', // Corresponde a --background en globals.css
    theme_color: '#73A8B8',     // Corresponde a --primary en globals.css y meta theme-color
    icons: [
      {
        src: '/icono-alta512.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icono-alta512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  },
  workboxOptions: {
    disableDevLogs: true, // Deshabilita logs de Workbox en producción
    runtimeCaching: runtimeCachingEntries,
  },
};

const withPWA = withPWAInit(pwaConfig);

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
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
    unoptimized: true, // Generalmente recomendado para PWAs para evitar problemas con next/image y SW
  },
};

export default withPWA(nextConfig);
