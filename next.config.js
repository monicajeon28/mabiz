/** @type {import('next').NextConfig} */

const nextConfig = {
  // API bodyParser 크기 제한 설정
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }, // ESLint는 CI lint 단계에서 별도 실행

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
      source: '/api/:path*',
      headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
    },
    {
      // HTML/RSC 제외하고 정적 번들만 장기 캐시
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      // Google Fonts CSS 변동 가능성 있음 (30일 캐시)
      source: 'https://fonts.googleapis.com/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
    },
    {
      // Google Fonts 웹폰트 파일 (변경 없음, 1년 캐시)
      source: 'https://fonts.gstatic.com/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
};

module.exports = nextConfig;
