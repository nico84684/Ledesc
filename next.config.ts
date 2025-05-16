import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const pwaConfig = {
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Deshabilita PWA en desarrollo
  register: true, // Registra el service worker
  skipWaiting: true, // Instala el nuevo SW inmediatamente
  cacheOnFrontEndNav: true, // Cachea navegaciones del lado del cliente (App Router)
  aggressiveFrontEndNavCaching: true, // Cacheo agresivo de navegaciones (App Router)
  reloadOnOnline: true, // Recarga la página cuando se recupera la conexión
  swcMinify: true, // Habilitar minificación con SWC
  workboxOptions: {
    disableDevLogs: true, // Deshabilita logs de Workbox en producción
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
  },
  // El soporte PWA ahora se maneja con @ducanh2912/next-pwa
};

export default withPWA(nextConfig);
