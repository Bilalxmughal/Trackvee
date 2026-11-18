import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://2.31.172.140/api/:path*',
      },
    ];
  },
};

export default nextConfig;
