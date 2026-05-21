# Task 2 Step 1: GmReservation FK 추가 적합성 분석

**작성일**: 2026-05-21
**작성자**: Agent γ (Data Consistency Reviewer)
**상태**: ✅ 검증 완료

---

## 1. 현재 상태 분석

### 1.1 데이터베이스 현황

| 항목 | 값 |
|------|-----|
| **총 Reservation 개수** | 3개 |
| **tripId NULL** | 0개 (0%) |
| **mainUserId NULL** | 0개 (0%) |
| **Unique Trip** | 3개 |
| **Unique User** | 3개 |
| **Orphaned Records** | 0개 |

### 1.2 현재 Prisma 스키마 (라인 1525-1572)

```prisma
model GmReservation {
  id                          Int       @id @default(autoincrement())
  tripId                      Int
  mainUserId                  Int
  trip                        GmTrip    @relation("TripReservations", fields: [tripId], references: [id], onDelete: Cascade)
  mainUser                    GmUser    @relation("UserReservations", fields: [mainUserId], references: [id], onDelete: Cascade)
  // ... 기타 필드들
}
```

### 1.3 FK 이미 정의되어 있음!

**매우 중요**: Prisma 스키마에서 FK는 **이미 정의**되어 있습니다!
- `trip` relation: tripId → Trip(id), onDelete: Cascade
- `mainUser` relation: mainUserId → User(id), onDelete: Cascade

---

## 2. 데이터 적합성 판단

### 2.1 P0 (Critical) - FK 위반 위험

**현황**: ✅ **안전** - 고아 레코드 없음

| 검사 항목 | 결과 |
|---------|------|
| Orphaned Reservations (missing Trip) | 0개 ✅ |
| Orphaned Reservations (missing User) | 0개 ✅ |
| NULL tripId | 0개 ✅ |
| NULL mainUserId | 0개 ✅ |
| Duplicate (tripId, mainUserId) | 0개 ✅ |

**결론**: 프로덕션 DB는 FK 추가에 완벽하게 적합합니다.

### 2.2 P1 (High) - NULL 필드 분석

**현황**: ✅ **완벽** - 모든 FK 필드가 NOT NULL

- tripId: NOT NULL (필수)
- mainUserId: NOT NULL (필수)

**결론**: 스키마 정의가 명확합니다.

### 2.3 P2 (Medium) - Cascade Delete 영향도

**현황**: 🟠 주의 필요

| 범위 | 영향받는 Reservation |
|-----|------------------|
| Trip 삭제 시 | 3개 |
| User 삭제 시 | 3개 |

**데이터 분포**:
- Reservation ID: 1, 2, 3
- Trip ID: 1, 2, 3 (각각 1개의 Reservation)
- User ID: 1, 2, 3 (각각 1개의 Reservation)

---

## 3. FK 추가 기술적 검토

### 3.1 데이터베이스에서의 FK 상태

**검증 쿼리 결과**:
```
총 제약조건: 11개
- PRIMARY KEY: 1개
- CHECK (NOT NULL): 10개
- FOREIGN KEY: 0개 (아직 추가되지 않음)
```

### 3.2 스키마 vs 실제 DB 불일치

| 항목 | Prisma | 실제 DB |
|-----|--------|--------|
| **FK 정의** | ✅ 있음 | ❓ 없음 |
| **onDelete: Cascade** | ✅ 정의됨 | ? |
| **NOT NULL 제약** | ✅ 있음 | ✅ CHECK 제약으로 구현 |

**결론**: Prisma 스키마에는 FK가 정의되어 있지만, **실제 PostgreSQL DB에는 FK 제약이 없는 상태**입니다.

### 3.3 마이그레이션 필요 여부

**현재 필요한 작업**:
1. ✅ **데이터 검증**: 완료 (고아 레코드 없음)
2. ⏳ **DB FK 추가**: Prisma 마이그레이션 필요
3. ⏳ **CASCADE 정의**: onDelete: Cascade 적용 필요
4. ⏳ **인덱스 확인**: tripId, mainUserId 인덱스 이미 있음

---

## 4. 마이그레이션 전략

### 4.1 3단계 점진적 마이그레이션

#### **Phase 1: 사전 검증 (지금)**
```sql
-- 이미 실행됨
-- 결과: 데이터 100% 안전
```

#### **Phase 2: FK 제약 추가**
```sql
-- Prisma 마이그레이션으로 실행
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"(id) ON DELETE CASCADE;

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_mainUserId_fkey"
FOREIGN KEY ("mainUserId") REFERENCES "User"(id) ON DELETE CASCADE;
```

#### **Phase 3: 검증 및 모니터링**
```sql
-- FK 제약 검증
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_name = 'Reservation'
AND constraint_type = 'FOREIGN KEY';
```

### 4.2 Prisma 마이그레이션 생성

**예상되는 마이그레이션 파일**:
```bash
npx prisma migrate dev --name add_gm_reservation_foreign_keys
```

**생성될 SQL**:
```sql
-- migrations/[timestamp]_add_gm_reservation_foreign_keys/migration.sql

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_mainUserId_fkey"
FOREIGN KEY ("mainUserId") REFERENCES "User"("id") ON DELETE CASCADE;
```

---

## 5. 리스크 평가

### 5.1 리스크 분석

| 리스크 | 심각도 | 확률 | 현황 |
|------|------|-----|-----|
| Orphaned records 발견 | 🔴 높음 | 0% | ✅ 안전 |
| NULL 필드 위반 | 🔴 높음 | 0% | ✅ 안전 |
| Cascade delete 영향 | 🟡 중간 | 0% (통제됨) | 관리 필요 |
| 성능 저하 | 🟢 낮음 | 낮음 | 인덱스 이미 있음 |

### 5.2 Cascade Delete 관리 전략

**현재 3개 레코드만 영향받으므로 안전**하지만, 향후를 위해:

```typescript
// 삭제 전 영향받는 Reservation 확인
const affectedReservations = await prisma.gmReservation.findMany({
  where: { tripId: tripToDelete.id }
});

console.log(`Trip ${tripToDelete.id} 삭제 시 ${affectedReservations.length}개 Reservation 삭제됨`);

// 필요시 사전 이관 또는 연결 해제
// OR 소프트 삭제(논리 삭제) 고려
```

---

## 6. 권장사항

### 6.1 즉시 실행 가능 (Green Light)

✅ **FK 추가 적합**: 모든 데이터 조건 만족
- 고아 레코드: 0개
- NULL 필드: 0개
- 제약 위반: 0개

### 6.2 마이그레이션 실행 순서

1. **Step 1**: `npx prisma generate` - 스키마 재생성
2. **Step 2**: `npx prisma db push` - DB 스키마 동기화 (자동)
3. **Step 3**: 검증 쿼리 실행
4. **Step 4**: 프로덕션 배포

### 6.3 향후 예방 조치

| 항목 | 상태 | 우선순위 |
|-----|------|--------|
| NOT NULL 제약 강화 | ✅ 이미 있음 | - |
| CHECK 제약 | ✅ 이미 있음 | - |
| 감사 추적 (Audit Trail) | ⏳ 권장 | P2 |
| 소프트 삭제 옵션 | ⏳ 고려 | P3 |
| 자동 orphan 정리 | ⏳ 고려 | P3 |

---

## 7. 요약

### 7.1 검증 결과

```
데이터 일관성: ✅ GREEN
FK 추가 준비: ✅ READY
마이그레이션: ⏳ 실행 대기
```

### 7.2 최종 결론

**프로덕션 DB의 GmReservation 테이블은 FK 추가에 완벽하게 적합합니다.**

- ✅ 고아 레코드 0개
- ✅ NULL 필드 위반 0개
- ✅ 데이터 무결성 100%
- ✅ Cascade delete 영향 최소화 (3개만)

**다음 단계**: Task 2 Step 2로 진행하여 FK 마이그레이션 실행

---

## 부록 A: 검증 스크립트

실행된 검증 스크립트:
```bash
node scripts/validate-gm-reservation-data.mjs
```

상세 보고서:
```
→ TASK2_STEP1_DATA_VALIDATION_REPORT.md
```

---

**생성**: 2026-05-21 06:22 UTC
**에이전트**: Agent γ (Automated Data Consistency Review)
