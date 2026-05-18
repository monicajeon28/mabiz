# 🎯 마케팅 자동화 (Menu #25) 전체 기능 맵

**작성일:** 2026-05-18  
**대상:** Menu #25 마케팅 자동화 (메뉴 #26-30 포함한 통합 마케팅 스택)  
**상태:** Phase 1 기획 단계  
**참고:** [작업지시서_B2C구매퍼널_마케팅자동화_20260516.md](작업지시서_B2C구매퍼널_마케팅자동화_20260516.md)

---

## 📊 마케팅 자동화 전체 맥락

### 메뉴 체인 (Menu #25-30)
```
Menu #25: 마케팅 자동화      (핵심 엔진 — 캠페인 자동화)
Menu #26: 마케팅 대시보드    (분석 & 리포팅)
Menu #27: 랜딩 매출관리      (랜딩 성과 추적)
Menu #28: 문자 CRM          (SMS 중심 자동화)
Menu #29: 예약 발송         (스케줄 관리)
Menu #30: 발송 기록         (이력 조회)
```

### 메뉴 #25의 역할
- **고객 그룹별** 자동 메시지 발송 (SMS/Email/KakaoTalk)
- **조건 기반** 캠페인 트리거 (예: 구매 후 3일, 생일 당월 등)
- **A/B 테스트** 자동화
- **추적 & 최적화** 기초 데이터 수집

---

## 🏗️ Phase 1: 퍼널 설계 (캠페인 템플릿)

### 1.1 퍼널 템플릿 (선택 기능 → Phase 2로 이동 가능)

**필수 기능:**
- [ ] **템플릿 선택 UI** (드롭다운 또는 카드)
  - VIP 고객 재발주 유도
  - 신규 고객 온보딩
  - 휴면 고객 복구
  - 구매 후 후속 관리
  - 기타 (사용자 정의)

**선택 기능:**
- [ ] 템플릿 세부 커스터마이징 (Phase 2+)
  - 메시지 본문 수정
  - 스케줄 변경
  - 조건 추가

**의존성:**
- ContactGroup (고객 그룹 모델)
- CrmMarketingCampaign (DB)

**예상 시간:** 2시간  
**복잡도:** 낮음

**구현 전략:**
```typescript
// /src/types/marketing.ts
export interface CampaignTemplate {
  id: string;
  name: '신규고객' | 'VIP재발주' | '휴면복구' | 'CUSTOM';
  description: string;
  defaultMessageChannels: ('EMAIL' | 'SMS' | 'KAKAO')[];
  stages: CampaignStage[];
  createdAt: Date;
}

export interface CampaignStage {
  name: string;              // 예: "Day 0 - 환영 메시지"
  daysAfterTrigger: number;  // 구매/가입 후 N일
  condition?: string;        // 예: "status == 'ACTIVE'"
  messages: CampaignMessage[];
}
```

---

### 1.2 스테이지 정의 (고객 여정 맵핑)

**필수 기능:**
- [ ] **타임라인 구성** (Day -150 ~ Day +365)
  - Day -150: 예비 고객 (마케팅 획득)
  - Day 0: 구매/가입 (트리거)
  - Day +1 to Day +30: 온보딩 (초기 관계 구축)
  - Day +31 to Day +180: 유지 (정기 메시지)
  - Day +181 to Day +365: 재발주 유도 (재구매 캠페인)

**선택 기능:**
- [ ] 스테이지별 조건 필터링 (Phase 2)
  - 구매 금액 기준
  - 회원 등급 기준
  - 지역/카테고리 기준

**의존성:**
- Contact (고객 모델의 createdAt, lastPurchaseAt, status)
- Reservation/Trip (구매 이력)

**예상 시간:** 1.5시간  
**복잡도:** 낮음

**구현:**
```typescript
// 타임라인 상수
export const TIMELINE_STAGES = {
  PRE_PURCHASE: { min: -150, max: -1 },
  PURCHASE_DAY: { min: 0, max: 0 },
  ONBOARDING: { min: 1, max: 30 },
  RETENTION: { min: 31, max: 180 },
  REACTIVATION: { min: 181, max: 365 },
};

// DB: Contact.createdAt 기준으로 daysAfterSignup 계산
const daysElapsed = Math.floor(
  (Date.now() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24)
);
```

---

### 1.3 조건 설정 (세그먼테이션)

**필수 기능:**
- [ ] **고객 그룹 선택**
  - 기존 ContactGroup 활용
  - 드롭다운 UI

**선택 기능 (Phase 2+):**
- [ ] **동적 조건 빌더**
  - 예: `status == 'ACTIVE' AND lastPurchaseAt > 90days ago`
  - 예: `affiliate.commission > 100000 AND partner.status != 'SUSPENDED'`
  - SQL-like 쿼리 빌더

- [ ] **상품 카테고리 필터**
  - 예: "크루즈 구매자만"
  - 예: "호텔 구매자 제외"

- [ ] **구매 금액 대역별 세분화**
  - VIP (>= 500만원)
  - Gold (200~500만원)
  - Silver (50~200만원)

**의존성:**
- ContactGroup (고객 그룹)
- Reservation (구매 이력)
- Product (상품 카테고리)
- Partner/Affiliate (파트너사 정보)

**예상 시간:**
- 필수: 0.5시간
- 선택: 3시간 (Phase 2+)

**복잡도:** 중간 (필수) / 높음 (선택)

---

## 📧 Phase 2: 메시지 관리

### 2.1 SMS 작성/저장

**필수 기능:**
- [ ] **SMS 본문 입력창**
  - 최대 1000자 (연속 메시지 가능)
  - 변수 삽입 (예: `{고객명}`, `{일정}`)
  - 미리보기 (실제 폰 UI)
  - 발송 예상 비용 표시

- [ ] **템플릿 저장**
  - 자주 쓰는 문자 저장
  - 다시 사용 가능

**선택 기능 (Phase 2+):**
- [ ] **다국어 SMS** (영어, 중국어 등)
- [ ] **URL 단축** (bit.ly, custom short link)
- [ ] **클릭 추적** (UTM 파라미터 자동 생성)

**의존성:**
- OrgSmsConfig (SMS 설정)
- SmsTemplate (기존 테이블)
- CrmMarketingCampaign.smsBody (DB)

**예상 시간:**
- 필수: 2시간
- 선택: 2시간 (Phase 2+)

**복잡도:** 중간

**구현:**
```typescript
// POST /api/marketing/campaigns/[id]/messages
interface CreateMessageRequest {
  campaignId: string;
  channel: 'SMS' | 'EMAIL' | 'KAKAO';
  body: string;        // SMS: <= 1000자, Email: <= 5000자
  variables?: string[]; // {고객명}, {일정} 등
  saveAsTemplate?: boolean;
  templateName?: string;
}

// 변수 치환
const renderMessage = (template: string, customer: Contact) => {
  return template
    .replace('{고객명}', customer.name)
    .replace('{휴대폰}', customer.phone)
    .replace('{일정}', customer.nextTripDate || '미정');
};

// 비용 계산
const calculateSmsCost = (body: string) => {
  const byteLength = new TextEncoder().encode(body).length;
  const messageCount = Math.ceil(byteLength / 90); // 90자당 1건
  return messageCount * SMS_COST_PER_MESSAGE; // 20원/건
};
```

---

### 2.2 Email 작성/저장

**필수 기능:**
- [ ] **Email 제목 & 본문 입력**
  - 제목: 최대 100자
  - 본문: HTML 에디터 (WYSIWYG)
  - 변수 삽입
  - 미리보기 (PC/Mobile)

- [ ] **HTML 템플릿**
  - 기본 제공 템플릿 (Welcome, Reengagement 등)
  - 드래그 앤 드롭 빌더 (선택 사항, Phase 2+)

**선택 기능 (Phase 2+):**
- [ ] **첨부파일**
- [ ] **이메일 스케줄 최적화** (각 사용자 시간대별)

**의존성:**
- OrgEmailConfig (Email 설정)
- CrmMarketingCampaign.emailSubject, emailBody (DB)

**예상 시간:**
- 필수: 3시간
- 선택: 3시간 (Phase 2+)

**복잡도:** 중간 ~ 높음 (HTML 렌더링)

**구현:**
```typescript
// POST /api/marketing/messages/email
interface EmailMessageRequest {
  subject: string;      // <= 100자
  htmlBody: string;     // HTML
  variables?: Record<string, string>;
  headerImage?: string; // URL
  footerText?: string;
}

// Email 렌더링
const renderEmail = (template: string, customer: Contact) => {
  const html = `
    <html>
      <body style="font-family: sans-serif; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto;">
          ${template
            .replace(/{{name}}/g, customer.name)
            .replace(/{{email}}/g, customer.email)}
        </div>
      </body>
    </html>
  `;
  return html;
};
```

---

### 2.3 KakaoTalk 발송

**필수 기능:**
- [ ] **KakaoTalk 비즈니스 계정 연동**
  - 설정 페이지에서 API 키 입력
  - 테스트 발송

- [ ] **메시지 템플릿**
  - 텍스트 (최대 1000자)
  - 이미지 (선택)
  - 버튼 (최대 3개)

**선택 기능 (Phase 2+):**
- [ ] **카카오톡 친구 추가 자동화**
- [ ] **그룹 채팅방 생성 및 관리**

**의존성:**
- KakaoTalk Business API (외부)
- OrgKakaoConfig (새 테이블 필요)

**예상 시간:**
- 필수: 4시간 (카카오 API 학습 포함)
- 선택: 2시간 (Phase 2+)

**복잡도:** 높음 (외부 API 연동)

**구현:**
```typescript
// POST /api/marketing/channels/kakao/send
interface KakaoSendRequest {
  recipient: {
    phone: string;     // 010-1234-5678 형식
    kakaoId?: string;  // 카카오ID (선택)
  };
  messageType: 'TEXT' | 'TEMPLATE';
  content: string;
  buttons?: {
    label: string;
    type: 'WEB' | 'APP' | 'BIZMESSAGE';
    url?: string;
  }[];
}

// 카카오톡 API 호출
const sendKakaoMessage = async (req: KakaoSendRequest) => {
  const response = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      'Authorization': `Bearer ${org.kakaoAccessToken}`,
    },
  });
  // ...
};
```

---

### 2.4 템플릿 라이브러리

**필수 기능:**
- [ ] **템플릿 목록 페이지**
  - SMS 템플릿 (기존 SmsTemplate 활용)
  - Email 템플릿
  - KakaoTalk 템플릿

- [ ] **검색 & 필터**
  - 템플릿 이름
  - 카테고리 (신규, 재발주, 휴면 등)

**선택 기능:**
- [ ] **템플릿 공유** (조직 내 팀원간)
- [ ] **템플릿 성과 추적** (어느 템플릿이 효과적인가)

**의존성:**
- SmsTemplate (기존)
- 새 테이블: EmailTemplate, KakaoTemplate

**예상 시간:** 1.5시간  
**복잡도:** 낮음

---

## ⚙️ Phase 3: 자동화 규칙

### 3.1 스케줄 설정

**필수 기능:**
- [ ] **발송 방식 선택**
  - ◉ 지금 바로 발송
  - ○ 예약 발송 (날짜 & 시간)
  - ○ 반복 발송 (Cron)

- [ ] **예약 발송**
  - DatePicker + TimePicker
  - 시간대 최적화 (아침 9시, 오후 2시 등 권장)
  - 일일 발송 한도 알림

- [ ] **반복 발송 (CRON)**
  - UI: "매주 월요일 9시", "매월 1일", "매일 오후 2시"
  - 사용자 친화적 CRON 선택기

**의존성:**
- node-schedule (또는 별도 Job Queue)
- CrmMarketingCampaign.sendAt, repeatRule (DB)
- Redis (스케줄 큐 관리)

**예상 시간:**
- 필수: 2시간
- Cron UI: 1시간

**복잡도:** 중간

**구현:**
```typescript
// DB: CrmMarketingCampaign
{
  sendAt: '2026-05-18T09:00:00Z',      // 예약 발송 시간
  repeatRule: '0 9 * * 1',              // 매주 월요일 9시
  // CRON format: "minute hour day month dayOfWeek"
}

// 사용자 친화 UI
const CRON_PRESETS = {
  DAILY_9AM: '0 9 * * *',
  WEEKLY_MONDAY: '0 9 * * 1',
  MONTHLY_1ST: '0 9 1 * *',
  CUSTOM: null,
};

// 스케줄 실행 (Node.js + node-schedule)
import schedule from 'node-schedule';

const job = schedule.scheduleJob('0 9 * * *', async () => {
  const campaigns = await getCampaignsToRun();
  for (const campaign of campaigns) {
    await sendCampaign(campaign);
  }
});
```

---

### 3.2 A/B 테스트

**필수 기능:**
- [ ] **A/B 테스트 설정**
  - 그룹 A: 메시지 1 (50%)
  - 그룹 B: 메시지 2 (50%)
  - 비율 커스터마이징 (예: 70/30)

- [ ] **테스트 메트릭**
  - 열람율 비교
  - 클릭율 비교
  - 전환율 비교
  - 통계 신뢰도 표시

**선택 기능 (Phase 2+):**
- [ ] **다중 변수 테스트** (3개 이상)
- [ ] **자동 우승자 선택** (신뢰도 95% 도달 시 자동 전환)

**의존성:**
- CrmMarketingCampaign (AB variant 필드 추가)
- CrmMarketingMessage (variant 정보)

**예상 시간:**
- 필수: 2시간
- 선택: 2시간 (Phase 2+)

**복잡도:** 중간

**구현:**
```typescript
// DB: CrmMarketingCampaign
{
  isABTest: true,
  variantA: { title: 'Standard', splitPercentage: 50 },
  variantB: { title: 'Short URL', splitPercentage: 50 },
}

// 그룹 분배 (랜덤)
const assignVariant = (recipientId: string): 'A' | 'B' => {
  const hash = hashString(recipientId) % 100;
  return hash < 50 ? 'A' : 'B';
};

// A/B 결과 계산
const getABTestResults = async (campaignId: string) => {
  const variantA = await db.crmMarketingMessage.groupBy({
    by: ['variant'],
    where: { campaignId, variant: 'A' },
    _count: { id: true },
    _sum: { clicked: true, opened: true },
  });
  // ...
};
```

---

### 3.3 수신거부 자동 제외

**필수 기능:**
- [ ] **수신거부 리스트 관리**
  - OrgSmsConfig.optOutNumbers (이미 구현)
  - Email unsubscribe list
  - KakaoTalk 차단 고객

- [ ] **발송 전 자동 검증**
  - Contact.phoneOptOut = true 확인
  - Contact.emailOptOut = true 확인
  - 발송 대상에서 자동 제외

- [ ] **발송 실패 원인 로깅**
  - ExecutionFailureReason.OPT_OUT
  - ExecutionLog 기록

**의존성:**
- Contact (phoneOptOut, emailOptOut 필드)
- ExecutionLog (DB에 이미 구현)

**예상 시간:** 1시간  
**복잡도:** 낮음

**구현:**
```typescript
// Contact 모델에 필드 확인
const isValidRecipient = (contact: Contact, channel: 'SMS' | 'EMAIL') => {
  if (channel === 'SMS' && contact.phoneOptOut) return false;
  if (channel === 'EMAIL' && contact.emailOptOut) return false;
  return true;
};

// 발송 전 필터링
const sendCampaign = async (campaignId: string) => {
  const campaign = await getCampaign(campaignId);
  const group = await getGroupMembers(campaign.groupId);
  
  const validRecipients = group.filter(
    (contact) => isValidRecipient(contact, campaign.channel)
  );
  
  for (const recipient of validRecipients) {
    await sendMessage(recipient, campaign);
  }
};

// 수신거부자는 ExecutionLog에 로깅
const logExecution = (
  campaignId: string,
  recipientId: string,
  reason: ExecutionFailureReason
) => {
  db.executionLog.create({
    campaignId,
    recipientId,
    status: 'SKIPPED',
    reason,
  });
};
```

---

### 3.4 재시도 로직

**필수 기능:**
- [ ] **발송 실패 감지**
  - SMS API 타임아웃
  - Email 바운스
  - KakaoTalk API 오류

- [ ] **지수 백오프 재시도**
  - 1회차: 1초 후
  - 2회차: 2초 후
  - 3회차: 4초 후
  - 4회차 이후: 포기

- [ ] **최종 실패 알림**
  - 관리자에게 알림 메시지
  - ExecutionLog에 ABANDONED 기록

**의존성:**
- ExecutionLog (이미 구현)
- 메시지 큐 (Redis 또는 Bull)

**예상 시간:** 2시간  
**복잡도:** 중간

**구현:**
```typescript
// Bull (메시지 큐)을 사용한 재시도
import Bull from 'bull';

const sendQueue = new Bull('marketing-send');

const sendCampaign = async (campaignId: string) => {
  const recipients = await getRecipients(campaignId);
  
  for (const recipient of recipients) {
    await sendQueue.add(
      {
        campaignId,
        recipientId: recipient.id,
        attempt: 0,
      },
      {
        attempts: 4,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  }
};

sendQueue.process(async (job) => {
  const { campaignId, recipientId, attempt } = job.data;
  
  try {
    await sendMessage(recipientId, campaignId);
    await logExecution(campaignId, recipientId, 'SENT');
  } catch (error) {
    if (attempt >= 3) {
      await logExecution(campaignId, recipientId, 'SYSTEM_ERROR');
      await notifyAdmin(`발송 실패: ${recipientId}`);
    }
    throw error; // Bull이 재시도 처리
  }
});
```

---

## 📊 Phase 4: 대시보드 & 분석

### 4.1 발송 현황

**필수 기능:**
- [ ] **실시간 발송 상태 표시**
  - 총 대상: 1,000명
  - 발송 완료: 950명 (95%)
  - 발송 실패: 30명 (3%)
  - 대기 중: 20명 (2%)

- [ ] **진행률 표시 (Progress Bar)**
  - 시각적 진행률 (퍼센트 바)
  - 예상 완료 시간

- [ ] **상태별 필터링**
  - "발송 완료만", "실패만", "대기 중" 등

**의존성:**
- ExecutionLog (발송 상태 기록)
- WebSocket (실시간 갱신, 선택 사항)

**예상 시간:** 1.5시간  
**복잡도:** 낮음

**구현:**
```typescript
// GET /api/marketing/campaigns/[id]/stats
interface CampaignStats {
  totalCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  openedCount: number;
  clickedCount: number;
}

const getCampaignStats = async (campaignId: string) => {
  const logs = await db.executionLog.findMany({
    where: { campaignId },
  });
  
  return {
    totalCount: logs.length,
    sentCount: logs.filter(l => l.status === 'SENT').length,
    failedCount: logs.filter(l => l.status === 'FAILED').length,
    pendingCount: logs.filter(l => l.status === 'PENDING').length,
    openedCount: logs.filter(l => l.openedAt).length,
    clickedCount: logs.filter(l => l.clickedAt).length,
  };
};
```

---

### 4.2 열람률 / 클릭률

**필수 기능:**
- [ ] **이메일 열람 추적**
  - 1x1 픽셀 이미지 (invisible tracker)
  - 클릭 시 OpenedAt 기록
  - 열람율 = openedCount / sentCount

- [ ] **링크 클릭 추적**
  - UTM 파라미터 자동 생성
  - 클릭 시 ClickedAt 기록
  - 클릭율 = clickedCount / sentCount

- [ ] **채널별 비교**
  - SMS 클릭율
  - Email 열람율
  - KakaoTalk 클릭율

**의존성:**
- CrmMarketingMessage (emailOpenedAt, linkClickedAt)
- UTM 파라미터 자동 생성
- 단축 URL 서비스

**예상 시간:** 2시간  
**복잡도:** 중간

**구현:**
```typescript
// 이메일 열람 추적 (1x1 픽셀)
const getEmailTracker = (messageId: string) => {
  return `<img src="https://api.crm.com/track/email/${messageId}.gif" 
    width="1" height="1" style="display:none;" alt="" />`;
};

// 링크 클릭 추적 (UTM)
const appendUTM = (url: string, campaignId: string, variant: string) => {
  const utm = new URLSearchParams({
    utm_source: 'crm',
    utm_medium: 'email',
    utm_campaign: campaignId,
    utm_content: variant,
  });
  return `${url}?${utm}`;
};

// 단축 URL 생성 및 추적
const createShortLink = async (longUrl: string, campaignId: string) => {
  const shortLink = await db.shortLink.create({
    data: {
      longUrl,
      campaignId,
      clickCount: 0,
    },
  });
  return `https://crm.io/${shortLink.slug}`;
};

// /api/track/[slug] — 클릭 추적
const trackClick = async (slug: string) => {
  const link = await db.shortLink.findUnique({ where: { slug } });
  await db.shortLink.update({
    where: { id: link.id },
    data: { clickCount: { increment: 1 } },
  });
  return link.longUrl; // 원본 URL로 리다이렉트
};
```

---

### 4.3 전환율 추적

**필수 기능:**
- [ ] **랜딩 페이지 도착 추적**
  - 클릭 → 랜딩 페이지 도착 = 전환 1단계
  - 랜딩 페이지에서 "신청하기" = 전환 2단계

- [ ] **전환율 계산**
  - 1단계: clickedCount / sentCount
  - 2단계: registeredCount / clickedCount
  - 최종: registeredCount / sentCount

- [ ] **구매 추적** (선택 사항)
  - 랜딩 → 구매 가능성 측정

**의존성:**
- CrmLandingRegistration (기존)
- CrmMarketingMessage.registeredAt (DB에 추가)

**예상 시간:** 2시간  
**복잡도:** 중간

**구현:**
```typescript
// GET /api/marketing/campaigns/[id]/conversion
interface ConversionMetrics {
  clickThroughRate: number;      // % (클릭 / 발송)
  conversionRate: number;        // % (신청 / 클릭)
  overallConversionRate: number; // % (신청 / 발송)
}

const getConversionMetrics = async (campaignId: string) => {
  const stats = await getCampaignStats(campaignId);
  
  const clickThroughRate = (stats.clickedCount / stats.sentCount) * 100;
  const conversionRate = (stats.registeredCount / stats.clickedCount) * 100;
  const overallConversionRate = (stats.registeredCount / stats.sentCount) * 100;
  
  return {
    clickThroughRate,
    conversionRate,
    overallConversionRate,
  };
};
```

---

### 4.4 최적화 제안

**선택 기능 (Phase 2+):**
- [ ] **AI 기반 추천**
  - "오후 2시 발송이 열람율 20% 더 높음"
  - "이 템플릿이 클릭율 30% 더 높음"
  - "수요일 발송이 가장 효과적"

- [ ] **자동 최적화**
  - 동일 캠페인 반복 시 자동 적용
  - A/B 테스트 우승자 자동 선택

**의존성:**
- 머신러닝 모델 (복잡)
- 충분한 데이터 축적 필요

**예상 시간:** 4시간+  
**복잡도:** 높음

---

## 🤝 Phase 5: 파트너 & 통합

### 5.1 파트너별 세그먼트

**필수 기능:**
- [ ] **파트너사별 캠페인 격리**
  - 파트너 A: 자신의 그룹만 보임
  - 파트너 B: 자신의 그룹만 보임

- [ ] **권한 관리**
  - OWNER: 모든 캠페인 관리
  - MANAGER: 자신의 팀 캠페인만 관리
  - READ_ONLY: 조회만 가능

**선택 기능 (Phase 2+):**
- [ ] **크로스 파트너 캠페인**
  - "여러 파트너사를 포함한 고객 그룹 발송"

**의존성:**
- Organization (파트너 정보)
- OrganizationMember.role (권한 정보)
- ContactGroup.organizationId (파트너 소속)

**예상 시간:** 1시간  
**복잡도:** 낮음

**구현:**
```typescript
// GET /api/marketing/campaigns (필터링)
const getCampaigns = async (organizationId: string, userRole: string) => {
  if (userRole === 'OWNER') {
    // 모든 캠페인 조회
    return db.crmMarketingCampaign.findMany({
      where: { organizationId },
    });
  } else if (userRole === 'MANAGER') {
    // 자신의 팀이 생성한 캠페인만
    return db.crmMarketingCampaign.findMany({
      where: {
        organizationId,
        createdBy: {
          in: await getTeamMemberIds(organizationId),
        },
      },
    });
  }
};
```

---

### 5.2 크루즈닷몰 데이터 연동

**필수 기능:**
- [ ] **구매 이력 자동 동기화**
  - 크루즈닷몰에서 구매 → CRM Contact.lastPurchaseAt 업데이트
  - 자동 캠페인 트리거 (예: 구매 후 3일, "후기 달아주세요")

- [ ] **고객 정보 양방향 동기화**
  - CRM에서 고객 수정 → 크루즈닷몰 업데이트
  - 크루즈닷몰에서 고객 수정 → CRM 업데이트

**선택 기능 (Phase 2+):**
- [ ] **구매 금액 기반 자동 세분화**
  - VIP (구매 > 500만원) 자동 그룹화
  - 신규 고객 자동 감지

**의존성:**
- Webhook (크루즈닷몰 → CRM)
- Reservation/Trip (구매 이력)
- 기존 웹훅 인프라

**예상 시간:** 2시간 (웹훅 이미 구축)  
**복잡도:** 중간

**구현:**
```typescript
// POST /api/webhooks/cruisedot/purchase
// 크루즈닷몰에서 구매 발생 시 호출
const handlePurchaseWebhook = async (req: Request) => {
  const { reservationId, customerId, totalAmount } = req.body;
  
  // CRM Contact 업데이트
  const contact = await db.contact.findFirst({
    where: { externalId: customerId },
  });
  
  await db.contact.update({
    where: { id: contact.id },
    data: {
      lastPurchaseAt: new Date(),
      totalPurchase: {
        increment: totalAmount,
      },
    },
  });
  
  // 자동 캠페인 트리거
  await triggerAutomation({
    type: 'PURCHASE',
    contactId: contact.id,
    daysAfter: 3, // 구매 후 3일
  });
};
```

---

### 5.3 외부 API 통합 (SMS/Email/KakaoTalk)

**필수 기능:**
- [ ] **Aligo SMS API** (이미 구현)
  - OrgSmsConfig.aligoKey, aligoUserId 사용
  - 발송 실패 시 에러 핸들링

- [ ] **이메일 서비스**
  - Neon 자체 메일 서버 또는 SendGrid
  - 설정: OrgEmailConfig.provider, apiKey

- [ ] **KakaoTalk Business API**
  - 설정: OrgKakaoConfig.businessAccountId, accessToken
  - 템플릿 관리

**의존성:**
- OrgSmsConfig, OrgEmailConfig, OrgKakaoConfig
- 외부 API 클라이언트

**예상 시간:** 3시간 (SMS만), 2시간 (Email), 4시간 (KakaoTalk)  
**복잡도:** 높음

---

## 📈 예상 영향 & 비용

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 그룹별 메시지 자동화 | ❌ 불가능 | ✅ 가능 | **자동화 도입** |
| 발송 속도 (5000명) | 300초 | 50초 | **6배 개선** |
| 마케팅 추적 | 없음 | 완전 추적 | **데이터 기반 결정** |
| 반복 캠페인 | 수동 | 자동 (CRON) | **업무 시간 50% 절감** |
| A/B 테스트 | 불가능 | 자동화 | **최적화 자동화** |

**SMS 비용 추정:**
- Aligo: 건당 20원
- 월 1000명 × 2회 발송 = 40,000원
- 연간: 480,000원

**이메일 비용:** 거의 무료 (자체 서버)

**KakaoTalk 비용:** 월 100,000원 ~ (Business Account 라이선스)

---

## ✅ 완료 체크리스트

### Phase 1: 퍼널 설계 (필수 기능)
- [ ] 1.1 퍼널 템플릿 선택 UI
- [ ] 1.2 스테이지 타임라인 (Day -150 ~ +365)
- [ ] 1.3 고객 그룹 선택 기본 조건

### Phase 2: 메시지 관리 (필수 기능)
- [ ] 2.1 SMS 작성/저장 (SmsTemplate 활용)
- [ ] 2.2 Email 작성/저장 (HTML 에디터)
- [ ] 2.3 KakaoTalk 발송 기본 (선택)
- [ ] 2.4 템플릿 라이브러리 조회

### Phase 3: 자동화 규칙 (필수 기능)
- [ ] 3.1 스케줄 설정 (지금/예약/반복)
- [ ] 3.2 A/B 테스트 기본 (50/50 분할)
- [ ] 3.3 수신거부 자동 제외
- [ ] 3.4 재시도 로직 (지수 백오프)

### Phase 4: 대시보드 & 분석 (필수 기능)
- [ ] 4.1 발송 현황 실시간 표시
- [ ] 4.2 열람율 / 클릭율
- [ ] 4.3 전환율 추적
- [ ] 4.4 최적화 제안 (선택, Phase 2+)

### Phase 5: 파트너 & 통합 (필수 기능)
- [ ] 5.1 파트너별 세그먼트 (권한 격리)
- [ ] 5.2 크루즈닷몰 데이터 연동
- [ ] 5.3 외부 API 통합 (Aligo/Email/Kakao)

### 테스트 & 배포
- [ ] 100명 테스트 캠페인
- [ ] 성능 테스트 (5000명 발송)
- [ ] 에러 핸들링 검증
- [ ] 권한 제어 검증
- [ ] 커밋 + PR

---

## 🛠️ 구현 로드맵

### **총 예상 시간: 25 ~ 35시간**

**Phase 1: 퍼널 설계** (4시간)
- 1.1 템플릿 UI: 2시간
- 1.2 타임라인: 1.5시간
- 1.3 기본 조건: 0.5시간

**Phase 2: 메시지 관리** (8시간)
- 2.1 SMS: 2시간
- 2.2 Email: 3시간
- 2.3 KakaoTalk: 2시간
- 2.4 템플릿 라이브러리: 1시간

**Phase 3: 자동화 규칙** (7시간)
- 3.1 스케줄: 2시간
- 3.2 A/B 테스트: 2시간
- 3.3 수신거부 제외: 1시간
- 3.4 재시도 로직: 2시간

**Phase 4: 대시보드 & 분석** (5시간)
- 4.1 발송 현황: 1.5시간
- 4.2 열람/클릭: 2시간
- 4.3 전환율: 1시간
- 4.4 최적화 (선택): 2시간+

**Phase 5: 파트너 & 통합** (4시간)
- 5.1 파트너 세그먼트: 1시간
- 5.2 크루즈닷몰 연동: 2시간
- 5.3 외부 API: 3시간

**테스트 & 배포** (2시간)

---

## 📚 관련 문서

- [작업지시서_B2C구매퍼널_마케팅자동화_20260516.md](작업지시서_B2C구매퍼널_마케팅자동화_20260516.md)
- [project_crm_menu_order.md](C:\Users\user\.claude\projects\D--mabiz-crm\memory\project_crm_menu_order.md) — 메뉴 25-30 체인
- [Prisma Schema](prisma/schema.prisma) — CrmMarketingCampaign, ExecutionLog

---

**다음 단계:**
1. Phase 1 (퍼널 설계) 구현 시작
2. DB 마이그레이션 (필드 추가: emailOpenedAt, linkClickedAt 등)
3. API 개발 (캠페인 CRUD, 발송, 추적)
4. UI 개발 (캠페인 생성 폼, 대시보드)
5. 통합 테스트 및 배포
