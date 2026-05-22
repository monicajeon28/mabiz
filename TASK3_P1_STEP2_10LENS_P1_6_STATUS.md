# Task 3 Step 2: P1-6 (DLQ 상태 관리) 10렌즈 토론

## Context
- P0 완료, P1-9/P1-4-11/P1-1/P1-3 완료
- **P1-6 선택**: DLQ 상태 관리 (상태 필드 명확화)

---

## P1-6: DLQ 상태 필드 미사용 / 암묵적 상태 관리

**현황:**
```typescript
// prisma/schema.prisma: status 필드 없음!
model MabizSyncDLQ {
  resolvedAt: DateTime?
  nextRetryAt: DateTime?
  retryCount: Int
  // status: String  ← 없음!
}

// 현재 상태 판단 방식 (암묵적)
// resolvedAt == null && nextRetryAt <= now → PENDING (재시도 가능)
// resolvedAt == null && nextRetryAt > now → WAITING (아직 기다림)
// resolvedAt != null → RESOLVED (완료)
// 
// 없는 상태:
// PROCESSING ← P1-10 멱등성에 필수!
// FAILED ← 3회 이상 실패 후 최종 상태
```

**문제점:**
1. 상태가 필드가 아니라 날짜 필드의 조합으로 판단 (암묵적)
2. PROCESSING 상태가 없음 → P1-10 멱등성 처리 불가능
3. FAILED 상태가 없음 → 최종 실패한 항목 구분 불가능
4. 향후 상태 추가 시 필드 추가 필요 (확장성 낮음)
5. 상태 전이(FSM) 정의 안됨 → 버그 가능성

---

## 10렌즈 분석

| 렌즈 | 평가 | 설명 |
|------|------|------|
| **보안** | ✅ 좋음 | 보안 이슈 아님 |
| **신뢰성** | 🔴 높음 | 멀티 Cron 인스턴스에서 중복 처리 가능 |
| **운영성** | 🟡 중간 | 상태 조회 쿼리가 복잡함 |
| **테스트성** | 🔴 높음 | 상태별 테스트 케이스 정의 어려움 |
| **명확성** | 🔴 높음 | 상태가 암묵적 → 코드 이해 어려움 |
| **유지보수** | 🔴 높음 | 상태 추가 시 여러 곳 수정 필요 |
| **성능** | 🟡 중간 | WHERE resolvedAt=null AND nextRetryAt<=now 조건 필요 |
| **확장성** | 🔴 높음 | 새 상태 추가 시 스키마 설계 필요 |
| **문서화** | 🔴 높음 | 상태 전이(FSM) 문서 없음 |
| **의도** | 🔴 높음 | "왜 status 필드가 없는가?" 불명확 |

---

## 핵심 의사결정

### **Q1: 추가할 상태는?**

**Option A (권장): 4가지 상태**
```typescript
type DLQStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'FAILED';

// PENDING: 재시도 대기 중 (nextRetryAt <= now)
// PROCESSING: 현재 처리 중 (중복 처리 방지)
// RESOLVED: 성공 완료 (resolvedAt 설정됨)
// FAILED: 최대 재시도 도달 (resolvedAt + reason 저장)
```

**Option B (보수): 3가지 상태**
```typescript
type DLQStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
// PROCESSING 생략 (멱등성은 다른 방식으로)
```

---

### **Q2: 기존 데이터는 어떻게 마이그레이션?**

**Option A (권장): 자동 마이그레이션**
```sql
-- 기존: resolvedAt = null && nextRetryAt <= now → PENDING
-- 기존: resolvedAt != null → RESOLVED (또는 성공 여부에 따라 다름)
ALTER TABLE "MabizSyncDLQ" ADD COLUMN "status" VARCHAR(20);

UPDATE "MabizSyncDLQ"
SET "status" = CASE
  WHEN "resolvedAt" IS NOT NULL THEN 'RESOLVED'
  ELSE 'PENDING'
END;
```

**Option B (보수): 기본값 설정**
```sql
ALTER TABLE "MabizSyncDLQ" 
ADD COLUMN "status" VARCHAR(20) DEFAULT 'PENDING';
```

---

### **Q3: resolvedAt 필드는 유지할 것인가?**

**Option A (권장): 유지**
```
status: RESOLVED + resolvedAt: 2026-05-22 10:00:00
status: FAILED + resolvedAt: 2026-05-22 10:00:00
→ 언제 완료되었는지 추적 가능
```

**Option B (제거)**: status만 사용
```
→ 간단하지만 완료 시간 정보 손실
```

---

## 권장 해결책

### **상태 전이 (FSM)**
```
    PENDING
       ↓
   PROCESSING ← (Cron 시작)
      ↙    ↘
  RESOLVED  FAILED (3회 이상 재시도)
  (성공)    (영구 실패)
```

### **구현 방향**
1. status 필드 추가 (VARCHAR(20), NOT NULL DEFAULT 'PENDING')
2. enqueueDLQ: status='PENDING'
3. getPendingDLQEntries: WHERE status='PENDING'
4. retry-mabiz-dlq: entry 처리 전 status='PROCESSING'으로 업데이트
5. resolveDLQ: status='RESOLVED'
6. failDLQ: 3회 이상 시 status='FAILED'

### **인덱스**
```sql
CREATE INDEX "idx_dlq_status" ON "MabizSyncDLQ"("status");
CREATE INDEX "idx_dlq_status_nextretry" ON "MabizSyncDLQ"("status", "nextRetryAt");
```

---

## 의사결정 포인트

**Q1: 상태 개수?**
- A (권장): 4가지 (PENDING/PROCESSING/RESOLVED/FAILED). P1-10 멱등성 필수.

**Q2: 마이그레이션?**
- A (권장): 자동 마이그레이션. 기존 resolvedAt 기반으로 status 설정.

**Q3: resolvedAt 유지?**
- A (권장): 유지. 완료 시간 추적 필요.

---

## 결론 (Step 2 완료)

**P1-6 핵심 문제:**
> DLQ 상태가 **암묵적** (날짜 조합) → **명시적** 상태 필드 필요

**권장 해결 순서:**
1. ✅ P1-6 분석 (완료)
2. 🔄 마이그레이션 작성 (Step 4)
   - status VARCHAR(20) DEFAULT 'PENDING' 추가
   - 기존 데이터 마이그레이션
   - 인덱스 추가
3. 🔄 코드 수정 (Step 4)
   - enqueueDLQ: status='PENDING'
   - getPendingDLQEntries: status='PENDING' 조건
   - retry-mabiz-dlq: PROCESSING 상태 관리
   - resolveDLQ/failDLQ: status 업데이트
4. ⏳ 테스트 (Step 5)
5. ⏳ 커밋 (Step 6)

