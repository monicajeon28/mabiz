# 🚀 마비즈 CRM 보안 구현 로드맵 (2026-06-02 ~ 2026-07-31)

**목표**: GDPR/CCPA/한국 개인정보보호법 준수 → 컴플라이언스 스코어 72% → 95% (8주)

---

## 📅 Phase 1: 즉시 조치 (2026-06-02 ~ 2026-06-15, 2주)

### 🔴 P0 - 치명적 결함 (즉시 배포)

#### P0-1: Contact 동의 필드 추가 ⚠️
**상태**: 미구현  
**영향**: GDPR/CCPA 미준수 → 법적 리스크  
**예상 효과**: 동의 추적 → 법적 보호

```typescript
// prisma/schema.prisma 수정
model Contact {
  // ... 기존 필드
  
  // SMS 동의 관리
  smsOptIn: Boolean @default(false)
  smsOptInAt: DateTime?
  smsOptInSource: String?  // 'landing-page', 'call', 'manual' 등
  smsOptOutAt: DateTime?
  smsOptOutReason: String?
  
  // Email 동의 관리
  emailOptIn: Boolean @default(false)
  emailOptInAt: DateTime?
  emailOptOutAt: DateTime?
  
  // 통화 동의 관리
  callOptIn: Boolean @default(true)
  callOptOutAt: DateTime?
  
  // 데이터 공유 거부 (CCPA)
  dataShareOptOut: Boolean @default(false)
  
  @@index([organizationId, smsOptIn])
  @@index([smsOptOutAt])
}
```

**구현 체크리스트**:
- [ ] Prisma 마이그레이션 생성 (`npx prisma migrate dev --name add-contact-consent-fields`)
- [ ] Contact 생성 폼에 opt-in 체크박스 추가
- [ ] 기존 Contact에 opt-in 상태 초기화 (수동 승인 필요)
- [ ] SMS 발송 전 smsOptIn === true 확인 코드 추가 (messages/route.ts)
- [ ] 단위 테스트 작성 (opt-out 고객에게 발송 불가)

**예상 소요시간**: 4시간  
**담당**: Agent-CRM

---

#### P0-2: Contact.phone/email 암호화 ⚠️
**상태**: 미구현  
**영향**: GDPR 개인정보 보호 → 벌금 최대 €20M  
**예상 효과**: PII 암호화 → 데이터 유출 시 피해 최소화

```typescript
// src/lib/crypto.ts 이미 구현됨 ✅
// 사용법:
// const encrypted = encrypt(phone, 'DATA_ENCRYPT_KEY');
// const decrypted = decrypt(encrypted, 'DATA_ENCRYPT_KEY');

// Contact 필드 암호화 적용:
// 1. 저장 시: Contact.phone = encrypt(plain, 'DATA_ENCRYPT_KEY')
// 2. 읽기 시: contact.phone = decrypt(encrypted, 'DATA_ENCRYPT_KEY')

// Prisma 미들웨어로 자동화 (향후):
const prisma = new PrismaClient().$use(async (params, next) => {
  if (params.model === 'Contact' && params.action === 'create') {
    if (params.args.data.phone) {
      params.args.data.phone = encrypt(params.args.data.phone, 'DATA_ENCRYPT_KEY');
      params.args.data.phoneEncrypted = true;
    }
  }
  // ... 읽기 시 자동 복호화
  return next(params);
});
```

**구현 체크리스트**:
- [ ] Contact 모델에 phoneEncrypted, emailEncrypted 플래그 추가
- [ ] Prisma 마이그레이션 생성
- [ ] 기존 데이터 마이그레이션 스크립트 작성 (batch 처리)
- [ ] Contact.phone 읽기/쓰기 위치 모두 수정 (10+ 파일)
- [ ] 검색 기능 수정 (암호화된 phone으로 검색 불가능 → 별도 해시 필드 추가)
- [ ] 단위 테스트 작성

**예상 소요시간**: 8시간  
**담당**: Agent-CRM

---

#### P0-3: 환경 변수 누락 검증 ⚠️
**상태**: 부분 구현 (CRUISEDOT_WEBHOOK_SECRET만)  
**영향**: 배포 실패 또는 런타임 오류  
**예상 효과**: 안정성 향상

```typescript
// src/lib/env-validator.ts (신규)
const requiredEnvVars = [
  'CRUISEDOT_WEBHOOK_SECRET',
  'EMAIL_ENCRYPT_KEY',
  'SMS_ENCRYPT_KEY',
  'DATA_ENCRYPT_KEY',
  'PAYAPP_LINKKEY',
  'JWT_SECRET',
  'DATABASE_URL',
];

export function validateEnv() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  logger.log('[ENV] ✅ All required environment variables are set');
}

// pages/_app.tsx 또는 app/layout.tsx에서 호출
validateEnv();
```

**구현 체크리스트**:
- [ ] env-validator.ts 작성
- [ ] app 시작 시 validateEnv() 호출
- [ ] CI/CD 배포 전 체크 추가
- [ ] .env.local.example 파일 업데이트

**예상 소요시간**: 2시간  
**담당**: Agent-SET

---

### 🟡 P1 - 높음 (배포 전 필수)

#### P1-1: SMS 발송 전 동의 확인
**상태**: 미구현  
**구현 위치**: `src/app/api/messages/route.ts` (85-140줄)  
**변경 내용**:

```typescript
// sendDay0Sms(), sendDay1Sms() 등에 추가
if (messageType === 'SMS' && !contact.smsOptIn) {
  logger.warn('[messages] SMS opt-in 필수 → 발송 스킵', { contactId });
  return NextResponse.json(
    { ok: false, message: 'Contact has not opted in to SMS messages' },
    { status: 400 }
  );
}

if (messageType === 'SMS' && contact.smsOptOutAt) {
  logger.warn('[messages] SMS 거부 상태 → 발송 스킵', { contactId });
  return NextResponse.json(
    { ok: false, message: 'Contact has opted out of SMS messages' },
    { status: 400 }
  );
}
```

**예상 소요시간**: 2시간  
**담당**: Agent-SMS

---

#### P1-2: 감사 로그 자동 기록
**상태**: ✅ 부분 구현 (감사 로그 API는 있으나 자동 기록 빠짐)  
**구현 위치**: 모든 API 엔드포인트  
**변경 내용**:

```typescript
// 모든 POST/PUT/DELETE 요청 후 추가
import { auditLogger } from '@/lib/compliance/audit-logger';

// messages/route.ts, contacts/route.ts 등에 추가
await auditLogger.log({
  organizationId: session.organizationId,
  userId: session.userId,
  action: 'SEND_MESSAGE',  // or 'CREATE', 'UPDATE', 'DELETE'
  resourceType: 'Message',  // or 'Contact', 'Organization'
  resourceId: messageId,
  status: 'SUCCESS',
  statusCode: 200,
  ipAddress: req.headers.get('x-forwarded-for') || req.ip,
  metadata: {
    messageType,
    lens,
    day: parsedDay,
    affectedRecords: 1,
  }
});
```

**파일 목록** (수정 필요):
- `src/app/api/messages/route.ts`
- `src/app/api/contacts/route.ts`
- `src/app/api/campaigns/route.ts`
- `src/app/api/webhooks/*/route.ts`
- `src/app/api/admin/*/route.ts`

**예상 소요시간**: 6시간  
**담당**: Agent-ADM

---

#### P1-3: 데이터 로깅 마스킹
**상태**: 미구현  
**구현 위치**: `src/lib/logger.ts` (신규 util 추가)  
**변경 내용**:

```typescript
// src/lib/logger-masker.ts (신규)
export function maskPII(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  
  if (masked.phone && typeof masked.phone === 'string') {
    masked.phone = masked.phone.slice(0, 3) + '****' + masked.phone.slice(-4);
  }
  
  if (masked.email && typeof masked.email === 'string') {
    const [local, domain] = masked.email.split('@');
    masked.email = local.slice(0, 2) + '****@' + domain;
  }
  
  if (masked.creditCard) {
    masked.creditCard = '****-****-****-' + masked.creditCard.slice(-4);
  }
  
  return masked;
}

// logger.ts에서 사용
logger.log('[messages] 발송 완료', maskPII({
  contactId,
  phone: contact.phone,  // 010****5678로 마스킹됨
  email: contact.email,  // us****@example.com으로 마스킹됨
}));
```

**예상 소요시간**: 3시간  
**담당**: Agent-ADM

---

## 📅 Phase 2: 핵심 기능 (2026-06-16 ~ 2026-06-30, 2주)

### 🟡 P2 - 중간 (6월 말까지)

#### P2-1: Rate Limiting (SMS/API 호출)
**상태**: 미구현  
**구현 위치**: 메시지 API, 관리자 API  
**변경 내용**:

```typescript
// src/lib/rate-limit.ts (신규)
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const messageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 d'), // 일 100건
  analytics: true,
  prefix: 'ratelimit:message',
});

const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, '1 h'), // 시간당 1000건
  analytics: true,
  prefix: 'ratelimit:api',
});

// API에서 사용
export async function POST(req: NextRequest) {
  const session = await getMabizSession();
  
  // Rate limit 확인
  const { success } = await messageLimiter.limit(`org:${session.organizationId}`);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  // ... 나머지 로직
}
```

**예상 소요시간**: 4시간  
**담당**: Agent-SMS

---

#### P2-2: 데이터 삭제 자동화 (Cron)
**상태**: ✅ 부분 구현 (deletion-requests API는 있으나 자동 Cron 없음)  
**구현 위치**: `src/app/api/cron/data-retention-cleanup.ts` (신규)  
**변경 내용**:

```typescript
// src/app/api/cron/data-retention-cleanup.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { encrypt, decrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  // 크론 인증 확인
  const cronSecret = req.headers.get('authorization');
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const today = new Date();
    let deletedCount = 0;

    // 1. Contact 데이터: 365일 경과 → 삭제 대기 (유예 30일)
    const deleteContactsAfter = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const contactsToDelete = await prisma.contact.findMany({
      where: {
        createdAt: { lt: deleteContactsAfter },
        dataDeletionRequest: null, // 아직 삭제 요청 없음
      },
      select: { id: true }
    });

    for (const contact of contactsToDelete) {
      await prisma.dataDeletionRequest.create({
        data: {
          contactId: contact.id,
          requestedBy: 'SYSTEM',
          reason: 'Auto-retention policy',
          gracePeriodDays: 30,
          status: 'PENDING_DELETION',
          scheduledDeleteAt: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
        }
      });
    }
    deletedCount += contactsToDelete.length;

    // 2. SMS/Email 로그: 90일 경과 → 즉시 삭제
    const deleteSmsAfter = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const smsDeleted = await prisma.smsLog.deleteMany({
      where: { createdAt: { lt: deleteSmsAfter } }
    });
    deletedCount += smsDeleted.count;

    // 3. Webhook 이벤트: 180일 경과 → 즉시 삭제
    const deleteWebhookAfter = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
    const webhookDeleted = await prisma.webhookEvent.deleteMany({
      where: { createdAt: { lt: deleteWebhookAfter } }
    });
    deletedCount += webhookDeleted.count;

    // 4. 거부된 로그인 시도: 90일 경과 → 삭제
    const auditDeleted = await prisma.auditLog.deleteMany({
      where: {
        action: 'LOGIN',
        status: 'FAILED',
        createdAt: { lt: deleteSmsAfter }
      }
    });
    deletedCount += auditDeleted.count;

    logger.log('[DataRetention] Cleanup 완료', { deletedCount });

    return NextResponse.json({
      ok: true,
      message: 'Data retention cleanup completed',
      deletedRecords: deletedCount
    });

  } catch (err) {
    logger.error('[DataRetention] Cleanup 오류', { err });
    return NextResponse.json({ ok: false, error: 'Cleanup failed' }, { status: 500 });
  }
}
```

**예상 소요시간**: 3시간  
**담당**: Agent-ADM

---

#### P2-3: GDPR 개인정보 접근권 구현
**상태**: 미구현  
**구현 위치**: `src/app/api/admin/compliance/data-access/route.ts` (신규)  
**변경 내용**:

```typescript
// GET /api/admin/compliance/data-access?contactId=xxx
// 개인이 자신의 모든 데이터 요청 (GDPR 제15조)

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contactId');

  if (!contactId) {
    return NextResponse.json(
      { ok: false, error: 'contactId is required' },
      { status: 400 }
    );
  }

  // Contact의 모든 데이터 수집
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      crmMarketingMessages: true,
      smsLogs: true,
      emailLogs: true,
      callLogs: true,
      crmMarketingCampaigns: true,
      nextBestActions: true,
    }
  });

  if (!contact) {
    return NextResponse.json(
      { ok: false, error: 'Contact not found' },
      { status: 404 }
    );
  }

  // JSON 파일로 압축
  const zip = new JSZip();
  zip.file('contact.json', JSON.stringify(contact, null, 2));
  zip.file('messages.json', JSON.stringify(contact.crmMarketingMessages, null, 2));
  zip.file('sms_logs.json', JSON.stringify(contact.smsLogs, null, 2));
  // ... 다른 파일들

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="contact_data_${contactId}.zip"`,
    }
  });
}
```

**예상 소요시간**: 4시간  
**담당**: Agent-ADM

---

## 📅 Phase 3: 고급 기능 (2026-07-01 ~ 2026-07-15, 2주)

### 🟡 P3 - 낮음 (7월 중순까지)

#### P3-1: XSS/CSRF 방어
**상태**: 미구현  
**구현 위치**: `next.config.js`, middleware  
**변경 내용**:

```javascript
// next.config.js
module.exports = {
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};
```

**예상 소요시간**: 2시간  
**담당**: Agent-SET

---

#### P3-2: API 버전 관리
**상태**: 미구현  
**구현 위치**: API 라우팅 재구성  
**변경 내용**:

```
src/app/api/v1/messages/route.ts (현재 API 호환)
src/app/api/v1/contacts/route.ts
src/app/api/v1/campaigns/route.ts
...

향후:
src/app/api/v2/messages/route.ts (새로운 기능)
```

**예상 소요시간**: 6시간  
**담당**: Agent-LIB

---

#### P3-3: 보안 감시 대시보드
**상태**: 미구현  
**구현 위치**: `src/app/(dashboard)/admin/security-monitor/page.tsx` (신규)  
**변경 내용**:

```typescript
// 실시간 보안 모니터링 UI
// 1. 실패한 로그인 시도 (1시간 내 > 5회)
// 2. 비정상적인 데이터 접근 (1시간 내 > 1000건)
// 3. API 오류율 (> 1%)
// 4. 컴플라이언스 점수 (72% → 95%)
// 5. 미해결 감사 항목
```

**예상 소요시간**: 8시간  
**담당**: Agent-ADM

---

## 📅 Phase 4: 최종 검증 (2026-07-16 ~ 2026-07-31, 2주)

### 🟢 P4 - 검증 & 배포

#### P4-1: 외부 보안 감사 (Penetration Testing)
**비용**: $5K ~ $10K  
**기관**: 한국 정보보호 전문 회사 (예: 이스트시큐리티, 알테리스)  
**범위**:
- 웹 애플리케이션 취약점 스캔
- API 보안 테스트
- 인증/인가 검증
- 데이터 보호 확인

**예상 소요시간**: 2주 (외부)  
**담당**: 보안팀 + 외부 감사인

---

#### P4-2: 컴플라이언스 최종 검증
**체크리스트**:
- [ ] GDPR 체크리스트 (15개 항목 모두 ✅)
- [ ] CCPA 체크리스트 (8개 항목 모두 ✅)
- [ ] 한국 개인정보보호법 (12개 항목 모두 ✅)
- [ ] 통신비밀보호법 (5개 항목 모두 ✅)

**점수 목표**: 95/100 (목표)

**예상 소요시간**: 3일  
**담당**: 법무팀 + 보안팀

---

#### P4-3: 프로덕션 배포
**전제조건**:
- [ ] 모든 P0 항목 완료 ✅
- [ ] 모든 P1 항목 완료 ✅
- [ ] 모든 P2 항목 완료 ✅
- [ ] 외부 감사 통과 ✅
- [ ] 컴플라이언스 점수 95+ ✅

**배포 절차**:
1. Staging 환경 배포
2. 24시간 모니터링
3. 프로덕션 배포 (롤링 배포, 5% → 50% → 100%)
4. 배포 후 모니터링 (첫 주 매일 체크)

**예상 소요시간**: 1일  
**담당**: DevOps팀

---

## 📊 진행 현황 추적

### 주간 목표

| 주 | 기간 | 목표 | 예상 소요시간 |
|----|------|------|------------|
| **W1** | 6/2~6/8 | P0-1, P0-2, P0-3 완료 | 14h |
| **W2** | 6/9~6/15 | P1-1, P1-2, P1-3 완료 | 11h |
| **W3** | 6/16~6/22 | P2-1, P2-2, P2-3 완료 | 11h |
| **W4** | 6/23~6/29 | P3-1, P3-2, P3-3 완료 | 16h |
| **W5** | 6/30~7/6 | 외부 감사 준비 | 8h |
| **W6-7** | 7/7~7/20 | 외부 감사 + 최종 검증 | (외부) |
| **W8** | 7/21~7/31 | 최종 배포 | 1h |

**총 소요시간**: ~61시간 (내부 개발) + 2주 (외부 감사)

---

## 🎯 성공 지표

| 메트릭 | 현재 | 목표 | 마감 |
|--------|------|------|------|
| 컴플라이언스 점수 | 72% | 95% | 2026-07-31 |
| P0 항목 완료율 | 0% | 100% | 2026-06-15 |
| P1 항목 완료율 | 30% | 100% | 2026-06-30 |
| GDPR 준수율 | 60% | 100% | 2026-07-15 |
| 감사 로그 기록율 | 0% | 100% | 2026-06-30 |
| 데이터 암호화율 | 20% | 100% | 2026-06-15 |

---

## 📋 체크리스트 (인쇄용)

### Phase 1 (2주)
- [ ] P0-1: Contact 동의 필드 (Prisma + API)
- [ ] P0-2: Phone/Email 암호화
- [ ] P0-3: 환경 변수 검증
- [ ] P1-1: SMS 동의 확인 로직
- [ ] P1-2: 감사 로그 기록 (모든 API)
- [ ] P1-3: 로그 마스킹

### Phase 2 (2주)
- [ ] P2-1: Rate Limiting
- [ ] P2-2: 자동 데이터 폐기 Cron
- [ ] P2-3: GDPR 개인정보 접근권

### Phase 3 (2주)
- [ ] P3-1: XSS/CSRF 방어
- [ ] P3-2: API 버전 관리
- [ ] P3-3: 보안 모니터링 대시보드

### Phase 4 (2주)
- [ ] P4-1: 외부 보안 감사
- [ ] P4-2: 컴플라이언스 최종 검증
- [ ] P4-3: 프로덕션 배포

---

**최종 목표**: 2026-07-31까지 GDPR/CCPA/KOR 준수 → 컴플라이언스 점수 95+ 달성 ✅
