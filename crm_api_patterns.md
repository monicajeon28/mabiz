---
name: crm-api-patterns
description: REST API 엔드포인트 설계, 에러 처리, 응답 형식, 역할기반 인증 패턴
metadata:
  type: reference
  category: api
  updated: 2026-05-26
---

# CRM API 설계 패턴

## 핵심 개념

### 1. REST API 표준 (Next.js App Router)

마비즈 CRM은 **Next.js 13+ App Router**를 사용하며, 파일 기반 라우팅입니다.

```
src/app/api/
├── contacts/
│   ├── route.ts          # GET /api/contacts, POST /api/contacts
│   ├── [id]/route.ts     # GET /api/contacts/[id], PATCH, DELETE
│   ├── import/route.ts   # POST /api/contacts/import (CSV)
│   ├── export/route.ts   # GET /api/contacts/export
│   └── group-blast/route.ts # POST /api/contacts/group-blast
├── crm/
│   ├── contacts/route.ts
│   └── lens-sequences/route.ts
└── admin/
    ├── organizations/route.ts
    └── verification/status/route.ts
```

### 2. 요청/응답 형식

**표준 응답 타입:**
```typescript
// src/lib/api/response.ts
export type SuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ErrorResponse = {
  ok: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
};

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

**GET /api/contacts 예제:**
```typescript
// 요청
GET /api/contacts?type=LEAD&channel=b2c&q=김철수&limit=30&page=1

// 성공 응답 (200 OK)
{
  "ok": true,
  "contacts": [
    {
      "id": "cuid123",
      "phone": "010-1234-5678",
      "name": "김철수",
      "type": "LEAD",
      "leadScore": 75,
      "tags": ["interested", "vip"],
      "lastTransferredTo": {
        "name": "박영희",
        "orgName": "마비즈",
        "transferType": "TEMPORARY"
      }
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 30
}

// 실패 응답 (400 Bad Request)
{
  "ok": false,
  "error": "이미 등록된 전화번호입니다.",
  "code": "P2002"
}
```

### 3. 에러 처리 (Prisma 에러 코드)

```typescript
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 입력 검증
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { ok: false, message: "필수 필드 누락" },
        { status: 400 }
      );
    }
    
    const contact = await prisma.contact.create({ data: body });
    return NextResponse.json({ ok: true, contact }, { status: 201 });
    
  } catch (err) {
    // Prisma 에러 처리
    if ((err as { code?: string }).code === "P2002") {
      // 유니크 제약 위반 (중복)
      return NextResponse.json(
        { ok: false, error: "이미 등록된 값입니다." },
        { status: 409 }
      );
    }
    if ((err as { code?: string }).code === "P2025") {
      // 레코드 없음
      return NextResponse.json(
        { ok: false, error: "데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    
    logger.error("[POST /api/contacts]", { err });
    return NextResponse.json(
      { ok: false, error: "서버 오류" },
      { status: 500 }
    );
  }
}
```

### 4. 역할기반 접근 제어 (RBAC)

```typescript
// src/lib/rbac.ts
import { getAuthContext, buildContactWhere } from "@/lib/rbac";

export async function GET(req: Request) {
  // 1. 인증 컨텍스트 조회
  const ctx = await getAuthContext();
  // {
  //   userId: "member123",
  //   role: "OWNER" | "AGENT" | "GLOBAL_ADMIN",
  //   organizationId: "org123",
  //   organizationName: "마비즈"
  // }
  
  if (ctx.role === "AGENT") {
    // Agent: 자신이 할당받은 고객만 조회
    // Owner: 조직 전체 고객 조회
    // Global Admin: 모든 조직 고객 조회
  }
  
  // 2. WHERE 절 자동 구성 (권한 기반)
  const where = buildContactWhere(ctx, {
    type: "LEAD",
    channel: "b2c"
  });
  
  const contacts = await prisma.contact.findMany({ where });
  
  // 3. 민감 정보 마스킹 (Agent 역할)
  const masked = contacts.map(c => maskContactInfo(c, ctx));
  
  return NextResponse.json({ ok: true, contacts: masked });
}
```

---

## 마비즈 CRM 실제 구현

### GET /api/contacts (고객 목록)

```typescript
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  
  // 쿼리 파라미터
  const type = searchParams.get("type");
  const channel = searchParams.get("channel");
  const q = searchParams.get("q");               // 검색어 (이름/전화)
  const groupId = searchParams.get("groupId");   // 그룹 필터
  const tags = searchParams.get("tags")?.split(",") ?? []; // 태그 필터
  const assignedTo = searchParams.get("assignedTo"); // 담당자 필터
  const sortBy = searchParams.get("sortBy");     // 정렬 (purchasedAt_desc)
  const cursor = searchParams.get("cursor");     // 커서 페이지네이션
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 200);
  
  // WHERE 절 구성 (권한 기반)
  const baseWhere = buildContactWhere(ctx, {
    ...(type && { type }),
    ...(channel && { channel }),
    ...(q && { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } }
    ]}),
    ...(groupId && { groups: { some: { groupId } } }),
    ...(tags.length > 0 && { tags: { hasEvery: tags } }), // AND 조건
    ...(assignedTo === "unassigned" && { assignedUserId: null }),
    ...(assignedTo && assignedTo !== "unassigned" && { assignedUserId: assignedTo })
  });
  
  // 배치 조회 (N+1 방지)
  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where: baseWhere,
      orderBy: sortBy === "purchasedAt_desc" ? { purchasedAt: "desc" } : { id: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        type: true,
        leadScore: true,
        tags: true,
        lastContactedAt: true,
        groups: { select: { groupId: true, group: { select: { id: true, name: true } } } },
        _count: { select: { callLogs: true } }
      }
    }),
    prisma.contact.count({ where: baseWhere })
  ]);
  
  // 전달 이력 배치 조회
  const contactIds = contacts.map(c => c.id);
  const transferLogs = await prisma.contactTransferLog.findMany({
    where: { contactId: { in: contactIds } },
    orderBy: { createdAt: "desc" },
    select: { contactId: true, toUserId: true }
  });
  
  // 민감 정보 마스킹
  const masked = contacts.map(c => maskContactInfo(c, ctx));
  
  return NextResponse.json({
    ok: true,
    contacts: masked,
    total,
    page,
    limit
  });
}
```

### POST /api/contacts (고객 생성)

```typescript
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const body = await req.json();
  
  // 권한 확인
  if (!["OWNER", "GLOBAL_ADMIN"].includes(ctx.role)) {
    return NextResponse.json(
      { ok: false, error: "권한이 없습니다." },
      { status: 403 }
    );
  }
  
  // 입력 검증
  if (!body.name || !body.phone) {
    return NextResponse.json(
      { ok: false, message: "이름과 전화번호는 필수입니다." },
      { status: 400 }
    );
  }
  
  // 세그먼트 자동 감지
  const segment = detectSegment({
    age: body.age,
    maritalStatus: body.maritalStatus,
    childrenCount: body.childrenCount
  });
  
  // 상품 추천
  const recommendedProduct = recommendProducts(segment)[0]?.productCode;
  
  try {
    const contact = await prisma.contact.create({
      data: {
        organizationId: ctx.organizationId!,
        name: body.name,
        phone: body.phone,
        email: body.email ?? null,
        type: body.type ?? "LEAD",
        age: body.age ?? null,
        maritalStatus: body.maritalStatus ?? null,
        segment,
        recommendedProduct,
        ...(body.groupIds?.length && {
          groups: {
            create: body.groupIds.map((gid: string) => ({ groupId: gid }))
          }
        })
      }
    });
    
    logger.log("[POST /api/contacts] 고객 생성", { id: contact.id, segment });
    
    // 세그먼트별 자동 SMS 발송 (fire-and-forget)
    (async () => {
      const template = await prisma.smsTemplate.findFirst({
        where: {
          segmentCode: segment,
          category: "AUTO_RECOMMEND",
          isSystem: true
        }
      });
      
      if (template && contact.phone) {
        const smsResult = await sendSms({
          receiver: contact.phone,
          msg: template.content,
          organizationId: ctx.organizationId!,
          contactId: contact.id
        });
      }
    })();
    
    return NextResponse.json({ ok: true, contact }, { status: 201 });
    
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { ok: false, message: "이미 등록된 전화번호입니다." },
        { status: 409 }
      );
    }
    logger.error("[POST /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

### POST /api/contacts/import (CSV 대량 수입)

```typescript
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const formData = await req.formData();
  const file = formData.get("file") as File;
  
  if (!file || !file.name.endsWith(".csv")) {
    return NextResponse.json(
      { ok: false, error: "CSV 파일만 지원됩니다." },
      { status: 400 }
    );
  }
  
  const csv = await file.text();
  const rows = csv.split("\n").slice(1); // 헤더 제외
  const contacts = [];
  const errors = [];
  
  for (let i = 0; i < rows.length; i++) {
    try {
      const [name, phone, email, type] = rows[i].split(",");
      
      const contact = await prisma.contact.create({
        data: {
          organizationId: ctx.organizationId!,
          name: name.trim(),
          phone: phone.trim(),
          email: email?.trim() ?? null,
          type: type?.trim() ?? "LEAD"
        }
      });
      
      contacts.push(contact);
    } catch (err) {
      errors.push({ row: i + 2, error: (err as Error).message });
    }
  }
  
  return NextResponse.json({
    ok: true,
    imported: contacts.length,
    errors: errors.length > 0 ? errors : undefined
  });
}
```

### POST /api/crm/lens-sequences (SMS Day 0-3 자동 발송)

```typescript
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const { contactId, lensType } = await req.json();
  
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    return NextResponse.json(
      { ok: false, error: "고객을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  
  // 트랜잭션: 시퀀스 생성 및 Day 0 SMS 발송
  const result = await prisma.$transaction(async (tx) => {
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
    
    if (!classification) {
      throw new Error("렌즈 분류가 없습니다.");
    }
    
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
    
    // 3. Day 0 SMS 템플릿 조회
    const template = await tx.lensTemplate.findFirst({
      where: {
        organizationId: ctx.organizationId!,
        lensType,
        day: 0,
        status: "ACTIVE"
      }
    });
    
    if (template && contact.phone) {
      // 4. SMS 발송
      const smsResult = await sendSms({
        receiver: contact.phone,
        msg: template.body,
        organizationId: ctx.organizationId!,
        contactId
      });
      
      if (smsResult.result_code !== "1") {
        throw new Error(`SMS 발송 실패: ${smsResult.message}`);
      }
    }
    
    return sequence;
  });
  
  return NextResponse.json({ ok: true, sequence: result });
}
```

---

## 에러 코드 매핑

| HTTP | Prisma | 의미 | 해결 |
|------|--------|------|------|
| 400 | - | 입력 검증 실패 | 필드 확인 |
| 403 | - | 권한 부족 | 역할 확인 |
| 404 | P2025 | 레코드 없음 | ID 확인 |
| 409 | P2002 | 중복 (유니크 제약) | 다른 값 사용 |
| 500 | 기타 | 서버 오류 | 로그 확인 |

---

## 성능 최적화

### 1. 배치 조회 (N+1 방지)
```typescript
// ❌ N+1 쿼리 (100개 조회 시 101개 쿼리)
const contacts = await prisma.contact.findMany({ take: 100 });
for (const c of contacts) {
  const logs = await prisma.callLog.findMany({ where: { contactId: c.id } });
}

// ✅ 배치 조회 (2개 쿼리)
const contacts = await prisma.contact.findMany({ 
  take: 100,
  include: { callLogs: { take: 5 } }
});
```

### 2. 부분 SELECT (불필요한 필드 제외)
```typescript
// ❌ 모든 필드 조회
const contacts = await prisma.contact.findMany({ take: 100 });

// ✅ 필요한 필드만 조회
const contacts = await prisma.contact.findMany({
  take: 100,
  select: {
    id: true,
    name: true,
    phone: true,
    leadScore: true,
    tags: true,
    _count: { select: { callLogs: true } }
  }
});
```

### 3. 인덱스 확인
```bash
# PostgreSQL에서 인덱스 조회
SELECT indexname FROM pg_indexes WHERE tablename = 'Contact';

# 마비즈 CRM 주요 인덱스
# - idx_contact_org_assigned (organizationId, assignedUserId)
# - idx_contact_org_segment (organizationId, autoSegment)
# - idx_contact_*_sms_status (SMS 발송 추적)
```

---

**참고:** 모든 API는 `logger.log()` 또는 `logger.error()`로 로깅되며, 에러 메시지는 민감정보를 포함하지 않습니다.
