import { NextResponse } from 'next/server';

/**
 * POST /api/auth/register/free-marketer
 *
 * ⛔ 이 엔드포인트는 비활성화되었습니다.
 *
 * 모든 역할(AGENT, FREE_SALES, OWNER)은 초대 링크를 통해서만 가입 가능합니다.
 * GLOBAL_ADMIN 또는 OWNER가 발급한 초대 링크로 /join/[token] 에서 가입하세요.
 *
 * 관련: docs/WORK_ORDER.md Phase 1 — 초대 링크 가입 플로우
 */
export async function POST() {
  return NextResponse.json(
    {
      ok:      false,
      error:   '직접 가입은 지원하지 않습니다. 초대 링크를 통해 가입해주세요.',
      code:    'INVITE_ONLY',
      helpUrl: '/join',
    },
    { status: 410 } // 410 Gone — 이 방식은 더 이상 사용하지 않음
  );
}
