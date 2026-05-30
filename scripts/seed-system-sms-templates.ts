/**
 * 시스템 SMS 템플릿 시드 스크립트
 * 실행: npx ts-node scripts/seed-system-sms-templates.ts
 *
 * messages 페이지 카테고리 (DAY_0~3, CARE_VIP, SEQUENCE, LIVE_BROADCAST, GENERAL)에 맞는
 * isSystem=true 템플릿 32개 생성
 */

import prisma from '../src/lib/prisma';

const TEMPLATES = [
  // ── DAY 0: 초대/문제 ─────────────────────────────
  {
    category: 'DAY_0', isSystem: true,
    title: '[Day0] 첫 인사 + 관심 확인',
    content: '[이름]님, 안녕하세요! [담당자]입니다 😊\n크루즈 여행에 관심 있으신가요?\n무료 상담 예약: [링크]',
    triggerType: 'DAY_0', triggerOffset: 0,
  },
  {
    category: 'DAY_0', isSystem: true,
    title: '[Day0] 특별 혜택 첫 소개',
    content: '[이름]님께만 드리는 특별 안내입니다.\n이번 달 [상품명] 얼리버드 마감 임박!\n상담 신청: [링크]',
    triggerType: 'DAY_0', triggerOffset: 0,
  },
  {
    category: 'DAY_0', isSystem: true,
    title: '[Day0] 재활성화 - 오랜만에 연락',
    content: '[이름]님, 오래간만이에요 😊 [담당자]입니다.\n최근 [상품명] 문의 고객님들께 드리는 특별 혜택이 있어 연락드렸어요. 잠깐 통화 가능하실까요?',
    triggerType: 'DAY_0', triggerOffset: 0,
  },
  {
    category: 'DAY_0', isSystem: true,
    title: '[Day0] 손실회피 - 마감 임박',
    content: '[이름]님! [상품명] 잔여석 3석만 남았어요 🚢\n[출발일] 출발, 지금 신청 안 하시면 정말 못 가세요.\n지금 바로: [링크]',
    triggerType: 'DAY_0', triggerOffset: 0,
  },

  // ── DAY 1: 자극/솔루션 ───────────────────────────
  {
    category: 'DAY_1', isSystem: true,
    title: '[Day1] 이의 대응 - 가격 부담',
    content: '[이름]님, 어제 말씀드린 [상품명] 기억하시죠?\n"비싸다"는 걱정, 사실 1박 기준으로 나누면 호텔+식사+관광 모두 포함해서 훨씬 저렴해요.\n자세한 내역 문자로 보내드릴까요?',
    triggerType: 'DAY_1', triggerOffset: 1,
  },
  {
    category: 'DAY_1', isSystem: true,
    title: '[Day1] 사회 증명 - 후기 전달',
    content: '[이름]님 안녕하세요, [담당자]입니다!\n지난달 같은 상품 다녀오신 고객님 후기 공유해요 😊\n"처음엔 망설였는데, 진짜 인생 여행이었어요!" - 실제 후기\n상담: [링크]',
    triggerType: 'DAY_1', triggerOffset: 1,
  },
  {
    category: 'DAY_1', isSystem: true,
    title: '[Day1] 준비 이의 - 복잡하지 않아요',
    content: '[이름]님, [담당자]예요!\n여권, 짐 준비 복잡하실까봐 걱정되시죠? 제가 체크리스트 만들어 드릴게요. 출발 전까지 모든 준비 도와드려요 ✅',
    triggerType: 'DAY_1', triggerOffset: 1,
  },
  {
    category: 'DAY_1', isSystem: true,
    title: '[Day1] SPIN - 현재 상황 확인',
    content: '[이름]님! 어제 말씀 나눈 [담당자]입니다.\n지금 가장 가고 싶은 [목적지] 어떠세요? 혹시 함께 가실 분 계신가요? 맞춤 제안 드리고 싶어서요 😊',
    triggerType: 'DAY_1', triggerOffset: 1,
  },

  // ── DAY 2: 오퍼 ─────────────────────────────────
  {
    category: 'DAY_2', isSystem: true,
    title: '[Day2] 오퍼 제안 - 최종 가격',
    content: '[이름]님, [담당자]예요!\n오늘 딱 [이름]님을 위한 특가 확인했어요.\n[상품명] [출발일] 출발 / [가격] (조식 포함)\n오늘까지만 이 가격이에요. 결정 어떠세요?',
    triggerType: 'DAY_2', triggerOffset: 2,
  },
  {
    category: 'DAY_2', isSystem: true,
    title: '[Day2] 가치 재정의 - 프리미엄 강조',
    content: '[이름]님! [상품명] 다시 한번 말씀드릴게요.\n✅ 모든 식사 포함\n✅ [목적지] 기항\n✅ 선내 오락/수영장 무료\n이 가격에 이 혜택, 다른 데선 못 찾아요 🛳️',
    triggerType: 'DAY_2', triggerOffset: 2,
  },
  {
    category: 'DAY_2', isSystem: true,
    title: '[Day2] 업셀 - 객실 업그레이드',
    content: '[이름]님, [담당자]입니다!\n오늘만 발코니 객실 추가금 없이 업그레이드 기회가 있어요 🌊\n바다 보면서 아침 드시는 기분 상상해보세요. 바로 신청하시겠어요?',
    triggerType: 'DAY_2', triggerOffset: 2,
  },
  {
    category: 'DAY_2', isSystem: true,
    title: '[Day2] 동반자 설득 - 가족/배우자',
    content: '[이름]님, 배우자분과 함께 가시는 거라면 특별 커플 패키지 안내해드릴 수 있어요 💑\n둘이 가면 1인당 [가격]으로 더 저렴해요. 같이 보여주셔도 좋아요: [링크]',
    triggerType: 'DAY_2', triggerOffset: 2,
  },

  // ── DAY 3: 긴박/액션 ─────────────────────────────
  {
    category: 'DAY_3', isSystem: true,
    title: '[Day3] 최종 마감 - 강력 촉구',
    content: '[이름]님! [담당자]입니다.\n⚠️ [상품명] [출발일] 마감이 오늘 자정이에요.\n3일 동안 말씀드린 그 상품, 오늘이 마지막 기회입니다.\n지금 바로 → [링크]',
    triggerType: 'DAY_3', triggerOffset: 3,
  },
  {
    category: 'DAY_3', isSystem: true,
    title: '[Day3] 손실회피 최종',
    content: '🚨 [이름]님, 마지막 연락이에요.\n[상품명] 잔여석 1석 남았고, 오늘 다른 분이 계약하실 것 같아요.\n지금 결정 못 하시면 다음 기회는 내년이에요. 통화 가능하세요?',
    triggerType: 'DAY_3', triggerOffset: 3,
  },
  {
    category: 'DAY_3', isSystem: true,
    title: '[Day3] 클로징 - Yes/No 직접 요청',
    content: '[이름]님, 솔직하게 여쭤볼게요.\n[상품명] [출발일] 출발 — 함께 가시겠어요, 아니면 다음에 보실건가요?\n YES면 지금 바로 예약금 50만원으로 자리 확보해드릴게요 💪',
    triggerType: 'DAY_3', triggerOffset: 3,
  },
  {
    category: 'DAY_3', isSystem: true,
    title: '[Day3] 재예약 제안',
    content: '[이름]님, [담당자]예요.\n이번에 어려우시면 다음 출발일 미리 알려드릴게요!\n[출발일] 다음은 언제 가능하신지 간단히 알려주시면 딱 맞는 상품 찾아드릴게요 😊',
    triggerType: 'DAY_3', triggerOffset: 3,
  },

  // ── VIP 케어 ─────────────────────────────────────
  {
    category: 'CARE_VIP', isSystem: true,
    title: '[VIP] 예약 완료 감사 + 기대감 조성',
    content: '[이름]님, 예약 완료됐습니다! 🎉\n[출발일] [출발지] 출발 — 정말 기대되죠?\n출발 전까지 필요한 건 뭐든지 [담당자]에게 말씀해주세요 ✨',
    triggerType: 'VIP_BOOKED', triggerOffset: 0,
  },
  {
    category: 'CARE_VIP', isSystem: true,
    title: '[VIP] 출발 1주일 전 안내',
    content: '[이름]님! [담당자]예요 😊\n[출발일] 출발이 딱 1주 남았네요!\n짐 체크리스트, 기항지 날씨, 환전 팁 알려드릴까요?',
    triggerType: 'VIP_PRE_DEPARTURE', triggerOffset: -7,
  },
  {
    category: 'CARE_VIP', isSystem: true,
    title: '[VIP] 귀국 후 후기 요청',
    content: '[이름]님, 돌아오셨나요? 🛳️ 여행 어떠셨어요?\n솔직한 후기 하나만 남겨주시면 다음에 더 좋은 상품 추천해드릴게요. 정말 소중해요 🙏\n[링크]',
    triggerType: 'VIP_POST_TRIP', triggerOffset: 2,
  },
  {
    category: 'CARE_VIP', isSystem: true,
    title: '[VIP] 재구매 제안',
    content: '[이름]님, [담당자]예요!\n지난번 여행 즐거우셨죠? 다음 [목적지] 출발 일정이 나왔어요.\n VIP 고객님께 먼저 안내드려요 😊 관심 있으시면 알려주세요!',
    triggerType: 'VIP_REPURCHASE', triggerOffset: 30,
  },

  // ── 시퀀스 ───────────────────────────────────────
  {
    category: 'SEQUENCE', isSystem: true,
    title: '[시퀀스] 자동화 Day0 → 대화 유도',
    content: '[이름]님 안녕하세요! [담당자]입니다.\n크루즈 여행 관심 있으신 것 같아 연락드렸어요.\n궁금한 점 있으시면 편하게 문자 주세요 😊',
    triggerType: 'SEQUENCE_START', triggerOffset: 0,
  },
  {
    category: 'SEQUENCE', isSystem: true,
    title: '[시퀀스] 3일 무응답 재접촉',
    content: '[이름]님, 바쁘셨죠? [담당자]예요.\n3일 전에 문자 드렸는데, 혹시 못 보셨을까봐 다시 한번 연락드려요.\n5분만 통화 가능하신가요?',
    triggerType: 'SEQUENCE_FOLLOWUP', triggerOffset: 3,
  },
  {
    category: 'SEQUENCE', isSystem: true,
    title: '[시퀀스] 7일 장기 팔로업',
    content: '[이름]님, [담당자]입니다.\n지난주에 [상품명] 말씀드렸었는데, 아직 결정 어려우신가요?\n부담 없이 궁금한 것만 여쭤보셔도 돼요 😊',
    triggerType: 'SEQUENCE_WEEK', triggerOffset: 7,
  },

  // ── 라이브 방송 ──────────────────────────────────
  {
    category: 'LIVE_BROADCAST', isSystem: true,
    title: '[라방] 방송 시작 안내',
    content: '🔴 [이름]님! 지금 라이브 방송 시작했어요!\n[상품명] 특가 + 실시간 Q&A 진행 중이에요.\n지금 바로 → [링크]',
    triggerType: 'LIVE_START', triggerOffset: 0,
  },
  {
    category: 'LIVE_BROADCAST', isSystem: true,
    title: '[라방] 방송 전날 예고',
    content: '[이름]님, [담당자]예요!\n내일 오후 2시에 [상품명] 라이브 방송 해요 🎬\n한정 특가 공개 + 실시간 상담까지! 알림 설정하고 기다려 주세요 😊',
    triggerType: 'LIVE_REMINDER', triggerOffset: -1,
  },
  {
    category: 'LIVE_BROADCAST', isSystem: true,
    title: '[라방] 방송 후 특가 마감',
    content: '[이름]님, 오늘 방송 보셨나요? 🛳️\n방송 특가 오늘 자정까지예요!\n[상품명] [가격] → 지금 바로: [링크]',
    triggerType: 'LIVE_AFTER', triggerOffset: 0,
  },

  // ── 일반 ─────────────────────────────────────────
  {
    category: 'GENERAL', isSystem: true,
    title: '[일반] 간단 안부 + 상담 제안',
    content: '[이름]님, 안녕하세요! [담당자]입니다.\n요즘 여행 계획 있으신가요? 좋은 상품 하나 소개해드리고 싶어서요 😊',
    triggerType: null, triggerOffset: null,
  },
  {
    category: 'GENERAL', isSystem: true,
    title: '[일반] 설명절 인사',
    content: '[이름]님, 명절 잘 보내고 계신가요? 😊\n[담당자]입니다. 늘 건강하시고 좋은 일만 가득하시길 바라요.\n여행 계획 있으시면 언제든 연락 주세요 🙏',
    triggerType: null, triggerOffset: null,
  },
  {
    category: 'GENERAL', isSystem: true,
    title: '[일반] 이미지 첨부용 메시지',
    content: '[이름]님, [담당자]입니다!\n아래 이미지 확인해 보세요 😊\n더 궁금하신 것 있으면 언제든 연락 주세요!',
    triggerType: null, triggerOffset: null,
  },
  {
    category: 'GENERAL', isSystem: true,
    title: '[일반] 링크 전달',
    content: '[이름]님! 말씀드렸던 내용 링크로 보내드려요.\n[링크]\n보시고 궁금한 점 있으면 편하게 물어보세요 😊',
    triggerType: null, triggerOffset: null,
  },
];

async function main() {
  console.log(`총 ${TEMPLATES.length}개 시스템 템플릿 시드 시작...`);

  let created = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.smsTemplate.findFirst({
      where: { title: t.title, isSystem: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.smsTemplate.create({
      data: {
        organizationId: null,  // isSystem=true면 organizationId null → 전체 공유
        category: t.category,
        title: t.title,
        content: t.content,
        triggerType: t.triggerType ?? null,
        triggerOffset: t.triggerOffset ?? null,
        isSystem: true,
        usageCount: 0,
      },
    });
    created++;
    console.log(`  ✅ ${t.title}`);
  }

  console.log(`\n완료: 생성 ${created}개, 스킵(이미 있음) ${skipped}개`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect(); });
