import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

const VIP_STAGES = [
  { name: 'D-90 여권 확인',    triggerOffset: -90, content: '[고객명]님, 안녕하세요! [상품명] 출발이 90일 남았어요 🗓\n먼저 여권 유효기간 확인 부탁드려요.\n출발일 기준 6개월 이상 남아 있어야 탑승이 가능해요.\n궁금한 거 있으시면 언제든 연락 주세요 😊' },
  { name: 'D-60 비자 안내',    triggerOffset: -60, content: '[고객명]님, [상품명] D-60이에요!\n기항지에 따라 비자가 필요할 수 있어요.\n필요 여부 확인해 드릴게요 — 방문 항구 알고 계시면 문자 주세요.\n미리 준비하면 훨씬 편해요 👍' },
  { name: 'D-30 짐 준비',      triggerOffset: -30, content: '한 달 남았어요! [고객명]님 짐 슬슬 챙겨보세요 😄\n크루즈는 저녁에 드레스코드가 있는 날이 있어요.\n캐주얼 정장 1~2벌은 챙기시는 걸 추천드려요.\n짐 리스트 필요하시면 말씀해 주세요!' },
  { name: 'D-14 온라인 체크인', triggerOffset: -14, content: '[고객명]님, 2주 남았어요! 🎉\n온라인 체크인 미리 해두시면 항구에서 기다리는 시간이 줄어요.\n선사 앱 다운로드 + 로그인 먼저 해두세요.\n도움 필요하시면 연락 주세요 👋' },
  { name: 'D-7 면세점 팁',     triggerOffset:  -7, content: '일주일 남았어요! [고객명]님 설레시죠? 🚢\n선내 면세점은 미리 위시리스트 만들어두면 편해요.\n팁: 입항 전날 저녁에 주문하면 선실로 배달돼요.\n즐거운 출발 준비 되세요!' },
  { name: 'D-1 최종 점검',     triggerOffset:  -1, content: '[고객명]님, 내일 드디어 출발이에요! 🥳\n챙기셔야 할 것: 여권, 탑승권(e-ticket), 여행자보험증서\n항구 도착은 출발 2~3시간 전 추천드려요.\n즐거운 여행 다녀오세요 — 응원할게요! 🌊' },
  { name: 'D+2 후기 요청',     triggerOffset:   2, content: '[고객명]님, 크루즈 어떠셨어요? 😊\n잘 돌아오셨을 것 같아서 문자 드려요.\n후기 한 줄만 남겨주시면 다음 여행 할인 드려요!\n→ cruisedot.co.kr/review\n소중한 후기 기다릴게요 🙏' },
];

export async function POST() {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 이미 존재하는지 확인
    const existing = await prisma.funnel.findFirst({
      where: { organizationId: orgId, funnelType: 'VIP_CARE' },
    });
    if (existing) {
      return NextResponse.json({ ok: true, message: 'VIP 케어 퍼널이 이미 존재합니다', funnelId: existing.id });
    }

    const funnel = await prisma.funnel.create({
      data: {
        organizationId: orgId,
        name:           'VIP 케어 — 출발 전 준비',
        description:    '구매 확정 고객 전용 7단계 출발 전 케어',
        funnelType:     'VIP_CARE',
        isActive:       true,
        stages: {
          create: VIP_STAGES.map((s, i) => ({
            name:           s.name,
            order:          i + 1,
            triggerType:    'DDAY',
            triggerOffset:  s.triggerOffset,
            messageContent: s.content,
          })),
        },
      },
      select: { id: true, name: true, _count: { select: { stages: true } } },
    });

    logger.log('[VipFunnel] 생성 완료', { orgId, funnelId: funnel.id });
    return NextResponse.json({ ok: true, funnel });
  } catch (e) {
    logger.log('[VipFunnel] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
