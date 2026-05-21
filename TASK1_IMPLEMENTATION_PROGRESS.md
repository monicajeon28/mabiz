# Task 1: Contact.userId FK 정의 + 마이그레이션 | 구현 진행도

**상태**: Step 4 구현 중 (2026-05-21)

---

## ✅ 완료된 작업

### 1️⃣ Prisma 스키마 수정 (Step 1A 완료)

**변경사항**:
- `Contact` 모델: `userId` 필드 → `user` FK 관계 추가
  ```prisma
  userId  Int?
  user    GmUser?  @relation("UserContacts", fields: [userId], references: [id], onDelete: SetNull)
  ```
- `GmUser` 모델: `contacts` 역방향 관계 추가
  ```prisma
  contacts  Contact[]  @relation("UserContacts")
  ```
- Contact 인덱스 추가: `@@index([userId])`

**파일**: `prisma/schema.prisma` (수정됨)

**검증 상태**: npm run build 테스트 중 (진행 중)

---

### 2️⃣ GmReservation FK 관계 정의 추가 (Task 2 병렬 구현)

**변경사항**:
- `GmReservation.tripId` → `GmTrip` FK (onDelete: Cascade)
- `GmReservation.mainUserId` → `GmUser` FK
- `GmTrip.reservations` 역방향 관계 추가
- `GmUser.reservations` 역방향 관계 추가

**파일**: `prisma/schema.prisma` (수정됨)

---

### 3️⃣ 웹훅 4개 코드 수정 (Step 1B 완료)

#### ✅ purchase/route.ts
- **줄 129-131**: GmUser 조회 추가
  ```typescript
  const gmUser = await prisma.gmUser.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true },
  });
  ```
- **줄 143**: Contact.create에 userId 추가
  ```typescript
  userId: gmUser?.id ?? null,
  ```

#### ✅ inquiry/route.ts
- **줄 75-81**: GmUser 조회 추가
- **줄 97**: Contact.update에 userId 조건부 추가
- **줄 107**: Contact.create에 userId 추가

#### ✅ gold-inquiry/route.ts
- **줄 82-88**: GmUser 조회 추가
- **줄 104**: Contact.update에 userId 조건부 추가
- **줄 117**: Contact.create에 userId 추가

#### ✅ payapp/route.ts
- **줄 122-126**: GmUser 조회 추가
- **줄 170**: Contact.create에 userId 추가
- **줄 171**: Contact.update에 userId 조건부 추가

**파일들**: 모두 수정 완료

---

### 4️⃣ SQL 데이터 정정 스크립트 작성 (Step 1C 준비 완료)

**파일**: `TASK1_DATA_CLEANUP_SCRIPTS.sql`

**내용**:
1. **분석 쿼리 1**: 고아 Contact 개수 확인
2. **SCRIPT 1**: 고아 Contact 정정 (userId → NULL)
3. **분석 쿼리 2**: 중복 Contact 개수 확인
4. **SCRIPT 2**: 중복 Contact soft delete + CallLog 재지정
5. **분석 쿼리 6**: 다중 userId 개수 확인
6. **SCRIPT 3**: 다중 userId 표준화
7. **최종 검증**: FK 추가 전 데이터 정합성 확인

---

## ⏳ 진행 중인 작업

### Build 검증
- **현황**: React.createElement로 useSession.ts 수정 후 빌드 테스트 진행 중
- **목표**: npm run build ✓ (TypeScript 에러 0개)

---

## 📋 다음 단계 (예정)

### Step 1D: Prisma 마이그레이션
```bash
npx prisma migrate dev --name "add_contact_userid_fk"
```

**마이그레이션 내용**:
```sql
-- Contact.userId FK 추가
ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL;

-- GmReservation FK 추가 (2개)
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
ON DELETE CASCADE;

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_mainUserId_fkey"
FOREIGN KEY ("mainUserId") REFERENCES "User"("id");
```

### 데이터 정정 실행 (프로덕션)
1. 분석 쿼리 1 실행 → 개수 확인
2. SCRIPT 1 실행
3. 분석 쿼리 2 실행 → 개수 확인
4. SCRIPT 2 실행
5. 분석 쿼리 6 실행 → 개수 확인
6. SCRIPT 3 실행
7. 최종 검증 쿼리 실행 (반드시 0이어야 함)

### Git 커밋
```bash
git add prisma/schema.prisma \
  src/app/api/webhooks/purchase/route.ts \
  src/app/api/webhooks/inquiry/route.ts \
  src/app/api/webhooks/gold-inquiry/route.ts \
  src/app/api/webhooks/payapp/route.ts \
  TASK1_DATA_CLEANUP_SCRIPTS.sql \
  src/hooks/useSession.ts

git commit -m "feat(db): Contact.userId FK + 데이터 정정 + 웹훅 4개 수정"
```

---

## Task 1 완료 기준

- [ ] npm run build ✓
- [x] Prisma 스키마 수정
- [x] 웹훅 4개 수정 + userId 설정
- [ ] Prisma 마이그레이션 생성 + 적용
- [ ] SQL 정정 스크립트 순차 실행 (프로덕션)
- [ ] FK 추가 후 검증 쿼리 = 0
- [ ] Git commit 생성

---

## 예상 영향도

| 항목 | 예상값 |
|------|--------|
| 정정될 고아 Contact | TBD (분석 쿼리 1 후) |
| 정정될 중복 Contact | TBD (분석 쿼리 2 후) |
| 정정될 다중 userId | TBD (분석 쿼리 6 후) |
| Contact → GmUser FK 추가 | ✓ (onDelete: SetNull) |
| GmReservation FK 추가 | ✓ (2개 관계) |
| 웹훅 양방향 동기화 | ✓ (4개 모두) |

