export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// ── Aligo 타입 ────────────────────────────────────────
interface AligoRemainResponse {
  result_code: number;
  message: string;
  SMS_CNT?: string;
  LMS_CNT?: string;
  MMS_CNT?: string;
  cash?: string;
}

async function fetchRemain(): Promise<AligoRemainResponse> {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  if (!apiKey || !userId) {
    throw new Error('ALIGO 환경변수 미설정');
  }

  const formData = new URLSearchParams({ key: apiKey, user_id: userId });
  const res = await fetch('https://apis.aligo.in/remain/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  return (await res.json()) as AligoRemainResponse;
}

function parseBalance(response: AligoRemainResponse): number {
  // cash 필드에서 금액 추출 (문자열 -> 숫자)
  const raw = response.cash;
  if (!raw) return 0;
  const num = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) ? 0 : num;
}

// ── GET /api/passport/admin/aligo-status ────────────
export async function GET(request: NextRequest) {
  try {
    // 권한 검증: GLOBAL_ADMIN 또는 OWNER만 접근 가능
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        {
          ok: false,
          error: '인증이 필요합니다.',
        },
        { status: 403 }
      );
    }

    // Aligo API 호출
    const aligoResponse = await fetchRemain();

    if (aligoResponse.result_code !== 1 && aligoResponse.result_code !== 0) {
      throw new Error(`Aligo API Error: ${aligoResponse.message}`);
    }

    // 잔액 파싱
    const balance = parseBalance(aligoResponse);

    return NextResponse.json({
      ok: true,
      balance,
      lastUpdated: new Date().toISOString(),
      message: `현재 잔액: ${balance.toLocaleString('ko-KR')}원`,
    });
  } catch (error) {
    logger.error('[AligoStatus] Error:', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '알리고 잔액 조회 실패',
      },
      { status: 500 }
    );
  }
}
