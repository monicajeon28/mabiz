/**
 * POST /api/setup/defaults
 *
 * 조직 최초 셋업 시 자동 실행:
 * 3가지 기본 퍼널 + 그룹 + SMS 템플릿 연결
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ 그룹 1: 잠재고객        → 퍼널: 잠재고객 D+0/2/5       │
 * │ 그룹 2: 관심/콜완료     → 퍼널: 관심고객 상담 시퀀스   │
 * │ 그룹 3: 구매완료 VIP    → 퍼널: VIP 케어 D-150~D+2    │
 * └─────────────────────────────────────────────────────────┘
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// SMS 템플릿 ID 매핑 (seed 데이터에서 가져옴)
const TEMPLATE_MAP = {
  // 잠재고객 시퀀스
  leadD0:   "tpl_seq_01",
  leadD2:   "tpl_seq_02",
  leadD5:   "tpl_seq_03",
  // 부재중/관심 시퀀스
  absentD0: "tpl_seq_04",
  afterD0:  "tpl_seq_05",
  afterD1:  "tpl_seq_06",
  afterD2:  "tpl_seq_07",
  // VIP 케어 시퀀스
  vipD0Confirm:   "tpl_vip_01",
  vipW1:          "tpl_vip_02",
  vipD150:        "tpl_vip_03",
  vipD90:         "tpl_vip_04",
  vipD60:         "tpl_vip_05",
  vipD50:         "tpl_vip_06",
  vipD40:         "tpl_vip_07",
  vipD30:         "tpl_vip_08",
  vipD15:         "tpl_vip_09",
  vipD7Check:     "tpl_vip_10",
  vipD7Kakao:     "tpl_vip_11",
  vipD1:          "tpl_vip_12",
  vipDday:        "tpl_vip_13",
  vipDplus2:      "tpl_vip_14",
};

export async function POST() {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 이미 셋업 여부 확인
    const existing = await prisma.funnel.count({ where: { organizationId: orgId } });
    if (existing > 0) {
      return NextResponse.json({ ok: false, message: "이미 기본 셋업이 완료되어 있습니다." }, { status: 400 });
    }

    // 템플릿 내용 가져오기
    const templates = await prisma.smsTemplate.findMany({
      where: { isSystem: true },
      select: { id: true, title: true, content: true },
    });
    const tplById = Object.fromEntries(templates.map((t) => [t.id, t]));

    const getContent = (id: string) => tplById[id]?.content ?? null;

    // ─── 퍼널 1: 잠재고객 시퀀스 (D+0 / D+2 / D+5) ──────────────
    const funnel1 = await prisma.funnel.create({
      data: {
        organizationId: orgId,
        name:        "잠재고객 기본 시퀀스",
        description: "등록 직후 D+0 환영 → D+2 후기 → D+5 결단 유도",
        isActive:    true,
        stages: {
          create: [
            {
              order:          0,
              name:           "D+0 꿈 점화",
              triggerType:    "DAYS_AFTER",
              triggerOffset:  0,
              channel:        "SMS",
              messageContent: getContent(TEMPLATE_MAP.leadD0),
            },
            {
              order:          1,
              name:           "D+2 사회적 증거",
              triggerType:    "DAYS_AFTER",
              triggerOffset:  2,
              channel:        "SMS",
              messageContent: getContent(TEMPLATE_MAP.leadD2),
            },
            {
              order:          2,
              name:           "D+5 결단 유도",
              triggerType:    "DAYS_AFTER",
              triggerOffset:  5,
              channel:        "SMS",
              messageContent: getContent(TEMPLATE_MAP.leadD5),
            },
          ],
        },
      },
    });

    // ─── 퍼널 2: 관심고객 (상담 직후) ────────────────────────────
    const funnel2 = await prisma.funnel.create({
      data: {
        organizationId: orgId,
        name:        "관심고객 상담 후 시퀀스",
        description: "콜 완료 직후 D+0 상품 정보 → D+1 동행자 상의 → D+2 마감 임박",
        isActive:    true,
        stages: {
          create: [
            {
              order:          0,
              name:           "상담 직후 상품 정보",
              triggerType:    "DAYS_AFTER",
              triggerOffset:  0,
              channel:        "SMS",
              messageContent: getContent(TEMPLATE_MAP.afterD0),
            },
            {
              order:          1,
              name:           "D+1 동행자 상의 독려",
              triggerType:    "DAYS_AFTER",
              triggerOffset:  1,
              channel:        "SMS",
              messageContent: getContent(TEMPLATE_MAP.afterD1),
            },
            {
              order:          2,
              name:           "D+2 마감 임박",
              triggerType:    "DAYS_AFTER",
              triggerOffset:  2,
              channel:        "SMS",
              messageContent: getContent(TEMPLATE_MAP.afterD2),
            },
          ],
        },
      },
    });

    // ─── 퍼널 3: 구매고객 VIP 케어 (D-150 ~ D+2) ─────────────────
    const funnel3 = await prisma.funnel.create({
      data: {
        organizationId: orgId,
        name:        "구매고객 VIP 케어 (D-150~D+2)",
        description: "결제 완료 후 출발일까지 14단계 자동 케어. 출발일을 고객 정보에 입력하면 자동 계산됩니다.",
        isActive:    true,
        stages: {
          create: [
            { order: 0,  name: "예약 확인",        triggerType: "DAYS_AFTER", triggerOffset: 0,    channel: "SMS", messageContent: getContent(TEMPLATE_MAP.vipD0Confirm) },
            { order: 1,  name: "자유여행 준비",     triggerType: "DAYS_AFTER", triggerOffset: 7,    channel: "SMS", messageContent: getContent(TEMPLATE_MAP.vipW1) },
            { order: 2,  name: "항공 예약 D-150",   triggerType: "DDAY",       triggerOffset: -150, channel: "SMS", messageContent: getContent(TEMPLATE_MAP.vipD150) },
            { order: 3,  name: "여권 확인 D-90",     triggerType: "DDAY",       triggerOffset: -90,  channel: "SMS", messageContent: "크루즈닷 입니다 😊\n[고객명]님, [상품명] 출발이 90일 남았어요!\n여권 유효기간이 출발일 기준 6개월 이상인지 꼭 확인해 주세요.\n궁금한 점 있으면 언제든 문자 주세요!" },
            { order: 4,  name: "비자 안내 D-60",    triggerType: "DDAY",       triggerOffset: -60,  channel: "SMS", messageContent: "크루즈닷 입니다 👋\n[고객명]님 D-60이에요!\n기항지에 따라 비자가 필요할 수 있어요.\n방문 항구 알려주시면 비자 여부 바로 안내해 드릴게요." },
            { order: 5,  name: "꿀팁 D-50",         triggerType: "DDAY",       triggerOffset: -50,  channel: "SMS", messageContent: getContent(TEMPLATE_MAP.vipD50) },
            { order: 6,  name: "준비물 D-40",       triggerType: "DDAY",       triggerOffset: -40,  channel: "SMS", messageContent: getContent(TEMPLATE_MAP.vipD40) },
            { order: 7,  name: "드레스코드 D-30",     triggerType: "DDAY",       triggerOffset: -30,  channel: "SMS", messageContent: "크루즈닷 입니다 🧳\n한 달 남았어요! [고객명]님\n크루즈는 저녁에 드레스코드 있는 날이 있어요.\n캐주얼 정장 1~2벌 챙기시는 걸 추천드려요!" },
            { order: 8,  name: "온라인 체크인 D-14", triggerType: "DDAY",       triggerOffset: -14,  channel: "SMS", messageContent: "크루즈닷 입니다 📱\n[고객명]님 2주 남았어요!\n온라인 체크인 미리 해두시면 항구에서 기다리는 시간이 줄어요.\n선사 앱 로그인 먼저 해두세요!" },
            { order: 9,  name: "면세점 팁 D-7",   triggerType: "DDAY",       triggerOffset: -7,   channel: "SMS", messageContent: "크루즈닷 입니다 🚢\n일주일 남았어요!\n선내 면세점 위시리스트 미리 만들어두면 편해요.\n입항 전날 저녁 주문하면 선실 배달도 돼요 😊" },
            { order: 10, name: "카톡방 초대 D-7",   triggerType: "DDAY",       triggerOffset: -7,   channel: "SMS", messageContent: getContent(TEMPLATE_MAP.vipD7Kakao) },
            { order: 11, name: "출발 전날 D-1",   triggerType: "DDAY",       triggerOffset: -1,   channel: "SMS", messageContent: "크루즈닷 입니다 🎉\n[고객명]님 내일 드디어 출발이에요!\n챙기실 것: 여권 + 탑승권(e-ticket) + 여행자보험증서\n항구는 출발 2~3시간 전 도착 추천! 즐거운 여행 되세요 🌊" },
            { order: 12, name: "출발 당일",          triggerType: "DDAY",       triggerOffset: 0,    channel: "SMS", messageContent: getContent(TEMPLATE_MAP.vipDday) },
            { order: 13, name: "귀국 후기 D+2",     triggerType: "DDAY",       triggerOffset: 2,    channel: "SMS", messageContent: "크루즈닷 입니다 😊\n[고객명]님 잘 다녀오셨나요?\n후기 한 줄만 남겨주시면 다음 여행 할인 드려요!\n→ cruisedot.co.kr/review" },
          ],
        },
      },
    });

    // ─── 기본 그룹 3개 생성 + 퍼널 연결 ─────────────────────────
    const [group1, group2, group3] = await Promise.all([
      prisma.contactGroup.create({
        data: {
          organizationId: orgId,
          name:        "잠재고객",
          description: "관심은 있지만 아직 구매 전 고객",
          color:       "#3B82F6",
          funnelId:    funnel1.id,
        },
      }),
      prisma.contactGroup.create({
        data: {
          organizationId: orgId,
          name:        "관심고객 (콜 완료)",
          description: "상담 통화 완료, 구매 검토 중",
          color:       "#F59E0B",
          funnelId:    funnel2.id,
        },
      }),
      prisma.contactGroup.create({
        data: {
          organizationId: orgId,
          name:        "구매고객 (VIP 케어)",
          description: "결제 완료 — 출발일 입력 시 VIP 케어 자동 시작",
          color:       "#C9A84C",
          funnelId:    funnel3.id,
        },
      }),
    ]);

    logger.log("[Setup/Defaults] 기본 셋업 완료", { orgId, funnels: 3, groups: 3 });

    return NextResponse.json({
      ok: true,
      message: "기본 그룹 3개 + 퍼널 3개 생성 완료!",
      setup: {
        funnels: [
          { id: funnel1.id, name: funnel1.name, group: group1.name },
          { id: funnel2.id, name: funnel2.name, group: group2.name },
          { id: funnel3.id, name: funnel3.name, group: group3.name },
        ],
      },
    });
  } catch (err) {
    logger.error("[POST /api/setup/defaults]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
