export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/landing-pages/[id]/view
 * 랜딩페이지 방문 시 viewCount +1 (공개 API, 인증 불필요)
 *
 * ⚠️ 어뷰징 방어: 호출자(클라이언트)에서 sessionStorage로 dedup 처리 권장
 *   - sessionStorage.getItem(`viewed_${id}`) 있으면 호출 스킵
 *   - 없으면 호출 후 sessionStorage.setItem(`viewed_${id}`, '1')
 * viewCount는 정밀 분석이 아닌 참고용 지표로 사용.
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.crmLandingPage.update({
      where:  { id },
      data:   { viewCount: { increment: 1 } },
      select: { id: true }, // 최소 반환
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 페이지 없음 또는 DB 오류 — 방문자 경험에 영향 없도록 무음 처리
    logger.error('[LandingView] viewCount 증가 실패', { err });
    return NextResponse.json({ ok: false }, { status: 200 }); // 200으로 클라이언트 에러 방지
  }
}
