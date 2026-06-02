# 🔐 마비즈 CRM 보안 & 규정준수 프레임워크

**작성일**: 2026-06-02  
**버전**: 1.0  
**담당**: 보안 & 데이터 보호 전문가팀

---

## 📋 목차

1. [보안 체크리스트 (20개 항목)](#1-보안-체크리스트-20개-항목)
2. [데이터 보관 정책](#2-데이터-보관-정책)
3. [API 보안 규칙](#3-api-보안-규칙)
4. [감사 로그 스키마](#4-감사-로그-스키마)
5. [규정 준수 매트릭스](#5-규정-준수-매트릭스-gdprcccpakor)
6. [자동화 보안 프로세스](#6-자동화-보안-프로세스)
7. [데이터 암호화 정책](#7-데이터-암호화-정책)
8. [개인정보 보호 체크리스트](#8-개인정보-보호-체크리스트)

---

## 1. 보안 체크리스트 (20개 항목)

### ✅ 인증 & 인가 (5개)

- [ ] **AUTH-001**: 모든 API 엔드포인트에서 `getMabizSession()` 또는 `getAuthContext()` 호출
  - **현황**: ✅ 구현됨 (messages/route.ts, webhooks 등)
  - **점검**: `src/app/api/*/route.ts`에서 `if (!session?.organizationId)` 확인
  - **실패 시 결과**: 401 Unauthorized 응답

- [ ] **AUTH-002**: RBAC (Role-Based Access Control) 적용
  - **현황**: ✅ 구현됨 (`enforceRBAC` 미들웨어)
  - **권한 레벨**: GLOBAL_ADMIN > ORG_ADMIN > MANAGER > MEMBER
  - **점검**: `/api/admin/**` 엔드포인트는 GLOBAL_ADMIN만 접근 가능
  - **실패 시 결과**: 403 Forbidden

- [ ] **AUTH-003**: Bearer Token 검증 (Webhook)
  - **현황**: ✅ 구현됨 (cruisedot-payment/route.ts)
  - **구현**: `authHeader.startsWith('Bearer ') && timingSafeEqual()`
  - **점검**: 모든 Webhook 수신 함수에서 Bearer 토큰 검증
  - **실패 시 결과**: 401 Unauthorized

- [ ] **AUTH-004**: HMAC-SHA256 서명 검증
  - **현황**: ✅ 구현됨
  - **구현**: `createHmac('sha256', secret).update(body).digest('hex')`
  - **점검**: `x-signature` 헤더와 계산된 서명 비교 (timing-safe)
  - **실패 시 결과**: 403 Forbidden

- [ ] **AUTH-005**: 세션 만료 및 토큰 갱신
  - **현황**: ⚠️ 부분 구현
  - **점검 필요**: 세션 타임아웃 설정 (기본 30분?)
  - **개선 사항**: 민감한 작업(데이터 삭제, 대량 발송)은 재인증 요구

---

### ✅ 데이터 보호 (5개)

- [ ] **DATA-001**: PII (개인식별정보) 암호화 - at rest
  - **현황**: ✅ 부분 구현 (SMS/Email 자격증명)
  - **암호화 대상**: 
    - `UserSmsConfig.aligoKeyEncrypted` (AES-256-CBC)
    - `OrgEmailConfig.smtpPassEncrypted` (AES-256-CBC)
  - **점검 필요**: Contact.phone, Contact.email 암호화 여부
  - **개선 사항**: `DATA_ENCRYPT_KEY` 환경변수 필수 설정

- [ ] **DATA-002**: PII 암호화 - in transit (HTTPS)
  - **현황**: ✅ 구현됨 (모든 API HTTPS)
  - **점검**: `NEXT_PUBLIC_APP_URL` = `https://...` 확인
  - **개선 사항**: SSL/TLS 인증서 자동 갱신 설정

- [ ] **DATA-003**: 개인정보 마스킹 (로그)
  - **현황**: ⚠️ 미구현
  - **필요 사항**: 
    ```typescript
    // 로그에서 민감 정보 마스킹
    phone: "010-****-5678",
    email: "user@******.com",
    ```
  - **구현 위치**: `src/lib/logger.ts` 또는 `lib/compliance/log-masker.ts`

- [ ] **DATA-004**: 데이터 최소화 원칙
  - **현황**: ⚠️ 부분 준수
  - **점검**:
    - 필요한 필드만 `select` 또는 `projection` 사용
    - 불필요한 고객 데이터 수집 금지
  - **개선 사항**: API 응답에서 민감 필드 제거

- [ ] **DATA-005**: 데이터 백업 및 복구 전략
  - **현황**: ⚠️ DevOps 담당 (보안 팀과 검증 필요)
  - **점검 필요**:
    - 자동 백업 빈도 (일일? 주간?)
    - 백업 암호화 여부
    - 재해 복구 계획 (RTO < 4시간, RPO < 1시간)

---

### ✅ API 보안 (5개)

- [ ] **API-001**: 입력 검증 (SQL injection 방지)
  - **현황**: ✅ 구현됨 (Prisma ORM 사용)
  - **점검**: 문자열 쿼리 직접 작성 금지
  - **개선 사항**: 숫자 입력값에 대해 `parseInt()` + 범위 검증

- [ ] **API-002**: XSS 방지 (CSRF 토큰)
  - **현황**: ⚠️ 미구현
  - **필요 사항**: 
    - Next.js 내장 CSRF 방어 활성화
    - `Content-Security-Policy` 헤더 설정
  - **구현 위치**: `next.config.js` 또는 middleware

- [ ] **API-003**: Rate Limiting
  - **현황**: ⚠️ 미구현
  - **필요 사항**:
    - SMS 발송: 사용자당 100회/일 제한
    - API 호출: IP당 1000회/시간 제한
    - 로그인 시도: 5회/5분 초과 시 30분 차단
  - **구현 라이브러리**: `@upstash/ratelimit` 또는 `redis-rate-limit`

- [ ] **API-004**: 멱등성 (Idempotency)
  - **현황**: ✅ 부분 구현 (Webhook eventId 기반)
  - **점검**: 모든 POST/PUT 요청에서 멱등성 키 지원
  - **개선 사항**: `Idempotency-Key` 헤더 필수화

- [ ] **API-005**: API 버전 관리 및 보안 감사
  - **현황**: ⚠️ 미구현
  - **필요 사항**:
    - API 버전 엔드포인트 (v1, v2 분리)
    - 구식 API 버전 deprecation 경고
    - 월간 보안 감사 (외부 펜테스트)

---

### ✅ 인프라 & 운영 (5개)

- [ ] **OPS-001**: 환경 변수 관리
  - **현황**: ✅ 구현됨 (.env.local 사용)
  - **필수 변수 체크리스트**:
    - `CRUISEDOT_WEBHOOK_SECRET` ✅ (웹훅)
    - `EMAIL_ENCRYPT_KEY` ✅ (이메일 암호화)
    - `SMS_ENCRYPT_KEY` (SMS 암호화)
    - `DATA_ENCRYPT_KEY` (PII 암호화)
    - `PAYAPP_LINKKEY` (PayApp 연동)
    - `JWT_SECRET` (세션 토큰)
  - **점검**: `process.env.XXX` 미정의 시 에러 반환

- [ ] **OPS-002**: 로깅 및 모니터링
  - **현황**: ✅ 구현됨 (`logger` 사용)
  - **점검**:
    - 모든 보안 이벤트 로깅 (실패한 로그인, 권한 거부 등)
    - 민감한 작업 로깅 (데이터 삭제, 대량 발송, 환경 변수 변경)
  - **개선 사항**: 실시간 알람 (에러율 > 1%)

- [ ] **OPS-003**: 접근 제어 (IP Whitelist)
  - **현황**: ⚠️ 미구현
  - **필요 사항**:
    - Admin API: 지정된 IP만 접근
    - Webhook: 특정 도메인만 허용
    - 개발자 API: VPN 필수
  - **구현 위치**: `next.config.js` middleware 또는 WAF

- [ ] **OPS-004**: 버전 관리 및 패치
  - **현황**: ✅ 구현됨 (npm audit)
  - **점검**:
    - 월간 보안 업데이트 (npm audit fix)
    - 심각한 취약점: 24시간 내 패치
    - 일반 취약점: 주간 패치
  - **자동화**: GitHub Actions 의존성 검사

- [ ] **OPS-005**: 장애 대응 계획
  - **현황**: ⚠️ 문서 필요
  - **필요 사항**:
    - 데이터 유출 시 대응 절차 (법무팀 통보, KISA 신고)
    - 시스템 다운 시 복구 절차 (RTO < 1시간)
    - 보안 인사사건(breach) 보고 프로세스

---

## 2. 데이터 보관 정책

### 📊 데이터 보관 기간 (RTO: Retention Time Objective)

| 데이터 타입 | 보관 기간 | 법적 근거 | 폐기 방법 |
|-----------|---------|--------|--------|
| **Contact 정보** (이름, 전화, 이메일) | 365일 (1년) | GDPR, 개인정보보호법 | 암호화 후 복구 불가능한 방식으로 삭제 |
| **콜 녹취 + 텍스트** (감정분석 결과 포함) | 180일 (6개월) | GDPR, 한국 전기통신사업법 | 암호화 후 물리적 파괴 |
| **SMS/Email 로그** | 90일 (3개월) | 통신비밀보호법 | 암호화 후 삭제 |
| **감사 로그** (Audit Log) | 365일+ (감사 목적) | 국제 보안 표준 | 읽기 전용 보관 |
| **결제 정보** (영수증, 송장) | 1,825일 (5년) | 세법, 전자상거래법 | 암호화 보관 후 폐기 |
| **Webhook 이벤트** | 180일 (6개월) | 추적 용도 | 암호화 후 삭제 |
| **임직원 로그인 기록** | 365일 (1년) | 고용법, 보안 표준 | 암호화 후 삭제 |
| **거부된 액세스 시도** | 90일 (3개월) | 침입 탐지 | 암호화 후 삭제 |

### 🗑️ 자동 폐기 정책

```typescript
// cron: 매일 자정 실행
// src/app/api/cron/data-retention-cleanup.ts

export async function DELETE_RETENTION_POLICY() {
  const today = new Date();
  
  // Contact 데이터: 365일 경과 → 삭제 대기 (유예 30일)
  const deleteContactsAfter = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
  await prisma.dataDeletionRequest.createMany({
    data: {
      // contactId: ..., gracePeriodDays: 30
    }
  });

  // SMS/Email 로그: 90일 경과 → 즉시 삭제
  const deleteSmsAfter = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  await prisma.smsLog.deleteMany({
    where: { createdAt: { lt: deleteSmsAfter } }
  });

  // Webhook 이벤트: 180일 경과 → 즉시 삭제
  const deleteWebhookAfter = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
  await prisma.webhookEvent.deleteMany({
    where: { createdAt: { lt: deleteWebhookAfter } }
  });
}
```

### 🔐 데이터 암호화 저장 (Encrypted at Rest)

| 필드 | 암호화 방식 | 저장 위치 | 키 관리 |
|------|-----------|---------|--------|
| `OrgSmsConfig.aligoKey` | AES-256-CBC | PostgreSQL | `SMS_ENCRYPT_KEY` env |
| `UserSmsConfig.aligoKeyEncrypted` | AES-256-CBC | PostgreSQL | `SMS_ENCRYPT_KEY` env |
| `OrgEmailConfig.smtpPassEncrypted` | AES-256-CBC | PostgreSQL | `EMAIL_ENCRYPT_KEY` env |
| `Contact.phone` (향후) | AES-256-CBC | PostgreSQL | `DATA_ENCRYPT_KEY` env |
| `Contact.email` (향후) | AES-256-CBC | PostgreSQL | `DATA_ENCRYPT_KEY` env |
| **AI 콜 녹취** (향후) | AES-256-GCM | S3 + KMS | AWS KMS (managed key) |
| **감정분석 결과** | Tokenization | PostgreSQL | 별도 토큰 저장소 |

---

## 3. API 보안 규칙

### 🔒 Webhook 보안 (3-레이어)

```typescript
// Layer 1: Bearer Token 검증
const authHeader = req.headers.get('authorization') ?? '';
if (!authHeader.startsWith('Bearer ')) return 401;

const token = authHeader.slice(7);
if (!timingSafeEqual(Buffer.from(token), Buffer.from(secret))) return 401;

// Layer 2: HMAC-SHA256 서명 검증
const body = await req.text();
const signature = req.headers.get('x-signature') ?? '';
const expectedSignature = createHmac('sha256', secret)
  .update(body)
  .digest('hex');

if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
  return 403; // Forbidden
}

// Layer 3: 멱등성 검증 (eventId)
const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
  where: { eventId: payload.eventId }
});

if (alreadyProcessed) {
  return 200; // 중복 무시 (성공 응답)
}
```

### 📤 메시지 발송 API 보안

```typescript
// src/app/api/messages/route.ts

// 1. 인증 확인
const session = await getMabizSession();
if (!session?.organizationId) return 401;

// 2. 테넌트 격리 (다른 조직의 Contact 접근 불가)
if (contact.organizationId !== session.organizationId) return 403;

// 3. 입력 검증
if (!contactId || !messageType || !messageKey) return 400;

// 4. Rate Limiting (선택사항)
// await checkRateLimit(session.organizationId, 'messages', 100); // 일 100건

// 5. 동의 확인 (opt-in/opt-out)
if (!contact.smsOptIn && messageType === 'SMS') {
  return 400; // '고객이 SMS 수신에 동의하지 않았습니다'
}

// 6. 감사 로깅
await auditLogger.log({
  organizationId: session.organizationId,
  userId: session.userId,
  action: 'SEND_MESSAGE',
  resourceType: 'Message',
  resourceId: contactId,
  status: 'SUCCESS',
  metadata: { messageType, lens, day: parsedDay }
});
```

### 🔐 관리자 API 보안

```typescript
// /api/admin/** 엔드포인트 모두 적용

// 1. RBAC 확인
const rbacCheck = enforceRBAC(req, {
  allowedRoles: ['GLOBAL_ADMIN'], // 또는 ['GLOBAL_ADMIN', 'ORG_ADMIN']
  errorMessage: 'GLOBAL_ADMIN 권한 필요'
});
if (rbacCheck !== true) return rbacCheck;

// 2. IP Whitelist (향후)
const clientIp = req.headers.get('x-forwarded-for') || req.ip;
if (!ADMIN_IP_WHITELIST.includes(clientIp)) return 403;

// 3. 재인증 요구 (민감한 작업)
if (action === 'DELETE_ALL_CONTACTS') {
  // OTP 또는 MFA 추가 인증 요구
}

// 4. 감사 로깅 (필수)
await auditLogger.log({
  action: 'ADMIN_ACTION',
  resourceType: 'Organization',
  status: 'SUCCESS',
  metadata: { action, affectedRows: 1000 }
});
```

### 📨 개인정보 동의 관리

```typescript
// Contact 모델에 필드 추가 (향후)
model Contact {
  // ... 기존 필드
  
  smsOptIn: Boolean @default(false)          // SMS 동의 여부
  emailOptIn: Boolean @default(false)        // Email 동의 여부
  smsOptInAt: DateTime?                      // 동의 일시
  smsOptOutAt: DateTime?                     // 거부 일시
  
  smsOptInSource: String?                    // 동의 출처 (landing-page, call, etc.)
}

// API: SMS 발송 전 확인
if (!contact.smsOptIn) {
  logger.warn('[messages] SMS opt-in 필수 — 거부됨', { contactId });
  return 400;
}
```

---

## 4. 감사 로그 스키마

### 📋 AuditLog 테이블 구조

```typescript
model AuditLog {
  id            String   @id @default(cuid())
  organizationId String
  userId        String
  action        AuditAction // 'READ', 'WRITE', 'DELETE', 'EXPORT', 'LOGIN', 'ADMIN_ACTION'
  resourceType  String      // 'Contact', 'Message', 'Organization', 'User'
  resourceId    String?     // 대상 리소스 ID
  status        String      // 'SUCCESS', 'FAILED', 'DENIED'
  statusCode    Int?        // HTTP 상태 코드 (200, 401, 403, 500 등)
  ipAddress     String?     // 요청 IP
  userAgent     String?     // 사용자 에이전트
  metadata      Json?       // 추가 정보 (필드 변경사항, 쿼리 파라미터 등)
  errorMessage  String?     // 실패 시 에러 메시지
  createdAt     DateTime    @default(now())

  @@index([organizationId, createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
}
```

### 📝 감사 로깅 구현

```typescript
// src/lib/compliance/audit-logger.ts

import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export type AuditAction = 'READ' | 'WRITE' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'ADMIN_ACTION' | 'SEND_MESSAGE';

export class AuditLogger {
  async log({
    organizationId,
    userId,
    action,
    resourceType,
    resourceId,
    status,
    statusCode,
    ipAddress,
    metadata
  }: {
    organizationId: string;
    userId: string;
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    status: 'SUCCESS' | 'FAILED' | 'DENIED';
    statusCode?: number;
    ipAddress?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      // 1. 로그 저장 (비동기)
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          resourceType,
          resourceId,
          status,
          statusCode,
          ipAddress,
          metadata,
          createdAt: new Date(),
        }
      });

      // 2. 로거에도 기록 (모니터링)
      logger.log(`[AUDIT] ${action} on ${resourceType}:${resourceId || '?'}`, {
        organizationId,
        userId,
        status,
        statusCode,
        ipAddress,
      });

      // 3. 실시간 경고 (선택사항)
      if (status === 'FAILED' || action === 'DELETE') {
        // Slack 알림 또는 이메일 발송
      }
    } catch (err) {
      logger.error('[AuditLogger] 감사 로그 저장 실패', { err });
    }
  }
}

export const auditLogger = new AuditLogger();
```

### 🚨 모니터링 대시보드 쿼리

```typescript
// src/app/api/admin/compliance/audit-logs/route.ts

// 실패 로그인 (1시간 내 5회 이상)
const failedLogins = await prisma.auditLog.groupBy({
  by: ['userId'],
  where: {
    action: 'LOGIN',
    status: 'FAILED',
    createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
  },
  _count: { id: true },
  having: { id: { _count: { gte: 5 } } },
});

// 불가능한 이동 (30초 내 다른 IP에서 로그인)
const impossibleTravel = await prisma.$queryRaw`
  SELECT a1.userId, a1.ipAddress as ip1, a1.createdAt as time1,
         a2.ipAddress as ip2, a2.createdAt as time2
  FROM "AuditLog" a1
  JOIN "AuditLog" a2 ON a1.userId = a2.userId
  WHERE a1.action = 'LOGIN' AND a2.action = 'LOGIN'
  AND a1.createdAt < a2.createdAt
  AND EXTRACT(EPOCH FROM (a2.createdAt - a1.createdAt)) < 30
  AND a1.ipAddress != a2.ipAddress;
`;

// 대량 데이터 접근 (1시간 내 1,000+ 행 조회)
const massAccess = await prisma.auditLog.groupBy({
  by: ['userId'],
  where: {
    action: 'READ',
    createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
  },
  _count: { id: true },
  having: { id: { _count: { gte: 1000 } } },
});
```

---

## 5. 규정 준수 매트릭스 (GDPR/CCPA/KOR)

### 🌍 GDPR (유럽 일반 데이터 보호 규정)

| 요구사항 | 현황 | 구현 위치 | 마감 |
|--------|------|---------|------|
| **기본 원칙** (합법성, 공정성, 투명성) | ⚠️ 부분 | `docs/PRIVACY_POLICY.md` | 2026-06-30 |
| 개인정보 암호화 (at rest) | ✅ | `src/lib/crypto.ts` | ✅ |
| HTTPS (in transit) | ✅ | `next.config.js` | ✅ |
| **접근권** (개인이 자신의 데이터 요청) | ⚠️ 미구현 | `src/app/api/admin/compliance/data-access` | 2026-06-30 |
| **삭제권** (잊혀질 권리) | ✅ 부분 | `src/app/api/admin/compliance/deletion-requests` | ✅ |
| **통지 의무** (유출 시 72시간 내 신고) | ⚠️ 프로세스만 | `docs/INCIDENT_RESPONSE.md` | 2026-06-30 |
| **개인정보 영향평가** (DPIA) | ⚠️ 문서만 | `docs/DPIA_TEMPLATE.md` | 2026-07-15 |
| **데이터 처리자 계약** (DPA) | ⚠️ 법무팀 검토 | 계약서 | 2026-07-31 |

### 🇺🇸 CCPA (캘리포니아 소비자 개인정보 보호법)

| 요구사항 | 현황 | 구현 위치 | 마감 |
|--------|------|---------|------|
| **공개** (수집 정보 명시) | ⚠️ 부분 | `docs/PRIVACY_POLICY.md` | 2026-06-30 |
| **삭제권** | ✅ | `src/app/api/admin/compliance/deletion-requests` | ✅ |
| **옵트아웃** (DNC 리스트) | ✅ 부분 | Contact.smsOptOut, Contact.emailOptOut | ✅ |
| **판매 금지** (소비자 거부 시) | ✅ | Contact.dataShareOptOut 필드 추가 | 2026-06-30 |
| **차별 금지** (옵트아웃 고객도 동등한 서비스) | ⚠️ 검증 필요 | API 레벨 체크 | 2026-07-15 |

### 🇰🇷 한국 개인정보보호법 + 통신비밀보호법

| 요구사항 | 현황 | 구현 위치 | 마감 |
|--------|------|---------|------|
| **개인정보 암호화** (피싱, 변조 방지) | ✅ | `src/lib/crypto.ts` | ✅ |
| **접근 제어** (필요한 사람만 접근) | ✅ | `src/app/api/_middleware/enforce-rbac.ts` | ✅ |
| **감사 로그** (3년 보관) | ✅ | `src/app/api/admin/compliance/audit-logs` | ✅ |
| **수탁자 보호** (개인정보 처리자 교육, 계약) | ⚠️ 진행 중 | 인사 시스템 | 2026-07-31 |
| **동의** (명시적 동의 기록) | ✅ 부분 | Contact.smsOptInAt, Contact.emailOptInAt | 2026-06-30 |
| **통지** (개인정보 유출 시 즉시 통지) | ⚠️ 프로세스만 | `docs/INCIDENT_RESPONSE.md` | 2026-06-30 |
| **DNC** (전화거부, SMS 거부 목록) | ✅ 부분 | Contact.smsOptOut, Contact.callOptOut | 2026-06-30 |

### 📋 준수도 스코어카드

```typescript
// 2026-06-02 현재 상태

GDPR:    60/100 (암호화, 삭제권 ✅ | 접근권, DPIA, DPA ⚠️)
CCPA:    75/100 (삭제권, 옵트아웃 ✅ | 판매금지 ⚠️)
Korean:  80/100 (암호화, RBAC, 감사 ✅ | 수탁자, 통지 ⚠️)
────────────────
Overall: 72/100 → Target: 95/100 (by 2026-07-31)
```

---

## 6. 자동화 보안 프로세스

### 🔄 Day 0-3 SMS 자동화 보안

```typescript
// src/lib/loop5-sms-service.ts

export async function sendDay0Sms(
  organizationId: string,
  contactId: string,
  segment: Segment,
  abVariant: ABVariant
) {
  // 1. Contact 조회 & 권한 검증
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { organization: true }
  });
  
  if (!contact || contact.organizationId !== organizationId) {
    logger.warn('[Day0SMS] 권한 거부', { contactId, organizationId });
    return { ok: false, error: 'UNAUTHORIZED' };
  }

  // 2. 동의 여부 확인 (필수!)
  if (!contact.smsOptIn || contact.smsOptOutAt) {
    logger.warn('[Day0SMS] SMS 거부 → 발송 스킵', { contactId });
    return { ok: false, error: 'SMS_OPT_OUT' };
  }

  // 3. Rate Limiting 확인
  const todayCount = await prisma.scheduledSms.count({
    where: {
      organizationId,
      contactId,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  });
  
  if (todayCount >= 5) {
    logger.warn('[Day0SMS] Rate limit 초과', { contactId, todayCount });
    return { ok: false, error: 'RATE_LIMIT_EXCEEDED' };
  }

  // 4. 메시지 렌더링 & 발송 (with error handling)
  try {
    const message = renderPasonaMessage(segment, abVariant, contact);
    
    // 5. 멱등성: 같은 segment + variant 조합 1회만 발송
    const existingMessage = await prisma.crmMarketingMessage.findFirst({
      where: {
        contactId,
        segment,
        variant: abVariant,
        day: 0,
        organizationId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24시간 내
        }
      }
    });

    if (existingMessage) {
      logger.log('[Day0SMS] 중복 발송 방지', { contactId, segment });
      return { ok: false, error: 'DUPLICATE_MESSAGE' };
    }

    // 6. 실제 발송
    const smsId = await sendScheduledSms({
      organizationId,
      contactId,
      phoneNumber: contact.phone!,
      body: message,
      sendAt: new Date(),
      campaignType: `DAY0_${segment}`
    });

    // 7. 감사 로깅
    await auditLogger.log({
      organizationId,
      userId: 'SYSTEM',
      action: 'SEND_MESSAGE',
      resourceType: 'Message',
      resourceId: contactId,
      status: 'SUCCESS',
      metadata: { day: 0, segment, variant: abVariant, smsId }
    });

    logger.log('[Day0SMS] 발송 완료', { contactId, smsId });
    return { ok: true, smsId };

  } catch (err) {
    logger.error('[Day0SMS] 발송 실패', {
      contactId,
      error: err instanceof Error ? err.message : String(err)
    });
    return { ok: false, error: 'SEND_FAILED' };
  }
}
```

### 🤖 Workflow 자동화 보안

```typescript
// src/lib/workflow-engine.ts

export interface WorkflowExecutionContext {
  organizationId: string;
  contactId: string;
  triggerId: string;
  executedBy: 'SYSTEM' | 'USER'; // 자동화 vs 수동
  approvedBy?: string; // 관리자 승인 (민감한 작업 시)
  metadata?: Record<string, any>;
}

export async function executeWorkflow(
  context: WorkflowExecutionContext,
  workflow: Workflow
) {
  // 1. 자동화 권한 확인
  const org = await prisma.organization.findUnique({
    where: { id: context.organizationId },
    select: { id: true, automationLevel: true }
  });
  
  if (!org) return { ok: false, error: 'ORG_NOT_FOUND' };

  // 2. 민감한 작업 (대량 발송, 데이터 삭제) 시 승인 요구
  const isSensitive = 
    workflow.action.type === 'SEND_MESSAGE_BULK' ||
    workflow.action.type === 'DELETE_CONTACT' ||
    workflow.action.type === 'EXPORT_DATA';

  if (isSensitive && context.executedBy === 'SYSTEM') {
    // 관리자 승인 필수
    const approval = await prisma.workflowApproval.findUnique({
      where: { triggerId: context.triggerId }
    });

    if (!approval?.approvedAt) {
      logger.warn('[Workflow] 승인 대기 중', { 
        triggerId: context.triggerId,
        action: workflow.action.type 
      });
      return { ok: false, error: 'APPROVAL_REQUIRED' };
    }
  }

  // 3. Dry-run 실행 (미리보기)
  const dryRunResult = await executeWorkflow_DryRun(context, workflow);
  if (!dryRunResult.ok) {
    logger.warn('[Workflow] Dry-run 실패', { 
      triggerId: context.triggerId, 
      error: dryRunResult.error 
    });
    return dryRunResult;
  }

  // 4. 실제 실행
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 각 step 별 실행 + 롤백 준비
    const results = [];
    for (const step of workflow.steps) {
      const stepResult = await executeWorkflowStep(step, context);
      results.push(stepResult);

      if (!stepResult.ok) {
        // 롤백 시작
        await rollbackWorkflow(executionId, results);
        throw new Error(`Step ${step.id} 실패`);
      }
    }

    // 5. 감사 로깅
    await auditLogger.log({
      organizationId: context.organizationId,
      userId: context.executedBy === 'SYSTEM' ? 'WORKFLOW_ENGINE' : context.approvedBy!,
      action: 'ADMIN_ACTION',
      resourceType: 'Workflow',
      resourceId: workflow.id,
      status: 'SUCCESS',
      metadata: {
        executionId,
        triggerId: context.triggerId,
        steps: workflow.steps.length,
        affectedRecords: results.reduce((acc, r) => acc + (r.count || 0), 0)
      }
    });

    logger.log('[Workflow] 실행 완료', { 
      workflowId: workflow.id, 
      executionId,
      affectedRecords: results.reduce((acc, r) => acc + (r.count || 0), 0)
    });

    return { ok: true, executionId, results };

  } catch (err) {
    logger.error('[Workflow] 실행 오류', {
      executionId,
      error: err instanceof Error ? err.message : String(err)
    });

    return { ok: false, error: 'EXECUTION_FAILED' };
  }
}
```

### 🔄 롤백 메커니즘

```typescript
// Workflow 실행 중 오류 발생 시, 이전 단계들을 역순으로 되돌림
async function rollbackWorkflow(
  executionId: string,
  completedSteps: WorkflowStepResult[]
) {
  logger.warn('[Workflow] 롤백 시작', { executionId, stepsCount: completedSteps.length });

  // 역순으로 각 step 취소
  for (let i = completedSteps.length - 1; i >= 0; i--) {
    const step = completedSteps[i];
    
    if (step.type === 'SEND_MESSAGE') {
      // 예약된 메시지 취소
      await prisma.scheduledSms.deleteMany({
        where: { id: { in: step.createdIds } }
      });
    } else if (step.type === 'UPDATE_CONTACT') {
      // Contact 원래대로 복원 (snapshot 있으면 사용)
      // ...
    }
  }

  logger.log('[Workflow] 롤백 완료', { executionId });
}
```

---

## 7. 데이터 암호화 정책

### 🔐 암호화 키 관리

```typescript
// 환경 변수 (절대 코드에 포함 금지!)
// .env.local에만 저장, 버전 관리 제외

EMAIL_ENCRYPT_KEY=your-32-char-random-string-here!!! // 32자 이상
SMS_ENCRYPT_KEY=your-32-char-random-string-here!!!!
DATA_ENCRYPT_KEY=your-32-char-random-string-here!!!!!  // Contact.phone, email용
```

### 🔒 암호화 구현 (AES-256-CBC)

```typescript
// src/lib/crypto.ts — 현재 구현

export function encrypt(plain: string, keyEnvVar: string): string {
  const rawKey = process.env[keyEnvVar];
  if (!rawKey || rawKey.length < 32) {
    throw new Error(`Encryption key too short`);
  }

  const key = Buffer.from(rawKey.substring(0, 32)); // 32 bytes = 256 bits
  const iv = randomBytes(16); // 초기화 벡터 (무작위)
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final()
  ]);

  // IV + 암호화 데이터 반환 (IV는 평문으로 전송 가능)
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(encryptedStr: string, keyEnvVar: string): string {
  const rawKey = process.env[keyEnvVar];
  if (!rawKey || rawKey.length < 32) {
    throw new Error(`Encryption key too short`);
  }

  const [ivHex, encHex] = encryptedStr.split(':');
  if (!ivHex || !encHex) {
    throw new Error(`Invalid encrypted data format`);
  }

  const key = Buffer.from(rawKey.substring(0, 32));
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
```

### 📊 필드 암호화 대상 (향후)

```typescript
// Prisma 미들웨어: 저장 시 자동 암호화, 읽기 시 자동 복호화
// (현재는 수동으로 encrypt/decrypt 호출 필요)

const prisma = new PrismaClient();

// Before: Contact 저장 시
prisma.$use(async (params, next) => {
  if (params.model === 'Contact' && params.action === 'create') {
    // phone, email 암호화
    if (params.args.data.phone) {
      params.args.data.phone = encrypt(params.args.data.phone, 'DATA_ENCRYPT_KEY');
      params.args.data.phoneEncrypted = true;
    }
    if (params.args.data.email) {
      params.args.data.email = encrypt(params.args.data.email, 'DATA_ENCRYPT_KEY');
      params.args.data.emailEncrypted = true;
    }
  }
  return next(params);
});

// After: Contact 읽기 시
prisma.$use(async (params, next) => {
  const result = await next(params);
  if (params.model === 'Contact' && ['findUnique', 'findMany'].includes(params.action)) {
    if (result.phoneEncrypted && result.phone) {
      result.phone = decrypt(result.phone, 'DATA_ENCRYPT_KEY');
    }
    if (result.emailEncrypted && result.email) {
      result.email = decrypt(result.email, 'DATA_ENCRYPT_KEY');
    }
  }
  return result;
});
```

---

## 8. 개인정보 보호 체크리스트

### 📋 배포 전 최종 검증 (필수!)

#### 보안 점검
- [ ] 모든 API에서 `getMabizSession()` 또는 `getAuthContext()` 호출
- [ ] 환경 변수 누락 확인 (KEY, SECRET, PASSWORD 등)
- [ ] 민감한 로그 문자열 제거 (전화번호, 이메일, 신용카드 등)
- [ ] SQL injection, XSS 취약점 체크 (`npm audit`)
- [ ] Rate limiting 설정 확인

#### 데이터 보호 점검
- [ ] Contact.phone 암호화 여부 확인
- [ ] Contact.email 암호화 여부 확인
- [ ] SMS/Email 자격증명 암호화 여부 확인
- [ ] 결제 정보 저장 금지 (PCI-DSS)
- [ ] 감사 로그 저장 확인

#### 규정 준수 점검
- [ ] opt-in/opt-out 동의 메커니즘
- [ ] DNC (Do Not Call/Do Not SMS) 필드 추가
- [ ] 개인정보 유출 시 72시간 내 신고 프로세스
- [ ] GDPR/CCPA 요구사항 충족 여부 확인

#### 운영 점검
- [ ] 백업 및 복구 계획 수립
- [ ] 감사 로그 보관 기간 설정 (최소 365일)
- [ ] 자동 데이터 폐기 Cron 설정
- [ ] 보안 인사사건 대응 계획 작성
- [ ] 정기 보안 감사 (월 1회 이상)

---

## 📚 추가 리소스

- **GDPR 가이드**: https://gdpr-info.eu/
- **CCPA 가이드**: https://oag.ca.gov/privacy/ccpa
- **한국 개인정보보호법**: https://www.pipc.go.kr/
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **CWE/SANS Top 25**: https://cwe.mitre.org/top25/

---

**버전 히스토리**
- v1.0 (2026-06-02): 초판 작성 (보안 체크리스트 20개, 데이터 정책, API 규칙, 감사 로그, 규정 준수)
