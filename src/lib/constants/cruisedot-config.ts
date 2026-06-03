/**
 * 크루즈닷 설정값 (환경변수 또는 DB에서 로드 가능)
 *
 * 모든 하드코딩된 가격/번호/연락처를 이 파일에서 관리합니다.
 * 변경 시 여기만 수정하면 전체 앱에 반영됩니다.
 */

export const CRUISEDOT_CONFIG = {
  // ===== 상품 가격 (단위: 원) =====
  pricing: {
    domestic: {
      monthly: 33000,
      name: '국내 크루즈',
      description: '부산 출도착',
      nights: 1,
      priceRange: '20-30만원'
    },
    japan: {
      monthly: 53000,
      totalPrice: 1590000,
      name: '일본 크루즈',
      description: '인솔자 동반, 3박',
      nights: 3,
      discount: '월 할부 가능',
      badge: '가장 인기'
    },
    southeastAsia: {
      monthly: 44000,
      totalPrice: 1300000,
      name: '동남아 크루즈',
      description: '2박, 인솔자 포함',
      nights: 2,
      discount: '신청금 0원'
    },
    premium: {
      monthly: 66000,
      name: '프리미엄 해외',
      description: '베테랑 인솔자 + 스태프',
      pricingNote: '월 66,000원'
    }
  },

  // ===== 연락처 =====
  contact: {
    phone: process.env.NEXT_PUBLIC_CRUISEDOT_PHONE || '1800-1234', // 환경변수로 오버라이드 가능
    kakaoTalk: process.env.NEXT_PUBLIC_CRUISEDOT_KAKAO || '@크루즈닷',
    youtubeChannel: 'https://youtube.com/@cruisedot',
    managerResponseTime: 2 // 시간 단위
  },

  // ===== 마케팅/사회증명 메트릭 =====
  marketing: {
    remainingSeats: 10,
    dailySignups: 142,
    customerSatisfaction: 4.8, // 5점 기준
    reviewCount: 3847,
    repurchaseRate: 92, // %
    hospitalNetworks: 140,
    discountRate: { min: 10, max: 30 } // % 범위
  },

  // ===== 운영 정보 =====
  operations: {
    managerResponseTime: 2, // 시간
    healthCheckupFrequency: 2, // 연 횟수
    liveStreamSchedule: {
      day: '화요일',
      time: '오후 7시'
    },
    smsSchedule: {
      day0: { delayMs: 0, label: 'Day 0' },
      day1: { delayMs: 86400000, label: 'Day 1' }, // 24시간
      day2: { delayMs: 172800000, label: 'Day 2' }, // 48시간
      day3: { delayMs: 259200000, label: 'Day 3' }, // 72시간
      day7: { delayMs: 604800000, label: 'Day 7' } // 7일
    }
  },

  // ===== 골드 회원 프로그램 =====
  goldMember: {
    benefits: {
      healthCheckup: {
        frequency: 2, // 연 횟수
        hospitals: 140
      },
      financing: {
        domesticMonthly: 33000,
        premiumMonthly: 66000,
        downPayment: 0,
        special_offers_per_year: 3
      },
      matching: {
        type: '매니저 기반 매칭',
        lifetime: true
      }
    }
  },

  // ===== 문제/해결책 섹션 =====
  sections: {
    hero: {
      title: '자유 여행, 인솔자와 함께',
      subtitle: '혼자가 아닌 안전한 크루즈 여행의 새로운 기준',
      countdownSeats: 10,
      deadlineDate: '2026-06-30T23:59:59', // 마감일 ISO 8601 (Safari 호환) — 배포 시 변경
      urgencyText: '지금 신청하면 평생 10-30% 할인'
    },
    cta: {
      mainTitle: '지금 신청하세요',
      subtitle: '매니저가 2시간 내 연락 드릴 예정입니다',
      buttonText: '🚀 지금 신청하기 (무료)',
      successMessage: '✅ 신청이 완료되었습니다! 매니저가 2시간 내 연락 드릴 예정입니다.'
    },
    liveStream: {
      title: '매주 라이브 방송',
      schedule: '매주 화요일 오후 7시',
      description: '인솔자가 직접 설명하는 크루즈 여행 정보 + Q&A',
      buttonText: '🎥 유튜브 라이브 보기',
      note: '* 유튜브 채널을 구독하고 알림을 켜면 방송 시작 시 알림을 받을 수 있습니다'
    }
  },

  // ===== FAQ 답변 =====
  faq: {
    pricingAdvantage: {
      title: '왜 더 비싼가요?',
      answer: '선사와 직결되어 있어서 다릅니다.',
      benefits: [
        '💚 문제 해결 권한 → 빠른 대응',
        '💚 환불 100% 보장 → 안전',
        '💚 추가 비용 0원 → 투명'
      ],
      note: '* 싼 크루즈는 문제 발생 시 책임자가 없습니다. 우리는 있습니다.'
    },
    financing: {
      title: '진짜 월 할부 가능한가요?',
      answer: '네, 신은행 신규금융으로 가능합니다.',
      options: [
        '💳 국내 크루즈 → 월 33,000원',
        '💳 프리미엄 → 월 66,000원',
        '💳 은행 계좌 관리 → 투명성 100%'
      ],
      note: '* 신청금 0원, 첫 결제는 여행 후'
    },
    soloTravel: {
      title: '혼자 가도 괜찮을까요?',
      answer: '혼자이지만 혼자가 아닙니다.',
      benefits: [
        '👥 매니저 24/7 연락 가능',
        '👥 비슷한 성향 사람과 매칭',
        '👥 문제 발생 시 매니저 중재'
      ],
      note: '* 평생 연락할 수 있는 "크루즈 친구"가 생깁니다.'
    },
    refund: {
      title: '취소하면 돈을 돌려받을 수 있나요?',
      answer: '네, 100% 보장합니다.',
      benefits: [
        '✅ 신청금 0원 (환불할 것도 없음)',
        '✅ 여행 후 결제 시작',
        '✅ 도중 취소 시 할부금 중단 + 선사 환불 청구'
      ]
    }
  },

  // ===== 고객 후기 =====
  testimonials: [
    {
      rating: 5,
      text: '처음엔 불안했는데, 매니저님이 정말 잘 챙겨주셨어요. 여행이 이렇게 편할 수 있다는 걸 처음 알았습니다.',
      author: '김○○님',
      age: 60,
      location: '서울',
      trip: '3박 프리미엄 완료'
    },
    {
      rating: 5,
      text: '부모님이 정말 좋아하셨어요. 이렇게 편한 여행은 처음입니다. 다음 달에 또 신청하려고요!',
      author: '이○○님',
      age: 55,
      location: '부산',
      trip: '가족 동반'
    }
  ],

  // ===== 문제점 사례 =====
  problems: [
    {
      icon: '🚨',
      title: '싼 크루즈로 정보 없이 떠났을 때',
      content: '부모님까지 모시고 갔는데 최악이었어요. 시간 버리고 돈 버린 경험. 가족끼리 시간 내기도 힘든데 너무 준비가 안 돼있어서 크루즈는 안 가고 싶네요.'
    },
    {
      icon: '🚨',
      title: '외국 사이트 환불 실패',
      content: '외국 사이트 결제해서 취소했는데 위약금을 못 받더라고요. 진짜 힘들었어요. 예약은 외국 플랫폼으로는 절대 안 해야겠다는 생각.'
    },
    {
      icon: '🚨',
      title: '개인 판매자 사기',
      content: '반값에 간다고 해서 지인들도 다 가입시켰는데 크루즈여행을 가지도 못했어요.'
    },
    {
      icon: '🚨',
      title: '크루즈항 혼란',
      content: '짐을 다른 크루즈에 넣음 / 객실 문제 / 비행기 연착 / 길 잃음 등의 문제 경험. 혼자 떠난다는 것은 정말 위험했습니다.'
    }
  ],

  // ===== 솔루션 프로세스 =====
  solutions: {
    beforeTrip: {
      title: '📋 출발 전',
      items: [
        '✅ 크루즈항 도착 방법 자세히 안내',
        '✅ 항공편 연착 대응 계획 수립',
        '✅ 객실 선호도 사전 취합',
        '✅ 건강상태 사전 확인',
        '✅ 여행 일정표 상세 설명'
      ]
    },
    duringTrip: {
      title: '🌍 여행 중',
      items: [
        '✅ 카톡 실시간 안내 (24/7)',
        '✅ 문제 발생 시 즉시 대응',
        '✅ 식사/액티비티 추천',
        '✅ 짐 관리 지원',
        '✅ 전문 사진사 배치'
      ]
    },
    afterTrip: {
      title: '🎬 여행 후',
      items: [
        '✅ 사진 에디팅 무료 제공',
        '✅ 영상 편집본 선물',
        '✅ 다음 여행 상담',
        '✅ 평생 10-30% 할인',
        '✅ 가족/친구 추천 보상'
      ]
    }
  }
} as const;

/**
 * 환경변수로 설정값 오버라이드하기
 *
 * .env.local 또는 .env.production에 다음과 같이 설정:
 * NEXT_PUBLIC_CRUISEDOT_PHONE=02-1234-5678
 * NEXT_PUBLIC_CRUISEDOT_KAKAO=@cruisedot_official
 */
export function loadCruisedotConfig() {
  return {
    ...CRUISEDOT_CONFIG,
    contact: {
      ...CRUISEDOT_CONFIG.contact,
      phone: process.env.NEXT_PUBLIC_CRUISEDOT_PHONE || CRUISEDOT_CONFIG.contact.phone,
      kakaoTalk: process.env.NEXT_PUBLIC_CRUISEDOT_KAKAO || CRUISEDOT_CONFIG.contact.kakaoTalk
    }
  };
}

/**
 * 타입 정의 (TypeScript 안전성)
 */
export type CruisedotConfig = typeof CRUISEDOT_CONFIG;
export type PricingOption = keyof typeof CRUISEDOT_CONFIG.pricing;
