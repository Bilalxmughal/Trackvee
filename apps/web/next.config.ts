import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.trackvee.com/api/:path*',
      },
    ];
  },
};

export default nextConfig;
