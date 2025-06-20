
import type { NextConfig } from 'next';
// import withPWAInit from '@ducanh2912/next-pwa'; // Deshabilitado temporalmente
import path from 'path'; // Import path

const nextConfig: NextConfig = {
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

// export default withPWA(nextConfig); // Deshabilitado temporalmente
export default nextConfig;
