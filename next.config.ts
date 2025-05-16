import type {NextConfig} from 'next';

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
  // Experimental PWA support - not fully mature in Next.js App Router yet without custom setup
  // For more robust PWA features like offline support, consider using a package like next-pwa
  // and a custom server worker. This basic setup enables "Add to Home Screen".
  // output: 'export', // Required for static export if not using a Node.js server, but might affect other features.
                     // Keep default if deploying to Vercel or similar Node.js environments.
};

export default nextConfig;
