export const dynamic = 'force-dynamic';

// app/api/admin/cruisedot-news/trending-keywords/route.ts
// Google Trends 급상승 키워드 수집 → Gemini로 크루즈 관련 필터링

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

// Google Trends Korea RSS (무료, API 키 불필요)
const TRENDS_RSS_URL = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR';

// 기존 SEO 파일에서 인기 키워드 샘플 (빠른 로딩용)
const STATIC_CRUISE_KEYWORDS = [
  'MSC 크루즈 가격', '로얄캐리비안 예약', '코스타 크루즈 후기',
  '크루즈 직항 비용', '크루즈 여행 준비물', '지중해 크루즈 일정',
  '크루즈 선실 종류', '크루즈 패키지 비교', '동남아 크루즈 추천',
  '크루즈 여행사 비교', '직접예약 vs 여행사', '크루즈 취소 환불',
];

interface TrendingResult {
  trending: string[];      // Google Trends 급상승 (크루즈 관련)
  recommended: string[];   // 기존 SEO 파일 기반
}

async function fetchGoogleTrends(): Promise<string[]> {
  try {
    const res = await fetch(TRENDS_RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CruisedotBot/1.0)' },
      next: { revalidate: 3600 }, // 1시간 캐시
    });
    if (!res.ok) throw new Error(`Trends fetch failed: ${res.status}`);

    const xml = await res.text();
    const matches = [...xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)];
    return matches.map(m => m[1]!.trim()).filter(Boolean).slice(0, 50);
  } catch (error) {
    logger.warn('[trending-keywords] Google Trends 수집 실패 — 기본 키워드 사용', { error: String(error) });
    return [];
  }
}

async function filterCruiseKeywords(rawKeywords: string[], apiKey: string): Promise<string[]> {
  if (rawKeywords.length === 0) return [];

  const model = resolveGeminiModelName();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `다음은 오늘 한국 구글 트렌드 급상승 검색어 목록입니다.
이 중에서 크루즈 여행, 선박 여행, 해외 크루즈, 크루즈 상품, 크루즈 예약과 관련성이 있는 것만 골라주세요.

검색어 목록:
${rawKeywords.join('\n')}

규칙:
- 관련 있는 키워드만 JSON 배열로 반환 (최대 8개)
- 관련 없으면 빈 배열 []
- 설명 없이 JSON만 반환: ["키워드1", "키워드2"]`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      }),
    });

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    logger.warn('[trending-keywords] Gemini 필터링 실패');
    return [];
  }
}

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        trending: [],
        recommended: STATIC_CRUISE_KEYWORDS.slice(0, 8),
      });
    }

    // 병렬: Google Trends 수집 + 기본 키워드 준비
    const rawTrends = await fetchGoogleTrends();
    const cruiseTrending = await filterCruiseKeywords(rawTrends, apiKey);

    logger.debug('[trending-keywords] 완료', {
      rawCount: rawTrends.length,
      filteredCount: cruiseTrending.length,
    });

    const result: TrendingResult = {
      trending: cruiseTrending,
      recommended: STATIC_CRUISE_KEYWORDS.slice(0, 8),
    };

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error('[trending-keywords] 오류:', error);
    return NextResponse.json({
      ok: true,
      trending: [],
      recommended: STATIC_CRUISE_KEYWORDS.slice(0, 8),
    });
  }
}
