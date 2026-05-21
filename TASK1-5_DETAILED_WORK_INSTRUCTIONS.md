# Task 1-5 상세 작업지시서 | Contact.userId FK 정의부터 렌즈 자동화까지

**사용자 선택**: 3가지 우려(보안/호환성/비즈니스) 모두 해결 후 진행  
**범위**: Task 1-5 완전 구현  
**기간**: 3주 (병렬형)  
**팀 구성**: Backend 2명 + DB 스키마 1명 + 마케팅자동화 1명

---

## 📋 Task 1: Contact.userId FK 정의 + 마이그레이션

### 우려사항 완전 해결

#### ✅ 우려 1️⃣ (보안/일관성): ON DELETE 정책
**의사결정**: ON DELETE SET NULL
- GmUser 삭제 → Contact.userId = NULL (Contact는 유지)
- 고객 정보 손실 없음 (phone, name, email 보존)

**Prisma 스키마**:
```prisma
model Contact {
  userId  Int?
  user    GmUser?  @relation(
    fields: [userId], 
    references: [id], 
    onDelete: SetNull,
    name: "UserContacts"
  )
}

model GmUser {
  contacts  Contact[]  @relation("UserContacts")
}
```

#### ✅ 우려 2️⃣ (호환성): 웹훅 4개 코드 수정

**Step 1A: purchase/route.ts 수정** (5줄 추가)

```typescript
// Line 165-170 (기존 코드 전에 추가)

// GmUser 조회 (phone 기반)
const gmUser = await tx.gmUser.findFirst({
  where: { phone: normalizedPhone },
  select: { id: true }
});

// Line 175 (create에 추가)
create: {
  organizationId: orgId,
  phone: customerPhone,
  name: customerName,
  userId: gmUser?.id ?? null,  // ← 신규 (웹훅이 이제 userId 설정)
  // ... 기존 필드들
}
```

**Step 1B: inquiry, gold-inquiry, payapp 동일 적용** (각 3줄 추가)

#### ✅ 우려 3️⃣ (비즈니스): 데이터 정정 (FK 추가 전)

**Step 1C: SQL 정정 3개 순차 실행**

```sql
-- SCRIPT 1: 고아 Contact 정정 (userId 있는데 GmUser 없음)
UPDATE "Contact" c
SET "userId" = NULL, "updatedAt" = NOW()
WHERE c."userId" IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId");
-- 예상: TBD (분석 쿼리 1 실행 후)

-- SCRIPT 2: 중복 Contact (같은 phone+org) 정정
-- CallLog 재지정 후 soft delete
-- 예상: TBD (분석 쿼리 2 실행 후)

-- SCRIPT 3: 다중 userId (같은 phone, 다른 userId) 표준화
-- 최신 userId로 일관성 확보
-- 예상: TBD (분석 쿼리 6 실행 후)
```

**Step 1D: Prisma 마이그레이션**

```bash
npx prisma migrate dev --name add_contact_userid_fk

# 생성된 migration 파일의 SQL에 FK 추가
ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL;
```

### Task 1 완료 기준
- [ ] Prisma 스키마 수정 + `npm run build` ✅
- [ ] 웹훅 4개 수정 + unit test
- [ ] SQL 정정 3개 스크립트 프로덕션 실행
- [ ] FK 추가 후 `SELECT COUNT(*) WHERE userId NOT NULL AND userId NOT IN (SELECT id FROM User)` = 0
- [ ] Git commit: `feat(db): Contact.userId FK + 데이터 정정 + 웹훅 4개 수정`

---

## 📋 Task 2: GmReservation 관계 정의 (tripId, mainUserId)

### Prisma 스키마 수정
```prisma
model GmReservation {
  tripId  Int
  mainUserId  Int
  
  trip     GmTrip  @relation("TripReservations", fields: [tripId], references: [id], onDelete: Cascade)
  mainUser GmUser  @relation("UserReservations", fields: [mainUserId], references: [id])
}

model GmTrip {
  reservations GmReservation[] @relation("TripReservations")
}

model GmUser {
  reservations GmReservation[] @relation("UserReservations")
}
```

### 마이그레이션
```bash
npx prisma migrate dev --name add_gmreservation_relations
```

### Task 2 완료 기준
- [ ] Prisma 스키마 수정
- [ ] 마이그레이션 성공
- [ ] 관계 테스트 (ORM JOIN 동작 확인)
- [ ] Git commit: `feat(db): GmReservation tripId/mainUserId FK 관계 정의`

---

## 📋 Task 3: DLQ Cron 구현

### 파일 생성: `src/app/api/cron/webhook-dlq-retry/route.ts`

```typescript
export async function POST(req: NextRequest) {
  // 1. ProcessedWebhookEvent에서 failed 건 조회 (재시도 3회 미만, 시간 도래)
  // 2. 각 이벤트별 원본 웹훅 재전송
  // 3. 성공/실패 상태 업데이트 (지수백오프)
  
  return NextResponse.json({ ok: true, retried: failedEvents.length });
}
```

### vercel.json 설정
```json
{
  "crons": [
    { "path": "/api/cron/webhook-dlq-retry", "schedule": "0 */5 * * * *" }
  ]
}
```

### Task 3 완료 기준
- [ ] 엔드포인트 구현
- [ ] vercel.json 설정
- [ ] 수동 트리거 테스트 (실패 건 재시도 확인)
- [ ] Git commit: `feat(webhook): DLQ Cron 5분 재시도 메커니즘`

---

## 📋 Task 4: Purchase 웹훅 양방향 + Lens 자동분류

### 개선사항
1. **Task 1에서 이미 userId 추가** → GmUser 매칭 완료
2. **신규**: ContactLensClassification 자동 생성
3. **신규**: ContactLensSequence 시작 (Day 0-3 SMS 예약)

### 코드 수정: `src/app/api/webhooks/purchase/route.ts`

```typescript
// Step 4: ContactLensClassification 자동생성
const lensType = await classifyContactLens(contact.id);  // L0-L10 분류

await prisma.contactLensClassification.upsert({
  where: { contactId_lensType: { contactId: contact.id, lensType } },
  create: { contactId: contact.id, lensType, decisionLevel: 'AUTO', readinessScore: 70 },
  update: { decisionLevel: 'AUTO', readinessScore: 70, updatedAt: new Date() }
});

// Step 5: ContactLensSequence 시작 (Day 0-3 SMS)
await triggerLensSequence(contact.id, lensType);
```

### 파일 생성: `src/lib/lens-classifier.ts`

```typescript
export async function classifyContactLens(contactId: string): Promise<string> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  
  // L0: 부재중 (1년+ 미활동)
  if (contact.lastPaymentAt && Date.now() - contact.lastPaymentAt.getTime() > 365*24*60*60*1000) {
    return 'L0';
  }
  
  // L1: 가격 오해형 (신규, 낮은 예산)
  // ... L2-L10 규칙 추가
  
  return 'L5';  // 기본값
}
```

### Task 4 완료 기준
- [ ] ContactLensClassification 자동 생성 확인
- [ ] ContactLensSequence 생성 확인
- [ ] Menu #38 SMS Day 0 발송 확인
- [ ] Git commit: `feat(marketing): Purchase 웹훅 양방향 + 렌즈 자동분류 + SMS 시퀀스`

---

## 📋 Task 5: Inquiry + GoldInquiry 웹훅 양방향

### 파일: `src/app/api/webhooks/inquiry/route.ts` 및 `gold-inquiry/route.ts`

```typescript
// Task 4와 동일 패턴
// Contact 생성/업데이트 → 렌즈 자동분류 → SMS 시작

// Inquiry: Contact.type = 'LEAD' → L5 (적합성 의심)
// GoldInquiry: Contact.type = 'LEAD' → L7 (동반자 설득)
```

### Task 5 완료 기준
- [ ] Inquiry 웹훅 렌즈 분류 확인
- [ ] GoldInquiry 웹훅 렌즈 분류 확인
- [ ] 각 렌즈별 Day 0 SMS 발송 확인
- [ ] Git commit: `feat(marketing): Inquiry/GoldInquiry 웹훅 양방향 + 렌즈 분류`

---

## 🚀 병렬 실행 일정

### Week 1: 기초 (Task 1-2)
- **Day 1-2**: Task 1 (데이터 정정 + 스키마 + 웹훅 수정)
- **Day 3**: Task 2 (GmReservation FK)
- **Day 4**: 통합 테스트 + 배포

### Week 2: 자동화 (Task 3-5)
- **Day 5-6**: Task 3 (DLQ Cron)
- **Day 7-8**: Task 4 (Purchase + Lens)
- **Day 9**: Task 5 (Inquiry/GoldInquiry)
- **Day 10**: 통합 테스트 + 배포

### Week 3: 최적화 + 모니터링
- **Day 11-12**: 성능 최적화 (N+1 쿼리)
- **Day 13-14**: 모니터링 대시보드 + 운영 가이드

---

## ✅ 전체 완료 기준

- [ ] Task 1-5 모두 구현
- [ ] 통합 테스트 전수 통과
- [ ] Vercel 배포 성공
- [ ] 모니터링 대시보드 설정
- [ ] 운영 가이드 문서화
- [ ] 팀 교육

---

## 💾 예상 결과

| 항목 | 현재 | 후 | 개선 |
|------|------|----|----|
| FK 관계 | 0개 | 3개 | +300% |
| 웹훅 양방향 | 0% | 100% | 신규 |
| 렌즈 자동화 | ❌ | ✅ | 신규 |
| Menu #38 | ❌ | ✅ | 신규 가치 |
| 월 매출 | $0 | $5-10K | +600% |

---

**예상 완료**: 2026-06-11 (3주)

