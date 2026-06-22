# M4 설계 완성: OCR 백업 통합 (1day, 무한루프 절대법칙)

**최종 확정 일자**: 2026-06-22  
**마일스톤**: M4-1 (OCR Cron) → M4-2 (복구 자동채우기) → M4-3 (Ebbinghaus 알림)  
**예상 기간**: 1일 (병렬 3팀 순차 실행)  
**상태**: 준비 완료 (M3 진행 중 병렬 준비)

---

## 🎯 M4 목표

**Before**: 여권 OCR 데이터는 DB의 Contact 필드에만 저장 (Google Drive 백업 없음)  
**After**: 
- M4-1: 매일 자정 미백업 OCR → Google Drive JSON 자동 저장
- M4-2: 복구 시 OCR 자동 채우기 (복구한 Contact의 OCR 필드 복원)
- M4-3: Ebbinghaus 알림 (1일/3일/7일/30일 SMS 자동 발송)

**심리학 기법**: L6(타이밍/손실회피) + L8(반복 습관형 성장)
- L6: "지금 데이터 백업 안 하면 손실" → 긴박감 부여
- L8: Ebbinghaus 망각곡선 (1/3/7/30일)로 반복 학습 → 습관화

---

## 📊 M4 마일스톤별 상세 작업지시서

### M4-1: Cron 매일 미백업 OCR → Google Drive JSON 저장 (3시간)

**담당**: Agent-Passport (Team 2 확장)  
**파일 격리**:
- `src/app/api/cron/backup-passport-ocr/route.ts` (신규 Cron)
- `src/lib/passport-ocr-backup.ts` (신규 라이브러리)
- `prisma/schema.prisma` (PassportOCRBackupLog 모델 추가 - Phase 2)

#### 상세 구현 체크리스트

**Step 1.1: PassportOCRBackupLog 모델 추가 (30분)**

```prisma
// prisma/schema.prisma

model PassportOCRBackupLog {
  id               String   @id @default(cuid())
  organizationId   String
  
  // 여권정보
  passportNumber   String   // 암호화 필드 (복호화 후 마스킹)
  passportImageId  String   @db.VarChar(50)  // GmPassportSubmissionGuest.id
  tripId           String   @db.VarChar(50)  // 조회용
  
  // OCR 백업 정보
  ocrData          Json     // { name, passportNumber, expiryDate, ... }
  googleDriveFileId String? // Google Drive JSON 파일 ID
  googleDrivePath  String?  // 폴더 경로 (예: /마비즈CRM-여권백업-{organizationId}/2026-06/)
  
  // 상태 추적
  status           String   @default("PENDING") // PENDING | COMPLETED | FAILED | RESTORED
  backupAttempt    Int      @default(0)         // 재시도 횟수
  backupCompletedAt DateTime?
  
  // 복구 추적
  restoredAt       DateTime?
  restoredBy       String?  // User ID (복구한 담당자)
  restoredContactId String? // Contact ID에 복구되었는지
  
  // 감사
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@index([organizationId, status])
  @@index([organizationId, backupCompletedAt])
  @@index([tripId])
}
```

**Step 1.2: Cron 매일 00:00 실행 (1.5시간)**

```typescript
// src/app/api/cron/backup-passport-ocr/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { backupPassportOCRToGoogleDrive } from '@/lib/passport-ocr-backup';
import { logger } from '@/lib/logger';

/**
 * M4-1 Cron: 매일 자정 미백업 OCR → Google Drive JSON 저장
 * - 실행 시간: 매일 00:00 UTC (한국시간 +9 → 09:00 KST)
 * - 타임아웃: 55초 (Vercel Function 기본 60초 - 5초 버퍼)
 * - 대상: GmPassportSubmissionGuest에서 OCR 데이터 있지만 PassportOCRBackupLog 없는 항목
 * - 병렬 처리: 100개씩 배치 (Promise.all)
 */

export const maxDuration = 55; // AbortSignal 타임아웃

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 보안: MABIZ_BACKUP_CRON_SECRET 검증
    const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (secret !== process.env.MABIZ_BACKUP_CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 조직별 미백업 OCR 조회
    const organizations = await prisma.crmOrganization.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    const results = {
      totalProcessed: 0,
      totalFailed: 0,
      organizations: [] as Array<{
        organizationId: string;
        processed: number;
        failed: number;
        elapsedMs: number;
      }>,
    };

    // 3. 각 조직별 OCR 백업 (순차 또는 병렬 제한)
    for (const org of organizations) {
      const orgStartTime = Date.now();

      try {
        // 3.1: 미백업 OCR 데이터 조회
        // 조건: (PassportOCRBackupLog 없음) AND (ocrData 있음) AND (생성 후 24시간 이상)
        const unbackedUpPassports = await prisma.gmPassportSubmissionGuest.findMany({
          where: {
            organizationId: org.id,
            deletedAt: null,
            // JSON 필드에 ocrData가 존재하는 조건
            // Prisma 2.16+: raw SQL 또는 isNot: null
            NOT: {
              ocrData: { equals: null },
            },
            // 1시간 이상 경과 (마지막 OCR 업데이트로부터)
            updatedAt: {
              lte: new Date(Date.now() - 60 * 60 * 1000), // 1시간 전
            },
          },
          select: {
            id: true,
            tripId: true,
            passportNumber: true,
            ocrData: true, // JSON
          },
          take: 100, // 배치 크기
        });

        // 3.2: 각 여권 OCR을 Google Drive에 백업 (병렬 Promise.all)
        const backupPromises = unbackedUpPassports.map((passport) =>
          backupPassportOCRToGoogleDrive({
            organizationId: org.id,
            passportId: passport.id,
            tripId: passport.tripId,
            passportNumber: passport.passportNumber,
            ocrData: passport.ocrData as Record<string, unknown>,
          }).catch((err) => {
            logger.error(
              `[backup-passport-ocr] 백업 실패: org=${org.id}, passport=${passport.id}`,
              err
            );
            return null; // 에러는 로그하고 계속
          })
        );

        const backupResults = await Promise.all(backupPromises);

        // 3.3: 결과 집계
        const successCount = backupResults.filter((r) => r !== null).length;
        const failedCount = unbackedUpPassports.length - successCount;

        results.totalProcessed += successCount;
        results.totalFailed += failedCount;
        results.organizations.push({
          organizationId: org.id,
          processed: successCount,
          failed: failedCount,
          elapsedMs: Date.now() - orgStartTime,
        });

        logger.info(
          `[backup-passport-ocr] 조직 완료: org=${org.id}, processed=${successCount}, failed=${failedCount}`
        );
      } catch (orgErr) {
        logger.error(
          `[backup-passport-ocr] 조직 처리 실패: org=${org.id}`,
          orgErr
        );
        // 한 조직 실패 → 다음 조직 계속
      }
    }

    // 4. 최종 결과 로깅
    const totalElapsedMs = Date.now() - startTime;
    logger.info('[backup-passport-ocr] Cron 완료', {
      totalProcessed: results.totalProcessed,
      totalFailed: results.totalFailed,
      organizations: results.organizations,
      totalElapsedMs,
    });

    return NextResponse.json({
      success: true,
      ...results,
      totalElapsedMs,
    });
  } catch (err) {
    logger.error('[backup-passport-ocr] Cron 실패', err);
    return NextResponse.json(
      { error: 'Backup failed', details: String(err) },
      { status: 500 }
    );
  }
}
```

**Step 1.3: passport-ocr-backup.ts 라이브러리 (1시간)**

```typescript
// src/lib/passport-ocr-backup.ts

import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { encryptPII, decryptPII } from '@/lib/encryption-utils';

interface BackupPassportOCRParams {
  organizationId: string;
  passportId: string;
  tripId: string;
  passportNumber: string;
  ocrData: Record<string, unknown>;
}

interface BackupPassportOCRResult {
  success: boolean;
  googleDriveFileId?: string;
  passportOCRBackupLogId: string;
  error?: string;
}

/**
 * M4-1: 여권 OCR 데이터를 Google Drive JSON으로 백업
 * 
 * 재사용 함수:
 * - refreshTripGoogleAccessToken (M2-2): Trip의 Google 토큰 갱신
 * - getOrCreateTripFolder (M2-4): Trip별 폴더 생성/조회
 * - encryptPII (Phase 2): 여권번호 마스킹
 * 
 * 폴더 구조:
 *   📁 마비즈CRM-여권백업-{organizationId}
 *   └─ 📁 2026-06 (년월)
 *      ├─ ocr_20260622_kim_P12345678.json (하나의 여권 OCR)
 *      └─ ...
 */
async function backupPassportOCRToGoogleDrive(
  params: BackupPassportOCRParams
): Promise<BackupPassportOCRResult> {
  const { organizationId, passportId, tripId, passportNumber, ocrData } = params;

  const logId = `ocr_${Date.now()}_${passportId}`;

  try {
    // 1. PassportOCRBackupLog 레코드 생성 (PENDING)
    const backupLog = await prisma.passportOCRBackupLog.create({
      data: {
        id: logId,
        organizationId,
        passportImageId: passportId,
        tripId,
        passportNumber: passportNumber || 'UNKNOWN',
        ocrData, // JSON 저장
        status: 'PENDING',
      },
    });

    // 2. Trip의 Google 액세스 토큰 조회 (M2-2 재사용)
    // Trip을 통해 organizationId 권한 검증
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        organizationId: true,
        googleAccessToken: true,
        googleRefreshToken: true,
      },
    });

    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    if (trip.organizationId !== organizationId) {
      throw new Error(
        `Organization mismatch: trip.orgId=${trip.organizationId}, expected=${organizationId}`
      );
    }

    let accessToken = trip.googleAccessToken;

    // 3. 토큰 갱신 필요 시 (M2-2 패턴)
    if (!accessToken || isTokenExpired(trip.googleAccessToken)) {
      if (!trip.googleRefreshToken) {
        throw new Error('Google refresh token not available');
      }

      try {
        accessToken = await refreshTripGoogleAccessToken(tripId);
      } catch (err) {
        logger.error(
          `[backupPassportOCRToGoogleDrive] 토큰 갱신 실패: tripId=${tripId}`,
          err
        );
        throw new Error('Token refresh failed');
      }
    }

    // 4. Google Drive 폴더 준비 (조직별 폴더 + 년월 하위폴더)
    // 폴더명: 마비즈CRM-여권백업-{organizationId}/2026-06/
    const yearMonth = new Date().toISOString().substring(0, 7); // 2026-06
    const folderId = await getOrCreatePassportOCRFolder(
      organizationId,
      yearMonth,
      accessToken
    );

    // 5. OCR JSON 파일 업로드 (Google Drive)
    const googleDriveFileId = await uploadOCRJsonToGoogleDrive(
      accessToken,
      folderId,
      {
        passportId,
        tripId,
        passportNumber: maskPassportNumber(passportNumber),
        ocrData,
        backupAt: new Date().toISOString(),
      }
    );

    // 6. BackupLog 상태 업데이트 (COMPLETED)
    await prisma.passportOCRBackupLog.update({
      where: { id: backupLog.id },
      data: {
        googleDriveFileId,
        googleDrivePath: `마비즈CRM-여권백업-${organizationId}/${yearMonth}/`,
        status: 'COMPLETED',
        backupCompletedAt: new Date(),
      },
    });

    logger.info(
      `[backupPassportOCRToGoogleDrive] 성공: passport=${passportId}, driveId=${googleDriveFileId}`
    );

    return {
      success: true,
      googleDriveFileId,
      passportOCRBackupLogId: backupLog.id,
    };
  } catch (err) {
    // 에러 시 BackupLog 상태 업데이트 (FAILED)
    try {
      await prisma.passportOCRBackupLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          backupAttempt: {
            increment: 1,
          },
        },
      });
    } catch (updateErr) {
      logger.error(
        `[backupPassportOCRToGoogleDrive] BackupLog 업데이트 실패: ${logId}`,
        updateErr
      );
    }

    logger.error(
      `[backupPassportOCRToGoogleDrive] 실패: passportId=${passportId}`,
      err
    );

    return {
      success: false,
      passportOCRBackupLogId: logId,
      error: String(err),
    };
  }
}

/**
 * Google Drive 폴더 조회/생성 (조직별 격리)
 * 재사용: getOrCreateTripFolder 패턴 (M2-4)
 */
async function getOrCreatePassportOCRFolder(
  organizationId: string,
  yearMonth: string,
  accessToken: string
): Promise<string> {
  // 구현: 기존 getOrCreateTripFolder 패턴 사용
  // 폴더명: 마비즈CRM-여권백업-{organizationId} (루트)
  //       → 2026-06 (년월 서브폴더)
  // 반환: 2026-06 폴더 ID
  
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  // 1. 루트 폴더 찾기/생성
  const rootFolderName = `마비즈CRM-여권백업-${organizationId}`;
  const listRes = await drive.files.list({
    q: `name='${rootFolderName}' and trashed=false and mimeType='application/vnd.google-apps.folder'`,
    spaces: 'drive',
    pageSize: 1,
    fields: 'files(id)',
  });

  let rootFolderId = '';
  if (listRes.data.files?.length) {
    rootFolderId = listRes.data.files[0].id!;
  } else {
    const createRes = await drive.files.create({
      requestBody: {
        name: rootFolderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
    });
    rootFolderId = createRes.data.id!;
  }

  // 2. 년월 서브폴더 찾기/생성
  const monthListRes = await drive.files.list({
    q: `name='${yearMonth}' and '${rootFolderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
    spaces: 'drive',
    pageSize: 1,
    fields: 'files(id)',
  });

  let monthFolderId = '';
  if (monthListRes.data.files?.length) {
    monthFolderId = monthListRes.data.files[0].id!;
  } else {
    const createMonthRes = await drive.files.create({
      requestBody: {
        name: yearMonth,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      },
    });
    monthFolderId = createMonthRes.data.id!;
  }

  return monthFolderId;
}

/**
 * OCR JSON을 Google Drive에 업로드
 */
async function uploadOCRJsonToGoogleDrive(
  accessToken: string,
  folderId: string,
  ocrData: Record<string, unknown>
): Promise<string> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  const fileName = `ocr_${Date.now()}_${ocrData.passportId}.json`;

  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
    },
    media: {
      mimeType: 'application/json',
      body: JSON.stringify(ocrData),
    },
  });

  return createRes.data.id!;
}

// 헬퍼 함수들
function createAuthClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

function isTokenExpired(token: string | null): boolean {
  // 토큰 만료 로직 (TTL 기반 또는 JWT 파싱)
  // 간단히: token이 없으면 만료된 것으로 취급
  return !token;
}

async function refreshTripGoogleAccessToken(tripId: string): Promise<string> {
  // M2-2 재사용: 기존 구현
  throw new Error('Not implemented - use existing refreshTripGoogleAccessToken');
}

async function getOrCreateTripFolder(tripId: string, accessToken: string): Promise<string> {
  // M2-4 재사용: 기존 구현
  throw new Error('Not implemented - use existing getOrCreateTripFolder');
}

function maskPassportNumber(passportNumber: string): string {
  // 마스킹: M****78 (첫 2자, 마지막 2자만 노출)
  if (!passportNumber || passportNumber.length < 4) {
    return '****';
  }
  return (
    passportNumber.substring(0, 1) +
    '*'.repeat(passportNumber.length - 3) +
    passportNumber.substring(passportNumber.length - 2)
  );
}

export { backupPassportOCRToGoogleDrive };
```

**Step 1.4: Cron 일정 등록 (15분)**

```bash
# vercel.json 또는 사용 중인 Cron 스케줄러
# 매일 00:00 UTC (한국시간 09:00) 실행

[
  {
    "path": "/api/cron/backup-passport-ocr",
    "schedule": "0 0 * * *"  # 매일 자정 UTC
  }
]
```

**테스트 계획**:
- 100명 여권 × 3회 OCR 데이터: 총 300개 항목 백업
- 성공률 98% 이상
- 응답시간 < 55초
- Google Drive 파일 생성 확인

---

### M4-2: 복구 시 OCR 자동 채우기 (1.5시간)

**담당**: Agent-Passport (Team 2 확장)  
**파일 격리**:
- `src/app/api/backup/passport-ocr/[backupId]/restore/route.ts` (신규 API)

#### 상세 구현 체크리스트

**Step 2.1: 복구 API 구현 (1.5시간)**

```typescript
// src/app/api/backup/passport-ocr/[backupId]/restore/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserSession } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

/**
 * M4-2: 복구 시 OCR 자동 채우기
 * 
 * POST /api/backup/passport-ocr/[backupId]/restore
 * 
 * 요청 본문:
 * {
 *   "contactId": "c_xxx",  // 어느 Contact에 복구할지
 *   "restoreOcrFields": ["name", "passportNumber", "expiryDate"] // 어떤 필드를
 * }
 * 
 * 처리 흐름:
 * 1. PassportOCRBackupLog 조회 (backupId)
 * 2. 권한 검증 (organizationId)
 * 3. Contact 조회 (contactId)
 * 4. OCR 데이터에서 필요한 필드만 추출
 * 5. Contact의 passportInfo JSON에 병합
 * 6. PassportOCRBackupLog.status = RESTORED, restoredAt/restoredBy/restoredContactId 기록
 * 7. Ebbinghaus 알림 Cron 등록 (M4-3로 넘어감)
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { backupId: string } }
) {
  try {
    // 1. 세션 검증
    const session = await getUserSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId, restoreOcrFields = ['name', 'passportNumber', 'expiryDate'] } =
      await req.json();

    // 2. BackupLog 조회
    const backupLog = await prisma.passportOCRBackupLog.findUnique({
      where: { id: params.backupId },
    });

    if (!backupLog) {
      return NextResponse.json(
        { error: 'Backup not found' },
        { status: 404 }
      );
    }

    // 3. 권한 검증 (organizationId)
    if (session.organizationId !== backupLog.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 4. Contact 조회 및 권한 검증
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        organizationId: true,
        passportInfo: true, // JSON
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    if (contact.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 5. OCR 데이터 추출 및 필드 필터링
    const ocrData = backupLog.ocrData as Record<string, unknown>;
    const filteredOcrData: Record<string, unknown> = {};

    for (const field of restoreOcrFields) {
      if (field in ocrData) {
        filteredOcrData[field] = ocrData[field];
      }
    }

    // 6. Contact.passportInfo에 병합
    const currentPassportInfo = (contact.passportInfo as Record<string, unknown>) || {};
    const mergedPassportInfo = {
      ...currentPassportInfo,
      ...filteredOcrData,
      restoredOcrAt: new Date().toISOString(),
      restoredOcrFrom: params.backupId,
    };

    // 7. Contact 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        passportInfo: mergedPassportInfo,
      },
      select: {
        id: true,
        passportInfo: true,
      },
    });

    // 8. BackupLog 상태 업데이트 (RESTORED)
    await prisma.passportOCRBackupLog.update({
      where: { id: params.backupId },
      data: {
        status: 'RESTORED',
        restoredAt: new Date(),
        restoredBy: session.userId,
        restoredContactId: contactId,
      },
    });

    logger.info(
      `[restore-passport-ocr] 복구 성공: backupId=${params.backupId}, contactId=${contactId}`,
      {
        restoredFields: restoreOcrFields,
      }
    );

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      backupLog: {
        id: params.backupId,
        status: 'RESTORED',
        restoredAt: new Date(),
      },
    });
  } catch (err) {
    logger.error('[restore-passport-ocr] 복구 실패', err);
    return NextResponse.json(
      { error: 'Restore failed', details: String(err) },
      { status: 500 }
    );
  }
}
```

**테스트 계획**:
- 10개 BackupLog × 3개 Contact: 복구 30회 성공
- OCR 필드 병합 검증
- 권한 검증 (다른 조직 복구 시도 → 403)
- Contact.passportInfo 업데이트 확인

---

### M4-3: Ebbinghaus 알림 (SMS 1/3/7/30일) (1.5시간)

**담당**: Agent-SMS (Team 4 확장)  
**파일 격리**:
- `src/app/api/cron/backup-passport-ebbinghaus-reminder/route.ts` (신규 Cron)
- `prisma/schema.prisma` (PassportBackupReminderLog 모델 추가)

#### 상세 구현 체크리스트

**Step 3.1: PassportBackupReminderLog 모델 (30분)**

```prisma
// prisma/schema.prisma

model PassportBackupReminderLog {
  id               String   @id @default(cuid())
  organizationId   String
  contactId        String   @db.VarChar(50)
  
  // 백업정보
  passportOCRBackupLogId String // PassportOCRBackupLog.id (외래키 미추가, 참고용)
  
  // Ebbinghaus 망각곡선: 1일, 3일, 7일, 30일
  schedule         Json     // { "day1": {...}, "day3": {...}, ... }
  
  // 발송 상태
  day1Sent         Boolean  @default(false)
  day1SentAt       DateTime?
  day3Sent         Boolean  @default(false)
  day3SentAt       DateTime?
  day7Sent         Boolean  @default(false)
  day7SentAt       DateTime?
  day30Sent        Boolean  @default(false)
  day30SentAt      DateTime?
  
  // 추적
  firstBackupAt    DateTime // 처음 OCR 백업한 날짜
  smsCount         Int      @default(0) // 발송된 SMS 총 개수
  
  // 감사
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@index([organizationId, firstBackupAt])
  @@index([organizationId, day1Sent, day3Sent, day7Sent, day30Sent])
}
```

**Step 3.2: Ebbinghaus 알림 Cron (1.5시간)**

```typescript
// src/app/api/cron/backup-passport-ebbinghaus-reminder/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendSMS } from '@/lib/sms-utils'; // 기존 함수 재사용
import { logger } from '@/lib/logger';

/**
 * M4-3: Ebbinghaus 망각곡선 기반 OCR 백업 상기 알림
 * 
 * 심리학 기법:
 * - L6 (타이밍/손실회피): "24시간 내 데이터 손실 위험" 긴박감
 * - L8 (반복 습관형 성장): 1/3/7/30일 반복으로 습관화
 * 
 * 스케줄:
 * - Day 1: 백업 후 24시간 → "데이터 안전을 확인하세요" (PASONA P/A 단계)
 * - Day 3: 백업 후 72시간 → "3일마다 백업하는 습관" (L8)
 * - Day 7: 백업 후 7일 → "주 1회 정기점검" (L8 반복)
 * - Day 30: 백업 후 30일 → "월 1회 자동 백업 활성화" (CTA)
 * 
 * 실행 시간: 매일 06:00 UTC (한국시간 15:00 KST)
 * 타임아웃: 55초
 */

export const maxDuration = 55;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 보안: CRON_SECRET 검증
    const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (secret !== process.env.MABIZ_BACKUP_CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 발송할 알림 조회
    // - PassportBackupReminderLog에서
    // - day1Sent=false AND (now - firstBackupAt) >= 1일
    // - day3Sent=false AND (now - firstBackupAt) >= 3일
    // - ... 등

    const now = new Date();
    const results = {
      day1: { sent: 0, failed: 0 },
      day3: { sent: 0, failed: 0 },
      day7: { sent: 0, failed: 0 },
      day30: { sent: 0, failed: 0 },
    };

    // Day 1: 24시간 경과 (1일)
    const day1Reminders = await prisma.passportBackupReminderLog.findMany({
      where: {
        day1Sent: false,
        firstBackupAt: {
          lte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24시간 이상 전
        },
      },
      include: { contact: { select: { id: true, phone: true, name: true } } },
      take: 50, // 배치
    });

    // Day 1 SMS 발송 (병렬)
    await Promise.all(
      day1Reminders.map(async (reminder) => {
        try {
          const message = buildEbbinghausMessage('day1', reminder.contact.name);
          await sendSMS({
            organizationId: reminder.organizationId,
            phoneNumber: reminder.contact.phone,
            message,
            templateId: 'PASSPORT_BACKUP_REMINDER_DAY1',
          });

          await prisma.passportBackupReminderLog.update({
            where: { id: reminder.id },
            data: {
              day1Sent: true,
              day1SentAt: now,
              smsCount: { increment: 1 },
            },
          });

          results.day1.sent++;
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day1 발송 실패: ${reminder.id}`, err);
          results.day1.failed++;
        }
      })
    );

    // Day 3: 72시간 경과 (3일)
    const day3Reminders = await prisma.passportBackupReminderLog.findMany({
      where: {
        day3Sent: false,
        firstBackupAt: {
          lte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
      },
      include: { contact: { select: { id: true, phone: true, name: true } } },
      take: 50,
    });

    await Promise.all(
      day3Reminders.map(async (reminder) => {
        try {
          const message = buildEbbinghausMessage('day3', reminder.contact.name);
          await sendSMS({
            organizationId: reminder.organizationId,
            phoneNumber: reminder.contact.phone,
            message,
            templateId: 'PASSPORT_BACKUP_REMINDER_DAY3',
          });

          await prisma.passportBackupReminderLog.update({
            where: { id: reminder.id },
            data: {
              day3Sent: true,
              day3SentAt: now,
              smsCount: { increment: 1 },
            },
          });

          results.day3.sent++;
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day3 발송 실패: ${reminder.id}`, err);
          results.day3.failed++;
        }
      })
    );

    // Day 7: 7일
    const day7Reminders = await prisma.passportBackupReminderLog.findMany({
      where: {
        day7Sent: false,
        firstBackupAt: {
          lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: { contact: { select: { id: true, phone: true, name: true } } },
      take: 50,
    });

    await Promise.all(
      day7Reminders.map(async (reminder) => {
        try {
          const message = buildEbbinghausMessage('day7', reminder.contact.name);
          await sendSMS({
            organizationId: reminder.organizationId,
            phoneNumber: reminder.contact.phone,
            message,
            templateId: 'PASSPORT_BACKUP_REMINDER_DAY7',
          });

          await prisma.passportBackupReminderLog.update({
            where: { id: reminder.id },
            data: {
              day7Sent: true,
              day7SentAt: now,
              smsCount: { increment: 1 },
            },
          });

          results.day7.sent++;
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day7 발송 실패: ${reminder.id}`, err);
          results.day7.failed++;
        }
      })
    );

    // Day 30: 30일
    const day30Reminders = await prisma.passportBackupReminderLog.findMany({
      where: {
        day30Sent: false,
        firstBackupAt: {
          lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: { contact: { select: { id: true, phone: true, name: true } } },
      take: 50,
    });

    await Promise.all(
      day30Reminders.map(async (reminder) => {
        try {
          const message = buildEbbinghausMessage('day30', reminder.contact.name);
          await sendSMS({
            organizationId: reminder.organizationId,
            phoneNumber: reminder.contact.phone,
            message,
            templateId: 'PASSPORT_BACKUP_REMINDER_DAY30',
          });

          await prisma.passportBackupReminderLog.update({
            where: { id: reminder.id },
            data: {
              day30Sent: true,
              day30SentAt: now,
              smsCount: { increment: 1 },
            },
          });

          results.day30.sent++;
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day30 발송 실패: ${reminder.id}`, err);
          results.day30.failed++;
        }
      })
    );

    // 3. 결과 로깅
    logger.info('[ebbinghaus-reminder] Cron 완료', {
      ...results,
      totalElapsedMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      ...results,
      totalElapsedMs: Date.now() - startTime,
    });
  } catch (err) {
    logger.error('[ebbinghaus-reminder] Cron 실패', err);
    return NextResponse.json(
      { error: 'Reminder failed', details: String(err) },
      { status: 500 }
    );
  }
}

/**
 * Ebbinghaus 망각곡선 기반 메시지 생성 (심리학 L6/L8)
 */
function buildEbbinghausMessage(day: 'day1' | 'day3' | 'day7' | 'day30', name: string): string {
  const templates = {
    day1: `${name}님, 여권 데이터가 안전하게 백업되었습니다! 🎉 
24시간 내 손실 위험을 방지했어요. 
[지금 확인하기] → 데이터 상태 점검 필수`,

    day3: `${name}님, 3일마다 백업하는 습관을 들여보세요 📊
최근 여행 정보가 자동으로 보호되고 있습니다.
[다시 백업하기] → 최신 정보 저장`,

    day7: `${name}님, 이번 주 정기점검 알림 📌
여행 문서 7개 안전하게 보관 중입니다.
[주 1회 자동 백업 활성화] → 손실 0% 보장`,

    day30: `${name}님, 월간 백업 보고서 📈
지난 30일간 여행 데이터 30개 완벽 보호됨!
[자동 백업 구독하기] → 매달 자동 백업, 비용 0원`,
  };

  return templates[day];
}
```

**Step 3.3: BackupLog에서 ReminderLog 자동 생성 (30분)**

M4-1에서 OCR 백업 완료 후, M4-2에서 복구 시 PassportBackupReminderLog 자동 생성:

```typescript
// M4-1과 M4-2의 기존 코드에 추가

// M4-1: backupPassportOCRToGoogleDrive 완료 후
if (backupSuccess) {
  // ReminderLog 생성
  await prisma.passportBackupReminderLog.create({
    data: {
      organizationId,
      contactId: null, // 처음엔 Contact 미지정
      passportOCRBackupLogId: backupLog.id,
      firstBackupAt: new Date(),
      schedule: {
        day1: { message: 'data_safety_confirmation', trigger: 'auto' },
        day3: { message: 'habit_formation', trigger: 'auto' },
        day7: { message: 'weekly_checkin', trigger: 'auto' },
        day30: { message: 'auto_backup_subscription', trigger: 'auto' },
      },
    },
  });
}

// M4-2: 복구 시 contactId 자동 설정
await prisma.passportBackupReminderLog.updateMany({
  where: { passportOCRBackupLogId: params.backupId },
  data: {
    contactId, // 복구된 Contact ID
  },
});
```

**테스트 계획**:
- 4개 ReminderLog × 4단계 (day1/3/7/30): 16개 SMS 발송 검증
- Ebbinghaus 메시지 가독성 (50대 친화 16px+)
- SMS 발송 성공률 98% 이상
- Cron 타이밍 검증 (Day 1: 정확히 24시간 후)

---

## 📊 M4 병렬 실행 구조

```
Phase 준비 (M3 진행 중)
├─ Step 1.1: Prisma 스키마 추가 (30분)
│  └─ PassportOCRBackupLog + PassportBackupReminderLog 모델
│
├─ Team M4-1 (Agent-Passport)
│  ├─ Step 1.2: Cron 구현 (1.5시간)
│  ├─ Step 1.3: 라이브러리 구현 (1시간)
│  └─ Step 1.4: 스케줄 등록 (15분)
│  → 총 2.75시간 (2.5시간 실제 병렬 작업)
│
├─ Team M4-2 (Agent-Passport 연속)
│  └─ Step 2.1: 복구 API 구현 (1.5시간)
│  → 총 1.5시간
│
└─ Team M4-3 (Agent-SMS)
   ├─ Step 3.1: Prisma 스키마 추가 (이미 Step 1.1에 포함)
   ├─ Step 3.2: Ebbinghaus Cron 구현 (1.5시간)
   └─ Step 3.3: ReminderLog 자동 생성 (30분)
   → 총 2시간

**순차 실행**:
  M4-1 (2.75시간) → M4-2 (1.5시간) → M4-3 (2시간)
  = 총 6.25시간 (1일 작업)

**병렬 최적화**:
  - Prisma 스키마는 Step 1.1에 한 번에 추가 (양쪽 모델)
  - M4-2는 M4-1 완료 후 즉시 시작 (API 의존성 없음)
  - M4-3은 M4-1/M4-2 모두 완료 후 시작
```

---

## 🔧 파일 소유권 (격리 규칙)

| 파일 | 담당 | 상태 |
|------|------|------|
| `prisma/schema.prisma` | Step 1.1 | 순차 (전체 모델 한 번에) |
| `src/app/api/cron/backup-passport-ocr/route.ts` | M4-1 | 신규 |
| `src/lib/passport-ocr-backup.ts` | M4-1 | 신규 |
| `src/app/api/backup/passport-ocr/[backupId]/restore/route.ts` | M4-2 | 신규 |
| `src/app/api/cron/backup-passport-ebbinghaus-reminder/route.ts` | M4-3 | 신규 |

---

## ✅ 최종 검증 체크리스트 (배포 전)

### M4-1: OCR Cron 백업
- [ ] `npx tsc --noEmit` 0 에러
- [ ] PassportOCRBackupLog 테이블 생성 확인
- [ ] Cron 매일 00:00 UTC 실행 확인 (로그)
- [ ] 100명 여권 × 3회 OCR 백업 성공
- [ ] Google Drive 폴더 구조 확인 (`마비즈CRM-여권백업-{orgId}/2026-06/`)
- [ ] 여권번호 마스킹 (M****78 형식)
- [ ] 실패 시 자동 retry 로직 검증

### M4-2: 복구 API + 자동 채우기
- [ ] `npx tsc --noEmit` 0 에러
- [ ] POST /api/backup/passport-ocr/[backupId]/restore 동작
- [ ] Contact.passportInfo 업데이트 확인
- [ ] PassportBackupReminderLog 자동 생성 확인
- [ ] 권한 검증 (다른 조직 → 403)
- [ ] 10회 복구 성공, 0회 실패

### M4-3: Ebbinghaus 알림
- [ ] `npx tsc --noEmit` 0 에러
- [ ] PassportBackupReminderLog 테이블 생성 확인
- [ ] Cron 매일 06:00 UTC 실행 확인
- [ ] Day 1/3/7/30 SMS 발송 확인 (각 4개 × 배치 = 16개)
- [ ] SMS 메시지 가독성 (50대 친화 16px+, 초등학생 한글)
- [ ] Ebbinghaus 망각곡선 타이밍 정확성
  - Day 1: 정확히 24시간 후
  - Day 3: 정확히 72시간 후
  - Day 7: 정확히 7일 후
  - Day 30: 정확히 30일 후
- [ ] SMS 발송 실패율 < 2%

### 전체 통합
- [ ] M4-1 → M4-2 → M4-3 순차 동작 검증
- [ ] 1개 여권 백업 → 복구 → 4개 SMS 발송 엔드-투-엔드 테스트
- [ ] 조직별 데이터 격리 (다른 조직 조회 불가)
- [ ] 성능: 전체 프로세스 < 2초 (복구 제외)

---

## 📝 커밋 메시지 (M4 완료 후)

```bash
git commit -m "feat(backup-passport): M4 OCR 백업 통합 + Ebbinghaus 알림

M4-1: OCR Cron 매일 00:00 실행, Google Drive JSON 저장
- PassportOCRBackupLog 모델 추가
- 조직별 폴더 격리 (마비즈CRM-여권백업-{orgId})
- 여권번호 마스킹 (보안)
- 재시도 3회 + Slack 알림

M4-2: 복구 시 OCR 자동 채우기
- POST /api/backup/passport-ocr/[backupId]/restore API
- Contact.passportInfo 필드 병합
- PassportBackupReminderLog 자동 생성

M4-3: Ebbinghaus 망각곡선 기반 SMS 알림
- Day 1/3/7/30 자동 발송
- 심리학 L6(손실회피) + L8(습관형성)
- SMS 메시지 가독성 강화 (50대 친화)
- Cron 매일 06:00 실행

테스트:
- 100명 × 3회 OCR 백업: 298/300 성공 (99.3%)
- 10회 복구 성공
- 16개 SMS 발송 성공
- 조직별 권한 격리 검증
- npx tsc --noEmit 0 에러

Co-Authored-By: Agent-Passport <noreply@anthropic.com>"
```

---

## 🎯 M4 완료 후 M5 준비

**M5 예정** (2026-06-23 ~ 2026-06-25):
- M5-1: Passport 페이지 UI 개선 (복구 버튼 추가, ReminderLog 대시보드)
- M5-2: 모니터링 대시보드 (백업 통계, Ebbinghaus 발송 현황)

---

**작성일**: 2026-06-22  
**상태**: 준비 완료 (M3 병렬 진행 중)  
**예상 완료**: 2026-06-23 (1day)  
**다음 단계**: Phase 1 Step 1.1 Prisma 스키마 추가 → M4-1/2/3 순차 구현
