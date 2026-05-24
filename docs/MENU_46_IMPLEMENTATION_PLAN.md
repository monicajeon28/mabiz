# Menu #46 (설정) - 10단계 구현 계획 (2026-05-24)

## 📋 개요

**총 예상 기간**: 3주 (21일)  
**팀 규모**: 2명 (FE 1명, BE 1명)  
**우선순위**: P0 (핵심 기능) → P1 (중요 기능) → P2 (부가 기능)

---

## 🎯 Phase별 구현 로드맵

### Phase 1: 설계 및 준비 (1주)
- [ ] Day 1-2: 아키텍처 설계 및 테크 스택 검증
- [ ] Day 3-4: 프로토타입 및 UI 목업 작성
- [ ] Day 5: 개발 환경 구축 및 DB 마이그레이션

### Phase 2: 백엔드 구현 (1.5주)
- [ ] Day 6-7: API 엔드포인트 (프로필, 팀)
- [ ] Day 8-9: API 엔드포인트 (알림, 통합)
- [ ] Day 10-11: API 엔드포인트 (데이터, 심리학)
- [ ] Day 12: 테스트 및 버그 수정

### Phase 3: 프론트엔드 구현 (1.5주)
- [ ] Day 13-14: UI 컴포넌트 및 페이지 (프로필, 팀)
- [ ] Day 15-16: UI 컴포넌트 및 페이지 (알림, 통합)
- [ ] Day 17-18: UI 컴포넌트 및 페이지 (데이터, 심리학)
- [ ] Day 19: 통합 테스트 및 버그 수정

### Phase 4: 배포 및 모니터링 (3일)
- [ ] Day 20: 보안 검증 및 성능 최적화
- [ ] Day 21: 배포 및 모니터링 셋업

---

## 📍 10단계 상세 구현

### ▶️ 단계 1: 데이터베이스 마이그레이션 (Day 5)

**목표**: 신규 Prisma 스키마 생성 및 마이그레이션 적용

**작업**:
1. `prisma/schema.prisma` 수정
   ```bash
   # 신규 모델 추가:
   - UserSettings
   - NotificationCategory
   - SmsSequenceCustomization
   - IntegrationKey
   - BackupLog
   - PsychologyGoal
   - AuditLog
   ```

2. 마이그레이션 생성
   ```bash
   npx prisma migrate dev --name add_menu_46_settings
   ```

3. 마이그레이션 검증
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. 환경변수 추가
   ```env
   ENCRYPTION_KEY=<32바이트 hex 문자열>
   GCS_BUCKET_NAME=<Google Cloud Storage 버킷명>
   ```

**체크리스트**:
- [ ] schema.prisma 문법 검증 (npx prisma validate)
- [ ] 마이그레이션 성공 확인
- [ ] 기존 데이터 호환성 확인
- [ ] 암호화 키 설정 확인

**산출물**:
- `prisma/migrations/[timestamp]_add_menu_46_settings/migration.sql`

---

### ▶️ 단계 2: 암호화 유틸리티 구현 (Day 6 초반)

**목표**: AES-256-GCM 암호화/복호화 함수 작성

**파일**: `src/lib/encryption.ts`

**구현 내용**:
```typescript
// src/lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
const ALGORITHM = 'aes-256-gcm';

export function encryptAES256(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptAES256(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function maskApiKey(fullKey: string): string {
  if (fullKey.length < 8) return '****';
  return `${fullKey.slice(0, 2)}****...${fullKey.slice(-6)}`;
}
```

**테스트**:
```typescript
// src/lib/__tests__/encryption.test.ts
describe('Encryption', () => {
  it('should encrypt and decrypt', () => {
    const original = 'test_api_key_123';
    const encrypted = encryptAES256(original);
    const decrypted = decryptAES256(encrypted);
    expect(decrypted).toBe(original);
  });
  
  it('should mask api key correctly', () => {
    const key = 'ck_live_abc123xyz789';
    const masked = maskApiKey(key);
    expect(masked).toBe('ck****...xyz789');
  });
});
```

**체크리스트**:
- [ ] 암호화/복호화 함수 테스트 (100% 커버)
- [ ] 환경변수 키 생성 (openssl rand -hex 32)
- [ ] 마스킹 함수 검증

---

### ▶️ 단계 3: 공통 API 미들웨어 (Day 6)

**목표**: 인증, 권한 검증, CSRF, Rate Limiting 미들웨어 작성

**파일**: `src/lib/middleware.ts`

**구현 내용**:
```typescript
// src/lib/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

// 1. 인증 미들웨어
export async function requireAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new NextResponse(
      JSON.stringify({ error: 'UNAUTHORIZED', message: '인증이 필요합니다' }),
      { status: 401 }
    );
  }
  
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return new NextResponse(
      JSON.stringify({ error: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다' }),
      { status: 401 }
    );
  }
}

// 2. 권한 검증 미들웨어
export async function requireRole(req: NextRequest, requiredRole: 'OWNER' | 'AGENT' | 'FREE_SALES') {
  const user = await requireAuth(req);
  const orgId = req.nextUrl.searchParams.get('organizationId');
  
  if (!orgId) {
    return new NextResponse(
      JSON.stringify({ error: 'INVALID_REQUEST', message: '조직 ID가 필요합니다' }),
      { status: 400 }
    );
  }
  
  const member = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: user.sub as string, organizationId: orgId },
    },
  });
  
  if (!member) {
    return new NextResponse(
      JSON.stringify({ error: 'FORBIDDEN', message: '조직 접근 권한이 없습니다' }),
      { status: 403 }
    );
  }
  
  const roleHierarchy = { OWNER: 3, AGENT: 2, FREE_SALES: 1 };
  if (roleHierarchy[member.role as keyof typeof roleHierarchy] < roleHierarchy[requiredRole]) {
    return new NextResponse(
      JSON.stringify({ error: 'FORBIDDEN', message: '권한이 부족합니다' }),
      { status: 403 }
    );
  }
  
  return { user: user.sub, orgId, role: member.role };
}

// 3. CSRF 토큰 검증
export function requireCSRF(req: NextRequest) {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers.get('x-csrf-token');
    const sessionToken = req.cookies.get('session')?.value;
    
    if (!csrfToken || !sessionToken) {
      return new NextResponse(
        JSON.stringify({ error: 'FORBIDDEN', message: 'CSRF 토큰이 필요합니다' }),
        { status: 403 }
      );
    }
    
    // CSRF 토큰 검증 (Redis 또는 DB에서)
    // TODO: 구현
  }
}

// 4. Rate Limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(req: NextRequest, limit: number, windowMs: number = 60000) {
  const key = `${req.ip}:${req.nextUrl.pathname}`;
  const now = Date.now();
  
  let record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }
  
  record.count++;
  rateLimitMap.set(key, record);
  
  if (record.count > limit) {
    return new NextResponse(
      JSON.stringify({ error: 'RATE_LIMITED', message: '너무 많은 요청입니다' }),
      { status: 429, headers: { 'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString() } }
    );
  }
}
```

**체크리스트**:
- [ ] JWT 검증 로직 테스트
- [ ] 권한 검증 로직 테스트 (OWNER/AGENT/FREE_SALES)
- [ ] Rate Limiting 검증

---

### ▶️ 단계 4: 프로필 API (Day 6-7)

**목표**: 사용자 프로필 조회/수정/업로드 API 구현

**엔드포인트**:
- `GET /api/settings/profile`
- `PATCH /api/settings/profile`
- `POST /api/upload/avatar`
- `POST /api/upload/signature`
- `POST /api/auth/change-password`

**구현 파일**:
```
src/app/api/settings/profile/route.ts
src/app/api/upload/avatar/route.ts
src/app/api/upload/signature/route.ts
src/app/api/auth/change-password/route.ts
```

**핵심 구현**:
```typescript
// src/app/api/settings/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireCSRF, checkRateLimit } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  
  const user = await prisma.user.findUnique({
    where: { id: auth.sub as string },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profileImageUrl: true,
      signatureImageUrl: true,
      createdAt: true,
    },
  });
  
  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  
  return NextResponse.json({ ok: true, data: user });
}

export async function PATCH(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 30); // 30 req/min
  if (rateLimit) return rateLimit;
  
  const auth = await requireAuth(req);
  const csrf = requireCSRF(req);
  if (csrf) return csrf;
  
  const body = await req.json();
  
  // 유효성 검사
  if (body.name && (body.name.length < 1 || body.name.length > 50)) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: '이름은 1-50자여야 합니다' },
      { status: 400 }
    );
  }
  
  const updated = await prisma.user.update({
    where: { id: auth.sub as string },
    data: {
      name: body.name,
      phone: body.phone,
      // ... 기타 필드
    },
  });
  
  // 감사 로그
  await prisma.auditLog.create({
    data: {
      userId: auth.sub as string,
      organizationId: body.organizationId, // 쿼리에서 추출
      action: 'UPDATE',
      resource: 'SETTINGS',
      resourceId: 'profile',
      changes: JSON.stringify({ before: {}, after: { name: body.name } }),
      status: 'SUCCESS',
    },
  });
  
  return NextResponse.json({
    ok: true,
    data: updated,
    message: '프로필이 저장되었습니다',
  });
}
```

**Google Cloud Storage 업로드**:
```typescript
// src/app/api/upload/avatar/route.ts
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: '파일이 필요합니다' },
      { status: 400 }
    );
  }
  
  // 파일 크기 검증
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: '파일 크기가 5MB를 초과합니다' },
      { status: 400 }
    );
  }
  
  // 이미지 검증 및 리사이징
  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  
  if (!metadata.width || !metadata.height || metadata.width < 200 || metadata.height < 200) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: '이미지 해상도가 200x200px 이상이어야 합니다' },
      { status: 400 }
    );
  }
  
  // GCS에 업로드
  const filename = `avatars/${auth.sub}/${Date.now()}.jpg`;
  const uploadFile = bucket.file(filename);
  
  await uploadFile.save(buffer, {
    metadata: { contentType: 'image/jpeg' },
  });
  
  // 임시 URL 생성 (24시간 유효)
  const [url] = await uploadFile.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 24 * 60 * 60 * 1000,
  });
  
  // 사용자 프로필 업데이트
  await prisma.user.update({
    where: { id: auth.sub as string },
    data: { profileImageUrl: url },
  });
  
  return NextResponse.json({
    ok: true,
    data: { url, uploadedAt: new Date() },
    message: '이미지가 업로드되었습니다',
  });
}
```

**체크리스트**:
- [ ] 프로필 조회/수정 API 완성
- [ ] 이미지 업로드 API 완성
- [ ] 유효성 검사 구현
- [ ] 감사 로그 기록
- [ ] 엣지 케이스 테스트 (빈 파일, 너무 큰 파일 등)

---

### ▶️ 단계 5: 팀 관리 API (Day 7)

**목표**: 팀 멤버 조회/초대/역할 변경 API 구현

**엔드포인트**:
- `GET /api/org/info`
- `PATCH /api/org/info`
- `GET /api/settings/team/members`
- `PATCH /api/settings/team/members/{userId}/role`
- `DELETE /api/settings/team/members/{userId}`
- `POST /api/settings/team/invite`
- `GET /api/settings/team/invite-tokens`

**구현 파일**:
```
src/app/api/org/info/route.ts (기존 확장)
src/app/api/settings/team/members/route.ts
src/app/api/settings/team/members/[userId]/route.ts
src/app/api/settings/team/invite/route.ts
src/app/api/settings/team/invite-tokens/route.ts
```

**핵심: 초대 토큰 생성**:
```typescript
// src/app/api/settings/team/invite/route.ts
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  const body = await req.json();
  
  // OWNER 권한 확인
  const member = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: auth.sub as string,
        organizationId: body.organizationId,
      },
    },
  });
  
  if (member?.role !== 'OWNER') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  
  // 토큰 생성
  const token = `inv_${nanoid(32)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일
  
  const inviteToken = await prisma.orgInviteToken.create({
    data: {
      organizationId: body.organizationId,
      token,
      role: body.role,
      email: body.email,
      note: body.note,
      expiresAt,
    },
  });
  
  // QR 코드 생성
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
  const qrCode = await QRCode.toDataURL(url);
  
  return NextResponse.json({
    ok: true,
    data: {
      inviteToken: {
        id: inviteToken.id,
        token,
        url,
        qrCode,
        expiresAt,
        createdAt: inviteToken.createdAt,
      },
    },
    message: '초대 링크가 생성되었습니다',
  });
}
```

**체크리스트**:
- [ ] 팀 멤버 목록 조회 (페이징)
- [ ] 초대 토큰 생성 및 QR 코드
- [ ] 역할 변경 (마지막 OWNER 보호)
- [ ] 멤버 제거 (세션 로그아웃)
- [ ] 감사 로그 기록

---

### ▶️ 단계 6: 알림 설정 API (Day 8)

**목표**: 알림 채널 및 카테고리 설정 API 구현

**엔드포인트**:
- `GET /api/settings/notifications`
- `PATCH /api/settings/notifications`
- `GET /api/settings/notifications/sms-sequence`
- `PATCH /api/settings/notifications/sms-sequence`

**핵심 구현**:
```typescript
// src/app/api/settings/notifications/route.ts
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  const orgId = req.nextUrl.searchParams.get('organizationId');
  
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId_organizationId: { userId: auth.sub as string, organizationId: orgId! } },
    include: { notificationCategories: true },
  });
  
  if (!userSettings) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  
  return NextResponse.json({
    ok: true,
    data: {
      smsNotifications: userSettings.smsNotifications,
      emailNotifications: userSettings.emailNotifications,
      pushNotifications: userSettings.pushNotifications,
      smsPhone: userSettings.smsPhone,
      emailAddress: userSettings.emailAddress,
      categories: userSettings.notificationCategories.reduce((acc, cat) => {
        acc[cat.categoryType.toLowerCase()] = {
          enabled: cat.isEnabled,
          channels: cat.channels,
          config: JSON.parse(cat.config),
        };
        return acc;
      }, {} as Record<string, any>),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  const body = await req.json();
  
  // UserSettings 업데이트
  const updated = await prisma.userSettings.update({
    where: {
      userId_organizationId: {
        userId: auth.sub as string,
        organizationId: body.organizationId,
      },
    },
    data: {
      smsNotifications: body.smsNotifications,
      emailNotifications: body.emailNotifications,
      pushNotifications: body.pushNotifications,
      smsPhone: body.smsPhone,
      emailAddress: body.emailAddress,
    },
    include: { notificationCategories: true },
  });
  
  // 카테고리별 설정 업데이트
  if (body.categories) {
    for (const [categoryType, settings] of Object.entries(body.categories)) {
      const categoryUpperCase = categoryType.toUpperCase();
      
      await prisma.notificationCategory.upsert({
        where: {
          userSettingsId_categoryType: {
            userSettingsId: updated.id,
            categoryType: categoryUpperCase,
          },
        },
        update: {
          isEnabled: (settings as any).enabled,
          channels: (settings as any).channels,
          config: JSON.stringify((settings as any).config),
        },
        create: {
          userSettingsId: updated.id,
          categoryType: categoryUpperCase,
          isEnabled: (settings as any).enabled,
          channels: (settings as any).channels,
          config: JSON.stringify((settings as any).config),
        },
      });
    }
  }
  
  return NextResponse.json({
    ok: true,
    data: updated,
    message: '알림 설정이 저장되었습니다',
  });
}
```

**체크리스트**:
- [ ] 알림 채널 토글 구현
- [ ] SMS 시퀀스 커스터마이징
- [ ] 카테고리별 설정 (JSON 저장)
- [ ] 변수 삽입 검증 ({변수명} 형식)

---

### ▶️ 단계 7: 통합 API (Day 8-9)

**목표**: 외부 서비스 통합 (API 키, OAuth, 웹훅)

**엔드포인트**:
- `POST /api/settings/integrations/api-key`
- `PATCH /api/settings/integrations/api-key/{provider}`
- `DELETE /api/settings/integrations/api-key/{provider}`
- `POST /api/settings/integrations/{provider}/test`
- `POST /api/settings/integrations/gmail/auth-url`
- `POST /api/settings/integrations/gmail/callback`

**API 키 저장**:
```typescript
// src/app/api/settings/integrations/api-key/route.ts
import { encryptAES256, maskApiKey } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  const body = await req.json();
  
  // OWNER 권한 확인
  const member = await checkOwnerRole(auth.sub as string, body.organizationId);
  if (!member) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  
  // API 키 암호화
  const keyEncrypted = encryptAES256(body.apiKey);
  const secretEncrypted = body.apiSecret ? encryptAES256(body.apiSecret) : null;
  
  const key = await prisma.integrationKey.upsert({
    where: {
      organizationId_providerName: {
        organizationId: body.organizationId,
        providerName: body.provider,
      },
    },
    update: {
      keyEncrypted,
      secretEncrypted,
      isActive: true,
    },
    create: {
      organizationId: body.organizationId,
      providerName: body.provider,
      keyEncrypted,
      secretEncrypted,
      isActive: true,
    },
  });
  
  // 감사 로그
  await auditLog(auth.sub as string, body.organizationId, 'CREATE', 'API_KEY', body.provider);
  
  return NextResponse.json({
    ok: true,
    data: {
      provider: key.providerName,
      isActive: key.isActive,
      keyPreview: maskApiKey(body.apiKey),
    },
    message: 'API 키가 저장되었습니다',
  });
}
```

**Gmail OAuth**:
```typescript
// src/app/api/settings/integrations/gmail/auth-url/route.ts
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations/callback`
  );
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['gmail.send', 'gmail.readonly'],
  });
  
  const state = nanoid(32);
  // Redis에 state 저장 (CSRF 방지)
  
  return NextResponse.json({
    ok: true,
    data: { authUrl, state },
  });
}
```

**체크리스트**:
- [ ] API 키 암호화/복호화
- [ ] Gmail OAuth 플로우
- [ ] Slack 웹훅 테스트
- [ ] SMTP 연결 테스트
- [ ] 실패 시 에러 메시지

---

### ▶️ 단계 8: 데이터 관리 API (Day 9-10)

**목표**: 백업, 내보내기, 복구 API 구현

**엔드포인트**:
- `POST /api/settings/backup/create`
- `GET /api/settings/backup/logs`
- `POST /api/settings/export`
- `GET /api/settings/recovery/deleted-items`
- `POST /api/settings/recovery/restore/{id}`

**백업 구현**:
```typescript
// src/app/api/settings/backup/create/route.ts
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  const body = await req.json();
  
  // OWNER 권한 확인
  const member = await checkOwnerRole(auth.sub as string, body.organizationId);
  if (!member) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  
  // 백업 로그 생성
  const backupLog = await prisma.backupLog.create({
    data: {
      organizationId: body.organizationId,
      backupType: body.type,
      status: 'PENDING',
    },
  });
  
  // 백그라운드 작업 큐에 추가 (Bull/BullMQ)
  await backupQueue.add({
    backupId: backupLog.id,
    organizationId: body.organizationId,
    type: body.type,
  });
  
  return NextResponse.json({
    ok: true,
    data: {
      backupId: backupLog.id,
      status: 'PENDING',
    },
    message: '백업이 시작되었습니다',
  });
}

// 백그라운드 워커 (worker.ts)
export async function processBackup(job: Job) {
  const { backupId, organizationId, type } = job.data;
  
  try {
    // 1. 데이터 수집
    const contacts = type === 'FULL' || type === 'CONTACTS_ONLY'
      ? await prisma.contact.findMany({ where: { organizationId } })
      : [];
    
    const deals = type === 'FULL' || type === 'DEALS_ONLY'
      ? await prisma.contract.findMany({ where: { organizationId } })
      : [];
    
    // 2. ZIP 파일로 압축
    const zip = new JSZip();
    zip.file('contacts.json', JSON.stringify(contacts));
    zip.file('deals.json', JSON.stringify(deals));
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // 3. GCS에 업로드
    const filename = `backups/${organizationId}/${backupId}.zip`;
    const uploadFile = bucket.file(filename);
    await uploadFile.save(zipBuffer);
    
    // 4. DB 업데이트
    await prisma.backupLog.update({
      where: { id: backupId },
      data: {
        status: 'COMPLETED',
        fileUrl: `gs://${bucket.name}/${filename}`,
        fileSize: zipBuffer.length,
        completedAt: new Date(),
      },
    });
    
    // 5. 이메일 발송 (선택)
    if (job.data.sendEmail) {
      await sendBackupCompleteEmail(organizationId, filename);
    }
  } catch (error) {
    await prisma.backupLog.update({
      where: { id: backupId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });
    throw error;
  }
}
```

**체크리스트**:
- [ ] 백업 타입별 데이터 수집
- [ ] ZIP 압축 및 GCS 업로드
- [ ] 복구 인터페이스 (soft delete 활용)
- [ ] 30일 자동 정리 (cron job)

---

### ▶️ 단계 9: 심리학 설정 API (Day 10)

**목표**: 렌즈 활성화, A/B 테스트, 목표 설정 API

**엔드포인트**:
- `GET /api/settings/psychology/lenses`
- `PATCH /api/settings/psychology/lenses`
- `GET /api/settings/psychology/ab-tests`
- `PATCH /api/settings/psychology/ab-test`
- `GET /api/settings/psychology/goals`
- `PATCH /api/settings/psychology/goals`

**렌즈 토글**:
```typescript
// src/app/api/settings/psychology/lenses/route.ts
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  const body = await req.json();
  
  // OWNER 권한 확인
  const member = await checkOwnerRole(auth.sub as string, body.organizationId);
  if (!member) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  
  const userSettings = await prisma.userSettings.findUnique({
    where: {
      userId_organizationId: {
        userId: auth.sub as string,
        organizationId: body.organizationId,
      },
    },
  });
  
  // 렌즈 토글
  const lenses = new Set(userSettings?.enabledLenses || []);
  if (body.isEnabled) {
    lenses.add(body.lensId);
  } else {
    lenses.delete(body.lensId);
  }
  
  const updated = await prisma.userSettings.update({
    where: { id: userSettings!.id },
    data: { enabledLenses: Array.from(lenses) },
  });
  
  // 해당 렌즈의 자동화 규칙 활성화/비활성화
  await updateLensWorkflows(body.organizationId, body.lensId, body.isEnabled);
  
  return NextResponse.json({
    ok: true,
    data: { lensId: body.lensId, isEnabled: body.isEnabled },
    message: `${body.lensId} 렌즈가 ${body.isEnabled ? '활성화' : '비활성화'}되었습니다`,
  });
}

// 렌즈별 자동화 규칙 활성화 함수
async function updateLensWorkflows(organizationId: string, lensId: string, isEnabled: boolean) {
  // CRM Workflow 또는 자동화 규칙에서 해당 렌즈 관련 규칙 활성화/비활성화
  const lensRuleMap: Record<string, string[]> = {
    L0: ['REACTIVATION_EMAIL', 'REACTIVATION_SMS'],
    L1: ['PRICE_OBJECTION_SMS', 'VALUE_REFRAME_EMAIL'],
    L2: ['MEDIATION_QUESTION_CALL'],
    // ... 나머지 렌즈
  };
  
  const rules = lensRuleMap[lensId] || [];
  
  for (const rule of rules) {
    await prisma.crmWorkflow.updateMany({
      where: { organizationId, ruleType: rule },
      data: { isActive: isEnabled },
    });
  }
}
```

**체크리스트**:
- [ ] L0-L10 렌즈 기본값 설정
- [ ] A/B 테스트 설정 저장
- [ ] 목표 저장 및 진도율 계산
- [ ] 렌즈 변경 시 CRM Workflow 자동 업데이트

---

### ▶️ 단계 10: 프론트엔드 구현 (Day 13-18)

**목표**: UI 컴포넌트 및 페이지 구현

**파일 구조**:
```
src/app/(dashboard)/settings/
├── page.tsx                    # 메인 페이지 (탭 네비게이션)
├── profile/
│   ├── page.tsx               # 프로필 탭
│   └── components/
│       ├── ProfileForm.tsx     # 프로필 수정 폼
│       ├── AvatarUpload.tsx    # 프로필 사진 업로드
│       └── PasswordChange.tsx  # 비밀번호 변경
├── team/
│   ├── page.tsx               # 팀 탭
│   └── components/
│       ├── TeamInfo.tsx        # 팀 정보 표시
│       ├── MemberList.tsx      # 멤버 목록
│       └── InviteDialog.tsx    # 초대 다이얼로그
├── notifications/
│   ├── page.tsx               # 알림 탭
│   └── components/
│       ├── NotificationChannels.tsx
│       └── SmsSequenceEditor.tsx
├── integrations/
│   ├── page.tsx               # 통합 탭
│   └── components/
│       ├── ApiKeyForm.tsx
│       └── GmailAuth.tsx
├── data/
│   ├── page.tsx               # 데이터 탭
│   └── components/
│       ├── BackupManager.tsx
│       └── RecoveryManager.tsx
└── psychology/
    ├── page.tsx               # 심리학 탭
    └── components/
        ├── LensToggle.tsx
        └── GoalSetting.tsx
```

**핵심 컴포넌트 예시**:
```typescript
// src/app/(dashboard)/settings/components/Tabs.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export function SettingsTabs({ activeTab, onTabChange }) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="profile">프로필</TabsTrigger>
        <TabsTrigger value="team">팀</TabsTrigger>
        <TabsTrigger value="notifications">알림</TabsTrigger>
        <TabsTrigger value="integrations">통합</TabsTrigger>
        <TabsTrigger value="data">데이터</TabsTrigger>
        <TabsTrigger value="psychology">심리학</TabsTrigger>
      </TabsList>
      
      <TabsContent value="profile" className="mt-6">
        <ProfileTab />
      </TabsContent>
      {/* ... 나머지 탭 */}
    </Tabs>
  );
}
```

**체크리스트**:
- [ ] 모든 6개 탭 UI 완성
- [ ] 폼 입력 및 유효성 검사
- [ ] 로딩 상태 표시 (skeleton, spinner)
- [ ] 에러 메시지 표시 (toast)
- [ ] 반응형 레이아웃 (모바일/태블릿/데스크톱)
- [ ] 접근성 (ARIA, 키보드 네비)

---

### ▶️ 최종: 통합 테스트 및 배포 (Day 19-21)

**통합 테스트**:
```typescript
// src/__tests__/integration/settings.e2e.ts
import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should update profile', async ({ page, context }) => {
    // 1. 로그인
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 2. 설정 페이지 이동
    await page.goto('/settings/profile');
    
    // 3. 프로필 수정
    await page.fill('input[name="name"]', '새로운 이름');
    await page.fill('input[name="phone"]', '010-1234-5678');
    await page.click('button:has-text("저장")');
    
    // 4. 성공 메시지 확인
    await expect(page.locator('.toast:has-text("저장되었습니다")')).toBeVisible();
  });
  
  test('should invite team member', async ({ page }) => {
    await page.goto('/settings/team');
    await page.click('button:has-text("멤버 초대")');
    
    // 초대 폼 작성
    await page.fill('input[name="email"]', 'newmember@example.com');
    await page.selectOption('select[name="role"]', 'AGENT');
    await page.click('button:has-text("초대 생성")');
    
    // 초대 링크 생성 확인
    await expect(page.locator('.invite-link')).toBeVisible();
  });
});
```

**보안 검증**:
- [ ] JWT 토큰 검증
- [ ] 권한 검증 (OWNER/AGENT/FREE_SALES)
- [ ] CSRF 토큰 검증
- [ ] Rate Limiting 작동
- [ ] API 키 암호화 확인
- [ ] 민감한 정보 마스킹 확인

**성능 최적화**:
- [ ] Lighthouse 90+ 달성
- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] 번들 크기 최적화

**배포**:
- [ ] Vercel/자체 서버 배포
- [ ] 환경변수 설정
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 모니터링 및 알림 설정 (Sentry, DataDog)

---

## 📊 진행 상황 추적

### 마일스톤별 체크리스트

**Week 1 (설계 및 준비)**
- [ ] 아키텍처 확정
- [ ] UI 목업 완성
- [ ] DB 마이그레이션 완료

**Week 2 (백엔드 + 프론트엔드 초반)**
- [ ] 프로필, 팀 API 완성
- [ ] 알림, 통합 API 완성
- [ ] 프로필, 팀 UI 완성

**Week 3 (마무리 + 배포)**
- [ ] 데이터, 심리학 API 완성
- [ ] 데이터, 심리학 UI 완성
- [ ] 통합 테스트 및 버그 수정
- [ ] 배포

---

## 🎬 예상 산출물

**문서**:
- MENU_46_SETTINGS_SPECIFICATION.md (이 문서)
- MENU_46_API_DESIGN.md
- MENU_46_DATABASE_SCHEMA.md
- MENU_46_IMPLEMENTATION_PLAN.md (이 문서)

**코드**:
- `/src/app/(dashboard)/settings/` - 페이지 및 컴포넌트
- `/src/app/api/settings/` - API 엔드포인트
- `/src/lib/encryption.ts` - 암호화 유틸리티
- `/src/lib/middleware.ts` - 공통 미들웨어
- `/prisma/migrations/[timestamp]_add_menu_46_settings/` - DB 마이그레이션

**테스트**:
- `/src/__tests__/unit/encryption.test.ts`
- `/src/__tests__/integration/settings.e2e.ts`
- 단위 테스트: 85%+ 커버율
- 통합 테스트: 주요 플로우 검증

---

**버전**: 1.0  
**작성일**: 2026-05-24  
**상태**: 구현 계획 완료  
**예상 완료일**: 2026-06-14 (3주)
