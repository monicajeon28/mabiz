# Menu #46 (설정) - 데이터베이스 스키마 설계 (2026-05-24)

## 📋 개요

**데이터베이스**: PostgreSQL  
**ORM**: Prisma  
**암호화**: AES-256-GCM  
**감시**: 모든 CREATE/UPDATE/DELETE 작업 AuditLog 기록

---

## 📊 신규 모델 설계

### 1️⃣ UserSettings - 사용자 설정

```prisma
model UserSettings {
  id             String   @id @default(cuid())
  userId         String   @unique
  organizationId String
  
  // === 프로필 확장 ===
  phone          String?
  title          String?  // "OWNER", "AGENT", "FREE_SALES"
  bio            String?  @db.VarChar(200)
  
  // === 알림 설정 ===
  smsNotifications      Boolean @default(true)
  emailNotifications    Boolean @default(true)
  pushNotifications     Boolean @default(true)
  smsPhone              String?  // 수신 SMS 번호
  emailAddress          String?  // 수신 이메일 (기본: User.email)
  
  // === 카테고리별 알림 설정 (JSON) ===
  notificationCategories NotificationCategory[]
  
  // === 심리학 렌즈 ===
  enabledLenses    String[] @default([])  // ["L0", "L1", "L5", ...]
  
  // === A/B 테스트 ===
  abTestEnabled    Boolean  @default(true)
  
  // === 리포팅 ===
  reportingPeriod  String   @default("MONTHLY")  // "WEEKLY", "MONTHLY", "QUARTERLY"
  reportingChannels String[] @default(["EMAIL"])  // ["EMAIL", "SMS", "SLACK", "PUSH"]
  
  // === 타임스탐프 ===
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // === 관계 ===
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
}
```

---

### 2️⃣ NotificationCategory - 알림 카테고리 설정

```prisma
model NotificationCategory {
  id                String   @id @default(cuid())
  userSettingsId    String
  
  // === 카테고리 타입 ===
  categoryType      String   // "COMMISSION_DEADLINE", "AB_TEST_RESULTS", "SALE_COMPLETE", "SYSTEM_ALERTS"
  
  // === 활성화 ===
  isEnabled         Boolean  @default(true)
  
  // === 알림 채널 ===
  channels          String[] // ["SMS", "EMAIL", "PUSH", "SLACK"]
  
  // === 카테고리별 설정 (JSON) ===
  config            String   @db.Text // JSON 직렬화
  // 예: COMMISSION_DEADLINE 카테고리
  // {
  //   "daysBefore": [3, 7, 14],
  //   "includeWeekends": false
  // }
  // 예: AB_TEST_RESULTS 카테고리
  // {
  //   "notifyOnCompletion": true,
  //   "minSampleSize": 50
  // }
  
  // === 타임스탐프 ===
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // === 관계 ===
  userSettings      UserSettings @relation(fields: [userSettingsId], references: [id], onDelete: Cascade)
  
  @@unique([userSettingsId, categoryType])
  @@index([userSettingsId])
}
```

---

### 3️⃣ SmsSequenceCustomization - SMS 시퀀스 커스터마이징

```prisma
model SmsSequenceCustomization {
  id             String   @id @default(cuid())
  organizationId String
  
  // === 상품 지정 (null=전체 상품) ===
  productId      String?
  productName    String?  // 참고용
  
  // === Day 0-3 메시지 ===
  day0Message    String   @db.Text  // PASONA P+A 단계
  day1Message    String   @db.Text  // PASONA S 단계
  day2Message    String   @db.Text  // PASONA O+N 단계
  day3Message    String   @db.Text  // PASONA A 단계
  
  // === 상태 ===
  isActive       Boolean  @default(true)
  
  // === 타임스탐프 ===
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  // === 관계 ===
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, productId])
  @@index([organizationId])
}
```

---

### 4️⃣ IntegrationKey - 외부 서비스 API 키 (암호화)

```prisma
model IntegrationKey {
  id             String   @id @default(cuid())
  organizationId String
  
  // === Provider 타입 ===
  providerName   String   // "CRUISEDOT_MALL", "PAYAPP", "SLACK", "GMAIL", "OUTLOOK", "SMTP"
  
  // === 암호화된 키 ===
  keyEncrypted   String   @db.Text  // AES-256-GCM으로 암호화
  secretEncrypted String? @db.Text  // API Secret (필요시)
  
  // === 상태 ===
  isActive       Boolean  @default(true)
  
  // === 테스트 결과 ===
  lastTestedAt   DateTime?
  testStatus     String?  // "SUCCESS", "FAILED", "PENDING"
  testError      String?
  
  // === 타임스탐프 ===
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  // === 관계 ===
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, providerName])
  @@index([organizationId])
  @@index([providerName])
}
```

**암호화 방식**:
```typescript
// 저장 시
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32바이트 (256비트)

function encryptAES256(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// 사용 시
function decryptAES256(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

---

### 5️⃣ BackupLog - 백업 이력

```prisma
model BackupLog {
  id             String   @id @default(cuid())
  organizationId String
  
  // === 백업 타입 ===
  backupType     String   // "FULL", "CONTACTS_ONLY", "DEALS_ONLY", "DOCUMENTS_ONLY"
  
  // === 상태 ===
  status         String   @default("PENDING")  // "PENDING", "PROCESSING", "COMPLETED", "FAILED"
  
  // === 파일 정보 ===
  fileUrl        String?  // GCS 또는 Google Drive URL
  fileSize       Int?     // 바이트 단위
  
  // === 타이밍 ===
  scheduledTime  DateTime?  // 자동 백업 예약 시간
  startedAt      DateTime?
  completedAt    DateTime?
  
  // === 에러 ===
  errorMessage   String?
  
  // === 메타데이터 ===
  dataItemCount  Int?  // 백업된 항목 수
  
  // === 타임스탐프 ===
  createdAt      DateTime @default(now())
  
  // === 관계 ===
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([organizationId])
  @@index([status])
  @@index([createdAt])
}
```

---

### 6️⃣ PsychologyGoal - 심리학 렌즈별 목표

```prisma
model PsychologyGoal {
  id             String   @id @default(cuid())
  organizationId String
  
  // === 월 (YYYY-MM 형식) ===
  month          String   // "2026-05"
  
  // === 목표값 ===
  monthlyRevenue Int      // 원 단위
  conversionRate Float    // 퍼센트 (예: 15.5)
  settlementRate Float    // 정산완료율 퍼센트
  customerCount  Int      // 목표 고객 수
  
  // === 참고용 ===
  notes          String?  @db.VarChar(500)
  
  // === 타임스탐프 ===
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  // === 관계 ===
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, month])
  @@index([organizationId])
}
```

---

### 7️⃣ AuditLog - 감시 로그 (보안)

```prisma
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  
  // === 액션 ===
  action         String   // "CREATE", "READ", "UPDATE", "DELETE", "TEST", "LOGIN_FAILED"
  resource       String   // "SETTINGS", "MEMBER", "API_KEY", "BACKUP", "RECOVERY"
  resourceId     String?  // 대상 리소스 ID
  
  // === 변경 내용 (JSON) ===
  changes        String?  @db.Text  // { before: {}, after: {} }
  
  // === 요청 정보 ===
  ipAddress      String?
  userAgent      String?
  
  // === 결과 ===
  status         String   // "SUCCESS", "FAILED"
  errorMessage   String?
  
  // === 타임스탐프 ===
  createdAt      DateTime @default(now())
  
  // === 관계 ===
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([organizationId])
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

---

## 🔄 기존 모델 확장

### User 모델 확장

```prisma
model User {
  // ... 기존 필드
  
  // === Menu #46에서 추가 ===
  profileImageUrl    String?  // 프로필 사진 GCS URL
  signatureImageUrl  String?  // 서명 이미지 GCS URL
  
  // === 관계 ===
  userSettings       UserSettings[]
  auditLogs          AuditLog[]
}
```

### Organization 모델 확장

```prisma
model Organization {
  // ... 기존 필드
  
  // === 관계 추가 ===
  userSettings       UserSettings[]
  integrationKeys    IntegrationKey[]
  smsSequenceCustomizations SmsSequenceCustomization[]
  backupLogs         BackupLog[]
  psychologyGoals    PsychologyGoal[]
  auditLogs          AuditLog[]
}
```

### OrganizationMember 모델 확장

```prisma
model OrganizationMember {
  // ... 기존 필드
  
  // === Menu #46에서 추가 ===
  displayName        String?  // 팀 내 표시명
  // (User.name과 별도로 팀 내 닉네임 사용 가능)
}
```

---

## 📐 마이그레이션 스크립트

### Step 1: 신규 모델 생성

```prisma
// prisma/schema.prisma에 추가

model UserSettings {
  // ... 위의 스키마 정의 복사
}

model NotificationCategory {
  // ... 위의 스키마 정의 복사
}

// ... 나머지 모델들
```

### Step 2: 마이그레이션 생성

```bash
npx prisma migrate dev --name add_menu_46_settings
```

### Step 3: 마이그레이션 내용 (자동 생성)

```sql
-- CreateTable UserSettings
CREATE TABLE "UserSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "organizationId" TEXT NOT NULL,
  "phone" TEXT,
  "title" TEXT,
  "bio" VARCHAR(200),
  "smsNotifications" BOOLEAN NOT NULL DEFAULT true,
  "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
  "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
  "smsPhone" TEXT,
  "emailAddress" TEXT,
  "enabledLenses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "abTestEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reportingPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
  "reportingChannels" TEXT[] DEFAULT ARRAY['EMAIL']::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "UserSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

-- CreateIndex UserSettings_userId
CREATE UNIQUE INDEX "UserSettings_userId_organizationId_key" ON "UserSettings"("userId", "organizationId");
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");
CREATE INDEX "UserSettings_organizationId_idx" ON "UserSettings"("organizationId");

-- CreateTable NotificationCategory (생략)
-- CreateTable SmsSequenceCustomization (생략)
-- CreateTable IntegrationKey (생략)
-- CreateTable BackupLog (생략)
-- CreateTable PsychologyGoal (생략)
-- CreateTable AuditLog (생략)

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "profileImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "signatureImageUrl" TEXT;

-- AlterTable Organization (자동으로 관계 매핑)
-- AlterTable OrganizationMember
ALTER TABLE "OrganizationMember" ADD COLUMN "displayName" TEXT;
```

---

## 🔐 데이터 초기화

### 신규 사용자 가입 시

```typescript
// app/api/auth/signup 또는 invite/accept에서
async function createUserSettings(userId: string, organizationId: string) {
  await prisma.userSettings.create({
    data: {
      userId,
      organizationId,
      smsNotifications: true,
      emailNotifications: true,
      pushNotifications: true,
      enabledLenses: ["L0", "L1", "L5", "L6", "L8", "L10"], // 기본값
      abTestEnabled: true,
      reportingPeriod: "MONTHLY",
      reportingChannels: ["EMAIL"],
    },
  });
  
  // 기본 알림 카테고리 생성
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  
  await prisma.notificationCategory.createMany({
    data: [
      {
        userSettingsId: userSettings!.id,
        categoryType: "COMMISSION_DEADLINE",
        isEnabled: true,
        channels: ["SMS", "EMAIL"],
        config: JSON.stringify({ daysBefore: [3, 7], includeWeekends: false }),
      },
      {
        userSettingsId: userSettings!.id,
        categoryType: "AB_TEST_RESULTS",
        isEnabled: true,
        channels: ["EMAIL"],
        config: JSON.stringify({ notifyOnCompletion: true }),
      },
      {
        userSettingsId: userSettings!.id,
        categoryType: "SALE_COMPLETE",
        isEnabled: true,
        channels: ["SMS", "EMAIL"],
        config: JSON.stringify({ notifyImmediately: true }),
      },
      {
        userSettingsId: userSettings!.id,
        categoryType: "SYSTEM_ALERTS",
        isEnabled: true,
        channels: ["EMAIL", "PUSH"],
        config: JSON.stringify({}),
      },
    ],
  });
}
```

### 신규 조직 생성 시

```typescript
async function createOrganizationDefaults(organizationId: string) {
  // 기본 심리학 목표 설정
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  await prisma.psychologyGoal.create({
    data: {
      organizationId,
      month: monthStr,
      monthlyRevenue: 50000000,
      conversionRate: 15,
      settlementRate: 95,
      customerCount: 100,
    },
  });
}
```

---

## 📊 데이터 관계도

```
User
├── UserSettings (1:1)
│   └── NotificationCategory (1:N)
└── AuditLog (1:N)

Organization
├── UserSettings (1:N)
├── IntegrationKey (1:N)
├── SmsSequenceCustomization (1:N)
├── BackupLog (1:N)
├── PsychologyGoal (1:N)
└── AuditLog (1:N)

OrganizationMember
└── (displayName 추가)
```

---

## 🛡️ 보안 고려사항

### 1. 암호화 저장소
- **민감 정보**: API 키, Secret, 비밀번호
- **저장소**: IntegrationKey.keyEncrypted, IntegrationKey.secretEncrypted
- **암호화**: AES-256-GCM
- **키 관리**: `process.env.ENCRYPTION_KEY` (AWS Secrets Manager 또는 .env.local)

### 2. 접근 제어
```typescript
// API 미들웨어 예시
async function requireOwnerOrSelf(req, res, next) {
  const user = await getAuthUser(req);
  const orgId = req.query.organizationId;
  
  const member = await OrganizationMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  
  if (member?.role === "OWNER") {
    return next(); // OWNER는 모든 접근 가능
  }
  
  if (req.path.includes(`/profile`) && req.body.userId === user.id) {
    return next(); // 자신의 프로필만 수정 가능
  }
  
  return res.status(403).json({ error: "FORBIDDEN" });
}
```

### 3. 감시 로그
```typescript
// 모든 설정 변경 기록
async function auditLog(
  organizationId: string,
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  changes?: any
) {
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action,
      resource,
      resourceId,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress: req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      status: "SUCCESS",
    },
  });
}
```

### 4. Rate Limiting (데이터베이스 레벨)
```typescript
// API 미들웨어에서
const rateLimit = {
  GET: 60,      // 60 req/min
  PATCH: 30,    // 30 req/min
  DELETE: 5,    // 5 req/min
};
```

---

## 🧹 데이터 정리 (Cleanup)

### 자동 정리 작업

```typescript
// 매일 자정 실행 (cron job)
export async function cleanupExpiredData() {
  // 1. 30일 이상 된 deleted item 영구삭제
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  await prisma.contact.deleteMany({
    where: {
      isDeleted: true,
      deletedAt: { lt: thirtyDaysAgo },
    },
  });
  
  // 2. 7일 이상 된 만료된 초대 토큰 삭제
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  await prisma.orgInviteToken.deleteMany({
    where: {
      expiresAt: { lt: sevenDaysAgo },
    },
  });
  
  // 3. 90일 이상 된 감시 로그 아카이브 (선택)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  const archivedLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: { lt: ninetyDaysAgo },
    },
    select: { id: true },
  });
  
  // BigQuery에 아카이브 후 삭제
  if (archivedLogs.length > 0) {
    // ... 아카이브 로직
    await prisma.auditLog.deleteMany({
      where: {
        id: { in: archivedLogs.map(l => l.id) },
      },
    });
  }
}
```

---

## 📈 성능 최적화

### 인덱싱 전략

```sql
-- 자주 검색되는 필드
CREATE INDEX idx_user_settings_org ON "UserSettings"("organizationId");
CREATE INDEX idx_audit_log_created ON "AuditLog"("createdAt" DESC);
CREATE INDEX idx_backup_log_status ON "BackupLog"("status");
CREATE INDEX idx_integration_key_provider ON "IntegrationKey"("providerName");

-- 복합 인덱스
CREATE INDEX idx_audit_log_org_action ON "AuditLog"("organizationId", "action");
CREATE INDEX idx_backup_log_org_date ON "BackupLog"("organizationId", "createdAt" DESC);
```

### 쿼리 최적화

```typescript
// ❌ N+1 문제
const settings = await prisma.userSettings.findMany();
for (const s of settings) {
  const categories = await prisma.notificationCategory.findMany({
    where: { userSettingsId: s.id },
  }); // 반복 쿼리!
}

// ✅ JOIN/Relations 사용
const settings = await prisma.userSettings.findMany({
  include: {
    notificationCategories: true, // 한 번에 로드
  },
});
```

---

**버전**: 1.0  
**작성일**: 2026-05-24  
**상태**: 스키마 설계 완료
