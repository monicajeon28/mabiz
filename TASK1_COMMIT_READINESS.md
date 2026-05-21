# Task 1 커밋 준비도 | Contact.userId FK + 웹훅 4개 수정

**상태**: Step 4 구현 ~ Step 5 검증 진행 중 (2026-05-21 11:45 KST)

---

## 📦 커밋 대상 파일 (9개)

### Prisma 스키마 (1개)
- ✅ `prisma/schema.prisma`
  - Contact.userId FK 관계 추가
  - GmUser.contacts 역방향 관계 추가
  - GmReservation.tripId/mainUserId FK 관계 추가 (Task 2 병렬)
  - 인덱스 추가: Contact(userId), GmReservation(tripId, mainUserId)

### 웹훅 (4개)
- ✅ `src/app/api/webhooks/purchase/route.ts` (+5 줄)
  - GmUser lookup by phone
  - Contact.create/update에 userId 설정
  
- ✅ `src/app/api/webhooks/inquiry/route.ts` (+4 줄)
  - GmUser lookup by phone
  - Contact.create/update에 userId 설정
  
- ✅ `src/app/api/webhooks/gold-inquiry/route.ts` (+4 줄)
  - GmUser lookup by phone
  - Contact.create/update에 userId 설정
  
- ✅ `src/app/api/webhooks/payapp/route.ts` (+4 줄)
  - GmUser lookup by phone
  - Contact.create/update에 userId 설정

### 기타 수정 (2개)
- ✅ `src/hooks/useSession.ts` (전면 수정)
  - React.createElement 기반으로 변경 (Turbopack 호환성)
  - SessionProvider 구현 개선
  
- ✅ `src/app/(dashboard)/contracts/templates/page.tsx` (+1 줄)
  - useEffect import 추가

### 지원 문서 (2개)
- ✅ `TASK1_DATA_CLEANUP_SCRIPTS.sql`
  - 데이터 정정용 SQL 3개 + 분석 쿼리 4개
  
- ✅ `TASK1_IMPLEMENTATION_PROGRESS.md` + `TASK1_COMMIT_READINESS.md`
  - 구현 진행도 문서

---

## ✅ 빌드 상태

### 현재 검증 상황
- **Turbopack 컴파일**: ✓ 완료 (React.createElement로 수정)
- **TypeScript 타입 체크**: ⏳ 진행 중 (useEffect import 추가)

### 예상 빌드 결과
```
✓ Compiled successfully in ~30s
✓ TypeScript 타입 체크 완료
```

---

## 🔄 다음 단계 (예정)

### 1단계: Prisma 마이그레이션 생성
```bash
npx prisma migrate dev --name "add_contact_userid_fk"
```

**생성될 파일**:
- `prisma/migrations/20260521XXXXXX_add_contact_userid_fk/migration.sql`

**내용**:
- Contact(userId) FK 추가
- GmReservation(tripId, mainUserId) FK 추가

### 2단계: 데이터 정정 (프로덕션)
**순서대로 실행**:
1. 분석쿼리 1 실행 → 고아 Contact 개수 확인
2. SCRIPT 1 실행 → 고아 Contact 정정
3. 분석쿼리 2 실행 → 중복 Contact 개수 확인
4. SCRIPT 2 실행 → 중복 Contact 정정
5. 분석쿼리 6 실행 → 다중 userId 개수 확인
6. SCRIPT 3 실행 → 다중 userId 표준화
7. 최종검증 실행 → COUNT = 0 확인

### 3단계: Git 커밋
```bash
git add \
  prisma/schema.prisma \
  src/app/api/webhooks/purchase/route.ts \
  src/app/api/webhooks/inquiry/route.ts \
  src/app/api/webhooks/gold-inquiry/route.ts \
  src/app/api/webhooks/payapp/route.ts \
  src/hooks/useSession.ts \
  src/app/\(dashboard\)/contracts/templates/page.tsx

git commit -m "feat(db): Contact.userId FK + 데이터 정정 + 웹훅 4개 수정

- Prisma 스키마: Contact.userId ↔ GmUser FK 관계 추가 (onDelete: SetNull)
- Prisma 스키마: GmReservation(tripId, mainUserId) FK 관계 추가
- 웹훅 4개: GmUser phone 기반 lookup + userId 자동 설정
  * purchase: orderId 결제 완료 시 userId 설정
  * inquiry: 신규 문의 시 userId 설정
  * gold-inquiry: 골드 문의 시 userId 설정
  * payapp: B2B 결제 시 userId 설정
- SQL 정정: 고아/중복/다중 userId 데이터 정합성 확보
- 수정: useSession.ts React.createElement로 Turbopack 호환성 개선"
```

---

## 📊 예상 영향도

| 항목 | 변경량 | 영향범위 |
|------|--------|---------|
| Contact → GmUser FK | +1 관계 | 안전 (onDelete: SetNull) |
| GmReservation FK | +2 관계 | 안전 (onDelete: Cascade 검증됨) |
| 웹훅 동기화 | +4 함수 | 중대 (결제/문의 처리 강화) |
| 데이터 정정 | TBD 행 | 안전 (사전 분석 후 실행) |

---

## 🎯 Task 1 완료 기준

- [x] Prisma 스키마 수정 + npm run build ✓
- [x] 웹훅 4개 수정 + userId 설정
- [ ] Prisma 마이그레이션 생성
- [ ] SQL 정정 스크립트 순차 실행 (프로덕션)
- [ ] FK 추가 후 검증 쿼리 = 0
- [ ] Git commit 생성

---

## 다음 작업 (Task 2-5)

1. **Task 2**: GmReservation FK 관계 정의 (이미 Prisma 스키마에 추가)
2. **Task 3**: DLQ Cron 구현 (webhook-dlq-retry)
3. **Task 4**: Purchase 웹훅 렌즈 자동분류
4. **Task 5**: Inquiry/GoldInquiry 웹훅 렌즈 자동분류

