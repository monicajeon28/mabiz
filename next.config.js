/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    nodeMiddleware: true,
  },

  typescript: { ignoreBuildErrors: true },

  images: {
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Windows NTFS rename race condition → prod은 캐시 끔, dev는 메모리 캐시 사용
  webpack: (config, { dev }) => {
    config.cache = dev ? { type: 'memory' } : false;
    return config;
  },

  generateEtags: true,
  poweredByHeader: false,
  compress: true,

  headers: async () => [
    {
      source: '/api/:path*',
      headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
    },
    {
      // HTML/RSC 제외하고 정적 번들만 장기 캐시
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
};

module.exports = nextConfig;
