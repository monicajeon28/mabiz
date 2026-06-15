# Contract Modification Auto-Approval Engine - 사용 가이드

## 개요

자동 승인 규칙 엔진은 계약 수정 요청(ContractModificationRequest)을 자동으로 평가하고 승인하는 시스템입니다.

- **파일**: `contract-modification-rules.ts` + `contract-modification-auto-approval.ts`
- **목표**: 70%+ 자동 승인율 (낮은 복잡도)
- **렌즈**: L2(복잡도) + L6(손실회피) + L10(긴박감)

---

## 1. 규칙 엔진 기본 사용

### 1.1 단일 요청 평가

```typescript
import { evaluateAutoApproval } from "@/lib/contract-modification-rules";

const result = await evaluateAutoApproval({
  id: "mod-req-001",
  contractId: "contract-123",
  fieldName: "tripDate", // 필드명
  newValue: "2026-08-01", // 새로운 값
  currentValue: "2026-07-15", // 현재 값
  requestedByUserId: "user-456",
});

console.log(result);
// {
//   isAutoApprovable: true,
//   reason: "여행 날짜 자동 승인 가능 (복잡도: 25)",
//   complexity: 25,
//   dealRiskFlag: false,
//   appliedLenses: ["L2_LOW_COMPLEXITY", "L10_URGENCY"],
//   validationDetails: { valid: true, complexity: 25 }
// }
```

### 1.2 자동 승인 가능 필드 목록

| 필드명 | 카테고리 | 자동 승인 가능 | 설명 |
|--------|---------|---------------|------|
| `tripDate` | timeline | ✅ Yes | 여행 날짜 (7일 이후만) |
| `roomType` | inventory | ✅ Yes | 객실 타입 (같은 가격대) |
| `contactInfo` | contact | ✅ Yes | 이메일/휴대폰 (형식 검증) |
| `specialRequest` | preference | ✅ Yes | 특별 요청 (≤500자) |
| `dietaryRestriction` | preference | ✅ Yes | 식이 제한 (≤200자) |
| `price` | financial | ❌ No | 가격 (항상 수동 검토) |
| `paymentTerms` | financial | ❌ No | 결제 조건 (항상 수동 검토) |

---

## 2. 자동 승인 판정 엔진 (심리학 렌즈)

### 2.1 결정 엔진 사용

```typescript
import { makeAutoApprovalDecision } from "@/lib/contract-modification-auto-approval";

const decision = await makeAutoApprovalDecision({
  id: "mod-req-002",
  contractId: "contract-456",
  fieldName: "roomType",
  newValue: "BALCONY",
  currentValue: "OCEAN_VIEW",
  requestedByUserId: "user-789",
  requestedAt: new Date(),
});

console.log(decision);
// {
//   status: "PENDING", // AUTO_APPROVED 또는 PENDING
//   evaluation: { ... },
//   lensDetectionDetails: {
//     detectedLenses: ["L2_MEDIUM_COMPLEXITY", "L6_LOSS_AVERSION"],
//     reasoning: {
//       L2: "거래 복잡도가 중간 (75/100): 운영 제약 또는 금액 영향",
//       L6: "재정적 또는 중요 변경으로 인한 고객 불안감"
//     },
//     recommendations: [
//       "운영팀/재무팀 검토 필수",
//       "고객 의도 충분히 이해 후 대안 제시"
//     ],
//     riskLevel: "MEDIUM"
//   },
//   mediation5Steps: {
//     situation: "현재 배정된 객실은 OCEAN_VIEW입니다. 맞나요?",
//     problem: "다른 객실로 변경해야 하는 구체적인 이유가 뭔가요?",
//     implication: "객실 변경이 여행 경험에 어떤 긍정적/부정적 영향을 미칠까요?",
//     needsPayoff: "새로운 객실이 당신의 기대를 더 충족할 것 같은 이유는 뭔가요?",
//     successCriteria: "객실 변경 후에 다른 수정 요청은 없을 것 같습니까?"
//   },
//   summary: {
//     isRiskFlag: true,
//     estimatedApprovalTime: "24시간 (영업일)",
//     recommendation: "수동 검토 - 지원팀 면밀 검토 필요 | L6 손실회피: 고객 불안감 먼저 해소"
//   }
// }
```

### 2.2 심리학 렌즈 탐지 (L0-L10)

자동으로 탐지되는 렌즈:

| 렌즈 | 신호 | 권고 사항 |
|-----|------|---------|
| **L0_INCOMPLETE** | 필드가 비어있음 | 필수 정보 입력 요청 |
| **L1_REACTIVATION** | 고객이 정보 추가 | 긍정적 톤으로 빠르게 응답 |
| **L2_LOW_COMPLEXITY** | 복잡도 <40 | 자동 승인 가능 |
| **L2_MEDIUM_COMPLEXITY** | 복잡도 40-70 | 기본 검토 후 처리 |
| **L2_HIGH_COMPLEXITY** | 복잡도 >70 | 운영팀 검토 필수 |
| **L6_LOSS_AVERSION** | 금액/중요 변경 | 대안 3가지 제시 |
| **L7_COMPANION** | 동반자 관련 | '함께' 만족도 강조 |
| **L10_URGENCY** | 여행 일정 임박 | 24시간 이내 처리 |

---

## 3. API 라우트 구현 예제

### 3.1 POST /api/contracts/[contractId]/modifications

```typescript
// src/app/api/contracts/[contractId]/modifications/route.ts

import { NextRequest, NextResponse } from "next/server";
import { makeAutoApprovalDecision } from "@/lib/contract-modification-auto-approval";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const body = await request.json();
    const { fieldName, newValue, currentValue, requestedByUserId } = body;

    // 1. 자동 승인 판정
    const decision = await makeAutoApprovalDecision({
      id: `mod-${Date.now()}`,
      contractId: params.contractId,
      fieldName,
      newValue,
      currentValue,
      requestedByUserId,
      requestedAt: new Date(),
    });

    // 2. 데이터베이스에 요청 저장
    const modificationRequest = await prisma.contractModificationRequest.create({
      data: {
        contractId: params.contractId,
        fieldName,
        currentValue,
        newValue,
        requestedByUserId,
        status: decision.status,
        complexity: decision.evaluation.complexity,
        appliedLenses: decision.evaluation.appliedLenses,
        mediation5Steps: decision.mediation5Steps,
        lensDetectionDetails: decision.lensDetectionDetails,
        autoDecisionSummary: decision.summary,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 유효기한
      },
    });

    // 3. 자동 승인 시 즉시 적용
    if (decision.status === "AUTO_APPROVED") {
      // ContractInstance.boundData 업데이트
      const contract = await prisma.contractInstance.findUnique({
        where: { id: params.contractId },
      });

      const updatedBoundData = {
        ...(contract?.boundData || {}),
        [fieldName]: newValue,
      };

      await prisma.contractInstance.update({
        where: { id: params.contractId },
        data: { boundData: updatedBoundData },
      });

      // 수정 기록 로깅
      await prisma.contractModificationRequest.update({
        where: { id: modificationRequest.id },
        data: {
          approvedByUserId: "SYSTEM_AUTO",
          approvedAt: new Date(),
        },
      });
    }

    return NextResponse.json(decision, { status: 201 });
  } catch (error) {
    console.error("Error processing modification request:", error);
    return NextResponse.json(
      { error: "수정 요청 처리 중 오류 발생" },
      { status: 500 }
    );
  }
}
```

### 3.2 GET /api/contracts/[contractId]/modifications

```typescript
// 수정 요청 목록 조회

export async function GET(
  request: NextRequest,
  { params }: { params: { contractId: string } }
) {
  const requests = await prisma.contractModificationRequest.findMany({
    where: { contractId: params.contractId },
    orderBy: { requestedAt: "desc" },
    take: 20,
  });

  // 통계 계산
  const stats = calculateAutoApprovalStats(requests);

  return NextResponse.json({ requests, stats });
}
```

---

## 4. 복잡도 점수 해석

### 4.1 복잡도 범위

| 점수 | 수준 | 승인 시간 | 처리 담당 |
|------|------|---------|---------|
| 0-30 | 매우 낮음 | 즉시 | 자동 |
| 31-50 | 낮음 | 1-2시간 | 운영팀 최종 확인 |
| 51-70 | 중간 | 24시간 | 지원팀 검토 |
| 71-90 | 높음 | 2-3일 | 재무팀 협의 |
| 91-100 | 매우 높음 | 4-5일+ | 고위험 (거절 가능) |

### 4.2 복잡도 계산 예

```typescript
// 여행 날짜 수정 (15일 후)
tripDate: 25점 (낮음 - L2_LOW_COMPLEXITY)

// 객실 타입 변경 (가격 차이 있음)
roomType: 75점 (높음 - L2_HIGH_COMPLEXITY + L6_LOSS_AVERSION)

// 가격 변경 (+10%)
price: 75점 (높음 - 금액 관련, 항상 수동)

// 특별 요청
specialRequest: 18점 (매우 낮음)
```

---

## 5. KPI 및 성과 추적

### 5.1 자동 승인율 목표

```typescript
import { calculateAutoApprovalStats } from "@/lib/contract-modification-rules";

// 주간 통계
const weeklyStats = await getModificationStats("weekly");
const autoApprovalRate = weeklyStats.autoApprovalRate; // 70% 이상 목표

// 필드별 분석
const fieldStats = groupByField(weeklyStats.requests);
// tripDate: 95% (매우 높음)
// roomType: 40% (낮음 - 가격 차이로 인함)
// price: 0% (항상 수동)
```

### 5.2 위험도 분석

```typescript
// HIGH 위험 요청만 필터링
const highRiskRequests = requests.filter(
  (r) => r.lensDetectionDetails.riskLevel === "HIGH"
);

// 렌즈별 위험도 분포
const lensRiskMap = {
  L0_INCOMPLETE: "HIGH",
  L6_LOSS_AVERSION: "MEDIUM",
  L10_URGENCY: "MEDIUM",
};
```

---

## 6. 운영 가이드

### 6.1 수정 요청 처리 플로우

```
[수정 요청 접수]
      ↓
[자동 승인 판정 엔진 실행]
      ↓
┌─────────────────────────┐
│ AUTO_APPROVED?          │
└─────────────────────────┘
      ├─→ YES: [즉시 적용 + 로깅]
      │        ↓
      │     [고객 알림]
      │
      └─→ NO: [PENDING]
             ↓
          [운영팀 검토]
             ├─→ APPROVE: [적용 + 로깅]
             └─→ REJECT: [거절 사유 전달]
```

### 6.2 운영팀 체크리스트

자동 승인되지 않은 요청(`PENDING`)을 검토할 때:

- [ ] L2 중재 5단계 질문 검토 (고객 의도 이해)
- [ ] 적용된 렌즈 확인 (심리학 신호)
- [ ] 복잡도 점수 고려 (높을수록 신중히)
- [ ] 운영상 제약 확인 (여행 7일 이내 등)
- [ ] 고객 만족도 우선 (대안 3가지 제시)

---

## 7. 확장 가능성

### 7.1 필드 추가

새로운 필드 추가:

```typescript
export const AUTO_APPROVABLE_FIELDS = {
  // ... 기존 필드
  
  // 새로운 필드 추가
  emergencyContact: {
    label: "긴급 연락처",
    category: "contact",
    isAutoApprovable: true,
    validator: async (newValue, contract) => {
      // 유효성 검사 로직
      return { valid: true, complexity: 20 };
    },
  },
};
```

### 7.2 렌즈 추가

심리학 렌즈 탐지 규칙 확장:

```typescript
// L3: 차별화 (customization)
if (fieldName === "specialRequest" && newValue.length > 50) {
  lenses.push("L3_DIFFERENTIATION");
  // 맞춤형 서비스로 마케팅
}

// L5: 적합성 (suitability)
if (roomTypeMatches(newValue, customerProfile)) {
  lenses.push("L5_SUITABILITY");
  // 고객 프로필과 매칭
}
```

---

## 8. 보안 및 감사

### 8.1 데이터 추적

```typescript
// ContractModificationRequest 모델
{
  id: string;
  contractId: string;
  fieldName: string;
  currentValue: string;
  newValue: string;
  
  // 요청자 정보
  requestedByUserId: string;
  requestedAt: DateTime;
  
  // 승인 정보
  status: "PENDING" | "AUTO_APPROVED";
  approvedByUserId?: string;
  approvedAt?: DateTime;
  
  // 평가 정보
  complexity: number;
  appliedLenses: string[];
  mediation5Steps: Json;
  lensDetectionDetails: Json;
  
  // 유효기한
  expiresAt: DateTime; // 7일
}
```

### 8.2 감사 로그

모든 수정은 자동 기록됨:

```sql
SELECT * FROM "ContractModificationRequest"
WHERE "contractId" = $1
ORDER BY "requestedAt" DESC;
```

---

## 9. 성과 예측

### 9.1 자동 승인율 목표

- **현재**: 0% (새로운 기능)
- **1주차**: 60% (기본 필드만)
- **1개월**: 70%+ (렌즈 최적화)
- **3개월**: 75%+ (고객 패턴 학습)

### 9.2 운영 효율 개선

| 메트릭 | 현재 | 목표 | 효과 |
|--------|------|------|------|
| 평균 승인 시간 | 24시간 | 15분 | 93% 단축 |
| 수동 검토량 | 100% | 30% | 70% 감소 |
| 고객 만족도 | 70% | 85% | 빠른 응답 |

---

## 10. 트러블슈팅

### Q: 특정 필드가 항상 PENDING이 반환됨

A: 복잡도 점수를 확인하세요.
```typescript
// 높은 복잡도 → 수동 검토
if (complexity > 70) {
  status = "PENDING";
}
```

### Q: 렌즈 탐지가 안 되는 필드

A: `detectPsychologyLenses()` 함수에 필드 분기문 추가 필요.

### Q: 자동 승인율이 목표(70%)보다 낮음

A:
1. 복잡도 임계값 조정 (50→60)
2. 렌즈별 가중치 재조정
3. 필드별 규칙 완화 (예: tripDate 7일→14일)

---

**Last Updated**: 2026-06-15
**Lens Template Version**: T10 (심리학 렌즈 통합)
