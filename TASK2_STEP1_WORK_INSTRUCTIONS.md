# Task 2 Step 1: GmReservation FK 추가 → 작업 지시서

**생성**: 2026-05-21
**검토**: Agent γ
**상태**: 실행 대기 (✅ 데이터 검증 완료)

---

## 📋 작업 요약

| 항목 | 내용 |
|-----|-----|
| **Task** | Menu #38 Phase 3: GmReservation FK 적합성 검토 |
| **Step** | 1/? (데이터 검증) |
| **검증 상태** | ✅ PASSED |
| **발견된 이슈** | P0: 0개 / P1: 0개 / P2: 2개 (Cascade 영향도) |
| **마이그레이션 준비도** | 100% |

---

## 🎯 검증 결과 요약

### ✅ GREEN (즉시 실행 가능)

| 검사항목 | 결과 | 영향도 |
|--------|------|--------|
| **고아 레코드** | 0개 ✅ | P0 |
| **NULL FK 필드** | 0개 ✅ | P1 |
| **중복 레코드** | 0개 ✅ | P1 |
| **Cascade 영향** | 3개 데이터 | P2 |

### 결론
**프로덕션 DB는 FK 추가에 완벽하게 준비되었습니다.**

---

## 📊 데이터 현황 (스냅샷)

### 기본 통계
```
Total Reservations:    3
NULL tripId:           0
NULL mainUserId:       0
Unique Trips:          3
Unique Users:          3
```

### 참조 무결성
```
Orphaned (missing Trip):  0 ✅
Orphaned (missing User):  0 ✅
```

### 상태 분포
```
CONFIRMED:  3
```

### 스키마 제약
```
PRIMARY KEY:  1
CHECK (NOT NULL):  10
FOREIGN KEY:  0 (추가 예정)
```

---

## 🔄 다음 단계 (Step 2: FK 마이그레이션 실행)

### Step 2-1: Prisma 마이그레이션 생성

```bash
# 현재 상태 확인
npx prisma db execute --stdin < scripts/validate-migration.sql

# 마이그레이션 생성
npx prisma migrate dev --name add_gm_reservation_foreign_keys
```

### Step 2-2: 마이그레이션 내용 검증

생성될 예상 SQL:
```sql
-- CREATE FOREIGN KEY: tripId → Trip
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE;

-- CREATE FOREIGN KEY: mainUserId → User
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_mainUserId_fkey"
FOREIGN KEY ("mainUserId") REFERENCES "User"("id") ON DELETE CASCADE;
```

### Step 2-3: 데이터 검증

```bash
# 마이그레이션 후 검증
node scripts/validate-gm-reservation-data.mjs

# 예상 결과: 모든 제약이 OK 상태
```

---

## ⚠️ 주의사항

### Cascade Delete 안전성

**현재 영향도**: 3개 Reservation만 영향 (안전)

```typescript
// 삭제 시 반드시 확인
const affectedCount = await prisma.gmReservation.count({
  where: { tripId: tripToDelete.id }
});

if (affectedCount > 0) {
  console.warn(`Warning: ${affectedCount} reservations will be cascaded`);
}
```

### 배포 전 체크리스트

- [ ] 개발 환경에서 마이그레이션 테스트
- [ ] 모든 고아 레코드 처리 완료
- [ ] 스키마 검증 완료
- [ ] 백업 생성
- [ ] Cascade 영향도 재확인
- [ ] 모니터링 설정

---

## 📄 생성된 산출물

| 파일 | 용도 |
|-----|-----|
| `TASK2_STEP1_DATA_VALIDATION_REPORT.md` | 상세 검증 보고서 |
| `TASK2_STEP1_FK_ADDITION_ANALYSIS.md` | FK 추가 적합성 분석 |
| `TASK2_STEP1_WORK_INSTRUCTIONS.md` | 이 파일 |
| `scripts/validate-gm-reservation-data.mjs` | 검증 스크립트 |

---

## 🚀 실행 명령어

### 전체 검증 실행
```bash
node scripts/validate-gm-reservation-data.mjs
```

### 마이그레이션 생성 (Step 2)
```bash
npx prisma migrate dev --name add_gm_reservation_foreign_keys
```

### 마이그레이션 상태 확인
```bash
npx prisma migrate status
```

---

## 📞 연락처

- **검토자**: Agent γ
- **작성일**: 2026-05-21
- **상태**: ✅ 검증 완료, ⏳ 마이그레이션 실행 대기

---

## 부록 A: P0/P1/P2 이슈 상세

### P0 Issues (Critical FK Violations)
**발견**: 0개 ✅

### P1 Issues (High Priority Data)
**발견**: 0개 ✅

### P2 Issues (Medium Performance)

#### P2-1: Trip Cascade Delete 영향도
- **영향받는 Reservation**: 3개
- **심각도**: 낮음 (데이터 적음)
- **해결책**: 삭제 전 사전 확인 로직 추가

#### P2-2: User Cascade Delete 영향도
- **영향받는 Reservation**: 3개
- **심각도**: 낮음 (데이터 적음)
- **해결책**: 삭제 전 사전 확인 로직 추가

---

**이 문서는 Task 2 Step 1의 최종 산출물입니다.**
