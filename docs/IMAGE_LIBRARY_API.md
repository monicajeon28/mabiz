# 이미지 라이브러리 API 문서

Google Drive 통합 이미지 관리 시스템 (TASK-018)

## 개요

- **목표**: 조직별 이미지 자산을 Google Drive에 저장하고, 메타데이터는 Postgres DB에 관리
- **저장소**: Google Drive `/CRM자산/{조직명}/{카테고리}/` 폴더 구조
- **DB 모델**: `ImageAsset` 테이블 (조직별 자산 추적)

## API 엔드포인트

### 1. 이미지 업로드

**엔드포인트**: `POST /api/images/upload`

**요청**:
```
Content-Type: multipart/form-data

Parameters:
- file (File, required): 이미지 파일 (100MB 이하)
- category (string, optional): 카테고리 (배너, 상품, 로고, 기타)
- tags (string, optional): 쉼표로 구분된 태그 (예: "홈페이지,배너,2025")
```

**응답** (200 OK):
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "originalFileName": "banner.jpg",
    "driveFileId": "gdrive-file-id",
    "category": "배너",
    "tags": ["홈페이지", "배너"],
    "uploadedAt": "2026-05-08T12:00:00Z",
    "mimeType": "image/jpeg",
    "fileSize": "245328",
    "width": 1920,
    "height": 1080,
    "thumbnailUrl": "https://drive.google.com/thumbnail?id=..."
  }
}
```

**제약**:
- 이미지 파일만 허용 (JPEG, PNG, GIF, WebP, SVG)
- 파일 크기 100MB 이하
- 자동 메타데이터 추출 (width, height)

---

### 2. 이미지 목록 조회

**엔드포인트**: `GET /api/images/list?category=배너&tags=홈페이지&search=banner&offset=0&limit=20`

**쿼리 파라미터**:
```
- search (string, optional): 파일명 검색
- category (string, optional): 카테고리 필터
- tags (string[], optional): 태그 필터 (다중 선택 가능)
- offset (number, optional, default: 0): 페이지네이션 offset
- limit (number, optional, default: 60, max: 200): 페이지 크기
```

**응답** (200 OK):
```json
{
  "ok": true,
  "data": {
    "assets": [
      {
        "id": "uuid",
        "fileName": "banner.jpg",
        "driveFileId": "gdrive-id",
        "category": "배너",
        "tags": ["홈페이지", "배너"],
        "mimeType": "image/jpeg",
        "fileSize": "245328",
        "width": 1920,
        "height": 1080,
        "uploadedAt": "2026-05-08T12:00:00Z",
        "lastAccessedAt": "2026-05-08T14:30:00Z",
        "thumbnailUrl": "https://drive.google.com/thumbnail?id=...",
        "driveUrl": "https://drive.google.com/file/d/..."
      }
    ],
    "total": 42,
    "offset": 0,
    "limit": 20
  }
}
```

**필터 로직**:
- `search`: fileName 또는 tags에서 부분 일치
- `category`: 정확 일치
- `tags`: 포함된 태그 (hasSome, 다중)

---

### 3. 개별 이미지 조회

**엔드포인트**: `GET /api/images/{id}`

**응답** (200 OK):
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "fileName": "banner.jpg",
    "driveFileId": "gdrive-id",
    "category": "배너",
    "tags": ["홈페이지"],
    "mimeType": "image/jpeg",
    "fileSize": "245328",
    "width": 1920,
    "height": 1080,
    "uploadedAt": "2026-05-08T12:00:00Z",
    "uploadedBy": "user-id",
    "lastAccessedAt": "2026-05-08T14:30:00Z",
    "thumbnailUrl": "https://drive.google.com/thumbnail?id=...",
    "driveUrl": "https://drive.google.com/file/d/..."
  }
}
```

---

### 4. 이미지 메타데이터 수정

**엔드포인트**: `PATCH /api/images/{id}`

**요청 본문**:
```json
{
  "category": "상품",
  "tags": ["신상품", "여름시즌", "세일"]
}
```

**응답** (200 OK):
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "category": "상품",
    "tags": ["신상품", "여름시즌", "세일"]
  }
}
```

**부작용**: `lastAccessedAt` 자동 갱신

---

### 5. 이미지 삭제

**엔드포인트**: `DELETE /api/images/{id}`

**응답** (200 OK):
```json
{
  "ok": true
}
```

**주의**:
- DB 기록만 삭제 (Google Drive 파일은 유지)
- 삭제 후 목록에서 제거되지만, Drive에서는 여전히 접근 가능
- 실제 Drive 파일 삭제는 별도로 수행 필요

---

### 6. Drive 폴더 동기화

**엔드포인트**: `POST /api/images/sync`

**권한**: `GLOBAL_ADMIN` 전용

**요청 본문**:
```json
{
  "category": "배너"
}
```

**응답** (200 OK):
```json
{
  "ok": true,
  "data": {
    "syncedCount": 23,
    "assets": [
      {
        "id": "uuid",
        "fileName": "banner1.jpg",
        "category": "배너"
      }
    ]
  }
}
```

**기능**:
- 지정된 카테고리 폴더를 스캔
- Drive의 모든 이미지 파일을 DB와 동기화
- 새 파일은 create, 기존 파일은 update (lastAccessedAt)

---

### 7. 카테고리 & 태그 목록

**엔드포인트**: `GET /api/images/categories`

**응답** (200 OK):
```json
{
  "ok": true,
  "data": {
    "categories": [
      {
        "category": "배너",
        "count": 12
      },
      {
        "category": "상품",
        "count": 8
      },
      {
        "category": "로고",
        "count": 3
      }
    ],
    "tags": [
      "2025",
      "세일",
      "신상품",
      "여름시즌",
      "홈페이지"
    ]
  }
}
```

---

### 8. 통계 대시보드

**엔드포인트**: `GET /api/images/stats`

**응답** (200 OK):
```json
{
  "ok": true,
  "data": {
    "totalImages": 45,
    "totalSize": "8589934592",
    "categoryCounts": [
      {
        "category": "배너",
        "count": 12
      },
      {
        "category": "상품",
        "count": 8
      }
    ],
    "mimeCounts": [
      {
        "mimeType": "image/jpeg",
        "count": 30
      },
      {
        "mimeType": "image/png",
        "count": 15
      }
    ],
    "recentUploads": [
      {
        "id": "uuid",
        "fileName": "new-banner.jpg",
        "uploadedAt": "2026-05-08T14:30:00Z"
      }
    ]
  }
}
```

---

## 데이터 모델

### ImageAsset 테이블

```sql
CREATE TABLE "ImageAsset" (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  
  originalFileName TEXT NOT NULL,
  driveFileId TEXT NOT NULL,
  drivePath TEXT,
  
  mimeType TEXT,
  fileSize BIGINT,
  width INTEGER,
  height INTEGER,
  
  tags TEXT[],
  category TEXT,
  
  uploadedBy TEXT NOT NULL,
  uploadedAt TIMESTAMPTZ DEFAULT NOW(),
  lastAccessedAt TIMESTAMPTZ,
  
  UNIQUE(organizationId, driveFileId)
);

-- 인덱스
CREATE INDEX ImageAsset_org_category_idx ON ImageAsset(organizationId, category);
CREATE INDEX ImageAsset_org_tags_idx ON ImageAsset USING GIN(organizationId, tags);
CREATE INDEX ImageAsset_uploadedAt_idx ON ImageAsset(uploadedAt DESC);
```

### Prisma 스키마

```prisma
model ImageAsset {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Text
  organizationId String

  originalFileName String
  driveFileId String
  drivePath String?

  mimeType String?
  fileSize BigInt?
  width Int?
  height Int?

  tags String[] @db.Text[]
  category String?

  uploadedBy String
  uploadedAt DateTime @default(now()) @db.Timestamptz(6)
  lastAccessedAt DateTime? @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, driveFileId])
  @@index([organizationId, category])
}
```

---

## Google Drive 폴더 구조

```
CRM자산/
├── 대리점A/
│   ├── 배너/
│   │   ├── banner1.jpg
│   │   ├── banner2.png
│   │   └── ...
│   ├── 상품/
│   │   └── ...
│   └── 로고/
│       └── ...
├── 대리점B/
│   └── ...
```

- **루트**: `GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID` 환경변수의 폴더
- **조직명**: 파일명 또는 organizationId로 자동 생성
- **카테고리**: 업로드 시 선택한 카테고리로 폴더 생성

---

## 에러 응답

**400 Bad Request**:
```json
{
  "ok": false,
  "message": "이미지 파일만 업로드 가능합니다 (JPEG, PNG, GIF, WebP, SVG)"
}
```

**404 Not Found**:
```json
{
  "ok": false,
  "message": "이미지를 찾을 수 없습니다"
}
```

**403 Forbidden** (동기화 API):
```json
{
  "ok": false,
  "message": "관리자만 동기화 가능합니다"
}
```

**500 Internal Server Error**:
```json
{
  "ok": false,
  "message": "업로드 중 오류가 발생했습니다"
}
```

---

## 사용 예제

### 1. 이미지 업로드

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('category', '배너');
formData.append('tags', '홈페이지,신상');

const res = await fetch('/api/images/upload', {
  method: 'POST',
  body: formData,
});
const json = await res.json();
console.log(json.data.driveUrl); // Google Drive 링크
```

### 2. 이미지 검색

```javascript
const params = new URLSearchParams({
  search: 'banner',
  category: '배너',
  tags: '홈페이지',
  limit: '20',
});

const res = await fetch(`/api/images/list?${params}`);
const { data } = await res.json();
console.log(data.assets); // 필터된 이미지 목록
```

### 3. 메타데이터 수정

```javascript
const res = await fetch('/api/images/uuid', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: '상품',
    tags: ['신상', '여름', '세일'],
  }),
});
```

---

## 성능 최적화

### 인덱스 전략

- **organizationId + category**: 카테고리별 조회 빠르게
- **GIN(organizationId, tags)**: 태그 기반 검색 최적화
- **uploadedAt DESC**: 최신 순 정렬 빠르게

### 페이지네이션

- 기본 limit: 60개, 최대: 200개
- offset 기반 페이지네이션
- `lastAccessedAt` 자동 갱신으로 접근 빈도 추적 가능

### 캐싱 권장사항

- `GET /api/images/categories` → Redis 5분
- `GET /api/images/stats` → Redis 10분
- 업로드 후 캐시 무효화

---

## 제약사항

| 항목 | 제약 |
|------|------|
| 파일 크기 | 100MB 이하 |
| 지원 MIME | image/jpeg, image/png, image/gif, image/webp, image/svg+xml |
| 조직당 이미지 | 제한 없음 (Drive 할당량 범위 내) |
| 태그 개수 | 제한 없음 |
| 카테고리 깊이 | 1단계만 지원 |

---

## 보안

- ✅ 조직별 격리 (organizationId 필수 검증)
- ✅ 인증 필수 (getAuthContext)
- ✅ 동기화는 GLOBAL_ADMIN만
- ✅ 파일 타입 검증
- ✅ 파일 크기 제한
- ✅ 모든 작업 로깅

---

## 마이그레이션 명령

```bash
# 1. DB 스키마 생성
curl -X POST http://localhost:3000/api/b2b/migrate

# 2. Prisma 생성 (자동으로 처리됨)
npx prisma generate
```

---

## 알려진 제한사항

1. **WebP 메타데이터**: VP8/VP8L 크기 추출은 일부 파일에서 실패할 수 있음
2. **Drive API 할당량**: 초당 요청 수 제한 존재
3. **동기화**: 폴더 내 파일 개수가 많으면 시간이 걸릴 수 있음 (페이지네이션 미구현)

---

마지막 업데이트: 2026-05-08
