/**
 * DB에서 이미지 검색 (가벼운 모듈 - API 라우트용)
 * 무거운 googleapis 의존성 없이 Prisma만 사용
 */

import prisma from '@/lib/prisma';

// ✅ P0-2: ReDoS 방지 — 입력 검증 상수
const SEARCH_TERM_MAX_LENGTH = 500;  // 500자 제한
const SEARCH_TERM_MIN_LENGTH = 1;
const SEARCH_TERMS_MAX_COUNT = 10;   // 최대 10개 단어까지만

// ✅ P0-3: DoS 방지 — 쿼리 제한 상수
const SEARCH_LIMIT_MIN = 1;
const SEARCH_LIMIT_MAX = 50;         // 개당 50개 제한 (원래 200 → 축소)
const SEARCH_LIMIT_DEFAULT = 20;

/**
 * DB에서 이미지 검색 (기존 searchPhotos 대체)
 * @param query 검색어
 * @param userId IDOR 방지 — 자신의 이미지만 검색
 * @param limit 반환 개수 (기본: 20, 최대: 50)
 */
export async function searchImagesFromDB(
  query: string,
  userId: string,
  limit: number = SEARCH_LIMIT_DEFAULT
): Promise<{
  items: Array<{ url: string; title: string; tags: string[] }>;
}> {
  if (!query || !query.trim()) {
    return { items: [] };
  }

  // ✅ P0-2: ReDoS 방지 — 입력 길이 검증
  if (query.length > SEARCH_TERM_MAX_LENGTH) {
    throw new Error(`검색어는 ${SEARCH_TERM_MAX_LENGTH}자 이하여야 합니다`);
  }

  const searchTerms = query.trim().toLowerCase().split(/\s+/);

  // ✅ P0-2: ReDoS 방지 — 단어 개수 제한 (split 폭탄 방지)
  if (searchTerms.length > SEARCH_TERMS_MAX_COUNT) {
    throw new Error(`검색어는 최대 ${SEARCH_TERMS_MAX_COUNT}개 단어까지만 가능합니다`);
  }

  // ✅ P0-3: DoS 방지 — limit 검증
  const validatedLimit = Math.min(
    Math.max(Math.floor(limit), SEARCH_LIMIT_MIN),
    SEARCH_LIMIT_MAX
  );

  // DB에서 검색 (title, folder, tags에서 검색)
  const images = await prisma.imageCache.findMany({
    where: {
      userId,  // ← IDOR 방지: 자신의 이미지만
      OR: searchTerms.map(term => ({
        OR: [
          { title: { contains: term, mode: 'insensitive' as const } },
          { folder: { contains: term, mode: 'insensitive' as const } },
          { fileName: { contains: term, mode: 'insensitive' as const } },
          { tags: { hasSome: [term] } },
        ]
      }))
    },
    orderBy: [
      { folder: 'asc' },
      { title: 'asc' },
    ],
    take: validatedLimit,  // ← 50 이상 불가능
  });

  // 점수 기반 정렬
  const scored = images.map(img => {
    let score = 0;
    // ✅ P1-3: null 안전화 — || '' 처리
    const titleLower = (img.title || '').toLowerCase();
    const folderLower = (img.folder || '').toLowerCase();

    for (const term of searchTerms) {
      if (folderLower.includes(term)) score += 3;
      if (titleLower.includes(term)) score += 2;
      if (img.tags.some(tag => tag.toLowerCase().includes(term))) score += 2;
    }

    return { score, img };
  });

  scored.sort((a, b) => b.score - a.score);

  // 중복 제거: 같은 제목(확장자 제외)은 1개만 표시
  const seen = new Set<string>();
  const uniqueItems: Array<{ url: string; title: string; tags: string[] }> = [];

  for (const s of scored) {
    // 제목에서 확장자 제거하고 정규화 (폴더명__ 접두사도 제거)
    let normalizedTitle = s.img.title
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')  // 확장자 제거
      .replace(/^[^_]*__/, '')  // ✅ P0-2: ReDoS 방지 — 탐욕적 정규식 개선 (^.*__ → ^[^_]*__)
      .toLowerCase()
      .trim();

    // ✅ P1-3: null 안전화 — folder null 체크
    if (s.img.folder && s.img.folder.includes('.backup')) continue;

    // 이미 본 제목이면 스킵
    if (seen.has(normalizedTitle)) continue;

    seen.add(normalizedTitle);
    uniqueItems.push({
      url: s.img.driveUrl,
      title: s.img.title,
      tags: s.img.tags,
    });

    // ✅ P0-3: DoS 방지 — validatedLimit만큼만 반환 (최대 50개)
    if (uniqueItems.length >= validatedLimit) break;
  }

  return { items: uniqueItems };
}

/**
 * DB에서 하위 폴더 목록 가져오기
 * @param folderName 폴더명
 * @param userId IDOR 방지 — 자신의 폴더만 조회
 */
export async function getSubfoldersFromDB(folderName: string, userId: string): Promise<Array<{
  name: string;
  displayName: string;
  icon: string;
  photoCount: number;
}>> {
  const searchTerm = folderName.toLowerCase();

  // 해당 폴더 하위의 모든 이미지 가져오기
  const images = await prisma.imageCache.findMany({
    where: {
      userId,  // ← IDOR 방지: 자신의 폴더만
      folder: { contains: searchTerm, mode: 'insensitive' }
    },
    select: { folder: true }
  });

  // 하위 폴더 추출
  const subfolderCounts = new Map<string, number>();

  for (const img of images) {
    const folderParts = img.folder.split('/');
    const searchIndex = folderParts.findIndex(p => p.toLowerCase().includes(searchTerm));

    if (searchIndex >= 0 && searchIndex < folderParts.length - 1) {
      const subfolderPath = folderParts.slice(0, searchIndex + 2).join('/');
      subfolderCounts.set(subfolderPath, (subfolderCounts.get(subfolderPath) || 0) + 1);
    }
  }

  const folderIconMap: Record<string, string> = {
    '객실': '🛏️',
    '내부시설': '🏛️',
    '수영장': '🏊',
    '자쿠지': '🛁',
    '엑티비티': '🎯',
    '지도': '🗺️',
    '쉽맵': '🗺️',
    '키즈': '👶',
    '행사': '🎉',
    '외관': '🚢',
    '와이파이': '📶',
    'qna': '❓',
  };

  const subfolders = Array.from(subfolderCounts.entries()).map(([fullPath, count]) => {
    const displayName = fullPath.split('/').pop() || fullPath;

    let icon = '📁';
    for (const [keyword, emoji] of Object.entries(folderIconMap)) {
      if (displayName.includes(keyword)) {
        icon = emoji;
        break;
      }
    }

    return {
      name: fullPath,
      displayName,
      icon,
      photoCount: count,
    };
  });

  return subfolders.sort((a, b) => b.photoCount - a.photoCount);
}
