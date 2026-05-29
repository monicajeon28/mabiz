export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

// 5분 메모리 캐시 (외부 알리고 API 트래픽 절감)
let aligoCache: { balance: number; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

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
    // 환경변수 미설정 → 에러가 아닌 0원 반환 (Vercel 배포 환경에서 안전하게)
    return { result_code: 1, message: 'ENV_NOT_SET', SMS_CNT: '0', cash: '0' };
  }

  const formData = new URLSearchParams({ key: apiKey, user_id: userId });
  const res = await fetch('https://apis.aligo.in/remain/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  if (!res.ok) throw new Error(`Aligo HTTP ${res.status}`);
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
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 5분 캐시 히트
    if (aligoCache && aligoCache.expiresAt > Date.now()) {
      return NextResponse.json({
        ok: true,
        balance: aligoCache.balance,
        lastUpdated: new Date(aligoCache.expiresAt - CACHE_TTL_MS).toISOString(),
        message: `현재 잔액: ${aligoCache.balance.toLocaleString('ko-KR')}원`,
        cached: true,
      });
    }

    let aligoResponse: AligoRemainResponse;
    try {
      aligoResponse = await fetchRemain();
    } catch (fetchErr) {
      // 외부 API 연결 실패 → 500 대신 graceful 처리
      logger.warn('[AligoStatus] Aligo API 연결 실패 (환경변수 또는 네트워크):', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      return NextResponse.json({
        ok: true,
        balance: 0,
        lastUpdated: new Date().toISOString(),
        message: 'SMS 잔액 조회 불가 (설정 확인 필요)',
        unavailable: true,
      });
    }

    // result_code가 문자열 "1"로 올 수 있어 Number()로 강제 변환
    if (Number(aligoResponse.result_code) !== 1) {
      // Aligo API가 에러 코드 반환 → 500 대신 graceful 처리
      logger.warn('[AligoStatus] Aligo API 에러 응답:', { message: aligoResponse.message });
      return NextResponse.json({
        ok: true,
        balance: 0,
        lastUpdated: new Date().toISOString(),
        message: `SMS 서비스 오류: ${aligoResponse.message}`,
        unavailable: true,
      });
    }

    const balance = parseBalance(aligoResponse);
    // 캐시 갱신
    aligoCache = { balance, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json({
      ok: true,
      balance,
      lastUpdated: new Date().toISOString(),
      message: `현재 잔액: ${balance.toLocaleString('ko-KR')}원`,
    });
  } catch (error) {
    logger.error('[AligoStatus] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    // 예상치 못한 에러도 UI가 깨지지 않도록 graceful 처리
    return NextResponse.json({
      ok: true,
      balance: 0,
      lastUpdated: new Date().toISOString(),
      message: 'SMS 잔액 조회 중 오류 발생',
      unavailable: true,
    });
  }
}
