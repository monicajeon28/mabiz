# Menu #38 Phase 3 — A/B 테스팅 + 비용 추적 + 성능 최적화 상세 작업지시서

## 절대법칙 무한루프 (Step 3: 작업지시서)

### 의사결정 확정: 옵션 A (A/B 테스트 우선)

| 항목 | 선택 |
|------|------|
| 구현 순서 | A/B Wave 1-5 (7일) 우선, 비용/성능 병렬 |
| 병렬 처리 | 비용(3일) + 성능(2일) 동시 진행 |
| 총 소요시간 | 7일 (3개 트랙 완전 병렬) |
| 승인 기준 | A/B 스키마 + 비용 API + 성능 config |

---

## 📋 Phase 3 작업 분해 (4 Track × 3 Phase)

### Track 1: A/B 테스팅 (Wave 1-5, 7일, 순차)

#### Wave 1: 스키마 + 마이그레이션 (1일, Agent α)

**산출물**: 
- `prisma/schema.prisma` (수정)
- `prisma/migrations/20260520000000_add_campaign_variant.sql`

**파일 변경**:

1. **prisma/schema.prisma 추가**:
```prisma
model CampaignVariant {
  id           String   @id @default(cuid())
  campaignId   String   @db.Uuid
  variantKey   String   // "A" | "B"
  smsBody?     String
  emailSubject? String
  emailBody?   String
  trafficSplit Float    @default(0.5)  // A를 받을 비율 (0.0~1.0)
  isActive     Boolean  @default(true)
  
  campaign     CrmMarketingCampaign @relation("variants", fields: [campaignId], references: [id], onDelete: Cascade)
  
  @@unique([campaignId, variantKey])
  @@index([campaignId, isActive])
}

// CrmMarketingCampaign에 추가
model CrmMarketingCampaign {
  // ... 기존 필드
  variants     CampaignVariant[]     @relation("variants")
}

// SendingHistory에 필드 추가
model SendingHistory {
  // ... 기존 필드
  variantKey   String?   // null = 단일 메시지, "A" | "B"
}
```

2. **마이그레이션 SQL**:
```sql
CREATE TABLE "CampaignVariant" (
  "id" text NOT NULL PRIMARY KEY,
  "campaignId" uuid NOT NULL,
  "variantKey" text NOT NULL,
  "smsBody" text,
  "emailSubject" text,
  "emailBody" text,
  "trafficSplit" double precision NOT NULL DEFAULT 0.5,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("campaignId") REFERENCES "CrmMarketingCampaign"("id") ON DELETE CASCADE,
  UNIQUE ("campaignId", "variantKey")
);
CREATE INDEX "CampaignVariant_campaignId_isActive_idx" ON "CampaignVariant"("campaignId", "isActive");

ALTER TABLE "SendingHistory" ADD COLUMN "variantKey" text;
CREATE INDEX "SendingHistory_variantKey_status_idx" ON "SendingHistory"("variantKey", "status");
```

**검증**:
```bash
npx prisma migrate dev --name add_campaign_variant
npm run build
```

---

#### Wave 2: Variant 선택 + 발송 로직 (2일, Agent β)

**산출물**:
- `src/lib/campaign-variant.ts` (신규)
- `src/lib/cron/execute-campaigns.ts` (수정)
- `src/lib/sending-history.ts` (수정)

**파일 1: src/lib/campaign-variant.ts** (신규, 100줄)

```typescript
import { prisma } from '@/lib/prisma';

/**
 * 캠페인의 A/B Variant 중 하나 선택
 * @param campaignId - 캠페인 ID
 * @returns variantKey ("A" | "B") 또는 null (단일 메시지)
 */
export async function selectVariant(campaignId: string): Promise<string | null> {
  const variants = await prisma.campaignVariant.findMany({
    where: { campaignId, isActive: true },
    select: { variantKey: true, trafficSplit: true },
  });

  if (variants.length === 0) return null;  // 단일 메시지 캠페인
  if (variants.length !== 2) {
    console.warn(`Expected 2 variants for campaign ${campaignId}, got ${variants.length}`);
    return variants[0]?.variantKey || null;
  }

  // A와 B 구분
  const variantA = variants.find(v => v.variantKey === 'A');
  if (!variantA) return null;

  // trafficSplit: A를 받을 비율 (예: 0.5 = 50% A, 50% B)
  const isA = Math.random() < variantA.trafficSplit;
  return isA ? 'A' : 'B';
}

/**
 * 선택된 Variant의 메시지 내용 조회
 */
export async function getVariantContent(campaignId: string, variantKey: string | null) {
  if (!variantKey) {
    // 단일 메시지: Campaign 본체 사용
    return await prisma.crmMarketingCampaign.findUnique({
      where: { id: campaignId },
      select: { smsBody: true, emailSubject: true, emailBody: true },
    });
  }

  // A/B Variant
  return await prisma.campaignVariant.findUnique({
    where: { campaignId_variantKey: { campaignId, variantKey } },
    select: { smsBody: true, emailSubject: true, emailBody: true },
  });
}
```

**파일 2: execute-campaigns.ts 수정** (executeCampaignMessages 함수 수정)

```typescript
// Line 80-90: Variant 선택 추가
async function executeCampaignMessages(batch: SendingHistoryBatch[]) {
  const variantMap = new Map<string, string | null>();  // campaignId → variantKey

  for (const item of batch) {
    if (!variantMap.has(item.campaignId)) {
      const variantKey = await selectVariant(item.campaignId);  // ← 신규
      variantMap.set(item.campaignId, variantKey);
    }

    const variantKey = variantMap.get(item.campaignId);
    const content = await getVariantContent(item.campaignId, variantKey);  // ← 신규

    await sendSingleMessage({
      ...item,
      smsBody: content.smsBody,
      emailSubject: content.emailSubject,
      emailBody: content.emailBody,
      variantKey,  // ← SendingHistory에 기록
    });
  }
}

// Line 150-160: sendSingleMessage 시그니처 수정
async function sendSingleMessage(params: {
  // ... 기존
  variantKey?: string | null;  // ← 신규
}) {
  // ...
  await createSendingHistory({
    // ...
    variantKey: params.variantKey,  // ← 저장
  });
}
```

**파일 3: sending-history.ts 수정** (createSendingHistory)

```typescript
export async function createSendingHistory(params: {
  // ... 기존
  variantKey?: string | null;
}) {
  return prisma.sendingHistory.create({
    data: {
      // ... 기존
      variantKey: params.variantKey ?? null,
    },
  });
}
```

**검증**:
```bash
npm run build
# Variant 선택 로직 테스트
```

---

#### Wave 3: Variant CRUD API (1일, Agent γ)

**산출물**:
- `src/app/api/campaigns/[id]/variants/route.ts` (신규)
- `src/app/api/campaigns/[id]/variants/[key]/route.ts` (신규)

**API 1: POST /api/campaigns/[id]/variants** (Variant 생성)

```typescript
// src/app/api/campaigns/[id]/variants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { variantKey, smsBody, emailSubject, emailBody, trafficSplit } =
    await request.json();

  // 검증
  if (!['A', 'B'].includes(variantKey)) {
    return NextResponse.json({ error: 'Invalid variantKey' }, { status: 400 });
  }

  const variant = await prisma.campaignVariant.create({
    data: {
      campaignId: params.id,
      variantKey,
      smsBody,
      emailSubject,
      emailBody,
      trafficSplit: trafficSplit || 0.5,
    },
  });

  return NextResponse.json({ ok: true, variant });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const variants = await prisma.campaignVariant.findMany({
    where: { campaignId: params.id },
  });

  return NextResponse.json({ ok: true, variants });
}
```

**API 2: PATCH /api/campaigns/[id]/variants/[key]** (Variant 수정)

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; key: string } }
) {
  const { smsBody, emailSubject, emailBody, trafficSplit, isActive } =
    await request.json();

  const variant = await prisma.campaignVariant.update({
    where: { campaignId_variantKey: { campaignId: params.id, variantKey: params.key } },
    data: {
      smsBody,
      emailSubject,
      emailBody,
      trafficSplit,
      isActive,
    },
  });

  return NextResponse.json({ ok: true, variant });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; key: string } }
) {
  await prisma.campaignVariant.delete({
    where: { campaignId_variantKey: { campaignId: params.id, variantKey: params.key } },
  });

  return NextResponse.json({ ok: true });
}
```

**검증**:
```bash
curl -X POST http://localhost:3000/api/campaigns/cmp_123/variants \
  -H "Content-Type: application/json" \
  -d '{
    "variantKey": "A",
    "smsBody": "A버전 메시지",
    "trafficSplit": 0.5
  }'
```

---

#### Wave 4: A/B 통계 API (1일, Agent δ)

**산출물**:
- `src/app/api/campaigns/[id]/variants/stats/route.ts` (신규)

**API: GET /api/campaigns/[id]/variants/stats** (A/B 분석)

```typescript
import { prisma } from '@/lib/prisma';
import { calculateChiSquare } from '@/lib/stats';

export async function GET(request, { params }) {
  const { id } = params;

  // Step 1: 각 Variant별 발송 통계
  const stats = await prisma.sendingHistory.groupBy({
    by: ['variantKey', 'status'],
    where: { campaignId: id },
    _count: { id: true },
  });

  // Step 2: Variant별로 정리
  const variantStats = {
    A: { sent: 0, failed: 0, successRate: 0 },
    B: { sent: 0, failed: 0, successRate: 0 },
  };

  for (const stat of stats) {
    if (['SENT', 'DELIVERED'].includes(stat.status)) {
      variantStats[stat.variantKey].sent += stat._count.id;
    } else if (stat.status === 'FAILED') {
      variantStats[stat.variantKey].failed += stat._count.id;
    }
  }

  // Step 3: 성공률 계산
  variantStats.A.successRate =
    variantStats.A.sent > 0
      ? variantStats.A.sent / (variantStats.A.sent + variantStats.A.failed)
      : 0;
  variantStats.B.successRate =
    variantStats.B.sent > 0
      ? variantStats.B.sent / (variantStats.B.sent + variantStats.B.failed)
      : 0;

  // Step 4: Chi-square 검정 (유의미성 판정)
  const chiSquare = calculateChiSquare(
    variantStats.A.sent,
    variantStats.A.failed,
    variantStats.B.sent,
    variantStats.B.failed
  );

  return NextResponse.json({
    ok: true,
    campaign: id,
    variants: variantStats,
    chiSquare,
    isSignificant: chiSquare.pValue < 0.05,  // 95% 신뢰도
    recommendation: variantStats.A.successRate > variantStats.B.successRate ? 'A' : 'B',
  });
}
```

**유틸: src/lib/stats.ts** (Chi-square 함수)

```typescript
export function calculateChiSquare(a1, a0, b1, b0) {
  const n = a1 + a0 + b1 + b0;
  const e1 = ((a1 + b1) * (a1 + a0)) / n;
  const e2 = ((a1 + b1) * (b1 + b0)) / n;
  const e3 = ((a0 + b0) * (a1 + a0)) / n;
  const e4 = ((a0 + b0) * (b1 + b0)) / n;

  const chi2 = (a1 - e1) ** 2 / e1 + (a0 - e3) ** 2 / e3 +
               (b1 - e2) ** 2 / e2 + (b0 - e4) ** 2 / e4;

  // 자유도 1인 카이제곱 분포 → p-value 변환 (근사)
  const pValue = Math.exp(-chi2 / 2);

  return { chi2, pValue };
}
```

---

#### Wave 5: A/B 관리 UI (2일, Agent ε)

**산출물**:
- `src/app/(dashboard)/marketing/campaigns/[id]/variants/page.tsx` (신규)
- `src/components/campaigns/VariantManager.tsx` (신규)

**페이지 1: Variant 관리 페이지** (200줄)

```typescript
// src/app/(dashboard)/marketing/campaigns/[id]/variants/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Input, Textarea, Alert } from '@/components/ui';
import { VariantStats } from '@/components/campaigns/VariantStats';

export default function VariantPage({ params }) {
  const [variants, setVariants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVariants();
    loadStats();
  }, [params.id]);

  const loadVariants = async () => {
    const res = await fetch(`/api/campaigns/${params.id}/variants`);
    const data = await res.json();
    setVariants(data.variants || []);
  };

  const loadStats = async () => {
    const res = await fetch(`/api/campaigns/${params.id}/variants/stats`);
    const data = await res.json();
    setStats(data);
    setLoading(false);
  };

  const handleCreateVariant = async (variantKey, content) => {
    const res = await fetch(`/api/campaigns/${params.id}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantKey, ...content }),
    });
    const data = await res.json();
    setVariants([...variants, data.variant]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">A/B 테스트 관리</h1>

      {/* Variant 카드 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VariantCard variant="A" onSave={handleCreateVariant} />
        <VariantCard variant="B" onSave={handleCreateVariant} />
      </div>

      {/* 통계 */}
      {stats && !loading && (
        <VariantStats stats={stats} isSignificant={stats.isSignificant} />
      )}
    </div>
  );
}
```

**컴포넌트: VariantCard** (SMS/Email 입력)

```typescript
function VariantCard({ variant, onSave }) {
  const [smsBody, setSmsBody] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Variant {variant}</h2>

      <Textarea
        label="SMS 본문 (90자 제한)"
        value={smsBody}
        onChange={(e) => setSmsBody(e.target.value)}
        maxLength={90}
      />

      <Input
        label="Email 제목"
        value={emailSubject}
        onChange={(e) => setEmailSubject(e.target.value)}
      />

      <Textarea
        label="Email 본문"
        value={emailBody}
        onChange={(e) => setEmailBody(e.target.value)}
      />

      <Button
        onClick={() => onSave(variant, { smsBody, emailSubject, emailBody })}
      >
        저장
      </Button>
    </Card>
  );
}
```

---

### Track 2: 비용 추적 (3일, 병렬, Agent ζ)

#### Day 1: CampaignCost 마이그레이션

파일: `prisma/migrations/20260520000000_add_campaign_cost.sql`
- CampaignCost 테이블 생성

#### Day 2-3: Cost 계산 API + 배시

파일:
- `src/lib/campaign-cost.ts` (계산 함수)
- `src/app/api/campaigns/[id]/cost/summary/route.ts` (API)

**핵심 로직**: 
```typescript
const stats = await prisma.sendingHistory.groupBy({
  by: ['channel', 'status'],
  where: { campaignId }
});
// → CampaignCost 업데이트
```

---

### Track 3: 성능 최적화 (2일, 병렬, Agent η)

#### Day 1: DB Pool + 환경변수

파일:
- `.env.local` 수정 (`DATABASE_URL`에 `?max_connections=30`)
- `src/lib/prisma.ts` 수정

#### Day 2: SMS Rate Limiter + Config

파일:
- `src/lib/sms-rate-limiter.ts` (토큰 버킷)
- `src/app/api/config/sending/route.ts` (설정 API)

---

## 📊 병렬 실행 구조

```
         Track 1: A/B Test (7일, 순차)
         │
Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5
(Schema) (Logic) (CRUD)  (Stats)  (UI)
│        │        │       │       │
├────────┴────────┴───────┴───────┴─── 총 7일
│
║ 동시 진행 (병렬)
║
├─ Track 2: Cost (3일)
├─ Track 3: Perf (2일)
│
└─ 최종 완료: 7일 (병렬이므로 가장 오래 걸리는 A/B Track 기준)
```

---

## ✅ 구현 체크리스트

### Wave 1 (Schema)
- [ ] CampaignVariant 모델 스키마 정의
- [ ] SendingHistory.variantKey 필드 추가
- [ ] 인덱스 3개 생성
- [ ] 마이그레이션 실행 및 npx prisma generate
- [ ] npm run build 통과

### Wave 2 (Logic)
- [ ] selectVariant() 함수 구현
- [ ] getVariantContent() 함수 구현
- [ ] executeCampaignMessages() 수정 (Variant 선택 로직)
- [ ] sendSingleMessage() 시그니처 수정
- [ ] 단위 테스트: selectVariant()의 50:50 분할 검증

### Wave 3 (CRUD API)
- [ ] POST /api/campaigns/[id]/variants
- [ ] GET /api/campaigns/[id]/variants
- [ ] PATCH /api/campaigns/[id]/variants/[key]
- [ ] DELETE /api/campaigns/[id]/variants/[key]
- [ ] IDOR 방지: organizationId 필터링 확인
- [ ] Zod 스키마 검증

### Wave 4 (Stats)
- [ ] Chi-square 함수 구현 (lib/stats.ts)
- [ ] GET /api/campaigns/[id]/variants/stats
- [ ] p-value < 0.05 판정 로직
- [ ] 추천 로직 (A vs B)

### Wave 5 (UI)
- [ ] Variant 관리 페이지 (variants/page.tsx)
- [ ] VariantCard 컴포넌트 (A, B 입력)
- [ ] VariantStats 컴포넌트 (비교 차트)
- [ ] SMS 90자 제한 + 문자 카운터
- [ ] 모바일 반응형 디자인

### Track 2 (Cost)
- [ ] CampaignCost 테이블 생성
- [ ] calculateCampaignCost() 함수
- [ ] GET /api/campaigns/[id]/cost/summary
- [ ] 시간당 배치 스케줄러

### Track 3 (Perf)
- [ ] DATABASE_URL max_connections=30
- [ ] SMS Rate Limiter (초당 3건)
- [ ] execute-campaigns.ts 배치 크기 150
- [ ] Load test (1500명 발송 시간 측정)

---

## 🎯 승인 기준 (Step 4 전 필수)

1. **Schema**: CampaignVariant + SendingHistory.variantKey 생성 완료
2. **Logic**: selectVariant() 50:50 분할 검증 완료
3. **API**: 5개 엔드포인트 (POST/GET/PATCH/DELETE/STATS) 모두 구현
4. **UI**: 관리 페이지 정상 작동 (Variant 생성/수정/비교)
5. **Cost**: API 응답 시간 <500ms
6. **Perf**: 1500명 발송 5분 이내 (load test 통과)

---

## 📝 다음 단계 (Step 4)

**Step 4: 사용자 승인**
- 위 체크리스트 모두 ✅ 확인
- 사용자 최종 승인 획득

**Step 5-1: 메모리화**
- menu_38_phase3_implementation_log.md 작성

**Step 5-2: 에이전트 병렬**
- Wave 1-5의 6개 에이전트 동시 실행

**Step 6: 코드 리뷰**
- 10렌즈 분석

**Step 7: 메모리 업데이트**
- MEMORY.md 인덱싱

