/**
 * Content URL 검증 헬퍼 함수
 * SSRF(Server-Side Request Forgery) 및 XSS 공격 방지
 */

/**
 * 검증 결과 타입
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * 로컬 IP 대역 (SSRF 공격 방지)
 */
const PRIVATE_IP_RANGES = [
  /^127\./,                    // 127.0.0.0/8 (localhost)
  /^10\./,                      // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 (private)
  /^192\.168\./,                // 192.168.0.0/16 (private)
  /^169\.254\./,                // 169.254.0.0/16 (link-local)
  /^fc00:/,                      // fc00::/7 (IPv6 ULA)
  /^fe80:/,                      // fe80::/10 (IPv6 link-local)
];

/**
 * 특수 호스트명 차단 (SSRF 방지)
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '::',
  'metadata.google.internal', // GCP metadata
  '169.254.169.254',           // AWS metadata
  'metadata.alibaba.com',      // Aliyun metadata
  'local.metadata.azure.com',  // Azure metadata
]);

/**
 * 허용된 도메인 패턴
 * AWS S3, Azure Blob Storage, 조직 자체 도메인 등
 */
const ALLOWED_DOMAIN_PATTERNS = [
  /^s3\.amazonaws\.com$/,           // AWS S3 (버킷명 생략)
  /^s3[.-][\w-]+\.amazonaws\.com$/, // AWS S3 (지역별, 버킷명 포함)
  /^[\w-]+\.blob\.core\.windows\.net$/, // Azure Blob Storage
  /^[\w-]+\.dfs\.core\.windows\.net$/,  // Azure Data Lake Storage
  /^[\w-]+\.z\d+\.blob\.core\.windows\.net$/, // Azure Blob (zone-redundant)
];

/**
 * 문자열이 안전한 URL 형태인지 기본 검사
 */
function isValidUrlFormat(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * XSS 공격 패턴 검사
 */
function hasXssPatterns(url: string): boolean {
  const xssPatterns = [
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /<script/i,
    /on\w+\s*=/i, // onload=, onclick= 등
    /eval\(/i,
    /expression\(/i,
  ];

  return xssPatterns.some(pattern => pattern.test(url));
}

/**
 * 호스트명이 로컬 IP인지 확인
 */
function isPrivateIpAddress(hostname: string): boolean {
  // 호스트명이 차단된 특수 이름인지 확인
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    return true;
  }

  // IPv6 주소 처리
  if (hostname.includes(':') && hostname !== '::1') {
    const hasPrivatePattern = PRIVATE_IP_RANGES.some(pattern => pattern.test(hostname));
    if (hasPrivatePattern) return true;
  }

  // IPv4 주소 확인
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Pattern);
  if (match) {
    const [, octet1, octet2] = match;
    const num1 = parseInt(octet1, 10);
    const num2 = parseInt(octet2, 10);

    if (num1 === 0 || num1 === 10 || num1 === 127 || num1 === 169 || num1 === 192 || num1 === 172) {
      return true;
    }
  }

  // 프라이빗 IP 패턴 정규식 검사
  return PRIVATE_IP_RANGES.some(pattern => pattern.test(hostname));
}

/**
 * 도메인이 허용 목록에 있는지 확인
 */
function isAllowedDomain(hostname: string): boolean {
  return ALLOWED_DOMAIN_PATTERNS.some(pattern => pattern.test(hostname));
}

/**
 * URL의 프로토콜이 허용되는지 확인
 */
function isAllowedProtocol(protocol: string): boolean {
  const allowedProtocols = ['https:', 'http:']; // https만 필수, http는 주의 필요
  return allowedProtocols.includes(protocol);
}

/**
 * contentUrl 유효성 검증 (자세한 오류 메시지 포함)
 *
 * @param url - 검증할 URL
 * @returns {ValidationResult} - 검증 결과
 *
 * @example
 * // ✅ 허용되는 경우
 * validateContentUrl('https://s3.amazonaws.com/bucket/file.png')
 * // { valid: true, sanitized: 'https://s3.amazonaws.com/bucket/file.png' }
 *
 * validateContentUrl('https://assets.mysite.com/img.jpg')
 * // { valid: true, sanitized: 'https://assets.mysite.com/img.jpg' }
 *
 * // ❌ 차단되는 경우
 * validateContentUrl('javascript:alert("xss")')
 * // { valid: false, error: 'Unsafe protocol detected' }
 *
 * validateContentUrl('data:text/html,<script>alert("xss")</script>')
 * // { valid: false, error: 'Unsafe protocol detected' }
 *
 * validateContentUrl('http://127.0.0.1:9200')
 * // { valid: false, error: 'Private IP address detected' }
 *
 * validateContentUrl('http://192.168.1.1/admin')
 * // { valid: false, error: 'Private IP address detected' }
 *
 * validateContentUrl(null)
 * // { valid: false, error: 'URL cannot be empty' }
 */
export function validateContentUrl(url: string | null | undefined): ValidationResult {
  // 빈 값 검사
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'URL cannot be empty',
    };
  }

  // 공백 제거
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return {
      valid: false,
      error: 'URL cannot be empty',
    };
  }

  // 길이 검사 (일반적인 URL 최대 길이: 2083자)
  if (trimmedUrl.length > 2083) {
    return {
      valid: false,
      error: 'URL is too long (max 2083 characters)',
    };
  }

  // XSS 패턴 사전 검사 (빠른 실패)
  if (hasXssPatterns(trimmedUrl)) {
    return {
      valid: false,
      error: 'Unsafe protocol detected',
    };
  }

  // URL 형식 검증
  if (!isValidUrlFormat(trimmedUrl)) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    // 프로토콜 검증
    if (!isAllowedProtocol(parsedUrl.protocol)) {
      return {
        valid: false,
        error: `Unsafe protocol: ${parsedUrl.protocol}. Only http and https are allowed.`,
      };
    }

    // 호스트명 추출 (포트 제거)
    const hostname = parsedUrl.hostname || '';

    if (!hostname) {
      return {
        valid: false,
        error: 'Hostname is required',
      };
    }

    // SSRF 공격 방지: 프라이빗 IP 검사
    if (isPrivateIpAddress(hostname)) {
      return {
        valid: false,
        error: 'Private IP address detected',
      };
    }

    // 도메인 화이트리스트 검사
    // 주의: 현재는 S3/Azure Blob만 허용
    // 조직 자체 도메인은 환경변수로 확장 가능
    if (!isAllowedDomain(hostname)) {
      return {
        valid: false,
        error: `Domain not allowed: ${hostname}. Only AWS S3 and Azure Blob Storage are supported.`,
      };
    }

    // 모든 검사 통과
    return {
      valid: true,
      sanitized: trimmedUrl,
    };
  } catch (error) {
    return {
      valid: false,
      error: `URL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 간단한 boolean 반환 버전 (빠른 검사용)
 *
 * @param url - 검증할 URL
 * @returns {boolean} - 안전한 URL이면 true
 *
 * @example
 * if (isSafeContentUrl(userInput)) {
 *   // 안전한 URL, 진행
 * }
 */
export function isSafeContentUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const result = validateContentUrl(url);
  return result.valid === true;
}

/**
 * 여러 URL을 한 번에 검증 (배치 검증용)
 *
 * @param urls - 검증할 URL 배열
 * @returns {ValidationResult[]} - 각 URL의 검증 결과 배열
 */
export function validateContentUrls(urls: (string | null | undefined)[]): ValidationResult[] {
  return urls.map(url => validateContentUrl(url));
}

/**
 * 안전한 URL만 필터링
 *
 * @param urls - URL 배열
 * @returns {string[]} - 검증을 통과한 URL만 반환
 */
export function filterSafeContentUrls(urls: (string | null | undefined)[]): string[] {
  return urls
    .map(url => validateContentUrl(url))
    .filter((result): result is ValidationResult & { sanitized: string } => {
      return result.valid === true && result.sanitized !== undefined;
    })
    .map(result => result.sanitized);
}

/**
 * 환경변수 기반 커스텀 도메인 추가 (향후 확장용)
 * 환경변수 예: ALLOWED_CONTENT_DOMAINS="assets.mysite.com,cdn.mysite.com"
 */
export function addAllowedContentDomains(domains: string[]): void {
  domains.forEach(domain => {
    // 도메인 정규식 생성 (와일드카드 지원)
    const pattern = new RegExp(`^${domain.replace(/\*/g, '[\\w-]+')}$`, 'i');
    ALLOWED_DOMAIN_PATTERNS.push(pattern);
  });
}

/**
 * 테스트용 헬퍼: 현재 허용된 도메인 패턴 출력
 */
export function getAllowedDomainPatterns(): RegExp[] {
  return [...ALLOWED_DOMAIN_PATTERNS];
}
