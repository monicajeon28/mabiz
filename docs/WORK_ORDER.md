# mabiz CRM — 작업지시서 v1.0

> **작성일**: 2026-05-07  
> **감독**: 상위 0.1% 아키텍트 × 웹디자이너 공동 감독  
> **검토**: 10렌즈 병렬 토론 (아키텍처 / 보안 / 성능 / UX / 비즈니스 로직)  
> **원칙**: API → 서비스 레이어 → UI 순서 절대 준수. 데드코드·임시코드 금지.

---

## 📋 전체 빌드 순서 (Phase 0 → 4)

```
Phase 0  지뢰 제거 (뼈대 정리)     ← 반드시 먼저. 건너뛰면 이후 전체 꼬임
Phase 1  초대 링크 가입 플로우      ← 웹훅보다 먼저. 서비스 레이어 공유
Phase 2  GMcruise 웹훅 수신        ← Phase 1 서비스 레이어 재사용
Phase 3  이메일 알림               ← Phase 1·2 호출처 확정 후
Phase 4  Organization 관리 UI      ← 데이터 생성 완료 후 UI 작성
```

---

## Phase 0 — 지뢰 제거 (스키마 + 유틸 정비)

> **이 Phase를 건너뛰면**: SHA-256·bcrypt·qwe1 세 가지 비밀번호 방식이 공존하고,  
> OWNER 토큰 경쟁조건으로 중복 계정이 생기며, 이메일 암호화 키가 누출된다.

### 0-1. Prisma 스키마 3가지 추가

```prisma
// prisma/schema.prisma

model OrganizationMember {
  // 기존 필드 유지 + 아래 추가
  email  String?  // 알림 수신용 이메일 — 없으면 이메일 알림 불가
}

model Organization {
  // 기존 필드 유지 + 아래 추가
  status String @default("ACTIVE")  // ACTIVE | SUSPENDED | TERMINATED
  // plan 필드를 상태 관리에 오용하지 않기 위함
}

model OrgInviteToken {
  // token 기본값 교체: cuid() → API에서 직접 생성 (보안 토큰 엔트로피 확보)
  token  String  @unique  // @default(cuid()) 제거
  // usedByUserId 주석 명확화:
  usedByUserId   String?   // OrganizationMember.id (가입 완료한 멤버)
}
```

```bash
npx prisma migrate dev --name "add-member-email-org-status"
```

---

### 0-2. `src/lib/password.ts` — 비밀번호 유틸 중앙화

```typescript
// src/lib/password.ts
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error('비밀번호는 8자 이상이어야 합니다.');
  }
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;  // stored 없으면 무조건 실패 (qwe1 백도어 완전 제거)
  return bcrypt.compare(plain, hash);
}
```

> **수정 대상 파일**: `src/app/api/join/[token]/route.ts` L82  
> `createHash('sha256').update(body.password || 'qwe1')` → `hashPassword(body.password)` 교체

---

### 0-3. `EMAIL_ENCRYPT_KEY` 폴백 제거

```typescript
// src/lib/email.ts L5 — 수정
const ENCRYPT_KEY = process.env.EMAIL_ENCRYPT_KEY;
if (!ENCRYPT_KEY || ENCRYPT_KEY.length < 32) {
  throw new Error('[FATAL] EMAIL_ENCRYPT_KEY 환경변수가 설정되지 않았습니다.');
}
```

---

### 0-4. `BONSA_ORG_ID` 환경변수화

```typescript
// src/app/api/auth/register/free-marketer/route.ts L8 — 수정
// 'org_bonsa_cruisedot' 하드코딩 → 환경변수로 이전
const BONSA_ORG_ID = process.env.BONSA_ORG_ID;
if (!BONSA_ORG_ID) throw new Error('[FATAL] BONSA_ORG_ID 환경변수 필요');
```

---

### 0-5. 복합 인덱스 4개 추가 (성능 — 지금 안 하면 데이터 쌓인 뒤 마이그레이션 비용 큼)

```prisma
// GMcruise 테이블은 CRM이 마이그레이션 불가 → GMcruise 팀에 요청서로 전달
// 아래는 GMcruise 팀에게 전달할 인덱스 추가 요청:

// AffiliateSale:     (saleDate, status)         — 대시보드 월별 집계
// AffiliateRelation: (managerId, status)         — OWNER 팀원 조회
// CommissionLedger:  (profileId, entryType, isSettled) — 커미션 원장
// AffiliateLead:     (agentId, status)           — 리드 목록
```

---

## Phase 1 — 초대 링크 가입 플로우

> **순서**: 토큰 검증 API → 가입 API → 가입 UI → 토큰 생성 API  
> (UI를 먼저 만들면 API 설계가 UI에 끌려감 — 금지)

### 1-1. 토큰 생성 방식 교체

```typescript
// src/app/api/org/invite/route.ts — POST 핸들러 수정
import { randomBytes } from 'crypto';

// 기존 Prisma @default(cuid()) 대신 API에서 직접 생성
const token = randomBytes(32).toString('base64url'); // 256bit, URL-safe

// OWNER가 OWNER 토큰 발급하는 권한 에스컬레이션 차단
if (role === 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
  return NextResponse.json(
    { ok: false, error: 'OWNER 초대는 GLOBAL_ADMIN만 가능합니다.' },
    { status: 403 }
  );
}

// GLOBAL_ADMIN은 body에서 organizationId 명시 수신
let orgId: string;
if (ctx.role === 'GLOBAL_ADMIN') {
  const { organizationId: targetOrgId, role, expiresInDays = 14, note } = body;
  if (!targetOrgId) {
    return NextResponse.json({ ok: false, error: 'organizationId 필수' }, { status: 400 });
  }
  orgId = targetOrgId;
} else {
  orgId = requireOrgId(ctx);
}
```

---

### 1-2. `POST /api/join/[token]` — TOCTOU 경쟁조건 수정

```typescript
// 기존: findUnique → check usedAt → transaction (경쟁조건 취약)
// 수정: updateMany로 atomic 클레임

const claimed = await prisma.orgInviteToken.updateMany({
  where: {
    token,
    usedAt:    null,              // 아직 미사용
    expiresAt: { gt: new Date() }, // 만료 전
  },
  data: {
    usedAt: new Date(),
    // usedByUserId는 멤버 생성 후 별도 update
  },
});

if (claimed.count === 0) {
  return NextResponse.json(
    { ok: false, error: '이미 사용되었거나 만료된 초대입니다.', code: 'TOKEN_EXPIRED' },
    { status: 400 }
  );
}

// 이후 OrganizationMember 생성 + 세션 발급
```

---

### 1-3. `src/lib/organization.ts` — 서비스 레이어 (Phase 2 웹훅과 공유)

```typescript
// src/lib/organization.ts
// 이 파일이 핵심. 웹훅과 초대 링크 양쪽이 이 함수를 호출.
// route.ts 안에 인라인으로 쓰지 말 것.

export interface CreateOrgParams {
  name:                       string;
  externalAffiliateProfileId?: number;  // GMcruise 파트너 ID
  plan?:                      string;
}

export interface AddMemberParams {
  organizationId: string;
  role:           'OWNER' | 'AGENT' | 'FREE_SALES';
  displayName:    string;
  phone:          string;
  email?:         string;
  passwordHash:   string;
  mallUserId?:    number;  // GMcruise User.id (있으면 연결)
}

export async function findOrCreateOrganization(params: CreateOrgParams) {
  // externalAffiliateProfileId @unique 기반 멱등성
  if (params.externalAffiliateProfileId) {
    const existing = await prisma.organization.findUnique({
      where: { externalAffiliateProfileId: params.externalAffiliateProfileId },
    });
    if (existing) return { org: existing, created: false };
  }

  let slug = slugify(params.name);
  if (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const org = await prisma.organization.create({
    data: {
      name:   params.name,
      slug,
      plan:   params.plan ?? 'FREE',
      status: 'ACTIVE',
      ...(params.externalAffiliateProfileId
        ? { externalAffiliateProfileId: params.externalAffiliateProfileId }
        : {}),
    },
  });

  return { org, created: true };
}

export async function addOrganizationMember(params: AddMemberParams) {
  return prisma.organizationMember.create({
    data: {
      organizationId: params.organizationId,
      role:           params.role,
      displayName:    params.displayName,
      isActive:       true,
      phone:          params.phone,
      email:          params.email ?? null,
      passwordHash:   params.passwordHash,
      userId:         params.mallUserId ? String(params.mallUserId) : cuid(),
    },
  });
}
```

---

### 1-4. 가입 완료 후 리다이렉트 수정

```typescript
// src/app/join/[token]/page.tsx L104 — 수정
// 기존: setTimeout(() => router.push('/dashboard'), 2500)
// 문제: 신규 가입자는 affiliateProfileId 없어서 대시보드가 403 반환

// 수정: welcome 페이지로 이동
setTimeout(() => router.push('/welcome'), 2000);
```

```typescript
// src/app/(auth)/welcome/page.tsx — 신규 생성
// 내용: "가입 완료! 관리자 승인 후 모든 기능을 사용할 수 있습니다."
// CTA: CRM 둘러보기 → /dashboard (KPI 없이 안내 문구만 표시)
```

---

## Phase 2 — GMcruise 웹훅 수신

> **전제**: Phase 1의 `src/lib/organization.ts` 서비스 레이어가 완성되어 있어야 함.  
> 웹훅 route.ts는 얇은 어댑터. 비즈니스 로직은 전부 서비스 레이어에.

### 2-1. 웹훅 보안 유틸 (`src/lib/webhook-verify.ts`)

```typescript
// src/lib/webhook-verify.ts
import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export function verifyGmcruiseWebhook(req: NextRequest, rawBody: string): void {
  const secret    = process.env.PARTNER_CONTRACT_WEBHOOK_SECRET;
  const signature = req.headers.get('x-gmcruise-signature') ?? '';
  const timestamp = req.headers.get('x-gmcruise-timestamp')  ?? '';

  if (!secret) throw new Error('PARTNER_CONTRACT_WEBHOOK_SECRET 미설정');

  // Replay attack 방어: ±5분 윈도우
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    throw Object.assign(new Error('Timestamp 만료'), { status: 401 });
  }

  // HMAC-SHA256 서명 검증 (시크릿 자체를 전선에 올리지 않음)
  const signingPayload = `${timestamp}.${rawBody}`;
  const expected = 'v1=' + createHmac('sha256', secret).update(signingPayload).digest('hex');
  const actual   = signature;

  if (
    expected.length !== actual.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  ) {
    throw Object.assign(new Error('서명 불일치'), { status: 401 });
  }
}
```

---

### 2-2. `POST /api/webhooks/gmcruise/contract-signed`

```typescript
// src/app/api/webhooks/gmcruise/contract-signed/route.ts
export const dynamic = 'force-dynamic';

// GMcruise payload 스펙 (GMcruise 팀에 전달)
interface ContractSignedPayload {
  contractId:               number;
  idempotencyKey:           string;   // UUID v4, 재시도 시 동일값 유지
  completedAt:              string;   // ISO 8601
  externalAffiliateProfileId: number; // AffiliateProfile.id
  partnerName:              string;
  ownerName:                string;
  ownerPhone:               string;
  ownerEmail:               string;
  contractType:             '330' | '540' | '750';
  contractStatus:           'COMPLETED';
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    verifyGmcruiseWebhook(req, rawBody);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    logger.warn('[webhook/contract-signed] 서명 검증 실패', { msg: err.message });
    return NextResponse.json({ ok: false }, { status: err.status ?? 401 });
  }

  const body = JSON.parse(rawBody) as ContractSignedPayload;

  // contractStatus 가드
  if (body.contractStatus !== 'COMPLETED') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Organization 생성 (멱등성 내장)
  const { org, created } = await findOrCreateOrganization({
    name:                       body.partnerName,
    externalAffiliateProfileId: body.externalAffiliateProfileId,
  });

  if (!created) {
    logger.log('[webhook/contract-signed] 중복 수신', { orgId: org.id });
    return NextResponse.json({ ok: true, duplicate: true, orgId: org.id });
  }

  // GLOBAL_ADMIN 이메일 알림 (비차단)
  notifyNewOrganization(org.id, body.partnerName, body.ownerEmail).catch(
    (e) => logger.error('[webhook] 이메일 실패', { e })
  );

  logger.warn('[webhook/contract-signed] 파트너 조직 생성', {
    orgId: org.id,
    contractId: body.contractId,
    partnerName: body.partnerName,
  });

  return NextResponse.json({ ok: true, orgId: org.id });
}
```

---

## Phase 3 — 이메일 알림

### 3-1. `src/lib/system-email.ts` — 시스템 전용 발신자

```typescript
// src/lib/system-email.ts
// 조직 SMTP와 별도 — 본사 알림 발송용
import nodemailer from 'nodemailer';

export async function sendSystemEmail(params: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<boolean> {
  const host = process.env.SYSTEM_SMTP_HOST;
  const user = process.env.SYSTEM_SMTP_USER;
  const pass = process.env.SYSTEM_SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn('[SystemEmail] 시스템 SMTP 미설정 — 발송 생략');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port: 587, secure: false,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"크루즈닷 CRM" <${user}>`,
      ...params,
    });
    return true;
  } catch (e) {
    logger.error('[SystemEmail] 발송 실패', { e });
    return false;
  }
}
```

---

### 3-2. `src/lib/email-templates.ts` — 알림 이메일 2종

```typescript
// src/lib/email-templates.ts

/** 파트너 가입 완료 → OWNER 수신 */
export function renderPartnerJoinedEmail(vars: {
  ownerName:    string;
  partnerName:  string;
  partnerPhone: string;  // 마스킹 처리 후 전달
  partnerRole:  string;
  joinedAt:     string;
  crmUrl:       string;
}) {
  const roleLabel: Record<string, string> = {
    AGENT: '정식판매원', FREE_SALES: '프리세일즈', OWNER: '대리점장',
  };
  return {
    subject: `[크루즈닷 CRM] ${vars.partnerName}님이 파트너로 가입했습니다`,
    html: `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">
        <!-- 헤더 -->
        <tr><td style="background:#0f4c81;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#93c5fd;">크루즈닷 파트너 CRM</p>
          <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#fff;">새 파트너가 가입했습니다</h1>
        </td></tr>
        <!-- 본문 -->
        <tr><td style="background:#fff;padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
            안녕하세요, <strong style="color:#0f4c81;">${vars.ownerName}</strong> 대리점장님.<br>
            아래 파트너가 초대 링크로 가입을 완료했습니다.
          </p>
          <!-- 정보 카드 -->
          <table width="100%" style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%">
                <tr>
                  <td style="font-size:12px;color:#6b7280;">이름</td>
                  <td style="font-size:15px;font-weight:600;color:#111827;text-align:right;">${vars.partnerName}</td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:12px;color:#6b7280;">전화번호</td>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:15px;font-weight:600;text-align:right;">${vars.partnerPhone}</td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:12px;color:#6b7280;">역할</td>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:15px;font-weight:600;color:#0f4c81;text-align:right;">${roleLabel[vars.partnerRole] ?? vars.partnerRole}</td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:12px;color:#6b7280;">가입일시</td>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:13px;color:#374151;text-align:right;">${vars.joinedAt}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <!-- CTA -->
          <table width="100%"><tr><td align="center">
            <a href="${vars.crmUrl}/org/members"
              style="display:inline-block;background:#0f4c81;color:#fff;font-size:15px;font-weight:600;
                     text-decoration:none;padding:14px 32px;border-radius:8px;min-width:180px;text-align:center;">
              팀원 관리 바로가기 →
            </a>
          </td></tr></table>
        </td></tr>
        <!-- 푸터 -->
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">크루즈닷 파트너 CRM 자동 알림 · 문의: support@cruisedot.co.kr</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

/** 신규 조직 생성 → GLOBAL_ADMIN 수신 */
export function renderNewOrgEmail(vars: { orgName: string; orgId: string; crmUrl: string }) {
  return {
    subject: `[크루즈닷 CRM] 신규 대리점 등록: ${vars.orgName}`,
    html: `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">
        <tr><td style="background:#0f4c81;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">신규 대리점이 등록되었습니다</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#374151;">GMcruise 계약 완료 웹훅으로 자동 생성된 조직입니다.</p>
          <table width="100%" style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%">
                <tr>
                  <td style="font-size:12px;color:#6b7280;">대리점명</td>
                  <td style="font-size:15px;font-weight:600;text-align:right;">${vars.orgName}</td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:12px;color:#6b7280;">조직 ID</td>
                  <td style="border-top:1px solid #dbeafe;padding-top:10px;font-size:12px;font-family:monospace;text-align:right;">${vars.orgId}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <table width="100%"><tr><td align="center">
            <a href="${vars.crmUrl}/admin/organizations/${vars.orgId}"
              style="display:inline-block;background:#0f4c81;color:#fff;font-size:15px;font-weight:600;
                     text-decoration:none;padding:14px 32px;border-radius:8px;text-align:center;">
              대리점 상세 보기 →
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">크루즈닷 파트너 CRM 자동 알림</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
```

---

## Phase 4 — Organization 관리 UI

> **순서**: API 먼저, UI 나중. 빈 DB에서 UI 작성 금지.

### 4-1. API 엔드포인트 목록

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| `GET` | `/api/organizations` | GLOBAL_ADMIN | 전체 대리점 목록 |
| `GET` | `/api/organizations/[id]` | GLOBAL_ADMIN, OWNER(본인) | 대리점 상세 |
| `GET` | `/api/organizations/[id]/members` | GLOBAL_ADMIN, OWNER(본인) | 멤버 목록 |
| `PATCH` | `/api/organizations/[id]/members/[userId]` | GLOBAL_ADMIN, OWNER(본인) | 멤버 역할/활성화 변경 |
| `POST` | `/api/org/invite` | GLOBAL_ADMIN, OWNER | 초대 토큰 생성 |
| `GET` | `/api/org/invite` | GLOBAL_ADMIN, OWNER | 내 조직 토큰 목록 |
| `DELETE` | `/api/org/invite/[id]` | GLOBAL_ADMIN, OWNER | 초대 토큰 취소 |
| `GET` | `/api/join/[token]` | 공개 | 토큰 유효성 조회 |
| `POST` | `/api/join/[token]` | 공개 | 가입 처리 |

---

### 4-2. 초대 링크 관리 UI (`/dashboard/org/invite`)

**디자인 원칙**: 속도·효율 최우선. 모바일 44px 터치 타겟. 불필요한 장식 제거.

**필수 요소**:
1. 역할 선택 (AGENT / FREE_SALES) + 메모 + 만료 기간 선택 (7일 / 14일 / 30일) → 생성 버튼
2. 생성된 URL → **QR 코드** (`qrcode.react`, 3KB gzip) + 복사 버튼 + 만료일 표시
3. 기존 토큰 목록 — 사용됨 / 만료됨 / 유효 상태 뱃지 + 취소 버튼

```typescript
// QR코드 컴포넌트 예시
import QRCode from 'qrcode.react';
<QRCode value={inviteUrl} size={200} level="M" includeMargin />
```

**모바일 특이사항**: QR을 화면에 띄워 상대방이 스캔 → 즉시 가입. 인쇄 버튼으로 오프라인 세미나 배포 가능.

---

### 4-3. 대시보드 KPI 카드 — 클릭 가능하게

```typescript
// src/app/(dashboard)/dashboard/page.tsx — KpiCard 수정
// 현재: <div> 클릭 불가
// 수정: <Link href={href}> 로 감싸기

interface KpiCardProps {
  label:  string;
  value:  string | number;
  color?: string;
  href?:  string;  // 추가
}

// 연결 목적지
// "승인 대기 N건" → /affiliate-sales?status=PENDING
// "골드회원 N명"  → /gold-members
// "팀원 N명"      → /team
```

---

### 4-4. 멤버 비활성화 시 세션 즉시 무효화

```typescript
// PATCH /api/organizations/[id]/members/[userId] — 비활성화 처리 시 추가
await prisma.mabizSession.deleteMany({
  where: { memberId: targetMember.id },
});
// 이것 없으면 퇴사자가 최대 30일간 로그인 상태 유지됨
```

---

## 환경변수 추가 목록 (새로 필요한 것)

| 키 | 설명 | 예시 |
|----|------|------|
| `BONSA_ORG_ID` | 본사 조직 ID | `org_bonsa_cruisedot` |
| `PARTNER_CONTRACT_WEBHOOK_SECRET` | GMcruise 계약 웹훅 HMAC 시크릿 | `openssl rand -hex 32` |
| `SYSTEM_SMTP_HOST` | 시스템 알림 SMTP 호스트 | `smtp.gmail.com` |
| `SYSTEM_SMTP_USER` | 시스템 SMTP 계정 | `noreply@cruisedot.co.kr` |
| `SYSTEM_SMTP_PASS` | 시스템 SMTP 비밀번호 | Gmail 앱 비밀번호 |
| `GLOBAL_ADMIN_NOTIFY_EMAIL` | 웹훅 알림 수신 어드민 이메일 | `admin@cruisedot.co.kr` |

---

## GMcruise 팀에게 전달할 것

### 웹훅 발신 스펙 (계약서 서명 완료 시)

```
POST https://mabiz.vercel.app/api/webhooks/gmcruise/contract-signed
Content-Type: application/json
X-GMcruise-Signature: v1=<HMAC-SHA256(PARTNER_CONTRACT_WEBHOOK_SECRET, timestamp.body)>
X-GMcruise-Timestamp: <Unix epoch seconds>
X-GMcruise-Idempotency-Key: <UUID v4, 재시도 시 동일값>

Body:
{
  "contractId": 123,
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "completedAt": "2026-05-07T10:30:00+09:00",
  "externalAffiliateProfileId": 456,
  "partnerName": "강남대리점",
  "ownerName": "홍길동",
  "ownerPhone": "01012345678",
  "ownerEmail": "hong@example.com",
  "contractType": "330",
  "contractStatus": "COMPLETED"
}
```

**재시도 정책**: `5xx` / 네트워크 오류만 재시도 (지수 백오프 3회). `4xx`와 `200 duplicate:true`는 성공으로 간주.

### GMcruise 팀에게 요청할 DB 인덱스 추가

```sql
-- GMcruise Neon DB에서 실행 요청
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_affiliate_sale_date_status
  ON "AffiliateSale" ("saleDate", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_affiliate_relation_manager_status
  ON "AffiliateRelation" ("managerId", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commission_ledger_profile_type
  ON "CommissionLedger" ("profileId", "entryType", "isSettled");
```

---

## 금지 사항 (절대 하지 말 것)

| 금지 | 이유 |
|------|------|
| UI → API 순서로 작성 | API 설계가 UI에 끌려가 나중에 양쪽 모두 재작성 |
| 웹훅 route.ts에 비즈니스 로직 인라인 | 초대 링크와 로직 중복 → drift 발생 |
| SHA-256 비밀번호 해싱 | Rainbow table에 즉시 크랙 |
| `cuid()`를 보안 토큰으로 사용 | 72bit 엔트로피, 타임스탬프 기반 구조 |
| OWNER가 OWNER 초대 토큰 발급 | 권한 에스컬레이션 |
| 평문 시크릿을 웹훅 헤더에 전송 | 네트워크 스니핑으로 시크릿 노출 |
| 멤버 비활성화 시 세션 미삭제 | 퇴사자 30일간 접근 가능 |
| `$queryRawUnsafe`에 ID 배열 인터폴레이션 | SQL Injection |
| `TO_CHAR(saleDate)` WHERE절 사용 | 인덱스 무력화 → 풀스캔 |
| 이메일 발송을 가입 처리에 동기 대기 | 발송 실패 시 가입 전체 롤백 |

---

## 완료 체크리스트

```
Phase 0
[ ] prisma migrate: OrganizationMember.email, Organization.status 추가
[ ] src/lib/password.ts 생성 (hashPassword / verifyPassword)
[ ] join/[token]/route.ts SHA-256 → bcrypt 교체
[ ] email.ts EMAIL_ENCRYPT_KEY 폴백 제거
[ ] BONSA_ORG_ID 환경변수화

Phase 1
[ ] OrgInviteToken 생성: randomBytes(32).toString('base64url')
[ ] OWNER → OWNER 토큰 발급 차단
[ ] GLOBAL_ADMIN 초대 시 organizationId 명시 수신
[ ] POST /api/join/[token] TOCTOU 수정 (updateMany)
[ ] src/lib/organization.ts 서비스 레이어 작성
[ ] 가입 완료 후 /welcome 이동
[ ] /welcome 페이지 생성

Phase 2
[ ] src/lib/webhook-verify.ts HMAC 검증 유틸
[ ] POST /api/webhooks/gmcruise/contract-signed
[ ] GMcruise에 웹훅 payload 스펙 전달

Phase 3
[ ] src/lib/system-email.ts 시스템 발신자
[ ] src/lib/email-templates.ts 2종 템플릿
[ ] join/[token]/route.ts 가입 완료 후 OWNER 이메일 알림
[ ] webhooks/contract-signed GLOBAL_ADMIN 알림

Phase 4
[ ] GET/PATCH /api/organizations 계열 API
[ ] /dashboard/org/invite UI (QR코드 포함)
[ ] KpiCard href 추가 (클릭 → 해당 목록)
[ ] PATCH members 시 MabizSession 즉시 삭제
[ ] GMcruise 팀에 DB 인덱스 추가 요청 전달
```

---

_이 작업지시서는 코드 변경 시 함께 업데이트하세요._  
_스키마·API·UI 순서를 바꾸면 반드시 아키텍처 팀과 재협의._
