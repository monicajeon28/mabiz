# Phase 1C M2: Trip 레벨 권한 격리 + 성능 개선 (7-8일)

**목표**: 조직별 → Trip별 백업 관리 + 병렬 처리 (150초 → 60초)
**시작**: 2026-07-04 (내일)
**팀**: Agent-Passport (7-8 커밋)
**상태**: 📋 작업지시서 V1

---

## 📊 M2 마일스톤 분해

### M2-1: GmTripGoogleDriveConfig 스키마 추가 (1.5일)
**목표**: Trip별 Google Drive 폴더 권한 관리

**작업**:
1. `prisma/schema.prisma` 추가
   ```prisma
   model GmTripGoogleDriveConfig {
     id                String     @id @default(cuid())
     tripId            String     @unique
     trip              GmTrip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
     googleFolderId    String     // 마비즈CRM → Trip101 폴더 구조
     googleFolderName  String
     accessToken       String     @db.Text  // 암호화 저장
     refreshToken      String     @db.Text // 암호화 저장
     expiresAt         DateTime   // 55분 TTL
     createdAt         DateTime   @default(now())
     updatedAt         DateTime   @updatedAt
     deletedAt         DateTime?  // Soft-delete
     deletedBy         String?
     deletedByName     String?
   
     @@index([tripId])
     @@index([deletedAt])
   }
   ```

2. `npx prisma generate` + `npx prisma migrate dev --name add_trip_google_drive_config`
3. TypeScript 타입 자동 재생성 확인

**성능 인덱스**: `@@index([tripId, deletedAt])`

**검증**: TSC 0 에러

---

### M2-2: Cron 권한 격리 (2일)
**목표**: Cron이 매 Trip별로 독립 토큰으로 처리

**파일**: `src/app/api/cron/backup-passport/route.ts`

**변경사항**:
1. 현재 (M1): 조직별 accessToken 1개 → 모든 여권 처리
   ```typescript
   // ❌ M1 (조직별)
   const accessToken = await refreshGoogleAccessToken(organizationId);
   const guests = await prisma.gmPassportSubmissionGuest.findMany({
     where: { trip: { organizationId } }
   });
   ```

2. 새로운 (M2): Trip별 독립 토큰
   ```typescript
   // ✅ M2 (Trip별)
   const trips = await prisma.gmTrip.findMany({
     where: { organizationId },
     include: { googleDriveConfig: true }
   });
   
   for (const trip of trips) {
     const accessToken = trip.googleDriveConfig 
       ? trip.googleDriveConfig.accessToken  // Trip 전용 토큰
       : await refreshTripGoogleAccessToken(trip.id);  // 신규 발급
       
     const guests = await prisma.gmPassportSubmissionGuest.findMany({
       where: { tripId: trip.id, backupStatus: 'pending' }
     });
   }
   ```

3. `refreshTripGoogleAccessToken()` 신규 함수
   - GmTripGoogleDriveConfig.refreshToken → 신 accessToken 발급
   - 55분 TTL + 캐시
   - 실패 시 조직 레벨 fallback (M1 호환성)

**성능 개선 (M2-3에서 진행)**:
- 현재: for 루프 (순차, 50명 × 3분 = 150초+)
- 목표: Promise.allSettled (병렬, 50명 × 30초 = 60초)

**검증**: 
- [ ] TSC 0 에러
- [ ] 50명 Cron 실행 < 150초 (현재 M1 수준 유지)
- [ ] BackupLog 생성 확인

---

### M2-3: 병렬 처리 최적화 (1.5일)
**목표**: 150초 → 60초 (60% 성능 향상)

**파일**: `src/app/api/cron/backup-passport/route.ts`

**현재 (순차)**:
```typescript
for (const trip of trips) {
  for (const guest of guests) {
    const file = await downloadFileFromGoogleDrive(imageAsset.googleDriveFileId);  // 30초
    const webp = await convertToWebp(file);  // 20초
    await uploadOcrDataToGoogleDrive(webp);  // 20초
    await prisma.gmPassportSubmissionGuest.update(...);  // 2초
  }
}
// 총: 50 × 72초 = 3,600초 (불가능!)
```

**최적화 (병렬)**:
```typescript
// Trip별 병렬 처리
await Promise.allSettled(trips.map(async (trip) => {
  const accessToken = await refreshTripGoogleAccessToken(trip.id);
  
  // 각 Trip 내 모든 guests 병렬 다운로드
  const files = await Promise.all(
    guests.map(g => downloadFileFromGoogleDrive(g.imageAsset.googleDriveFileId))
  );
  
  // 모든 파일 동시 WebP 변환
  const webps = await Promise.all(files.map(convertToWebp));
  
  // 모든 WebP 동시 업로드
  const uploadResults = await Promise.all(
    webps.map(w => uploadOcrDataToGoogleDrive(w, accessToken))
  );
  
  // 배치 DB 업데이트
  await prisma.gmPassportSubmissionGuest.updateMany({
    where: { tripId: trip.id, backupStatus: 'pending' },
    data: {
      googleDriveFileId: uploadResults[0].fileId,
      googleDriveFileIdOcr: uploadResults[0].ocrFileId,
      backupStatus: 'success'
    }
  });
}));
```

**성능 분석**:
- 다운로드: 30초 (병렬 50개 동시)
- 변환: 20초 (병렬 50개)
- 업로드: 20초 (병렬 50개)
- DB: 2초 (배치)
- **총: 72초** (3,600초 → 72초, 50배 향상!)

**제약조건**:
- Google Drive API Rate Limit: 1,000 req/분 (OK, 50 + 50 + 50 = 150 req)
- 메모리: 50개 WebP 동시 로드 (50MB × 50 = 2.5GB 위험!)
  - 해결: Promise.all → Promise.allSettled + 배치 크기 10-15로 제한

**수정된 코드**:
```typescript
const BATCH_SIZE = 10;

for (let i = 0; i < guests.length; i += BATCH_SIZE) {
  const batch = guests.slice(i, i + BATCH_SIZE);
  
  const files = await Promise.all(
    batch.map(g => downloadFileFromGoogleDrive(g.imageAsset.googleDriveFileId))
  );
  
  const webps = await Promise.all(files.map(convertToWebp));
  
  const uploadResults = await Promise.all(
    webps.map(w => uploadOcrDataToGoogleDrive(w, accessToken))
  );
  
  await prisma.gmPassportSubmissionGuest.updateMany({
    where: { id: { in: batch.map(b => b.id) } },
    data: { /* 결과 업데이트 */ }
  });
}
// 총: (50 / 10) × 72초 = 5 × 72 = 360초 (여전히 큼)
// 최적화: 배치 크기 20으로 조정 → 3 × 72 = 216초 또는
// 타임아웃 증대 필요 (Vercel 300초 한계 근처)
```

**최종 성능 목표**:
- 배치 크기 15: (50/15) × 72 = 3.3 × 72 ≈ 240초
- 배치 크기 20: (50/20) × 72 = 2.5 × 72 ≈ 180초
- Vercel 타임아웃 300초 내 완료 ✅

**검증**:
- [ ] TSC 0 에러
- [ ] 50명 Cron 실행 < 180초
- [ ] 메모리 사용량 < 500MB
- [ ] Google Drive API Rate Limit 초과 없음

---

### M2-4: Google Drive 폴더 구조 재설계 (1day)
**목표**: 조직 → Trip → 파일 타입별 폴더 구조

**현재 (M1)**: 
```
마비즈CRM-여권백업 (root)
├── guest-1-여권.webp
├── guest-1-ocr.json
├── guest-2-여권.webp
└── guest-2-ocr.json
```

**새로운 (M2)**:
```
마비즈CRM-여권백업 (root)
├── Org-123 (조직)
│   ├── Trip-001 (여행)
│   │   ├── 여권이미지 (폴더)
│   │   │   ├── guest-1.webp
│   │   │   └── guest-2.webp
│   │   └── OCR데이터 (폴더)
│   │       ├── guest-1.json
│   │       └── guest-2.json
│   └── Trip-002
└── Org-456
```

**작업**:
1. `src/lib/passport-google-drive-backup.ts` 수정
   ```typescript
   async function uploadOcrDataToGoogleDrive(
     webpFile: Buffer,
     ocrData: object,
     tripId: string,
     guestId: string,
     accessToken: string
   ) {
     // Trip별 폴더 생성 또는 조회
     const tripFolder = await getOrCreateTripFolder(tripId, accessToken);
     
     // 여권이미지, OCR데이터 서브폴더 생성
     const imageFolder = await getOrCreateSubFolder(tripFolder.id, '여권이미지', accessToken);
     const ocrFolder = await getOrCreateSubFolder(tripFolder.id, 'OCR데이터', accessToken);
     
     // 파일명: guest-${guestId}.webp, guest-${guestId}.json
     const imageFileId = await uploadToGoogleDrive(
       webpFile,
       `guest-${guestId}.webp`,
       imageFolder.id,
       accessToken
     );
     
     const ocrFileId = await uploadToGoogleDrive(
       Buffer.from(JSON.stringify(ocrData)),
       `guest-${guestId}.json`,
       ocrFolder.id,
       accessToken
     );
     
     return { imageFileId, ocrFileId };
   }
   ```

2. `getOrCreateTripFolder()` 신규 함수
   - Trip별 폴더 조회 (GmTripGoogleDriveConfig.googleFolderId)
   - 없으면 생성 + DB 저장

3. `getOrCreateSubFolder()` 신규 함수
   - 부모 폴더 내 자식 폴더 생성/조회

**권한 격리**:
- Trip의 googleFolderId 역할: 조직 간 데이터 격리
- 다른 조직 Trip 폴더에 접근 불가 (URL 기반 권한)

**검증**:
- [ ] TSC 0 에러
- [ ] Google Drive 폴더 구조 자동 생성 확인
- [ ] 파일 접근 권한 격리 (조직별 독립)

---

### M2-5: 기존 파일 마이그레이션 (1day)
**목표**: M1 생성 파일 → Trip별 폴더 이동

**작업**:
1. Migration 스크립트 `scripts/migrate-passport-files-to-trips.mjs`
   - 모든 GmPassportSubmissionGuest 조회
   - googleDriveFileId 기준 Google Drive에서 파일 조회
   - Trip별 폴더 생성 후 파일 이동
   - 이동 완료 후 DB 업데이트

2. 실행
   ```bash
   dotenv -e .env.local node scripts/migrate-passport-files-to-trips.mjs
   ```

3. 검증
   - [ ] 모든 파일 이동 완료
   - [ ] DB googleFolderIds 모두 채워짐
   - [ ] 다운로드 테스트 (원래 파일 접근 가능)

---

## 🔍 최종 검증 체크리스트

### 코드 품질
- [ ] `npx tsc --noEmit` 0 에러
- [ ] ESLint 0 경고
- [ ] 보안 검사 (timingSafeEqual, 토큰 노출 금지)
- [ ] 코드 스멜 (중복 제거, 상수화, any 타입 제거)

### 성능
- [ ] 50명 Cron < 180초
- [ ] 메모리 < 500MB
- [ ] Google Drive API Rate Limit 초과 없음
- [ ] 데이터베이스 쿼리 < 10개 (N+1 확인)

### 권한 격리
- [ ] 조직 A → 조직 B Trip 폴더 접근 불가
- [ ] Trip별 googleFolderId 고유성 (Unique 인덱스)
- [ ] Token 암호화 (AES-256, 같은 M1 표준)

### 테스트
- [ ] 50명 × 3 Trip = 150명 Cron 통과
- [ ] Google Drive 폴더 구조 자동 생성 확인
- [ ] 기존 파일 마이그레이션 성공
- [ ] BackupLog 모두 생성 확인

### 커밋
- [ ] 6-7개 커밋 (각 마일스톤별)
- [ ] 선형 히스토리 (merge 없음)
- [ ] 각 커밋 TSC 0 에러

---

## 🚀 병렬 실행 규칙

**M2는 Agent-Passport 단독**:
- Contact/Marketing 도메인 건드리지 않음
- 기존 파일: `src/lib/passport-google-drive-backup.ts`, `src/app/api/cron/backup-passport/route.ts`, `prisma/schema.prisma`
- 신규 파일: `scripts/migrate-passport-files-to-trips.mjs`

**의존성**:
1. M2-1 (스키마) → M2-2 (Cron 격리) → M2-3 (병렬 최적화)
2. M2-4 (폴더 구조) ↔ M2-3 (동시 진행 가능)
3. M2-5 (파일 마이그레이션) ← M2-4 완료 후

---

## 📈 성능 예상

| 단계 | 처리량 | 시간 | 개선 |
|------|--------|------|------|
| M1 (순차) | 50명/Cron | 150-200초 | - |
| M2-3 (배치 15) | 50명/Cron | ~180초 | 10% ↓ |
| M2-3 (배치 20, 최적) | 50명/Cron | ~150초 | 25% ↓ |
| M2-3 (배치 50, 메모리 허용) | 50명/Cron | ~72초 | 60% ↓ |
| **목표** | **50명/Cron** | **<180초** | **✅** |

---

## 📝 다음 단계

**M2 완료 후**:
- M3: Restore API 권한 격리 (Trip 레벨 접근 제어)
- M4: OCR 백업 통합 (기존 Vision API + Trip 폴더)
- M5: 부하 테스트 (1,000명 동시 Cron)

**배포**:
- M2 커밋 → git log 선형화 확인
- Vercel 수동 배포 (사용자 결정)
- 모니터링: BackupLog + Google Drive API Rate Limit

---

**시작**: 2026-07-04 (내일, 7-8일 소요)
**마감**: 2026-07-11~07-12
**상태**: 📋 Ready for Agent-Passport Team

---

**버전**: Phase 1C M2 Plan V1
**작성**: 무한루프 절대법칙 거장단 토론 결과
**다음 검토**: M2-1 완료 후 재검토
