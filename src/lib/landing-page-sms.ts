/**
 * Russell Brunson 8가지 형식별 SMS 자동화 템플릿
 *
 * Day 0-3 PASONA 프레임워크:
 * - Day 0: P(Problem) + A(Agitate) → 문제 인식 + 감정 자극
 * - Day 1: S(Solution) → 해결책 제시
 * - Day 2: O(Offer) + N(Narrow) → 오퍼 제시 + 한정 범위 좁힘
 * - Day 3: A(Action) → 행동 촉구
 *
 * SMS 템플릿은 동적 치환 지원:
 * - [LINK]: 랜딩페이지 URL
 * - [CTA]: CTA 버튼 텍스트
 * - [COMPANY]: 회사명
 * - [PRODUCT]: 상품명
 * - [STOCK]: 남은 자리/수량
 *
 * 2026-06-15 v1.0
 */

import { PageFormat } from "@/lib/landing-page-formats";

// Dynamic import pattern for prisma (only in server-side functions)
// Use: const prisma = (await import("@/lib/prisma")).default;

/**
 * SMS 템플릿 인터페이스
 */
export interface SmsTemplate {
  text: string;
  schedule: string; // "+0d 09:00" 형식
  pasona: string; // "P", "S", "O+N", "A" 등
  psychology: string; // 심리학 기법 설명
  lens: string; // "L0", "L1" 등
}

/**
 * 형식별 SMS 템플릿 정의
 *
 * 각 형식별 Day 0-3 SMS 시퀀스
 */
export const SMS_TEMPLATES_BY_FORMAT: Record<PageFormat, Record<number, SmsTemplate>> = {
  // 1. Squeeze: 신청 직후 즉시 (Day 0만)
  // 목표: 신청 확인 + 감사 + 다음 단계 명확화
  squeeze: {
    0: {
      text: `안녕하세요! 😊 신청해주셨네요.
감사합니다!

📋 다음 단계:
매니저가 1시간 내 [CTA] 확인 연락을 드릴게요.
문의: [COMPANY]

👉 [LINK]`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "신청 확인 (안도감) + 신뢰도 (1시간 약속)",
      lens: "L0"
    }
  },

  // 2. VSL (Video Sales Letter): 풀 시퀀스
  // 목표: 영상 판매 레터의 스토리텔링을 SMS로 강화
  vsl: {
    0: {
      text: `🎬 영상 보셨나요?

이 내용은 정말 많은 분들의 인생을 바꾸셨어요.

당신도 같은 결과를 원하신다면
👉 [LINK]

[COMPANY]`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "사회증명 (많은 분들) + 공감 (인생 변화)",
      lens: "L10"
    },
    1: {
      text: `어제 영상 어떠셨나요? 😊

**3가지 핵심 포인트:**
✅ [첫 번째 핵심]
✅ [두 번째 핵심]
✅ [세 번째 핵심]

자세히 알아보기
👉 [LINK]`,
      schedule: "+1d 10:00",
      pasona: "S",
      psychology: "해결책 3가지 제시 (명확성)",
      lens: "L10"
    },
    2: {
      text: `좋은 소식! 💚

**실제 고객들의 결과:**
- 만족도 95점 이상
- 재구매율 92%
- 추천도 89%

👉 [LINK]에서 확인하세요`,
      schedule: "+2d 18:00",
      pasona: "O+N",
      psychology: "사회증명 (고객 결과) + 한정 범위 좁히기",
      lens: "L6"
    },
    3: {
      text: `마지막 기회입니다! 🔥

**오늘 신청하면:**
- 평생 30% 할인 확정
- VIP 매니저 배정
- 무료 상담권 1회 증정

👉 [CTA]
시간이 정말 빨라요...`,
      schedule: "+3d 09:00",
      pasona: "A",
      psychology: "희소성 (오늘) + 긴박감 + 구체적 혜택",
      lens: "L6"
    }
  },

  // 3. Webinar: 웨비나 등록 페이지
  // 목표: 전문성 강조 + 신뢰도 + 긴박감
  webinar: {
    0: {
      text: `안녕하세요! 🎓

이번 [COMPANY] 웨비나에서
실제 고객 사례를 공개합니다.

📅 날짜: [DATE]
⏰ 시간: [TIME]

👉 [LINK]에서 등록하세요`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "전문성 강조 + FOMO (사례 공개)",
      lens: "L9"
    },
    1: {
      text: `아직 등록 안 하셨나요? 😊

이번 웨비나에서는:
✅ 실제 성공 사례 3가지
✅ 실패 패턴 + 회피법
✅ 단계별 실행 플랜

👉 [LINK]`,
      schedule: "+1d 10:00",
      pasona: "S",
      psychology: "교육 가치 + 실패 회피 (안전감)",
      lens: "L9"
    },
    2: {
      text: `오늘 등록하시는 분들께: 🎁

**특별 혜택:**
- 웨비나 자료 PDF 제공 (무료)
- 녹화본 1개월 재시청 가능
- 질문 1개 무료 답변권

👉 [LINK]에서 등록`,
      schedule: "+2d 18:00",
      pasona: "O+N",
      psychology: "가치 강조 (자료) + 한정 범위 (오늘)",
      lens: "L6"
    },
    3: {
      text: `정말 마지막 기회! ⏰

내일 자정에 등록 마감됩니다.

- 자리 10개 남음
- 실제 고객 10명만 참석
- 가장 가까운 질문 기회

👉 [LINK]로 지금 등록하세요`,
      schedule: "+3d 09:00",
      pasona: "A",
      psychology: "희소성 (10명) + 시간 제한 + 긴박감",
      lens: "L6"
    }
  },

  // 4. Funnel: 다단계 퍼널 (Step 1/2/3)
  // 목표: 단계별 전환 최적화
  funnel: {
    0: {
      text: `안녕하세요! 👋

[PRODUCT] 3단계 가이드를
준비했어요.

📋 Step 1: 준비하기
📋 Step 2: 실행하기
📋 Step 3: 결과 확인하기

👉 [LINK]에서 시작하세요`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "단계 명확화 (Step 1/2/3) + 구조화",
      lens: "L0"
    },
    1: {
      text: `Step 1 완료되셨나요? 😊

**Step 2에서 알아볼 내용:**
✅ [Step 2 설명]
✅ [Step 2 설명]
✅ [Step 2 설명]

👉 [LINK]에서 계속하기`,
      schedule: "+1d 10:00",
      pasona: "S",
      psychology: "진행률 추적 (Step 2) + 호기심 유발",
      lens: "L2"
    },
    2: {
      text: `거의 다 왔어요! 💪

**Step 3 = 실제 결과**
- 측정 가능한 성과
- 구체적 숫자
- 실행 확인

👉 [LINK]에서 Step 3 진행`,
      schedule: "+2d 18:00",
      pasona: "O+N",
      psychology: "진행 격려 (거의 다 왔어) + 결과 약속",
      lens: "L10"
    },
    3: {
      text: `축하합니다! 🎉

3단계를 모두 완료하신 분들은
**평생 회원 혜택**을 받으실 수 있어요.

- VIP 커뮤니티 접근
- 월별 업데이트 자료
- 1:1 코칭 상담권

👉 [LINK]에서 회원 등록`,
      schedule: "+3d 09:00",
      pasona: "A",
      psychology: "성취감 (완료) + 보상 (평생 혜택)",
      lens: "L10"
    }
  },

  // 5. Tripwire: 저가 진입상품 → 메인 상품
  // 목표: 저가로 진입 → 고가 업셀
  tripwire: {
    0: {
      text: `🎁 특별 제안!

**19,900원에 시작하세요**

이 가격은 오늘만입니다.
내일부터는 49,900원입니다.

👉 [LINK]에서 신청`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "가격 앵커링 (가치) + 긴박감 (오늘만)",
      lens: "L1"
    },
    1: {
      text: `[PRODUCT] 신청 감사합니다! 😊

혹시 **더 많은 혜택**을 원하신가요?

프리미엄 패키지로 업그레이드하면:
✅ [혜택 1]
✅ [혜택 2]
✅ [혜택 3]

👉 [LINK]에서 확인`,
      schedule: "+1d 10:00",
      pasona: "S",
      psychology: "기본 패키지 + 업셀 제안 (추가 가치)",
      lens: "L1"
    },
    2: {
      text: `기본 vs 프리미엄 비교:

기본: 19,900원 (기본 기능)
프리미엄: 49,900원 (전체 기능) ⭐

프리미엄 고객들의 후기:
"정말 차이가 크네요!"
"이걸 처음부터 했을 걸 후회..."

👉 [LINK]에서 업그레이드`,
      schedule: "+2d 18:00",
      pasona: "O+N",
      psychology: "비교표 (명확성) + 후회 회피 (FOMO)",
      lens: "L6"
    },
    3: {
      text: `업그레이드 타이머! ⏰

기본→프리미엄 할인가:
19,900 + 29,900 = 49,900원
(원가: 69,900원)

이 조합가는 내일 자정 종료!

👉 [LINK]에서 지금 업그레이드`,
      schedule: "+3d 09:00",
      pasona: "A",
      psychology: "가격 구조 명확화 + 시간 제한 + 할인 강조",
      lens: "L1"
    }
  },

  // 6. Downsell: 거부 후 재전환
  // 목표: 거절한 고객을 저가 대안으로 재전환
  downsell: {
    0: {
      text: `혹시 가격이 문제였나요? 💭

문제없습니다!

**더 저렴한 옵션을 준비했어요:**
월 29,900원 (원래 69,900원)

👉 [LINK]에서 확인`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "공감 (가격 문제) + 해결책 (저가 옵션)",
      lens: "L1"
    },
    1: {
      text: `다운셀 패키지 특징:

✅ 핵심 기능 100% 포함
✅ 지원은 메일로 제공 (1-2일)
✅ 커뮤니티 접근 불가 (선택사항)

이 정도면 대부분의 고객에게 충분해요.

👉 [LINK]에서 확인`,
      schedule: "+1d 10:00",
      pasona: "S",
      psychology: "충분성 강조 (대부분 충분) + 투명성",
      lens: "L1"
    },
    2: {
      text: `좋은 소식! 💚

**오늘 신청하는 분들께:**
추가 10% 할인 (29,900 → 26,900원)

- 월 결제 가능
- 언제든 업그레이드 가능
- 만족도 없으면 환불

👉 [LINK]에서 신청`,
      schedule: "+2d 18:00",
      pasona: "O+N",
      psychology: "추가 할인 (가치) + 유연성 (업그레이드 가능)",
      lens: "L6"
    },
    3: {
      text: `정말 마지막 기회! 🔥

**이 가격은 오늘까지만입니다.**

- 월 26,900원 (원가: 69,900원)
- 환불 100% 보장
- 매니저 지원 포함

👉 [CTA]하기
시간이 정말 빨라요...`,
      schedule: "+3d 09:00",
      pasona: "A",
      psychology: "최종 재제안 + 보장 (신뢰) + 긴박감",
      lens: "L1"
    }
  },

  // 7. Launch: 신제품 론칭
  // 목표: 카운트다운 + 얼리버드 + 희소성
  launch: {
    0: {
      text: `🚀 런칭 카운트다운 시작!

**[PRODUCT] 론칭까지 3일!**

얼리버드 가격 (한정):
- 원가: 99,900원
- 얼리버드: 39,900원 (60% 할인)

👉 [LINK]에서 예약`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "카운트다운 (긴박감) + 얼리버드 (희소성)",
      lens: "L6"
    },
    1: {
      text: `⏰ 런칭까지 2일!

**얼리버드 남은 시간:**
- 예약 수량 100개 중 73개 예약됨
- 27개만 남았어요!

지금 예약하면:
✅ 39,900원 고정가
✅ 평생 VIP 회원권
✅ 무료 업그레이드

👉 [LINK]로 예약`,
      schedule: "+1d 10:00",
      pasona: "S",
      psychology: "희소성 (27개 남음) + 구체적 혜택",
      lens: "L6"
    },
    2: {
      text: `⏳ 런칭까지 1일!

**마지막 기회입니다!**

얼리버드 가격 (39,900원):
- 내일 자정 종료
- 그 다음부터 99,900원

지금 예약하면 60% 절약!

👉 [LINK]에서 지금 예약`,
      schedule: "+2d 18:00",
      pasona: "O+N",
      psychology: "최후 통첩 (자정 종료) + 가격 비교",
      lens: "L6"
    },
    3: {
      text: `🎉 런칭 완료!

**지금 주문하신 분들:**
✅ 얼리버드 가격 (39,900원) 확정
✅ 즉시 배송 시작 (다음날 배송)
✅ 평생 업그레이드 무료

감사합니다! 🙏

👉 [CTA]하기`,
      schedule: "+3d 09:00",
      pasona: "A",
      psychology: "달성감 (런칭 완료) + 긴급성 (지금 주문)",
      lens: "L10"
    }
  },

  // 8. Hybrid: 자유도 높음 (기본 템플릿)
  // 목표: 모든 형식에 사용 가능한 기본 시퀀스
  hybrid: {
    0: {
      text: `안녕하세요! 😊

[PRODUCT] 신청 감사합니다.

📱 매니저가 1시간 내 연락 드릴게요.
문의: [COMPANY]

👉 [LINK]`,
      schedule: "+0d 09:00",
      pasona: "P+A",
      psychology: "신청 확인 + 신뢰도 (1시간 약속)",
      lens: "L0"
    },
    1: {
      text: `어제는 신청 감사합니다! 😊

**다음 단계:**
✅ [Step 1]
✅ [Step 2]
✅ [Step 3]

👉 [LINK]에서 자세히`,
      schedule: "+1d 10:00",
      pasona: "S",
      psychology: "단계 명확화 + 진행 방향 제시",
      lens: "L2"
    },
    2: {
      text: `좋은 소식! 💚

**오늘 신청하는 분들께:**
✅ [특별 혜택 1]
✅ [특별 혜택 2]
✅ [특별 혜택 3]

👉 [LINK]에서 확인`,
      schedule: "+2d 18:00",
      pasona: "O+N",
      psychology: "한정 시간 혜택 + 구체적 가치",
      lens: "L6"
    },
    3: {
      text: `최종 결정 시간! ⏰

**지금 신청하면:**
- [혜택 1]
- [혜택 2]

내일부터는 다릅니다.

👉 [CTA]`,
      schedule: "+3d 09:00",
      pasona: "A",
      psychology: "최종 결정 촉구 + 시간 제한 + 혜택 강조",
      lens: "L10"
    }
  }
};

/**
 * SMS 템플릿 생성 함수
 *
 * 동적 치환을 수행하여 최종 SMS 텍스트 생성
 *
 * @param template 기본 템플릿 텍스트
 * @param params 치환 파라미터
 * @returns 최종 SMS 텍스트
 */
function interpolateSms(
  template: string,
  params: {
    link?: string;
    cta?: string;
    company?: string;
    product?: string;
    stock?: string | number;
    date?: string;
    time?: string;
    [key: string]: string | number | undefined;
  }
): string {
  let result = template;

  // 표준 치환
  if (params.link) result = result.replace(/\[LINK\]/g, params.link);
  if (params.cta) result = result.replace(/\[CTA\]/g, params.cta);
  if (params.company) result = result.replace(/\[COMPANY\]/g, params.company);
  if (params.product) result = result.replace(/\[PRODUCT\]/g, params.product);
  if (params.stock) result = result.replace(/\[STOCK\]/g, String(params.stock));
  if (params.date) result = result.replace(/\[DATE\]/g, params.date);
  if (params.time) result = result.replace(/\[TIME\]/g, params.time);

  // 커스텀 치환 (사용자 정의 파라미터)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && !['link', 'cta', 'company', 'product', 'stock', 'date', 'time'].includes(key)) {
      const regex = new RegExp(`\\[${key.toUpperCase()}\\]`, 'g');
      result = result.replace(regex, String(value));
    }
  });

  return result;
}

/**
 * 형식별 SMS 시퀀스 생성 함수
 *
 * Day 0-3 SMS를 동적으로 생성하여 DB에 저장
 *
 * @param pageId 랜딩페이지 ID
 * @param pageFormat 랜딩페이지 형식 (squeeze|vsl|...)
 * @param ctaText CTA 버튼 텍스트
 * @param companyName 회사명
 * @param productName 상품명
 * @param landingPageUrl 랜딩페이지 URL
 * @returns 생성된 SMS 레코드 배열
 */
export async function generateSmsSequence(
  pageId: string,
  pageFormat: PageFormat,
  ctaText: string,
  companyName?: string,
  productName?: string,
  landingPageUrl?: string
) {
  const templates = SMS_TEMPLATES_BY_FORMAT[pageFormat];
  if (!templates) {
    throw new Error(`Invalid page format: ${pageFormat}`);
  }

  // Dynamic import of prisma (server-side only)
  const { default: prisma } = await import("@/lib/prisma");

  // 기존 SMS 시퀀스 삭제 (재생성)
  await prisma.crmLandingPageSms.deleteMany({
    where: { pageId }
  });

  // 동적 치환 파라미터
  const params = {
    cta: ctaText,
    company: companyName || "[회사명]",
    product: productName || "[상품명]",
    link: landingPageUrl || "[랜딩페이지]"
  };

  // Day 0-3 SMS 생성
  const smsRecords = [];

  for (const [dayStr, template] of Object.entries(templates)) {
    const day = parseInt(dayStr, 10);

    // SMS 텍스트 동적 생성
    const finalText = interpolateSms(template.text, params);

    // DB에 저장
    const smsRecord = await prisma.crmLandingPageSms.create({
      data: {
        pageId,
        day,
        text: finalText,
        schedule: template.schedule,
        status: "PENDING"
      }
    });

    smsRecords.push(smsRecord);
  }

  return smsRecords;
}

/**
 * 특정 일자의 SMS 템플릿 조회
 *
 * @param pageFormat 페이지 형식
 * @param day 일자 (0, 1, 2, 3)
 * @returns SMS 템플릿
 */
export function getSmsTemplate(pageFormat: PageFormat, day: number): SmsTemplate | null {
  const templates = SMS_TEMPLATES_BY_FORMAT[pageFormat];
  if (!templates) return null;

  return templates[day] || null;
}

/**
 * 형식별 모든 SMS 템플릿 조회
 *
 * @param pageFormat 페이지 형식
 * @returns SMS 템플릿 배열
 */
export function getAllSmsTemplates(pageFormat: PageFormat): SmsTemplate[] {
  const templates = SMS_TEMPLATES_BY_FORMAT[pageFormat];
  if (!templates) return [];

  return Object.keys(templates)
    .map(dayStr => parseInt(dayStr, 10))
    .sort((a, b) => a - b)
    .map(day => templates[day]);
}

/**
 * SMS 템플릿 미리보기 생성
 *
 * 파라미터를 실제 값으로 치환하여 최종 SMS 모습을 보여줌
 *
 * @param pageFormat 페이지 형식
 * @param day 일자
 * @param params 치환 파라미터
 * @returns 미리보기 SMS
 */
export function previewSms(
  pageFormat: PageFormat,
  day: number,
  params: {
    link?: string;
    cta?: string;
    company?: string;
    product?: string;
    stock?: string | number;
    [key: string]: string | number | undefined;
  }
): string | null {
  const template = getSmsTemplate(pageFormat, day);
  if (!template) return null;

  return interpolateSms(template.text, params);
}

/**
 * PASONA 프레임워크 분석
 *
 * 형식별 PASONA 단계 구성 확인
 *
 * @param pageFormat 페이지 형식
 * @returns PASONA 단계별 설명
 */
export function analyzePasona(pageFormat: PageFormat): Record<number, string> {
  const templates = SMS_TEMPLATES_BY_FORMAT[pageFormat];
  if (!templates) return {};

  const result: Record<number, string> = {};
  for (const [dayStr, template] of Object.entries(templates)) {
    const day = parseInt(dayStr, 10);
    result[day] = `Day ${day} (${template.pasona}): ${template.psychology}`;
  }

  return result;
}

/**
 * 심리학 렌즈 분석
 *
 * 형식별 사용된 심리학 렌즈 확인
 *
 * @param pageFormat 페이지 형식
 * @returns 렌즈 배열
 */
export function analyzeLenses(pageFormat: PageFormat): string[] {
  const templates = SMS_TEMPLATES_BY_FORMAT[pageFormat];
  if (!templates) return [];

  const lenses = new Set<string>();
  for (const template of Object.values(templates)) {
    lenses.add(template.lens);
  }

  return Array.from(lenses);
}

/**
 * SMS 문자 길이 체크
 *
 * 한글 SMS 길이 제한:
 * - 90자 이하: 1건 (일반)
 * - 91-180자: 2건 (분할 전송)
 * - 180자 초과: 3건 이상 (LMS)
 *
 * @param text SMS 텍스트
 * @returns {count: 송신 건수, length: 문자 길이, isLms: LMS 여부}
 */
export function calculateSmsLength(text: string): {
  count: number;
  length: number;
  isLms: boolean;
} {
  const length = text.length;
  let count = 1;
  let isLms = false;

  if (length > 90 && length <= 180) {
    count = 2;
  } else if (length > 180) {
    count = Math.ceil(length / 160);
    isLms = true;
  }

  return { count, length, isLms };
}

/**
 * SMS 비용 계산
 *
 * 알리고 기준:
 * - SMS (90자): 70원/건
 * - LMS (180자+): 110원/건
 *
 * @param text SMS 텍스트
 * @param unitPrice SMS 단가 (기본: 70원, LMS: 110원)
 * @returns 예상 비용 (원)
 */
export function calculateSmsCost(text: string, unitPrice: number = 70): number {
  const { count, isLms } = calculateSmsLength(text);
  const price = isLms ? 110 : unitPrice;

  return count * price;
}

/**
 * 형식별 예상 SMS 비용 (Day 0-3 4건)
 *
 * @param pageFormat 페이지 형식
 * @returns 총 예상 비용 (원)
 */
export function estimateTotalSmsCost(pageFormat: PageFormat): number {
  const templates = SMS_TEMPLATES_BY_FORMAT[pageFormat];
  if (!templates) return 0;

  let totalCost = 0;
  for (const template of Object.values(templates)) {
    totalCost += calculateSmsCost(template.text);
  }

  return totalCost;
}

/**
 * SMS 통계 분석
 *
 * @param pageFormat 페이지 형식
 * @returns {daysCount: 발송 일수, totalLength: 총 문자수, avgLength: 평균 문자수, totalCost: 총 비용}
 */
export function analyzeSmsStatistics(pageFormat: PageFormat): {
  daysCount: number;
  totalLength: number;
  avgLength: number;
  totalCost: number;
} {
  const templates = SMS_TEMPLATES_BY_FORMAT[pageFormat];
  if (!templates) {
    return { daysCount: 0, totalLength: 0, avgLength: 0, totalCost: 0 };
  }

  const templateArray = Object.values(templates);
  const totalLength = templateArray.reduce((sum, t) => sum + t.text.length, 0);
  const avgLength = Math.round(totalLength / templateArray.length);
  const totalCost = estimateTotalSmsCost(pageFormat);

  return {
    daysCount: templateArray.length,
    totalLength,
    avgLength,
    totalCost
  };
}
