/**
 * 이미지 최적화 유틸리티
 * 작업자 C (UX/기능 전문가)
 */

/**
 * Shimmer 효과 블러 이미지 생성
 * Next.js Image placeholder="blur"에 사용
 */
export function getShimmerDataURL(width: number, height: number): string {
  const shimmer = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#e5e7eb" stop-opacity="1" />
          <stop offset="50%" stop-color="#f3f4f6" stop-opacity="1" />
          <stop offset="100%" stop-color="#e5e7eb" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shimmer)" />
    </svg>
  `;

  const base64 = Buffer.from(shimmer).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * 간단한 회색 블러 이미지 생성
 */
export function getGrayBlurDataURL(): string {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg==';
}

