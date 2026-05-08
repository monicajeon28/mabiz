/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1️⃣ 이미지 최적화
  images: {
    formats: ['image/avif', 'image/webp'],  // 최신 형식 우선
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // 2️⃣ Turbopack 설정 (Next.js 16 기본)
  turbopack: {},

  // 2️⃣ 번들 분석 (선택사항)
  // 번들 크기를 보고 싶으면: ANALYZE=true npm run build
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: isServer ? '../bundles/server.html' : 'bundles/client.html',
        })
      );
    }
    return config;
  },

  // 3️⃣ 성능 최적화
  // swcMinify는 Next.js 16에서 deprecated (Turbopack이 자동 처리)
  compress: true,   // gzip 압축

  // 4️⃣ ISR (증분 정적 재생성)
  // 자주 바뀌지 않는 페이지는 캐시
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,   // 60초
    pagesBufferLength: 5,         // 미리 로드할 페이지 수
  },

  // 5️⃣ 환경변수 (클라이언트에 노출할 것만)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // 6️⃣ 느린 로그 경고
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefresh: true,
    },
  },
};

module.exports = nextConfig;
