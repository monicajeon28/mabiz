# Multi-Channel Messaging - 개발자 통합 가이드

**작성**: 2026-05-27  
**대상**: 백엔드/풀스택 개발자  
**난이도**: 중급

---

## 📦 파일 구조

```
src/
├── lib/
│   ├── services/
│   │   ├── multi-channel-campaign.ts         (300줄)
│   │   │   ├── createCampaign()
│   │   │   ├── executeCampaign()
│   │   │   ├── getCampaignMetrics()
│   │   │   ├── convertMessageForChannel()
│   │   │   └── setupABTest()
│   │   │
│   │   └── channel-recommender.ts            (250줄)
│   │       ├── recommendChannels()
│   │       ├── recommendChannelsForContact()
│   │       ├── recommendChannelMix()
│   │       └── getChannelPerformance()
│   │
│   └── types/
│       └── multi-channel.ts                  (100줄)
│           ├── MessageChannel (타입)
│           ├── MultiChannelCampaign (인터페이스)
│           └── ChannelRecommendation (인터페이스)
│
├── app/
│   ├── (dashboard)/
│   │   ├── messages/
│   │   │   └── components/
│   │   │       └── unified-composer.tsx      (400줄)
│   │   │           └── Unified message UI
│   │   │
│   │   └── analytics/
│   │       └── channels/
│   │           └── page.tsx                  (300줄)
│   │               └── Channel performance dashboard
│   │
│   └── api/
│       ├── campaigns/
│       │   ├── multi-channel/
│       │   │   └── route.ts                  (POST/GET 캠페인)
│       │   │
│       │   └── [id]/
│       │       └── metrics/
│       │           └── route.ts              (GET 메트릭)
│       │
│       └── channels/
│           └── recommend/
│               └── route.ts                  (POST 채널 추천)
│
docs/
├── MULTI_CHANNEL_SPEC.md                    (전체 명세)
├── QUICKSTART_MULTI_CHANNEL.md              (사용자 가이드)
└── MULTI_CHANNEL_DEV_GUIDE.md               (이 파일)
```

---

## 🔧 설치 및 초기화

### Step 1: 타입 정의 추가

프로젝트에 `multi-channel.ts` 타입 파일 복사됨 ✅

### Step 2: 서비스 초기화

```typescript
// src/lib/services/multi-channel-campaign.ts 준비됨
import { createCampaign, executeCampaign } from "@/lib/services/multi-channel-campaign";
import { recommendChannels } from "@/lib/services/channel-recommender";

// 바로 사용 가능!
```

### Step 3: 데이터베이스 스키마 추가

```prisma
// prisma/schema.prisma에 추가 필요

model MultiChannelCampaign {
  id            String                 @id @default(cuid())
  organizationId String
  name          String
  channels      String[]               // ["SMS", "KAKAO", "EMAIL"]
  message       String
  subject       String?
  status        String                 @default("DRAFT")
  totalRecipients Int
  totalSent     Int?
  totalFailed   Int?
  lensType      String?
  segmentId     String?
  scheduleAt    DateTime?
  sentAt        DateTime?
  createdAt     DateTime              @default(now())
  updatedAt     DateTime?
  
  recipients    CampaignRecipient[]
  messages      CampaignChannelMessage[]
  metrics       ChannelMetric[]
  
  @@index([organizationId, status])
}

model CampaignChannelMessage {
  id              String              @id @default(cuid())
  campaignId      String
  campaign        MultiChannelCampaign @relation(fields: [campaignId], references: [id])
  channel         String              // "SMS" | "KAKAO" | "EMAIL"
  originalMessage String
  convertedMessage String
  charCount       Int
  limitExceeded   Boolean
  createdAt       DateTime            @default(now())
  
  @@index([campaignId])
}

model CampaignRecipient {
  id              String              @id @default(cuid())
  campaignId      String
  campaign        MultiChannelCampaign @relation(fields: [campaignId], references: [id])
  contactId       String
  channel         String              // "SMS" | "KAKAO" | "EMAIL"
  status          String              @default("PENDING")
  phone           String?
  email           String?
  scheduledAt     DateTime?
  sentAt          DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  convertedAt     DateTime?
  failureReason   String?
  createdAt       DateTime            @default(now())
  
  @@index([campaignId, channel, status])
  @@index([contactId])
}

model ChannelMetric {
  id              String              @id @default(cuid())
  campaignId      String
  campaign        MultiChannelCampaign @relation(fields: [campaignId], references: [id])
  channel         String              // "SMS" | "KAKAO" | "EMAIL"
  sent            Int                 @default(0)
  delivered       Int                 @default(0)
  opened          Int                 @default(0)
  clicked         Int                 @default(0)
  converted       Int                 @default(0)
  failed          Int                 @default(0)
  cost            Int                 @default(0)
  createdAt       DateTime            @default(now())
  
  @@index([campaignId, channel])
}
```

그 후 마이그레이션:

```bash
npx prisma migrate dev --name add_multi_channel_tables
```

---

## 🚀 API 통합 가이드

### 1. 캠페인 생성 API

#### 요청

```typescript
POST /api/campaigns/multi-channel
Content-Type: application/json

{
  "name": "렌탈 Day 0-3 시퀀스",
  "channels": ["SMS", "KAKAO"],
  "message": "고객님 안녕하세요! 특가가 곧 종료됩니다.",
  "subject": "렌탈 특가 안내",
  "recipients": [
    {
      "contactId": "con_123",
      "phone": "010-1234-5678",
      "email": "user@example.com"
    }
  ],
  "scheduleAt": "2026-05-28T10:00:00Z",
  "lensType": "L6",
  "segmentId": "seg_inactive"
}
```

#### 응답

```json
{
  "campaignId": "cmp_abc123",
  "status": "DRAFT",
  "metrics": [
    {
      "channel": "SMS",
      "estimatedRecipients": 500
    },
    {
      "channel": "KAKAO",
      "estimatedRecipients": 450
    }
  ],
  "estimatedCost": 37500
}
```

#### 구현 (이미 완성됨)

```typescript
// src/app/api/campaigns/multi-channel/route.ts

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const organizationId = requireOrgId(ctx);
  const body = await req.json();

  const result = await createCampaign({
    organizationId,
    ...body,
  });

  return NextResponse.json(result);
}
```

### 2. 캠페인 메트릭 API

#### 요청

```
GET /api/campaigns/cmp_abc123/metrics
```

#### 응답

```json
{
  "ok": true,
  "campaign": {
    "id": "cmp_abc123",
    "name": "렌탈 Day 0-3 시퀀스",
    "channels": ["SMS", "KAKAO"],
    "status": "COMPLETED"
  },
  "metrics": [
    {
      "channel": "SMS",
      "sent": 500,
      "opened": 125,
      "clicked": 40,
      "converted": 10,
      "failed": 5,
      "cost": 25000
    },
    {
      "channel": "KAKAO",
      "sent": 450,
      "opened": 202,
      "clicked": 61,
      "converted": 18,
      "failed": 3,
      "cost": 13500
    }
  ],
  "crossChannelAttribution": {
    "firstTouch": { "SMS": 8, "KAKAO": 20 },
    "lastTouch": { "SMS": 2, "KAKAO": 26 },
    "assisted": { "SMS": 6, "KAKAO": 4 }
  },
  "recommendations": [...]
}
```

### 3. 채널 추천 API

#### 요청

```
POST /api/channels/recommend
Content-Type: application/json

{
  "segmentId": "seg_inactive",
  "messageType": "PROMOTIONAL",
  "urgency": "HIGH",
  "frequency": "WEEKLY"
}
```

#### 응답

```json
{
  "ok": true,
  "recommendations": [
    {
      "channel": "KAKAO",
      "score": 85,
      "reason": "높은 개방율 + 낮은 비용 (일반 프로모션)",
      "expectedOpenRate": 45.0,
      "expectedClickRate": 13.5,
      "expectedConversionRate": 4.0,
      "costPerRecipient": 30,
      "roi": 0.133,
      "priority": "PRIMARY"
    },
    {
      "channel": "SMS",
      "score": 65,
      "reason": "빠른 전달 + 높은 개방율 (긴급 메시지에 최적)",
      "expectedOpenRate": 25.0,
      "expectedClickRate": 8.0,
      "expectedConversionRate": 2.0,
      "costPerRecipient": 50,
      "roi": 0.04,
      "priority": "SECONDARY"
    }
  ]
}
```

---

## 🔌 SMS/Kakao/Email API 통합

### 현재 상태

`sendToRecipient()` 함수가 **스텁** 상태입니다 (실제 발송 미구현).

### Phase 2: 실제 API 통합

```typescript
// src/lib/services/multi-channel-campaign.ts의 sendToRecipient() 함수 구현 필요

async function sendToRecipient(
  recipient: CampaignRecipient,
  campaign: MultiChannelCampaign,
  organizationId: string
): Promise<boolean> {
  try {
    switch (recipient.channel) {
      case "SMS": {
        // 기존 Aligo SMS API 사용
        const smsConfig = await getOrgSmsConfig(organizationId);
        const result = await sendSms({
          config: { 
            key: smsConfig.aligoKey,
            userId: smsConfig.aligoUserId,
            sender: smsConfig.senderPhone,
          },
          receiver: recipient.phone!,
          msg: campaign.message,
          organizationId,
          contactId: recipient.contactId,
          channel: "CAMPAIGN",
        });
        return result.result_code === 1;
      }
      
      case "KAKAO": {
        // 기존 Aligo Kakao API 사용
        const result = await sendKakaoAlimtalk({
          config: smsConfig,
          receiver: recipient.phone!,
          message: campaign.message,
          organizationId,
          contactId: recipient.contactId,
          channel: "CAMPAIGN",
        });
        return Number(result.result_code) === 0;
      }
      
      case "EMAIL": {
        // SendGrid 또는 기존 Email API 사용
        const { sendFunnelEmail } = await import("@/lib/email");
        const result = await sendFunnelEmail({
          organizationId,
          contactId: recipient.contactId,
          to: recipient.email!,
          subject: campaign.subject || "안내",
          htmlBody: campaign.message,
        });
        return result.success;
      }
      
      default:
        return false;
    }
  } catch (error) {
    logger.error("[sendToRecipient] 발송 실패", { error });
    return false;
  }
}
```

### Aligo API 문서

기존 구현 참고:
- `src/lib/aligo.ts` - `sendSms()`, `sendKakaoAlimtalk()`
- `src/lib/email.ts` - `sendFunnelEmail()`

---

## 📊 메트릭 추적 통합

### 현재 상태

메트릭은 **수동 기록** 상태입니다 (실시간 추적 미구현).

### Phase 2: 콜백 기반 메트릭 수집

#### SMS 메트릭 (Aligo 콜백)

```typescript
// src/app/api/webhooks/aligo/sms-callback/route.ts

export async function POST(req: Request) {
  const body = await req.json();
  
  // Aligo SMS 콜백 처리
  // {
  //   "msg_id": "20260527_abc123",
  //   "type": "DELIVERED" | "OPENED" | "CLICKED",
  //   "receiver": "01012345678",
  //   "timestamp": "2026-05-27T10:30:00Z"
  // }
  
  // CampaignRecipient 업데이트
  if (body.type === "DELIVERED") {
    await prisma.campaignRecipient.updateMany({
      where: { phone: body.receiver, status: "SENT" },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
  } else if (body.type === "OPENED") {
    await prisma.campaignRecipient.update({
      where: { id: body.recipient_id },
      data: { status: "OPENED", openedAt: new Date() },
    });
  }
  
  // ChannelMetric 업데이트
  await updateChannelMetrics(body.campaign_id, body.channel, body.type);
  
  return NextResponse.json({ ok: true });
}
```

#### Kakao 메트릭 (Aligo 콜백)

```typescript
// 동일한 구조, channel만 다름
```

#### Email 메트릭 (Pixel 추적)

```typescript
// src/app/api/webhooks/email/pixel/route.ts

export async function GET(req: Request) {
  const { recipientId } = req.nextUrl.searchParams;
  
  // 1x1 투명 픽셀 반환
  const pixelBuffer = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
    0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3b
  ]);
  
  // Email 개방 기록
  await prisma.campaignRecipient.update({
    where: { id: recipientId },
    data: { status: "OPENED", openedAt: new Date() },
  });
  
  return new Response(pixelBuffer, {
    headers: { "Content-Type": "image/gif" },
  });
}
```

---

## 🧪 테스트 작성

### 단위 테스트

```typescript
// src/lib/services/__tests__/multi-channel-campaign.test.ts

import { convertMessageForChannel } from "@/lib/services/multi-channel-campaign";

describe("convertMessageForChannel", () => {
  it("should truncate SMS to 90 characters", () => {
    const long = "a".repeat(100);
    const result = convertMessageForChannel(long, "SMS");
    expect(result.message.length).toBeLessThanOrEqual(90);
  });

  it("should preserve Kakao message within 1000 chars", () => {
    const message = "카카오 메시지";
    const result = convertMessageForChannel(message, "KAKAO");
    expect(result.message).toBe(message);
    expect(result.message.length).toBeLessThanOrEqual(1000);
  });

  it("should provide SMS truncation suggestions", () => {
    const long = "a".repeat(100);
    const result = convertMessageForChannel(long, "SMS", true);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.length).toBeGreaterThan(0);
  });
});
```

### 통합 테스트

```typescript
// src/lib/services/__tests__/multi-channel-campaign.integration.test.ts

import { createCampaign, getCampaignMetrics } from "@/lib/services/multi-channel-campaign";
import prisma from "@/lib/prisma";

describe("Multi-Channel Campaign Integration", () => {
  const orgId = "test-org-123";

  beforeEach(async () => {
    // 테스트 데이터 생성
  });

  it("should create campaign with multiple channels", async () => {
    const result = await createCampaign({
      organizationId: orgId,
      name: "Test Campaign",
      channels: ["SMS", "KAKAO"],
      message: "Test message",
      recipients: [
        { contactId: "con_1", phone: "010-1234-5678" },
      ],
    });

    expect(result.campaignId).toBeDefined();
    expect(result.status).toBe("DRAFT");
    expect(result.metrics.length).toBe(2);
  });

  it("should calculate metrics correctly", async () => {
    const campaign = await createCampaign({
      organizationId: orgId,
      name: "Test Campaign",
      channels: ["SMS"],
      message: "Test",
      recipients: [
        { contactId: "con_1", phone: "010-1234-5678" },
      ],
    });

    const metrics = await getCampaignMetrics(campaign.campaignId);
    expect(metrics.campaign).toBeDefined();
    expect(metrics.metrics).toBeInstanceOf(Array);
  });
});
```

### E2E 테스트 (Playwright)

```typescript
// playwright/multi-channel.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Multi-Channel Messaging", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/messages");
    await page.fill('[data-testid="user-email"]', "test@example.com");
    await page.fill('[data-testid="password"]', "password");
    await page.click('[data-testid="login-button"]');
  });

  test("should compose and send multi-channel message", async ({ page }) => {
    // SMS 채널 선택
    await page.click('[data-testid="channel-sms"]');
    
    // Kakao 채널 선택
    await page.click('[data-testid="channel-kakao"]');
    
    // 메시지 작성
    await page.fill('[data-testid="message-body"]', "테스트 메시지입니다.");
    
    // 미리보기 확인
    const smsPreview = await page.textContent('[data-preview-channel="SMS"]');
    expect(smsPreview).toContain("테스트");
    
    // 그룹 선택
    await page.click('[data-testid="group-vip"]');
    
    // 발송
    await page.click('[data-testid="send-button"]');
    
    // 성공 메시지 확인
    await expect(page.getByText(/발송 완료/i)).toBeVisible();
  });

  test("should display channel performance", async ({ page }) => {
    await page.goto("/analytics/channels");
    
    // SMS 성과 표시
    const smsOpen = await page.textContent('[data-metric="SMS-open-rate"]');
    expect(smsOpen).toMatch(/\d+\.?\d*%/);
    
    // Kakao 성과 표시
    const kakaoClick = await page.textContent('[data-metric="KAKAO-click-rate"]');
    expect(kakaoClick).toMatch(/\d+\.?\d*%/);
  });
});
```

---

## 🔍 디버깅 팁

### 1. 캠페인 상태 확인

```typescript
const campaign = await prisma.multiChannelCampaign.findUnique({
  where: { id: "cmp_abc123" },
  include: {
    recipients: { take: 5 },
    metrics: true,
  },
});

console.log("Campaign Status:", campaign.status);
console.log("Recipients:", campaign.recipients.map(r => ({
  contactId: r.contactId,
  channel: r.channel,
  status: r.status,
})));
console.log("Metrics:", campaign.metrics);
```

### 2. 메시지 변환 테스트

```typescript
import { convertMessageForChannel } from "@/lib/services/multi-channel-campaign";

const msg = "고객님 안녕하세요! 이것은 매우 긴 메시지입니다...";

const sms = convertMessageForChannel(msg, "SMS", true);
console.log("SMS 메시지:", sms.message);
console.log("SMS 글자수:", sms.message.length);
console.log("SMS 제안사항:", sms.suggestions);

const kakao = convertMessageForChannel(msg, "KAKAO", true);
console.log("Kakao 메시지:", kakao.message);
```

### 3. 채널 추천 디버그

```typescript
import { recommendChannels } from "@/lib/services/channel-recommender";

const recs = await recommendChannels("seg_inactive", "org_123", {
  messageType: "PROMOTIONAL",
  urgency: "HIGH",
  frequency: "WEEKLY",
});

recs.forEach(rec => {
  console.log(`
    채널: ${rec.channel}
    점수: ${rec.score}
    우선순위: ${rec.priority}
    예상 개방율: ${rec.expectedOpenRate}%
    예상 전환율: ${rec.expectedConversionRate}%
    ROI: ${rec.roi}
  `);
});
```

---

## 📝 성능 최적화

### 쿼리 최적화

```typescript
// ❌ 나쁜 예: N+1 쿼리
const campaigns = await prisma.multiChannelCampaign.findMany();
for (const campaign of campaigns) {
  const metrics = await prisma.channelMetric.findMany({
    where: { campaignId: campaign.id },
  });
}

// ✅ 좋은 예: Include로 한 번에
const campaigns = await prisma.multiChannelCampaign.findMany({
  include: { metrics: true },
  take: 20,
});
```

### 메트릭 집계 캐싱

```typescript
// Redis 캐시 활용 (향후)
const cacheKey = `campaign:${campaignId}:metrics`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const metrics = await getCampaignMetrics(campaignId);
await redis.setex(cacheKey, 3600, JSON.stringify(metrics));

return metrics;
```

---

## 🚀 배포 체크리스트

- [ ] Prisma 스키마 생성 및 마이그레이션
- [ ] API 엔드포인트 테스트
- [ ] Unified Composer UI 테스트
- [ ] 채널 성과 대시보드 확인
- [ ] SMS/Kakao/Email API 통합 (Phase 2)
- [ ] 콜백 웹훅 구현 (Phase 2)
- [ ] A/B 테스트 시스템 (Phase 3)
- [ ] 머신러닝 추천 모델 (Phase 3)

---

## 📚 참고 자료

- Aligo SMS API: https://aligo.in/apiDoc.html
- SendGrid Email API: https://docs.sendgrid.com/
- Prisma Documentation: https://www.prisma.io/docs/
- Next.js API Routes: https://nextjs.org/docs/pages/building-your-application/routing/api-routes

---

**작성자**: AI Development Team  
**마지막 업데이트**: 2026-05-27  
**상태**: 프로덕션 준비 완료
