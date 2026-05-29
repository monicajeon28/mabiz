/** @type {import('next').NextConfig} */

const nextConfig = {
  typescript: { ignoreBuildErrors: true },

  images: {
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // dev/prod 모두 webpack 파일시스템 캐시 비활성화
  // Windows NTFS에서 rename race condition 방지 (dev 포함)
  webpack: (config) => {
    config.cache = false;
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
