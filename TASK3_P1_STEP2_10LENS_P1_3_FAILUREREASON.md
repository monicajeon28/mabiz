# Task 3 Step 2: P1-3 (failureReason 길이) 10렌즈 토론

## Context
- P0 완료, P1-9/P1-4/P1-11/P1-1 완료
- **P1-3 선택**: failureReason 필드 길이 제한 없음 (고위험도)

---

## P1-3: failureReason 필드 길이 제한 없음

**현황:**
```typescript
// prisma/schema.prisma L1201
failureReason String  // ← 길이 제한 없음!

// src/lib/mabiz-dlq.ts L20, L51
data: {
  failureReason,  // 스택 트레이스 전체 저장 시도 가능
  ...
}
```

**문제점:**
1. failureReason이 Text 타입 (또는 varchar 무제한)
2. 스택 트레이스/긴 오류 메시지 저장 시 DB가 truncate할 수 있음
3. **truncate되면 원본 오류 정보 손실** → 디버깅 불가능
4. 다른 필드는 길이 제한 있음:
   - format: @db.VarChar(20)
   - syncType: @db.VarChar(50)
   - webhookUrl: String (제한 없음 - 하지만 URL은 짧음)
5. 불일관한 설계 → 유지보수 어려움

---

## 10렌즈 분석

| 렌즈 | 평가 | 설명 |
|------|------|------|
| **보안** | ✅ 좋음 | 보안 이슈 아님 |
| **신뢰성** | 🔴 높음 | 오류 정보 손실 → 디버깅 불가 |
| **운영성** | 🔴 높음 | 장애 원인 파악 불가능 |
| **테스트성** | 🟡 중간 | 긴 오류 메시지 테스트 필요 |
| **명확성** | 🔴 높음 | 필드 길이 제한이 불명확함 |
| **유지보수** | 🔴 높음 | 필드별 길이가 다르면 코드 복잡 |
| **성능** | 🟡 중간 | 매우 긴 문자열 저장 시 메모리/쿼리 성능 영향 |
| **확장성** | 🟡 중간 | 새 필드 추가 시 길이 결정 필요 |
| **문서화** | 🔴 높음 | 왜 failureReason만 길이 제한 없는지 불명확 |
| **의도** | 🔴 높음 | "어디까지 저장할 것인가?" 정의 필요 |

---

## 핵심 의사결정

### **Q1: failureReason의 적절한 길이는?**

**Option A (권장): 1,000자**
```typescript
failureReason: String @db.VarChar(1000)
// 이유: 스택 트레이스 3-5줄 정도 포함 가능
// 예: "Error: Connection timeout at PayApp\n  at ...\n  at ..."
```

**Option B (보수)**: 500자
```typescript
failureReason: String @db.VarChar(500)
// 이유: 간결성, 저장 공간 절감
// 단점: 스택 트레이스 2줄 이상이면 손실
```

**Option C (안전)**: 2,000자
```typescript
failureReason: String @db.VarChar(2000)
// 이유: 전체 스택 트레이스 안전하게 저장
// 단점: 저장 공간 증가
```

---

### **Q2: failureReason 저장 시 truncate할 것인가?**

**Option A (추천)**: 코드에서 명시적으로 truncate
```typescript
// mabiz-dlq.ts
const maxLength = 1000;
const truncatedReason = reason.length > maxLength 
  ? reason.slice(0, maxLength) + '... (truncated)'
  : reason;

data: {
  failureReason: truncatedReason,
}
```

**Option B**: DB 자동 truncate (위험)
```
← 명시적이지 않음, 손실 알 수 없음
```

---

### **Q3: 다른 필드들도 길이 제한을 명시해야 하나?**

**Option A (권장)**: 모든 String 필드 길이 명시
```typescript
webhookType: String @db.VarChar(100)
webhookUrl: String @db.VarChar(2000)
failureReason: String @db.VarChar(1000)
```

**Option B**: 필요한 것만 (현재 상태 유지)
```
← 불일관함, 향후 문제 가능
```

---

## 권장 해결책

### **1단계: failureReason 길이 결정**
- **선택: 1,000자** (스택 트레이스 3-5줄 포함 가능)

### **2단계: 마이그레이션 작성**
```sql
ALTER TABLE "MabizSyncDLQ"
ADD COLUMN "failureReason_new" VARCHAR(1000),
ALTER COLUMN "failureReason" TYPE VARCHAR(1000);
```

### **3단계: mabiz-dlq.ts 수정**
```typescript
const MAX_FAILURE_REASON_LENGTH = 1000;

export async function failDLQ(id: string, retryCount: number, reason: string) {
  const truncatedReason = reason.length > MAX_FAILURE_REASON_LENGTH
    ? reason.slice(0, MAX_FAILURE_REASON_LENGTH) + '... (truncated)'
    : reason;
  
  // ... update with truncatedReason
}
```

### **4단계: 스키마 명확화**
```typescript
// schema.prisma
failureReason String @db.VarChar(1000)  // 오류 메시지, 최대 1000자
```

---

## 의사결정 포인트

**Q1: failureReason 길이?**
- A (권장): 1,000자. 스택 트레이스 대부분 포함.

**Q2: 코드에서 truncate?**
- A (권장): 예. 명시적 처리, truncated 표시.

**Q3: 다른 필드도?**
- A (권장): webhookType, webhookUrl도 길이 제한 추가.

---

## 결론 (Step 2 완료)

**P1-3 핵심 문제:**
> failureReason이 길이 제한 없음 → **오류 정보 손실 위험**

**권장 해결 순서:**
1. ✅ P1-3 분석 (완료)
2. 🔄 마이그레이션 작성 (Step 4)
3. 🔄 코드 수정 (Step 4)
   - mabiz-dlq.ts: MAX_FAILURE_REASON_LENGTH 상수
   - failDLQ/enqueueDLQ: 명시적 truncate
4. ⏳ schema 검증 (Step 4)
5. ⏳ 테스트 (Step 5)
6. ⏳ 커밋 (Step 6)

