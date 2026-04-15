export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// 8개 지역 정의
const REGIONS = [
  { key: 'japan',       name: '🇯🇵 일본 크루즈 관심',    color: '#FF6B6B', emoji: '🌸' },
  { key: 'taiwan_hk',  name: '🇹🇼 대만·홍콩 관심',       color: '#4ECDC4', emoji: '🏙' },
  { key: 'europe',     name: '🇪🇺 유럽 크루즈 관심',     color: '#45B7D1', emoji: '⛵' },
  { key: 'caribbean',  name: '🌊 카리브해 관심',           color: '#96CEB4', emoji: '🏝' },
  { key: 'usa',        name: '🇺🇸 미국 크루즈 관심',      color: '#4B9CD3', emoji: '🗽' },
  { key: 'alaska',     name: '🏔 알래스카 관심',           color: '#6C5CE7', emoji: '🧊' },
  { key: 'sea_asia',   name: '🌏 동남아 크루즈 관심',     color: '#FFEAA7', emoji: '🌺' },
  { key: 'general',    name: '🚢 크루즈 전반 관심',        color: '#DFE6E9', emoji: '🌍' },
];

// 지역별 주 1회 12스테이지 메시지 생성
function makeRegionalStages(regionName: string, regionEmoji: string) {
  const shortName = regionName.replace(/[🇯🇵🇹🇼🇪🇺🌊🇺🇸🏔🌏🚢 관심크루즈전반]/g, '').trim();

  return [
    { order: 0,  name: `1주: 소식 시작`,     triggerOffset: 0,  msg: `크루즈닷 입니다 ${regionEmoji}\n[고객명]님, ${shortName} 크루즈 소식 시작이에요!\n이번 주 특가 일정 확인해 보세요 → [링크]` },
    { order: 1,  name: `2주: 꿀팁`,           triggerOffset: 7,  msg: `크루즈닷 입니다 😊\n[고객명]님 ${shortName} 크루즈 꿀팁 하나 드려요!\n모르면 손해인 정보예요 → [링크]` },
    { order: 2,  name: `3주: 기항지`,         triggerOffset: 14, msg: `크루즈닷 입니다 🌊\n${shortName} 기항지 이야기예요!\n이런 곳들을 들른다고 해요 → [링크]` },
    { order: 3,  name: `4주: 얼리버드`,       triggerOffset: 21, msg: `크루즈닷 입니다 ✈️\n[고객명]님, ${shortName} 얼리버드 나왔어요!\n마감 전에 확인해 보세요 → [링크]` },
    { order: 4,  name: `5주: 후기`,           triggerOffset: 28, msg: `크루즈닷 입니다 🎉\n${shortName} 크루즈 실제 후기예요!\n다녀온 분들 솔직한 이야기 → [링크]` },
    { order: 5,  name: `6주: 특가`,           triggerOffset: 35, msg: `크루즈닷 입니다 👀\n[고객명]님, 이번 주 ${shortName} 특가 있어요!\n자리 빨리 차요, 확인해 보세요 → [링크]` },
    { order: 6,  name: `7주: 선내식사`,       triggerOffset: 42, msg: `크루즈닷 입니다 🍽\n${shortName} 선내 식사 이야기예요!\n크루즈 밥이 이렇게 나온다고요? → [링크]` },
    { order: 7,  name: `8주: 입문자`,         triggerOffset: 49, msg: `크루즈닷 입니다 😄\n[고객명]님 ${shortName} 크루즈 처음이세요?\n입문자 추천 코스 알려드려요 → [링크]` },
    { order: 8,  name: `9주: 가족여행`,       triggerOffset: 56, msg: `크루즈닷 입니다 🏖\n${shortName} 가족 여행 어떠세요?\n아이들도 신나는 선내 시설 소개 → [링크]` },
    { order: 9,  name: `10주: 가성비`,        triggerOffset: 63, msg: `크루즈닷 입니다 💰\n[고객명]님, ${shortName} 가성비 꿀코스예요!\n이 가격에 이 퀄리티? → [링크]` },
    { order: 10, name: `11주: 다음달 일정`,   triggerOffset: 70, msg: `크루즈닷 입니다 🗓\n${shortName} 크루즈 다음 달 일정이에요!\n[고객명]님 일정 맞으시면 연락 주세요 → [링크]` },
    { order: 11, name: `12주: 마무리 상담`,   triggerOffset: 77, msg: `크루즈닷 입니다 🙋\n[고객명]님, 3개월 동안 함께해서 감사해요!\n${shortName} 크루즈 한번 같이 알아봐요 → cruisedot.co.kr` },
  ].map((s) => ({
    order:          s.order,
    name:           s.name,
    triggerType:    "DAYS_AFTER" as const,
    triggerOffset:  s.triggerOffset,
    channel:        "SMS" as const,
    messageContent: s.msg,
  }));
}

export async function POST() {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

  const created: string[] = [];
  const skipped: string[] = [];

  for (const region of REGIONS) {
    // 이미 있으면 스킵
    const existing = await prisma.contactGroup.findFirst({
      where: { organizationId, name: region.name },
      select: { id: true },
    });
    if (existing) {
      skipped.push(region.name);
      continue;
    }

    // 퍼널 생성
    const funnel = await prisma.funnel.create({
      data: {
        organizationId,
        name:        `${region.name} — 주간 뉴스`,
        description: `${region.name} 관심 고객에게 주 1회 크루즈 소식 발송 (12주)`,
        isActive:    true,
      },
      select: { id: true },
    });

    // 스테이지 일괄 생성
    await prisma.funnelStage.createMany({
      data: makeRegionalStages(region.name, region.emoji).map((s) => ({
        ...s,
        funnelId: funnel.id,
      })),
    });

    // 그룹 생성 + 퍼널 연결
    await prisma.contactGroup.create({
      data: {
        organizationId,
        name:        region.name,
        description: `${region.name} — 주 1회 크루즈 뉴스 자동 발송`,
        color:       region.color,
        funnelId:    funnel.id,
      },
    });

    created.push(region.name);
  }

    logger.log('[Setup/RegionalGroups] 완료', { organizationId, created: created.length, skipped: skipped.length });

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      message: `${created.length}개 지역 그룹 생성, ${skipped.length}개 스킵`,
    });
  } catch (err) {
    logger.error('[Setup/RegionalGroups] 실패', { err });
    return NextResponse.json({ ok: false, message: '서버 오류' }, { status: 500 });
  }
}
