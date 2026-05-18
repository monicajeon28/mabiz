# 📱 마케팅 자동화 통합 스택 (Menu #25-30)

**작성일:** 2026-05-18  
**대상:** Menu #25 ~ #30 (6개 메뉴 연쇄 작업)  
**현황:** 각 메뉴별 상세 스펙 및 의존성 맵

---

## 🗺️ 메뉴 체인 아키텍처

```
Menu #25: 마케팅 자동화 (핵심)
    ↓ (데이터 제공)
Menu #26: 마케팅 대시보드 (분석)
    ↓ (랜딩 성과)
Menu #27: 랜딩 매출관리 (ROI 추적)
    ↓ (발송 기록)
Menu #28: 문자 CRM (SMS 중심)
Menu #29: 예약 발송 (스케줄)
Menu #30: 발송 기록 (이력)
```

---

## 📌 Menu #25: 마케팅 자동화 (핵심 엔진)

**역할:** 고객 그룹별 자동 메시지 캠페인 생성 & 관리

### 핵심 기능 (Phase 1 - 필수)
```
1. 캠페인 생성 폼
   - 그룹 선택
   - 메시지 채널 선택 (SMS/Email/KakaoTalk)
   - 스케줄 설정 (지금/예약/반복)
   - 저장 & 발송

2. 캠페인 목록
   - 상태별 필터 (초안/예약/발송완료/실패)
   - 검색 (캠페인명)
   - 수정/삭제

3. 상세 페이지
   - 캠페인 정보 + 메시지 내용
   - 발송 상태 (실시간)
   - 취소 버튼
```

### DB 모델
```prisma
model CrmMarketingCampaign {
  id               String       @id @default(cuid())
  organizationId   String
  groupId          String
  title            String       # "5월 VIP 재발주"
  
  # 메시지
  channels         String[]     # ["SMS", "EMAIL"]
  sendEmail        Boolean      @default(false)
  emailSubject     String?
  emailBody        String?
  sendSms          Boolean      @default(false)
  smsBody          String?
  includeLanding   Boolean      @default(false)
  landingUrl       String?
  
  # 스케줄
  sendAt           DateTime
  repeatRule       String?      # CRON
  
  # 상태
  status           String       # DRAFT|SCHEDULED|SENT|FAILED
  sentCount        Int          @default(0)
  failedCount      Int          @default(0)
  
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  
  @@index([organizationId, status])
}

model CrmMarketingMessage {
  id              String       @id @default(cuid())
  campaignId      String
  recipientId     String
  
  # 상태
  status          ExecutionStatus # SENT|FAILED|SKIPPED
  failureReason   ExecutionFailureReason?
  
  # 추적
  sentAt          DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  registeredAt    DateTime?
  
  @@unique([campaignId, recipientId])
}
```

### API 엔드포인트
```
POST   /api/marketing/campaigns              # 캠페인 생성
GET    /api/marketing/campaigns              # 목록 (필터링)
GET    /api/marketing/campaigns/[id]         # 상세
PATCH  /api/marketing/campaigns/[id]         # 수정
DELETE /api/marketing/campaigns/[id]         # 삭제
POST   /api/marketing/campaigns/[id]/send    # 발송 (배치 처리)
GET    /api/marketing/campaigns/[id]/track   # 추적 데이터
```

### 예상 시간: 8시간
### 복잡도: 중간

---

## 📊 Menu #26: 마케팅 대시보드 (분석)

**역할:** 캠페인 성과 분석 및 최적화 인사이트

### 핵심 기능
```
1. 캠페인별 성과 지표
   - 발송 수 / 성공 수 / 실패 수
   - 열람율 (%)
   - 클릭율 (%)
   - 전환율 (%)
   - ROI (예상)

2. 차트 & 시각화
   - 시간대별 성과 (선 그래프)
   - 채널별 비교 (막대 그래프)
   - A/B 테스트 결과 (비교 표)

3. 추천 인사이트
   - "오후 2시 발송이 20% 더 효과적"
   - "SMS가 Email보다 30% 높은 클릭율"
   - "월요일 발송이 가장 좋음"
```

### DB 활용
```
읽기 대상:
- CrmMarketingCampaign (캠프인 정보)
- CrmMarketingMessage (발송/열람/클릭)
- ExecutionLog (실패 원인)

필요 인덱스:
- (campaignId, status)
- (campaignId, openedAt)
- (campaignId, clickedAt)
```

### API 엔드포인트
```
GET  /api/marketing/dashboard/stats       # 전체 통계
GET  /api/marketing/dashboard/campaigns   # 캠페인별 성과
GET  /api/marketing/dashboard/channels    # 채널별 비교
GET  /api/marketing/dashboard/timeline    # 시간대별 성과
GET  /api/marketing/dashboard/insights    # AI 추천
```

### 예상 시간: 6시간
### 복잡도: 중간

---

## 💰 Menu #27: 랜딩 매출관리 (ROI 추적)

**역할:** 마케팅 캠페인의 실제 매출 연동

### 핵심 기능
```
1. 캠페인 → 랜딩 → 매출 추적
   - 클릭 → 랜딩 도착
   - 랜딩 → 신청
   - 신청 → 예약 (구매)
   - 예약 → 실제 매출

2. 매출 기여도 계산
   - Campaign A 클릭 = 100건
   - Campaign A 신청 = 50건
   - Campaign A 매출 = 2,000만원
   - ROI = 2000 / (SMS비용) = 400배

3. 채널별 ROI 비교
   - SMS ROI: 400배
   - Email ROI: 200배
   - KakaoTalk ROI: 300배
```

### DB 연동
```
CrmMarketingMessage
  └─ linkClickedAt
  └─ registeredAt (CrmLandingRegistration 연결)
  └─ reservationId (구매 매칭)

필요 조인:
- CrmMarketingMessage → CrmLandingRegistration
- CrmLandingRegistration → Reservation (구매)
- Reservation → totalAmount (매출)
```

### API 엔드포인트
```
GET  /api/marketing/campaigns/[id]/revenue     # 캠페인별 매출
GET  /api/marketing/campaigns/[id]/roi         # ROI 계산
GET  /api/marketing/dashboard/channel-roi      # 채널별 ROI
```

### 예상 시간: 4시간
### 복잡도: 중간 (DB 조인 복잡)

---

## 📱 Menu #28: 문자 CRM (SMS 중심)

**역할:** SMS 기반 고객 접점 관리 (기존 문자 CRM 개선)

### 핵심 기능
```
1. SMS 탭 강화
   - 고객별 받은 문자 / 보낸 문자 분리
   - 문자 발송 기록 (시간, 내용)
   - 회신 메시지 추적
   - 수신거부 관리

2. 빠른 발송 (Quick Send)
   - 고객 선택 → SMS 입력 → 발송
   - 템플릿 선택 가능
   - 발송 이력 자동 저장

3. SMS 설정
   - 발신자 번호 관리
   - 수신거부 키워드 설정
   - 일일 발송 한도 설정
```

### DB 모델
```
# 기존 ScheduledSms 확대
model ScheduledSms {
  # 기존 필드 유지
  id              String
  organizationId  String
  recipientId     String
  content         String
  
  # 추가
  categoryTag     String?     # 'CAMPAIGN', 'MANUAL', 'REPLY'
  campaignId      String?     # 캠페인 출처
  sentAt          DateTime?
  deliveredAt     DateTime?
  bounced         Boolean     @default(false)
  
  @@index([organizationId, recipientId, createdAt])
}
```

### 예상 시간: 3시간
### 복잡도: 낮음 (기존 기능 확장)

---

## ⏰ Menu #29: 예약 발송 (스케줄 관리)

**역할:** 캠페인 발송 시간 관리 및 자동 실행

### 핵심 기능
```
1. 예약 캠페인 관리
   - 예약된 캠페인 목록
   - 발송 시간 변경
   - 취소

2. 발송 스케줄러 대시보드
   - 오늘의 예정 발송
   - 내일의 예정 발송
   - 진행 중인 발송

3. CRON 기반 반복 설정
   - 매일 오전 9시
   - 매주 월요일
   - 매달 1일
   - 커스텀 CRON
```

### 기술 구현
```
Node.js + node-schedule (또는 Redis Bull)

# 예약 캠페인 확인 및 발송
import schedule from 'node-schedule';

schedule.scheduleJob('0 9 * * *', async () => {
  const campaigns = await db.crmMarketingCampaign.findMany({
    where: {
      status: 'SCHEDULED',
      sendAt: { lte: new Date() },
    },
  });
  
  for (const campaign of campaigns) {
    await sendCampaign(campaign.id);
  }
});
```

### API 엔드포인트
```
GET  /api/marketing/scheduled        # 예약 캠페인 목록
PATCH /api/marketing/scheduled/[id]  # 발송 시간 변경
DELETE /api/marketing/scheduled/[id] # 취소
```

### 예상 시간: 2시간
### 복잡도: 낮음 (CrmMarketingCampaign에 이미 sendAt, repeatRule 필드 있음)

---

## 📋 Menu #30: 발송 기록 (이력 조회)

**역할:** 모든 발송 이력 조회 및 진단

### 핵심 기능
```
1. 발송 기록 목록
   - 캠페인명
   - 발송 시간
   - 대상 수 / 성공 수 / 실패 수
   - 채널 (SMS/Email/KakaoTalk)

2. 발송 실패 분석
   - 실패 원인 분류 (OPT_OUT, INVALID, PROVIDER_ERROR)
   - 실패 건수별 정렬
   - 고객 목록 (재발송 가능)

3. 상세 기록 조회
   - 고객별 발송 상태
   - 발송/열람/클릭 시간
   - 에러 메시지 (관리자용)
```

### DB 활용
```
읽기 대상:
- CrmMarketingCampaign (캠페인 정보)
- CrmMarketingMessage (개별 발송 상태)
- ExecutionLog (실패 원인)

인덱스:
- (organizationId, campaignId, status)
- (organizationId, createdAt DESC)
```

### API 엔드포인트
```
GET  /api/marketing/history              # 발송 기록 목록
GET  /api/marketing/history/[id]         # 캠페인별 상세
GET  /api/marketing/history/failures     # 실패 분석
```

### 예상 시간: 2시간
### 복잡도: 낮음

---

## 🔗 메뉴 간 데이터 흐름

```
Menu #25 (마케팅 자동화)
    ↓ 캠페인 생성 & 발송
    ↓
Menu #26 (마케팅 대시보드)
    ↓ 성과 분석
    ↓ (연결: CrmMarketingMessage.clickedAt → CrmLandingRegistration)
    ↓
Menu #27 (랜딩 매출관리)
    ↓ ROI 계산
    ↓
Menu #28 (문자 CRM)
    ↓ SMS 상세 기록
    ↓ (데이터 기여: ScheduledSms)
    ↓
Menu #29 (예약 발송)
    ↓ 스케줄 관리
    ↓ (데이터 기여: CrmMarketingCampaign.sendAt, repeatRule)
    ↓
Menu #30 (발송 기록)
    ↓ 이력 조회
```

---

## ✅ 통합 의존성 체크리스트

### DB 테이블 (기존 + 신규)

**기존 (이미 있음):**
- [x] Organization
- [x] Contact
- [x] ContactGroup
- [x] CrmMarketingCampaign (기본 필드)
- [x] CrmLandingPage
- [x] CrmLandingRegistration
- [x] ScheduledSms
- [x] SmsTemplate
- [x] ExecutionLog
- [x] OrgSmsConfig
- [x] OrgEmailConfig
- [x] Reservation, Trip

**신규 (추가 필요):**
```prisma
# CrmMarketingMessage (개별 메시지 추적)
model CrmMarketingMessage {
  id              String
  campaignId      String
  recipientId     String
  status          ExecutionStatus
  sentAt          DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  registeredAt    DateTime?
  variant         String?  # A/B 테스트용
  @@unique([campaignId, recipientId])
}

# EmailTemplate (Email 템플릿)
model EmailTemplate {
  id              String
  organizationId  String
  name            String
  subject         String
  htmlBody        String
  variables       String[]
  createdAt       DateTime
  updatedAt       DateTime
  @@unique([organizationId, name])
}

# KakaoTemplate (KakaoTalk 템플릿)
model KakaoTemplate {
  id              String
  organizationId  String
  name            String
  content         String
  buttons         Json[]
  createdAt       DateTime
  @@unique([organizationId, name])
}

# OrgKakaoConfig (KakaoTalk 설정)
model OrgKakaoConfig {
  id              String
  organizationId  String @unique
  businessAccountId String
  accessToken     String
  isActive        Boolean @default(true)
}
```

### 외부 API

**필수:**
- [x] Aligo SMS API (OrgSmsConfig)
- [ ] Email Service (SendGrid 또는 자체)

**선택 (Phase 2+):**
- [ ] KakaoTalk Business API
- [ ] Google Analytics (크루즈닷몰 추적)

### 인프라

**필수:**
- [x] Node.js + Next.js
- [x] Prisma ORM
- [ ] Job Queue (node-schedule 또는 Redis Bull)
- [ ] Webhook 수신 (크루즈닷몰 → CRM)

### 권한 & 보안

**필수:**
- [x] 조직 격리 (organizationId)
- [x] 역할 기반 접근 (OWNER/MANAGER/READ_ONLY)
- [ ] 개인정보 마스킹 (발송 로그)
- [ ] 감시 로그 (모든 발송 기록 보존)

---

## 📊 전체 구현 로드맵

| Menu | 메뉴명 | Phase | 필수 기능 | 선택 기능 | 예상 시간 | 복잡도 | 의존성 |
|------|--------|-------|---------|---------|---------|--------|--------|
| #25 | 마케팅 자동화 | 1 | ✅ 캠페인 CRUD, 배치 발송 | A/B 테스트 | 8시간 | 중간 | CrmMarketingCampaign |
| #26 | 마케팅 대시보드 | 1 | ✅ 성과 차트, 분석 | AI 추천 | 6시간 | 중간 | #25 데이터 |
| #27 | 랜딩 매출관리 | 1 | ✅ ROI 추적, 채널별 비교 | 셀만 분석 | 4시간 | 중간 | #26 데이터 |
| #28 | 문자 CRM | 1 | ✅ SMS 기록, 빠른 발송 | 회신 추적 | 3시간 | 낮음 | ScheduledSms |
| #29 | 예약 발송 | 1 | ✅ 스케줄 관리, CRON | 자동 최적화 | 2시간 | 낮음 | #25 데이터 |
| #30 | 발송 기록 | 1 | ✅ 이력 조회, 실패 분석 | 재발송 자동화 | 2시간 | 낮음 | ExecutionLog |

**총 예상 시간: 25시간**

---

## 🚀 순서 (의존성 고려)

### Round 1: 기초 (병렬)
1. Menu #25 마케팅 자동화 (8시간)
   - DB: CrmMarketingCampaign 강화
   - API: 캠페인 CRUD
   - UI: 캠페인 생성 폼
   - 핵심: 배치 발송 엔진

### Round 2: 분석 (병렬)
2. Menu #26 마케팅 대시보드 (6시간)
   - Menu #25 데이터 활용
   - 차트 라이브러리 (recharts)
   - 실시간 갱신

3. Menu #30 발송 기록 (2시간)
   - Menu #25 이력 활용
   - 실패 분석

### Round 3: 확장 (병렬)
4. Menu #27 랜딩 매출관리 (4시간)
   - Menu #26 데이터 활용
   - ROI 계산

5. Menu #28 문자 CRM (3시간)
   - 기존 ScheduledSms 강화
   - Menu #25 발송 기록

6. Menu #29 예약 발송 (2시간)
   - Menu #25 스케줄 활용
   - Job Queue 설정

---

## 📝 최종 체크리스트 (Menu #25 시작 전)

- [ ] **DB 마이그레이션 계획**
  - CrmMarketingMessage 추가
  - EmailTemplate 추가
  - KakaoTemplate 추가 (선택)
  - OrgKakaoConfig 추가 (선택)

- [ ] **API 구조 설계**
  - /api/marketing/* 엔드포인트
  - 배치 처리 아키텍처
  - 에러 핸들링

- [ ] **UI 컴포넌트**
  - CampaignForm (생성 폼)
  - CampaignList (목록)
  - TrackingDashboard (실시간)
  - MessageEditor (SMS/Email)

- [ ] **외부 API**
  - Aligo SMS (테스트)
  - Email Service (선택)
  - KakaoTalk (선택)

- [ ] **테스트 시나리오**
  - 100명 캠페인 발송 (성공/실패)
  - A/B 테스트 결과
  - 추적 데이터 검증
  - 권한 격리 검증

- [ ] **배포 & 모니터링**
  - 성능 지표 (발송 시간)
  - 에러 모니터링
  - 사용자 가이드 작성

---

**다음 단계:**
Menu #25 마케팅 자동화 구현 착수 → Phase 1 필수 기능 완성 → Menu #26-30 연쇄 작업
