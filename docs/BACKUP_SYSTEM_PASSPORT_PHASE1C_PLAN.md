# Passport 백업 시스템 Phase 1C 상세 계획 (2026-06-29 ~ 2026-08-11)
## 5-6주 로드맵: 파일 버퍼 + 권한 격리 + 복구 API

---

## 📋 Phase 1C 개요

**팀**: Team 2 (Passport 도메인 전담)  
**기간**: 2026-06-29 (금) ~ 2026-08-11 (월) = **5-6주**  
**독립성**: Contact/Marketing과 완전 독립적 (병렬 진행 가능)  
**선행조건**: Phase 1B (스키마) 완료 ✅  

---

## 🎯 Phase 1C 마일스톤 (5개)

### **Week 1-2: M1-M2 (파일 버퍼 + 권한 격리)**

#### **M1: 실제 여권 파일 버퍼 소스 확정** (4-5일, 2026-06-29~07-03)

**현황**: GmPassportSubmissionGuest에 imageAssetId FK 추가됨 (Phase 1B)

**작업**:
1. ImageAsset 테이블 구조 분석 (2시간)
   - 필드: `id`, `url`, `fileSize`, `width`, `height`, `mimeType`, `organizationId`, `uploadedBy`, `uploadedAt`, `category`, `tags`
   - 파일 저장소: Google Drive vs Vercel Blob 확인
   - 실제 이미지는 어디에 저장? (binary field 있나?)

2. Passport OCR 이후 이미지 저장 경로 확인 (2시간)
   - `src/app/api/passport/public/scan/route.ts` 분석
   - OCR 결과 JSON은 어디에 저장? (googleDriveFileIdOcr 사용?)
   - 원본(JPG) + 최적화본(WebP) 모두 저장되나?

3. 실제 파일 버퍼 Cron 수정 (2시간)
   - `src/app/api/cron/backup-passport/route.ts` 현재 코드:
     ```typescript
     const dummyBuffer = Buffer.from('dummy passport image');  // ❌ 더미
     ```
   - 변경: ImageAsset에서 실제 파일 다운로드 (Google Drive API)
     ```typescript
     const imageAsset = await prisma.imageAsset.findUnique({
       where: { id: guest.imageAssetId }
     });
     
     if (!imageAsset?.url) {
       logger.warn(`No image for guest ${guest.id}`);
       return;
     }
     
     // Google Drive 또는 Vercel Blob에서 다운로드
     const fileBuffer = await downloadFromGoogleDrive(imageAsset.url);
     const webpBuffer = await sharp(fileBuffer).webp({ quality: 80 }).toBuffer();
     
     // Google Drive에 백업 (WebP + 원본)
     const webpFileId = await uploadToGoogleDrive(webpBuffer, `passport_${guest.id}.webp`);
     const originalFileId = await uploadToGoogleDrive(fileBuffer, `passport_${guest.id}_original.jpg`);
     
     // OCR 결과 JSON도 동시 백업
     const ocrFileId = await uploadToGoogleDrive(
       JSON.stringify(guest.ocrRawData),
       `passport_${guest.id}_ocr.json`
     );
     ```

4. 테스트 (1시간)
   - 5개 조직 × 각 10명 여권 = 50건 이미지 다운로드 + 백업
   - 성능: < 3초/개 (총 150초 이내)

**산출물**:
- `src/app/api/cron/backup-passport/route.ts` (수정)
- `src/lib/passport-google-drive-backup.ts` (신규, 이미지 다운로드 로직)
- 테스트 50건

**예상 소요시간: 4-5일**

---

#### **M2: organizationId/Trip 권한 격리** (7-8일, 2026-07-04~07-11)

**거장단 의사결정 (Phase 1B)**: Trip 레벨 토큰 관리

**작업**:
1. GmTripGoogleDriveConfig 테이블 설계 + 마이그레이션 (2일)
   ```prisma
   model GmTripGoogleDriveConfig {
     id                        Int      @id @default(autoincrement())
     tripId                    Int      @unique
     trip                      GmTrip   @relation(fields: [tripId], references: [id], onDelete: Cascade)
     
     // Google OAuth 토큰 (Contact.googleDriveAccessToken과 동일)
     googleDriveAccessTokenEncrypted String  // AES-256 암호화
     googleDriveRefreshToken    String?
     tokenExpiresAt             DateTime?
     
     // Google Drive 폴더 관리
     googleDriveFolderId        String?   // 여행별 폴더 ID
     // 폴더 구조: /마비즈CRM-여권백업/{organizationId}/{tripId}/
     
     // 백업 통계
     lastBackupAt               DateTime?
     backupCount                Int       @default(0)
     
     createdAt                  DateTime  @default(now())
     updatedAt                  DateTime  @updatedAt
     
     @@index([tripId])
     @@index([createdAt])
   }
   ```

2. Cron 로직 변경: 조직 반복 → Trip 반복 (2일)
   - 현재: `for (const org of organizations) { ... }`
   - 변경: `for (const trip of trips) { const config = trip.googleDriveConfig; ... }`
   - Trip별 토큰 사용 (개인별 권한 격리)
   - Google Drive 폴더: `/마비즈CRM-여권백약/{organizationId}/{tripId}/`

3. 토큰 갱신 로직: Contact 패턴 재사용 (1.5일)
   - Contact.googleDriveAccessToken 갱신 로직을 Trip 용으로 적응
   - 암호화 + 복호화 동일 (AES-256)

4. 복구 시 Trip 지정 (0.5일)
   - Restore API: `/api/passport/backup/trip/{tripId}/restore?guestIds=[...]`
   - Trip 소유자만 복구 가능 (권한 검증)

5. 테스트 (1.5일)
   - 5개 조직 × 각 2개 여행 = 10개 Trip
   - 각 Trip별 10명 여권 = 100건 백업 + 복구
   - 권한 검증: 다른 조직/Trip 접근 불가능 확인

**산출물**:
- `prisma/schema.prisma` (GmTripGoogleDriveConfig 추가)
- `.prisma/migrations/xxx_add_trip_google_drive_config/`
- `src/app/api/cron/backup-passport/route.ts` (Trip 기반 수정)
- `src/lib/trip-google-drive-backup.ts` (신규, Trip 토큰 관리)
- 테스트 100건

**예상 소요시간: 7-8일**

---

### **Week 3: M3 (복구 API)**

#### **M3: 복구 API 구현** (2-3일, 2026-07-12~07-14)

**작업**:
1. GET 엔드포인트: 백업 로그 조회 (1일)
   - `GET /api/passport/backup/logs?tripId={tripId}&guestId={guestId}`
   - PassportBackupRestoreLog 조회 (최근 50개)
   - 권한: Trip 소유자 이상

2. POST 엔드포인트: 단일/다중 복구 (1day)
   - `POST /api/passport/backup/trip/{tripId}/restore`
   - Request: `{ guestIds?: number[] }`
   - Response: `{ successCount, failureCount, errors: [] }`
   - 권한: Trip 소유자 이상
   - Trip별 Google Drive에서 다운로드
   - ImageAsset에 복원 (원본 파일 덮어쓰기?)

3. 에러 처리 (0.5day)
   - 파일 미존재: 에러 메시지 명확
   - 토큰 만료: 자동 갱신 후 재시도
   - 권한 없음: 403 Forbidden

**산출물**:
- `src/app/api/passport/backup/logs/route.ts` (GET)
- `src/app/api/passport/backup/trip/[tripId]/restore/route.ts` (POST)
- 테스트 20건 (성공/실패/권한)

**예상 소요시간: 2-3일**

---

### **Week 4-5: M4-M5 (OCR + 대용량 테스트)**

#### **M4: OCR 데이터 Google Drive 동시 백업** (3-4일, 2026-07-15~07-18)

**작업**:
1. OCR JSON 저장 로직 (1day)
   - `src/app/api/passport/public/scan/route.ts`에서 OCR 완료 후
   - Google Drive에 JSON 파일 저장 (`passport_ocr.json`)
   - googleDriveFileIdOcr에 저장

2. 복구 시 OCR 복원 (1day)
   - Google Drive에서 OCR JSON 다운로드
   - GmPassportSubmissionGuest.ocrRawData 복원

3. OCR 암호화 검증 (1day)
   - 여권번호 AES-256 암호화 (기존)
   - OCR JSON의 민감정보(여권번호) 마스킹

**예상 소요시간: 3-4일**

---

#### **M5: 대용량 테스트 (5개 조직 × 100명 여권)** (3-4일, 2026-07-19~07-22)

**작업**:
1. 테스트 데이터 생성 (1day)
   - 5개 조직, 각 2개 여행
   - 각 여행별 100명 게스트 (5조직 × 2trip × 100guest = 1000건)
   - 실제 이미지 (Faker 또는 더미 JPG 1KB)

2. Cron 부하 테스트 (1day)
   - `GET /api/cron/backup-passport/route.ts` 1000건 동시 백업
   - 성능 메트릭: 평균 응답시간, 메모리 사용량, 에러율
   - 목표: 응답시간 < 30초 (전체)

3. 복구 부하 테스트 (1day)
   - 각 Trip별 100명 복구
   - 권한 검증 (다른 Trip 접근 불가)
   - 동시 복구 시 데이터 일관성

4. 성능 최적화 (1day)
   - 인덱스 추가 (필요시)
   - 배치 처리 최적화 (Promise.allSettled 사용)

**산출물**:
- 성능 벤치마크 보고서 (응답시간, 에러율)
- 성능 최적화 커밋 (인덱스/배치)

**예상 소요시간: 3-4일**

---

### **Week 6: 버퍼 + 최종 검증**

#### **최종 검증 + 재검토** (3-4일, 2026-07-23~07-26)

**작업**:
1. 무한루프 절대법칙 재검토
   - Phase 1C 모든 코드 5명 병렬 검토
   - P0/P1/P2 이슈 완전 제거

2. TypeScript 검증
   - npx tsc --noEmit → 0 에러
   - npx prisma generate → 최신 타입

3. 통합 테스트
   - Contact (Phase 1A) + Passport (Phase 1C) 동시 동작
   - 마이그레이션 (Phase 1B) 실제 DB 반영 확인

4. 문서화
   - Passport 백업 시스템 설명서 (ops 매뉴얼)
   - 토큰 갱신/복구 프로세스

**산출물**:
- 최종 검토 보고서 (P0/P1/P2 상태)
- 3-4개 최종 커밋

---

## 📊 Phase 1C 마일스톤 일정

| 주 | M1 | M2 | M3 | M4 | M5 | 버퍼 |
|----|-----|-----|-----|-----|-----|-----|
| **W1** | 4-5d | - | - | - | - | - |
| **W2** | - | 7-8d | - | - | - | - |
| **W3** | - | - | 2-3d | - | - | - |
| **W4** | - | - | - | 3-4d | - | - |
| **W5** | - | - | - | - | 3-4d | - |
| **W6** | - | - | - | - | - | 3-4d |

**총 소요시간**: 22-28일 = **3-4주** (예상보다 1-2주 단축 가능)

---

## 🔧 병렬 실행 규칙

### 파일 소유권 (Team 2 전담)
```
Team 2 (Passport):
  ✅ src/app/api/cron/backup-passport/route.ts (수정)
  ✅ src/lib/passport-google-drive-backup.ts (신규)
  ✅ src/lib/trip-google-drive-backup.ts (신규)
  ✅ src/app/api/passport/backup/logs/route.ts (신규)
  ✅ src/app/api/passport/backup/trip/[tripId]/restore/route.ts (신규)
  ✅ prisma/schema.prisma (GmTripGoogleDriveConfig 추가)
  ✅ tests/passport-backup-*.test.ts (신규)

금지:
  ❌ src/lib/ 다른 파일 수정 (Contact/Marketing과 공유)
  ❌ prisma/schema.prisma Contact 필드 건드리기
```

### 빌드 검증
```powershell
✅ 각 팀 로컬: npx tsc --noEmit (병렬 안전)
✅ Phase 1C 완료 후: npm run build (전체 빌드)
```

---

## 📝 커밋 전략

### M1 커밋
```
feat(passport-backup): 실제 여권 파일 버퍼 Cron 구현

- ImageAsset에서 실제 파일 다운로드 (Google Drive API)
- WebP 최적화 (Sharp, 80% 품질)
- Google Drive에 WebP + 원본 + OCR JSON 동시 업로드
- 성능: < 3초/개 (50건 테스트)

Co-Authored-By: Team-Passport <noreply@anthropic.com>
```

### M2 커밋
```
feat(passport-backup): Trip 레벨 토큰 관리 + 권한 격리

- GmTripGoogleDriveConfig 테이블 신규 추가
- Cron: 조직별 → Trip별 반복 변경
- Google Drive 폴더: /{organizationId}/{tripId}/
- 토큰 암호화: AES-256 (Contact 패턴 재사용)
- 복구 시 Trip 권한 검증 (다른 Trip 접근 불가)
- 성능: < 30초/100건 (10 Trip × 100 guest)

Co-Authored-By: Team-Passport <noreply@anthropic.com>
```

### M3-M5 개별 커밋
- 각 마일스톤마다 1개 커밋
- 총 5개 커밋 (M1-M5)

---

## ✅ Phase 1C 최종 검증 체크리스트

### 파일 버퍼 (M1)
- [ ] ImageAsset 구조 분석 완료
- [ ] Cron에 실제 이미지 다운로드 로직 추가
- [ ] WebP 변환 + Google Drive 업로드 동작
- [ ] 50건 테스트 성공 (< 3초/개)
- [ ] npx tsc --noEmit 0 에러

### 권한 격리 (M2)
- [ ] GmTripGoogleDriveConfig 마이그레이션 완료
- [ ] Cron Trip 기반으로 변경
- [ ] 토큰 갱신 로직 구현
- [ ] 복구 시 권한 검증
- [ ] 100건 대용량 테스트 성공 (< 30초)
- [ ] 다른 Trip 접근 불가 확인

### 복구 API (M3)
- [ ] GET /logs 엔드포인트 구현
- [ ] POST /restore 엔드포인트 구현
- [ ] 단일/다중 복구 모두 동작
- [ ] 에러 처리 명확
- [ ] 20건 테스트 성공

### OCR 백업 (M4)
- [ ] OCR JSON Google Drive 저장
- [ ] 복구 시 OCR 복원
- [ ] 민감정보 마스킹

### 대용량 테스트 (M5)
- [ ] 1000건 Cron 부하 테스트 < 30초
- [ ] 메모리 폭증 없음
- [ ] 성능 최적화 적용
- [ ] 벤치마크 보고서 작성

### 최종 검증
- [ ] npx tsc --noEmit 0 에러
- [ ] Contact + Passport 동시 동작
- [ ] 5명 병렬 재검토 완료 (P0/P1/P2 전부 해결)
- [ ] 3-4개 최종 커밋
- [ ] 문서화 완료

---

## 📅 예상 완료일

**시작**: 2026-06-29 (금)  
**완료**: 2026-07-26 (금) ~ 2026-08-11 (월)  
**기간**: 3-4주 (예상 단축, 현재 계획: 5-6주)

---

**상태**: 🚀 준비 완료 — Team 2 시작 GO!
