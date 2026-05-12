# 배치 작업 & 성능 매트릭스

크루즈닷 자동화 시스템의 배치 작업 전체 매트릭스, 성능 지표, 최적화 전략입니다.

## 1. 배치 작업 매트릭스

### 전체 요약

| 카테고리 | 배치명 | 트리거 | 빈도 | 처리량 | 소요시간 | 상태 |
|---------|--------|--------|------|--------|---------|------|
| **Images** | batch-1 | 관리자 수동 | 필요 시 | 500-1000 | 5-10m | 활성 |
| **Images** | batch-2 | 관리자 수동 | 필요 시 | 200-500 | 3-5m | 활성 |
| **Images** | batch-sync | 관리자 수동 | 필요 시 | 1000+ | 10-20m | 활성 |
| **Google Sheets** | sync-to-google | CRON/수동 | 일일 | 5000-10000 | 2-5m | 활성 |

### 상세 분석

---

## 2. Image Batch 작업

### 2.1 Batch-1: 이미지 1차 일괄 등록 (357 lines)

**경로**: `cruisedot/automation/batch/images/batch-1/route.ts`

#### 목적
- 로컬 또는 Google Drive의 이미지 파일들을 DB에 일괄 등록
- 메타데이터 추출 (폭, 높이, 파일크기)
- 썸네일 생성

#### 흐름

```
[관리자 입력]
  ├─ POST /api/batch-1-images-sync?startIndex=0&chunkSize=100
  └─ Query Params:
      ├─ startIndex: 시작 위치 (기본값: 0)
      ├─ chunkSize: 청크 크기 (기본값: 100)
      └─ format: 포맷 (기본값: 'webp')

[Step 1] 이미지 목록 조회 (pending_images 테이블)
  └─ SELECT * FROM pending_images 
     WHERE processed = false 
     OFFSET ? LIMIT 100

[Step 2] 청크 처리 (메모리 효율)
  └─ for (const img of chunk) {
       // 각 이미지 처리
     }

[Step 3] 메타데이터 추출 (Sharp)
  ├─ const metadata = await sharp(imgBuffer).metadata();
  └─ { width, height, space, channels, depth, size }

[Step 4] 썸네일 생성
  └─ const thumb = await sharp(imgBuffer)
       .resize(200, 200)
       .webp({ quality: 80 })
       .toBuffer();

[Step 5] DB 저장 (배치 트랜잭션)
  ├─ BEGIN TRANSACTION
  ├─ INSERT product_image (url, thumbnail, metadata)
  ├─ UPDATE pending_images (processed = true)
  └─ COMMIT

[Step 6] 진행률 리포트
  └─ {
       startIndex: 0,
       processed: 100,
       failed: 0,
       skipped: 0,
       total: 10000,
       percentage: 1.0,
       eta: '99 minutes',
       remaining: 9900,
       nextStartIndex: 100,
       message: 'Batch-1 completed. Call again with startIndex=100'
     }
```

#### 성능 지표

| 지표 | 값 |
|------|-----|
| 청크 크기 | 100개 |
| 청크당 소요시간 | 3-5초 |
| 처리량 | 20-33 이미지/초 |
| 에러율 | < 1% |
| 메모리 사용 | 50-100MB (청크) |

#### 재시도 전략

```typescript
// 실패한 이미지 재시도
const maxRetries = 3;
for (let i = 0; i < chunk.length; i++) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await processImage(chunk[i]);
      break; // 성공
    } catch (err) {
      retries++;
      if (retries >= maxRetries) {
        // 3회 실패 → 스킵 + 로깅
        failedImages.push({ img: chunk[i], error: err.message });
      } else {
        // 1초 대기 후 재시도
        await delay(1000);
      }
    }
  }
}
```

#### 실패 처리

```json
{
  "failed": [
    {
      "filename": "image-001.jpg",
      "error": "Invalid image format",
      "retries": 3,
      "timestamp": "2026-05-11T10:30:45Z"
    }
  ],
  "failureReport": "/reports/batch-1-failures-2026-05-11.csv"
}
```

---

### 2.2 Batch-2: 이미지 2차 처리 (WebP 변환) (422 lines)

**경로**: `cruisedot/automation/batch/images/batch-2/route.ts`

#### 목적
- 모든 이미지를 WebP 형식으로 변환 (용량 50-70% 감소)
- 다양한 해상도 생성 (원본, 1200px, 800px, 400px)
- 품질 손실 없이 최적화

#### 흐름

```
[관리자 입력]
  └─ POST /api/batch-2-images-sync?format=webp&quality=80

[Step 1] 미처리 이미지 조회
  └─ SELECT * FROM product_image 
     WHERE webp_url IS NULL 
     LIMIT 100

[Step 2] 원본 이미지 다운로드
  └─ GET origin_url → imgBuffer

[Step 3] 다중 해상도 생성 (병렬)
  ├─ 원본: sharp(imgBuffer).webp(...)
  ├─ 1200px: sharp(imgBuffer).resize(1200, 800).webp(...)
  ├─ 800px: sharp(imgBuffer).resize(800, 533).webp(...)
  └─ 400px: sharp(imgBuffer).resize(400, 267).webp(...)

[Step 4] 클라우드 저장소 업로드 (또는 로컬)
  ├─ 옵션 A: Cloudinary (deprecated)
  └─ 옵션 B: 로컬 /public/images/webp/ (권장)

[Step 5] DB 업데이트
  ├─ UPDATE product_image 
       SET webp_url = ?, 
           webp_urls = ?,  // 다중 해상도
           file_size_original = ?,
           file_size_webp = ?,
           compression_ratio = ?
     WHERE id = ?

[Step 6] 진행률 리포트
  └─ {
       processed: 100,
       failed: 0,
       compressionRatio: 0.65,  // 65% 크기 감소
       originalSize: 50MB,
       webpSize: 17.5MB,
       savings: 32.5MB,
       eta: '45 minutes',
       ...
     }
```

#### 성능 지표

| 지표 | 값 |
|------|-----|
| 청크 크기 | 50개 (메모리 제약) |
| 청크당 소요시간 | 5-10초 |
| 처리량 | 5-10 이미지/초 |
| 압축률 | 65-70% (용량 감소) |
| 메모리 사용 | 200-300MB |

#### 해상도 매트릭스

| 용도 | 폭 | 높이 | 품질 | 크기 |
|------|-----|------|------|------|
| 원본 | 자동 | 자동 | 80 | 평균 500KB |
| 데스크톱 | 1200 | 800 | 80 | 평균 200KB |
| 태블릿 | 800 | 533 | 75 | 평균 100KB |
| 모바일 | 400 | 267 | 70 | 평균 40KB |

#### 최적화 전략

```typescript
// 병렬 처리 (Promise.all)
const [original, large, medium, small] = await Promise.all([
  sharp(imgBuffer).webp({ quality: 80 }).toBuffer(),
  sharp(imgBuffer).resize(1200, 800).webp({ quality: 80 }).toBuffer(),
  sharp(imgBuffer).resize(800, 533).webp({ quality: 75 }).toBuffer(),
  sharp(imgBuffer).resize(400, 267).webp({ quality: 70 }).toBuffer(),
]);

// 메모리 해제
imgBuffer = null;
```

---

### 2.3 Batch-Sync: 이미지 동기화 (326 lines)

**경로**: `cruisedot/automation/batch/images/sync/route.ts`

#### 목적
- DB ↔ 클라우드 (또는 로컬 CDN) 이미지 동기화
- 중복 제거
- 메타데이터 일관성 확인

#### 흐름

```
[관리자 입력]
  └─ POST /api/batch/sync-images?direction=db_to_cloud

[Step 1] 동기화 방향 선택
  ├─ db_to_cloud: DB → CDN (업로드)
  ├─ cloud_to_db: CDN → DB (다운로드)
  └─ verify: CDN과 DB 일관성 검증

[Step 2] 차이점 분석
  ├─ DB에만 있음: INSERT to CDN
  ├─ CDN에만 있음: DELETE from CDN
  └─ 둘 다 있음: 메타데이터 비교

[Step 3] 배치 처리
  └─ for (const item of diffItems) {
       if (action === 'upload') await uploadToCDN(item);
       else if (action === 'delete') await deleteFromCDN(item);
     }

[Step 4] 진행률 리포트
  └─ {
       direction: 'db_to_cloud',
       totalItems: 10000,
       synced: 100,
       failed: 0,
       cloudSize: 5GB,
       dbRecords: 10000,
       eta: '30 minutes',
       ...
     }
```

#### 성능 지표

| 지표 | 값 |
|------|-----|
| 청크 크기 | 100개 |
| 청크당 소요시간 | 5-10초 |
| 처리량 | 10-20 이미지/초 |
| 네트워크 대역폭 | 1-5MB/s (CDN 속도에 따름) |

---

## 3. Google Sheets Batch 작업

### 3.1 Sync-to-Google: DB → Google Sheets (179 lines)

**경로**: `cruisedot/automation/batch/google-sheets/sync-to-google/route.ts`

#### 목적
- Neon PostgreSQL → Google Sheets 자동 내보내기
- 데이터 백업 & 분석용
- 비기술자 직원들의 데이터 접근성 향상

#### 지원하는 테이블

| 테이블 | 행 수 | 컬럼 | 빈도 |
|--------|--------|--------|------|
| product | 5,000+ | 20+ | 일일 |
| user | 10,000+ | 15+ | 일일 |
| order | 50,000+ | 25+ | 일일 |
| payment | 100,000+ | 30+ | 일일 |
| trial | 5,000+ | 10+ | 주 1회 |

#### 흐름

```
[Cron / 관리자 입력]
  ├─ GET /api/batch/sync-to-google?table=product
  └─ Query Params:
      ├─ table: 테이블명
      ├─ format: 'json' | 'csv' | 'sheets'
      └─ filter: WHERE 조건 (선택)

[Step 1] Google Sheets 인증
  └─ await google.sheets.auth.getClient()

[Step 2] DB 데이터 조회
  └─ const data = await prisma.product.findMany({
       select: { id, name, price, ... },
       take: 10000,  // 페이지네이션
     });

[Step 3] 데이터 포맷팅
  ├─ 컬럼 헤더: ['id', 'name', 'price', ...]
  └─ 데이터 행: [[1, 'product-1', 100, ...], ...]

[Step 4] Google Sheets 업데이트
  ├─ DELETE 기존 데이터 (또는 새 시트 생성)
  └─ INSERT 새 데이터 (updateCells API)

[Step 5] 진행률 리포트
  └─ {
       table: 'product',
       rows: 5000,
       columns: 20,
       duration: 120,
       timestamp: '2026-05-11T10:00:00Z',
       spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/...',
       success: true
     }
```

#### 성능 지표

| 테이블 | 행 수 | 소요시간 | 대역폭 |
|--------|--------|---------|--------|
| product | 5,000 | 10-15s | 1MB |
| user | 10,000 | 15-20s | 2MB |
| order | 50,000 | 30-45s | 10MB |
| payment | 100,000 | 60-90s | 20MB |

#### 최적화 전략

```typescript
// 청크 단위로 업로드 (Google Sheets API 제한 회피)
const BATCH_SIZE = 1000;
for (let i = 0; i < data.length; i += BATCH_SIZE) {
  const batch = data.slice(i, i + BATCH_SIZE);
  
  await sheets.spreadsheets.batchUpdate({
    requests: [
      {
        updateCells: {
          range: { sheetId: 0, rowIndex: i, columnIndex: 0 },
          rows: batch.map(row => ({
            values: row.map(cell => ({ userEnteredValue: { stringValue: cell } }))
          }))
        }
      }
    ]
  });
  
  // 진행률 로깅
  logger.info(`Synced ${i + BATCH_SIZE} / ${data.length} rows`);
}
```

---

## 4. 배치 성능 비교

### 처리량 (Throughput)

```
┌─────────────────────────┬──────────────┬──────────────┐
│ Batch 작업              │ 처리량 (items/s) │ 청크 크기    │
├─────────────────────────┼──────────────┼──────────────┤
│ Batch-1 (등록)          │ 20-33        │ 100          │
│ Batch-2 (WebP 변환)     │ 5-10         │ 50           │
│ Batch-Sync (동기화)     │ 10-20        │ 100          │
│ Sync-to-Google (시트)   │ 100+ (행)    │ 1,000 (행)   │
└─────────────────────────┴──────────────┴──────────────┘
```

### 메모리 사용

```
┌─────────────────────────┬──────────────┐
│ Batch 작업              │ 메모리 사용   │
├─────────────────────────┼──────────────┤
│ Batch-1 (등록)          │ 50-100MB     │
│ Batch-2 (WebP 변환)     │ 200-300MB    │
│ Batch-Sync (동기화)     │ 50-100MB     │
│ Sync-to-Google (시트)   │ 10-20MB      │
└─────────────────────────┴──────────────┘
```

### 소요시간 (10,000 항목 기준)

```
Batch-1 (등록): 8-10 분
  └─ 청크 100 × 3-5초 = 300-500초

Batch-2 (WebP 변환): 20-50 분
  └─ 청크 50 × 5-10초 = 1,000-2,500초 (병렬 최적화 시 반)

Batch-Sync (동기화): 10-20 분
  └─ 청크 100 × 5-10초 = 500-1,000초

Sync-to-Google (시트): 2-5 분
  └─ 행 10,000 / 처리량 100+ = 100-500초
```

---

## 5. 배치 최적화 가이드

### 5.1 메모리 최적화

**문제**: 모든 데이터를 한 번에 메모리에 로드 → OOM

**해결책**:
```typescript
// ❌ 나쁜 예
const allImages = await prisma.productImage.findMany();
for (const img of allImages) { /* ... */ }

// ✅ 좋은 예
const CHUNK_SIZE = 100;
const totalCount = await prisma.productImage.count();
for (let i = 0; i < totalCount; i += CHUNK_SIZE) {
  const chunk = await prisma.productImage.findMany({
    skip: i,
    take: CHUNK_SIZE,
  });
  for (const img of chunk) { /* ... */ }
}
```

### 5.2 네트워크 최적화

**문제**: API 호출 N번 (N+1 쿼리)

**해결책**:
```typescript
// ❌ 나쁜 예
for (const img of images) {
  const metadata = await sharp(img.url).metadata();
  // 각 이미지마다 네트워크 요청
}

// ✅ 좋은 예
const metadata = await Promise.all(
  images.map(img => sharp(img.url).metadata())
);
// 병렬 요청
```

### 5.3 CPU 최적화

**문제**: 동기 이미지 변환 → 블로킹

**해결책**:
```typescript
// ❌ 나쁜 예
for (const img of images) {
  const webp = await sharp(img.buffer).webp().toBuffer();
  // 순차 처리: img1 변환 → img2 변환 → ...
}

// ✅ 좋은 예 (Worker Threads)
const pool = new pLimit(4); // 동시 4개
const results = await Promise.all(
  images.map(img => pool(() => sharp(img.buffer).webp().toBuffer()))
);
// 병렬 처리: 4개 동시
```

### 5.4 데이터베이스 최적화

**문제**: 배치 INSERT 느림

**해결책**:
```typescript
// ❌ 나쁜 예 (N번 INSERT)
for (const img of images) {
  await prisma.productImage.create({ data: img });
}

// ✅ 좋은 예 (1번 INSERT + 트랜잭션)
await prisma.$transaction(
  images.map(img => prisma.productImage.create({ data: img }))
);
// 또는
await prisma.productImage.createMany({ data: images });
```

---

## 6. 모니터링 & 알림

### 배치 메트릭

```typescript
interface BatchMetrics {
  batchId: string;
  jobName: string;
  startTime: Date;
  endTime: Date;
  duration: number;  // ms
  
  totalItems: number;
  processedItems: number;
  failedItems: number;
  skippedItems: number;
  
  throughput: number;  // items/sec
  memoryUsed: number;  // MB
  cpuUsed: number;     // %
  
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
}
```

### Slack 알림

```
✅ BATCH COMPLETED
Job: batch-1-images-sync
Duration: 8 min 30 sec
Processed: 1,000 / 10,000
Failed: 2
Throughput: 20 items/sec
Memory: 85MB

👉 Next: batch-2-images-sync (Call again with startIndex=1000)
```

### 대시보드 예시

```
Batch Progress Dashboard
┌─────────────────────────────────────┐
│ Job: batch-1-images-sync            │
├─────────────────────────────────────┤
│ Progress: [████████░░░░░░░░░░] 40%   │
│                                     │
│ Processed: 4,000 / 10,000           │
│ Failed: 5                           │
│ Remaining: 6,000                    │
│ ETA: 5 min                          │
│ Throughput: 13 items/sec            │
│ Memory: 78 / 256 MB                 │
└─────────────────────────────────────┘
```

---

## 7. 배치 실행 계획 예시

### 월요일 자동화 일정

```
05:00 UTC
  └─ batch-1 시작 (이미지 등록)
     [관리자 웹훅 또는 Cron]

05:45 UTC
  └─ batch-2 시작 (WebP 변환)
     [batch-1 완료 후 즉시]

06:30 UTC
  └─ batch-sync 시작 (동기화)
     [batch-2 완료 후 즉시]

07:30 UTC
  └─ sync-to-google 시작 (Google Sheets 내보내기)
     [모든 배치 완료 후]

08:00 UTC
  └─ 모든 배치 완료 알림 (Slack)
```

---

## 8. 에러 처리

### 배치 실패 시나리오

```
Scenario 1: 메모리 부족
  Problem: OOM (Out of Memory)
  Solution: 청크 크기 감소 (100 → 50)
  Recovery: 마지막 성공한 위치에서 재시작

Scenario 2: 네트워크 타임아웃
  Problem: API 응답 없음 (> 30초)
  Solution: 타임아웃 연장 (또는 재시도)
  Recovery: Exponential backoff (1s → 2s → 4s)

Scenario 3: 데이터 무결성 오류
  Problem: 이미지 손상 또는 메타데이터 누락
  Solution: 스킵하고 계속 처리
  Recovery: 실패한 항목만 재처리

Scenario 4: 권한 부족
  Problem: Google Drive API 권한 없음
  Solution: 권한 갱신 또는 새 credentials
  Recovery: 권한 확인 후 재시작
```

### 실패 리포트 생성

```typescript
interface FailureReport {
  batchId: string;
  timestamp: Date;
  totalFailed: number;
  failures: Array<{
    itemId: string;
    itemName: string;
    error: string;
    timestamp: Date;
    retries: number;
  }>;
  csvUrl: string;  // 다운로드 가능한 URL
  recoveryActions: string[];
}
```

---

## 참고 자료

- CRON 작업과의 관계: `README.md` § 1
- 아키텍처: `ARCHITECTURE.md` § 4
- 환경 설정: `README.md` § 7
