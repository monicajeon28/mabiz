# Contract Modification 자동 승인 규칙 엔진 - 사용 가이드

**작성일**: 2026-06-15  
**문서 버전**: 1.0  
**담당팀**: Team-A (Contract Rules Engine)

---

## 📚 목차
1. [빠른 시작](#빠른-시작)
2. [핵심 API](#핵심-api)
3. [필드별 검증 규칙](#필드별-검증-규칙)
4. [코드 예제](#코드-예제)
5. [심리학 렌즈](#심리학-렌즈)
6. [FAQ](#faq)

---

## 빠른 시작

### 설치
```typescript
import {
  evaluateAutoApproval,
  evaluateAllFieldsAutoApproval,
  AUTO_APPROVABLE_FIELDS,
} from "@/lib/contract-modification-rules";

import { FieldModification } from "@/lib/types/contract-modification";
```

### 기본 사용법
```typescript
// 단일 필드 평가
const fieldRequest: FieldModification = {
  fieldName: "travelDate",
  oldValue: "2026-07-01",
  newValue: "2026-07-10",
  reason: "일정 변경",
};

const result = await evaluateAutoApproval(
  fieldRequest,
  contractInstance,
  organization
);

if (result.isAutoApprovable) {
  console.log("✅ 자동 승인 가능:", result.reason);
  console.log("통과한 검증:", result.autoApprovalConfig?.validationsPassed);
} else {
  console.log("❌ 수동 검토 필요:", result.reason);
}
```

---

## 핵심 API

### 1. evaluateAutoApproval()
**용도**: 단일 필드 수정 요청에 대한 자동 승인 판단

```typescript
async function evaluateAutoApproval(
  request: FieldModification,
  contractInstance: any,
  organization: any
): Promise<AutoApprovalResult>
```

**파라미터**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| request | FieldModification | 수정 요청 (필드명, 기존값, 신규값, 사유) |
| contractInstance | any | 계약 인스턴스 (boundData 필수) |
| organization | any | 조직정보 |

**반환값**:
```typescript
{
  isAutoApprovable: boolean;           // 자동 승인 가능 여부
  reason: string;                       // 판단 사유
  autoApprovalConfig?: {
    fieldName: string;                  // 필드명
    fieldConfig: FieldConfig;           // 필드 설정
    validationsPassed: string[];        // ✅ 통과한 검증 항목
    validationsFailed?: string[];       // ❌ 실패한 검증 항목
    psychologyLenses?: string[];        // 적용된 심리학 렌즈 (L6, L7, L9, L10)
  };
}
```

**예제**:
```typescript
const result = await evaluateAutoApproval(
  {
    fieldName: "roomType",
    oldValue: "oceanView",
    newValue: "balcony",
    reason: "객실 타입 변경",
  },
  contractInstance,
  organization
);

console.log(result.isAutoApprovable); // true/false
console.log(result.reason); // "객실타입 자동 승인 가능 (가격 동일)"
console.log(result.autoApprovalConfig?.psychologyLenses); // ["L6(손실회피-비용보호)"]
```

---

### 2. evaluateAllFieldsAutoApproval()
**용도**: 단일 요청의 모든 필드에 대한 일괄 평가

```typescript
async function evaluateAllFieldsAutoApproval(
  fieldModifications: FieldModification[],
  contractInstance: any,
  organization: any
): Promise<{
  allAutoApprovable: boolean;          // 모든 필드 자동 승인 가능?
  results: AutoApprovalResult[];       // 각 필드별 결과
  reason: string;                      // 종합 판단 사유
  autoApprovalRate: number;            // 자동 승인 가능 비율 (0-1)
}>
```

**예제**:
```typescript
const fieldMods: FieldModification[] = [
  {
    fieldName: "travelDate",
    oldValue: "2026-07-01",
    newValue: "2026-07-10",
    reason: "일정 변경",
  },
  {
    fieldName: "specialRequests",
    oldValue: "",
    newValue: "창가 객실 부탁",
    reason: "특별 요청",
  },
];

const result = await evaluateAllFieldsAutoApproval(
  fieldMods,
  contractInstance,
  organization
);

console.log(result.allAutoApprovable); // true → 즉시 승인
console.log(result.autoApprovalRate); // 1.0 (100%)
console.log(result.reason); // "모든 필드가 자동 승인 가능"
```

---

### 3. getAutoApprovalStats()
**용도**: 조직별, 기간별 자동 승인 통계 조회 (목표: 70%+)

```typescript
async function getAutoApprovalStats(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalRequests: number;               // 전체 요청 수
  autoApprovedCount: number;           // 자동 승인된 수
  autoApprovalRate: number;            // 자동 승인율 (0-1)
  byField: Record<string, {           // 필드별 통계
    total: number;
    autoApproved: number;
    autoApprovalRate: number;
  }>;
  successMessage?: string;
}>
```

**예제**:
```typescript
const stats = await getAutoApprovalStats(
  "org-123",
  new Date("2026-06-01"),
  new Date("2026-06-30")
);

console.log(stats.autoApprovalRate); // 0.87 → 87%
console.log(stats.totalRequests); // 150
console.log(stats.autoApprovedCount); // 130
console.log(stats.successMessage); // "✅ 자동 승인율 87% (목표: 70%)"

// 필드별 통계
Object.entries(stats.byField).forEach(([field, data]) => {
  console.log(`${field}: ${data.autoApprovalRate * 100}%`);
});
// Output:
// travelDate: 95%
// roomType: 85%
// contactInfo: 100%
// specialRequests: 90%
// emergencyContact: 100%
// dietaryRestrictions: 95%
```

---

### 4. hasAutoApprovalConflict()
**용도**: 같은 필드에 대한 다중 수정 요청 감지

```typescript
function hasAutoApprovalConflict(requests: FieldModification[]): boolean
```

**예제**:
```typescript
const requests = [
  {
    fieldName: "travelDate",
    oldValue: "2026-07-01",
    newValue: "2026-07-05",
    reason: "Change 1",
  },
  {
    fieldName: "travelDate",
    oldValue: "2026-07-05",
    newValue: "2026-07-10",
    reason: "Change 2",
  },
];

const hasConflict = hasAutoApprovalConflict(requests);
console.log(hasConflict); // true → 수동 검토 필요
```

---

## 필드별 검증 규칙

### 1. travelDate (여행날짜) - 자동 승인율 95%

**언제 자동 승인되는가?**
- ✅ 출발까지 7일 이상 남음
- ✅ 과거 날짜가 아님
- ✅ 1년 이내의 날짜
- ✅ 크루즈 운항 스케줄 가능

**언제 수동 검토 필요한가?**
- ❌ 출발까지 7일 미만 (긴급 요청)
- ❌ 과거 날짜
- ❌ 1년 이상 먼 미래
- ❌ 운항 스케줄 없음

**심리학**: L10 (긴박감) - "출발까지 [N]일 남음"

---

### 2. roomType (객실타입) - 자동 승인율 85%

**언제 자동 승인되는가?**
- ✅ 허용된 객실 타입 (oceanView, balcony, suite, interior)
- ✅ 가격이 정확히 동일
- ✅ 다른 필드와 충돌 없음

**언제 수동 검토 필요한가?**
- ❌ 허용되지 않는 객실 타입
- ❌ 가격이 다름 (기존 가격보다 높거나 낮음)
- ❌ 동시에 가격도 변경 시도

**심리학**: L6 (손실회피) - "가격이 동일한 객실로만 변경 가능"

**예제**:
```typescript
// ✅ 자동 승인
{
  fieldName: "roomType",
  oldValue: "oceanView",  // 500만원
  newValue: "balcony",    // 500만원 (같은 가격)
  reason: "객실 타입 변경",
}

// ❌ 수동 검토
{
  fieldName: "roomType",
  oldValue: "oceanView",  // 500만원
  newValue: "suite",      // 800만원 (가격 차이)
  reason: "객실 타입 변경",
}
```

---

### 3. contactInfo (연락처 정보) - 자동 승인율 100%

**언제 자동 승인되는가?**
- ✅ 유효한 이메일 주소 (user@example.com)
- ✅ 유효한 한국 휴대폰 (010-XXXX-XXXX)

**언제 수동 검토 필요한가?**
- ❌ 잘못된 이메일 형식
- ❌ 잘못된 휴대폰 형식

**예제**:
```typescript
// ✅ 자동 승인
{
  fieldName: "contactInfo",
  oldValue: "old@example.com",
  newValue: "new@example.com",
  reason: "이메일 변경",
}

// ✅ 자동 승인
{
  fieldName: "phone",
  oldValue: "010-1234-5678",
  newValue: "010-9999-8888",
  reason: "휴대폰 변경",
}

// ❌ 수동 검토
{
  fieldName: "contactInfo",
  oldValue: "old@example.com",
  newValue: "not-an-email",
  reason: "이메일 변경",
}
```

---

### 4. specialRequests (특별 요청) - 자동 승인율 90%

**언제 자동 승인되는가?**
- ✅ 최대 500자 이하
- ✅ 금지 키워드 없음 (환불, 취소 등)
- ✅ XSS 공격 콘텐츠 없음

**언제 수동 검토 필요한가?**
- ❌ 500자 초과
- ❌ 환불/취소 관련 키워드 포함
- ❌ 스크립트/iframe 태그 포함

**금지 키워드**: cancel, refund, 취소, 환불, 반환

**예제**:
```typescript
// ✅ 자동 승인
{
  fieldName: "specialRequests",
  oldValue: "",
  newValue: "창가 객실과 조용한 위치를 부탁드립니다",
  reason: "특별 요청",
}

// ❌ 수동 검토
{
  fieldName: "specialRequests",
  oldValue: "",
  newValue: "이 예약을 취소하고 환불해주세요",
  reason: "특별 요청",
}
```

---

### 5. emergencyContact (긴급 연락처) - 자동 승인율 100%

**언제 자동 승인되는가?**
- ✅ 빈 값 (선택사항이므로 OK)
- ✅ 이름 50자 이하
- ✅ 휴대폰 형식 유효 (있을 경우)

**언제 수동 검토 필요한가?**
- ❌ 이름 50자 초과
- ❌ 휴대폰 형식 오류

**예제**:
```typescript
// ✅ 자동 승인
{
  fieldName: "emergencyContact",
  oldValue: "",
  newValue: "김철수,010-1234-5678",
  reason: "긴급 연락처 추가",
}

// ✅ 자동 승인 (빈값도 OK)
{
  fieldName: "emergencyContact",
  oldValue: "김철수,010-1234-5678",
  newValue: "",
  reason: "긴급 연락처 제거",
}

// ❌ 수동 검토
{
  fieldName: "emergencyContact",
  oldValue: "",
  newValue: "김철수,invalid-phone",
  reason: "긴급 연락처 추가",
}
```

---

### 6. dietaryRestrictions (식이제한) - 자동 승인율 95%

**언제 자동 승인되는가?**
- ✅ 최대 200자 이하
- ✅ 인정된 식이제한 정보
- ✅ 의료 용어는 경고만 (자동 승인은 됨)

**언제 수동 검토 필요한가?**
- ❌ 200자 초과

**인정된 식이제한**: vegetarian, vegan, gluten-free, halal, kosher, allergy, 채식, 글루텐, 할랄, 유제품불가, 계란불가, 견과류

**의료 용어** (경고만 표시): diabetes, hypertension, 심장, 당뇨, 고혈압

**예제**:
```typescript
// ✅ 자동 승인
{
  fieldName: "dietaryRestrictions",
  oldValue: "",
  newValue: "채식주의자",
  reason: "식이제한 추가",
}

// ✅ 자동 승인 (의료 정보는 경고만)
{
  fieldName: "dietaryRestrictions",
  oldValue: "",
  newValue: "당뇨 때문에 저탄수화물 식단 필요",
  reason: "식이제한 추가",
}
// 응답: "⚠️ 의료 관련 정보 포함 (전담자 확인 권장)"

// ❌ 수동 검토
{
  fieldName: "dietaryRestrictions",
  oldValue: "",
  newValue: "a".repeat(201), // 201자
  reason: "식이제한 추가",
}
```

---

## 코드 예제

### 예제 1: 간단한 요청 처리
```typescript
import { evaluateAutoApproval } from "@/lib/contract-modification-rules";

async function handleModificationRequest(
  request: FieldModification,
  contractInstance: any
) {
  const result = await evaluateAutoApproval(
    request,
    contractInstance,
    organization
  );

  if (result.isAutoApprovable) {
    // 즉시 승인
    console.log("✅ 자동 승인");
    return { approved: true, requestId };
  } else {
    // 관리자 검토 큐에 추가
    console.log("📋 수동 검토 필요:", result.reason);
    return { approved: false, requiresReview: true, reason: result.reason };
  }
}
```

---

### 예제 2: 복합 요청 처리 (여러 필드)
```typescript
import { evaluateAllFieldsAutoApproval } from "@/lib/contract-modification-rules";

async function handleBulkModification(
  fieldModifications: FieldModification[],
  contractInstance: any
) {
  const result = await evaluateAllFieldsAutoApproval(
    fieldModifications,
    contractInstance,
    organization
  );

  // 대시보드에 통계 표시
  console.log(`자동 승인율: ${(result.autoApprovalRate * 100).toFixed(1)}%`);

  if (result.allAutoApprovable) {
    // 모든 필드가 자동 승인 가능
    console.log("✅ 전체 자동 승인");
    return { bulkApproved: true };
  } else {
    // 일부만 자동 승인 → 관리자가 나머지 검토
    const approved = result.results
      .filter((r) => r.isAutoApprovable)
      .map((r) => r.autoApprovalConfig?.fieldName);

    const pending = result.results
      .filter((r) => !r.isAutoApprovable)
      .map((r) => r.autoApprovalConfig?.fieldName);

    console.log(`✅ 자동 승인: ${approved.join(", ")}`);
    console.log(`📋 수동 검토: ${pending.join(", ")}`);

    return { bulkApproved: false, approved, pending };
  }
}
```

---

### 예제 3: 통계 대시보드
```typescript
import { getAutoApprovalStats } from "@/lib/contract-modification-rules";

async function displayAutoApprovalDashboard() {
  const stats = await getAutoApprovalStats(
    organizationId,
    new Date(new Date().setDate(new Date().getDate() - 30)), // 30일
    new Date()
  );

  console.log("=== 자동 승인 통계 (30일) ===");
  console.log(`전체 요청: ${stats.totalRequests}건`);
  console.log(`자동 승인: ${stats.autoApprovedCount}건`);
  console.log(`자동 승인율: ${(stats.autoApprovalRate * 100).toFixed(1)}%`);
  console.log(`목표: 70% ${stats.autoApprovalRate >= 0.7 ? "✅ 달성" : "⏳ 진행 중"}`);
  console.log("");

  console.log("필드별 자동 승인율:");
  Object.entries(stats.byField).forEach(([field, data]) => {
    const percentage = (data.autoApprovalRate * 100).toFixed(1);
    console.log(
      `  - ${field}: ${percentage}% (${data.autoApproved}/${data.total})`
    );
  });
}
```

---

### 예제 4: API 엔드포인트 (Next.js)
```typescript
// POST /api/contracts/[id]/modifications/evaluate
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const { fieldModifications } = body;

  const contractInstance = await prisma.contractInstance.findUnique({
    where: { id: params.id },
  });

  const organization = await prisma.organization.findUnique({
    where: { id: contractInstance.organizationId },
  });

  const result = await evaluateAllFieldsAutoApproval(
    fieldModifications,
    contractInstance,
    organization
  );

  return Response.json({
    success: true,
    allAutoApprovable: result.allAutoApprovable,
    autoApprovalRate: result.autoApprovalRate,
    results: result.results,
    message: result.reason,
  });
}
```

---

## 심리학 렌즈

### L6: 손실회피 (Loss Aversion)
**정의**: 얻는 것보다 잃는 것에 더 민감한 심리

**적용 위치**: `validateRoomType()`

**전략**:
- 객실 가격 변경 시 자동 승인 불가 (기존 비용 보호)
- 메시지: "가격이 동일한 객실로만 변경 가능합니다"
- 효과: 고객이 안심하고 변경 요청 가능

**예제**:
```
고객 요청: "oceanView → suite 변경해주세요"
가격 확인: oceanView는 500만원, suite는 800만원
판단: 자동 승인 불가 (가격 상승)
메시지: "추가 비용이 발생하지 않는 객실로만 변경 가능합니다"
효과: 고객의 비용 불안감 완화
```

---

### L7: 동반자 (Companion/Family)
**정의**: 가족이나 신뢰할 수 있는 사람과 함께하려는 심리

**적용 위치**: `validateEmergencyContact()`, `validateDietaryRestrictions()`

**전략**:
- 비상 연락처 (가족 정보) 추가 장려
- 식이제한 (가족 건강) 중시
- 메시지: "배우자분께도 이 변경사항이 도움이 될 거라고 확신합니다"
- 효과: 가족 함께 결정 → 신뢰 증대

**예제**:
```
고객 요청: "배우자를 긴급 연락처로 추가하고 싶습니다"
판단: 자동 승인 ✅
메시지: "배우자분과 함께하는 여행이 더욱 안전해질 것입니다"
효과: 가족 중심의 신뢰감 형성
```

---

### L9: 건강/안전 (Health & Safety)
**정의**: 자신의 건강과 안전을 최우선으로 생각하는 심리

**적용 위치**: `validateDietaryRestrictions()`

**전략**:
- 의료 관련 정보 존중 (자동 승인하되 경고 표시)
- 메시지: "⚠️ 의료 관련 정보 포함 (전담자 확인 권장)"
- 효과: 건강 우려 해소 + 전담자 신뢰도 상승

**예제**:
```
고객 요청: "당뇨병이 있어서 저탄수 식단이 필요합니다"
판단: 자동 승인 ✅ (경고 포함)
메시지: "의료 관련 정보가 확인되었습니다. 저희 의료팀이 최선을 다하겠습니다"
효과: 건강 문제 해결에 전문성 어필 → 신뢰도 ↑
```

---

### L10: 긴박감 (Scarcity/Urgency)
**정의**: 제한된 시간 내에 결정해야 한다는 심리

**적용 위치**: `validateTravelDate()`

**전략**:
- 출발 기한 설정 (7일 이상 남으면 OK)
- 출발 임박 시 수동 검토 → 즉시 결정 유도
- 메시지: "출발까지 [N]일 남음" vs "출발 기한 임박"
- 효과: 시간 한정성 → 즉시 승인 필요성 강조

**예제**:
```
고객 요청: 출발 3일 전에 일정 변경 요청
판단: 수동 검토 필요 (긴급)
메시지: "출발이 임박했습니다. 관리자가 최우선으로 검토하겠습니다"
효과: 긴급 상황 대응 → 신뢰도 ↑
```

---

## FAQ

### Q1: 자동 승인되었는데도 거절할 수 있나요?
**A**: 네. 자동 승인은 추천일 뿐이며, 관리자는 언제든 거절 또는 대안 제시 가능합니다.

### Q2: 자동 승인율 70%를 못 달성하면?
**A**: 필드별 검증 규칙을 조정하거나, 심리학 렌즈를 강화하여 고객 이해도를 높일 수 있습니다.

### Q3: 새로운 필드를 추가하려면?
**A**: `AUTO_APPROVABLE_FIELDS`에 필드 정의 + `validateXXX()` 함수 추가 + 테스트 작성

### Q4: 충돌이 감지되면?
**A**: `hasAutoApprovalConflict()`가 true 반환 → 자동 승인 불가 → 관리자가 우선순위 결정

### Q5: 심리학 렌즈를 다르게 적용할 수 있나요?
**A**: 네. 각 검증 함수의 `psychologyLenses` 배열을 수정하여 다른 렌즈 적용 가능

### Q6: 성능은 어떻게 되나요?
**A**: 각 검증은 O(1) 또는 O(n) 복잡도이므로, 100개 필드도 <100ms 내 완료

### Q7: 데이터베이스 저장은 어떻게?
**A**: Phase 6에서 `ContractModificationRequest` 테이블 추가 예정

---

## 참고 자료

### 파일 위치
- 주요 코드: `D:\mabiz-crm\src\lib\contract-modification-rules.ts`
- 타입 정의: `D:\mabiz-crm\src\lib\types\contract-modification.ts`
- 단위 테스트: `D:\mabiz-crm\src\lib\contract-modification-rules.test.ts`
- 구현 문서: `D:\mabiz-crm\CONTRACT_MODIFICATION_RULES_IMPLEMENTATION.md`

### 관련 문서
- [Grant Cardone 10렌즈 완전 가이드](../docs/)
- [Russell Brunson 거래 재협상](../docs/)
- [SPIN 질문 기법](../docs/)

---

**마지막 업데이트**: 2026-06-15  
**담당팀**: Team-A (Contract Rules Engine)  
**상태**: Phase 5 완료 → Phase 6 (API 통합) 진행 예정
