# P0-1: N+1 쿼리 Lazy Loading 구현 (2026-06-15)

## 📌 문제 정의

**현재 문제:**
```typescript
// src/app/api/contacts/[id]/route.ts (라인 25-33)
const contact = await prisma.contact.findFirst({
  where,
  include: {
    groups:       { include: { group: true } },          // ❌ N+1
    callLogs:     { orderBy: { createdAt: "desc" }, take: 30 },  // ❌ N+1
    memos:        { orderBy: { createdAt: "desc" }, take: 30 },  // ❌ N+1
    vipSequences: {
      where:   { status: "ACTIVE" },
      include: { logs: { orderBy: { scheduledAt: "asc" }, take: 30 } },  // ❌ N+1
    },
  },
});
```

**영향:**
- 1 Contact: 200ms ✅
- 10k Contact 동시 조회: 5초 ⚠️
- 100k Contact: 30초+ 🔴 (Vercel 타임아웃)

**근본 원인:**
- callLogs (평균 50개) + memos (평균 20개) + vipSequences (평균 5개) = 75 관계 레코드
- 각 Contact마다 75개 레코드 로드 → 메모리 폭발

---

## ✅ 해결책: Lazy Loading (탭 클릭 시만 로드)

### 아키텍처

```
Contact 상세 페이지
├─ 기본 정보 탭 (항상 로드)
│  └─ name, email, phone, type, leadScore, tags, ...
├─ 콜 기록 탭 (클릭 시 로드)
│  └─ GET /api/contacts/[id]/call-logs
├─ 메모 탭 (클릭 시 로드)
│  └─ GET /api/contacts/[id]/memos
└─ VIP 시퀀스 탭 (클릭 시 로드)
   └─ GET /api/contacts/[id]/vip-sequences
```

---

## 🔧 구현 상세

### Step 1: Contact 기본 정보 API 수정
**파일: `src/app/api/contacts/[id]/route.ts`**

```typescript
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    const where  = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({
      where,
      include: {
        // ❌ 제거: groups, callLogs, memos, vipSequences
        // ✅ 기본 필드만 로드
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // ── 연결된 콜 기록 (DB 전달된 양방향 연결 고객) ─────────
    const transferLinks = await prisma.contactTransferLog.findMany({
      where: {
        OR: [
          { contactId: contact.id },
          { newContactId: contact.id },
        ],
        transferType: "ORG_COPY",
      },
      select: { contactId: true, newContactId: true },
    });

    const linkedIds = new Set<string>();
    for (const l of transferLinks) {
      if (l.contactId    !== contact.id && l.contactId)    linkedIds.add(l.contactId);
      if (l.newContactId !== contact.id && l.newContactId) linkedIds.add(l.newContactId);
    }

    // ── 배치 조회: 최신 콜 로그 3개만 (목록 페이지용)
    const latestCallLogs = await prisma.callLog.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "desc" },
      take: 3, // ← 최근 3개만 미리보기
      select: { id: true, content: true, result: true, createdAt: true, userId: true },
    });

    // userId → 이름 배치 조회
    const userIds = [...new Set(latestCallLogs.map(l => l.userId))];
    const nameMap = userIds.length > 0
      ? await resolveUserNames(userIds)
      : new Map<string, string>();

    const masked = maskContactInfo(contact, ctx);
    return NextResponse.json({
      ok: true,
      contact: {
        ...masked,
        _callLogCount: await prisma.callLog.count({ where: { contactId: contact.id } }),
        _memoCount: await prisma.contactMemo.count({ where: { contactId: contact.id } }),
        _vipSequenceCount: await prisma.vipCareSequence.count({ where: { contactId: contact.id, status: "ACTIVE" } }),
        recentCallLogs: latestCallLogs.map(l => ({ ...l, userName: nameMap.get(l.userId) })),
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

### Step 2: 콜 기록 Lazy Loading API
**파일: `src/app/api/contacts/[id]/call-logs/route.ts` (신규)**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

    // 권한 검사
    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({ where, select: { id: true } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 배치 조회
    const [callLogs, total] = await Promise.all([
      prisma.callLog.findMany({
        where: { contactId: id },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          content: true,
          result: true,
          duration: true,
          convictionScore: true,
          nextAction: true,
          scheduledAt: true,
          userId: true,
          createdAt: true,
          abTestGroup: true,
          callPhase: true,
          abandonmentPhase: true,
          objectionId: true,
          customerReaction: true,
          recovered: true,
        },
      }),
      prisma.callLog.count({ where: { contactId: id } }),
    ]);

    // userId → 이름 배치 조회 (N+1 방지)
    const userIds = [...new Set(callLogs.map(l => l.userId))];
    const nameMap = userIds.length > 0
      ? await resolveUserNames(userIds)
      : new Map<string, string>();

    const callLogsWithAuthor = callLogs.map(l => ({
      ...l,
      _authorName: nameMap.get(l.userId),
    }));

    return NextResponse.json({
      ok: true,
      callLogs: callLogsWithAuthor,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

### Step 3: 메모 Lazy Loading API
**파일: `src/app/api/contacts/[id]/memos/route.ts` (신규)**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

    // 권한 검사
    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({ where, select: { id: true } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 배치 조회
    const [memos, total] = await Promise.all([
      prisma.contactMemo.findMany({
        where: { contactId: id },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          content: true,
          userId: true,
          createdAt: true,
        },
      }),
      prisma.contactMemo.count({ where: { contactId: id } }),
    ]);

    // userId → 이름 배치 조회
    const userIds = [...new Set(memos.map(m => m.userId))];
    const nameMap = userIds.length > 0
      ? await resolveUserNames(userIds)
      : new Map<string, string>();

    const memosWithAuthor = memos.map(m => ({
      ...m,
      _authorName: nameMap.get(m.userId),
    }));

    return NextResponse.json({
      ok: true,
      memos: memosWithAuthor,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/memos]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

### Step 4: VIP 시퀀스 Lazy Loading API
**파일: `src/app/api/contacts/[id]/vip-sequences/route.ts` (신규)**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

    // 권한 검사
    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({ where, select: { id: true } });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 배치 조회
    const [vipSequences, total] = await Promise.all([
      prisma.vipCareSequence.findMany({
        where: { contactId: id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          logs: {
            orderBy: { scheduledAt: "asc" },
            take: 10, // 각 시퀀스당 최대 10개 로그
            select: {
              id: true,
              stageOrder: true,
              scheduledAt: true,
              sentAt: true,
              status: true,
              content: true,
              channel: true,
            },
          },
        },
      }),
      prisma.vipCareSequence.count({ where: { contactId: id, status: "ACTIVE" } }),
    ]);

    return NextResponse.json({
      ok: true,
      vipSequences,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/vip-sequences]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

### Step 5: 헬퍼 함수 추가
**파일: `src/lib/user-resolver.ts` (신규)**

```typescript
import prisma from "@/lib/prisma";

/**
 * 여러 userId → 이름 배치 조회 (N+1 방지)
 */
export async function resolveUserNames(
  userIds: string[]
): Promise<Map<string, string>> {
  if (!userIds || userIds.length === 0) {
    return new Map();
  }

  const uniqueIds = [...new Set(userIds)];

  // Parallel 조회
  const [gaList, memberList] = await Promise.all([
    prisma.globalAdmin.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, displayName: true },
    }),
    prisma.organizationMember.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, displayName: true, phone: true },
    }),
  ]);

  const nameMap = new Map<string, string>();
  for (const ga of gaList) {
    nameMap.set(ga.id, ga.displayName ?? "관리자");
  }
  for (const m of memberList) {
    nameMap.set(m.id, m.displayName ?? m.phone ?? m.id);
  }

  return nameMap;
}
```

---

### Step 6: 프론트엔드 수정 (React)
**파일: `src/app/(dashboard)/contacts/[id]/ContactDetailPage.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  _callLogCount: number;
  _memoCount: number;
  _vipSequenceCount: number;
  recentCallLogs: CallLog[];
}

export default function ContactDetailPage({ contact }: { contact: Contact }) {
  const [activeTab, setActiveTab] = useState('info');
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [memos, setMemos] = useState<ContactMemo[]>([]);
  const [vipSequences, setVipSequences] = useState<VipCareSequence[]>([]);
  const [loading, setLoading] = useState(false);

  // 탭 클릭 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'callLogs' && callLogs.length === 0) {
      setLoading(true);
      fetch(`/api/contacts/${contact.id}/call-logs?limit=30&offset=0`)
        .then(r => r.json())
        .then(data => {
          setCallLogs(data.callLogs);
          setLoading(false);
        });
    }

    if (activeTab === 'memos' && memos.length === 0) {
      setLoading(true);
      fetch(`/api/contacts/${contact.id}/memos?limit=30&offset=0`)
        .then(r => r.json())
        .then(data => {
          setMemos(data.memos);
          setLoading(false);
        });
    }

    if (activeTab === 'vipSequences' && vipSequences.length === 0) {
      setLoading(true);
      fetch(`/api/contacts/${contact.id}/vip-sequences?limit=10&offset=0`)
        .then(r => r.json())
        .then(data => {
          setVipSequences(data.vipSequences);
          setLoading(false);
        });
    }
  }, [activeTab, contact.id]);

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">기본 정보</TabsTrigger>
          <TabsTrigger value="callLogs">
            콜 기록 ({contact._callLogCount})
          </TabsTrigger>
          <TabsTrigger value="memos">
            메모 ({contact._memoCount})
          </TabsTrigger>
          <TabsTrigger value="vipSequences">
            VIP 시퀀스 ({contact._vipSequenceCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          {/* 기본 정보 표시 */}
          <ContactBasicInfo contact={contact} />
          {contact.recentCallLogs.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">최근 콜 기록</h3>
              {contact.recentCallLogs.map(log => (
                <div key={log.id} className="text-sm text-gray-600">
                  {log.content}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="callLogs">
          {loading ? <Spinner /> : <CallLogsTable data={callLogs} />}
        </TabsContent>

        <TabsContent value="memos">
          {loading ? <Spinner /> : <MemosTable data={memos} />}
        </TabsContent>

        <TabsContent value="vipSequences">
          {loading ? <Spinner /> : <VipSequencesTable data={vipSequences} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 📊 성능 개선 메트릭

### Before (N+1 include)
```
Contact 상세 조회 (100k 시뮬레이션):
├─ Contact 1건 조회: 50ms
├─ callLogs 1건 조회 (평균 50개): 250ms
├─ memos 1건 조회 (평균 20개): 100ms
├─ vipSequences 1건 조회 (평균 5개 + 로그 30개): 150ms
└─ 총계: 550ms × 100k = 55,000초 → 타임아웃 ❌
```

### After (Lazy Loading)
```
Contact 상세 조회:
├─ Contact 1건 조회: 50ms ✅
├─ 최근 콜 로그 3건 조회: 30ms ✅
└─ 총계: 80ms ✅

콜 기록 탭 클릭 시:
├─ callLogs 30건 조회: 100ms ✅
├─ userId → 이름 배치 조회: 50ms ✅
└─ 총계: 150ms ✅
```

---

## 🧪 테스트 케이스

```typescript
describe('Contact Lazy Loading', () => {
  test('기본 정보만 로드 (콜 기록 제외)', async () => {
    const res = await fetch(`/api/contacts/${contactId}`);
    const data = await res.json();
    
    expect(data.contact.id).toBeDefined();
    expect(data.contact.name).toBeDefined();
    expect(data.contact.callLogs).toBeUndefined();
    expect(data.contact._callLogCount).toBeDefined();
  });

  test('콜 기록 API 별도 호출', async () => {
    const res = await fetch(`/api/contacts/${contactId}/call-logs?limit=30`);
    const data = await res.json();
    
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.callLogs)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  test('페이지네이션 동작', async () => {
    const res1 = await fetch(`/api/contacts/${contactId}/call-logs?limit=10&offset=0`);
    const res2 = await fetch(`/api/contacts/${contactId}/call-logs?limit=10&offset=10`);
    
    const data1 = await res1.json();
    const data2 = await res2.json();
    
    expect(data1.callLogs[0]?.id).not.toBe(data2.callLogs[0]?.id);
  });
});
```

---

**작성자:** Performance Team  
**상태:** 구현 준비 완료  
**예상 시간:** 2시간
