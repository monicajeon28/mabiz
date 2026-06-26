export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { getServerPublicIP } from '@/lib/aligo/ip-whitelist';

/**
 * GET /api/settings/aligo/server-ip
 *
 * 운영 서버(이 함수가 실행되는 곳)의 실제 발송(outbound) IP를 반환한다.
 * 알리고는 발신 IP 화이트리스트를 요구하는데, 서버리스(Vercel)는 egress IP가
 * 고정이 아니라 호출마다/시점마다 바뀔 수 있다. 이 값을 화면에 띄워
 *  (1) 사장님이 알리고 콘솔 '발송 서버 IP'에 즉시 등록해 발송을 살리고,
 *  (2) 새로고침을 반복해 IP가 몇 개로/얼마나 자주 바뀌는지 확인(→ 고정IP 프록시 필요 판단)
 * 하도록 돕는다. (알리고 상담원 안내 "현재 IP 등록 후 발송 중 IP 변동 확인"과 동일)
 *
 * 인증: 로그인 사용자(설정 페이지 접근 권한자). IP 자체는 민감정보 아님.
 */
export async function GET() {
  const session = await getMabizSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
  }

  // ?fresh 캐시(5분) 때문에 같은 값이 반복될 수 있음 — 그래도 호출 시점의 egress IP를 반환.
  const ip = await getServerPublicIP();

  return NextResponse.json({
    ok: true,
    ip,
    checkedAt: new Date().toISOString(),
    note:
      ip === 'unknown'
        ? '서버 IP 확인 실패(외부 조회 차단/지연). 잠시 후 다시 시도해 주세요.'
        : '이 IP를 알리고 콘솔의 "발송 서버 IP"에 등록하세요. 발송이 안 되면 새로고침해 바뀌었는지 확인하세요.',
  });
}
