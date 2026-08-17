import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // TypeScript check enabled
  typescript: {
    ignoreBuildErrors: false,
  },

  // Empêche le bundling de packages ESM sensibles côté serveur
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa'],

  // Set Turbopack root directory
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Environment variables
  env: {
    APP_URL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tasks.leouiparfait.com',
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tasks.leouiparfait.com',
      },
    ],
  },
};

export default nextConfig;
