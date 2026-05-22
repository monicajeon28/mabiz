/**
 * SMS 온보딩 마법사 템플릿
 *
 * 4단계 일일 자동 발송:
 * - Day 0: 결혼 상태 (초기 발송)
 * - Day 1: 결혼년수 + 자녀정보 (24시간 후)
 * - Day 2: 나이 (48시간 후)
 * - Day 3: 여행 목적 (72시간 후)
 *
 * 신뢰도 기반 재질문 템플릿 포함
 */

export interface OnboardingSmsTemplate {
  templateKey: string;
  stage: 0 | 1 | 2 | 3 | 4;
  text: string;
  retryCount: number;
  nextDayIfNoResponse: number;
  examples: string[];
}

/**
 * 기본 4단계 템플릿
 */
export const ONBOARDING_TEMPLATES: Record<string, OnboardingSmsTemplate> = {
  // Day 0: 결혼 상태
  ONBOARDING_DAY0: {
    templateKey: 'ONBOARDING_DAY0',
    stage: 0,
    text: '안녕하세요, [NAME]님! 🌊\n결혼 상태가 어떻게 되세요?\n1) 미혼  2) 결혼  3) 그 외\n(숫자로 답변해주세요)',
    retryCount: 2,
    nextDayIfNoResponse: 1,
    examples: ['1', '2', '결혼', '신혼'],
  },

  // Day 1: 결혼년수 + 자녀정보
  ONBOARDING_DAY1: {
    templateKey: 'ONBOARDING_DAY1',
    stage: 1,
    text: '감사합니다! 💌\n(1) 결혼하신 지 몇 년 되셨어요?\n(2) 자녀분 몇 분 계세요? (있으면 나이는?)\n예: "결혼 5년, 아이 2명 10살 8살"',
    retryCount: 2,
    nextDayIfNoResponse: 2,
    examples: [
      '신혼',
      '5년',
      '결혼 5년',
      '3년, 자녀 없음',
      '결혼 8년, 아이 2명 12살 10살',
    ],
  },

  // Day 2: 나이
  ONBOARDING_DAY2: {
    templateKey: 'ONBOARDING_DAY2',
    stage: 2,
    text: '정보 감사합니다! 🎁\n혹시 나이가 어떻게 되세요?\n(예: 45, 35살, 40대)',
    retryCount: 2,
    nextDayIfNoResponse: 3,
    examples: ['45', '35살', '40대', '45세'],
  },

  // Day 3: 여행 목적
  ONBOARDING_DAY3: {
    templateKey: 'ONBOARDING_DAY3',
    stage: 3,
    text: '마지막 질문입니다! 🚢\n크루즈 여행의 목적이 뭔가요? (1개 선택)\n1) 휴식/힐링\n2) 모험/새로운 경험\n3) 가족/추억\n4) 문화/역사',
    retryCount: 1,
    nextDayIfNoResponse: 4,
    examples: ['1', '휴식', '가족', '문화'],
  },

  // 재질문 - Day 0
  RETRY_DAY0: {
    templateKey: 'RETRY_DAY0',
    stage: 0,
    text: '죄송해요! 😊\n"신혼", "3년", "10년" 형식으로 다시 답변 부탁드려요.\n또는 숫자 1~3으로도 가능합니다!',
    retryCount: 1,
    nextDayIfNoResponse: 1,
    examples: ['신혼', '1', '결혼 2년'],
  },

  // 재질문 - Day 1
  RETRY_DAY1: {
    templateKey: 'RETRY_DAY1',
    stage: 1,
    text: '죄송해요! 😊\n"결혼 5년, 아이 2명 10살 8살" 형식으로 다시 답변해주세요.\n결혼년수만 있어도 괜찮습니다!',
    retryCount: 1,
    nextDayIfNoResponse: 2,
    examples: ['5년', '결혼 5년', '아이 없음', '3명 15살 13살 10살'],
  },

  // 재질문 - Day 2
  RETRY_DAY2: {
    templateKey: 'RETRY_DAY2',
    stage: 2,
    text: '죄송해요! 😊\n"45", "35살", "40대" 형식으로 답변 부탁드려요.',
    retryCount: 1,
    nextDayIfNoResponse: 3,
    examples: ['45', '50살', '35세'],
  },

  // 재질문 - Day 3
  RETRY_DAY3: {
    templateKey: 'RETRY_DAY3',
    stage: 3,
    text: '죄송해요! 😊\n"1" (휴식) ~ "4" (문화) 중 1개를 선택해주세요!',
    retryCount: 1,
    nextDayIfNoResponse: 4,
    examples: ['1', '2', '휴식', '문화'],
  },

  // 완성 - 세그먼트별
  SUCCESS_SEGMENT_A: {
    templateKey: 'SUCCESS_SEGMENT_A',
    stage: 4,
    text: '감사합니다! 💕\n당신은 [신혼 특가] 고객이에요.\n신혼 전용 크루즈 패키지 20% 할인이 준비되어 있습니다!\n지금 신청하면 추가 5% 할인까지!',
    retryCount: 0,
    nextDayIfNoResponse: -1,
    examples: [],
  },

  SUCCESS_SEGMENT_B: {
    templateKey: 'SUCCESS_SEGMENT_B',
    stage: 4,
    text: '감사합니다! 👨‍👩‍👧‍👦\n당신은 [가족 중심] 고객이에요.\n아이와 함께 만드는 크루즈 여행!\n자녀 교육 여행 패키지 특가 지금 신청 가능!',
    retryCount: 0,
    nextDayIfNoResponse: -1,
    examples: [],
  },

  SUCCESS_SEGMENT_C: {
    templateKey: 'SUCCESS_SEGMENT_C',
    stage: 4,
    text: '감사합니다! ✈️\n당신은 [자유로운 여행] 고객이에요.\n당신만의 일정으로 즐기는 크루즈!\n프리미엄 포트시티 옵션 특가 지금 가능!',
    retryCount: 0,
    nextDayIfNoResponse: -1,
    examples: [],
  },

  SUCCESS_SEGMENT_D: {
    templateKey: 'SUCCESS_SEGMENT_D',
    stage: 4,
    text: '감사합니다! 🌅\n당신은 [편안한 여행] 고객이에요.\n건강 관리 중심의 크루즈 여행!\n의료 지원 + 배멀미 예방 패키지 특가!',
    retryCount: 0,
    nextDayIfNoResponse: -1,
    examples: [],
  },

  // 노응답 - 1주일 경과
  REMINDER_WEEK_PASSED: {
    templateKey: 'REMINDER_WEEK_PASSED',
    stage: 0,
    text: '안녕하세요, [NAME]님! 🌊\n저희의 SMS를 받으셨나요?\n아직 응답이 없으시면, 짧은 설문으로 특별 혜택을 받아보세요!\n(클릭: [링크])',
    retryCount: 0,
    nextDayIfNoResponse: -1,
    examples: [],
  },

  // 수동 검토 필요
  MANUAL_REVIEW_REQUIRED: {
    templateKey: 'MANUAL_REVIEW_REQUIRED',
    stage: 0,
    text: '안녕하세요, [NAME]님! 🌊\n더 정확한 정보 수집을 위해 전문가가 연락드리겠습니다.\n편한 시간에 전화 받아주세요!',
    retryCount: 0,
    nextDayIfNoResponse: -1,
    examples: [],
  },
};

/**
 * 세그먼트별 성공 메시지 템플릿 조회
 */
export function getSuccessTemplate(segment: string): OnboardingSmsTemplate {
  const key = `SUCCESS_SEGMENT_${segment}` as const;
  return (
    ONBOARDING_TEMPLATES[key] || ONBOARDING_TEMPLATES.SUCCESS_SEGMENT_A
  );
}

/**
 * 재질문 템플릿 조회
 */
export function getRetryTemplate(day: 0 | 1 | 2 | 3): OnboardingSmsTemplate {
  const key = `RETRY_DAY${day}` as const;
  return ONBOARDING_TEMPLATES[key] || ONBOARDING_TEMPLATES.ONBOARDING_DAY0;
}

/**
 * 날짜별 기본 템플릿 조회
 */
export function getDayTemplate(day: 0 | 1 | 2 | 3): OnboardingSmsTemplate {
  const key = `ONBOARDING_DAY${day}` as const;
  return ONBOARDING_TEMPLATES[key] || ONBOARDING_TEMPLATES.ONBOARDING_DAY0;
}

/**
 * 템플릿 텍스트에서 [NAME] 치환
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(`[${key}]`, value);
  });
  return result;
}

/**
 * 템플릿 초기화 (DB에 저장할 SQL)
 * Seed 파일에서 사용
 */
export const ONBOARDING_SEED_SQL = `
-- SMS 온보딩 템플릿 초기화
INSERT INTO "SmsTemplate" ("id", "organizationId", "templateKey", "content", "createdAt", "updatedAt")
SELECT
  'tpl-' || substr(md5(random()::text), 0, 12),
  org."id",
  'ONBOARDING_DAY0',
  '안녕하세요, [NAME]님! 🌊\n결혼 상태가 어떻게 되세요?\n1) 미혼  2) 결혼  3) 그 외\n(숫자로 답변해주세요)',
  NOW(),
  NOW()
FROM "Organization" org
WHERE NOT EXISTS (
  SELECT 1 FROM "SmsTemplate"
  WHERE "organizationId" = org."id"
  AND "templateKey" = 'ONBOARDING_DAY0'
)
AND org."status" = 'ACTIVE'
ON CONFLICT DO NOTHING;
`;
