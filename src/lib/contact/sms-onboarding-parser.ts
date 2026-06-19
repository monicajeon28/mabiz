/**
 * SMS 온보딩 마법사 - 응답 파싱 엔진
 * 자동화된 NLP 기반 고객 응답 분석
 * Track C: SMS로 1400명 고객의 세그먼트 필드 자동 수집
 */

export interface OnboardingQuestion {
  day: number;
  type: "marital" | "marriage_years" | "children" | "age" | "travel_purpose";
  questionText: string;
  fieldMapping: {
    field1?: string;
    field2?: string;
  };
}

export interface OnboardingResponse {
  day: number;
  contactId: string;
  phoneNumber: string;
  rawResponse: string;
  parsedData: Record<string, any>;
  confidence: number; // 0-100, 신뢰도
  parseMethod: "keyword" | "regex" | "number_extract" | "fallback";
  createdAt: Date;
}

export interface ParsingResult {
  success: boolean;
  marriageStatus?: "married" | "single" | "other";
  marriageDate?: Date;
  childrenCount?: number;
  childrenAges?: number[];
  ageInYears?: number;
  travelPurpose?: string;
  confidence: number;
  fallbackReason?: string;
  parseMethod?: "keyword" | "regex" | "number_extract" | "fallback";
}

/**
 * Day 0: 결혼상태 파싱
 * 입력: "2", "결혼", "기혼", "결혼했어요" 등
 * 출력: marriageStatus = "married" | "single" | "other"
 */
export function parseMaritalStatus(rawResponse: string): ParsingResult {
  if (!rawResponse || typeof rawResponse !== "string") {
    return {
      success: false,
      confidence: 0,
      parseMethod: "fallback",
      fallbackReason: "빈 응답",
    };
  }

  const response = rawResponse.trim().toLowerCase();

  // 1. 숫자 추출 (1, 2, 3)
  const numberMatch = response.match(/[1-3]/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0], 10);
    if (num === 1) {
      return {
        success: true,
        marriageStatus: "single",
        confidence: 95,
        parseMethod: "number_extract",
      };
    }
    if (num === 2) {
      return {
        success: true,
        marriageStatus: "married",
        confidence: 95,
        parseMethod: "number_extract",
      };
    }
    if (num === 3) {
      return {
        success: true,
        marriageStatus: "other",
        confidence: 95,
        parseMethod: "number_extract",
      };
    }
  }

  // 2. 키워드 기반 매칭
  if (response.includes("결혼") || response.includes("기혼") || response.includes("married")) {
    return {
      success: true,
      marriageStatus: "married",
      confidence: 90,
      parseMethod: "keyword",
    };
  }
  if (
    response.includes("미혼") ||
    response.includes("싱글") ||
    response.includes("single")
  ) {
    return {
      success: true,
      marriageStatus: "single",
      confidence: 90,
      parseMethod: "keyword",
    };
  }

  // 3. 폴백
  return {
    success: false,
    confidence: 0,
    parseMethod: "fallback",
    fallbackReason: "결혼상태를 인식하지 못함. 상담사 수동 검토 필요",
  };
}

/**
 * Day 1: 결혼년수 + 자녀정보 파싱 (복합)
 * 입력: "결혼 5년 됐어요, 아이 2명 10살 8살", "결혼 3년, 자녀 없음" 등
 * 출력: marriageDate, childrenCount, childrenAges
 */
export function parseMarriageAndChildren(rawResponse: string): ParsingResult {
  if (!rawResponse || typeof rawResponse !== "string") {
    return {
      success: false,
      confidence: 0,
      parseMethod: "fallback",
    };
  }

  const response = rawResponse.trim().toLowerCase();
  const result: ParsingResult = {
    success: false,
    confidence: 0,
    parseMethod: "regex",
  };

  // 1. 결혼년수 추출 (예: "5년" → marriageDate = now() - 5년)
  const yearsMatch = response.match(/(\d+)\s*년/);
  if (yearsMatch) {
    const yearsAgo = parseInt(yearsMatch[1], 10);
    if (yearsAgo >= 0 && yearsAgo <= 60) {
      // 0~60년 범위만 유효
      const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
      result.marriageDate = new Date(Date.now() - yearsAgo * msPerYear);
    }
  }

  // 2. 자녀수 추출 (예: "아이 2명", "자녀 1", "2명" 등)
  const childrenCountMatch = response.match(
    /(?:아이|자녀)\s*(\d+)\s*명|(\d+)\s*명|자녀\s*(\d+)/
  );
  if (childrenCountMatch) {
    const count = parseInt(
      childrenCountMatch[1] || childrenCountMatch[2] || childrenCountMatch[3]
    );
    if (count >= 0 && count <= 10) {
      result.childrenCount = count;
    }
  } else if (
    response.includes("없음") ||
    response.includes("없어") ||
    response.includes("없을")
  ) {
    result.childrenCount = 0;
  }

  // 3. 자녀 나이 추출 (예: "10살 8살", "10, 8" 등)
  const ageMatches = response.match(/(\d+)\s*(?:살|세)/g);
  if (ageMatches && ageMatches.length > 0) {
    result.childrenAges = ageMatches
      .map((match) => {
        const num = match.match(/(\d+)/);
        return num ? parseInt(num[1], 10) : null;
      })
      .filter((n) => n !== null && n >= 0 && n <= 25) as number[]; // 0~25세만 유효
  }

  // 신뢰도 계산
  let confidence = 0;
  if (result.marriageDate) confidence += 40;
  if (result.childrenCount !== undefined) confidence += 30;
  if (result.childrenAges && result.childrenAges.length > 0) confidence += 30;

  result.success = confidence >= 50;
  result.confidence = confidence;

  return result;
}

/**
 * Day 2: 나이 파싱
 * 입력: "45", "45살", "45세", "45살입니다" 등
 * 출력: ageInYears
 */
export function parseAge(rawResponse: string): ParsingResult {
  if (!rawResponse || typeof rawResponse !== "string") {
    return {
      success: false,
      confidence: 0,
      parseMethod: "fallback",
      fallbackReason: "빈 응답",
    };
  }

  const response = rawResponse.trim();

  // 숫자 추출
  const numberMatch = response.match(/(\d{1,3})/);
  if (numberMatch) {
    const age = parseInt(numberMatch[1], 10);
    if (age >= 18 && age <= 100) {
      return {
        success: true,
        ageInYears: age,
        confidence: 95,
        parseMethod: "number_extract",
      };
    }
  }

  return {
    success: false,
    confidence: 0,
    parseMethod: "fallback",
    fallbackReason: "유효한 나이를 추출하지 못함 (18-100 범위)",
  };
}

/**
 * Day 3: 여행 목적 파싱
 * 입력: "1", "2", "휴식", "모험" 등
 * 출력: travelPurpose
 */
export function parseTravelPurpose(rawResponse: string): ParsingResult {
  if (!rawResponse || typeof rawResponse !== "string") {
    return {
      success: false,
      confidence: 0,
      parseMethod: "fallback",
    };
  }

  const response = rawResponse.trim().toLowerCase();

  // 1. 숫자 추출 (1, 2, 3, 4)
  const numberMatch = response.match(/[1-4]/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0], 10);
    const purposes = ["relaxation", "adventure", "family", "culture"];
    return {
      success: true,
      travelPurpose: purposes[num - 1],
      confidence: 95,
      parseMethod: "number_extract",
    };
  }

  // 2. 키워드 기반
  if (response.includes("휴식") || response.includes("힐링")) {
    return {
      success: true,
      travelPurpose: "relaxation",
      confidence: 90,
      parseMethod: "keyword",
    };
  }
  if (response.includes("모험") || response.includes("새로운")) {
    return {
      success: true,
      travelPurpose: "adventure",
      confidence: 90,
      parseMethod: "keyword",
    };
  }
  if (response.includes("가족") || response.includes("추억")) {
    return {
      success: true,
      travelPurpose: "family",
      confidence: 90,
      parseMethod: "keyword",
    };
  }
  if (response.includes("문화") || response.includes("역사")) {
    return {
      success: true,
      travelPurpose: "culture",
      confidence: 90,
      parseMethod: "keyword",
    };
  }

  return {
    success: false,
    confidence: 0,
    parseMethod: "fallback",
    fallbackReason: "여행 목적을 인식하지 못함",
  };
}

/**
 * 통합 파싱 함수 (Day별)
 * @param day 0-3 (Day 0 ~ Day 3)
 * @param rawResponse 고객의 raw SMS 응답
 * @returns 파싱된 결과
 */
export function parseOnboardingResponse(
  day: number,
  rawResponse: string
): ParsingResult {
  switch (day) {
    case 0:
      return parseMaritalStatus(rawResponse);
    case 1:
      return parseMarriageAndChildren(rawResponse);
    case 2:
      return parseAge(rawResponse);
    case 3:
      return parseTravelPurpose(rawResponse);
    default:
      return {
        success: false,
        confidence: 0,
        fallbackReason: "유효하지 않은 Day 값",
      };
  }
}

/**
 * SMS 온보딩 질문 템플릿
 */
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    day: 0,
    type: "marital",
    questionText:
      "안녕하세요, [NAME]님!\n결혼 상태가 어떻게 되세요?\n1) 미혼 2) 결혼 3) 그 외\n(댓글로 번호 입력해주세요)",
    fieldMapping: {
      field1: "marriageStatus",
    },
  },
  {
    day: 1,
    type: "marriage_years",
    questionText:
      "[NAME]님 감사합니다!\n(1) 결혼하신 지 몇 년 되셨어요?\n(2) 자녀분 몇 분 계세요? (있으면 나이는?)\n예: 결혼 5년, 아이 2명 10살 8살",
    fieldMapping: {
      field1: "marriageDate",
      field2: "childrenCount,childrenAges",
    },
  },
  {
    day: 2,
    type: "age",
    questionText:
      "[NAME]님 정보 감사합니다!\n혹시 나이가 어떻게 되세요? (예: 45)\n(저희 서비스를 맞춤으로 추천해드리기 위해)",
    fieldMapping: {
      field1: "ageInYears",
    },
  },
  {
    day: 3,
    type: "travel_purpose",
    questionText:
      "[NAME]님 마지막 질문입니다!\n크루즈 여행의 목적이 뭔가요? (1개 선택)\n1) 휴식/힐링 2) 모험/새로운 경험 3) 가족/추억 4) 문화/역사",
    fieldMapping: {
      field1: "travelPurpose",
    },
  },
];

/**
 * 테스트 케이스 5가지
 */
export const TEST_CASES = [
  {
    day: 1,
    input: "결혼 5년 됐어요, 아이 2명 10살 8살이에요",
    expectedOutput: {
      success: true,
      marriageDate: true,
      childrenCount: 2,
      childrenAges: [10, 8],
      confidence: 100,
    },
  },
  {
    day: 1,
    input: "결혼 3년, 자녀 없음",
    expectedOutput: {
      success: true,
      marriageDate: true,
      childrenCount: 0,
      confidence: 70,
    },
  },
  {
    day: 2,
    input: "45",
    expectedOutput: {
      success: true,
      ageInYears: 45,
      confidence: 95,
    },
  },
  {
    day: 2,
    input: "45살입니다",
    expectedOutput: {
      success: true,
      ageInYears: 45,
      confidence: 95,
    },
  },
  {
    day: 3,
    input: "휴식이 가장 중요해요",
    expectedOutput: {
      success: true,
      travelPurpose: "relaxation",
      confidence: 90,
    },
  },
];

/**
 * 파싱 결과 신뢰도 기반 액션 결정
 * @param result 파싱 결과
 * @returns "auto_save" | "manual_review" | "retry_sms" | "call_required"
 */
export function decideOnboardingAction(result: ParsingResult): string {
  if (result.confidence >= 80) {
    return "auto_save";
  }
  if (result.confidence >= 50) {
    return "manual_review";
  }
  if (result.confidence >= 20) {
    return "retry_sms";
  }
  return "call_required";
}
