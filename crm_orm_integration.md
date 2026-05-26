---
name: crm-orm-integration
description: Prisma ORM 통합 가이드, 쿼리 패턴, 최적화 기법, 트랜잭션 관리
metadata:
  type: reference
  category: orm
  updated: 2026-05-26
---

# Prisma ORM 통합 및 쿼리 최적화

## 핵심 개념

### 1. Prisma 클라이언트 초기화

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  
  const adapter = new PrismaPg({
    connectionString,
    // Neon Pooler: 자동 Connection Pooling
    // max_pool_size: 기본 10-50 (환경변수로 조정 가능)
  });
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" 
      ? ["error", "warn"] 
      : ["error"] // 프로덕션: 에러만
  });
}

// 싱글톤 패턴 (재사용)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export default globalForPrisma.prisma;
```

### 2. Prisma 쿼리 기본 패턴

```typescript
import prisma from "@/lib/prisma";

// ─ CREATE (생성)
const contact = await prisma.contact.create({
  data: {
    organizationId: "org123",
    phone: "010-1234-5678",
    name: "김철수",
    email: "kim@example.com",
    type: "LEAD"
  }
});

// ─ READ (조회)
const contact = await prisma.contact.findUnique({
  where: { id: "contact123" }
});

// ─ UPDATE (수정)
const updated = await prisma.contact.update({
  where: { id: "contact123" },
  data: { leadScore: 85 }
});

// ─ DELETE (삭제)
await prisma.contact.delete({
  where: { id: "contact123" }
});

// ─ UPSERT (있으면 수정, 없으면 생성)
const result = await prisma.contact.upsert({
  where: { id: "contact123" },
  update: { leadScore: 90 },
  create: { organizationId: "org123", phone: "010-1234-5678", name: "김철수" }
});
```

### 3. 고급 쿼리 기법

**Relation Load (관계 데이터 포함):**
```typescript
// include: 관계 테이블 모두 로드
const contact = await prisma.contact.findUnique({
  where: { id: "contact123" },
  include: {
    groups: true,           // ContactGroupMember[]
    callLogs: {             // CallLog[]
      where: { createdAt: { gte: new Date("2026-05-01") } },
      orderBy: { createdAt: "desc" },
      take: 10
    },
    lensClassifications: {  // ContactLensClassification[]
      where: { status: "ACTIVE" }
    }
  }
});

// select: 특정 필드만 로드 (성능 최적화)
const contact = await prisma.contact.findUnique({
  where: { id: "contact123" },
  select: {
    id: true,
    name: true,
    phone: true,
    email: true,
    leadScore: true,
    groups: { select: { groupId: true } },
    _count: { select: { callLogs: true } }
  }
});
```

**집계 (Aggregation):**
```typescript
// COUNT: 레코드 수
const count = await prisma.contact.count({
  where: { organizationId: "org123", type: "LEAD" }
});

// GROUP BY: 그룹화
const grouped = await prisma.contact.groupBy({
  by: ["autoSegment", "type"],
  where: { organizationId: "org123" },
  _count: true,
  _avg: { leadScore: true },
  _max: { leadScore: true }
});
// 출력: [
//   { autoSegment: "interested", type: "LEAD", _count: 45, _avg: { leadScore: 72 }, _max: { leadScore: 95 } },
//   { autoSegment: "unclassified", type: "LEAD", _count: 120, _avg: { leadScore: 40 }, _max: { leadScore: 75 } }
// ]
```

---

## 마비즈 CRM 실제 구현

### 트랜잭션 관리 (Atomic Operations)

**대리점 계약 승인 (단일 트랜잭션)**
```typescript
// src/lib/affiliate/provision.ts
export async function provisionAffiliateAccounts(input: ProvisionInput) {
  // 전체 파이프라인을 단일 트랜잭션으로 처리
  // 중간에 실패하면 모든 변경사항 자동 롤백
  
  const result = await prisma.$transaction(async (tx) => {
    // ─ 1단계: GmUser 생성
    const managerGmUser = await tx.gmUser.create({
      data: {
        name: `${input.contractorName} 대리점장`,
        email: input.contractorEmail || null,
        phone: agentPartnerId,
        password: passwordHash,
        role: "affiliate_manager"
      }
    });
    
    // ─ 2단계: GmAffiliateProfile 생성
    const managerProfile = await tx.gmAffiliateProfile.create({
      data: {
        userId: managerGmUser.id,
        type: "BRANCH_MANAGER",
        status: "ACTIVE",
        contractStatus: "SIGNED",
        affiliateCode: await generateUniqueAffiliateCode("MGR", tx)
      }
    });
    
    // ─ 3단계: GmAffiliateLink 생성
    const managerLink = await tx.gmAffiliateLink.create({
      data: {
        managerId: managerProfile.id,
        code: managerLinkCode,
        url: `${baseUrl}/affiliate/${managerLinkCode}`
      }
    });
    
    // ─ 4단계: OrganizationMember 생성 (CRM 로그인)
    const crmMember = await tx.organizationMember.create({
      data: {
        organizationId: input.organizationId,
        userId: managerGmUser.id.toString(),
        role: "OWNER",
        displayName: `${input.contractorName} 대리점장`,
        email: input.contractorEmail
      }
    });
    
    // 모든 단계 성공 시 반환
    return {
      manager: {
        gmUserId: managerGmUser.id,
        crmMemberId: crmMember.id,
        affiliateCode: managerProfile.affiliateCode
      },
      agent: { gmUserId: agentGmUser.id }
    };
  });
  
  // 중간에 에러 발생하면 위의 모든 create 작업 자동 롤백됨
  return result;
}
```

**키 포인트:**
- `prisma.$transaction(async (tx) => { ... })`로 감싼다
- 내부에서 `tx.modelName.operation()` 사용
- 하나라도 실패하면 **모든 변경사항 자동 롤백**

### 배치 작업 (Bulk Operations)

**대량 업데이트:**
```typescript
// SMS Day 0 발송 마크
const day0Updates = await prisma.contact.updateMany({
  where: {
    organizationId: "org123",
    smsDay0Sent: false,
    reactivationSegment: { in: ["3-6m", "6-12m"] },
    lastCruiseDate: { gte: sixMonthsAgo }
  },
  data: {
    smsDay0Sent: true,
    smsDay0SentAt: new Date()
  }
});

console.log(`${day0Updates.count} 명의 고객 SMS 발송 완료`);
```

**대량 생성 (createMany):**
```typescript
// CSV 대량 수입
const bulkContacts = await prisma.contact.createMany({
  data: rows.map((row) => ({
    organizationId: ctx.organizationId!,
    phone: row.phone,
    name: row.name,
    email: row.email ?? null,
    type: "LEAD"
  })),
  skipDuplicates: true // 중복 스킵 (P2002 에러 방지)
});

console.log(`${bulkContacts.count} 명의 고객 생성`);
```

### 렌즈별 세그먼테이션 쿼리

```typescript
// L0 렌즈: 부재중 고객 (3-6개월)
const inactiveLeads = await prisma.contact.findMany({
  where: {
    organizationId: "org123",
    reactivationSegment: "3-6m",
    smsDay0Sent: false,
    lastCruiseDate: {
      gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000), // 6개월
      lt: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000)   // 3개월
    }
  },
  select: {
    id: true,
    phone: true,
    name: true,
    reactivationLikelihood: true,
    lastSatisfactionScore: true
  },
  take: 500
});

// L3 렌즈: 경쟁사 언급형
const competitorMentioned = await prisma.contact.findMany({
  where: {
    organizationId: "org123",
    competitorMentioned: true,
    differentiationResponseSent: false,
    lastCompetitorMentionAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 지난 7일
    }
  },
  include: {
    lensClassifications: {
      where: { lensType: "L3", status: "ACTIVE" }
    }
  }
});

// L6 렌즈: 타이밍/손실회피 (결정 윈도우 만료 임박)
const urgentClosers = await prisma.contact.findMany({
  where: {
    organizationId: "org123",
    decisionWindowExpiresAt: {
      gte: new Date(),
      lt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 내 만료
    },
    closingStage: { not: "closed" }
  },
  orderBy: { decisionWindowExpiresAt: "asc" }
});

// L10 렌즈: 즉시 구매 클로징 가능
const readyToClose = await prisma.contact.groupBy({
  by: ["organizationId"],
  where: {
    l10ClosingScore: { gte: 80 },
    tripleChoiceOffered: true,
    closingStage: "ready_close",
    l10ConversionAt: null
  },
  _count: true
});
```

### SMS Day 0-3 시퀀스 추적

```typescript
// 시퀀스 생성 및 Day 0 SMS 발송 (트랜잭션)
async function startLensSequence(contactId: string, lensType: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. 렌즈 분류 조회
    const classification = await tx.contactLensClassification.findUnique({
      where: {
        organizationId_contactId_lensType: {
          organizationId: ctx.organizationId!,
          contactId,
          lensType
        }
      }
    });
    
    if (!classification) throw new Error("렌즈 분류 없음");
    
    // 2. SMS 시퀀스 생성
    const sequence = await tx.contactLensSequence.create({
      data: {
        contactId,
        organizationId: ctx.organizationId!,
        classificationId: classification.id,
        lensType,
        sequenceType: "sms_day0_3",
        status: "PENDING",
        day0Sent: true,
        day0SentAt: new Date()
      }
    });
    
    // 3. Contact 상태 업데이트
    await tx.contact.update({
      where: { id: contactId },
      data: {
        ...(lensType === "L0" && { smsDay0Sent: true, smsDay0SentAt: new Date() }),
        ...(lensType === "L5" && { l5l6SmsDay0Sent: true, l5l6SmsDay0SentAt: new Date() }),
        ...(lensType === "L6" && { l5l6SmsDay0Sent: true, l5l6SmsDay0SentAt: new Date() })
      }
    });
    
    return sequence;
  });
}

// Day 1/2/3 일괄 업데이트 (Cron Job에서 호출)
async function updateSmsDay1Sent(contactIds: string[]) {
  const now = new Date();
  const day0SentBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24시간 이전
  
  return await prisma.$transaction(async (tx) => {
    // SMS 시퀀스 업데이트
    await tx.contactLensSequence.updateMany({
      where: {
        day0SentAt: { lt: day0SentBefore },
        day1Sent: false,
        status: "PENDING"
      },
      data: {
        day1Sent: true,
        day1SentAt: now
      }
    });
    
    // Contact SMS 상태 업데이트
    await tx.contact.updateMany({
      where: {
        id: { in: contactIds },
        smsDay0SentAt: { lt: day0SentBefore },
        smsDay1Sent: false
      },
      data: {
        smsDay1Sent: true,
        smsDay1SentAt: now
      }
    });
  });
}
```

---

## 성능 최적화 기법

### 1. N+1 쿼리 문제 해결

```typescript
// ❌ N+1 (100개 조회 시 101개 쿼리 = 느림)
const contacts = await prisma.contact.findMany({ take: 100 });
for (const contact of contacts) {
  const logs = await prisma.callLog.findMany({ where: { contactId: contact.id } });
}

// ✅ INCLUDE (2개 쿼리 = 빠름)
const contacts = await prisma.contact.findMany({
  take: 100,
  include: { callLogs: { take: 10 } }
});

// ✅ 배치 조회 (2개 쿼리 = 빠름)
const contacts = await prisma.contact.findMany({ 
  take: 100,
  select: { id: true, name: true }
});
const contactIds = contacts.map(c => c.id);
const allLogs = await prisma.callLog.findMany({
  where: { contactId: { in: contactIds } },
  orderBy: { createdAt: "desc" }
});
```

### 2. 인덱스 활용

```typescript
// ✅ 인덱스 사용 (빠름: < 50ms)
const contacts = await prisma.contact.findMany({
  where: {
    organizationId: "org123",
    autoSegment: "interested" // idx_contact_org_segment 사용
  },
  take: 100
});

// ❌ 인덱스 미사용 (느림: 100-500ms)
const contacts = await prisma.contact.findMany({
  where: {
    organizationId: "org123",
    adminMemo: { contains: "vip" } // 인덱스 없음
  },
  take: 100
});
```

### 3. 연결 풀 최적화

```typescript
// Neon Pooler 설정 (environment-specific)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&statement_cache_size=25"

// max_pool_size 조정 (기본 10-50)
// - 개발: 5
// - 스테이징: 20
// - 프로덕션: 50
```

---

## 에러 처리

```typescript
try {
  const contact = await prisma.contact.create({
    data: { organizationId: "org123", phone: "010-1234-5678", name: "김철수" }
  });
} catch (err) {
  if ((err as { code?: string }).code === "P2002") {
    // 유니크 제약 위반 (이미 존재)
    console.error("이미 등록된 전화번호");
  } else if ((err as { code?: string }).code === "P2025") {
    // 레코드 없음
    console.error("데이터를 찾을 수 없습니다");
  } else {
    // 기타 에러
    console.error("알 수 없는 에러", err);
  }
}
```

---

**주요 성능 기준:**
- 단일 레코드 조회: < 10ms
- 목록 조회 (limit 100): < 100ms
- 배치 업데이트 (1000건): < 500ms
- SMS 시퀀스 생성 (트랜잭션): < 200ms
