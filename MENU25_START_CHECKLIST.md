# ✅ Menu #25 마케팅 자동화 시작 체크리스트

**작성일:** 2026-05-18  
**상태:** 시작 준비 완료  
**우선순위:** P0 (핵심 수익 기능)  

---

## 🎯 목표

Menu #25 마케팅 자동화를 Phase 1 (필수 기능)으로 완성  
→ 고객 그룹별 자동 메시지 발송 + 추적 가능

**완료 기준:**
- ✅ 캠페인 생성/관리 가능
- ✅ SMS/Email 자동 발송
- ✅ 발송 상태 추적 (실시간)
- ✅ 성과 분석 기본 지표

---

## 📋 사전 준비 (1시간)

### Step 1: DB 마이그레이션 준비

**확인 사항:**
- [x] CrmMarketingCampaign 이미 존재 (prisma/schema.prisma 확인)
- [ ] CrmMarketingMessage 모델 추가 필요

**실행:**
```bash
# 1. prisma/schema.prisma에 추가
model CrmMarketingMessage {
  id              String @id @default(cuid())
  campaignId      String
  recipientId     String
  
  # 발송 상태
  status          ExecutionStatus @default(PENDING)
  failureReason   ExecutionFailureReason?
  
  # 추적 데이터
  sentAt          DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  registeredAt    DateTime?
  
  # A/B 테스트
  variant         String?
  
  campaign        CrmMarketingCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recipient       Contact @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime @default(now())
  
  @@unique([campaignId, recipientId])
  @@index([campaignId])
  @@index([recipientId])
  @@index([status])
}

# 2. CrmMarketingCampaign에 필드 추가 (기존에 없다면)
# 확인: sendEmail, smsBody, emailSubject, emailBody, includeLanding, sendAt, repeatRule

# 3. 마이그레이션 실행
npx prisma migrate dev --name add_marketing_message
```

### Step 2: 외부 API 설정 확인

**Aligo SMS:**
- [x] OrgSmsConfig에 aligoKey, aligoUserId 저장됨 (schema 확인)
- [ ] 테스트 발송 가능 여부 확인

**이메일:**
- [x] OrgEmailConfig 존재 (또는 자체 메일 서버)
- [ ] 설정 페이지에서 SMTP 입력 가능

### Step 3: 기존 컴포넌트/API 목록

**재사용 가능:**
```
✅ ContactGroup (고객 그룹 선택)
✅ SmsTemplate (SMS 템플릿 라이브러리)
✅ OrgSmsConfig (SMS 발신자 설정)
✅ OrgEmailConfig (Email 설정)
✅ ExecutionLog (발송 로그 기록)
✅ ShortLink (단축 URL)
```

**신규 개발:**
```
🔴 CampaignForm (캠페인 생성 폼)
🔴 CampaignList (캠페인 목록)
🔴 MessageEditor (메시지 작성)
🔴 TrackingDashboard (추적 대시보드)
🔴 /api/marketing/* (API)
```

---

## 🏗️ 구현 단계 (25시간 / 3-4일)

### **Phase 1-1: DB & API 기초** (4시간)

#### 1-1-1: DB 마이그레이션 (1시간)
```
[ ] CrmMarketingMessage 모델 추가
[ ] 인덱스 설정 (campaignId, recipientId, status)
[ ] npx prisma migrate 실행
[ ] 데이터 검증
```

**파일:**
- `prisma/schema.prisma` (수정)
- `prisma/migrations/[timestamp]_add_marketing_message/migration.sql` (생성)

#### 1-1-2: 기본 API (3시간)
```typescript
// src/app/api/marketing/campaigns/route.ts
POST   /api/marketing/campaigns          # 생성
GET    /api/marketing/campaigns          # 목록 (필터링)

// src/app/api/marketing/campaigns/[id]/route.ts
GET    /api/marketing/campaigns/[id]     # 상세
PATCH  /api/marketing/campaigns/[id]     # 수정
DELETE /api/marketing/campaigns/[id]     # 삭제

// src/app/api/marketing/campaigns/[id]/send/route.ts
POST   /api/marketing/campaigns/[id]/send # 발송 (배치)
```

**핵심 로직:**
```typescript
// 배치 처리 (100명씩)
const sendCampaign = async (campaignId: string) => {
  const campaign = await db.crmMarketingCampaign.findUnique({
    where: { id: campaignId },
    include: { group: { include: { members: true } } },
  });
  
  const members = campaign.group.members;
  const batches = chunk(members, 100);
  
  for (const batch of batches) {
    await Promise.all(
      batch.map(member => sendToMember(member, campaign))
    );
    await delay(1000); // 배치 간 1초 대기
  }
};

// 개별 발송
const sendToMember = async (member: Contact, campaign: CrmMarketingCampaign) => {
  try {
    if (campaign.sendSms) {
      await sendSms(member, campaign);
    }
    if (campaign.sendEmail) {
      await sendEmail(member, campaign);
    }
    await logExecution(campaign.id, member.id, 'SENT');
  } catch (error) {
    await logExecution(campaign.id, member.id, 'FAILED', error.message);
  }
};
```

**테스트:**
```bash
# API 테스트
curl -X POST http://localhost:3000/api/marketing/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "test-group-id",
    "title": "Test Campaign",
    "sendSms": true,
    "smsBody": "Test message"
  }'
```

---

### **Phase 1-2: UI 개발** (6시간)

#### 1-2-1: 캠페인 목록 페이지 (2시간)
```
파일: src/app/(dashboard)/marketing/page.tsx

구조:
┌─ Header: "마케팅 자동화"
├─ Button: "+ 새 캠페인"
├─ Tabs: 모두 / 초안 / 예약 / 발송완료 / 실패
├─ Table:
│  ├─ 캠페인명
│  ├─ 상태
│  ├─ 대상수
│  ├─ 발송완료
│  ├─ 생성일
│  └─ 액션 (수정/삭제/재발송)
└─ Pagination
```

**상태별 색상:**
- DRAFT: 회색 (초안)
- SCHEDULED: 파란색 (예약)
- SENT: 초록색 (발송완료)
- FAILED: 빨간색 (실패)

#### 1-2-2: 캠페인 생성 폼 (3시간)
```
파일: src/app/(dashboard)/marketing/new/page.tsx

Step 1: 기본 정보
  - 캠페인명 입력
  - 대상 그룹 선택 (드롭다운)

Step 2: 메시지 선택
  - ☐ 이메일 보내기
  - ☑ 문자 보내기
  - ☑ 랜딩 링크 포함

Step 3: 메시지 작성
  - SMS 입력 (1000자 한도)
    * 미리보기
    * 변수 삽입 ({고객명}, {휴대폰})
  - Email (선택)
    * 제목
    * HTML 에디터

Step 4: 스케줄
  - ◉ 지금 바로
  - ○ 예약 (날짜 & 시간)
  - ○ 반복 (매일/매주/매월)

Step 5: 검토 & 발송
  - 최종 확인
  - "발송" 버튼
```

**주요 컴포넌트:**
```typescript
// src/components/marketing/CampaignForm.tsx
export interface CampaignFormData {
  title: string;
  groupId: string;
  sendSms: boolean;
  smsBody: string;
  sendEmail: boolean;
  emailSubject: string;
  emailBody: string;
  includeLanding: boolean;
  sendAt: Date;
  repeatRule?: string;
}

// src/components/marketing/MessageEditor.tsx
// - SMS/Email 에디터
// - 변수 삽입 UI
// - 미리보기

// src/components/marketing/ScheduleSelector.tsx
// - 지금/예약/반복 선택
// - TimePicker
// - CRON 설정
```

#### 1-2-3: 캠페인 상세 & 추적 (1시간)
```
파일: src/app/(dashboard)/marketing/[id]/page.tsx

1. 캠페인 정보
   - 제목, 상태, 생성일

2. 발송 상태 (실시간)
   - 진행률 바
   - 대상: 1,000
   - 발송: 950 (95%)
   - 실패: 30 (3%)
   - 대기: 20 (2%)

3. 추적 데이터
   - 클릭수: 420
   - 열람: 550
   - 신청: 120

4. 액션 버튼
   - 취소
   - 재발송 (실패만)
   - 복제
```

---

### **Phase 1-3: 메시지 채널 구현** (8시간)

#### 1-3-1: SMS 발송 (2시간)
```typescript
// src/lib/sms/aligo.ts

export const sendSms = async (
  recipient: Contact,
  campaign: CrmMarketingCampaign
): Promise<boolean> => {
  const org = await db.organization.findUnique({
    where: { id: campaign.organizationId },
    include: { smsConfig: true },
  });
  
  const messageBody = renderMessage(campaign.smsBody, recipient);
  
  try {
    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'user_id': org.smsConfig.aligoUserId,
        'key': org.smsConfig.aligoKey,
        'sender': org.smsConfig.senderPhone,
        'receiver': recipient.phone,
        'msg': messageBody,
      }),
    });
    
    const result = await response.json();
    return result.result_code === '1';
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
};

// 변수 치환
const renderMessage = (template: string, recipient: Contact): string => {
  return template
    .replace(/{고객명}/g, recipient.name)
    .replace(/{휴대폰}/g, recipient.phone)
    .replace(/{일정}/g, recipient.nextScheduledDate || '');
};
```

**테스트:**
```typescript
// 테스트 고객에게 발송
await sendSms(testContact, testCampaign);
```

#### 1-3-2: Email 발송 (3시간)
```typescript
// src/lib/email/send.ts

export const sendEmail = async (
  recipient: Contact,
  campaign: CrmMarketingCampaign
): Promise<boolean> => {
  const subject = renderMessage(campaign.emailSubject, recipient);
  const htmlBody = renderMessage(campaign.emailBody, recipient);
  
  // 이메일 트래킹 픽셀 추가
  const trackingPixel = `<img src="https://api.crm.com/track/email/${campaign.id}/${recipient.id}" 
    width="1" height="1" style="display:none;" alt="" />`;
  
  const fullHtml = htmlBody + trackingPixel;
  
  try {
    // nodemailer 또는 SendGrid 사용
    await transporter.sendMail({
      from: 'noreply@crm.com',
      to: recipient.email,
      subject,
      html: fullHtml,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};
```

#### 1-3-3: 랜딩 링크 추가 (3시간)
```typescript
// src/lib/marketing/landing-link.ts

export const appendLandingLink = async (
  campaign: CrmMarketingCampaign,
  recipient: Contact,
  messageBody: string
): Promise<string> => {
  if (!campaign.includeLanding || !campaign.landingUrl) {
    return messageBody;
  }
  
  // 단축 URL 생성
  const shortLink = await createShortLink(
    campaign.landingUrl,
    recipient.id,
    campaign.id
  );
  
  // 메시지에 링크 추가
  return messageBody + `\n\n${campaign.landingLinkText || '자세히 보기'}: ${shortLink}`;
};

export const createShortLink = async (
  longUrl: string,
  recipientId: string,
  campaignId: string
): Promise<string> => {
  const shortLink = await db.shortLink.create({
    data: {
      longUrl,
      recipientId,
      campaignId,
      slug: generateSlug(), // 6자 랜덤
    },
  });
  
  return `https://crm.io/${shortLink.slug}`;
};

// GET /api/track/[slug]
export const handleShortLinkClick = async (slug: string): Promise<string> => {
  const link = await db.shortLink.findUnique({
    where: { slug },
  });
  
  // 클릭 기록
  await db.shortLink.update({
    where: { id: link.id },
    data: { clickCount: { increment: 1 } },
  });
  
  // 마케팅 메시지 클릭 기록
  await db.crmMarketingMessage.updateMany({
    where: {
      campaignId: link.campaignId,
      recipientId: link.recipientId,
    },
    data: { clickedAt: new Date() },
  });
  
  return link.longUrl;
};
```

---

### **Phase 1-4: 추적 & 분석** (4시간)

#### 1-4-1: 발송 상태 추적 (2시간)
```typescript
// src/app/api/marketing/campaigns/[id]/track/route.ts

export const GET = async (req: Request, { params }) => {
  const { id: campaignId } = params;
  
  const stats = {
    totalCount: 0,
    sentCount: 0,
    failedCount: 0,
    openedCount: 0,
    clickedCount: 0,
    registeredCount: 0,
  };
  
  const messages = await db.crmMarketingMessage.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true,
  });
  
  const trackingData = await db.crmMarketingMessage.findMany({
    where: { campaignId },
    select: {
      status: true,
      sentAt: true,
      openedAt: true,
      clickedAt: true,
      registeredAt: true,
    },
  });
  
  stats.totalCount = trackingData.length;
  stats.sentCount = trackingData.filter(m => m.sentAt).length;
  stats.openedCount = trackingData.filter(m => m.openedAt).length;
  stats.clickedCount = trackingData.filter(m => m.clickedAt).length;
  
  return Response.json(stats);
};
```

#### 1-4-2: 대시보드 컴포넌트 (2시간)
```typescript
// src/components/marketing/TrackingDashboard.tsx

interface TrackingStats {
  totalCount: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  registeredCount: number;
}

export const TrackingDashboard = ({ campaignId }: Props) => {
  const [stats, setStats] = useState<TrackingStats>(null);
  
  useEffect(() => {
    // 5초마다 갱신
    const interval = setInterval(async () => {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/track`);
      setStats(await res.json());
    }, 5000);
    
    return () => clearInterval(interval);
  }, [campaignId]);
  
  const rates = {
    sentRate: (stats.sentCount / stats.totalCount * 100).toFixed(1),
    openRate: (stats.openedCount / stats.sentCount * 100).toFixed(1),
    clickRate: (stats.clickedCount / stats.sentCount * 100).toFixed(1),
  };
  
  return (
    <div>
      {/* 진행률 바 */}
      <ProgressBar 
        value={stats.sentCount} 
        max={stats.totalCount}
        label={`${stats.sentCount} / ${stats.totalCount}`}
      />
      
      {/* 지표 카드 */}
      <StatsCard 
        title="열람율"
        value={`${rates.openRate}%`}
        count={`${stats.openedCount} / ${stats.sentCount}`}
      />
      <StatsCard 
        title="클릭율"
        value={`${rates.clickRate}%`}
        count={`${stats.clickedCount} / ${stats.sentCount}`}
      />
    </div>
  );
};
```

---

### **Phase 1-5: 테스트 & 배포** (3시간)

#### 1-5-1: 통합 테스트 (2시간)
```typescript
// __tests__/marketing.test.ts

describe('Marketing Campaigns', () => {
  // 1. 캠페인 생성
  test('should create a campaign', async () => {
    const campaign = await createCampaign({
      groupId: 'test-group',
      title: 'Test Campaign',
      sendSms: true,
      smsBody: 'Hello {고객명}',
    });
    expect(campaign.id).toBeDefined();
  });
  
  // 2. 100명 발송 테스트
  test('should send campaign to 100 members', async () => {
    const campaign = await sendCampaign('campaign-id');
    const stats = await getCampaignStats('campaign-id');
    expect(stats.sentCount).toBe(100);
  });
  
  // 3. 실패 처리
  test('should handle failures gracefully', async () => {
    // Invalid phone 테스트
    const campaign = await sendCampaign('campaign-with-invalid-phone');
    const logs = await getExecutionLogs('campaign-with-invalid-phone');
    expect(logs.some(l => l.status === 'FAILED')).toBe(true);
  });
  
  // 4. A/B 테스트
  test('should split users for A/B test', async () => {
    const campaign = await sendCampaignAB('campaign-ab');
    const messagesA = await getMessagesByVariant('campaign-ab', 'A');
    const messagesB = await getMessagesByVariant('campaign-ab', 'B');
    expect(messagesA.length).toBeCloseTo(messagesB.length, 1);
  });
});
```

#### 1-5-2: 배포 (1시간)
```bash
# 1. 마이그레이션 실행
npx prisma migrate deploy

# 2. 빌드
npm run build

# 3. 테스트
npm test

# 4. 커밋
git add .
git commit -m "feat(menu25): 마케팅 자동화 Phase 1 완성 - 캠페인 CRUD + 배치 발송 + 추적"

# 5. PR 생성 (또는 직접 push)
git push origin main
```

---

## 📊 예상 일정

| Phase | 작업 | 시간 | 예상 완료 |
|-------|------|------|---------|
| 1-1 | DB & API 기초 | 4시간 | Day 1 오후 |
| 1-2 | UI 개발 | 6시간 | Day 2 오후 |
| 1-3 | 메시지 채널 | 8시간 | Day 3 오후 |
| 1-4 | 추적 & 분석 | 4시간 | Day 4 오전 |
| 1-5 | 테스트 & 배포 | 3시간 | Day 4 오후 |
| **총계** | | **25시간** | **3-4일** |

---

## 🔗 메뉴 체인 연결 (다음)

Menu #25 완성 후:
1. Menu #26 마케팅 대시보드 (Menu #25 데이터 활용)
2. Menu #27 랜딩 매출관리 (ROI 연결)
3. Menu #28 문자 CRM (SMS 강화)
4. Menu #29 예약 발송 (스케줄 관리)
5. Menu #30 발송 기록 (이력 조회)

---

## 📁 파일 목록

### 신규 생성
```
src/app/api/marketing/
├── campaigns/
│   ├── route.ts               (POST/GET)
│   ├── [id]/
│   │   ├── route.ts           (GET/PATCH/DELETE)
│   │   ├── send/route.ts      (POST - 발송)
│   │   └── track/route.ts     (GET - 추적)
│   ├── templates/route.ts     (SMS 템플릿)
│   └── channels/
│       ├── sms.ts
│       ├── email.ts
│       └── kakao.ts (선택)

src/app/(dashboard)/marketing/
├── page.tsx                   (목록)
├── new/page.tsx              (생성 폼)
└── [id]/
    └── page.tsx              (상세 + 추적)

src/components/marketing/
├── CampaignForm.tsx
├── CampaignList.tsx
├── MessageEditor.tsx
├── ScheduleSelector.tsx
├── TrackingDashboard.tsx
└── hooks/
    └── useCampaigns.ts

src/lib/marketing/
├── campaigns.ts              (비즈니스 로직)
├── sms.ts                    (SMS 발송)
├── email.ts                  (Email 발송)
├── landing-link.ts           (링크 추적)
└── batch.ts                  (배치 처리)

tests/
└── marketing.test.ts
```

### 수정
```
prisma/schema.prisma           (CrmMarketingMessage 추가)
src/types/marketing.ts         (타입 정의)
```

---

## ✅ 최종 체크

- [ ] DB 마이그레이션 완료
- [ ] API 5개 구현 완료
- [ ] UI 4개 페이지 완료
- [ ] 메시지 채널 3개 구현 완료
- [ ] 추적 대시보드 구현 완료
- [ ] 100명 테스트 완료
- [ ] 모든 테스트 통과
- [ ] 커밋 + PR

---

**준비 완료. Menu #25 시작하시겠습니까? 👉**
