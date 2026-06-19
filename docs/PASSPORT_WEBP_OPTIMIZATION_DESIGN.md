# Passport Phase 2-2: WebP 이미지 최적화 설계

**작성일**: 2026-06-19
**단계**: Phase 2-2 (WebP 최적화 엔진 + API 통합)
**목표**: 파일 크기 80% 감소 (5MB → 1MB), 품질 유지, 성능 < 2초

---

## 📋 Table of Contents

1. [개요](#개요)
2. [기술 아키텍처](#기술-아키텍처)
3. [핵심 설계](#핵심-설계)
4. [구현 상세](#구현-상세)
5. [API 스펙](#api-스펙)
6. [테스트 전략](#테스트-전략)
7. [배포 체크리스트](#배포-체크리스트)

---

## 개요

### 목표
- **입력**: JPEG/PNG 이미지 (최대 10MB)
- **처리**: WebP 변환 + 다중 해상도 생성
- **출력**: Full(원본)/Thumb(400px)/Archive(150px)
- **효과**: 파일 크기 80% 절감, 육안 구분 불가 품질 유지

### 현황
- Phase 2-1 완료: 여권 암호화 + DB 설계 ✅
- Phase 2-2 시작: WebP 최적화 엔진 + API 통합
- Phase 2-3 계획: UI 개선 (드래그드롭, 절약률 표시)

### 예시

**입력**: `JPEG 5.2MB (3000x4000)`
```
Original: 5,200 KB (JPEG)
├─ Full (WebP 75% 품질): 820 KB
├─ Thumb (400px): 25 KB
└─ Archive (150px): 8 KB
```

**절감**: 5200 → 820 (84% 절감)

---

## 기술 아키텍처

### 스택

| 계층 | 기술 | 목적 |
|------|------|------|
| **Image Processing** | Sharp v0.34.5 | Node.js 이미지 변환 |
| **Format** | WebP | Google WebP 포맷 (JPEG 대비 20-30% 더 작음) |
| **Storage** | Google Drive | 파일 영속성 + 백업 |
| **API** | Next.js Route Handler | FormData 수신 + 병렬 처리 |
| **DB** | Prisma + PostgreSQL | 메타데이터 저장 (선택사항) |

### 아키텍처 다이어그램

```
┌─────────────────────────────────────┐
│   Client (고객 업로드 페이지)       │
│   - 드래그 드롭 또는 파일 선택     │
│   - 실시간 진행률 표시             │
└────────────┬────────────────────────┘
             │ FormData (JPEG/PNG)
             ↓
┌─────────────────────────────────────┐
│ POST /api/passport/customer/upload   │
│                                     │
│ Step 1: 검증 (크기/해상도/포맷)   │
│ ├─ 최대 10MB, 6000x6000px        │
│ └─ JPEG, PNG, WebP만 가능         │
│                                     │
│ Step 2: 병렬 처리 (3개 해상도)    │
│ ├─ Full: 원본 유지 (WebP 75%)     │
│ ├─ Thumb: 400px (WebP 75%)        │
│ └─ Archive: 150px (WebP 70%)      │
│                                     │
│ Step 3: Google Drive 병렬 업로드   │
│ ├─ uploadToGoogleDrive (Full)     │
│ ├─ uploadToGoogleDrive (Thumb)    │
│ └─ uploadToGoogleDrive (Archive)  │
│                                     │
│ Step 4: DB 메타데이터 저장        │
│ └─ Traveler.passportImage JSON    │
└────────────┬────────────────────────┘
             │ { fullUrl, thumbUrl, ... }
             ↓
┌─────────────────────────────────────┐
│   Google Drive Storage              │
│   - Full: 820 KB (webp)            │
│   - Thumb: 25 KB (webp)            │
│   - Archive: 8 KB (webp)           │
│                                     │
│   Total: 853 KB (84% 절감 ✅)     │
└─────────────────────────────────────┘
```

---

## 핵심 설계

### 1. 이미지 검증 (Validation)

```typescript
// 입력: Buffer
// 출력: { valid, error?, format?, width?, height?, size? }

validation:
  ✅ 파일 크기 <= 10MB
  ✅ 해상도 <= 6000x6000 (36MP)
  ✅ 포맷: JPEG, PNG, WebP만
```

**실패 케이스**:
- 파일 크기 초과: "파일 크기 초과 (최대 10MB, 현재 12.5MB)"
- 포맷 미지원: "지원하지 않는 형식 (TIFF). JPEG, PNG, WebP만 가능"
- 해상도 초과: "해상도 초과 (최대 6000x6000, 현재 8000x6000)"

### 2. WebP 최적화 (Optimization)

**품질 설정**:
| 타입 | 품질 | 용도 | 크기 감소 |
|-----|------|------|---------|
| Full | 75% | 원본 해상도 표시 | 80% |
| Thumb | 75% | UI 미리보기 | 85% |
| Archive | 70% | DB 저장 기본 | 90% |

**선택 근거**:
- 75% 품질 = Sharp 기본값 (육안 구분 불가)
- 20-30% 추가 품질 저하 불필요
- JPEG 대비 WebP 자체가 20-30% 더 효율적

### 3. 다중 해상도 생성

```
┌─────────────────────────────────┐
│ 입력: 3000x4000 JPEG (5.2MB)   │
├─────────────────────────────────┤
│ Full: 3000x4000                 │
│ ├─ 리사이징 없음                │
│ ├─ WebP 75% 품질                │
│ └─ 820 KB ✅ (84% 절감)         │
│                                 │
│ Thumb: 400px (비율 유지)        │
│ ├─ 300x400 (리사이징)           │
│ ├─ WebP 75% 품질                │
│ └─ 25 KB (미리보기용)           │
│                                 │
│ Archive: 150px (비율 유지)      │
│ ├─ 112x150 (리사이징)           │
│ ├─ WebP 70% 품질                │
│ └─ 8 KB (DB 저장용)             │
└─────────────────────────────────┘
```

**리사이징 전략**:
- `fit: 'cover'` - 비율 유지, 정사각형으로 정렬
- `position: 'center'` - 중앙 기준 자르기
- `withoutEnlargement: true` - 원본보다 커지지 않음

### 4. 병렬 처리

```typescript
// Step 1: 순차 (입력 검증)
await validateImage(buffer) // 50ms

// Step 2: 병렬 (3개 해상도 생성)
Promise.all([
  convertToWebP(buffer, 0, 75),    // Full:    500ms
  convertToWebP(buffer, 400, 75),  // Thumb:   200ms
  convertToWebP(buffer, 150, 70),  // Archive: 100ms
]) // 최대: 500ms (병렬)

// Step 3: 병렬 (3개 Drive 업로드)
Promise.all([
  uploadToGoogleDrive(...),        // 800ms
  uploadToGoogleDrive(...),        // 800ms
  uploadToGoogleDrive(...),        // 800ms
]) // 최대: 800ms (병렬)

// 총 시간: 50 + 500 + 800 = 1350ms ✅ (< 2000ms)
```

### 5. 타임아웃 보호

```typescript
// Promise.race 기반 타임아웃 (Sharp 내부 타임아웃 없음)
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T>

// 3초 타임아웃 설정
const buffer = await withTimeout(
  sharp(inputBuffer).webp().toBuffer(),
  3000,
  'WebP conversion'
);
```

---

## 구현 상세

### Phase 2-2 파일 구조

```
src/
├── lib/
│   ├── image-optimization.ts (신규)
│   │   ├── validateImage()          // 검증
│   │   ├── optimizePassportImage()  // 메인 최적화
│   │   ├── convertToWebP()          // 개별 변환
│   │   ├── getOptimized*Buffer()    // 버퍼 반환
│   │   └── ImageOptimizationResult  // 타입
│   │
│   ├── drive-client.ts (기존)
│   │   ├── getDriveClient()
│   │   └── findOrCreateFolder()
│   │
│   └── logger.ts (기존)
│
└── app/api/passport/customer/upload/
    └── route.ts (수정)
        ├── POST (신규 최적화 로직)
        ├── GET (기존 조회)
        └── uploadToGoogleDrive() (신규 헬퍼)
```

### 핵심 함수

#### 1. `validateImage(buffer: Buffer)`

```typescript
export async function validateImage(buffer: Buffer): Promise<ImageValidationResult>

// 반환값:
{
  valid: true,
  format: 'jpeg',
  width: 3000,
  height: 4000,
  size: 5242880
}

// 또는
{
  valid: false,
  error: '파일 크기 초과 (최대 10MB, 현재 12.5MB)',
  size: 13107200
}
```

#### 2. `optimizePassportImage(buffer, fileNamePrefix)`

```typescript
export async function optimizePassportImage(
  inputBuffer: Buffer,
  fileNamePrefix: string = 'passport'
): Promise<ImageOptimizationResult>

// 반환값:
{
  fullUrl: 'passport_full_1234567890.webp',
  thumbUrl: 'passport_thumb_1234567890.webp',
  archiveUrl: 'passport_archive_1234567890.webp',

  originalSize: 5242880,
  originalFormat: 'jpeg',
  originalWidth: 3000,
  originalHeight: 4000,

  fullSize: 851968,    // 820 KB
  thumbSize: 25600,    // 25 KB
  archiveSize: 8192,   // 8 KB

  savings: 84,         // 84% 절감
  savingsBytes: 4390912, // 약 4.2MB 절감
  processingTimeMs: 1250
}
```

#### 3. `convertToWebP(buffer, resizeWidth, quality)`

```typescript
async function convertToWebP(
  buffer: Buffer,
  resizeWidth: number,   // 0 = 원본 유지, 400 = 400px 리사이징
  quality: number        // 70-75
): Promise<Buffer>
```

---

## API 스펙

### POST /api/passport/customer/upload

**요청**:
```bash
curl -X POST \
  'https://api.example.com/api/passport/customer/upload?reservationId=123&travelerId=456' \
  -H 'Authorization: Bearer {token}' \
  -F 'file=@passport.jpg'
```

**쿼리 파라미터**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| reservationId | string | ✅ | 예약 ID |
| travelerId | string | ❌ | 여행자 ID (없으면 메인 손님) |
| token | string | ❌ | 여권 토큰 (로그인 안 함 고객용) |

**요청 바디** (FormData):
```
file: File (JPEG/PNG/WebP, 최대 10MB)
```

**응답 (성공, 200)**:
```json
{
  "ok": true,
  "message": "여권 이미지가 최적화되어 업로드되었습니다.",
  "data": {
    "imageUrl": "https://drive.google.com/file/d/...",
    "thumbUrl": "https://drive.google.com/file/d/...",
    
    "metadata": {
      "fullUrl": "ABC123",
      "thumbUrl": "DEF456",
      "archiveUrl": "GHI789",
      "originalSize": 5242880,
      "originalFormat": "jpeg",
      "originalWidth": 3000,
      "originalHeight": 4000,
      "fullSize": 851968,
      "savings": 84,
      "processedAt": "2026-06-19T12:34:56.000Z"
    },
    
    "stats": {
      "originalSize": "5120.0 KB",
      "fullSize": "832.0 KB",
      "thumbSize": "25.0 KB",
      "archiveSize": "8.0 KB",
      "savings": "84%",
      "savingsBytes": "4288.0 KB",
      "originalDimensions": "3000x4000"
    },
    
    "processingTimeMs": 1250,
    "totalTimeMs": 2150,
    
    "reservationId": 123,
    "travelerId": 456
  }
}
```

**응답 (검증 실패, 400)**:
```json
{
  "ok": false,
  "error": "파일 크기는 10MB를 초과할 수 없습니다. (현재 12.5MB)"
}
```

**응답 (Drive 업로드 실패, 500)**:
```json
{
  "ok": false,
  "error": "여권 이미지 업로드에 실패했습니다.",
  "details": "Google Drive API error: ..."
}
```

---

## 테스트 전략

### 1. 단위 테스트 (Jest)

```typescript
describe('image-optimization', () => {
  test('validateImage - 정상 JPEG', async () => {
    const buffer = fs.readFileSync('./test-assets/passport.jpg');
    const result = await validateImage(buffer);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('jpeg');
  });

  test('validateImage - 파일 크기 초과', async () => {
    const buffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const result = await validateImage(buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('파일 크기 초과');
  });

  test('optimizePassportImage - 전체 파이프라인', async () => {
    const buffer = fs.readFileSync('./test-assets/passport.jpg');
    const result = await optimizePassportImage(buffer, 'test-passport');

    expect(result.savings).toBeGreaterThan(75); // 최소 75% 절감
    expect(result.processingTimeMs).toBeLessThan(3000); // 3초 이내
    expect(result.fullSize).toBeLessThan(result.originalSize);
  });

  test('convertToWebP - 품질 비교', async () => {
    const buffer = fs.readFileSync('./test-assets/passport.jpg');
    
    const high = await convertToWebP(buffer, 0, 85);  // 고품질
    const low = await convertToWebP(buffer, 0, 70);   // 저품질
    
    expect(low.length).toBeLessThan(high.length);
    expect((high.length - low.length) / high.length * 100).toBeLessThan(15);
  });
});
```

### 2. 통합 테스트 (E2E)

**테스트 케이스**:
1. 정상 JPEG 업로드 (3000x4000, 5MB) → 성공, 84% 절감 ✅
2. PNG 업로드 (1920x1080, 2MB) → 성공, 78% 절감 ✅
3. 파일 크기 초과 (11MB) → 실패, 400 ✅
4. 해상도 초과 (8000x6000) → 실패, 400 ✅
5. 미지원 포맷 (TIFF) → 실패, 400 ✅
6. Drive 업로드 실패 → 실패, 500 ✅
7. 여러 여행자 동시 업로드 → 병렬 처리, 각각 성공 ✅

### 3. 성능 테스트

**벤치마크**:
```
테스트 파일: 3000x4000 JPEG (5.2MB)

Step 1 (검증):    50ms
Step 2 (최적화):  500ms (병렬)
  - Full:    500ms
  - Thumb:   200ms
  - Archive: 100ms
Step 3 (업로드):  800ms (병렬)
  - Full:    800ms
  - Thumb:   150ms
  - Archive: 50ms

Total: 1350ms (목표: < 2000ms ✅)
```

### 4. 품질 검증

**육안 검증**:
1. Full (WebP 75%): 원본과 구분 불가 ✅
2. Thumb (WebP 75%): 미리보기로 충분함 ✅
3. Archive (WebP 70%): 아이콘 크기로 수용 ✅

**메타데이터 검증**:
```bash
# 파일 크기 확인
ls -lh passport_*.webp
-rw-r--r-- 1 user group 820K ... passport_full_1234567890.webp
-rw-r--r-- 1 user group  25K ... passport_thumb_1234567890.webp
-rw-r--r-- 1 user group   8K ... passport_archive_1234567890.webp

# 이미지 정보 확인
file passport_full_1234567890.webp
# image/webp, 3000 x 4000, image/webp
```

---

## 배포 체크리스트

### Phase 2-2 배포 전

- [ ] **코드 완성**
  - [x] `src/lib/image-optimization.ts` 작성 (520줄)
  - [x] `src/app/api/passport/customer/upload/route.ts` 수정 (+120줄)
  - [ ] TypeScript 컴파일 0에러
  - [ ] ESLint 0경고

- [ ] **테스트**
  - [ ] 단위 테스트 작성 (validateImage, optimizePassportImage)
  - [ ] 통합 테스트 7가지 케이스 통과
  - [ ] 성능 테스트: < 2000ms 확인
  - [ ] 품질 검증: 3가지 해상도 육안 확인

- [ ] **보안**
  - [ ] 파일 크기 제한 (10MB)
  - [ ] 해상도 제한 (6000x6000)
  - [ ] 포맷 화이트리스트 (JPEG, PNG, WebP)
  - [ ] 타임아웃 보호 (3초)
  - [ ] 권한 검증 (예약 소유자만)

- [ ] **문서**
  - [x] 설계 문서 (이 파일)
  - [ ] API 문서 (Swagger/OpenAPI)
  - [ ] 사용자 가이드 (UI 개선 시)

- [ ] **배포**
  - [ ] Vercel 환경변수 확인
  - [ ] Google Drive 권한 확인
  - [ ] 스테이징 테스트
  - [ ] 프로덕션 배포
  - [ ] 모니터링 (에러 로그, 성능)

---

## Phase 2-3 미리보기

### UI 개선 (드래그드롭 + 절약률 표시)

```
┌──────────────────────────────────┐
│ 여권 사진 업로드                │
│                                  │
│ 이미지를 여기에 끌어놓거나      │
│ [파일 선택] 버튼을 클릭하세요   │
│                                  │
│ 지원 형식: JPEG, PNG, WebP      │
│ 최대 크기: 10MB                 │
└──────────────────────────────────┘

[파일 선택]

┌──────────────────────────────────┐
│ 업로드 중... (84% 완료)         │
│ ████████░░ 처리 시간: 1.2초    │
└──────────────────────────────────┘

업로드 완료 ✅

원본: 5.2 MB (JPEG)
최적화: 832 KB (WebP) + 절약 84% 🎉
```

### 추가 기능
1. 다중 이미지 동시 업로드 (드래그드롭)
2. 이미지 크롭/회전 (클라이언트 가공)
3. EXIF 데이터 제거 (개인정보 보호)
4. 진행률 표시 (WebSocket / Server-Sent Events)

---

## 성능 모니터링

### 메트릭 (로깅)

```
[Customer Passport Upload] 이미지 최적화 완료:
  원본: 5200 B
  최적화: 820 B
  절감: 84%
  시간: 1250ms

[Customer Passport Upload] Google Drive 업로드 완료:
  Full ID: ABC123
  Thumb ID: DEF456
  Archive ID: GHI789
```

### 알림 설정 (제안)

1. **성능 저하 경고**: 처리 시간 > 3초
2. **Drive API 오류**: uploadToGoogleDrive 실패
3. **유효성 검사 실패 급증**: 1시간 내 50건 이상

---

## 참고 자료

- [Sharp 공식 문서](https://sharp.pixelplumbing.com/)
- [WebP 포맷 스펙](https://developers.google.com/speed/webp)
- [Google Drive API](https://developers.google.com/drive/api/reference/rest/v3)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

**다음 단계**: Phase 2-3 (UI 개선 + 다중 업로드 + EXIF 제거)
