// force-dynamic 제거: unstable_cache가 자체 revalidate 관리
// (force-dynamic + unstable_cache 공존 시 캐시가 무효화됨)
import { unstable_cache } from 'next/cache';
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

interface BalanceResult {
  balance: number;
  fetchedAt: string; // ISO string — Date는 unstable_cache 직렬화 불가
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

/**
 * unstable_cache로 감싼 잔액 조회.
 *
 * - 키: ['aligo-balance'] → 모든 인스턴스가 동일한 캐시 공유 (인스턴스 독립 메모리 문제 해결)
 * - revalidate: 300초 (5분) → 이전 메모리 캐시 TTL과 동일
 * - 에러는 함수 내에서 처리 후 정상 값 반환: unstable_cache는 throw된 예외를 캐시하지 않으므로
 *   에러 발생 시마다 재시도하게 되며 캐시 히트가 안 됨. 따라서 graceful fallback 값을 반환해
 *   정상 케이스처럼 캐시되도록 함.
 */
const fetchCachedBalance = unstable_cache(
  async (): Promise<BalanceResult> => {
    try {
      const response = await fetchRemain();

      // result_code가 문자열 "1"로 올 수 있어 Number()로 강제 변환
      if (Number(response.result_code) !== 1) {
        logger.warn('[AligoStatus] Aligo API 에러 응답 (캐시됨):', { message: response.message });
        // unavailable 플래그를 balance에 음수로 인코딩하는 대신 별도 필드 사용 불가(타입 단순화).
        // -1을 반환해 호출부에서 unavailable 처리.
        return { balance: -1, fetchedAt: new Date().toISOString() };
      }

      return { balance: parseBalance(response), fetchedAt: new Date().toISOString() };
    } catch (fetchErr) {
      // 외부 API 연결 실패 → graceful fallback (캐시에 저장되어 5분간 재시도 방지)
      logger.warn('[AligoStatus] Aligo API 연결 실패 (캐시됨):', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      // -2: 네트워크/연결 오류 구분용
      return { balance: -2, fetchedAt: new Date().toISOString() };
    }
  },
  ['aligo-balance'],
  { revalidate: 300 } // 5분
);

// ── GET /api/passport/admin/aligo-status ────────────
export async function GET(request: NextRequest) {
  // 인증은 캐시 바깥에서 수행: 인증 정보는 캐시하지 않음
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    let result: BalanceResult;
    try {
      result = await fetchCachedBalance();
    } catch (cacheErr) {
      // unstable_cache 자체 오류 (런타임 이상 등) — 극히 드문 케이스
      logger.error('[AligoStatus] unstable_cache 오류:', {
        error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
      });
      return NextResponse.json({
        ok: true,
        balance: 0,
        lastUpdated: new Date().toISOString(),
        message: 'SMS 잔액 조회 중 오류 발생',
        unavailable: true,
      });
    }

    // balance < 0: 캐시된 오류 결과 처리
    if (result.balance === -1) {
      return NextResponse.json({
        ok: true,
        balance: 0,
        lastUpdated: result.fetchedAt,
        message: 'SMS 서비스 오류: Aligo API 에러 응답',
        unavailable: true,
      });
    }

    if (result.balance === -2) {
      return NextResponse.json({
        ok: true,
        balance: 0,
        lastUpdated: result.fetchedAt,
        message: 'SMS 잔액 조회 불가 (설정 확인 필요)',
        unavailable: true,
      });
    }

    return NextResponse.json({
      ok: true,
      balance: result.balance,
      lastUpdated: result.fetchedAt,
      message: `현재 잔액: ${result.balance.toLocaleString('ko-KR')}원`,
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
