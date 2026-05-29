/**
 * PII (Personally Identifiable Information) 마스킹 유틸리티
 *
 * GDPR / 개인정보보호법 준수
 * - 로그에 전화번호, 이메일, 이름 노출 금지
 * - API 응답 에러 메시지에 민감정보 노출 금지
 *
 * 기본 규칙:
 * - 전화: "010****5678" (마지막 4자리만 보임)
 * - 이메일: "ab***@***" (처음 2자리 + 도메인 마스킹)
 * - 이름: "김*" (첫 글자만 보임)
 * - 헬스: 제거 (아예 로깅하지 않음)
 * - 주소: 제거
 * - 메시지: 제거
 */

// ============================================
// 기본 마스킹 함수들
// ============================================

/**
 * 전화번호 마스킹: "01012345678" → "010****5678"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return 'unknown';

  const cleaned = phone.replace(/\D/g, ''); // 숫자만 추출
  if (cleaned.length < 4) return '****';

  return cleaned
    .slice(0, -4)
    .replace(/./g, '*')
    .concat(cleaned.slice(-4));
}

/**
 * 이메일 마스킹: "john.doe@example.com" → "jo***@***"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return 'unknown@***';

  const parts = email.split('@');
  if (parts.length !== 2) return 'invalid@***';

  const [localPart, domain] = parts;
  if (localPart.length <= 2) {
    return localPart + '***@***';
  }

  const maskedLocal =
    localPart.substring(0, 2) +
    '*'.repeat(Math.max(1, localPart.length - 2));

  return `${maskedLocal}@***`;
}

/**
 * 이름 마스킹: "김철수" → "김**"
 */
export function maskName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '***';

  if (name.length <= 1) return name;

  return name.substring(0, 1) + '*'.repeat(name.length - 1);
}

/**
 * 카드 번호 마스킹: "4111111111111111" → "4111****1111"
 */
export function maskCardNumber(card: string | null | undefined): string {
  if (!card || typeof card !== 'string') return '****';

  const cleaned = card.replace(/\D/g, '');
  if (cleaned.length < 8) return '****';

  return (
    cleaned.slice(0, 4) +
    '*'.repeat(Math.max(4, cleaned.length - 8)) +
    cleaned.slice(-4)
  );
}

/**
 * 주소 마스킹: "서울시 강남구 테헤란로 123" → "[주소 마스킹됨]"
 */
export function maskAddress(): string {
  return '[주소 마스킹됨]';
}

/**
 * 메시지/설명 마스킹: 길이 기반 마스킹
 */
export function maskMessage(message: string | null | undefined): string {
  if (!message || typeof message !== 'string') return '[메시지 마스킹됨]';

  if (message.length <= 10) return '[메시지 마스킹됨]';

  return message.substring(0, 5) + '*'.repeat(message.length - 10) + '...';
}

// ============================================
// Payload 마스킹 (로깅용)
// ============================================

/**
 * Webhook Payload 마스킹 (Contact 자동생성용)
 * 로깅할 때 호출: logger.error('error', maskPayloadForLogging(payload))
 */
export function maskPayloadForLogging(payload: any): any {
  if (!payload) return null;

  return {
    // 마스킹된 필드
    ...(payload.name && { name: maskName(payload.name) }),
    ...(payload.phone && { phone: maskPhone(payload.phone) }),
    ...(payload.email && { email: maskEmail(payload.email) }),

    // 안전한 필드만 통과
    ...(payload.source && { source: payload.source }),
    ...(payload.paymentId && { paymentId: payload.paymentId }),
    ...(payload.orderId && { orderId: payload.orderId }),
    ...(payload.timestamp && { timestamp: payload.timestamp }),
    ...(payload.segment && { segment: payload.segment }),
    ...(payload.lens && { lens: payload.lens }),
    ...(payload.riskScore && { riskScore: payload.riskScore }),

    // 제외: healthConcerns, familyComposition, inquiryMessage, message, address, etc.
  };
}

/**
 * Contact 객체 마스킹 (로깅용)
 */
export function maskContactForLogging(contact: any): any {
  if (!contact) return null;

  return {
    id: contact.id,
    ...(contact.name && { name: maskName(contact.name) }),
    ...(contact.phone && { phone: maskPhone(contact.phone) }),
    ...(contact.email && { email: maskEmail(contact.email) }),
    organizationId: contact.organizationId,
    segment: contact.segment,
    lens: contact.lens,
    riskScore: contact.riskScore,
    createdAt: contact.createdAt,
  };
}

/**
 * SMS 로깅 마스킹
 */
export function maskSmsForLogging(sms: any): any {
  if (!sms) return null;

  return {
    id: sms.id,
    ...(sms.recipientPhone && { recipientPhone: maskPhone(sms.recipientPhone) }),
    recipientName: maskName(sms.recipientName),
    messagePreview: sms.messageContent
      ? sms.messageContent.substring(0, 20) + '...'
      : '[메시지]',
    status: sms.status,
    createdAt: sms.createdAt,
  };
}

// ============================================
// 에러 메시지 안전화
// ============================================

/**
 * 에러 메시지를 사용자 친화적으로 변환
 * 내부 로그는 상세 정보 포함, API 응답은 제네릭 메시지
 *
 * 사용:
 * - 내부 로깅: logger.error('detail', { detailedError: error.message })
 * - API 응답: return NextResponse.json({ message: sanitizeErrorForUser(error) })
 */
export function sanitizeErrorForUser(error: unknown, errorId?: string): string {
  const id = errorId || generateErrorId();

  // 내부 에러만 노출 금지
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  // 민감한 경로/정보 제거
  const sensitivePatterns = [
    /\/home\/\S+/gi, // 홈 디렉토리
    /\/root\/\S+/gi, // 루트 디렉토리
    /password/gi,
    /secret/gi,
    /api.?key/gi,
    /token/gi,
    /jwt/gi,
    /authorization/gi,
    /cookie/gi,
    /session/gi,
  ];

  let safeMessage = message;
  for (const pattern of sensitivePatterns) {
    safeMessage = safeMessage.replace(pattern, '[REDACTED]');
  }

  // 제네릭 메시지 반환
  if (safeMessage !== message) {
    // 민감정보가 포함되었으므로 완전히 제거
    return `요청을 처리할 수 없습니다. (오류 ID: ${id})`;
  }

  // 비즈니스 로직 에러면 메시지 그대로 사용 가능
  if (
    message.includes('not found') ||
    message.includes('already exists') ||
    message.includes('validation') ||
    message.includes('required')
  ) {
    return message;
  }

  return `요청을 처리할 수 없습니다. (오류 ID: ${id})`;
}

/**
 * 고유한 에러 ID 생성 (추적용)
 * 형식: ERR_20260529_ABC123D4
 */
export function generateErrorId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ERR_${date}_${random}`;
}

// ============================================
// Database 응답 마스킹
// ============================================

/**
 * 다중 Contact 객체 마스킹 (대시보드 조회용)
 */
export function maskContactsForResponse(
  contacts: any[],
  includePersonalInfo: boolean = false
): any[] {
  return contacts.map((contact) => ({
    id: contact.id,
    ...(includePersonalInfo && contact.name && { name: contact.name }),
    ...(!includePersonalInfo && contact.name && {
      name: maskName(contact.name),
    }),
    ...(includePersonalInfo && contact.phone && { phone: contact.phone }),
    ...(!includePersonalInfo && contact.phone && {
      phone: maskPhone(contact.phone),
    }),
    segment: contact.segment,
    lens: contact.lens,
    riskScore: contact.riskScore,
    createdAt: contact.createdAt,
  }));
}

/**
 * 에러 응답 구조화
 * API 클라이언트가 추적할 수 있도록 errorId 포함
 */
export function createSafeErrorResponse(
  error: unknown,
  context?: string
): {
  message: string;
  errorId: string;
  contactSupport: boolean;
} {
  const errorId = generateErrorId();
  const message = sanitizeErrorForUser(error, errorId);

  return {
    message,
    errorId,
    contactSupport: true,
  };
}

// ============================================
// 로깅 헬퍼 (Logger와 통합)
// ============================================

/**
 * 안전한 로깅 함수들
 * 자동으로 민감정보 마스킹
 *
 * 사용:
 * logSafeContact(logger, contact)
 * logSafePayload(logger, payload)
 */

export function logSafeContact(logger: any, contact: any, message?: string) {
  logger.log(message || '[ContactLog]', maskContactForLogging(contact));
}

export function logSafeError(logger: any, error: unknown, context?: string) {
  const errorId = generateErrorId();
  const sanitized = sanitizeErrorForUser(error, errorId);

  logger.error(context || '[ErrorLog]', {
    errorId,
    detailedError:
      error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function logSafePayload(logger: any, payload: any, message?: string) {
  logger.log(message || '[PayloadLog]', maskPayloadForLogging(payload));
}

export function logSafeSms(logger: any, sms: any, message?: string) {
  logger.log(message || '[SmsLog]', maskSmsForLogging(sms));
}
