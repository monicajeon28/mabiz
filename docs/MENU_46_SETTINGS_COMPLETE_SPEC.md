# Menu #46: 설정 페이지 완전 스펙 (2026-05-24)

## 📋 개요

**목표**: 사용자가 프로필, 팀, 알림, 통합, 데이터, 심리학 렌즈를 통합 관리할 수 있는 설정 페이지 구현

**기대 효과**:
- 사용자 커스터마이징 100% 가능 (프로필 → 팀 → 알림 → 통합 → 데이터 → 렌즈)
- 심리학 렌즈 활성화 제어로 자동화 수준 조절 (L0-L10)
- 월 ROI 15-25% 추가 증대 (자동화율 향상 + 개인화)

**응용 Template**: T5 (CRM 자동화) + T6 (KPI 대시보드)

---

## 🏗️ 1. 페이지 구조 및 레이아웃

### 1.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│ 설정                                   [목표: 심화]        │
├─────────────────────────────────────────────────────────┤
│ 좌측 (280px)          │ 우측 (600-800px)                │
├───────────────────────┼─────────────────────────────────┤
│ 1. 프로필              │ 프로필 상세 (이름/이메일/사진)   │
│ 2. 팀                 │ 팀원 관리 (테이블 + 초대)        │
│ 3. 알림               │ SMS/이메일 토글 + 시간대          │
│ 4. 통합               │ API 키 + 외부서비스 연동          │
│ 5. 데이터             │ 내보내기 + 삭제                  │
│ 6. 심리학             │ L0-L10 렌즈 활성화 체크박스      │
└───────────────────────┴─────────────────────────────────┘
```

### 1.2 반응형 설계

**데스크톱 (1200px+)**
- 좌측 네비게이션 고정 (280px)
- 우측 콘텐츠 영역 (800px, 가운데 정렬)
- 패딩: 좌우 40px, 상하 60px
- 폰트: 제목 18px, 본문 14px, 라벨 12px

**태블릿 (768px-1199px)**
- 좌측 네비게이션 축소 (60px, 아이콘만)
- 우측 콘텐츠 탭 전환 (모달 또는 슬라이드)
- 패딩: 좌우 24px, 상하 40px

**모바일 (320px-767px)**
- 상단 탭 네비게이션 (6개 섹션)
- 아코디언 또는 탭 구조
- 가로 스크롤 제거 (100% width)
- 패딩: 좌우 16px, 상하 20px

---

## 📊 2. 각 섹션 상세 스펙

### 2.1 프로필 설정 (Profile Settings)

**목표**: 사용자 기본 정보 관리 + 심리학 렌즈 기반 페르소나 설정

**UI 구성**:

```
┌────────────────────────────────────────────┐
│ 프로필                                      │
├────────────────────────────────────────────┤
│                                            │
│  [프로필 사진] (160x160px)                 │
│  ┌──────────────┐                         │
│  │              │  이름: [입력]            │
│  │   drag       │  이메일: [표시] [복사]  │
│  │   here       │  전화: [입력]            │
│  │              │                         │
│  └──────────────┘                         │
│                                            │
│  타임존: [드롭다운]                        │
│  언어: [라디오] 한국어 / English            │
│                                            │
│  [계정 상태]                               │
│  활성 ✓  |  패스워드 변경  |  로그아웃     │
│                                            │
│ ┌──────────────────────────────────────┐  │
│ │ ⚠️  계정 삭제 (위험 영역)              │  │
│ │ 계정을 삭제하면 모든 데이터가 손실됩니다.  │  │
│ │ [계정 삭제]                           │  │
│ └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**폼 필드**:

| 필드 | 타입 | 필수 | 검증 | 비고 |
|------|------|------|------|------|
| name | text | Y | 2-50자 | 실명 |
| email | email | Y | RFC5321 | 읽기전용 |
| phone | tel | N | 10-11자 | 마스킹 X (보안) |
| avatar | file | N | JPG/PNG, max 5MB | Drag & Drop + 미리보기 |
| timezone | select | Y | Intl.ListFormat | 기본: Asia/Seoul |
| language | radio | Y | ko / en | 기본: ko |
| status | badge | - | ACTIVE / INACTIVE | 읽기전용 |

**이벤트 핸들러**:

```typescript
// 프로필 사진 업로드
handleAvatarUpload(file: File) {
  - 크기 검증 (5MB max)
  - 포맷 검증 (JPG/PNG)
  - 미리보기 표시
  - 업로드 API 호출
}

// 이름 변경
handleNameChange(newName: string) {
  - 트림 + 길이 검증
  - PATCH /api/users/[id]/profile
  - 토스트 표시 (성공/실패)
}

// 패스워드 변경
handlePasswordChange() {
  - 모달 오픈
  - 기존 비번 + 신규 비번 입력
  - 검증: 최소 8자, 대문자/숫자 포함
  - POST /api/users/[id]/password-change
}

// 계정 삭제
handleAccountDelete() {
  - 확인 모달 (2단계)
  - 비밀번호 재입력 필수
  - DELETE /api/users/[id]
  - 리다이렉트: /login
}
```

**심리학 매핑** (L5 자기투영):
- 프로필 사진: 시각적 신뢰도 +15% (권위성)
- 완성도 지표: "80% 완성됨" 표시 → 일관성 렌즈 활성화
- 성공 사례: "프로필이 완성된 사용자는 전환율 2.3배" → 사회증명

---

### 2.2 팀 설정 (Team Settings)

**목표**: 팀원 초대, 권한 관리, 성과 추적

**UI 구성**:

```
┌────────────────────────────────────────────┐
│ 팀                          [+ 팀원 초대]   │
├────────────────────────────────────────────┤
│ 현재 팀원: 3명 / 10명 (무료) 또는 무제한   │
│                                            │
│ ┌─────┬──────────┬──────┬────────┬────────┐│
│ │이름 │이메일    │역할  │성과    │액션    ││
├─────┼──────────┼──────┼────────┼────────┤│
│박준호│jh@...   │ADMIN │월 2K만원│[편집]  ││
│이모니│mo@...   │AGENT │월 1K만원│[편집]  ││
│신민형│sh@...   │AGENT │월 1.5K │[편집]  ││
└─────┴──────────┴──────┴────────┴────────┘│
│                                            │
│ [+ 팀원 추가]                              │
└────────────────────────────────────────────┘
```

**팀원 목록 테이블**:

| 컬럼 | 타입 | 설명 | 정렬 |
|------|------|------|------|
| displayName | string | 표시명 | A-Z |
| email | email | 이메일 | A-Z |
| role | select | ADMIN / AGENT / VIEWER | - |
| performance | number | 월 매출 / 전환율 | ↓ |
| actions | button | 편집 / 제거 | - |

**역할별 권한**:

| 권한 | ADMIN | AGENT | VIEWER |
|------|-------|-------|--------|
| 조직 설정 수정 | O | X | X |
| 팀원 관리 | O | X | X |
| Contact CRUD | O | O | X |
| CRM 자동화 설정 | O | O | X |
| 보고서 조회 | O | O | O |
| 심리학 렌즈 설정 | O | X | X |

**초대 플로우** (모달):

```
┌──────────────────────────────┐
│ 팀원 초대                      │
├──────────────────────────────┤
│ 이메일: [입력]                │
│ 역할:   [드롭다운: AGENT/VIEWER]│
│                              │
│ 초대 메시지:                 │
│ ┌────────────────────────┐  │
│ │함께 일해요!             │  │
│ │초대 링크 + 토큰 생성    │  │
│ └────────────────────────┘  │
│                              │
│ [초대 발송]        [취소]     │
└──────────────────────────────┘
```

**이벤트 핸들러**:

```typescript
// 팀원 초대
handleInviteTeamMember(email: string, role: string) {
  - 이메일 검증 + 중복 확인
  - OrgInviteToken 생성 (유효기간 7일)
  - 초대 메일 발송 (smtp)
  - POST /api/invites
}

// 역할 변경
handleRoleChange(memberId: string, newRole: string) {
  - 권한 검증 (ADMIN만 가능)
  - PATCH /api/teams/[id]/members/[memberId]
}

// 팀원 제거
handleRemoveTeamMember(memberId: string) {
  - 확인 모달
  - Contact 재할당 (ROUND_ROBIN)
  - DELETE /api/teams/[id]/members/[memberId]
}
```

**심리학 매핑** (L8 재구매습관화):
- 팀원별 성과 표시: "이모니는 월 1K, 준호는 월 2K" → 사회증명 + 권위성
- "상위 3명 초대" 뱃지 → 집단사고 + 희소성
- 월별 성과 추이: 선형 그래프 → 진전감 + 일관성

---

### 2.3 알림 설정 (Notification Settings)

**목표**: 수신 채널, 카테고리, 시간대 제어

**UI 구성**:

```
┌────────────────────────────────────────────┐
│ 알림                                       │
├────────────────────────────────────────────┤
│ 알림 요약: [드롭다운] 없음 / 일일 / 주간   │
│                                            │
│ 전체 수신 [ON/OFF 토글]                    │
│                                            │
│ 조용한 시간: [ON/OFF]                      │
│ ├─ 시작: [시간 선택] 22:00                 │
│ └─ 종료: [시간 선택] 08:00                 │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ SMS 알림                                │ │
│ ├─────────────────────────────────────── │ │
│ │ ☐ Contact 활동                         │ │
│ │   └─ [SMS] [Email] [In-App]            │ │
│ │ ☐ 판매 업데이트                        │ │
│ │ ☐ SMS 캠페인                           │ │
│ │ ☐ 시스템 알림                          │ │
│ │ ☐ 팀원 활동                            │ │
│ │ ☐ 예정된 리포트                        │ │
│ │ ☐ 결제/청구                            │ │
│ │ ☐ 보안 알림                            │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [✓ 설정 저장]                              │
└────────────────────────────────────────────┘
```

**알림 카테고리**:

| 카테고리 | 설명 | 기본값 | 채널 |
|---------|------|--------|------|
| CONTACT_ACTIVITY | Contact 추가/수정/통화 | ON | Email/SMS |
| SALES_UPDATE | 거래 생성/완료/손실 | ON | Email/SMS |
| SMS_CAMPAIGN | 캠페인 발송/통계 | ON | Email |
| SYSTEM_ALERT | 시스템 장애/유지보수 | ON | Email/In-App |
| TEAM_ACTIVITY | 팀원 활동/멘션 | ON | Email/In-App |
| REPORT_SCHEDULED | 월간 리포트 | ON | Email |
| BILLING | 결제/구독 | ON | Email |
| SECURITY | 로그인/권한 변경 | ON | Email/SMS |

**이벤트 핸들러**:

```typescript
// 알림 카테고리 토글
handleCategoryToggle(category: string, enabled: boolean) {
  - PATCH /api/users/[id]/notifications
  - 실시간 적용 (토스트 표시)
}

// 채널 선택
handleChannelToggle(category: string, channel: string, enabled: boolean) {
  - 각 카테고리별 채널 독립 제어
  - PATCH /api/users/[id]/notifications/channels
}

// 조용한 시간 설정
handleQuietHours(startTime: string, endTime: string) {
  - 24시간 형식 (HH:mm)
  - 시간대 검증 (endTime > startTime)
  - PATCH /api/users/[id]/notifications/quiet-hours
}
```

**심리학 매핑** (L6 타이밍 손실회피):
- "조용한 시간 설정": "밤 10시-아침 8시 알림 차단" → 생활편의 + 신뢰
- 알림 요약: "주간 요약으로 중요 내용만 확인" → 효율성 강조
- 보안 알림: "앗! 2시간 전 새로운 기기에서 로그인됨" → 긴박감 + 권위성

---

### 2.4 통합 설정 (Integration Settings)

**목표**: API 키 관리, 외부 서비스 연동, 웹훅 설정

**UI 구성**:

```
┌────────────────────────────────────────────┐
│ 통합                                       │
├────────────────────────────────────────────┤
│ API 키 관리                                │
│ ┌────────────────────────────────────────┐ │
│ │ 주요 API 키:                           │ │
│ │ ••••••••••••••••••••••••••••••••••••••  │ │
│ │ 생성일: 2026-01-15 | 마지막 사용: 1시간전│
│ │ [보기] [재생성] [삭제]                  │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [새 API 키 생성]                           │
│                                            │
│ 외부 서비스 연동                           │
│ ┌────────────────────────────────────────┐ │
│ │ [Slack] 연결 안됨 [연결] [설정]         │ │
│ │ [Zapier] 연결됨 ✓ [설정] [분리]        │ │
│ │ [Gmail] 연결됨 ✓ [설정] [분리]         │ │
│ │ [Google Calendar] 연결 안됨 [연결]     │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ 웹훅 (Webhook)                             │
│ ┌────────────────────────────────────────┐ │
│ │ 엔드포인트: https://api.yourdomain/hook│ │
│ │ 이벤트: Contact.created, Sale.created │ │
│ │ [테스트] [수정] [삭제]                  │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [+ 웹훅 추가]                              │
└────────────────────────────────────────────┘
```

**API 키 관리**:

```typescript
interface ApiKey {
  id: string;
  name: string;
  key: string; // 마스킹됨 (처음 8자 + 마지막 4자만 표시)
  createdAt: DateTime;
  lastUsedAt?: DateTime;
  expiresAt?: DateTime;
  scopes: string[]; // ['contacts.read', 'contacts.write', 'sms.send']
}
```

**외부 서비스**:

| 서비스 | 기능 | 인증 방식 | 상태 표시 |
|--------|------|---------|---------|
| Slack | 팀 메시지 푸시 | OAuth2 | 연결/미연결 |
| Zapier | 자동화 통합 | API Key | 활성/비활성 |
| Gmail | 이메일 발송 | OAuth2 | 활성/만료 |
| Google Calendar | 일정 동기화 | OAuth2 | 활성/만료 |

**웹훅 설정**:

```typescript
interface Webhook {
  id: string;
  url: string;
  events: string[]; // ['contact.created', 'contact.updated', 'sms.sent']
  isActive: boolean;
  headers?: Record<string, string>;
  retries: number; // 기본 3회
  timeout: number; // 기본 30초
}

// 이벤트 타입
type WebhookEvent = 
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'sms.sent'
  | 'email.sent'
  | 'sale.created'
  | 'sale.completed';
```

**이벤트 핸들러**:

```typescript
// API 키 생성
handleGenerateApiKey(name: string) {
  - POST /api/users/[id]/api-keys
  - 응답: { key, warning: "지금만 표시됩니다" }
  - 토스트: 복사 권유
}

// 외부 서비스 연결 (OAuth)
handleConnectService(service: 'slack' | 'zapier' | 'gmail' | 'calendar') {
  - 팝업 오픈: OAuth 인증 페이지
  - 콜백: POST /api/integrations/[service]/callback
  - 리다이렉트: /settings/integrations (결과 표시)
}

// 웹훅 테스트
handleTestWebhook(webhookId: string) {
  - POST /api/webhooks/[id]/test
  - 응답: 테스트 이벤트 결과 + 상태코드
  - 토스트: "웹훅이 정상 작동합니다"
}
```

**심리학 매핑** (L10 즉시구매 + L9 신뢰):
- API 키 복사: "한 번의 클릭으로 연동 완료" → 편의성 강조
- 외부 서비스 녹색 체크: ✓ 연결됨 → 신뢰도 + 권위성
- "테스트" 버튼: "실제 작동 확인 후 안심" → 불안감 해소

---

### 2.5 데이터 설정 (Data Settings)

**목표**: 데이터 백업, 내보내기, 계정 삭제

**UI 구성**:

```
┌────────────────────────────────────────────┐
│ 데이터                                     │
├────────────────────────────────────────────┤
│ 데이터 내보내기                            │
│ ┌────────────────────────────────────────┐ │
│ │ Contact 데이터 (1,234개)                │ │
│ │ 형식: [CSV] [JSON] [Excel]             │ │
│ │ 포함: [☑ 이름] [☑ 전화] [☑ 태그]       │ │
│ │       [☑ 거래정보] [☑ 태그]            │ │
│ │                                        │ │
│ │ [내보내기 시작]                        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ SMS 이력                                   │
│ ┌────────────────────────────────────────┐ │
│ │ 발송된 SMS: 5,678건                    │ │
│ │ [내보내기 (CSV)]                       │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ 마지막 백업: 2026-05-20 14:30              │
│ [자동 백업 설정]                           │
│                                            │
│ ⚠️  위험 영역                              │
│ ┌────────────────────────────────────────┐ │
│ │ 계정 및 모든 데이터 삭제                 │ │
│ │ 이 작업은 되돌릴 수 없습니다.             │ │
│ │ [계정 삭제]                            │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

**내보내기 옵션**:

| 선택지 | CSV | JSON | Excel |
|--------|-----|------|-------|
| Contact 기본정보 | ✓ | ✓ | ✓ |
| Contact 태그/메모 | ✓ | ✓ | ✓ |
| Contact 거래정보 | ✓ | ✓ | ✓ |
| SMS 이력 | ✓ | ✓ | ✓ |
| 호출 기록 | ✓ | ✓ | - |

**이벤트 핸들러**:

```typescript
// 데이터 내보내기
handleExportData(
  format: 'csv' | 'json' | 'excel',
  fields: string[],
  dataType: 'contacts' | 'sms' | 'calls'
) {
  - POST /api/exports
  - 백그라운드 작업 (대용량 데이터)
  - 완료 시 이메일로 다운로드 링크 발송
  - 토스트: "내보내기가 준비되었습니다 (5분 소요)"
}

// 자동 백업 설정
handleAutoBackup(enabled: boolean, frequency: 'daily' | 'weekly') {
  - PATCH /api/users/[id]/backup-settings
  - 매주 일요일 자정 (기본)
}

// 계정 삭제 (2단계 확인)
handleDeleteAccount() {
  - 모달 1: "정말 삭제하시겠습니까?"
  - 모달 2: "비밀번호 입력 + 이메일로 확인 링크"
  - DELETE /api/users/[id]
}
```

**심리학 매핑** (L0 부재중 + L9 신뢰):
- "마지막 백업": "2026-05-20 14:30" → 신뢰도 + 안전감
- "자동 백업 설정": "매주 자동 백업으로 안심" → 불안감 해소 + 권위성
- 계정 삭제: 2단계 확인으로 실수 방지 → 신뢰도

---

### 2.6 심리학 렌즈 설정 (Psychology Lens Settings)

**목표**: L0-L10 렌즈별 활성화 제어 + 효과 미리보기

**UI 구성**:

```
┌────────────────────────────────────────────┐
│ 심리학 (Psychology Lenses)                 │
├────────────────────────────────────────────┤
│ 렌즈 활성화는 CRM 자동분류 규칙을 제어합니다│
│                                            │
│ [Quick Start 추천 설정] [초기화]           │
│                                            │
│ 활성: 4/10개 | 비활성: 6/10개              │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ ☑ L0: 부재중 고객 재활성화              │ │
│ │  ├─ SMS Day 0-3: 감정적 재연결         │ │
│ │  └─ 기대효과: 재활성화율 +18-62%        │ │
│ │                                        │ │
│ │ ☑ L1: 가격 이의 대응                   │ │
│ │  ├─ PASONA 카피 자동 적용             │ │
│ │  └─ 기대효과: 가격민감도 -42%          │ │
│ │                                        │ │
│ │ ☐ L2: 준비 복잡 불안 (5단계 중재)    │ │
│ │  ├─ SPIN 질문 자동 생성               │ │
│ │  └─ 기대효과: 불안감 -38%, 전환율+45% │ │
│ │                                        │ │
│ │ ☑ L3: 차별성 미인지                   │ │
│ │  ├─ 경쟁사 비교 SMS 발송              │ │
│ │  └─ 기대효과: 선택 확신도 +50%        │ │
│ │                                        │ │
│ │ ☑ L4: [추가 렌즈] ...                 │ │
│ │ ☑ L5: 자기투영 ...                    │ │
│ │ ☐ L6: 타이밍 손실회피 ...             │ │
│ │ ☐ L7: 동반자 설득 ...                 │ │
│ │ ☐ L8: 재구매 습관화 ...               │ │
│ │ ☑ L9: 의료신뢰 ...                    │ │
│ │ ☐ L10: 즉시구매 클로징 ...            │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [✓ 설정 저장]                              │
│ "렌즈 변경 시 CRM 분류 규칙이 실시간 적용됩니다"│
└────────────────────────────────────────────┘
```

**렌즈별 상세 정보** (호버 시 표시):

```typescript
interface PsychologyLens {
  id: string; // 'L0' - 'L10'
  name: string;
  description: string; // 40자 이내
  smsTemplate: string; // 적용될 SMS 템플릿
  expectedEffect: string; // "재활성화율 +18-62%"
  applicableSegments: string[]; // ['INACTIVE_3_6M', 'INACTIVE_6_12M']
  conversionLift: number; // 기대 전환율 상승 (%)
  enabled: boolean;
  appliedAt?: DateTime;
}

// 예시 L0
{
  id: 'L0',
  name: '부재중 고객 재활성화',
  description: '3-6개월/6-12개월/1년+ 부재 고객 세분화',
  smsTemplate: 'REACTIVATION_L0',
  expectedEffect: '재활성화율 +18-62%',
  applicableSegments: ['INACTIVE_3_6M', 'INACTIVE_6_12M', 'INACTIVE_1Y_PLUS'],
  conversionLift: 40,
  enabled: true
}
```

**CRM 영향도 맵핑** (표):

| 렌즈 | SMS 템플릿 | Contact 태그 | 담당자 할당 | 다음 액션 |
|------|---------|---------|---------|---------|
| L0 | REACTIVATION_L0 | reactivation | ROUND_ROBIN | SMS Day 0 + 콜 |
| L1 | PRICE_OBJECTION | price_sensitive | Price Expert | 이의 대응 |
| L2 | COMPLEXITY_ANXIETY | anxiety_high | Care Agent | 중재 질문 |
| L3 | DIFFERENTIATION | differentiation | Sales Specialist | 경쟁사 비교 |
| L5 | SELF_PROJECTION | health_concern | Medical Advisor | 건강정보 |
| L9 | MEDICAL_TRUST | medical_verified | MD Agent | 의료진 설명 |

**이벤트 핸들러**:

```typescript
// 렌즈 활성화/비활성화
handleLensToggle(lensId: string, enabled: boolean) {
  - PATCH /api/psychology/lenses/[lensId]
  - 관련 Contact 자동 재분류 (배경 작업)
  - 토스트: "L0 렌즈가 활성화되었습니다. CRM 분류가 업데이트 중입니다."
}

// 렌즈 설정 저장
handleSaveLensSettings(lenses: PsychologyLens[]) {
  - PATCH /api/users/[id]/lens-preferences
  - 변경 사항 요약: "4개 렌즈 활성화, 6개 비활성화"
  - ContactLensClassification 대량 업데이트
}

// Quick Start 추천 설정
handleQuickStart(segment: 'beginner' | 'intermediate' | 'advanced') {
  - Beginner: L0 + L1 + L9 (필수 3개)
  - Intermediate: + L2 + L3 + L5 (6개)
  - Advanced: 모두 활성화 (10개)
  - PATCH /api/users/[id]/lens-preferences
}
```

**심리학 매핑** (메타-심리학: 사용자 선택 권한):
- "Quick Start": "추천 설정으로 즉시 시작" → 편의성 + 손실회피
- 렌즈 활성화: "L0 렌즈가 활성화되었습니다" 토스트 → 성취감 + 일관성
- 기대효과 표시: "재활성화율 +18-62%" → 기대감 + 사회증명
- 실시간 업데이트: "CRM 분류가 업데이트 중입니다" → 신뢰도 + 권위성

---

## 🔗 3. API 엔드포인트 목록

### 3.1 프로필 API

```typescript
// 프로필 조회
GET /api/users/[id]/profile
응답: { id, name, email, phone, avatar, timezone, language, status, lastLoginAt }

// 프로필 업데이트
PATCH /api/users/[id]/profile
본문: { name?, phone?, timezone?, language? }
응답: { success, user }

// 아바타 업로드
POST /api/users/[id]/avatar
본문: FormData (multipart/form-data)
응답: { url, size, uploadedAt }

// 패스워드 변경
POST /api/users/[id]/password-change
본문: { currentPassword, newPassword }
응답: { success, message }

// 계정 삭제
DELETE /api/users/[id]
본문: { password, email } (2단계 확인)
응답: { success, message: "계정이 삭제되었습니다" }
```

### 3.2 팀 API

```typescript
// 팀원 목록
GET /api/teams/[teamId]/members
쿼리: ?page=1&limit=10&sort=performance
응답: { members[], pagination }

// 팀원 초대
POST /api/teams/[teamId]/invites
본문: { email, role, message? }
응답: { success, inviteToken, inviteUrl }

// 역할 변경
PATCH /api/teams/[teamId]/members/[memberId]
본문: { role }
응답: { success, member }

// 팀원 제거
DELETE /api/teams/[teamId]/members/[memberId]
응답: { success, message }

// 팀원 성과 조회
GET /api/teams/[teamId]/members/[memberId]/performance
쿼리: ?month=2026-05
응답: { revenue, conversions, callCount, smsCount }
```

### 3.3 알림 API

```typescript
// 알림 설정 조회
GET /api/users/[id]/notifications
응답: { preferences[], allowMarketing, allowNotifications, summary, quietHours }

// 알림 카테고리 업데이트
PATCH /api/users/[id]/notifications
본문: { 
  preferences: [
    { category, enabled, channels: { email, sms, inApp, push } }
  ]
}
응답: { success, preferences }

// 조용한 시간 설정
PATCH /api/users/[id]/notifications/quiet-hours
본문: { enabled, startTime: "22:00", endTime: "08:00" }
응답: { success }

// 알림 요약 설정
PATCH /api/users/[id]/notifications/summary
본문: { frequency: "DAILY" | "WEEKLY" | "NONE" }
응답: { success }
```

### 3.4 통합 API

```typescript
// API 키 목록
GET /api/users/[id]/api-keys
응답: { keys: [{ id, name, maskedKey, createdAt, lastUsedAt, scopes }] }

// API 키 생성
POST /api/users/[id]/api-keys
본문: { name, scopes: ["contacts.read", "sms.send"] }
응답: { key: "sk_live_...", warning: "지금만 표시됩니다" }

// API 키 삭제
DELETE /api/users/[id]/api-keys/[keyId]
응답: { success }

// 외부 서비스 연결 (OAuth 콜백)
POST /api/integrations/[service]/callback
본문: { code, state }
응답: { success, service, connectedAt }

// 외부 서비스 분리
DELETE /api/integrations/[service]
응답: { success }

// 웹훅 생성
POST /api/webhooks
본문: { url, events: ["contact.created"], headers?, timeout?, retries? }
응답: { id, secret, url, events }

// 웹훅 테스트
POST /api/webhooks/[id]/test
응답: { success, statusCode, responseTime, message }

// 웹훅 수정
PATCH /api/webhooks/[id]
본문: { url?, events?, isActive?, retries? }
응답: { success, webhook }

// 웹훅 삭제
DELETE /api/webhooks/[id]
응답: { success }
```

### 3.5 데이터 API

```typescript
// 내보내기 작업 생성
POST /api/exports
본문: { 
  format: "csv" | "json" | "excel",
  dataType: "contacts" | "sms" | "calls",
  fields: ["name", "phone", "tags"],
  filters?: { dateFrom, dateTo, tags[] }
}
응답: { jobId, estimatedTime: "5분", status: "PROCESSING" }

// 내보내기 상태 조회
GET /api/exports/[jobId]
응답: { status: "PROCESSING" | "COMPLETED" | "FAILED", downloadUrl?, expiresAt? }

// 자동 백업 설정
PATCH /api/users/[id]/backup-settings
본문: { enabled, frequency: "daily" | "weekly", dayOfWeek?: "sunday" }
응답: { success, nextBackupAt }

// 계정 삭제 (프로필과 통합)
DELETE /api/users/[id]
```

### 3.6 심리학 렌즈 API

```typescript
// 렌즈 목록 조회
GET /api/psychology/lenses
응답: {
  lenses: [
    {
      id: "L0",
      name: "부재중 고객 재활성화",
      description: "...",
      expectedEffect: "재활성화율 +18-62%",
      enabled: true
    }
  ]
}

// 사용자 렌즈 선택지 조회
GET /api/users/[id]/lens-preferences
응답: { lenses: [{ id, enabled, appliedAt }] }

// 사용자 렌즈 선택지 업데이트
PATCH /api/users/[id]/lens-preferences
본문: { lenses: [{ id: "L0", enabled: true }, ...] }
응답: { success, updatedLenses, affectedContacts: 1234 }

// 렌즈별 CRM 영향도 조회
GET /api/psychology/lenses/[lensId]/impact
응답: {
  lensId: "L0",
  smsTemplate: "REACTIVATION_L0",
  contactTags: ["reactivation"],
  expectedConversionLift: 40,
  applicableSegments: ["INACTIVE_3_6M", ...]
}

// Quick Start 설정 적용
POST /api/users/[id]/lens-preferences/quick-start
본문: { level: "beginner" | "intermediate" | "advanced" }
응답: { success, lenses: [...], message: "4개 렌즈가 활성화되었습니다" }
```

---

## 📐 4. Prisma 스키마 추가 (Menu #46)

```prisma
/**
 * 사용자 설정 (프로필, 알림, 통합)
 */
model UserSettings {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String
  
  // 프로필
  displayName     String?
  avatar          String?
  timezone        String   @default("Asia/Seoul")
  language        String   @default("ko")
  
  // 알림 선택지
  notificationPreferences Json   @default("{}")
  allowMarketing  Boolean  @default(false)
  quietHoursStart String?  // "22:00"
  quietHoursEnd   String?  // "08:00"
  
  // 렌즈 선택지
  enabledLenses   String[] @default([])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([userId, organizationId])
  @@index([organizationId])
}

/**
 * API 키 (사용자 개인 API 접근)
 */
model ApiKey {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String
  
  name            String
  keyPrefix       String   // 처음 8자
  keyHash         String   // bcrypt hash
  
  scopes          String[] // ["contacts.read", "sms.send"]
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  
  @@unique([keyHash])
  @@index([userId, organizationId])
  @@index([createdAt])
}

/**
 * 외부 서비스 연동 상태
 */
model IntegrationConnection {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String
  
  service         String   // "slack", "zapier", "gmail", "calendar"
  
  accessToken     String   // 암호화 필요
  refreshToken    String?
  tokenExpiresAt  DateTime?
  
  scopes          String[]
  metadata        Json?    // 서비스별 추가 정보
  
  isActive        Boolean  @default(true)
  connectedAt     DateTime @default(now())
  disconnectedAt  DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([userId, organizationId, service])
  @@index([userId, service])
}

/**
 * 웹훅 엔드포인트
 */
model Webhook {
  id              String   @id @default(cuid())
  organizationId  String
  
  url             String
  secret          String   // 서명 검증용
  
  events          String[] // ["contact.created", "sms.sent"]
  headers         Json?    // 커스텀 헤더
  
  retries         Int      @default(3)
  timeout         Int      @default(30) // 초
  
  isActive        Boolean  @default(true)
  
  lastTriggeredAt DateTime?
  failureCount    Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([organizationId])
  @@index([organizationId, isActive])
}

/**
 * 웹훅 실행 로그
 */
model WebhookLog {
  id              String   @id @default(cuid())
  webhookId       String
  
  event           String
  payload         Json
  
  statusCode      Int?
  responseTime    Int?     // 밀리초
  
  success         Boolean
  errorMessage    String?
  
  createdAt       DateTime @default(now())
  
  @@index([webhookId, createdAt])
  @@index([success])
}

/**
 * 데이터 내보내기 작업
 */
model DataExport {
  id              String   @id @default(cuid())
  organizationId  String
  userId          String
  
  format          String   // "csv", "json", "excel"
  dataType        String   // "contacts", "sms", "calls"
  
  fields          String[]
  filters         Json?
  
  status          String   @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED
  fileUrl         String?
  fileSize        Int?
  
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  expiresAt       DateTime? // 7일 후 자동 삭제
  
  @@index([organizationId, createdAt])
  @@index([userId])
  @@index([status])
}

/**
 * 백업 설정
 */
model BackupSettings {
  id              String   @id @default(cuid())
  userId          String   @unique
  organizationId  String
  
  enabled         Boolean  @default(true)
  frequency       String   @default("weekly") // daily, weekly
  dayOfWeek       String?  @default("sunday")
  
  lastBackupAt    DateTime?
  nextBackupAt    DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([organizationId])
}

/**
 * 사용자 렌즈 선택지 (조인 테이블)
 */
model UserLensPreference {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String
  
  lensId          String   // "L0", "L1", ..., "L10"
  enabled         Boolean  @default(false)
  appliedAt       DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([userId, organizationId, lensId])
  @@index([organizationId, lensId])
}
```

---

## 🎨 5. 모바일 vs 데스크톱 차이점

### 5.1 레이아웃 비교

| 요소 | 데스크톱 | 모바일 |
|------|--------|--------|
| 네비게이션 | 좌측 고정 280px | 상단 탭 (6개) |
| 메인 콘텐츠 | 800px, 가운데 정렬 | 100% width, padding 16px |
| 모달 | 상단중앙, 500x700px | 하단 바텀시트, 모바일 높이 70% |
| 테이블 | 데이터테이블 + 페이징 | 카드 리스트 + 스와이프 |
| 버튼 | 텍스트 + 아이콘 | 풀 너비 (터치 44px 최소) |

### 5.2 상호작용 차이

**데스크톱**:
- 호버: 버튼 배경색 변경
- 포커스: 파란색 테두리
- 드래그: 파일 드래그 & 드롭

**모바일**:
- 탭: 배경색 변경 (호버 없음)
- 포커스: 자동 스크롤 + 캐럿
- 드래그: 손가락 스와이프 + 파일 선택

### 5.3 반응형 코드 예시

```tsx
// 네비게이션
<div className="hidden md:flex w-64 flex-col ...">
  {/* 데스크톱: 좌측 네비게이션 */}
</div>

<div className="md:hidden flex gap-2 overflow-x-auto ...">
  {/* 모바일: 상단 탭 */}
</div>

// 테이블
<div className="hidden md:block">
  {/* 데스크톱: 데이터테이블 */}
</div>

<div className="md:hidden space-y-3">
  {/* 모바일: 카드 리스트 */}
</div>

// 버튼
<button className="md:w-auto w-full h-10 md:h-9 ...">
  {/* 모바일: 풀 너비 + 44px 높이 */}
</button>
```

---

## 🔐 6. 보안 및 검증

### 6.1 API 보안

```typescript
// 인증 필수
- 모든 API: Authorization: Bearer {token}

// CSRF 보안
- PATCH/POST/DELETE: X-CSRF-Token 헤더 검증

// 권한 검증
- 프로필: 본인만 조회/수정
- 팀 관리: ADMIN 역할만
- 데이터 삭제: 2단계 확인 (비밀번호)

// 데이터 암호화
- API 키: bcrypt hash (원본 저장 안 함)
- 외부 서비스 토큰: AES-256 암호화
- 요청 바디: HTTPS 필수
```

### 6.2 폼 검증

```typescript
// 프로필
- name: 2-50자, 특수문자 제외
- email: RFC5321, 읽기전용
- phone: 10-11자, 숫자만
- avatar: JPG/PNG, 5MB 이하

// 팀 초대
- email: RFC5321, 조직 내 중복 불가
- role: ADMIN / AGENT / VIEWER (열거형)

// 알림
- startTime/endTime: HH:mm 형식, 24시간 기준

// 웹훅
- url: HTTPS 필수 (HTTP 불가)
- events: 허용된 이벤트만
- retries: 1-10 범위
```

---

## 📈 7. 성과 메트릭 정의

### 7.1 KPI 추적

```
현재: 기존 설정 없음
목표: Menu #46 배포 후 3개월

| 메트릭 | 현재 | 목표 (3개월) | 기대 효과 |
|--------|------|---------|---------|
| 프로필 완성율 | 0% | 85% | 신뢰도 +20% |
| 팀원 초대율 | 0% | 60% | 월 매출 +30% |
| 알림 활성율 | 100% | 70% | 오픈율 +15% |
| 외부 연동율 | 0% | 40% | 자동화율 +25% |
| 렌즈 활성화율 | 0% | 70% | 전환율 +20% |
| 자동화 효율 | - | +35% | 시간 절감 40시간/월 |
```

### 7.2 심리학 효과 예측

**렌즈 활성화로 인한 CRM 자동분류 개선**:
- L0 활성화: 부재중 고객 재활성화 +18-62%
- L1 활성화: 가격민감도 대응 -42% (이의율 감소)
- L9 활성화: 의료신뢰 +60% (구매 확신도)

**알림 설정 최적화**:
- 조용한 시간 설정 시: 메시지 신뢰도 +25% (적절한 타이밍)
- SMS+Email 수신: 오픈율 40% 증가 (멀티채널)

**팀 관리 효율화**:
- ADMIN이 팀원 역할 명시 → 책임감 +30% (명확성)
- 월간 성과 표시 → 상위 3명 리더보드 → 경쟁 심리 +40%

---

## 🚀 8. 구현 로드맵

### Phase 1: 기본 구조 (Day 1-2)
- [ ] Prisma 스키마 추가 + 마이그레이션
- [ ] API 라우트 생성 (/api/users, /api/teams, /api/notifications)
- [ ] 프로필 & 팀 페이지 UI (구조만)

### Phase 2: 렌즈 통합 (Day 2-3)
- [ ] 심리학 렌즈 API (/api/psychology/lenses)
- [ ] Contact 자동분류 규칙 업데이트
- [ ] 렌즈 선택지 UI 구현

### Phase 3: 외부 통합 (Day 3-4)
- [ ] OAuth 연동 (Slack, Gmail, Google Calendar)
- [ ] 웹훅 시스템 구현
- [ ] API 키 관리

### Phase 4: 데이터 & 테스트 (Day 4-5)
- [ ] 내보내기 기능 (CSV/JSON/Excel)
- [ ] 자동 백업 설정
- [ ] 전체 테스트 + 심리학 검증

---

## 📋 9. 체크리스트 (배포 전)

### 기능 완성
- [ ] 프로필 설정 (CRUD + 아바타 업로드)
- [ ] 팀원 관리 (초대 + 역할 + 성과 추적)
- [ ] 알림 설정 (카테고리 + 채널 + 조용한 시간)
- [ ] 통합 설정 (API 키 + OAuth + 웹훅)
- [ ] 데이터 설정 (내보내기 + 백업 + 삭제)
- [ ] 심리학 렌즈 (L0-L10 활성화 + CRM 연동)

### 심리학 검증
- [ ] Grant Cardone 10렌즈 최소 3개 이상 (L0, L1, L5, L9 필수)
- [ ] PASONA/SPIN 카피 적용 (알림/초대 메시지)
- [ ] Day 0-3 자동화 (렌즈 변경 시 SMS 메타데이터 자동 생성)
- [ ] 세그먼트별 페르소나 매핑 (프로필 → 렌즈 자동 추천)

### 기술 검증
- [ ] API 보안 (인증 + 권한 + 암호화)
- [ ] 폼 검증 (클라이언트 + 서버)
- [ ] 에러 처리 (토스트 + 로그)
- [ ] 반응형 (320px ~ 1920px)
- [ ] 접근성 (WCAG 2.1 AA)

### 성과 설정
- [ ] KPI 정의 (프로필 완성율 85%, 렌즈 활성화율 70%)
- [ ] 기대 효과 (전환율 +20%, 시간 절감 40시간/월)
- [ ] 모니터링 대시보드 (주간 리포트)

---

## 📚 참고 메모리 파일

```
Template 적용:
✅ Template T5: CRM 자동화 (렌즈 설정 → 자동분류)
✅ Template T6: KPI 대시보드 (성과 추적 + 렌즈별 효과)

심리학 렌즈:
✅ [[l0_reactivation_inactive_customers]] - 부재중 고객 (프로필 완성 유도)
✅ [[l1_lens_complete]] - 가격이의 (알림 설정 가치 강조)
✅ [[l5_suitability_self_projection]] - 자기투영 (프로필 사진)
✅ [[l9_health_safety_medical_trust]] - 신뢰도 (API 보안 설명)
✅ [[grant_cardone_closing]] - 클로징 (렌즈 선택 유도)

프레임워크:
✅ [[pasona_framework_complete]] - PASONA 카피 (팀 초대 메시지)
✅ [[spin_selling_complete]] - SPIN 질문 (렌즈 설정 가이드)
✅ [[psychology_theories_master]] - 권위성 + 신뢰도 (API 보안)
```

---

**최종 업데이트**: 2026-05-24 | **버전**: 1.0 (Menu #46 완전 스펙)
