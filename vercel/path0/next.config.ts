
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
import path from 'path'; // Import path

// Define the runtimeCaching configuration with explicit types for its content
const runtimeCachingEntries = [
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
    urlPattern: /\/images\/icono-alta512\.png$/i, // Específico para icono-alta512.png en la carpeta public/images
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

const pwaConfig = {
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Deshabilitar PWA en desarrollo
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: runtimeCachingEntries,
  },
  manifest: {
    name: 'LEDESC',
    short_name: 'LEDESC',
    description: 'Gestiona tus beneficios gastronómicos de forma sencilla.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0F4F5',
    theme_color: '#73A8B8',
    icons: [
      {
        src: '/images/icono-alta512.png', // Ruta actualizada a public/images
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/images/icono-alta512.png', // Ruta actualizada a public/images
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  },
};

const withPWA = withPWAInit(pwaConfig);

const baseNextConfig: NextConfig = {
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
    unoptimized: true,
  },
  webpack: (config, options) => {
    // Add the @ alias explicitly
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    // Important: return the modified config
    return config;
  },
};

export default withPWA(baseNextConfig);
