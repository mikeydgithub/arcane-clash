
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
  allowedDevOrigins: ['9003-firebase-studio-1748017165323.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev']
};

export default nextConfig;
