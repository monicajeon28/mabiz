# Track C: SMS 온보딩 마법사 설계서

**목표:** 미입력 고객(1400명) 자동으로 세그먼트 필드 채우기 (성공률 85%)

**기한:** 3.5일

---

## Phase 1: 설계 (Day 1-2)

### 4단계 SMS 시퀀스 상세설계

#### Day 0: 결혼상태 수집
```
SMS 내용:
"안녕하세요, [고객명]님! 
결혼 상태가 어떻게 되세요?
1) 미혼 2) 결혼 3) 그 외 (댓글로 번호 입력해주세요)"

타이밍: 고객이 온보딩 마법사 시작 직후 또는 야간(21:00)
수집 필드: Contact.marriageStatus
응답 대기: 24시간

기대 답변 형태:
- "2" / "2번" / "결혼" / "결혼했어요" / "기혼"

파싱 로직:
- "2" 또는 "결혼" → marriageStatus = "married"
- "1" 또는 "미혼" → marriageStatus = "single"
- "3" 또는 기타 → marriageStatus = "other"
```

#### Day 1: 결혼년수 + 자녀정보 수집 (조건부)
```
SMS 내용:
"[고객명]님 감사합니다!
(1) 결혼하신 지 몇 년 되셨어요?
(2) 자녀분 몇 분 계세요? (있으면 나이는?)"

예시:
- "결혼 5년 됐어요, 아이 2명 10살 8살"
- "결혼 3년, 자녀 없음"
- "결혼 2년"

수집 필드: Contact.marriageDate, Contact.childrenCount, Contact.childrenAges
응답 대기: 24시간

파싱 로직:
1. 결혼년수 추출
   - "5년" → marriageDate = now() - 5년
   - "3년" → marriageDate = now() - 3년
   
2. 자녀수 추출
   - "아이 2명" → childrenCount = 2
   - "자녀 없음" → childrenCount = 0
   
3. 자녀 나이 추출
   - "10살, 8살" → childrenAges = [10, 8]
   - "10살 8살" → childrenAges = [10, 8]
   - "큰아이 10살 작은아이 8살" → childrenAges = [10, 8]
```

#### Day 2: 현재 나이 수집
```
SMS 내용:
"[고객명]님 정보 감사합니다!
혹시 나이가 어떻게 되세요? (예: 45)
(저희 서비스를 맞춤으로 추천해드리기 위해)"

수집 필드: Contact.ageInYears
응답 대기: 24시간

기대 답변 형태:
- "45" / "45살" / "45세" / "45살입니다"

파싱 로직:
- 숫자 추출 → ageInYears = int(숫자)
- 예: "45" → 45, "45살" → 45, "45세입니다" → 45
```

#### Day 3: 여행 목적 수집 (추후 고도화용)
```
SMS 내용:
"[고객명]님 마지막 질문입니다!
크루즈 여행의 목적이 뭔가요? (1개 선택)
1) 휴식/힐링 2) 모험/새로운 경험 3) 가족/추억 4) 문화/역사"

수집 필드: Contact.travelPurpose (추후 추가)
응답 대기: 24시간 (미응답 시 기본값: unspecified)

파싱 로직:
- "1" → travelPurpose = "relaxation"
- "2" → travelPurpose = "adventure"
- "3" → travelPurpose = "family"
- "4" → travelPurpose = "culture"
```

---

## Phase 2: NLP 파싱 함수 구현 (Day 2-3)

### 파일: `src/lib/contact/sms-onboarding-parser.ts`

```typescript
/**
 * SMS 온보딩 마법사 - 응답 파싱 엔진
 * 자동화된 NLP 기반 고객 응답 분석
 */

export interface OnboardingQuestion {
  day: number;
  type: "marital" | "marriage_years" | "children" | "age" | "travel_purpose";
  questionText: string;
  fieldMapping: {
    field1?: string;  // marriageStatus, marriageDate, childrenCount, etc
    field2?: string;  // childrenAges 등 복합 필드
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
}

/**
 * Day 0: 결혼상태 파싱
 */
export function parseMaritalStatus(rawResponse: string): ParsingResult {
  const response = rawResponse.trim().toLowerCase();
  
  // 숫자 추출
  const numberMatch = response.match(/[1-3]/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0]);
    if (num === 1) return { success: true, marriageStatus: "single", confidence: 95 };
    if (num === 2) return { success: true, marriageStatus: "married", confidence: 95 };
    if (num === 3) return { success: true, marriageStatus: "other", confidence: 95 };
  }
  
  // 키워드 기반
  if (response.includes("결혼") || response.includes("기혼")) {
    return { success: true, marriageStatus: "married", confidence: 90 };
  }
  if (response.includes("미혼") || response.includes("싱글")) {
    return { success: true, marriageStatus: "single", confidence: 90 };
  }
  
  // 폴백
  return { 
    success: false, 
    confidence: 0,
    fallbackReason: "결혼상태를 인식하지 못함. 상담사 수동 검토 필요"
  };
}

/**
 * Day 1: 결혼년수 + 자녀정보 파싱 (복합)
 */
export function parseMarriageAndChildren(rawResponse: string): ParsingResult {
  const response = rawResponse.trim().toLowerCase();
  const result: ParsingResult = { success: false, confidence: 0 };
  
  // 1. 결혼년수 추출
  const yearsMatch = response.match(/(\d+)\s*년/);
  if (yearsMatch) {
    const yearsAgo = parseInt(yearsMatch[1]);
    result.marriageDate = new Date(Date.now() - yearsAgo * 365.25 * 24 * 60 * 60 * 1000);
  }
  
  // 2. 자녀수 추출
  const childrenCountMatch = response.match(/(\d+)\s*명|자녀\s*(\d+)/);
  if (childrenCountMatch) {
    result.childrenCount = parseInt(childrenCountMatch[1] || childrenCountMatch[2]);
  } else if (response.includes("없음") || response.includes("없어")) {
    result.childrenCount = 0;
  }
  
  // 3. 자녀 나이 추출
  const ageMatches = response.match(/(\d+)\s*살|(\d+)\s*세/g);
  if (ageMatches && ageMatches.length > 0) {
    result.childrenAges = ageMatches.map(match => {
      const num = match.match(/\d+/);
      return num ? parseInt(num[0]) : null;
    }).filter(n => n !== null) as number[];
  }
  
  // 신뢰도 계산
  let confidence = 0;
  if (result.marriageDate) confidence += 40;
  if (result.childrenCount !== undefined) confidence += 30;
  if (result.childrenAges) confidence += 30;
  
  result.success = confidence >= 50;
  result.confidence = confidence;
  
  return result;
}

/**
 * Day 2: 나이 파싱
 */
export function parseAge(rawResponse: string): ParsingResult {
  const response = rawResponse.trim();
  
  const numberMatch = response.match(/(\d{1,3})/);
  if (numberMatch) {
    const age = parseInt(numberMatch[1]);
    if (age >= 18 && age <= 100) {
      return { 
        success: true, 
        ageInYears: age, 
        confidence: 95
      };
    }
  }
  
  return {
    success: false,
    confidence: 0,
    fallbackReason: "유효한 나이를 추출하지 못함 (18-100 범위)"
  };
}

/**
 * Day 3: 여행 목적 파싱
 */
export function parseTravelPurpose(rawResponse: string): ParsingResult {
  const response = rawResponse.trim().toLowerCase();
  
  const numberMatch = response.match(/[1-4]/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0]);
    const purposes = ["relaxation", "adventure", "family", "culture"];
    return {
      success: true,
      travelPurpose: purposes[num - 1],
      confidence: 95
    };
  }
  
  // 키워드 기반
  if (response.includes("휴식") || response.includes("힐링")) {
    return { success: true, travelPurpose: "relaxation", confidence: 90 };
  }
  if (response.includes("모험") || response.includes("새로운")) {
    return { success: true, travelPurpose: "adventure", confidence: 90 };
  }
  if (response.includes("가족") || response.includes("추억")) {
    return { success: true, travelPurpose: "family", confidence: 90 };
  }
  if (response.includes("문화") || response.includes("역사")) {
    return { success: true, travelPurpose: "culture", confidence: 90 };
  }
  
  return {
    success: false,
    confidence: 0,
    fallbackReason: "여행 목적을 인식하지 못함"
  };
}

/**
 * 통합 파싱 함수 (Day별)
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
      return { success: false, confidence: 0 };
  }
}
```

---

## Phase 3: 폴백 전략 & 자동분류 (Day 3-4)

### 폴백 플로우

```
Day 0-3 각 단계별:
1. SMS 발송 (08:00 또는 21:00)
2. 응답 대기 (24시간)
3. 응답 분석
   a. confidence >= 80% → 자동 저장
   b. 50% <= confidence < 80% → 상담사 수동 검토 (+15분 이내)
   c. confidence < 50% → 재질문 SMS 발송
      "죄송하지만, 다시 한 번 알려주시겠어요? (예: 결혼했어요, 5년)"
4. 재질문 2회 이상 실패 → 상담사 전화
   "안녕하세요! 개인정보 수집을 위해 전화드렸습니다. 확인 가능하신가요?"
```

### 자동분류 트리거

```typescript
/**
 * 온보딩 완료 후 자동분류
 */
async function triggerAutoSegmentation(contactId: string) {
  // 1. Contact의 모든 필드 로드
  const contact = await prisma.contact.findUnique({
    where: { id: contactId }
  });
  
  // 2. segment-classifier 호출
  const segment = classifySegment({
    marriageStatus: contact.marriageStatus,
    marriageDate: contact.marriageDate,
    childrenAges: contact.childrenAges,
    childrenCount: contact.childrenCount,
    ageInYears: contact.ageInYears
  });
  
  // 3. Contact 업데이트
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      autoSegment: segment,
      segmentUpdatedAt: new Date(),
      tags: {
        push: `seg:${segment}`
      }
    }
  });
  
  // 4. SMS 시퀀스 시작 (segment-specific)
  await startSegmentSpecificSMSSequence(contactId, segment);
}
```

---

## Phase 4: 구현 체크리스트

- [ ] TRACK_C_SMS_ONBOARDING_DESIGN.md 작성 (이 파일)
- [ ] src/lib/contact/sms-onboarding-parser.ts 작성 + 5가지 케이스 테스트
- [ ] Contact.travelPurpose 필드 추가 (Prisma 스키마)
- [ ] SMS 발송 스케줄 설정 (Day 0-3)
- [ ] 폴백 전략 API 구현
- [ ] 자동분류 트리거 구현
- [ ] 1400명 대상 마법사 시작 (Day 5)

---

## 예상 통계

**초기 2000명 고객:**
- marriageStatus 미입력: ~70% (1400명)
- marriageDate 미입력: ~80% (1600명)
- childrenAges 미입력: ~85% (1700명)
- ageInYears 미입력: ~75% (1500명)

**SMS 마법사 성공률 목표:**
- Day 0 (결혼상태): 85% (1190명)
- Day 1 (결혼년수 + 자녀): 80% (952명)
- Day 2 (나이): 82% (780명)
- Day 3 (여행목적): 78% (608명)

**최종 결과:**
- 완전 분류됨(A/B/C/D): ~600명 (43%)
- 부분 분류(unclassified 해제): ~400명 (29%)
- 폴백/상담사 수동: ~400명 (29%)

---

## 타임라인

- **Day 1-2 (5월 22-23):** SMS 시퀀스 최종 검증, NLP 파싱 구현
- **Day 3 (5월 24):** 폴백/자동분류 로직, 실서버 배포 준비
- **Day 4-5 (5월 25-26):** QA + 1400명 대상 마법사 시작
- **Week 2 (5월 27 이후):** 데이터 수집 및 통계 분석

---

## 성공 기준

✅ SMS 4단계 문구 최종 검증 (상담사 피드백)
✅ NLP 파싱 5가지 케이스 모두 통과 (예: "결혼 5년, 아이 2명 10살 8살")
✅ 폴백 로직 작동 확인 (재질문 → 전화 순서)
✅ 자동분류 트리거 실행 확인 (Contact.autoSegment 업데이트)
✅ 1400명 대상 배포 시작 확인
