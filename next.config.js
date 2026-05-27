/** @type {import('next').NextConfig} */

const nextConfig = {
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

  // 성능 모니터링 (프로덕션만)
  ...(process.env.NODE_ENV === 'production' && {
    headers: async () => {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
      ];
    },
  }),
};

module.exports = nextConfig;
