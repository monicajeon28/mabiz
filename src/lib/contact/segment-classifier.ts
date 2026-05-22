/**
 * Contact 세그먼트 자동 분류 엔진
 *
 * 세그먼트 정의:
 * - A: 신혼 (결혼 2년 이내) - 최우선 (Priority 1)
 * - B: 자녀 10-15세 (초등고학년~중학생) - Priority 2
 * - C: 40-55세 + 자녀 독립 또는 미보유 - Priority 3
 * - D: 55세 이상 - Priority 4
 * - unclassified: 필수 정보 부족
 */

export type Segment = "A" | "B" | "C" | "D" | "unclassified";

export interface ContactSegmentData {
  marriageStatus?: string | null;
  marriageDate?: Date | null;
  childrenAges?: (number | null)[] | null;
  childrenCount?: number | null;
  childrenPlanned?: string | null;
  ageInYears?: number | null;
}

/**
 * Contact의 세그먼트를 우선순위에 따라 분류
 *
 * @param contact Contact 객체 또는 세그먼트 필요 데이터
 * @returns 분류된 세그먼트 ("A" | "B" | "C" | "D" | "unclassified")
 *
 * 분류 우선순위:
 * 1. 신혼 (결혼 2년 이내) → "A"
 * 2. 자녀 10-15세 → "B"
 * 3. 40-55세 + 자녀 독립 또는 미보유 → "C"
 * 4. 55세 이상 → "D"
 * 5. 조건 미충족 → "unclassified"
 */
export function classifySegment(
  contact: ContactSegmentData
): Segment {
  // 필수 필드 NULL 체크: marriageStatus와 ageInYears 중 하나라도 없으면 미분류
  if (
    !contact.marriageStatus ||
    contact.ageInYears === undefined ||
    contact.ageInYears === null
  ) {
    return "unclassified";
  }

  // Priority 1: 신혼 (결혼 2년 이내)
  if (
    contact.marriageStatus === "married" &&
    contact.marriageDate
  ) {
    const yearsSinceMarriage = getYearsDifference(
      contact.marriageDate,
      new Date()
    );
    if (yearsSinceMarriage <= 2) {
      return "A";
    }
  }

  // Priority 2: 자녀 10-15세
  if (
    contact.childrenAges &&
    Array.isArray(contact.childrenAges) &&
    contact.childrenAges.length > 0
  ) {
    const hasMiddleSchoolChild = contact.childrenAges.some(
      (age) => age !== null && age >= 10 && age <= 15
    );
    if (hasMiddleSchoolChild) {
      return "B";
    }
  }

  // Priority 3: 40-55세 + 자녀 독립 또는 미보유
  if (contact.ageInYears >= 40 && contact.ageInYears <= 55) {
    const hasYoungChildren =
      contact.childrenAges &&
      Array.isArray(contact.childrenAges) &&
      contact.childrenAges.length > 0
        ? contact.childrenAges.some(
            (age) => age !== null && age <= 20
          )
        : false;

    if (!hasYoungChildren) {
      return "C";
    }
  }

  // Priority 4: 55세 이상
  if (contact.ageInYears > 55) {
    return "D";
  }

  // 모든 조건 미충족
  return "unclassified";
}

/**
 * 두 날짜 사이의 년도 차이를 계산
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @returns 년도 차이 (소수점 포함)
 */
function getYearsDifference(startDate: Date, endDate: Date): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return (endDate.getTime() - startDate.getTime()) / msPerYear;
}

/**
 * 세그먼트별 분류 통계
 */
export interface SegmentStats {
  total: number;
  A: number;
  B: number;
  C: number;
  D: number;
  unclassified: number;
}

/**
 * 여러 Contact의 세그먼트를 일괄 분류하고 통계를 반환
 * @param contacts Contact 배열
 * @returns 분류 결과 및 통계
 */
export function classifyContactsWithStats(
  contacts: ContactSegmentData[]
): { segments: Segment[]; stats: SegmentStats } {
  const segments = contacts.map((contact) => classifySegment(contact));

  const stats: SegmentStats = {
    total: contacts.length,
    A: segments.filter((s) => s === "A").length,
    B: segments.filter((s) => s === "B").length,
    C: segments.filter((s) => s === "C").length,
    D: segments.filter((s) => s === "D").length,
    unclassified: segments.filter((s) => s === "unclassified").length,
  };

  return { segments, stats };
}

/**
 * 세그먼트별 설명
 */
export const SEGMENT_DESCRIPTIONS: Record<Segment, string> = {
  A: "신혼 (결혼 2년 이내) - 프리미엄 신혼 상품 추천",
  B: "자녀 10-15세 (초등고학년~중학생) - 가족 중심 상품",
  C: "40-55세 + 자녀 독립/미보유 - 자유로운 일정 상품",
  D: "55세 이상 - 건강/안전 중심 상품",
  unclassified: "필수 정보 부족 - 온보딩 필요",
};

/**
 * 세그먼트별 권장 마케팅 액션
 */
export const SEGMENT_ACTIONS: Record<Segment, string[]> = {
  A: [
    "신혼 특가 상품 노출",
    "Day 0 SMS: 프리미엄 신혼 상품",
    "Day 1 SMS: 함께 만드는 첫 여행",
    "Day 2 SMS: 신혼 전용 혜택",
    "Day 3 SMS: 신청 마감 임박",
  ],
  B: [
    "가족 중심 상품 노출",
    "Day 0 SMS: 아이와 함께하는 크루즈",
    "Day 1 SMS: 자녀 교육 여행",
    "Day 2 SMS: 가족 추억 만들기",
    "Day 3 SMS: 한정된 객실",
  ],
  C: [
    "자유로운 일정 상품 노출",
    "Day 0 SMS: 자유로운 당신을 위해",
    "Day 1 SMS: 포트시티 옵션 가능",
    "Day 2 SMS: 혼자여도 괜찮아",
    "Day 3 SMS: 마지막 기회",
  ],
  D: [
    "건강/안전 중심 상품 노출",
    "Day 0 SMS: 편안한 항해를 위해",
    "Day 1 SMS: 의료 시설 안내",
    "Day 2 SMS: 배멀미 예방 팁",
    "Day 3 SMS: 자유로운 일정",
  ],
  unclassified: [
    "온보딩 SMS 마법사 시작",
    "결혼상태 수집",
    "현재 나이 수집",
    "자녀 정보 수집",
  ],
};
