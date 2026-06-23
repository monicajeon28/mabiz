import prisma from '@/lib/prisma'
import type { PsychologyLens, DayMessage } from '@/types/funnel-wizard'

// L0~L10 렌즈별 Day 0-3 메시지 템플릿 (PASONA 구조)
const LENS_TEMPLATES: Record<PsychologyLens, { name: string; messages: DayMessage[] }> = {
  L0: {
    name: 'L0: 부재중 고객 재진입',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 지난 3개월 동안 안녕하셨나요? 여행 계획은?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '최근 떠나는 크루즈는 {{상품명}}, 정말 인기예요!', variables: ['상품명'] },
      { day: 2, pasona: 'OFFER', content: '복귀 고객 특가: 원래 500만원 → 이번엔 420만원', variables: [] },
      { day: 3, pasona: 'ACTION', content: '오늘 예약하면 10만원 추가 할인! {{담당자명}}님께 연락주세요', variables: ['담당자명'] },
    ],
  },
  L1: {
    name: 'L1: 가격 이의 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 가격이 부담스러우신가요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '{{상품명}}은 같은 가격대에서 최고의 서비스를 제공합니다', variables: ['상품명'] },
      { day: 2, pasona: 'OFFER', content: '특별: 월 60만원씩 5개월 할부 가능! 이자 없음 😊', variables: [] },
      { day: 3, pasona: 'ACTION', content: '할부 조건 확인하러 가기: {{담당자명}}님께 전화 바랍니다', variables: ['담당자명'] },
    ],
  },
  L2: {
    name: 'L2: 준비 불안 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 준비가 복잡할까봐 걱정하세요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '우리는 여권부터 비자까지 모두 대행해드립니다 ✓', variables: [] },
      { day: 2, pasona: 'OFFER', content: '준비 대행 서비스 100% 무료! 복잡함은 우리 몫입니다', variables: [] },
      { day: 3, pasona: 'ACTION', content: '준비 일정표 받아보기: {{담당자명}} ({{전화번호}})', variables: ['담당자명', '전화번호'] },
    ],
  },
  L3: {
    name: 'L3: 경쟁사 비교 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, Royal이랑 우리의 차이가 궁금하신가요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '우리는 한국말 가이드, 한국식 음식 🍜, 24시간 한국 담당자가 있습니다', variables: [] },
      { day: 2, pasona: 'OFFER', content: '비교표 다운로드: 우리 vs Royal 객실, 서비스, 가격 비교', variables: [] },
      { day: 3, pasona: 'ACTION', content: '비교 후 결정하세요! {{담당자명}} ({{전화번호}})', variables: ['담당자명', '전화번호'] },
    ],
  },
  L4: {
    name: 'L4: 자유도 우려 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 구속감이 없을까요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '우리 크루즈는 자유로운 포트 투어, 일정 변경 가능합니다 😊', variables: [] },
      { day: 2, pasona: 'OFFER', content: '출발 30일 전 무료 취소 가능! 완전히 자유로워요', variables: [] },
      { day: 3, pasona: 'ACTION', content: '자유도 정책 상세 보기: {{담당자명}}님께 연락주세요', variables: ['담당자명'] },
    ],
  },
  L5: {
    name: 'L5: 능력 불신 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 정말 즐거울까요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '매년 10만명 이상이 우리 크루즈를 선택합니다 ✓', variables: [] },
      { day: 2, pasona: 'OFFER', content: '고객 후기: 평점 4.8/5.0, 재방문율 87%! 정말 좋습니다 😍', variables: [] },
      { day: 3, pasona: 'ACTION', content: '후기 영상 보기 & 예약: {{담당자명}} ({{전화번호}})', variables: ['담당자명', '전화번호'] },
    ],
  },
  L6: {
    name: 'L6: 타이밍 중요 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, {{출발일}}까지 정말 남지 않았습니다!', variables: ['고객명', '출발일'] },
      { day: 1, pasona: 'AGITATE', content: '이 가격은 오늘까지만 유효합니다. 내일은 더 올라요 📈', variables: [] },
      { day: 2, pasona: 'OFFER', content: '오늘 예약 시 총 100만원 할인! (다른 분에게는 안 줍니다)', variables: [] },
      { day: 3, pasona: 'ACTION', content: '지금 바로 결정하세요! {{담당자명}}에게 전화 바랍니다 ☎️', variables: ['담당자명'] },
    ],
  },
  L7: {
    name: 'L7: 가족 설득 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 가족이 망설이신가요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '가족 모두 함께 즐기는 크루즈 여행 🚢 이게 최고의 추억입니다', variables: [] },
      { day: 2, pasona: 'OFFER', content: '가족 4인 패키지: 원래 2000만원 → 1,699만원! 맏형 특가', variables: [] },
      { day: 3, pasona: 'ACTION', content: '가족과 함께 예약하세요: {{담당자명}}님께 연락 부탁드립니다', variables: ['담당자명'] },
    ],
  },
  L8: {
    name: 'L8: 습관 형성 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 매해 여행하고 싶으신가요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '한 번 타보면 자꾸 또 가고 싶어지는 우리 크루즈! 😊', variables: [] },
      { day: 2, pasona: 'OFFER', content: '연회원 가입: 매년 특가 20~30%, 포인트 2배 적립!', variables: [] },
      { day: 3, pasona: 'ACTION', content: '연회원 신청하기: {{담당자명}} ({{전화번호}})', variables: ['담당자명', '전화번호'] },
    ],
  },
  L9: {
    name: 'L9: 건강 신뢰 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 코로나 걱정하세요?', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '우리 크루즈는 100% 예방접종 승무원, 매일 소독합니다 ✓', variables: [] },
      { day: 2, pasona: 'OFFER', content: '건강 보증: 코로나 확진 시 전액 환불! 안심하고 즐기세요', variables: [] },
      { day: 3, pasona: 'ACTION', content: '건강 안전 정책 보기: {{담당자명}}님께 물어보세요 ☎️', variables: ['담당자명'] },
    ],
  },
  L10: {
    name: 'L10: 즉시 구매 고객',
    messages: [
      { day: 0, pasona: 'NARROW', content: '{{고객명}}님, 이미 마음은 정하셨죠? 🎯', variables: ['고객명'] },
      { day: 1, pasona: 'NARROW', content: '딱 하나만 확인하면 바로 예약 가능합니다!', variables: [] },
      { day: 2, pasona: 'ACTION', content: '지금 결정하면 오늘 특가 적용! 내일은 원가입니다 😅', variables: [] },
      { day: 3, pasona: 'ACTION', content: '예약하기 (클릭): {{담당자명}} ☎️ 지금 바로!', variables: ['담당자명'] },
    ],
  },
}

async function seedFunnelLensTemplates() {
  console.log('🌱 Seeding funnel lens templates...')

  try {
    // 각 렌즈별 Funnel 생성
    for (const [lens, { name, messages }] of Object.entries(LENS_TEMPLATES)) {
      const funnel = await prisma.funnel.create({
        data: {
          organizationId: 'GLOBAL_WIZARD_ORG',
          name,
          description: `${lens} 렌즈 기반 자동메시지 템플릿`,
          funnelType: 'SMS_WIZARD',
          visibility: 'PUBLIC',
          autoGenerated: true,
          psychologyLens: lens as PsychologyLens,
          templateVersion: 1,
        },
      })

      console.log(`✅ Created Funnel: ${name} (${funnel.id})`)
    }

    console.log('✅ Seeding completed!')
  } catch (error) {
    console.error('❌ Seeding error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedFunnelLensTemplates()
