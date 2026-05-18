# Content URL 검증 헬퍼 함수 가이드

SSRF(Server-Side Request Forgery) 및 XSS 공격으로부터 애플리케이션을 보호하는 콘텐츠 URL 검증 함수입니다.

## 기능 개요

### 보안 검증 항목

| 검증 항목 | 설명 | 차단 예시 |
|---------|------|---------|
| **프로토콜** | 안전한 프로토콜만 허용 | `javascript:`, `data:`, `ftp://` |
| **XSS 패턴** | 스크립트 실행 패턴 차단 | `<script>`, `onload=`, `eval()` |
| **프라이빗 IP** | 로컬/내부 네트워크 IP 차단 | `127.0.0.1`, `192.168.x.x`, `10.x.x.x` |
| **메타데이터 서버** | 클라우드 메타데이터 서버 차단 | AWS, GCP, Azure, Aliyun |
| **도메인 화이트리스트** | 허용된 도메인만 승인 | S3, Azure Blob Storage |

## API 문서

### 1. `validateContentUrl(url)`

자세한 검증 결과를 반환합니다.

```typescript
import { validateContentUrl } from '@/lib/execution/validate-content-url';

// ✅ 성공
const result = validateContentUrl('https://s3.amazonaws.com/bucket/file.png');
if (result.valid) {
  console.log('안전한 URL:', result.sanitized);
  // 출력: 안전한 URL: https://s3.amazonaws.com/bucket/file.png
}

// ❌ 실패
const badResult = validateContentUrl('javascript:alert("xss")');
console.log(badResult.error);
// 출력: Unsafe protocol detected
```

**반환 타입:**
```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;        // 실패 시 오류 메시지
  sanitized?: string;    // 성공 시 정제된 URL
}
```

**에러 메시지 종류:**
- `URL cannot be empty` - 입력값이 없음
- `URL is too long (max 2083 characters)` - URL 길이 초과
- `Invalid URL format` - URL 형식 오류
- `Unsafe protocol: <protocol>` - 허용되지 않는 프로토콜
- `Private IP address detected` - 내부 IP 주소 감지
- `Domain not allowed: <hostname>` - 허용되지 않는 도메인

### 2. `isSafeContentUrl(url)`

빠른 true/false 검증용 (간단한 버전).

```typescript
import { isSafeContentUrl } from '@/lib/execution/validate-content-url';

if (isSafeContentUrl(userInput)) {
  // URL 사용
  displayImage(userInput);
} else {
  // 오류 처리
  throw new Error('Invalid URL');
}
```

### 3. `validateContentUrls(urls)`

여러 URL을 한 번에 검증 (배치 처리).

```typescript
const results = validateContentUrls([
  'https://s3.amazonaws.com/file1.png',
  'https://myaccount.blob.core.windows.net/file2.png',
  'javascript:alert("xss")',
]);

results.forEach((result, index) => {
  console.log(`URL ${index}:`, result.valid ? '✅ OK' : `❌ ${result.error}`);
});
```

### 4. `filterSafeContentUrls(urls)`

안전한 URL만 필터링하여 반환 (배열).

```typescript
const userUrls = ['https://s3.amazonaws.com/file1.png', 'javascript:alert("xss")', null];
const safeUrls = filterSafeContentUrls(userUrls);

console.log(safeUrls);
// ['https://s3.amazonaws.com/file1.png']
```

## 사용 시나리오

### 1. 이미지 URL 검증 (프론트엔드)

```typescript
// src/app/(dashboard)/products/[id]/page.tsx
import { isSafeContentUrl } from '@/lib/execution/validate-content-url';

export default function ProductPage({ params }: { params: { id: string } }) {
  const imageUrl = product.imageUrl;

  if (!isSafeContentUrl(imageUrl)) {
    return <div>유효하지 않은 이미지 URL</div>;
  }

  return <img src={imageUrl} alt={product.name} />;
}
```

### 2. API 응답 검증 (백엔드)

```typescript
// src/app/api/products/route.ts
import { validateContentUrl } from '@/lib/execution/validate-content-url';

export async function POST(request: Request) {
  const body = await request.json();
  const { imageUrl } = body;

  // 이미지 URL 검증
  const validation = validateContentUrl(imageUrl);
  if (!validation.valid) {
    return Response.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // 안전한 URL 사용
  const sanitizedUrl = validation.sanitized;
  await saveProduct({ imageUrl: sanitizedUrl });

  return Response.json({ success: true });
}
```

### 3. 데이터베이스 저장 전 검증

```typescript
// src/lib/services/product-service.ts
import { validateContentUrl } from '@/lib/execution/validate-content-url';

export async function saveProductImage(productId: string, imageUrl: string) {
  const validation = validateContentUrl(imageUrl);

  if (!validation.valid) {
    throw new Error(`Invalid image URL: ${validation.error}`);
  }

  // Prisma 저장
  return prisma.product.update({
    where: { id: productId },
    data: { imageUrl: validation.sanitized },
  });
}
```

### 4. 폼 입력 처리

```typescript
// 컴포넌트에서
import { validateContentUrl } from '@/lib/execution/validate-content-url';

function ImageUploadForm() {
  const [error, setError] = useState<string>('');

  const handleUrlSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const imageUrl = formData.get('imageUrl') as string;

    const validation = validateContentUrl(imageUrl);
    if (!validation.valid) {
      setError(validation.error || 'Invalid URL');
      return;
    }

    // 진행
    saveImage(validation.sanitized);
  };

  return (
    <form onSubmit={handleUrlSubmit}>
      <input type="text" name="imageUrl" placeholder="이미지 URL" />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit">저장</button>
    </form>
  );
}
```

### 5. 배치 처리 (대량 URL 검증)

```typescript
// src/lib/services/import-service.ts
import { filterSafeContentUrls } from '@/lib/execution/validate-content-url';

export async function importProducts(csvData: string) {
  const rows = parseCsv(csvData);
  const imageUrls = rows.map(row => row.imageUrl);

  // 안전한 URL만 필터링
  const validUrls = filterSafeContentUrls(imageUrls);

  console.log(`✅ ${validUrls.length}개 유효, ❌ ${imageUrls.length - validUrls.length}개 무효`);

  // 유효한 URL만 저장
  for (const row of rows) {
    if (filterSafeContentUrls([row.imageUrl]).length > 0) {
      await saveProduct(row);
    }
  }
}
```

## 허용되는 도메인

### AWS S3
```
✅ https://s3.amazonaws.com/bucket/file.png
✅ https://s3-us-west-2.amazonaws.com/bucket/file.png
✅ https://s3.us-east-1.amazonaws.com/bucket/file.png
✅ https://bucket.s3.amazonaws.com/file.png
```

### Azure Blob Storage
```
✅ https://myaccount.blob.core.windows.net/container/file.png
✅ https://myaccount.z6.blob.core.windows.net/container/file.png
✅ https://myaccount.dfs.core.windows.net/container/file.png
```

### 조직 자체 도메인 (확장 가능)
향후 환경변수로 추가 가능:
```typescript
import { addAllowedContentDomains } from '@/lib/execution/validate-content-url';

// 초기화 시
addAllowedContentDomains([
  'assets.mycompany.com',
  'cdn.mycompany.com',
  '*.mycompany.com'
]);
```

## 차단되는 패턴

### XSS 공격
```
❌ javascript:alert("xss")
❌ data:text/html,<script>alert("xss")</script>
❌ vbscript:msgbox("xss")
❌ <img src="x" onerror="alert('xss')">
```

### SSRF 공격 - Localhost
```
❌ http://127.0.0.1
❌ http://127.0.0.1:9200
❌ http://localhost:3000
❌ http://[::1]:8080
❌ http://0.0.0.0
```

### SSRF 공격 - 프라이빗 IP
```
❌ http://10.0.0.1
❌ http://10.255.255.254
❌ http://192.168.1.1
❌ http://172.16.0.1
❌ http://172.31.255.254
```

### SSRF 공격 - 클라우드 메타데이터
```
❌ http://169.254.169.254          (AWS)
❌ http://metadata.google.internal (GCP)
❌ http://metadata.alibaba.com     (Aliyun)
❌ http://local.metadata.azure.com (Azure)
```

## 환경변수 설정 (선택사항)

향후 조직 도메인 확장을 위해:

```bash
# .env.local
ALLOWED_CONTENT_DOMAINS="assets.mycompany.com,cdn.mycompany.com"
```

```typescript
// 앱 초기화 시
import { addAllowedContentDomains } from '@/lib/execution/validate-content-url';

const allowedDomains = process.env.ALLOWED_CONTENT_DOMAINS?.split(',') || [];
if (allowedDomains.length > 0) {
  addAllowedContentDomains(allowedDomains);
}
```

## 성능 고려사항

### 검증 비용
- **매우 빠름**: < 1ms (정규식 기반, 네트워크 조회 없음)
- DNS 조회 없음 (모두 로컬 검증)
- 동기 처리 가능

### 권장사항
- 프론트엔드: 사용자 입력 즉시 검증 (`isSafeContentUrl`)
- 백엔드 API: 요청 처리 전 검증 (`validateContentUrl`)
- 데이터베이스: 저장 전 검증 (중복 방지)
- 배치: 대량 URL은 `filterSafeContentUrls` 사용

## 테스트

모든 테스트는 `validate-content-url.test.ts`에 포함되어 있습니다.

```bash
npm run test -- validate-content-url.test.ts
```

테스트 커버리지:
- ✅ 허용되는 URL (AWS S3, Azure Blob, 등)
- ❌ XSS 공격 (프로토콜, 이벤트 핸들러, 스크립트)
- ❌ SSRF 공격 (localhost, 프라이빗 IP, 메타데이터)
- ❌ 입력 검증 (null, 빈 문자열, 형식 오류)

## 보안 주의사항

1. **클라이언트 검증만으로 충분하지 않음**
   - 항상 서버에서도 검증하세요
   - 악의적 사용자가 클라이언트 코드를 우회할 수 있음

2. **도메인 화이트리스트 관리**
   - 필요한 도메인만 추가
   - 정기적으로 검토

3. **로깅 및 모니터링**
   - 실패한 검증 시도 로깅
   - 비정상 패턴 감지

4. **업데이트 유지**
   - 새로운 SSRF/XSS 기법 대응
   - 정기적인 보안 감사

## 트러블슈팅

### Q: 정상적인 URL이 차단됩니다
A: `allowedDomainPatterns`을 확인하세요. 필요한 도메인이 화이트리스트에 있는지 확인하고, `addAllowedContentDomains()`으로 추가하세요.

### Q: 모든 URL을 허용하고 싶습니다
A: **절대 하지 마세요!** SSRF/XSS 공격에 취약해집니다. 필요한 도메인만 구체적으로 지정하세요.

### Q: 정규식 패턴을 수정하고 싶습니다
A: 패일 내 상수를 수정하고 테스트를 추가하세요.

## 라이선스 및 기여

내부 CRM 보안 유틸리티로, 변경 시 보안팀 검토 필수입니다.
