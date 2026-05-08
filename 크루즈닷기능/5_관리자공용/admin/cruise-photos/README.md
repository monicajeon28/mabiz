# GET /api/admin/cruise-photos

크루즈 관련 이미지를 폴더별로 조회하는 관리자 API

## 인증
- 관리자만 접근 가능 (checkAdminAuth 미들웨어)
- 세션 쿠키 필요

## 데이터 소스
- `ImageCache` 테이블에서 조회
- `cloudinaryUrl IS NOT NULL` 이미지만 반환 (Cloudinary 동기화 완료)

## 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 기본값 |
|---------|------|------|--------|
| `folder` | string | 특정 폴더 경로로 필터링 | 없음 (전체) |
| `format` | string | 응답 형식 (`grouped` \| `flat`) | `grouped` |

## 사용 예시

### 1. 전체 폴더 목록 조회 (기본값)

```bash
curl -X GET http://localhost:3000/api/admin/cruise-photos \
  -H "Cookie: cg.sid.v2=YOUR_SESSION_ID"
```

**응답:**
```json
{
  "ok": true,
  "data": {
    "folders": [
      {
        "folder": "cruise/cabins",
        "count": 5,
        "images": [
          {
            "id": "https://res.cloudinary.com/demo/...",
            "name": "cabin-01.jpg",
            "url": "https://res.cloudinary.com/demo/...",
            "folder": "cruise/cabins",
            "size": 189000
          }
        ]
      },
      {
        "folder": "cruise/deck-views",
        "count": 8,
        "images": [...]
      },
      {
        "folder": "cruise/ship-photos",
        "count": 15,
        "images": [...]
      }
    ],
    "stats": {
      "totalFolders": 3,
      "totalImages": 28
    }
  }
}
```

### 2. 특정 폴더 조회

```bash
curl -X GET "http://localhost:3000/api/admin/cruise-photos?folder=cruise/ship-photos" \
  -H "Cookie: cg.sid.v2=YOUR_SESSION_ID"
```

**응답:**
```json
{
  "ok": true,
  "data": {
    "folders": [
      {
        "folder": "cruise/ship-photos",
        "count": 15,
        "images": [
          {
            "id": "https://res.cloudinary.com/demo/image/upload/v1234567890/cruise/ship-01.jpg",
            "name": "ship-01.jpg",
            "url": "https://res.cloudinary.com/demo/image/upload/v1234567890/cruise/ship-01.jpg",
            "folder": "cruise/ship-photos",
            "size": 245000
          },
          {
            "id": "https://res.cloudinary.com/demo/image/upload/v1234567891/cruise/ship-02.jpg",
            "name": "ship-02.jpg",
            "url": "https://res.cloudinary.com/demo/image/upload/v1234567891/cruise/ship-02.jpg",
            "folder": "cruise/ship-photos",
            "size": 312000
          }
        ]
      }
    ],
    "stats": {
      "totalFolders": 1,
      "totalImages": 15
    }
  }
}
```

### 3. 평탄 형식 조회

```bash
curl -X GET "http://localhost:3000/api/admin/cruise-photos?format=flat" \
  -H "Cookie: cg.sid.v2=YOUR_SESSION_ID"
```

**응답:**
```json
{
  "ok": true,
  "data": {
    "images": [
      {
        "id": "https://res.cloudinary.com/demo/...",
        "name": "ship-01.jpg",
        "url": "https://res.cloudinary.com/demo/...",
        "folder": "cruise/ship-photos",
        "size": 245000
      },
      {
        "id": "https://res.cloudinary.com/demo/...",
        "name": "ship-02.jpg",
        "url": "https://res.cloudinary.com/demo/...",
        "folder": "cruise/ship-photos",
        "size": 312000
      }
    ],
    "count": 28
  }
}
```

### 4. 특정 폴더를 평탄 형식으로 조회

```bash
curl -X GET "http://localhost:3000/api/admin/cruise-photos?folder=cruise/cabins&format=flat" \
  -H "Cookie: cg.sid.v2=YOUR_SESSION_ID"
```

## 응답 타입

### CruisePhoto
```typescript
interface CruisePhoto {
  id: string;           // cloudinaryUrl
  name: string;         // fileName
  url: string;          // cloudinaryUrl
  folder: string;       // folder path
  size: number | null;  // fileSize (bytes)
}
```

### FolderGroup
```typescript
interface FolderGroup {
  folder: string;        // folder path
  count: number;         // number of images in folder
  images: CruisePhoto[]; // list of images
}
```

### Grouped Response
```typescript
{
  ok: true;
  data: {
    folders: FolderGroup[];
    stats: {
      totalFolders: number;
      totalImages: number;
    };
  };
}
```

### Flat Response
```typescript
{
  ok: true;
  data: {
    images: CruisePhoto[];
    count: number;
  };
}
```

## 에러 응답

### 403 - 인증 실패

```json
{
  "ok": false,
  "error": "관리자만 접근할 수 있습니다."
}
```

### 500 - 서버 에러

```json
{
  "ok": false,
  "error": "크루즈 이미지를 불러올 수 없습니다."
}
```

## 구현 특징

### 보안
- 관리자 인증 필수 (checkAdminAuth)
- SQL Injection 방지 (Prisma ORM)
- 에러 마스킹 (시스템 정보 노출 금지)

### 성능
- 구조화된 쿼리 (select로 필요한 필드만 선택)
- 폴더 인덱스 활용 (`@@index([folder])`)
- 응답 정렬: 폴더 기준 오름차순 → 파일명 기준 오름차순

### 로깅
- 성공 로그: 폴더 필터, 형식, 통계 정보
- 에러 로그: 에러 메시지, 코드, 스택 트레이스
- 비인가 접근 로그: 시도자 정보 기록

## 데이터베이스 쿼리

```sql
SELECT id, cloudinaryUrl, fileName, folder, fileSize
FROM "ImageCache"
WHERE "cloudinaryUrl" IS NOT NULL
  AND folder = $1 -- optional
ORDER BY folder ASC, "fileName" ASC;
```

## 관련 테이블

### ImageCache
- `id`: 자동 증가 PK
- `cloudinaryUrl`: Cloudinary 최종 URL
- `fileName`: 원본 파일명
- `folder`: 폴더 경로
- `fileSize`: 파일 크기 (bytes)
- `cloudinarySyncedAt`: 동기화 완료 시간

## 통합 예시

```typescript
// 프론트엔드에서 사용
const response = await fetch('/api/admin/cruise-photos?folder=cruise/ship-photos');
const data = await response.json();

if (data.ok) {
  const folderGroup = data.data.folders[0];
  console.log(`폴더: ${folderGroup.folder}`);
  console.log(`이미지 수: ${folderGroup.count}`);
  
  folderGroup.images.forEach((img) => {
    console.log(`- ${img.name}: ${img.url}`);
  });
}
```

## 마이그레이션 히스토리

| 버전 | 날짜 | 변경사항 |
|-----|------|--------|
| v1.0 | 2026-04-27 | 초기 구현 - 폴더별 그룹화 + 평탄 형식 |
