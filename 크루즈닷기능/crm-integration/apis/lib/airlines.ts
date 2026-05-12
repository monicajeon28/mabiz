// lib/data/airlines.ts
// 한국 크루즈 여행자 주요 이용 항공사 데이터
// 출처: 각 항공사 공식 수하물 정책 기준 (2024년 기준, 이코노미/비즈니스/일등석)
// 주의: 수하물 정책은 노선/시즌에 따라 변경될 수 있음

// SeatClass canonical source: lib/types/product-detail.ts
export type { SeatClass } from '@/lib/types/product-detail';

export interface BaggagePolicy {
  /** 위탁수하물 설명 (예: '23kg 1개', '23kg 2개', '없음(유료)') */
  checked: string;
  /** 기내 수하물 설명 */
  carryOn: string;
  /** 전체 요약 (고객 노출용) */
  summary: string;
}

export interface AirlineData {
  /** IATA 2자리 코드 */
  code: string;
  /** 한국어 항공사명 */
  name: string;
  /** 영문 항공사명 */
  nameEn: string;
  /** 국적 */
  country: string;
  /** 국적사 여부 */
  isDomestic: boolean;
  /** 로고 이미지 경로 (/images/airlines/{CODE}.png) */
  logoPath: string;
  /** 좌석 등급별 수하물 정책 */
  baggageByClass: {
    economy: BaggagePolicy;
    premium_economy?: BaggagePolicy;
    business?: BaggagePolicy;
    first?: BaggagePolicy;
  };
  /** 제공 좌석 등급 목록 */
  seatClasses: SeatClass[];
  /** 크루즈 연계 주요 노선 (출발지 → 도착지) */
  commonRoutes?: string[];
  /** 항공편명 prefix (예: 'KE' → 'KE041') */
  flightPrefix: string;
}

export const AIRLINES: AirlineData[] = [
  // =============================================
  // 한국 국적사
  // =============================================
  {
    code: 'KE',
    name: '대한항공',
    nameEn: 'Korean Air',
    country: '대한민국',
    isDomestic: true,
    logoPath: '/images/airlines/KE.webp',
    flightPrefix: 'KE',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '23kg 1개',
        carryOn: '12kg 1개',
        summary: '위탁수하물 23kg 1개 + 기내 12kg 1개',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '12kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 12kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '18kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 18kg 1개',
      },
      first: {
        checked: '32kg 3개',
        carryOn: '18kg 1개',
        summary: '위탁수하물 32kg 3개 + 기내 18kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 시애틀', '인천 → 밴쿠버', '인천 → 로스앤젤레스',
      '인천 → 도쿄(나리타)', '인천 → 오사카', '인천 → 홍콩',
      '인천 → 싱가포르', '인천 → 방콕', '인천 → 런던',
      '인천 → 파리', '인천 → 로마', '인천 → 바르셀로나',
    ],
  },
  {
    code: 'OZ',
    name: '아시아나항공',
    nameEn: 'Asiana Airlines',
    country: '대한민국',
    isDomestic: true,
    logoPath: '/images/airlines/OZ.webp',
    flightPrefix: 'OZ',
    seatClasses: ['economy', 'business'],
    baggageByClass: {
      economy: {
        checked: '23kg 1개',
        carryOn: '10kg 1개',
        summary: '위탁수하물 23kg 1개 + 기내 10kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '18kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 18kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 시애틀', '인천 → 로스앤젤레스', '인천 → 뉴욕',
      '인천 → 도쿄(나리타)', '인천 → 오사카', '인천 → 홍콩',
      '인천 → 싱가포르', '인천 → 방콕', '인천 → 런던', '인천 → 파리',
    ],
  },
  {
    code: '7C',
    name: '제주항공',
    nameEn: 'Jeju Air',
    country: '대한민국',
    isDomestic: true,
    logoPath: '/images/airlines/7C.webp',
    flightPrefix: '7C',
    seatClasses: ['economy'],
    baggageByClass: {
      economy: {
        checked: '없음 (15kg 유료 구매)',
        carryOn: '10kg 1개',
        summary: '위탁수하물 없음(유료 추가) + 기내 10kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 도쿄', '인천 → 오사카', '인천 → 방콕',
      '인천 → 홍콩', '인천 → 싱가포르',
    ],
  },
  {
    code: 'LJ',
    name: '진에어',
    nameEn: 'Jin Air',
    country: '대한민국',
    isDomestic: true,
    logoPath: '/images/airlines/LJ.webp',
    flightPrefix: 'LJ',
    seatClasses: ['economy'],
    baggageByClass: {
      economy: {
        checked: '15kg 유료 추가',
        carryOn: '10kg 1개',
        summary: '위탁수하물 없음(유료 추가) + 기내 10kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 도쿄', '인천 → 오사카', '인천 → 방콕',
      '인천 → 홍콩', '인천 → 세부',
    ],
  },
  {
    code: 'TW',
    name: '티웨이항공',
    nameEn: 'T-Way Air',
    country: '대한민국',
    isDomestic: true,
    logoPath: '/images/airlines/TW.webp',
    flightPrefix: 'TW',
    seatClasses: ['economy'],
    baggageByClass: {
      economy: {
        checked: '없음 (15kg 유료 구매)',
        carryOn: '10kg 1개',
        summary: '위탁수하물 없음(유료 추가) + 기내 10kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 도쿄', '인천 → 오사카', '인천 → 방콕', '인천 → 다낭',
    ],
  },
  {
    code: 'BX',
    name: '에어부산',
    nameEn: 'Air Busan',
    country: '대한민국',
    isDomestic: true,
    logoPath: '/images/airlines/BX.webp',
    flightPrefix: 'BX',
    seatClasses: ['economy'],
    baggageByClass: {
      economy: {
        checked: '15kg 1개 (국제선)',
        carryOn: '10kg 1개',
        summary: '위탁수하물 15kg 1개 + 기내 10kg 1개',
      },
    },
    commonRoutes: [
      '김해 → 도쿄', '김해 → 오사카', '김해 → 홍콩',
      '인천 → 오사카', '인천 → 도쿄',
    ],
  },
  {
    code: 'RS',
    name: '에어서울',
    nameEn: 'Air Seoul',
    country: '대한민국',
    isDomestic: true,
    logoPath: '/images/airlines/RS.webp',
    flightPrefix: 'RS',
    seatClasses: ['economy'],
    baggageByClass: {
      economy: {
        checked: '15kg 1개',
        carryOn: '10kg 1개',
        summary: '위탁수하물 15kg 1개 + 기내 10kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 도쿄', '인천 → 오사카', '인천 → 방콕',
      '인천 → 홍콩', '인천 → 세부',
    ],
  },

  // =============================================
  // 주요 외항사 (한국발 크루즈 노선)
  // =============================================
  {
    code: 'JL',
    name: '일본항공',
    nameEn: 'Japan Airlines (JAL)',
    country: '일본',
    isDomestic: false,
    logoPath: '/images/airlines/JL.webp',
    flightPrefix: 'JL',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '23kg 2개',
        carryOn: '10kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 10kg 1개',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '13kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 13kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '13kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 13kg 1개',
      },
      first: {
        checked: '32kg 3개',
        carryOn: '13kg 1개',
        summary: '위탁수하물 32kg 3개 + 기내 13kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 도쿄(나리타)', '인천 → 오사카', '인천 → 삿포로',
    ],
  },
  {
    code: 'NH',
    name: '전일본공수',
    nameEn: 'ANA (All Nippon Airways)',
    country: '일본',
    isDomestic: false,
    logoPath: '/images/airlines/NH.webp',
    flightPrefix: 'NH',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '23kg 2개',
        carryOn: '10kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 10kg 1개',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '13kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 13kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '13kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 13kg 1개',
      },
      first: {
        checked: '32kg 3개',
        carryOn: '13kg 1개',
        summary: '위탁수하물 32kg 3개 + 기내 13kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 도쿄(하네다)', '인천 → 오사카', '인천 → 삿포로',
    ],
  },
  {
    code: 'CX',
    name: '캐세이퍼시픽',
    nameEn: 'Cathay Pacific',
    country: '홍콩',
    isDomestic: false,
    logoPath: '/images/airlines/CX.webp',
    flightPrefix: 'CX',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '23kg 1개',
        carryOn: '7kg 1개',
        summary: '위탁수하물 23kg 1개 + 기내 7kg 1개',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '7kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 7kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '7kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 7kg 1개',
      },
      first: {
        checked: '32kg 3개',
        carryOn: '7kg 1개',
        summary: '위탁수하물 32kg 3개 + 기내 7kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 홍콩', '인천 → 런던(경유 홍콩)', '인천 → 시드니(경유 홍콩)',
    ],
  },
  {
    code: 'SQ',
    name: '싱가포르항공',
    nameEn: 'Singapore Airlines',
    country: '싱가포르',
    isDomestic: false,
    logoPath: '/images/airlines/SQ.webp',
    flightPrefix: 'SQ',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '30kg 총량',
        carryOn: '7kg 1개',
        summary: '위탁수하물 30kg 총량 + 기내 7kg 1개',
      },
      premium_economy: {
        checked: '35kg 총량',
        carryOn: '7kg 1개',
        summary: '위탁수하물 35kg 총량 + 기내 7kg 1개',
      },
      business: {
        checked: '40kg 총량',
        carryOn: '7kg 1개',
        summary: '위탁수하물 40kg 총량 + 기내 7kg 1개',
      },
      first: {
        checked: '50kg 총량',
        carryOn: '7kg 1개',
        summary: '위탁수하물 50kg 총량 + 기내 7kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 싱가포르', '인천 → 런던(경유 싱가포르)',
      '인천 → 시드니(경유 싱가포르)',
    ],
  },
  {
    code: 'DL',
    name: '델타항공',
    nameEn: 'Delta Air Lines',
    country: '미국',
    isDomestic: false,
    logoPath: '/images/airlines/DL.webp',
    flightPrefix: 'DL',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '23kg 1개',
        carryOn: '기내 허용',
        summary: '위탁수하물 23kg 1개 + 기내 수하물 허용',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '기내 허용',
        summary: '위탁수하물 23kg 2개 + 기내 수하물 허용',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '기내 허용',
        summary: '위탁수하물 32kg 2개 + 기내 수하물 허용',
      },
      first: {
        checked: '32kg 2개',
        carryOn: '기내 허용',
        summary: '위탁수하물 32kg 2개 + 기내 수하물 허용',
      },
    },
    commonRoutes: [
      '인천 → 시애틀', '인천 → 로스앤젤레스', '인천 → 뉴욕(JFK)',
      '인천 → 애틀랜타', '인천 → 미니애폴리스',
    ],
  },
  {
    code: 'UA',
    name: '유나이티드항공',
    nameEn: 'United Airlines',
    country: '미국',
    isDomestic: false,
    logoPath: '/images/airlines/UA.webp',
    flightPrefix: 'UA',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '23kg 1개',
        carryOn: '기내 허용',
        summary: '위탁수하물 23kg 1개 + 기내 수하물 허용',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '기내 허용',
        summary: '위탁수하물 23kg 2개 + 기내 수하물 허용',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '기내 허용',
        summary: '위탁수하물 32kg 2개 + 기내 수하물 허용',
      },
      first: {
        checked: '32kg 2개',
        carryOn: '기내 허용',
        summary: '위탁수하물 32kg 2개 + 기내 수하물 허용',
      },
    },
    commonRoutes: [
      '인천 → 샌프란시스코', '인천 → 로스앤젤레스',
      '인천 → 뉴욕(뉴어크)', '인천 → 시카고',
    ],
  },
  {
    code: 'EK',
    name: '에미레이트',
    nameEn: 'Emirates',
    country: '아랍에미리트',
    isDomestic: false,
    logoPath: '/images/airlines/EK.webp',
    flightPrefix: 'EK',
    seatClasses: ['economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '25kg 1개',
        carryOn: '7kg 1개',
        summary: '위탁수하물 25kg 1개 + 기내 7kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '7kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 7kg 1개',
      },
      first: {
        checked: '32kg 3개',
        carryOn: '7kg 1개',
        summary: '위탁수하물 32kg 3개 + 기내 7kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 두바이', '인천 → 런던(경유 두바이)',
      '인천 → 로마(경유 두바이)', '인천 → 바르셀로나(경유 두바이)',
    ],
  },
  {
    code: 'AY',
    name: '핀에어',
    nameEn: 'Finnair',
    country: '핀란드',
    isDomestic: false,
    logoPath: '/images/airlines/AY.webp',
    flightPrefix: 'AY',
    seatClasses: ['economy', 'premium_economy', 'business'],
    baggageByClass: {
      economy: {
        checked: '23kg 1개',
        carryOn: '8kg 1개',
        summary: '위탁수하물 23kg 1개 + 기내 8kg 1개',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '8kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 8kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '8kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 8kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 헬싱키', '인천 → 런던(경유 헬싱키)',
      '인천 → 파리(경유 헬싱키)', '인천 → 로마(경유 헬싱키)',
    ],
  },
  {
    code: 'LH',
    name: '루프트한자',
    nameEn: 'Lufthansa',
    country: '독일',
    isDomestic: false,
    logoPath: '/images/airlines/LH.webp',
    flightPrefix: 'LH',
    seatClasses: ['economy', 'premium_economy', 'business', 'first'],
    baggageByClass: {
      economy: {
        checked: '23kg 1개',
        carryOn: '8kg 1개',
        summary: '위탁수하물 23kg 1개 + 기내 8kg 1개',
      },
      premium_economy: {
        checked: '23kg 2개',
        carryOn: '8kg 1개',
        summary: '위탁수하물 23kg 2개 + 기내 8kg 1개',
      },
      business: {
        checked: '32kg 2개',
        carryOn: '8kg 1개',
        summary: '위탁수하물 32kg 2개 + 기내 8kg 1개',
      },
      first: {
        checked: '32kg 3개',
        carryOn: '8kg 1개',
        summary: '위탁수하물 32kg 3개 + 기내 8kg 1개',
      },
    },
    commonRoutes: [
      '인천 → 프랑크푸르트', '인천 → 뮌헨',
      '인천 → 런던(경유 프랑크푸르트)', '인천 → 베니스(경유 프랑크푸르트)',
      '인천 → 바르셀로나(경유 프랑크푸르트)',
    ],
  },
];

// =============================================
// 유틸리티 함수
// =============================================

/** 항공사 코드로 항공사 검색 */
export function getAirlineByCode(code: string): AirlineData | undefined {
  return AIRLINES.find(a => a.code.toUpperCase() === code.toUpperCase());
}

/** 항공편명에서 항공사 코드 추출 (예: 'KE041' → 'KE') */
export function extractAirlineCode(flightNumber: string): string | null {
  if (!flightNumber) return null;
  const match = flightNumber.trim().match(/^([A-Z]{2}|[A-Z]\d|\d[A-Z])/i);
  return match ? match[1].toUpperCase() : null;
}

/** 항공편명으로 항공사 자동 검색 */
export function getAirlineByFlightNumber(flightNumber: string): AirlineData | undefined {
  const code = extractAirlineCode(flightNumber);
  return code ? getAirlineByCode(code) : undefined;
}

/** 좌석 등급별 수하물 요약 반환 */
export function getBaggageSummary(
  airlineCode: string,
  seatClass: SeatClass = 'economy'
): string {
  const airline = getAirlineByCode(airlineCode);
  if (!airline) return '';
  const policy = airline.baggageByClass[seatClass];
  return policy?.summary ?? airline.baggageByClass.economy.summary;
}

/** 자동완성용 항공사 목록 (검색어 필터링) */
export function searchAirlines(query: string): AirlineData[] {
  if (!query) return AIRLINES;
  const q = query.toLowerCase();
  return AIRLINES.filter(
    a =>
      a.code.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.nameEn.toLowerCase().includes(q)
  );
}

/** 국적사만 반환 */
export const DOMESTIC_AIRLINES = AIRLINES.filter(a => a.isDomestic);

/** 외항사만 반환 */
export const FOREIGN_AIRLINES = AIRLINES.filter(a => !a.isDomestic);

/** 좌석 등급 한국어 레이블 */
export const SEAT_CLASS_LABELS: Record<SeatClass, string> = {
  economy: '이코노미',
  premium_economy: '프리미엄 이코노미',
  business: '비즈니스',
  first: '일등석',
};

/** 자동완성 기본 목록 (상위 10개) — 모듈 레벨 상수로 렌더마다 재계산 방지 */
export const DEFAULT_AIRLINES = AIRLINES.slice(0, 10);

/** 공항별 UTC 오프셋 맵 (시간 단위) — 컴포넌트 외부에서 한 번만 생성 */
const AIRPORT_TIMEZONE_MAP: Record<string, number> = {
  '인천': 9, 'ICN': 9, '김해': 9, 'PUS': 9, '김포': 9, 'GMP': 9,
  '시애틀': -8, 'SEA': -8, '주노': -9, 'JNU': -9, '알래스카': -9, '앵커리지': -9, 'ANC': -9,
  '스캐그웨이': -9, '싯카': -9, '로스앤젤레스': -8, 'LAX': -8, '뉴욕': -5, 'JFK': -5, '뉴어크': -5, 'EWR': -5,
  '샌프란시스코': -8, 'SFO': -8, '시카고': -6, 'ORD': -6, '마이애미': -5, 'MIA': -5,
  '빅토리아': -8, 'YYJ': -8, '밴쿠버': -8, 'YVR': -8, '토론토': -5, 'YYZ': -5,
  '도쿄': 9, 'NRT': 9, '하네다': 9, 'HND': 9, '오사카': 9, 'KIX': 9, '사세보': 9,
  '미야코지마': 9, '이시가키': 9, '오키나와': 9, 'OKA': 9,
  '베이징': 8, 'PEK': 8, '상하이': 8, 'PVG': 8, '홍콩': 8, 'HKG': 8,
  '방콕': 7, 'BKK': 7, '푸켓': 7, 'HKT': 7,
  '쿠알라룸푸르': 8, 'KUL': 8, '페낭': 8, '랑카위': 8,
  '싱가포르': 8, 'SIN': 8,
  '런던': 0, 'LHR': 0, '파리': 1, 'CDG': 1, '로마': 1, 'FCO': 1, '베네치아': 1, 'VCE': 1,
  '바르셀로나': 1, 'BCN': 1, '마르세유': 1, 'MRS': 1, '제노아': 1, 'GOA': 1, '라벤나': 1,
  '팔레르모': 1, 'PMO': 1, '아테네': 2, 'ATH': 2, '미코노스': 2, 'JMK': 2,
  '스플리트': 1, 'SPU': 1, '이비자': 1, 'IBZ': 1,
};

/** 공항명 또는 IATA 코드로 UTC 오프셋 반환 (기본값: 한국 UTC+9) */
export function getAirportTimezone(airportName: string): number {
  const normalized = airportName.toUpperCase();
  for (const [key, offset] of Object.entries(AIRPORT_TIMEZONE_MAP)) {
    if (key.toUpperCase() === normalized || key === airportName) return offset;
  }
  return 9;
}
