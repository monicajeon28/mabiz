import prisma from '@/lib/prisma'
import type { PsychologyLens, DayMessage } from '@/types/funnel-wizard'

// L0~L10 렌즈별 Day 0-3 메시지 템플릿 (PASONA 구조)
const LENS_TEMPLATES: Record<PsychologyLens, { name: string; messages: DayMessage[] }> = {
  L0: {
    name: 'L0: 부재중 고객 재진입',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, 지난 6개월간 크루즈 요금 평균 45% 인상됐어요. 지금 안 하면 다음은 700만원 수준입니다', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '{{상품명}} 재탑승객 97%가 "2년 뒤면 다시 못 탈 거 같아서" 재예약했어요. 평점 4.9/5 ⭐', variables: ['상품명'] },
      { day: 2, pasona: 'OFFER', content: '복귀 고객만: 420만원 (정가 500만원, 16% 할인) 스위트는 매진. 데크뷰 4석만 남음', variables: [] },
      { day: 3, pasona: 'ACTION', content: '2년 뒤 다시 못 탑니다. {{담당자명}}님께 연락주세요 ({{전화번호}})', variables: ['담당자명', '전화번호'] },
    ],
  },
  L1: {
    name: 'L1: 가격 이의 고객',
    messages: [
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님 알아요. 비싸 보이죠? 월 3.3만원 (스타벅스 커피 15K처럼 작은 금액)! [금액표]', variables: ['고객명'] },
      { day: 1, pasona: 'AGITATE', content: '호텔+비행기+식사 = 3,000만원 vs 우리 크루즈 = 2,800만원 (27% 저렴 + 올인클루시브)', variables: [] },
      { day: 2, pasona: 'OFFER', content: '특별 할부: 월 33K 멤버십 + 상품비 월 50K 분할 (무이자, 60개월) 이자 0원', variables: [] },
      { day: 3, pasona: 'ACTION', content: '여름 성수기 자리 많지 않아요. {{담당자명}}님에게 지금 물어보세요 ({{전화번호}})', variables: ['담당자명', '전화번호'] },
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
      { day: 0, pasona: 'PROBLEM', content: '{{고객명}}님, {{출발일}}까지 정말 남지 않았습니다! 지금 선실: {{남은석수}}석 남음 | {{예약중석수}}석 예약 중입니다', variables: ['고객명', '출발일', '남은석수', '예약중석수'] },
      { day: 1, pasona: 'AGITATE', content: '어제 {{남은석수_전일}}석 → 지금 {{남은석수}}석으로 줄었어요. {{예약중석수}}명이 결정 중입니다. 변할 수 있어요!', variables: ['남은석수_전일', '남은석수', '예약중석수'] },
      { day: 2, pasona: 'OFFER', content: '가격: 정가 500만원 → 지금만 420만원 (80만원 절약). 현재 {{여권제출완료}}명은 예약 진행 중입니다', variables: ['여권제출완료'] },
      { day: 3, pasona: 'ACTION', content: '지금 결정 → 이 크루즈 오션뷰 확정! 더 미루면? 현재 {{예약중인원}}명이 예약 중입니다. {{담당자명}}님에게 지금 전화 ({{전화번호}})', variables: ['예약중인원', '담당자명', '전화번호'] },
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
      { day: 0, pasona: 'NARROW', content: '{{고객명}}님, 최종 견적 정리됐습니다. 현재: {{여권대기}}명 여권 대기 중 | {{예약진행}}명 예약 진행 중 | {{여권완료}}명 제출 완료', variables: ['고객명', '여권대기', '예약진행', '여권완료'] },
      { day: 1, pasona: 'NARROW', content: '당신이 원하던 오션뷰는 지금 {{남은오션뷰}}개만 남았어요. {{예약진행}}명이 이미 결정 단계입니다. 내일 통화로 결정하세요', variables: ['남은오션뷰', '예약진행'] },
      { day: 2, pasona: 'ACTION', content: '📞 {{담당자명}} ({{전화번호}})으로 지금 전화주세요. 현재 {{예약진행}}명이 예약 진행 중입니다. 당신의 선택을 기다립니다', variables: ['담당자명', '전화번호', '예약진행'] },
      { day: 3, pasona: 'ACTION', content: '⏰ 최종: Phone Call로 상담 → 대면 또는 계약으로 확정됩니다. 결정하셨으면 {{담당자명}}님과 일정 잡으세요 ({{전화번호}})', variables: ['담당자명', '전화번호'] },
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
