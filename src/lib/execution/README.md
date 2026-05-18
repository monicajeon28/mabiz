# Execution 라이브러리

CRM 실행 및 검증 유틸리티 모음입니다.

## 파일 구조

```
src/lib/execution/
├── validate-content-url.ts           # 콘텐츠 URL 검증 (SSRF/XSS 방지)
├── validate-content-url.test.ts      # 검증 함수 테스트
├── validate-content-url.examples.ts  # 실제 사용 예시 (14가지)
├── VALIDATE_CONTENT_URL_GUIDE.md     # 상세 가이드
├── failure-reason-map.ts             # 기존 유틸리티
└── README.md                         # 이 파일
```

## 핵심 기능

### 1. Content URL 검증

**파일**: `validate-content-url.ts`

SSRF(Server-Side Request Forgery) 및 XSS 공격으로부터 보호하는 URL 검증 함수입니다.

**주요 기능**:
- ✅ HTTPS 프로토콜만 허용 (HTTP는 주의)
- ✅ AWS S3, Azure Blob Storage 화이트리스트
- ❌ 로컬 IP 차단 (127.0.0.1, 192.168.x.x, 등)
- ❌ XSS 패턴 차단 (javascript:, data:, 스크립트 태그 등)
- ❌ 클라우드 메타데이터 서버 차단

**주요 함수**:
```typescript
// 자세한 검증 결과
validateContentUrl(url: string | null | undefined): ValidationResult

// 빠른 true/false 검증
isSafeContentUrl(url: string | null | undefined): boolean

// 배치 검증
validateContentUrls(urls: Array): ValidationResult[]

// 안전한 URL만 필터링
filterSafeContentUrls(urls: Array): string[]
```

## 빠른 시작

### 기본 사용법

```typescript
import { isSafeContentUrl, validateContentUrl } from '@/lib/execution/validate-content-url';

// 1. 간단한 검증
if (isSafeContentUrl(userImageUrl)) {
  displayImage(userImageUrl);
}

// 2. 자세한 검증
const result = validateContentUrl(userImageUrl);
if (!result.valid) {
  console.error('Invalid URL:', result.error);
} else {
  saveImage(result.sanitized);
}
```

### 상황별 사용 패턴

**프론트엔드 - 이미지 렌더링**
```typescript
<img src={isSafeContentUrl(url) ? url : '/placeholder.png'} />
```

**백엔드 - API 검증**
```typescript
const validation = validateContentUrl(req.body.imageUrl);
if (!validation.valid) {
  return res.status(400).json({ error: validation.error });
}
// 안전한 URL로 진행
```

**배치 처리 - CSV 가져오기**
```typescript
const validUrls = filterSafeContentUrls(csvImageUrls);
await importProducts(validUrls);
```

## 테스트

```bash
# 전체 테스트 실행
npm run test -- validate-content-url.test.ts

# 특정 테스트만 실행
npm run test -- validate-content-url.test.ts -t "XSS"
```

**테스트 커버리지**:
- ✅ 허용되는 URL (S3, Azure Blob 등)
- ✅ XSS 공격 패턴 (javascript:, data:, 이벤트 핸들러)
- ✅ SSRF 공격 (localhost, 프라이빗 IP, 메타데이터)
- ✅ 입력 검증 (null, 빈 문자열, 형식 오류)

## 보안 고려사항

1. **클라이언트 + 서버 양측 검증 필수**
   - 클라이언트만으로는 불충분
   - 항상 서버에서도 검증

2. **화이트리스트 유지보수**
   - 필요한 도메인만 추가
   - 정기적인 보안 감사

3. **로깅 및 모니터링**
   - 실패한 URL 시도 기록
   - 비정상 패턴 감지

## 의존성

- **없음** - 순수 TypeScript, 외부 라이브러리 불필요

## 성능

- **매우 빠름**: < 1ms
- **동기 처리 가능**
- **캐싱 권장** (선택사항)

## 문서

- **상세 가이드**: `VALIDATE_CONTENT_URL_GUIDE.md`
- **실제 예시**: `validate-content-url.examples.ts` (14가지 패턴)

## 기여

변경 시 보안팀 검토 필수입니다. 테스트를 추가하고 문서를 업데이트하세요.

## 라이선스

내부 CRM 유틸리티 - 모든 변경은 보안 정책을 따릅니다.
