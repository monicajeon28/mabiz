# M3: Restore API (Trip 레벨 여권 복구) 작업지시서 (2026-06-22)

**Phase**: Phase 1C (Passport 백업 심화 - Trip 단위 복구)  
**상태**: 🚀 준비 완료 (M2 완료 후 즉시 실행)  
**팀 구성**: 5개 팀 병렬 실행  
**예상 기간**: 3-4일 (2026-06-22 ~ 2026-06-26)  
**의존성**: M2 완료 필수 (Google Drive Trip 폴더 구조 확정)  

---

## 📋 개요 및 목표

### 현재 상황 (M2 완료 후)
- ✅ Passport 여권 파일 Google Drive에 백업됨
- ✅ Trip별 폴더 구조 확정: `/마비즈CRM-여권백업-{organizationId}/{tripId}/`
- ✅ GmTripGoogleDriveConfig 테이블에 Trip별 accessToken 암호화 저장
- ✅ Cron 매일 01:00 UTC에 자동 백업

### M3 목표
**Trip 레벨에서 여권 데이터 복구 가능하게 만들기**

1. **Restore API 엔드포인트 추가**
   - `GET /api/backup/passport/{id}/list` — Trip 폴더의 모든 백업 파일 목록
   - `GET /api/backup/passport/{id}/download/{fileId}` — 특정 파일 다운로드
   - `POST /api/backup/passport/{id}/restore/{fileId}` — 파일 복구 (DB 업데이트)

2. **권한 검증 강화**
   - Trip 소유 확인 (organizationId + Trip)
   - 사용자 권한 확인 (OWNER/ADMIN)
   - GmTripGoogleDriveConfig의 accessToken 이용해 Google Drive 접근

3. **복구 이력 추적**
   - PassportBackupRestoreLog 테이블 활용
   - 누가/언제/어떤 파일을 복구했는지 기록

4. **오류 처리 강화**
   - 토큰 만료 시 자동 갱신
   - Google Drive 오류 시 재시도 로직
   - 네트워크 타임아웃 처리

---

## 🎯 5개 마일스톤 (팀별)

### M3-1: REST 엔드포인트 설계 (Team 1)
**담당**: Agent-Passport (API Layer)  
**파일 격리**: 
- `src/app/api/backup/passport/[id]/route.ts` (신규 - 목록/다운로드)
- `src/app/api/backup/passport/[id]/restore/route.ts` (신규 - 복구)

**작업 상세**:

#### 1-1: 목록 조회 API
```
GET /api/backup/passport/{tripId}

응답 (성공):
{
  "ok": true,
  "data": {
    "tripId": "trip-123",
    "files": [
      {
        "id": "drive-file-id-1",
        "name": "passport_123456_2026-06-22_backup.json",
        "createdAt": "2026-06-22T10:00:00Z",
        "size": 150000,
        "mimeType": "application/json"
      },
      ...
    ],
    "pagination": {
      "total": 42,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  },
  "timestamp": "2026-06-22T10:00:00Z"
}
```

#### 1-2: 파일 다운로드 API
```
GET /api/backup/passport/{tripId}/download/{fileId}

응답 (성공):
- Content-Type: application/json (또는 이미지)
- 파일 내용 (Binary)

응답 (오류):
- 404: 파일 없음
- 403: 권한 없음
- 500: Google Drive API 오류
```

#### 1-3: 복구 API
```
POST /api/backup/passport/{tripId}/restore/{fileId}

요청본문:
{
  "action": "restore_all",  // restore_all | restore_fields
  "fields": ["submittedAt", "passportNumber"],  // 선택사항
  "overwrite": true         // 기존 데이터 덮어쓰기 여부
}

응답 (성공):
{
  "ok": true,
  "message": "여권 복구 완료",
  "data": {
    "restoredGuests": 3,     // 복구된 게스트 수
    "restoredFields": ["submittedAt", "passportNumber"],
    "restoreLog": {
      "id": "log-123",
      "tripId": "trip-123",
      "fileId": "drive-file-id-1",
      "restoredBy": "user-123",
      "restoredByName": "김철수",
      "restoredAt": "2026-06-22T10:00:00Z",
      "status": "SUCCESS",
      "restoredCount": 3,
      "errorCount": 0
    }
  }
}
```

**마일스톤 체크리스트**:
- [ ] 3개 엔드포인트 라우트 정의 (route.ts 구조)
- [ ] 요청/응답 DTO 타입 정의 (types.ts)
- [ ] 에러 응답 표준화 (400/403/404/500)
- [ ] npx tsc --noEmit 통과

---

### M3-2: Google Drive 파일 다운로드 (Team 2)
**담당**: Agent-Passport (Google Drive Integration)  
**파일 격리**:
- `src/lib/passport-google-drive-restore.ts` (신규 - 복구 로직)

**작업 상세**:

#### 2-1: 토큰 조회 및 갱신
```typescript
// getDecryptedTripAccessToken()를 이미 M2에서 사용 중
// 이를 재사용하되, 토큰 만료 시 자동 갱신

async function getOrRefreshTripAccessToken(tripId: number): Promise<string> {
  // Step 1: GmTripGoogleDriveConfig에서 토큰 조회
  const config = await prisma.gmTripGoogleDriveConfig.findUnique({
    where: { tripId },
    select: {
      accessToken: true,       // 암호화됨
      accessTokenExpiresAt: true,
      refreshToken: true,      // 암호화됨
    },
  });

  if (!config) {
    throw new Error(`Trip ${tripId} Google Drive 설정 없음`);
  }

  // Step 2: 토큰 복호화
  const accessToken = decryptString(config.accessToken);
  
  // Step 3: 토큰 유효성 확인 (만료 5분 전까지 갱신)
  if (config.accessTokenExpiresAt && 
      new Date() > new Date(config.accessTokenExpiresAt.getTime() - 5 * 60 * 1000)) {
    // Step 4: 토큰 갱신 (Google OAuth API)
    const newAccessToken = await refreshGoogleAccessToken(
      config.refreshToken
    );
    
    // Step 5: DB에 새 토큰 저장 (암호화)
    await prisma.gmTripGoogleDriveConfig.update({
      where: { tripId },
      data: {
        accessToken: encryptString(newAccessToken.access_token),
        accessTokenExpiresAt: new Date(Date.now() + newAccessToken.expires_in * 1000),
      },
    });
    
    return newAccessToken.access_token;
  }

  return accessToken;
}
```

#### 2-2: 파일 목록 조회
```typescript
async function listBackupFilesInTrip(
  tripId: number,
  organizationId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ files: DriveFile[], total: number }> {
  // Step 1: 토큰 조회 + 갱신
  const accessToken = await getOrRefreshTripAccessToken(tripId);

  // Step 2: GmTripGoogleDriveConfig에서 폴더 ID 조회
  const config = await prisma.gmTripGoogleDriveConfig.findUnique({
    where: { tripId },
    select: { googleDriveFolderId: true },
  });

  if (!config?.googleDriveFolderId) {
    throw new Error(`Trip ${tripId} Google Drive 폴더 미설정`);
  }

  // Step 3: Google Drive API로 폴더 내 파일 목록 조회
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?` +
    `q=trashed=false and '${config.googleDriveFolderId}' in parents&` +
    `pageSize=${limit}&startIndex=${offset}&` +
    `fields=files(id,name,mimeType,createdTime,size)&` +
    `orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // 토큰 갱신 재시도 (한 번)
      const newAccessToken = await refreshGoogleAccessToken(
        config.refreshToken as unknown as string
      );
      return listBackupFilesInTrip(tripId, organizationId, limit, offset);
    }
    throw new Error(`Google Drive API 오류 (${response.status})`);
  }

  const data = await response.json() as { files: Array<{id: string, name: string, mimeType: string, createdTime: string, size: number}> };
  
  return {
    files: data.files.map(f => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdTime,
      size: f.size,
      mimeType: f.mimeType,
    })),
    total: data.files.length, // TODO: pagination token 사용
  };
}
```

#### 2-3: 파일 다운로드
```typescript
async function downloadBackupFileFromGoogleDrive(
  tripId: number,
  organizationId: string,
  fileId: string
): Promise<Buffer> {
  // Step 1: 토큰 조회 + 갱신
  const accessToken = await getOrRefreshTripAccessToken(tripId);

  // Step 2: 다운로드 (Google Drive API)
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // 토큰 갱신 후 재시도
      const config = await prisma.gmTripGoogleDriveConfig.findUnique({
        where: { tripId },
        select: { refreshToken: true },
      });
      const newAccessToken = await refreshGoogleAccessToken(
        config?.refreshToken as unknown as string
      );
      return downloadBackupFileFromGoogleDrive(tripId, organizationId, fileId);
    }
    throw new Error(`파일 다운로드 실패 (${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}
```

#### 2-4: 파일 내용 파싱
```typescript
async function parseBackupFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<PassportBackupData> {
  if (mimeType === 'application/json') {
    // JSON 파일 (OCR 결과 또는 메타데이터)
    const json = JSON.parse(fileBuffer.toString('utf-8'));
    return json as PassportBackupData;
  } else if (mimeType === 'image/webp' || mimeType === 'image/jpeg') {
    // 이미지 파일 (raw 바이너리)
    return {
      type: 'image',
      data: fileBuffer,
      mimeType,
    } as unknown as PassportBackupData;
  }

  throw new Error(`지원하지 않는 파일 형식: ${mimeType}`);
}
```

**마일스톤 체크리스트**:
- [ ] getOrRefreshTripAccessToken() 구현 (M2 함수 재사용)
- [ ] listBackupFilesInTrip() 구현
- [ ] downloadBackupFileFromGoogleDrive() 구현
- [ ] parseBackupFile() 구현
- [ ] 타임아웃 처리 (AbortSignal 55초)
- [ ] 재시도 로직 (3회)
- [ ] npx tsc --noEmit 통과

---

### M3-3: 권한 검증 체인 (Team 3)
**담당**: Agent-Passport (Authorization Layer)  
**파일 격리**:
- `src/lib/passport-restore-authz.ts` (신규 - 권한 검증)

**작업 상세**:

#### 3-1: Trip 소유권 검증
```typescript
async function verifyTripOwnership(
  tripId: number,
  organizationId: string
): Promise<boolean> {
  // Step 1: Trip이 해당 Organization에 속하는지 확인
  const trip = await prisma.gmTrip.findUnique({
    where: { id: tripId },
    select: { organizationId: true },
  });

  if (!trip) {
    return false; // Trip 없음
  }

  // Step 2: organizationId 일치 확인
  return trip.organizationId === organizationId;
}
```

#### 3-2: 사용자 권한 검증
```typescript
async function verifyRestorePermission(
  ctx: AuthContext,
  tripId: number,
  action: 'list' | 'download' | 'restore'
): Promise<{ ok: boolean; error?: string }> {
  // Step 1: 인증 확인
  if (!ctx.userId) {
    return { ok: false, error: '인증 필요' };
  }

  // Step 2: Trip 소유권 확인
  const isOwner = await verifyTripOwnership(tripId, ctx.organizationId);
  if (!isOwner) {
    return { ok: false, error: '권한 없음' };
  }

  // Step 3: 역할 확인 (restore는 OWNER/ADMIN만)
  if (action === 'restore' && !['OWNER', 'ADMIN'].includes(ctx.role)) {
    return { ok: false, error: '복구 권한 없음 (OWNER/ADMIN 필요)' };
  }

  // Step 4: 조회 권한 (list/download는 OWNER/ADMIN/MANAGER)
  if ((action === 'list' || action === 'download') && 
      !['OWNER', 'ADMIN', 'MANAGER'].includes(ctx.role)) {
    return { ok: false, error: '조회 권한 없음' };
  }

  return { ok: true };
}
```

#### 3-3: 파일 접근 권한 검증
```typescript
async function verifyFileAccess(
  tripId: number,
  fileId: string,
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  // Step 1: Trip 소유권 (이미 확인됨, 검증용)
  const isOwner = await verifyTripOwnership(tripId, organizationId);
  if (!isOwner) {
    return { ok: false, error: 'Trip 소유권 없음' };
  }

  // Step 2: Google Drive 파일이 Trip의 폴더에 속하는지 확인
  const config = await prisma.gmTripGoogleDriveConfig.findUnique({
    where: { tripId },
    select: { googleDriveFolderId: true },
  });

  if (!config?.googleDriveFolderId) {
    return { ok: false, error: 'Trip Google Drive 설정 없음' };
  }

  // Step 3: 파일이 Trip 폴더 내에 있는지 API로 확인
  const accessToken = await getOrRefreshTripAccessToken(tripId);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,parents`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    return { ok: false, error: '파일 조회 실패' };
  }

  const file = await response.json() as { id: string; parents: string[] };
  if (!file.parents.includes(config.googleDriveFolderId)) {
    return { ok: false, error: '파일 접근 권한 없음' };
  }

  return { ok: true };
}
```

#### 3-4: 감사 로그
```typescript
async function logRestoreAction(
  organizationId: string,
  tripId: number,
  fileId: string,
  userId: string,
  userName: string,
  action: string,
  status: 'SUCCESS' | 'FAILED',
  errorMessage?: string
): Promise<void> {
  await prisma.passportBackupRestoreLog.create({
    data: {
      organizationId,
      tripId,
      fileId,
      userId,
      userName,
      action,
      status,
      errorMessage,
      timestamp: new Date(),
      ipAddress: getClientIp(), // TODO: 클라이언트 IP 추출
    },
  });
}
```

**마일스톤 체크리스트**:
- [ ] verifyTripOwnership() 구현
- [ ] verifyRestorePermission() 구현 (list/download/restore 세분화)
- [ ] verifyFileAccess() 구현 (Google Drive API 검증)
- [ ] logRestoreAction() 구현
- [ ] IP 주소 로깅 (getClientIp 함수)
- [ ] npx tsc --noEmit 통과

---

### M3-4: DB 복구 로직 + 이력 (Team 4)
**담당**: Agent-Passport (Database Layer)  
**파일 격리**:
- `src/lib/passport-restore-db.ts` (신규 - DB 복구)
- `prisma/schema.prisma` (PassportBackupRestoreLog 모델 확인)

**작업 상세**:

#### 4-1: PassportBackupRestoreLog 스키마 확인/추가
```prisma
model PassportBackupRestoreLog {
  id            String   @id @default(cuid())
  
  // 조직/여행 정보
  organizationId String
  tripId        Int
  fileId        String?  // Google Drive File ID
  
  // 사용자 정보
  userId        String
  userName      String
  
  // 복구 정보
  action        String   // LIST | DOWNLOAD | RESTORE
  status        String   // SUCCESS | FAILED
  restoredCount Int?     // 복구된 레코드 수
  errorCount    Int?     // 오류난 레코드 수
  errorMessage  String?
  
  // 감사
  ipAddress     String?
  timestamp     DateTime @default(now())
  
  // 인덱스
  @@index([organizationId, tripId])
  @@index([organizationId, timestamp])
  @@index([userId, timestamp])
}
```

#### 4-2: 백업 파일에서 데이터 추출
```typescript
interface PassportBackupData {
  format: 'json' | 'image';
  guests?: GuestBackup[];
  metadata?: {
    backupAt: string;
    version: string;
    organizationId: string;
    tripId: number;
  };
  imageData?: {
    type: 'webp' | 'jpeg';
    buffer: Buffer;
    guestId: string;
  };
}

interface GuestBackup {
  guestId: string;
  passportNumber: string;
  submittedAt: string;
  nationality: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  passportIssuingCountry: string;
  passportExpiry: string;
  // ... 기타 필드
}

async function extractBackupData(
  fileBuffer: Buffer,
  mimeType: string
): Promise<PassportBackupData> {
  if (mimeType === 'application/json') {
    const json = JSON.parse(fileBuffer.toString('utf-8'));
    
    if (json.format === 'json' && Array.isArray(json.guests)) {
      return {
        format: 'json',
        guests: json.guests,
        metadata: json.metadata,
      };
    }
  } else if (['image/webp', 'image/jpeg'].includes(mimeType)) {
    // 이미지는 별도 처리
    return {
      format: 'image',
      imageData: {
        type: mimeType === 'image/webp' ? 'webp' : 'jpeg',
        buffer: fileBuffer,
        guestId: '', // TODO: 메타데이터에서 추출
      },
    };
  }

  throw new Error(`지원하지 않는 형식: ${mimeType}`);
}
```

#### 4-3: 트랜잭션 기반 복구 로직
```typescript
async function restoreGuestsFromBackup(
  tripId: number,
  organizationId: string,
  backupData: PassportBackupData,
  options: {
    action: 'restore_all' | 'restore_fields';
    fields?: string[];
    overwrite?: boolean;
  }
): Promise<{ restoredCount: number; errorCount: number; errors: Error[] }> {
  const errors: Error[] = [];
  let restoredCount = 0;
  let errorCount = 0;

  // Step 1: 트랜잭션 시작
  const result = await prisma.$transaction(
    async (tx) => {
      if (!backupData.guests) {
        throw new Error('백업 파일에 게스트 데이터 없음');
      }

      // Step 2: 각 게스트별 복구
      for (const guestBackup of backupData.guests) {
        try {
          // Step 2-1: 기존 게스트 조회
          const existingGuest = await tx.gmPassportSubmissionGuest.findFirst({
            where: {
              passportNumber: guestBackup.passportNumber,
              submission: {
                tripId: tripId,
              },
            },
          });

          if (!existingGuest && !options.overwrite) {
            // 새 게스트 생성
            await tx.gmPassportSubmissionGuest.create({
              data: {
                passportNumber: guestBackup.passportNumber,
                submittedAt: new Date(guestBackup.submittedAt),
                nationality: guestBackup.nationality,
                firstName: guestBackup.firstName,
                lastName: guestBackup.lastName,
                dateOfBirth: new Date(guestBackup.dateOfBirth),
                gender: guestBackup.gender,
                passportIssuingCountry: guestBackup.passportIssuingCountry,
                passportExpiry: new Date(guestBackup.passportExpiry),
                // ... 기타 필드
              },
            });
            restoredCount++;
          } else if (existingGuest && options.overwrite) {
            // 기존 게스트 덮어쓰기 (선택한 필드만)
            const updateData: Record<string, unknown> = {};

            if (options.action === 'restore_all') {
              // 모든 필드 복구
              updateData.passportNumber = guestBackup.passportNumber;
              updateData.submittedAt = new Date(guestBackup.submittedAt);
              updateData.nationality = guestBackup.nationality;
              updateData.firstName = guestBackup.firstName;
              updateData.lastName = guestBackup.lastName;
              updateData.dateOfBirth = new Date(guestBackup.dateOfBirth);
              updateData.gender = guestBackup.gender;
              updateData.passportIssuingCountry = guestBackup.passportIssuingCountry;
              updateData.passportExpiry = new Date(guestBackup.passportExpiry);
            } else if (options.fields?.length) {
              // 선택한 필드만 복구
              for (const field of options.fields) {
                if (field in guestBackup) {
                  updateData[field] = (guestBackup as Record<string, unknown>)[field];
                }
              }
            }

            await tx.gmPassportSubmissionGuest.update({
              where: { id: existingGuest.id },
              data: updateData,
            });
            restoredCount++;
          }
        } catch (err) {
          errorCount++;
          errors.push(err instanceof Error ? err : new Error(String(err)));
          logger.error(`[복구] 게스트 ${guestBackup.passportNumber} 복구 실패`, err);
        }
      }

      return { restoredCount, errorCount, errors };
    },
    {
      timeout: 30000, // 30초 타임아웃
    }
  );

  return result;
}
```

#### 4-4: 복구 이력 기록
```typescript
async function recordRestoreLog(
  tripId: number,
  organizationId: string,
  fileId: string,
  userId: string,
  userName: string,
  action: string,
  restoredCount: number,
  errorCount: number,
  errorMessage?: string
): Promise<PassportBackupRestoreLog> {
  return prisma.passportBackupRestoreLog.create({
    data: {
      organizationId,
      tripId,
      fileId,
      userId,
      userName,
      action,
      status: errorCount === 0 ? 'SUCCESS' : errorCount < restoredCount ? 'PARTIAL' : 'FAILED',
      restoredCount,
      errorCount,
      errorMessage,
      timestamp: new Date(),
    },
  });
}
```

**마일스톤 체크리스트**:
- [ ] PassportBackupRestoreLog 스키마 확인 (없으면 추가)
- [ ] extractBackupData() 구현
- [ ] restoreGuestsFromBackup() 구현 (트랜잭션)
- [ ] recordRestoreLog() 구현
- [ ] 오류 처리 (부분 실패 시에도 로그 기록)
- [ ] 30초 타임아웃 설정
- [ ] npx tsc --noEmit 통과

---

### M3-5: 통합 테스트 + 배포 (Team 5)
**담당**: Agent-Test (QA + Deployment)  
**파일 격리**: (없음 - 기존 파일만 수정)

**작업 상세**:

#### 5-1: 단위 테스트 (각 팀별로 이미 완료했을 것 가정)
```typescript
// test/backup-restore.test.ts

describe('Passport Restore API', () => {
  describe('M3-1: REST Endpoints', () => {
    it('GET /api/backup/passport/{tripId} - 목록 조회', async () => {
      const response = await fetch(
        'http://localhost:3000/api/backup/passport/123?limit=20&offset=0',
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data.files)).toBe(true);
    });

    it('GET /api/backup/passport/{tripId}/download/{fileId} - 파일 다운로드', async () => {
      // 먼저 목록 조회해서 fileId 가져오기
      const listResponse = await fetch(
        'http://localhost:3000/api/backup/passport/123',
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const { data: { files } } = await listResponse.json();
      const fileId = files[0]?.id;

      const response = await fetch(
        `http://localhost:3000/api/backup/passport/123/download/${fileId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      expect(response.status).toBe(200);
      expect(['application/json', 'image/webp', 'image/jpeg']).toContain(
        response.headers.get('content-type')
      );
    });

    it('POST /api/backup/passport/{tripId}/restore/{fileId} - 복구', async () => {
      const response = await fetch(
        'http://localhost:3000/api/backup/passport/123/restore/file-id-1',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'restore_all',
            overwrite: true,
          }),
        }
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.restoredGuests).toBeGreaterThan(0);
    });
  });

  describe('M3-2: Google Drive Integration', () => {
    it('getOrRefreshTripAccessToken - 토큰 갱신', async () => {
      const token = await getOrRefreshTripAccessToken(123);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('listBackupFilesInTrip - 파일 목록 (20개 제한)', async () => {
      const { files, total } = await listBackupFilesInTrip(123, 'org-1', 20, 0);
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeLessThanOrEqual(20);
      expect(typeof total).toBe('number');
    });

    it('downloadBackupFileFromGoogleDrive - 파일 다운로드', async () => {
      const { files } = await listBackupFilesInTrip(123, 'org-1', 1, 0);
      if (files.length === 0) return; // 파일 없으면 스킵

      const buffer = await downloadBackupFileFromGoogleDrive(
        123,
        'org-1',
        files[0].id
      );
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('M3-3: Authorization', () => {
    it('verifyTripOwnership - Trip 소유권 검증', async () => {
      const ok = await verifyTripOwnership(123, 'org-1');
      expect(typeof ok).toBe('boolean');
    });

    it('verifyRestorePermission - 역할별 권한', async () => {
      const ctx = { userId: 'user-1', role: 'OWNER', organizationId: 'org-1' };
      
      const resultRestore = await verifyRestorePermission(ctx, 123, 'restore');
      expect(resultRestore.ok).toBe(true);

      ctx.role = 'VIEWER';
      const resultList = await verifyRestorePermission(ctx, 123, 'list');
      expect(resultList.ok).toBe(false);
    });
  });

  describe('M3-4: Database Restore', () => {
    it('restoreGuestsFromBackup - 전체 복구', async () => {
      const backupData: PassportBackupData = {
        format: 'json',
        guests: [
          {
            guestId: 'g1',
            passportNumber: 'A1234567',
            submittedAt: '2026-06-22T10:00:00Z',
            nationality: 'KR',
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            gender: 'M',
            passportIssuingCountry: 'KR',
            passportExpiry: '2030-01-01',
          },
        ],
      };

      const result = await restoreGuestsFromBackup(
        123,
        'org-1',
        backupData,
        { action: 'restore_all', overwrite: true }
      );
      expect(result.restoredCount).toBeGreaterThan(0);
      expect(result.errorCount).toBe(0);
    });
  });
});
```

#### 5-2: 통합 테스트 (E2E)
```typescript
describe('Passport Restore E2E', () => {
  it('전체 흐름: 목록 → 다운로드 → 복구', async () => {
    // Step 1: 목록 조회
    const listRes = await fetch(
      'http://localhost:3000/api/backup/passport/123',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(listRes.status).toBe(200);
    const { data: { files } } = await listRes.json();
    expect(files.length).toBeGreaterThan(0);

    // Step 2: 파일 다운로드
    const downloadRes = await fetch(
      `http://localhost:3000/api/backup/passport/123/download/${files[0].id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(downloadRes.status).toBe(200);

    // Step 3: 복구
    const restoreRes = await fetch(
      `http://localhost:3000/api/backup/passport/123/restore/${files[0].id}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'restore_all', overwrite: true }),
      }
    );
    expect(restoreRes.status).toBe(200);
    const { data } = await restoreRes.json();
    expect(data.restoredGuests).toBeGreaterThan(0);

    // Step 4: 복구 로그 확인
    const logRes = await fetch(
      'http://localhost:3000/api/backup/passport/123/restore-logs',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(logRes.status).toBe(200);
    const { data: { logs } } = await logRes.json();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe('SUCCESS');
  });

  it('권한 검증 - OWNER 아님', async () => {
    const viewerToken = await getToken('viewer@example.com');
    const restoreRes = await fetch(
      'http://localhost:3000/api/backup/passport/123/restore/file-1',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${viewerToken}` },
      }
    );
    expect(restoreRes.status).toBe(403);
  });

  it('오류 처리 - 없는 Trip', async () => {
    const res = await fetch(
      'http://localhost:3000/api/backup/passport/9999',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(res.status).toBe(404);
  });
});
```

#### 5-3: 성능 테스트
```bash
# 테스트 시나리오:
# - 100개 파일 목록 조회 (Pagination)
# - 50MB 파일 다운로드 (네트워크 지연 시뮬레이션)
# - 1000명 게스트 복구 (트랜잭션 성능)

npm run test:backup-restore:performance

# 예상 결과:
# - 목록 조회: < 500ms
# - 파일 다운로드: < 3초 (50MB)
# - 1000명 복구: < 10초
```

#### 5-4: 배포 체크리스트
```
Phase 1: 코드 리뷰
- [ ] Team 1-4 코드 병합 (main 브랜치)
- [ ] npx tsc --noEmit 0 에러
- [ ] npx prisma generate 성공
- [ ] ESLint 0 경고

Phase 2: 스테이징 배포
- [ ] npm run build 성공
- [ ] 스테이징 환경에서 엔드포인트 테스트
- [ ] 성능 프로파일링 (Lighthouse)
- [ ] 보안 감사 (Secret scanning)

Phase 3: 프로덕션 배포
- [ ] 최종 QA 승인
- [ ] npm run build && npm run deploy:prod
- [ ] 모니터링 설정 (Google Drive API quota, 에러율)
- [ ] 롤백 계획 (이전 커밋으로 복구 가능)
```

**마일스톤 체크리스트**:
- [ ] 단위 테스트 작성 (각 M3-1~4 기능)
- [ ] 통합 테스트 작성 (E2E)
- [ ] 성능 테스트 실행 (< 10초 기준)
- [ ] 권한 테스트 (403 에러 확인)
- [ ] 배포 체크리스트 완료
- [ ] npx tsc --noEmit 0 에러
- [ ] 모니터링 설정

---

## 🔧 병렬 실행 규칙 (절대 규칙)

### 파일 소유권 매트릭스

| 마일스톤 | Team | 주요 파일 | 도메인 |
|---------|------|----------|--------|
| **M3-1** | Team 1 | `src/app/api/backup/passport/[id]/route.ts` | Passport API |
| **M3-2** | Team 2 | `src/lib/passport-google-drive-restore.ts` | Google Drive |
| **M3-3** | Team 3 | `src/lib/passport-restore-authz.ts` | Authorization |
| **M3-4** | Team 4 | `src/lib/passport-restore-db.ts` | Database |
| **M3-5** | Team 5 | `test/backup-restore.test.ts` | Test |

### 공유 파일 (순차 처리)

```
❌ 동시 수정 금지:
  - prisma/schema.prisma (PassportBackupRestoreLog 확인만)
  - src/lib/passport-google-drive-backup.ts (M2 파일, 읽기만)
  - src/lib/rbac.ts (권한 프레임워크)

✅ 순차 순서:
  Team 2 (M3-2) → Team 3 (M3-3)
  (Google Drive 함수를 Auth에서 재사용하므로)
```

### 빌드 검증

```powershell
# 각 팀이 로컬에서 실행 (병렬 안전)
npx tsc --noEmit

# Prisma 타입 생성 (필요 시)
npx prisma generate

# 절대 금지
npm run build  # dev 서버 실행 중 금지
```

### 커밋 순서 (권장)

```bash
# Step 1: Team 1 (M3-1 API)
git commit -m "feat(backup-passport): Restore API 엔드포인트 + 권한 검증

- GET /api/backup/passport/{tripId} (파일 목록)
- GET /api/backup/passport/{tripId}/download/{fileId} (다운로드)
- POST /api/backup/passport/{tripId}/restore/{fileId} (복구)
- Trip 소유권 + 역할 기반 권한 검증

Co-Authored-By: Agent-Passport <noreply@anthropic.com>"

# Step 2: Team 2 (M3-2 Google Drive)
# (Team 1 커밋 후)
git commit -m "feat(backup-passport): Google Drive 토큰 갱신 + 파일 다운로드

- getOrRefreshTripAccessToken() (토큰 자동 갱신)
- listBackupFilesInTrip() (파일 목록)
- downloadBackupFileFromGoogleDrive() (다운로드)
- parseBackupFile() (파일 파싱)
- 재시도 로직 (3회) + 55초 타임아웃

Co-Authored-By: Agent-Passport <noreply@anthropic.com>"

# Step 3: Team 3 (M3-3 Authorization)
# (Team 2 커밋 후)
git commit -m "feat(backup-passport): Restore 권한 검증 + 감사 로그

- verifyTripOwnership() (Trip 소유권)
- verifyRestorePermission() (역할 기반 권한)
- verifyFileAccess() (Google Drive 파일 접근)
- logRestoreAction() (감사 로깅)

Co-Authored-By: Agent-Passport <noreply@anthropic.com>"

# Step 4: Team 4 (M3-4 Database)
# (Team 3 커밋 후)
git commit -m "feat(backup-passport): DB 복구 로직 + 이력 기록

- extractBackupData() (백업 파일 파싱)
- restoreGuestsFromBackup() (트랜잭션)
- recordRestoreLog() (복구 이력)
- PassportBackupRestoreLog 모델 확인

Co-Authored-By: Agent-Passport <noreply@anthropic.com>"

# Step 5: Team 5 (M3-5 Test)
# (Team 4 커밋 후)
git commit -m "test(backup-passport): Restore API 통합 테스트

- 단위 테스트 (M3-1~4 각 기능)
- E2E 테스트 (목록→다운로드→복구)
- 성능 테스트 (< 10초 기준)
- 권한 테스트 (403 검증)

Co-Authored-By: Agent-Test <noreply@anthropic.com>"
```

---

## ✅ 최종 검증 체크리스트 (Team 5가 확인)

### M3-1: REST 엔드포인트 ✓
- [ ] `GET /api/backup/passport/{tripId}` 동작
  - [ ] 성공 200 + 파일 목록
  - [ ] 404 (Trip 없음)
  - [ ] 403 (권한 없음)
- [ ] `GET /api/backup/passport/{tripId}/download/{fileId}` 동작
  - [ ] 성공 200 + 파일 바이너리
  - [ ] 404 (파일 없음)
  - [ ] 403 (권한 없음)
- [ ] `POST /api/backup/passport/{tripId}/restore/{fileId}` 동작
  - [ ] 성공 200 + 복구 결과
  - [ ] 404 (파일 없음)
  - [ ] 403 (권한 없음)
  - [ ] 400 (잘못된 요청)

### M3-2: Google Drive 통합 ✓
- [ ] 토큰 자동 갱신 동작 (만료 5분 전)
- [ ] 파일 목록 조회 (Pagination 20개 제한)
- [ ] 50MB 파일 다운로드 (< 3초)
- [ ] 재시도 로직 (3회, 지수 백오프)
- [ ] 55초 타임아웃 설정
- [ ] 네트워크 오류 처리

### M3-3: 권한 검증 ✓
- [ ] Trip 소유권 검증 (organizationId)
- [ ] 역할 검증 (OWNER/ADMIN)
- [ ] Google Drive 파일 접근 검증
- [ ] IP 주소 로깅
- [ ] 감사 로그 기록 (모든 액션)

### M3-4: DB 복구 ✓
- [ ] 백업 파일 파싱 (JSON + 이미지)
- [ ] 새 게스트 생성 (없으면 추가)
- [ ] 기존 게스트 덮어쓰기 (overwrite=true)
- [ ] 필드 선택 복구 (fields 배열)
- [ ] 트랜잭션 보호 (원자성)
- [ ] 복구 이력 기록 (성공/실패)
- [ ] 1000명 복구 < 10초

### M3-5: 테스트 ✓
- [ ] 단위 테스트: 50개 케이스 모두 통과
- [ ] E2E 테스트: 목록→다운로드→복구 성공
- [ ] 성능 테스트:
  - [ ] 목록 조회: < 500ms
  - [ ] 파일 다운로드: < 3초 (50MB)
  - [ ] 1000명 복구: < 10초
- [ ] 권한 테스트:
  - [ ] OWNER: 성공 200
  - [ ] VIEWER: 실패 403
  - [ ] 다른 조직: 실패 403
- [ ] 오류 처리:
  - [ ] 없는 Trip: 404
  - [ ] 없는 파일: 404
  - [ ] 네트워크 오류: 재시도 후 500

### 전체 통합 ✓
- [ ] `npx tsc --noEmit` 0 에러
- [ ] `npx prisma generate` 성공
- [ ] ESLint 0 경고 (새 파일만)
- [ ] `npm run build` 성공 (dev 서버 종료 후)
- [ ] 5개 팀 모두 커밋 완료
- [ ] Git 충돌 0개
- [ ] 보안 감사 (암호화, XSS 방지, RBAC)

---

## 📊 일정 및 예상 비용

| 마일스톤 | Team | 예상 시간 | 의존성 |
|---------|------|---------|--------|
| **M3-1** | Team 1 | 2-3시간 | 없음 (동시 시작 가능) |
| **M3-2** | Team 2 | 3-4시간 | M3-1 |
| **M3-3** | Team 3 | 2-3시간 | M3-2 |
| **M3-4** | Team 4 | 3-4시간 | M3-3 |
| **M3-5** | Team 5 | 4-5시간 | M3-1~4 |
| **전체** | | **14-19시간** | 순차 의존 |

### 병렬 실행 전략
```
Day 1 (2026-06-22):
├─ Team 1 (M3-1): 2-3시간 → 커밋 1
├─ Team 2 (M3-2): 병렬 진행, Team 1 커밋 후 3-4시간 → 커밋 2
└─ Team 3 (M3-3): 병렬 진행, Team 2 커밋 후 2-3시간 → 커밋 3

Day 2 (2026-06-23):
├─ Team 4 (M3-4): Team 3 커밋 후 3-4시간 → 커밋 4
└─ Team 5 (M3-5): 병렬 시작, 4-5시간 → 커밋 5 + 배포

예상 완료: 2026-06-24 (3일)
```

---

## 🚀 다음 단계 (M3 완료 후)

M3 완료 후 Phase 1C 마무리:

1. **M3 완료 후 (2026-06-24)**
   - Restore API 모니터링 (에러율, 응답시간)
   - 사용자 피드백 수집

2. **Phase 2 시작 대기 (2026-06-25)**
   - PII 암호화 준비 (Team 4-5)
   - 테스트 환경 구성

3. **최종 검증 (2026-06-26)**
   - Phase 1A + 1B + 1C 통합 테스트
   - 프로덕션 배포 승인

---

## 📞 Q&A 및 예외 처리

### Q1: 토큰 갱신 실패 시?
A: 재시도 3회 → 실패 시 Slack 알림 → 수동 개입 (Google OAuth 재인증)

### Q2: Google Drive 파일 손상 시?
A: SHA256 검증 실패 → 백업 복구 로그에 ERROR 기록 → 자동 알림

### Q3: 복구 중 데이터베이스 오류 시?
A: 트랜잭션 롤백 → PassportBackupRestoreLog에 FAILED 기록 → 재시도 가능

### Q4: 큰 파일(100MB+) 다운로드 시?
A: 청크 다운로드 구현 (BATCH_SIZE 확대) + 진행률 표시

### Q5: 다른 organization의 파일 접근 시도?
A: 권한 검증 실패 → 403 Forbidden → 감사 로그 기록

---

**작성일**: 2026-06-22  
**버전**: M3 Final v1.0  
**예상 완료**: 2026-06-24  
**배포**: M3 완료 후 즉시 (스테이징 1일 + 프로덕션 1일)  
**담당**: Agent-Passport (Team 1-4) + Agent-Test (Team 5)
