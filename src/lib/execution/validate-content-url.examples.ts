/**
 * Content URL 검증 함수 - 실제 사용 예시
 * 다양한 시나리오별 구현 패턴
 */

import {
  validateContentUrl,
  isSafeContentUrl,
  validateContentUrls,
  filterSafeContentUrls,
  ValidationResult,
} from './validate-content-url';

// ============================================================================
// 예시 1: 프론트엔드 이미지 렌더링 (React)
// ============================================================================

export function ImageComponent({ src }: { src: string | null }) {
  // 방법 1: 간단한 true/false 검증
  if (!isSafeContentUrl(src)) {
    return <div className="error">유효하지 않은 이미지 URL</div>;
  }

  return <img src={src} alt="product" />;
}

export function ImageWithErrorHandling({ src }: { src: string }) {
  // 방법 2: 자세한 오류 메시지
  const validation = validateContentUrl(src);

  if (!validation.valid) {
    return (
      <div className="error">
        <p>이미지를 로드할 수 없습니다.</p>
        <small>{validation.error}</small>
      </div>
    );
  }

  return <img src={validation.sanitized} alt="product" />;
}

// ============================================================================
// 예시 2: API 엔드포인트에서 검증 (Next.js API Route)
// ============================================================================

export async function apiProductCreateExample(request: Request) {
  interface CreateProductRequest {
    name: string;
    imageUrl: string;
    description: string;
  }

  const body = (await request.json()) as CreateProductRequest;

  // 이미지 URL 검증
  const validation = validateContentUrl(body.imageUrl);

  if (!validation.valid) {
    return Response.json(
      {
        success: false,
        error: 'Invalid image URL',
        details: validation.error,
      },
      { status: 400 }
    );
  }

  // ✅ 안전한 URL로만 진행
  const product = {
    name: body.name,
    imageUrl: validation.sanitized, // 정제된 URL 사용
    description: body.description,
  };

  // DB에 저장...

  return Response.json({ success: true, product });
}

// ============================================================================
// 예시 3: 데이터 가져오기 및 검증 (Server Component)
// ============================================================================

export async function validateProductImages(productIds: string[]) {
  // 데이터베이스에서 상품 조회
  const products = []; // await db.product.findMany(...)

  // 각 상품의 이미지 URL 검증
  const validationResults = products.map(product => ({
    productId: product.id,
    validation: validateContentUrl(product.imageUrl),
  }));

  // 통계
  const validCount = validationResults.filter(r => r.validation.valid).length;
  const invalidCount = validationResults.filter(r => !r.validation.valid).length;

  console.log(`✅ 유효: ${validCount}, ❌ 무효: ${invalidCount}`);

  return validationResults;
}

// ============================================================================
// 예시 4: 폼 검증 및 오류 메시지
// ============================================================================

export function validateProductForm(formData: {
  name: string;
  imageUrl: string;
}) {
  const errors: Record<string, string> = {};

  // 이름 검증
  if (!formData.name?.trim()) {
    errors.name = '상품명은 필수입니다';
  }

  // 이미지 URL 검증
  if (!formData.imageUrl) {
    errors.imageUrl = '이미지 URL은 필수입니다';
  } else {
    const validation = validateContentUrl(formData.imageUrl);
    if (!validation.valid) {
      errors.imageUrl = validation.error || 'Invalid URL';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: Object.keys(errors).length === 0
      ? { ...formData, imageUrl: validateContentUrl(formData.imageUrl).sanitized }
      : null,
  };
}

// ============================================================================
// 예시 5: 배치 처리 - CSV 가져오기
// ============================================================================

interface ProductRow {
  name: string;
  imageUrl: string;
  category: string;
}

export async function importProductsFromCsv(csvContent: string) {
  // CSV 파싱 (실제로는 csv-parser 등 사용)
  const rows: ProductRow[] = []; // parseCSV(csvContent)

  const imageUrls = rows.map(row => row.imageUrl);

  // 모든 URL 검증
  const validationResults = validateContentUrls(imageUrls);

  // 통계
  const summary = {
    total: rows.length,
    valid: validationResults.filter(r => r.valid).length,
    invalid: validationResults.filter(r => !r.valid).length,
  };

  console.log(`📊 가져오기 결과: 전체=${summary.total}, 유효=${summary.valid}, 무효=${summary.invalid}`);

  // 안전한 URL만 필터링
  const validUrls = filterSafeContentUrls(imageUrls);

  // 유효한 행만 선택
  const validRows = rows.filter((row, index) =>
    validationResults[index].valid
  );

  // 로깅
  if (summary.invalid > 0) {
    const invalidEntries = rows.filter((row, index) => !validationResults[index].valid);
    console.warn('❌ 무효한 이미지 URL:', invalidEntries.map(r => r.imageUrl));
  }

  return {
    summary,
    validRows,
    errors: validationResults
      .map((result, index) => ({
        row: index,
        imageUrl: imageUrls[index],
        error: result.error,
      }))
      .filter(e => !validationResults[validationResults.indexOf(e as any)].valid),
  };
}

// ============================================================================
// 예시 6: 미들웨어 검증 (요청 필터링)
// ============================================================================

export async function validateImageUrlMiddleware(
  imageUrl: string | undefined
): Promise<{ valid: boolean; url?: string; error?: string }> {
  // 빈 값 허용 (선택사항이라고 가정)
  if (!imageUrl) {
    return { valid: true }; // 선택사항
  }

  const validation = validateContentUrl(imageUrl);

  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
    };
  }

  return {
    valid: true,
    url: validation.sanitized,
  };
}

// ============================================================================
// 예시 7: 데이터베이스 저장 전 검증 (Prisma)
// ============================================================================

interface ProductInput {
  name: string;
  imageUrl: string;
  description?: string;
}

export async function createProductSafe(input: ProductInput) {
  // 이미지 URL 검증
  const imageValidation = validateContentUrl(input.imageUrl);

  if (!imageValidation.valid) {
    throw new Error(`Image URL validation failed: ${imageValidation.error}`);
  }

  // Prisma에 저장
  const product = {
    name: input.name,
    imageUrl: imageValidation.sanitized, // 정제된 URL
    description: input.description,
  };

  // await prisma.product.create({ data: product })

  return product;
}

// ============================================================================
// 예시 8: 조건부 렌더링
// ============================================================================

export function ProductCard({ product }: { product: { name: string; imageUrl?: string } }) {
  // imageUrl이 없거나 유효하지 않으면 기본 이미지 표시
  const imageUrl = product.imageUrl && isSafeContentUrl(product.imageUrl)
    ? product.imageUrl
    : '/images/placeholder.png';

  return (
    <div className="product-card">
      <img src={imageUrl} alt={product.name} />
      <h3>{product.name}</h3>
    </div>
  );
}

// ============================================================================
// 예시 9: 에러 로깅 및 모니터링
// ============================================================================

export function validateAndLogImageUrl(imageUrl: string, context: string) {
  const validation = validateContentUrl(imageUrl);

  if (!validation.valid) {
    // 로깅 (Sentry, DataDog 등)
    console.error(`[${context}] Invalid image URL`, {
      url: imageUrl,
      reason: validation.error,
      timestamp: new Date().toISOString(),
    });

    // Sentry에 보내기 (선택사항)
    // Sentry.captureException(new Error(`Invalid image URL: ${validation.error}`));

    return null;
  }

  return validation.sanitized;
}

// ============================================================================
// 예시 10: 테스트 헬퍼
// ============================================================================

export function createMockProduct(overrides?: Partial<ProductRow>): ProductRow {
  return {
    name: 'Test Product',
    imageUrl: 'https://s3.amazonaws.com/bucket/test.png',
    category: 'Electronics',
    ...overrides,
  };
}

export function createInvalidProduct(overrides?: Partial<ProductRow>): ProductRow {
  return {
    name: 'Invalid Product',
    imageUrl: 'javascript:alert("xss")',
    category: 'Electronics',
    ...overrides,
  };
}

// ============================================================================
// 예시 11: 타입-안전 래퍼
// ============================================================================

export class SafeImageUrl {
  constructor(private url: string) {}

  static create(url: string | null | undefined): SafeImageUrl | null {
    if (!url) return null;

    const validation = validateContentUrl(url);
    if (!validation.valid) {
      throw new Error(`Invalid image URL: ${validation.error}`);
    }

    return new SafeImageUrl(validation.sanitized!);
  }

  static tryCreate(url: string | null | undefined): SafeImageUrl | null {
    try {
      return SafeImageUrl.create(url);
    } catch {
      return null;
    }
  }

  toString(): string {
    return this.url;
  }

  toJSON(): string {
    return this.url;
  }
}

// 사용 예시:
// const safeUrl = SafeImageUrl.create(userInput);
// if (safeUrl) {
//   img.src = safeUrl.toString();
// }

// ============================================================================
// 예시 12: 환경변수 기반 도메인 확장
// ============================================================================

export function initializeAllowedDomains() {
  // 환경변수에서 추가 도메인 로드
  const additionalDomains = process.env.ALLOWED_CONTENT_DOMAINS?.split(',') || [];

  if (additionalDomains.length > 0) {
    console.log(`✅ 추가 도메인 로드: ${additionalDomains.join(', ')}`);
    // addAllowedContentDomains(additionalDomains);
  }
}

// .env.local 예시:
// ALLOWED_CONTENT_DOMAINS=assets.mycompany.com,cdn.mycompany.com

// ============================================================================
// 예시 13: 성능 최적화 - 캐싱
// ============================================================================

const validationCache = new Map<string, ValidationResult>();

export function validateContentUrlWithCache(url: string): ValidationResult {
  // 캐시 확인
  if (validationCache.has(url)) {
    return validationCache.get(url)!;
  }

  // 검증 실행
  const result = validateContentUrl(url);

  // 캐시 저장 (유효한 URL만, TTL 1시간)
  if (result.valid) {
    validationCache.set(url, result);

    // 1시간 후 캐시 제거
    setTimeout(() => validationCache.delete(url), 3600 * 1000);
  }

  return result;
}

// ============================================================================
// 예시 14: 배치 처리 with 진행 상황
// ============================================================================

export async function validateImageUrlsBatch(
  urls: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const validation = validateContentUrl(urls[i]);

    if (validation.valid && validation.sanitized) {
      results.push(validation.sanitized);
    }

    onProgress?.(i + 1, urls.length);
  }

  return results;
}

// 사용:
// validateImageUrlsBatch(largeUrlList, (current, total) => {
//   console.log(`진행: ${current}/${total}`);
// });
