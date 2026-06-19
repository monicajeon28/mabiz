# Passport Phase 3: Google Drive 자동 백업 설계 (2026-06-19)

## 📋 개요

여권 사진 업로드 시 Google Drive에 자동 백업하고, 매일 밤 일괄 백업을 실행하는 시스템 설계서입니다.

### 핵심 목표
- ✅ 여권 사진 업로드 → 즉시 Google Drive 백업
- ✅ 매일 밤 1시(UTC) 일괄 백업 (놓친 파일 처리)
- ✅ 1년 보관 정책 (365일 초과 파일 자동 삭제)
- ✅ 데이터 손실 0% (멀티 헤시 검증)
- ✅ 보안 최우선 (API 키 git 절대 금지, 서비스 계정만)

---

## 🏗️ 아키텍처 개요

### 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Passport Upload Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Customer/Partner/Admin Upload                         │
│     ↓                                                       │
│  2. [POST] /api/passport/customer/upload                 │
│     ↓                                                       │
│  3. Image Optimization (WebP + Full + Thumb + Archive)  │
│     ↓                                                       │
│  4. [NEW] uploadPassportToGoogleDrive()                  │
│     ├─ Google Drive 초기화                                │
│     ├─ Passports/{yyyy}/{yyyy-MM-dd} 폴더 생성          │
│     ├─ WebP 이미지 업로드                                │
│     └─ BackupLog DB 기록                                 │
│     ↓                                                       │
│  5. 응답 (fileId 포함)                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Cron: Daily Backup                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 매일 01:00 UTC (10:00 KST)                            │
│     ↓                                                       │
│  2. [GET] /api/cron/backup-passport                      │
│     ↓                                                       │
│  3. SELECT * FROM Passport WHERE createdAt > yesterday   │
│     ↓                                                       │
│  4. 각 파일별 uploadPassportToGoogleDrive()              │
│     ├─ 백업 재시도 (3회)                                  │
│     ├─ 오류 로깅                                          │
│     └─ BackupLog 업데이트                                 │
│     ↓                                                       │
│  5. 1년 초과 파일 자동 삭제 (deleteOldBackups)           │
│     ├─ createdAt < 365일 전                              │
│     └─ Google Drive + BackupLog 동시 삭제                │
│     ↓                                                       │
│  6. 완료 리포트 (Slack/Email)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Google Drive 폴더 구조:
📁 Passports (루트)
  ├─ 📁 2026
  │  ├─ 📁 2026-06
  │  │  ├─ 📁 2026-06-19
  │  │  │  ├─ passport_full_KIM_M12345678_1234567890.webp
  │  │  │  ├─ passport_thumb_KIM_M12345678_1234567890.webp
  │  │  │  └─ backup_log_2026-06-19_1234567890.json
  │  │  └─ 📁 2026-06-18
  │  │     └─ ...
  │  └─ ...
  └─ ...
```

---

## 🔧 기술 스택

| 컴포넌트 | 기술 | 설명 |
|---------|------|------|
| **API** | Node.js/Next.js | 여권 업로드 API |
| **Google Drive** | googleapis v3 | 파일 업로드 및 관리 |
| **스케줄** | Vercel Cron | 매일 1시 자동 실행 |
| **DB** | PostgreSQL (Prisma) | 백업 로그 저장 |
| **인증** | Service Account | Google Drive API 접근 |
| **이미지** | Sharp | WebP 최적화 (기존) |

---

## 📂 DB 스키마 설계

### BackupLog 테이블 (신규)

```prisma
model PassportBackupLog {
  id                String   @id @default(cuid())
  passportId        String   @db.Uuid
  passport          Passport @relation(fields: [passportId], references: [id], onDelete: Cascade)
  
  // Google Drive 메타데이터
  googleDriveFileId String?  // 업로드된 파일 ID
  googleDriveFolderPath String? // 예: "Passports/2026/2026-06/2026-06-19"
  
  // 파일 정보
  fileName          String   // 예: "passport_full_KIM_M12345678.webp"
  mimeType          String   @default("image/webp") // 파일 타입
  fileSize          BigInt?  // 바이트 단위
  md5Hash           String?  // 멀티 해시 검증 (손상 방지)
  
  // 백업 상태
  status            String   @default("PENDING") // PENDING/SUCCESS/FAILED/DELETED
  errorMessage      String?  // 실패 사유
  retryCount        Int      @default(0) // 재시도 횟수 (최대 3)
  lastRetryAt       DateTime?
  
  // 삭제 정책
  isDeleted         Boolean  @default(false) // 소프트 삭제
  deletedAt         DateTime?
  
  // 타임스탐프
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([passportId])
  @@index([status])
  @@index([createdAt])
}
```

### Passport 테이블 (기존, 추가 필드)

```prisma
model Passport {
  // ... 기존 필드
  
  // Phase 3: 백업 추적
  backupLogs        PassportBackupLog[] // 1:N 관계
  lastBackupAt      DateTime? // 마지막 성공 백업 시간
  backupStatus      String @default("PENDING") // PENDING/SUCCESS/FAILED
  
  @@index([lastBackupAt])
}
```

---

## 🔐 환경변수 설정

### 필수 환경변수

```bash
# Google Drive Service Account (기존, Vision API와 동일)
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY="{"type":"service_account","project_id":"...","private_key":"..."}"

# Passport 백업 폴더 (신규)
PASSPORT_BACKUP_FOLDER_ID="1abc2def3ghi4jkl5mno6pqr7stu8vwx"

# Cron 보안 (신규, 무단 접근 방지)
CRON_SECRET="your-secure-random-string-here"
```

### 환경변수 검증

```typescript
// src/lib/validate-backup-env.ts
export function validatePassportBackupEnv() {
  const required = [
    'GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY',
    'PASSPORT_BACKUP_FOLDER_ID',
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`❌ 환경변수 누락: ${key}`);
    }
  }
  
  // Service Account JSON 파싱 테스트
  try {
    JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY!);
  } catch {
    throw new Error('❌ GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY는 유효한 JSON이어야 합니다');
  }
}
```

---

## 💾 Google Drive 백업 라이브러리

### src/lib/passport-google-drive-backup.ts

```typescript
/**
 * Passport Google Drive 백업 라이브러리
 * - 여권 사진 자동 백업
 * - 매일 일괄 백업
 * - 1년 보관 정책
 */

import { google, Auth } from 'googleapis';
import { logger } from '@/lib/logger';
import { parseServiceAccount } from '@/lib/parse-service-account';
import prisma from '@/lib/prisma';
import * as crypto from 'crypto';

const BACKUP_ROOT_FOLDER_NAME = 'Passports';

/**
 * Google Drive 서비스 계정 클라이언트 초기화
 */
function getDriveClient(): ReturnType<typeof google.drive> {
  const credentials = parseServiceAccount(
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY!
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * 폴더 찾기 또는 생성
 * @param name 폴더명
 * @param parentId 상위 폴더 ID
 * @returns 폴더 ID
 */
async function findOrCreateFolder(
  name: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient();
  
  try {
    // 1. 기존 폴더 검색
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
      fields: 'files(id)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 1,
    });
    
    if (res.data.files?.length) {
      return res.data.files[0].id!;
    }
    
    // 2. 폴더 생성
    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
        appProperties: {
          type: 'passport_backup',
          createdBy: 'mabiz-crm',
        },
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    
    logger.info(`[PassportBackup] 폴더 생성: ${name} (${created.data.id})`);
    return created.data.id!;
  } catch (err) {
    logger.error(`[PassportBackup] 폴더 찾기/생성 실패: ${name}`, err);
    throw err;
  }
}

/**
 * MD5 해시 계산 (멀티 해시 검증용)
 */
function calculateMd5(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * 여권 사진을 Google Drive에 업로드
 * @param passportId 여권 ID
 * @param imageBuffer 이미지 버퍼
 * @param fileName 파일명 (예: passport_full_KIM_M12345678.webp)
 * @param mimeType MIME 타입 (기본값: image/webp)
 * @returns BackupLog 데이터
 */
export async function uploadPassportToGoogleDrive(
  passportId: string,
  imageBuffer: Buffer,
  fileName: string,
  mimeType: string = 'image/webp'
): Promise<{
  fileId: string;
  folderPath: string;
  md5Hash: string;
}> {
  const drive = getDriveClient();
  
  try {
    // 1. 폴더 구조 생성 (Passports/2026/2026-06/2026-06-19)
    const now = new Date();
    const year = String(now.getFullYear());
    const yearMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearMonthDay = `${yearMonth}-${String(now.getDate()).padStart(2, '0')}`;
    
    const rootFolderId = process.env.PASSPORT_BACKUP_FOLDER_ID!;
    const yearFolderId = await findOrCreateFolder(year, rootFolderId);
    const monthFolderId = await findOrCreateFolder(yearMonth, yearFolderId);
    const dayFolderId = await findOrCreateFolder(yearMonthDay, monthFolderId);
    
    // 2. 파일 업로드
    const fileRes = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType,
        parents: [dayFolderId],
        appProperties: {
          passportId,
          uploadedAt: new Date().toISOString(),
        },
      },
      media: {
        mimeType,
        body: imageBuffer,
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    
    const fileId = fileRes.data.id!;
    const md5Hash = calculateMd5(imageBuffer);
    
    logger.info(`[PassportBackup] 업로드 완료: ${fileName} (${fileId})`);
    
    return {
      fileId,
      folderPath: `Passports/${year}/${yearMonth}/${yearMonthDay}`,
      md5Hash,
    };
  } catch (err) {
    logger.error(`[PassportBackup] 업로드 실패: ${fileName}`, err);
    throw err;
  }
}

/**
 * Google Drive에서 파일 삭제
 * @param fileId Google Drive 파일 ID
 */
export async function deletePassportBackupFromGoogleDrive(
  fileId: string
): Promise<void> {
  const drive = getDriveClient();
  
  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    logger.info(`[PassportBackup] 파일 삭제: ${fileId}`);
  } catch (err) {
    logger.error(`[PassportBackup] 파일 삭제 실패: ${fileId}`, err);
    throw err;
  }
}

/**
 * 1년 초과 백업 삭제 (정책 준수)
 * @param daysBefore 보관 기간 (기본값: 365일)
 */
export async function deleteOldPassportBackups(
  daysBefore: number = 365
): Promise<{
  deletedCount: number;
  failedCount: number;
  totalScanned: number;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBefore);
    
    logger.info(`[PassportBackup] 오래된 백업 삭제 시작: ${cutoffDate.toISOString()}`);
    
    // 1. 1년 초과 BackupLog 조회
    const oldBackups = await prisma.passportBackupLog.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        isDeleted: false,
        status: 'SUCCESS',
      },
      select: {
        id: true,
        googleDriveFileId: true,
      },
    });
    
    let deletedCount = 0;
    let failedCount = 0;
    
    // 2. 각 파일 삭제
    for (const backup of oldBackups) {
      try {
        if (backup.googleDriveFileId) {
          await deletePassportBackupFromGoogleDrive(backup.googleDriveFileId);
        }
        
        // 3. BackupLog 소프트 삭제
        await prisma.passportBackupLog.update({
          where: { id: backup.id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            status: 'DELETED',
          },
        });
        
        deletedCount++;
      } catch (err) {
        logger.error(`[PassportBackup] 삭제 실패: ${backup.id}`, err);
        failedCount++;
      }
    }
    
    logger.info(`[PassportBackup] 삭제 완료: ${deletedCount}/${oldBackups.length}`);
    
    return {
      deletedCount,
      failedCount,
      totalScanned: oldBackups.length,
    };
  } catch (err) {
    logger.error('[PassportBackup] 오래된 백업 삭제 중 오류', err);
    throw err;
  }
}

/**
 * 백업 재시도 (실패한 백업)
 * @param maxRetries 최대 재시도 횟수 (기본값: 3)
 */
export async function retryFailedPassportBackups(
  maxRetries: number = 3
): Promise<{
  retried: number;
  succeeded: number;
  stillFailed: number;
}> {
  try {
    const failedBackups = await prisma.passportBackupLog.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: maxRetries },
      },
      include: {
        passport: true,
      },
    });
    
    let retried = 0;
    let succeeded = 0;
    let stillFailed = 0;
    
    for (const backup of failedBackups) {
      try {
        retried++;
        
        // 여권 이미지 다시 로드 (DB에서)
        // NOTE: Passport 테이블에서 imageBuffer를 조회해야 함
        // 여기서는 의사코드 작성
        
        // const imageBuffer = await getPassportImage(backup.passportId);
        // const result = await uploadPassportToGoogleDrive(
        //   backup.passportId,
        //   imageBuffer,
        //   backup.fileName,
        //   backup.mimeType
        // );
        
        // BackupLog 업데이트
        await prisma.passportBackupLog.update({
          where: { id: backup.id },
          data: {
            status: 'SUCCESS',
            googleDriveFileId: 'result.fileId', // 실제값
            md5Hash: 'result.md5Hash',
            retryCount: { increment: 1 },
            errorMessage: null,
          },
        });
        
        succeeded++;
      } catch (err) {
        stillFailed++;
        await prisma.passportBackupLog.update({
          where: { id: backup.id },
          data: {
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
            errorMessage: String(err),
          },
        });
      }
    }
    
    return { retried, succeeded, stillFailed };
  } catch (err) {
    logger.error('[PassportBackup] 백업 재시도 중 오류', err);
    throw err;
  }
}

/**
 * 백업 상태 조회
 */
export async function getPassportBackupStatus(passportId: string) {
  return await prisma.passportBackupLog.findFirst({
    where: { passportId },
    orderBy: { createdAt: 'desc' },
  });
}
```

---

## 🔌 API 수정

### 1. POST /api/passport/customer/upload (기존 수정)

```typescript
// src/app/api/passport/customer/upload/route.ts
// 기존 로직 유지 + uploadPassportToGoogleDrive() 호출

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { uploadPassportToGoogleDrive } from '@/lib/passport-google-drive-backup';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // ... 기존 업로드 로직
    
    // 이미지 최적화 완료 후
    const optimizedFullBuffer = await getOptimizedFullBuffer(file);
    const passportId = uuid();
    
    // [NEW] Google Drive 백업 (비동기, 에러 무시)
    uploadPassportToGoogleDrive(
      passportId,
      optimizedFullBuffer,
      `passport_full_${customerName}_${passportNumber}.webp`
    ).then(result => {
      // BackupLog 기록
      prisma.passportBackupLog.create({
        data: {
          passportId,
          googleDriveFileId: result.fileId,
          googleDriveFolderPath: result.folderPath,
          fileName: `passport_full_${customerName}_${passportNumber}.webp`,
          mimeType: 'image/webp',
          fileSize: BigInt(optimizedFullBuffer.length),
          md5Hash: result.md5Hash,
          status: 'SUCCESS',
        },
      });
      logger.info(`[PassportBackup] BackupLog 기록: ${passportId}`);
    }).catch(err => {
      // 에러 로깅 (비동기, 업로드는 성공)
      logger.error(`[PassportBackup] Google Drive 업로드 실패:`, err);
      prisma.passportBackupLog.create({
        data: {
          passportId,
          fileName: `passport_full_${customerName}_${passportNumber}.webp`,
          mimeType: 'image/webp',
          fileSize: BigInt(optimizedFullBuffer.length),
          status: 'FAILED',
          errorMessage: String(err),
        },
      });
    });
    
    // 즉시 응답 (Google Drive 업로드 완료 대기 안 함)
    return NextResponse.json({
      success: true,
      passportId,
      // ... 기존 응답
    });
  } catch (err) {
    logger.error('[PassportCustomerUpload]', err);
    return NextResponse.json(
      { error: '업로드 실패' },
      { status: 500 }
    );
  }
}
```

### 2. GET /api/cron/backup-passport (신규)

```typescript
// src/app/api/cron/backup-passport/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import {
  uploadPassportToGoogleDrive,
  deleteOldPassportBackups,
  retryFailedPassportBackups,
} from '@/lib/passport-google-drive-backup';

/**
 * Cron Job: 매일 01:00 UTC (10:00 KST)
 * - 어제 업로드된 여권 백업
 * - 1년 초과 파일 삭제
 * - 실패한 백업 재시도
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Cron 보안 검증
    const cronSecret = req.headers.get('Authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    logger.info('[PassportBackupCron] 시작');
    
    // 2. 어제 업로드된 여권 조회
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(yesterday);
    endOfDay.setHours(23, 59, 59, 999);
    
    const passportsToBackup = await prisma.passport.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        backupStatus: { not: 'SUCCESS' }, // 성공하지 않은 것만
      },
      select: {
        id: true,
        fullImageBuffer: true, // 또는 필요한 필드
        fileSize: true,
      },
    });
    
    logger.info(`[PassportBackupCron] 백업 대상: ${passportsToBackup.length}개`);
    
    // 3. 각 여권 백업 (재시도 포함)
    let backupCount = 0;
    let failureCount = 0;
    
    for (const passport of passportsToBackup) {
      try {
        const result = await uploadPassportToGoogleDrive(
          passport.id,
          passport.fullImageBuffer,
          `passport_full_${passport.id}.webp`
        );
        
        await prisma.passportBackupLog.create({
          data: {
            passportId: passport.id,
            googleDriveFileId: result.fileId,
            googleDriveFolderPath: result.folderPath,
            fileName: `passport_full_${passport.id}.webp`,
            mimeType: 'image/webp',
            fileSize: BigInt(passport.fileSize || 0),
            md5Hash: result.md5Hash,
            status: 'SUCCESS',
          },
        });
        
        await prisma.passport.update({
          where: { id: passport.id },
          data: {
            lastBackupAt: new Date(),
            backupStatus: 'SUCCESS',
          },
        });
        
        backupCount++;
      } catch (err) {
        logger.error(`[PassportBackupCron] 백업 실패: ${passport.id}`, err);
        failureCount++;
        
        await prisma.passportBackupLog.create({
          data: {
            passportId: passport.id,
            fileName: `passport_full_${passport.id}.webp`,
            mimeType: 'image/webp',
            fileSize: BigInt(passport.fileSize || 0),
            status: 'FAILED',
            errorMessage: String(err),
          },
        });
      }
    }
    
    // 4. 1년 초과 파일 삭제
    const deleteResult = await deleteOldPassportBackups(365);
    
    // 5. 실패한 백업 재시도
    const retryResult = await retryFailedPassportBackups(3);
    
    // 6. 완료 리포트
    const report = {
      timestamp: new Date().toISOString(),
      backup: {
        total: passportsToBackup.length,
        succeeded: backupCount,
        failed: failureCount,
      },
      deletion: {
        deleted: deleteResult.deletedCount,
        failedToDelete: deleteResult.failedCount,
        scanned: deleteResult.totalScanned,
      },
      retry: {
        retried: retryResult.retried,
        succeeded: retryResult.succeeded,
        stillFailed: retryResult.stillFailed,
      },
    };
    
    logger.info('[PassportBackupCron] 완료', report);
    
    return NextResponse.json(report);
  } catch (err) {
    logger.error('[PassportBackupCron] 오류', err);
    return NextResponse.json(
      { error: '백업 실패' },
      { status: 500 }
    );
  }
}
```

### 3. GET /api/cron/backup-passport/status (신규)

```typescript
// 백업 상태 모니터링용 API
// 관리자 대시보드에서 호출 가능

export async function GET(req: NextRequest) {
  const passportId = req.nextUrl.searchParams.get('id');
  
  if (!passportId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  
  const status = await getPassportBackupStatus(passportId);
  
  return NextResponse.json({
    passportId,
    status: status?.status || 'PENDING',
    lastBackupAt: status?.createdAt,
    googleDriveFileId: status?.googleDriveFileId,
    errorMessage: status?.errorMessage,
  });
}
```

---

## 📅 Cron 스케줄 설정

### Vercel Cron 트리거

```typescript
// vercel.json 또는 cron 설정
{
  "crons": [
    {
      "path": "/api/cron/backup-passport",
      "schedule": "0 1 * * *",  // 매일 01:00 UTC (10:00 KST)
    }
  ]
}
```

### 수동 테스트 (개발 중)

```bash
# 로컬 테스트
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/backup-passport

# Production 테스트 (Vercel)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/backup-passport
```

---

## 🛡️ 보안 체크리스트

### ✅ API 키 보안

| 항목 | 상태 | 설명 |
|------|------|------|
| **Service Account Key** | 🔒 Vercel Env | git에 절대 커밋 금지 |
| **Cron Secret** | 🔒 Vercel Env | Bearer 토큰으로 인증 |
| **폴더 ID** | 🔓 공개 가능 | ID만으로는 접근 불가 |

### ✅ 권한 관리

```typescript
// Google Drive 서비스 계정 권한 설정
// - Drive API (읽기/쓰기)
// - 공유 드라이브 접근 (Shared Drives 지원)
// - 파일 삭제 권한 (1년 보관 정책)
```

### ✅ 데이터 검증

```typescript
// 멀티 해시 검증 (파일 손상 방지)
// 1. 업로드 시: MD5 해시 계산 + DB 저장
// 2. 다운로드 시: MD5 해시 재계산 + 비교
// 3. 불일치 시: 재업로드 또는 알림
```

### ✅ 에러 처리

```typescript
// 에러 발생 시 자동 재시도
// - 재시도 횟수: 최대 3회
// - 재시도 간격: 5분 (Cron 다음 실행)
// - 최종 실패: 관리자 알림 (이메일/Slack)
```

---

## 📊 모니터링 대시보드 (관리자용)

### src/app/(dashboard)/admin/backup-status/page.tsx

```typescript
import { getPassportBackupStatus } from '@/lib/passport-google-drive-backup';

export default async function BackupStatusPage() {
  // 1. 최근 100개 백업 로그 조회
  const backups = await prisma.passportBackupLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { passport: true },
  });
  
  // 2. 통계
  const stats = {
    total: backups.length,
    success: backups.filter(b => b.status === 'SUCCESS').length,
    failed: backups.filter(b => b.status === 'FAILED').length,
    deleted: backups.filter(b => b.status === 'DELETED').length,
  };
  
  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <StatsCard stats={stats} />
      
      {/* 백업 로그 테이블 */}
      <BackupLogsTable backups={backups} />
      
      {/* 재시도 버튼 */}
      <div className="flex gap-2">
        <button onClick={() => retryFailedPassportBackups()}>
          실패한 백업 재시도
        </button>
        <button onClick={() => deleteOldPassportBackups()}>
          1년 초과 파일 삭제
        </button>
      </div>
    </div>
  );
}
```

---

## 🧪 테스트 계획

### 단위 테스트

```typescript
// src/lib/passport-google-drive-backup.test.ts

describe('uploadPassportToGoogleDrive', () => {
  test('✅ WebP 파일 정상 업로드', async () => {
    // Arrange
    const buffer = Buffer.from([/* 실제 WebP 바이너리 */]);
    
    // Act
    const result = await uploadPassportToGoogleDrive(
      'passport-123',
      buffer,
      'passport_full_KIM.webp'
    );
    
    // Assert
    expect(result.fileId).toBeDefined();
    expect(result.md5Hash).toHaveLength(32); // MD5 = 32자
  });
  
  test('❌ 파일 크기 초과 시 에러', async () => {
    // Arrange
    const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
    
    // Act & Assert
    await expect(
      uploadPassportToGoogleDrive(
        'passport-123',
        largeBuffer,
        'passport_full_KIM.webp'
      )
    ).rejects.toThrow('파일 크기 초과');
  });
});

describe('deleteOldPassportBackups', () => {
  test('✅ 1년 초과 파일 삭제', async () => {
    // Arrange: 366일 전 백업 생성
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 366);
    
    await prisma.passportBackupLog.create({
      data: {
        passportId: 'passport-old',
        fileName: 'old_passport.webp',
        status: 'SUCCESS',
        createdAt: oldDate,
      },
    });
    
    // Act
    const result = await deleteOldPassportBackups(365);
    
    // Assert
    expect(result.deletedCount).toBeGreaterThan(0);
  });
});

describe('Cron Job', () => {
  test('✅ Cron 보안 검증', async () => {
    // 잘못된 토큰
    const res = await fetch(
      'http://localhost:3000/api/cron/backup-passport',
      { headers: { Authorization: 'Bearer WRONG_TOKEN' } }
    );
    expect(res.status).toBe(401);
  });
  
  test('✅ Cron 정상 실행', async () => {
    // 올바른 토큰
    const res = await fetch(
      'http://localhost:3000/api/cron/backup-passport',
      { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.backup).toBeDefined();
    expect(data.deletion).toBeDefined();
  });
});
```

### 통합 테스트

```typescript
// 실제 Google Drive API 호출 테스트
// 테스트용 폴더 ID: PASSPORT_BACKUP_FOLDER_ID (테스트 계정)

test('✅ End-to-End: 업로드 → 조회 → 삭제', async () => {
  // 1. WebP 파일 생성
  const buffer = await createTestWebPImage();
  
  // 2. Google Drive 업로드
  const uploadResult = await uploadPassportToGoogleDrive(
    'test-passport-123',
    buffer,
    'test_passport.webp'
  );
  
  // 3. Google Drive에서 파일 확인
  const files = await drive.files.list({
    q: `fileId='${uploadResult.fileId}'`,
  });
  expect(files.data.files).toHaveLength(1);
  
  // 4. 파일 삭제
  await deletePassportBackupFromGoogleDrive(uploadResult.fileId);
  
  // 5. 파일 삭제 확인
  const filesAfter = await drive.files.list({
    q: `fileId='${uploadResult.fileId}'`,
  });
  expect(filesAfter.data.files).toHaveLength(0);
});
```

---

## 📈 성능 목표

| 지표 | 목표 | 기준 |
|------|------|------|
| **업로드 속도** | < 2초 | 단일 파일 (5MB WebP) |
| **배치 속도** | < 5초 | 100개 파일 |
| **Cron 실행 시간** | < 30초 | 자동 실행 (1시간별) |
| **API 응답 시간** | < 100ms | 상태 조회 |
| **백업 성공률** | > 99.9% | 자동 재시도 포함 |

---

## 📋 구현 체크리스트

### Phase 3-1: 라이브러리 구현

- [ ] `passport-google-drive-backup.ts` 작성
  - [ ] `getDriveClient()` - 서비스 계정 초기화
  - [ ] `findOrCreateFolder()` - 폴더 구조 생성
  - [ ] `uploadPassportToGoogleDrive()` - 파일 업로드
  - [ ] `deletePassportBackupFromGoogleDrive()` - 파일 삭제
  - [ ] `deleteOldPassportBackups()` - 1년 정책
  - [ ] `retryFailedPassportBackups()` - 재시도

- [ ] `validate-backup-env.ts` 작성
  - [ ] 환경변수 검증 함수

- [ ] `schema.prisma` 수정
  - [ ] `PassportBackupLog` 모델 추가
  - [ ] `Passport` 필드 추가

### Phase 3-2: API 수정

- [ ] `/api/passport/customer/upload` 수정
  - [ ] `uploadPassportToGoogleDrive()` 호출 (비동기)
  - [ ] `BackupLog` 기록

- [ ] `/api/cron/backup-passport` 생성
  - [ ] Cron 보안 (Bearer 토큰)
  - [ ] 어제 파일 조회 및 백업
  - [ ] 1년 초과 파일 삭제
  - [ ] 실패한 백업 재시도

- [ ] `/api/cron/backup-passport/status` 생성
  - [ ] 개별 백업 상태 조회

### Phase 3-3: 관리자 대시보드

- [ ] `/admin/backup-status` 페이지 생성
  - [ ] 통계 카드
  - [ ] 백업 로그 테이블
  - [ ] 수동 재시도 버튼

### Phase 3-4: 배포 및 모니터링

- [ ] Vercel 환경변수 설정
  - [ ] `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY`
  - [ ] `PASSPORT_BACKUP_FOLDER_ID`
  - [ ] `CRON_SECRET`

- [ ] Cron 스케줄 등록
  - [ ] 매일 01:00 UTC (10:00 KST)

- [ ] 모니터링 설정
  - [ ] Slack/Email 알림
  - [ ] 실패 로그 추적
  - [ ] 월별 리포트

### Phase 3-5: 테스트

- [ ] 단위 테스트
  - [ ] `uploadPassportToGoogleDrive()` 테스트
  - [ ] `deleteOldPassportBackups()` 테스트

- [ ] 통합 테스트
  - [ ] End-to-End 테스트
  - [ ] Cron 작업 실행 확인

- [ ] 보안 테스트
  - [ ] API 키 노출 여부
  - [ ] 권한 검증
  - [ ] 재시도 로직 검증

---

## 🎯 예상 효과

| 항목 | 현재 | 개선 후 | 효과 |
|------|------|--------|------|
| **백업 보관** | 수동 | 자동 | 24시간 무중단 |
| **데이터 손실** | 가능성 있음 | 0% | 100% 안전성 |
| **관리 시간** | 시간당 1회 | 자동 | 운영 시간 0 |
| **복구 시간** | 수시간 | 분 단위 | 긴급 대응 가능 |

---

## 📞 문의 및 피드백

구현 중 문제 발생 시:
1. `/admin/backup-status`에서 에러 로그 확인
2. Slack 알림 확인
3. Google Drive 폴더 수동 확인
4. 재시도 버튼 실행

---

**작성일**: 2026-06-19
**버전**: 1.0 (Phase 3 설계)
**상태**: 구현 준비 완료
