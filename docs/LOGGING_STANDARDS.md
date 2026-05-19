# 로깅 표준화 가이드

크루즈닷 CRM의 모든 로깅은 다음 표준을 따릅니다.

## 1. 기본 형식

```typescript
logger.log('[ComponentName]', {
  action: '수행한 작업',
  status: 'success' | 'error',
  duration: 123, // milliseconds
  meta: { /* 추가 정보 */ }
});
```

## 2. 파일별 로깅 규칙

### API 경로 (src/app/api/...)
```typescript
// GET 요청
logger.log('[GET /api/tools/playbook]', {
  action: 'fetch-playbooks',
  params: { productCode: 'GOLD_MEMBERSHIP' },
  status: 'success',
  resultCount: 12,
});

// POST 요청
logger.log('[POST /api/contacts]', {
  action: 'create-contact',
  status: 'success',
  contactId: 'c123',
  segment: 'A',
});

// 에러
logger.error('[GET /api/tools/playbook]', {
  action: 'fetch-playbooks',
  status: 'error',
  error: 'Database connection failed',
  statusCode: 500,
});
```

### Client Components (src/app/.../page.tsx)
```typescript
// 초기화
logger.log('[VariantPage]', {
  action: 'mount',
  campaignId: 'camp123',
});

// 상태 변경
logger.log('[VariantPage]', {
  action: 'create-variant',
  variantKey: 'A',
  status: 'success',
  duration: 1200,
});

// 에러
logger.error('[VariantPage]', {
  action: 'create-variant',
  status: 'error',
  error: 'API request failed',
  response: { ok: false, error: '...' },
});
```

### Hook (src/lib/...)
```typescript
logger.log('[useDeltaWizard]', {
  action: 'fetch-config',
  status: 'success',
  configDays: 4,
});
```

### Utility Functions (src/lib/...)
```typescript
logger.log('[detectSegment]', {
  action: 'detect',
  status: 'success',
  age: 35,
  maritalStatus: 'MARRIED',
  segment: 'A',
});
```

## 3. 필수 필드

모든 로그는 다음을 포함해야 합니다:

| 필드 | 타입 | 설명 | 필수 |
|------|------|------|------|
| `action` | string | 수행한 작업 | ✅ |
| `status` | 'success' \| 'error' | 작업 결과 | ✅ |
| `duration` | number | 수행 시간 (ms) | API만 |
| `error` | string | 에러 메시지 | 에러만 |
| `meta` | object | 추가 정보 | - |

## 4. 액션(Action) 네이밍

- `mount` - 컴포넌트 로드
- `fetch-*` - 데이터 조회 (fetch-playbooks, fetch-contacts)
- `create-*` - 데이터 생성 (create-contact, create-variant)
- `update-*` - 데이터 수정 (update-variant)
- `delete-*` - 데이터 삭제 (delete-variant)
- `detect-*` - 분석/감지 (detect-segment)
- `validate-*` - 검증 (validate-length)

## 5. Status 코드

```typescript
// 성공
status: 'success'

// 에러
status: 'error'
```

## 6. 예제 모음

### 최소형 (로그 레벨: info)
```typescript
logger.info('[ContactDetail]', {
  action: 'load-data',
});
```

### 상세형 (로그 레벨: log)
```typescript
logger.log('[PlaybookViewer]', {
  action: 'filter-by-product',
  status: 'success',
  selectedProduct: 'GOLD_MEMBERSHIP',
  beforeCount: 67,
  afterCount: 12,
  filterTime: 45,
});
```

### 에러형
```typescript
logger.error('[VariantCard]', {
  action: 'save-variant',
  status: 'error',
  error: 'Validation failed: SMS length > 90',
  variantKey: 'A',
  smsLength: 105,
});
```

### 성능 로깅
```typescript
const start = performance.now();
// 작업 수행
const duration = Math.round(performance.now() - start);

logger.log('[ProductRecommender]', {
  action: 'recommend-products',
  status: 'success',
  segment: 'A',
  recommendedCount: 2,
  duration,
});
```

## 7. 프로덕션 환경

- `logger.log()` - development only
- `logger.info()` - 모든 환경 (중요한 작업)
- `logger.warn()` - 모든 환경 (경고)
- `logger.error()` - 모든 환경 (에러)

## 8. 대시보드 활용

로그는 다음 형태로 수집되어 대시보드에 표시됩니다:
- `[2026-05-19T10:30:45.123Z] [LOG] [PlaybookViewer] filter-by-product success (duration: 45ms)`
