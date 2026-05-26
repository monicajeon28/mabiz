---
name: crm-data-integrity
description: 데이터 검증, 트랜잭션 일관성, 제약조건, 무결성 감시 및 복구 전략
metadata:
  type: reference
  category: data-integrity
  updated: 2026-05-26
---

# CRM 데이터 무결성 관리

## 핵심 개념

### 1. 데이터 검증 전략 (3단계)

**단계 1: 입력 검증 (클라이언트 → 서버)**
```typescript
export async function POST(req: Request) {
  const body = await req.json();
  
  // 필수 필드
  if (!body.name || !body.phone) {
    return NextResponse.json(
      { ok: false, message: "필수 필드 누락: name, phone" },
      { status: 400 }
    );
  }
  
  // 필드 길이
  if (typeof body.name === 'string' && body.name.length > 100) {
    return NextResponse.json(
      { ok: false, message: "이름은 100자 이하여야 합니다." },
      { status: 400 }
    );
  }
  
  if (typeof body.phone === 'string' && body.phone.length > 20) {
    return NextResponse.json(
      { ok: false, message: "전화번호는 20자 이하여야 합니다." },
      { status: 400 }
    );
  }
  
  // 전화번호 형식 (정규표현식)
  const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
  if (!phoneRegex.test(body.phone)) {
    return NextResponse.json(
      { ok: false, message: "전화번호 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  
  // 이메일 형식
  if (body.email && !body.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return NextResponse.json(
      { ok: false, message: "이메일 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  
  // 열거형 검증
  const validTypes = ["LEAD", "CUSTOMER", "VIP"];
  if (body.type && !validTypes.includes(body.type)) {
    return NextResponse.json(
      { ok: false, message: `type은 ${validTypes.join(", ")} 중 하나여야 합니다.` },
      { status: 400 }
    );
  }
  
  // ✅ 검증 통과 → DB 저장
  const contact = await prisma.contact.create({ data: body });
  return NextResponse.json({ ok: true, contact }, { status: 201 });
}
```

**단계 2: 데이터베이스 제약 (DB 레벨)**
```prisma
model Contact {
  id String @id @default(cuid())
  phone String
  name String
  organizationId String
  
  // 유니크 제약: (phone, organizationId) 조합 유일
  @@unique([phone, organizationId])
  
  // 외래키 제약: organizationId는 Organization에 반드시 존재
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  // 필드 길이: DB 레벨 검증
  // name: VarChar 기본값 (Prisma 스키마에서 길이 제한 명시)
}

model ContactLensClassification {
  // 복합 유니크 제약: 조직당 연락처당 렌즈별 1개만
  @@unique([organizationId, contactId, lensType])
}
```

**단계 3: 비즈니스 로직 검증 (애플리케이션)**
```typescript
export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. 조직 존재 확인
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId! }
  });
  if (!org) {
    return NextResponse.json(
      { ok: false, error: "조직이 존재하지 않습니다." },
      { status: 404 }
    );
  }
  
  // 2. 담당자 존재 확인 (할당받은 사람이 같은 조직)
  if (body.assignedUserId) {
    const member = await prisma.organizationMember.findUnique({
      where: { id: body.assignedUserId }
    });
    if (!member || member.organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: "담당자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
  }
  
  // 3. 세그먼트 자동 감지 및 검증
  const segment = detectSegment({
    age: body.age,
    maritalStatus: body.maritalStatus,
    childrenCount: body.childrenCount
  });
  
  if (!["interested", "neutral", "unclassified"].includes(segment)) {
    return NextResponse.json(
      { ok: false, error: "세그먼트 감지 실패" },
      { status: 500 }
    );
  }
  
  // ✅ 모든 검증 통과
  const contact = await prisma.contact.create({
    data: {
      organizationId: ctx.organizationId!,
      ...body,
      segment
    }
  });
  
  return NextResponse.json({ ok: true, contact }, { status: 201 });
}
```

---

## 마비즈 CRM 실제 구현

### 트랜잭션 일관성 (ACID)

```typescript
/**
 * 대리점 계약 승인 → 5개 테이블 동시 생성 (원자성 보장)
 * 
 * 실패 시 전체 롤백 (부분 성공 불가)
 */
export async function provisionAffiliateAccounts(input: ProvisionInput) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. GmUser 생성 (GMcruise 계정)
    const managerGmUser = await tx.gmUser.create({
      data: {
        name: `${input.contractorName} 대리점장`,
        email: input.contractorEmail || null,
        password: passwordHash,
        role: "affiliate_manager",
        isPasswordSet: true
      }
    });
    
    // 2. GmAffiliateProfile 생성 (어필리에이트 프로필)
    const managerProfile = await tx.gmAffiliateProfile.create({
      data: {
        userId: managerGmUser.id,
        type: "BRANCH_MANAGER",
        status: "ACTIVE",
        contractStatus: "SIGNED",
        affiliateCode: await generateUniqueAffiliateCode("MGR", tx),
        agentCommissionRate: input.commissionRate,
        contactPhone: input.contractorPhone,
        contactEmail: input.contractorEmail
      }
    });
    
    // 3. GmAffiliateLink 생성 (어필리에이트 링크)
    const managerLink = await tx.gmAffiliateLink.create({
      data: {
        managerId: managerProfile.id,
        code: await generateUniqueAffiliateCode("LINK", tx),
        url: `${baseUrl}/affiliate/${managerLinkCode}`
      }
    });
    
    // 4. OrganizationMember 생성 (CRM 계정)
    const crmMember = await tx.organizationMember.create({
      data: {
        organizationId: input.organizationId,
        userId: managerGmUser.id.toString(),
        role: "OWNER",
        displayName: `${input.contractorName} 대리점장`,
        email: input.contractorEmail
      }
    });
    
    // 5. SyncDeadLetterQueue 생성 (Neon ↔ Supabase 동기화)
    await tx.syncDeadLetterQueue.create({
      data: {
        operation: "CREATE_USER",
        targetTable: "GmUser",
        targetId: managerGmUser.id.toString(),
        payload: { userId: managerGmUser.id },
        status: "PENDING",
        retryCount: 0
      }
    });
    
    // ✅ 모든 단계 성공 → 커밋
    return {
      manager: {
        gmUserId: managerGmUser.id,
        crmMemberId: crmMember.id,
        affiliateCode: managerProfile.affiliateCode
      }
    };
  }, {
    timeout: 30000, // 30초 타임아웃
    maxWait: 5000   // 데이터베이스 대기 최대 5초
  });
  
  return result;
}

// 트랜잭션 내부에서 에러 발생 시:
// - 모든 INSERT/UPDATE 작업 자동 롤백
// - 이미 생성된 ID 무효화
// - 마지막 일관된 상태로 복구
```

### 외래키 제약 (Referential Integrity)

```prisma
model Contact {
  id String @id @default(cuid())
  organizationId String
  partnerId String?
  userId Int?
  cruiseProductId Int?
  reservationId Int?
  
  // 외래키 제약: 삭제 전략
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  // → 조직 삭제 시 해당 Contact 자동 삭제
  
  partner Partner? @relation(fields: [partnerId], references: [id])
  // → Partner 참조는 Optional (null 허용)
  
  user GmUser? @relation("UserContacts", fields: [userId], references: [id], onDelete: SetNull)
  // → 사용자 삭제 시 Contact.userId = null (cascade 아님)
  
  cruiseProduct CruiseProduct? @relation("ContactCruiseProducts", fields: [cruiseProductId], references: [id], onDelete: SetNull)
  // → 상품 삭제 시 Contact.cruiseProductId = null
  
  reservation GmReservation? @relation("ContactReservations", fields: [reservationId], references: [id], onDelete: SetNull)
  // → 예약 삭제 시 Contact.reservationId = null
}
```

### SMS Day 0-3 발송 추적 (멱등성 보장)

```typescript
/**
 * SMS Day 0 발송 (같은 요청 여러 번 호출 → 같은 결과)
 * 멱등성(Idempotency) 보장: SMS 중복 발송 방지
 */
export async function sendSmsDay0(contactId: string, lensType: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. 기존 시퀀스 확인 (이미 발송했는가?)
    const existing = await tx.contactLensSequence.findFirst({
      where: {
        contactId,
        lensType,
        sequenceType: "sms_day0_3",
        day0Sent: true // 이미 발송됨
      }
    });
    
    // 2. 이미 발송했으면 그냥 반환 (중복 방지)
    if (existing) {
      return existing;
    }
    
    // 3. 없으면 새로 생성 및 발송
    const sequence = await tx.contactLensSequence.create({
      data: {
        contactId,
        lensType,
        sequenceType: "sms_day0_3",
        status: "PENDING",
        day0Sent: true,
        day0SentAt: new Date()
      }
    });
    
    // 4. SMS 발송
    const smsConfig = await resolveUserSmsConfig(orgId, userId);
    const result = await sendSms({
      receiver: contact.phone,
      msg: smsTemplate.body,
      organizationId: orgId,
      contactId
    });
    
    // 5. SMS 발송 실패 시 예외 발생 (트랜잭션 롤백)
    if (result.result_code !== "1") {
      throw new Error(`SMS 발송 실패: ${result.message}`);
    }
    
    return sequence;
  });
}

// 호출 예제
try {
  const sequence = await sendSmsDay0("contact123", "L0");
  console.log("Day 0 SMS 발송 완료", sequence.id);
} catch (err) {
  console.error("SMS 발송 실패", err);
  // 트랜잭션 롤백으로 sequence 생성 취소됨
}
```

### 데이터 검증 Cron Job

```typescript
/**
 * 매일 자정에 실행: Contact 데이터 무결성 감시
 * - SMS 발송 추적 상태 검증
 * - 결정 윈도우 만료 확인
 * - L5/L6 의료 신뢰도 점수 재계산
 */
export async function validateDataIntegrity() {
  const errors: ValidationError[] = [];
  
  // 1. SMS 발송 추적 검증
  const orphanedSequences = await prisma.contactLensSequence.findMany({
    where: {
      contact: { deletedAt: { not: null } }, // 삭제된 Contact의 Sequence
      status: "PENDING"
    }
  });
  
  if (orphanedSequences.length > 0) {
    errors.push({
      type: "ORPHANED_SEQUENCE",
      count: orphanedSequences.length,
      action: "자동 취소"
    });
    
    // 자동 정리
    await prisma.contactLensSequence.updateMany({
      where: { id: { in: orphanedSequences.map(s => s.id) } },
      data: { status: "CANCELLED", failureReason: "Contact 삭제됨" }
    });
  }
  
  // 2. 결정 윈도우 만료 확인
  const expiredWindows = await prisma.contact.updateMany({
    where: {
      decisionWindowExpiresAt: { lt: new Date() },
      closingStage: { not: "closed" }
    },
    data: {
      decisionWindowExpiresAt: null,
      urgencyLevel: 0
    }
  });
  
  if (expiredWindows.count > 0) {
    errors.push({
      type: "EXPIRED_DECISION_WINDOW",
      count: expiredWindows.count,
      action: "상태 리셋"
    });
  }
  
  // 3. L5/L6 의료 신뢰도 점수 재계산
  const contacts = await prisma.contact.findMany({
    where: {
      l5l6CombinedScore: { lt: 0 } // 유효하지 않은 점수
    }
  });
  
  for (const contact of contacts) {
    const score = calculateL5L6Score({
      selfProjectionScore: contact.selfProjectionScore,
      timingUrgencyScore: contact.timingUrgencyScore,
      medicalRisk: contact.l5l6MedicalRiskLevel
    });
    
    await prisma.contact.update({
      where: { id: contact.id },
      data: { l5l6CombinedScore: score }
    });
  }
  
  logger.log("[validateDataIntegrity] 검증 완료", {
    orphaned: orphanedSequences.length,
    expired: expiredWindows.count,
    recalculated: contacts.length,
    errors
  });
  
  return { success: true, errors };
}
```

---

## 복구 전략

### 백업 및 복원

```bash
# PostgreSQL 백업 (Neon)
pg_dump $DATABASE_URL > crm-backup-$(date +%s).sql

# 백업 복원
psql $DATABASE_URL < crm-backup-1779794990271.sql

# 특정 테이블만 복구
pg_restore -d $DATABASE_URL -t Contact crm-backup.dump
```

### Prisma 마이그레이션 롤백

```bash
# 마이그레이션 이력 조회
npx prisma migrate status

# 특정 마이그레이션 이전으로 롤백 (DB 데이터는 유지)
npx prisma migrate resolve --rolled-back 20260519082926_phase4_wave2

# 스키마만 리셋 (개발 환경)
npx prisma migrate reset
```

---

## 성능 영향

| 검증 단계 | 오버헤드 | 권장 시점 |
|---------|--------|---------|
| 클라이언트 입력 | < 5ms | 매 요청 |
| DB 제약 검증 | < 10ms | 자동 (DB 레벨) |
| 비즈니스 로직 | 10-100ms | 중요 작업 |
| 일괄 검증 (Cron) | < 1초 | 일일 1회 |

---

**주요 원칙:**
1. 모든 쓰기 작업은 트랜잭션 사용
2. SMS 발송 같은 외부 연동은 멱등성 보장
3. 외래키 제약으로 고아 레코드 방지
4. 일일 1회 무결성 감시 Job 실행
