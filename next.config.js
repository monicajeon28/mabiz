/** @type {import('next').NextConfig} */

const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }, // ESLint는 CI lint 단계에서 별도 실행
  experimental: {
    middlewareClientMaxBodySize: 100 * 1024 * 1024,
  },

  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.googleapis.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'cruisedot.co.kr' },
      { protocol: 'https', hostname: 'mabizcruisedot.com' },
    ],
  },

  generateEtags: true,
  poweredByHeader: false,
  compress: true,

  headers: async () => [
    {
      // 보안 헤더 — 모든 응답에 적용
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
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

  async redirects() {
    return [
      {
        source: '/b2b-editor',
        destination: '/landing-pages',
        permanent: true,
      },
      {
        source: '/b2b-editor/:path*',
        destination: '/landing-pages',
        permanent: true,
      },
      {
        source: '/b2b-landing/:path*',
        destination: '/landing-pages/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
