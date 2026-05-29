/** @type {import('next').NextConfig} */

const nextConfig = {
  // TypeScript 빌드 에러 무시 (타입 체크는 별도로 수행)
  typescript: {
    ignoreBuildErrors: true,
  },
  // 개발 환경 최적화
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      // 개발 환경에서 불필요한 플러그인 제거
      config.optimization = {
        ...config.optimization,
        minimize: false, // 개발에서 최소화 안 함 (빠른 피드백)
        usedExports: false,
      };
    }

    return config;
  },

  // 이미지 최적화
  images: {
    unoptimized: process.env.NODE_ENV === 'development', // dev에서 이미지 최적화 스킵
  },

  // 레거시 피어 의존성 경고 무시
  onDemandEntries: {
    // 메모리 효율성
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // 프로덕션 최적화
  productionBrowserSourceMaps: process.env.NODE_ENV === 'production',
  generateEtags: true,
  poweredByHeader: false,
  compress: true,

  // 캐시 헤더 — API 경로 제외, 정적 에셋만 적용
  headers: async () => {
    return [
      {
        // /api/* 는 절대 CDN 캐시 안 함 (동적 데이터)
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
      {
        // 정적 에셋만 장기 캐시
        source: '/((?!api/).*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;
