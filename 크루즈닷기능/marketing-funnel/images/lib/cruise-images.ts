// lib/cruise-images.ts
// ImageCache DB에서 여행지 이미지를 가져오는 유틸리티
// (이전: fs.readdirSync 로컬 파일시스템 스캔 → Vercel 배포 시 404 발생)
// (현재: Prisma ImageCache DB 조회 → Vercel 서버리스 환경 정상 동작)

import prisma from '@/lib/prisma';
import { getEffectiveImageUrl } from '@/lib/cloudinary-service';
import { logger } from '@/lib/logger';

interface ImageInfo {
  url: string;
  title: string;
}

/**
 * 여행지에 맞는 이미지를 ImageCache DB에서 찾아서 반환
 * folder / fileName 에서 키워드 매칭
 */
export async function getDestinationImages(destinations: string[]): Promise<ImageInfo[]> {
  if (!destinations || destinations.length === 0) {
    return [];
  }

  // 목적지 키워드 매핑
  const destinationKeywords: Record<string, string[]> = {
    '대한민국': ['대한민국', '한국', 'korea', 'jeju', '제주'],
    '일본': ['일본', 'japan', '도쿄', 'tokyo', '후쿠오카', 'fukuoka', '오키나와', 'okinawa', '나가사키', 'nagasaki', '사세보', 'sasebo', '요코하마', 'yokohama'],
    '홍콩': ['홍콩', 'hongkong', 'hong kong'],
    '대만': ['대만', 'taiwan', '타이완', 'taipei'],
    '싱가포르': ['싱가포르', 'singapore'],
    '베트남': ['베트남', 'vietnam', '호치민', 'hochiminh', '다낭', 'danang', '하롱', 'halong'],
    '말레이시아': ['말레이시아', 'malaysia', '쿠알라룸푸르', 'kuala lumpur', '페낭', 'penang'],
    '태국': ['태국', 'thailand', '방콕', 'bangkok', '푸켓', 'phuket'],
    '필리핀': ['필리핀', 'philippines', '세부', 'cebu', '마닐라', 'manila'],
  };

  // 검색할 키워드 수집
  const searchKeywords: string[] = [];
  for (const dest of destinations) {
    const keywords = destinationKeywords[dest] || [dest];
    searchKeywords.push(...keywords);
  }

  if (searchKeywords.length === 0) {
    return [];
  }

  try {
    // DB에서 폴더/파일명 기반 키워드 매칭 조회
    const images = await prisma.imageCache.findMany({
      where: {
        deletedAt: null,
        driveUrl: { not: null },
        OR: searchKeywords.map(keyword => ({
          OR: [
            { folder: { contains: keyword, mode: 'insensitive' as const } },
            { fileName: { contains: keyword, mode: 'insensitive' as const } },
            { title: { contains: keyword, mode: 'insensitive' as const } },
          ],
        })),
      },
      orderBy: { folder: 'asc' },
      take: 20,
    });

    // 점수 기반 정렬 + 중복 제거
    const scored = images.map(img => {
      let score = 0;
      const folderLower = (img.folder || '').toLowerCase();
      const fileLower = (img.fileName || '').toLowerCase();
      for (const kw of searchKeywords) {
        const kwLower = kw.toLowerCase();
        if (folderLower.includes(kwLower)) score += 3;
        if (fileLower.includes(kwLower)) score += 2;
      }
      return { score, img };
    });
    scored.sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const result: ImageInfo[] = [];

    for (const { img } of scored) {
      const url = getEffectiveImageUrl(img);
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      result.push({
        url,
        title: img.title.replace(/\.[^/.]+$/, ''),
      });

      if (result.length >= 5) break;
    }

    return result;
  } catch (error) {
    logger.error('[Cruise Images] getDestinationImages DB error:', { error });
    return [];
  }
}

/**
 * 크루즈 후기 사진 가져오기 (3x3 그리드용)
 * ImageCache DB의 '고객 후기 자료' 폴더에서 조회
 */
export async function getCruiseReviewImages(
  _productInfo: {
    packageName?: string;
    itineraryPattern?: string;
  },
  limit: number = 10,
): Promise<ImageInfo[]> {
  try {
    const images = await prisma.imageCache.findMany({
      where: {
        deletedAt: null,
        driveUrl: { not: null },
        folder: { contains: '고객 후기 자료', mode: 'insensitive' as const },
      },
      orderBy: { folder: 'asc' },
      take: limit * 2, // 중복 제거 여유분
    });

    if (images.length === 0) {
      logger.warn('[Cruise Images] getCruiseReviewImages: 고객 후기 자료 폴더 결과 없음');
      return [];
    }

    const seen = new Set<string>();
    const result: ImageInfo[] = [];

    for (const img of images) {
      const url = getEffectiveImageUrl(img);
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      result.push({
        url,
        title: img.title.replace(/\.[^/.]+$/, ''),
      });

      if (result.length >= limit) break;
    }

    return result;
  } catch (error) {
    logger.error('[Cruise Images] getCruiseReviewImages DB error:', { error });
    return [];
  }
}

/**
 * 상품 정보에서 목적지를 추출하여 이미지 가져오기
 */
export async function getProductDestinationImages(productInfo: {
  packageName?: string;
  itineraryPattern?: string;
}): Promise<ImageInfo[]> {
  const destinationCountryMap: Record<string, string> = {
    '대한민국': '대한민국',
    '한국': '대한민국',
    'JEJU': '대한민국',
    '제주': '대한민국',
    '일본': '일본',
    'JAPAN': '일본',
    '도쿄': '일본',
    'TOKYO': '일본',
    '후쿠오카': '일본',
    'FUKUOKA': '일본',
    '사세보': '일본',
    'SASEBO': '일본',
    '나가사키': '일본',
    'NAGASAKI': '일본',
    '오키나와': '일본',
    'OKINAWA': '일본',
    '요코하마': '일본',
    'YOKOHAMA': '일본',
    '홍콩': '홍콩',
    'HONGKONG': '홍콩',
    'HONG KONG': '홍콩',
    '대만': '대만',
    '타이완': '대만',
    'TAIWAN': '대만',
    '싱가포르': '싱가포르',
    'SINGAPORE': '싱가포르',
    '베트남': '베트남',
    'VIETNAM': '베트남',
    '다낭': '베트남',
    'DANANG': '베트남',
    '호치민': '베트남',
    'HO CHI MINH': '베트남',
    '말레이시아': '말레이시아',
    'MALAYSIA': '말레이시아',
    '쿠알라룸푸르': '말레이시아',
    'KUALA LUMPUR': '말레이시아',
    '태국': '태국',
    'THAILAND': '태국',
    '방콕': '태국',
    'BANGKOK': '태국',
    '푸켓': '태국',
    'PHUKET': '태국',
    '필리핀': '필리핀',
    'PHILIPPINES': '필리핀',
    '세부': '필리핀',
    'CEBU': '필리핀',
    '마닐라': '필리핀',
    'MANILA': '필리핀',
  };

  const countries = new Set<string>();

  const addCountriesFromText = (text?: string | any) => {
    if (!text) return;
    const textStr = typeof text === 'string' ? text : String(text);
    const upper = textStr.toUpperCase();
    Object.entries(destinationCountryMap).forEach(([keyword, country]) => {
      if (upper.includes(keyword)) {
        countries.add(country);
      }
    });
  };

  // packageName에서 국가 추출
  addCountriesFromText(productInfo.packageName);

  // itineraryPattern 처리 (JSON 형식일 수도 있음)
  if (productInfo.itineraryPattern) {
    if (typeof productInfo.itineraryPattern === 'string') {
      try {
        const parsed = JSON.parse(productInfo.itineraryPattern);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.country) {
              const countryCodeMap: Record<string, string> = {
                'KR': '대한민국',
                'JP': '일본',
                'TW': '대만',
                'HK': '홍콩',
                'SG': '싱가포르',
                'VN': '베트남',
                'MY': '말레이시아',
                'TH': '태국',
                'PH': '필리핀',
              };
              const countryName = countryCodeMap[item.country] || item.country;
              countries.add(countryName);
            }
            if (item.location) {
              addCountriesFromText(item.location);
            }
          });
        } else {
          addCountriesFromText(JSON.stringify(parsed));
        }
      } catch (_e) {
        addCountriesFromText(productInfo.itineraryPattern);
      }
    } else if (Array.isArray(productInfo.itineraryPattern)) {
      (productInfo.itineraryPattern as any[]).forEach((item: any) => {
        if (item && typeof item === 'object') {
          if (item.country) {
            const countryCodeMap: Record<string, string> = {
              'KR': '대한민국',
              'JP': '일본',
              'TW': '대만',
              'HK': '홍콩',
              'SG': '싱가포르',
              'VN': '베트남',
              'MY': '말레이시아',
              'TH': '태국',
              'PH': '필리핀',
            };
            const countryName = countryCodeMap[item.country] || item.country;
            countries.add(countryName);
          }
          if (item.location) {
            addCountriesFromText(item.location);
          }
        }
      });
    } else if (typeof productInfo.itineraryPattern === 'object') {
      addCountriesFromText(JSON.stringify(productInfo.itineraryPattern));
    }
  }

  return getDestinationImages(Array.from(countries));
}

/**
 * 객실 이미지 가져오기 (ImageCache DB의 '객실' 폴더에서 조회)
 */
export async function getRoomImages(limit: number = 3): Promise<ImageInfo[]> {
  const roomKeywords = ['객실', '룸', 'room', '인사이드', '오션뷰', '발코니', 'balcony', 'inside', 'ocean'];

  try {
    const images = await prisma.imageCache.findMany({
      where: {
        deletedAt: null,
        driveUrl: { not: null },
        OR: roomKeywords.map(keyword => ({
          OR: [
            { folder: { contains: keyword, mode: 'insensitive' as const } },
            { fileName: { contains: keyword, mode: 'insensitive' as const } },
            { title: { contains: keyword, mode: 'insensitive' as const } },
          ],
        })),
      },
      orderBy: { folder: 'asc' },
      take: limit * 3, // 중복 제거 여유분
    });

    const seen = new Set<string>();
    const result: ImageInfo[] = [];

    for (const img of images) {
      const url = getEffectiveImageUrl(img);
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      result.push({
        url,
        title: img.title.replace(/\.[^/.]+$/, ''),
      });

      if (result.length >= limit) break;
    }

    return result;
  } catch (error) {
    logger.error('[Cruise Images] getRoomImages DB error:', { error });
    return [];
  }
}
