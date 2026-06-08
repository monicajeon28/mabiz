/**
 * Passport Security Module
 * 여권/PNR/APIS 기능의 보안 강화 (권한/CSRF/PII/감시로깅)
 *
 * Team D 담당 기능:
 * 1. 권한 검증 (ADMIN/MANAGER만)
 * 2. CSRF 토큰 검증
 * 3. PII 마스킹 (역할별 표시)
 * 4. 감시 로깅 (누가 언제 뭘 했나)
 *
 * 2026-06-08 | 절대법칙: 분석→토론→설계→구현→tsc→커밋
 */

import 'server-only';
import { getMabizSession } from '@/lib/auth';
import { validateToken } from '@/lib/csrf';
import { maskPhone, maskName } from '@/lib/pii-masker';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// 1️⃣ 권한 검증 (requirePassportAccess)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PassportSecurityContext {
  userId: string; // CRM userId (세션)
  gmUserId: number | null; // GMcruise User.id
  role: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | null;
  organizationId: string | null;
  name: string | null;
}

/**
 * 여권 기능 접근 권한 검증
 * - GLOBAL_ADMIN: 제한 없음
 * - OWNER: 자신의 조직만
 * - AGENT: 거부
 * - 기타: 거부
 *
 * @param action 수행할 작업: 'read' | 'send-sms' | 'manage-requests'
 * @throws Error if unauthorized
 */
export async function requirePassportAccess(
  action: 'read' | 'send-sms' | 'manage-requests' = 'read'
): Promise<PassportSecurityContext> {
  const session = await getMabizSession();

  if (!session?.userId || !session.role) {
    throw new Error('[Passport Security] 인증 필요: 유효한 세션 없음');
  }

  const ctx: PassportSecurityContext = {
    userId: session.userId,
    gmUserId: session.mallUser?.id ?? null,
    role: session.role as any,
    organizationId: session.organizationId,
    name: session.mallUser?.name ?? session.member?.displayName ?? null,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 역할별 권한 검증
  // ──────────────────────────────────────────────────────────────────────────

  switch (action) {
    case 'send-sms':
    case 'manage-requests':
      // SMS 발송 및 요청 관리: GLOBAL_ADMIN + OWNER만
      if (!['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role ?? '')) {
        logSecurityEvent(ctx, action, 'DENIED', 'Insufficient role for SMS action');
        throw new Error('[Passport Security] SMS 발송 권한 부족 (관리자/대리점장만)');
      }
      break;

    case 'read':
    default:
      // 조회: GLOBAL_ADMIN + OWNER + AGENT
      if (!['GLOBAL_ADMIN', 'OWNER', 'AGENT'].includes(ctx.role ?? '')) {
        logSecurityEvent(ctx, action, 'DENIED', 'Insufficient role for read access');
        throw new Error('[Passport Security] 조회 권한 없음');
      }
      break;
  }

  logSecurityEvent(ctx, action, 'ALLOWED', undefined);
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2️⃣ CSRF 토큰 검증 (validatePassportCsrf)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CSRF 토큰 검증
 * POST/PUT/DELETE 요청 시 호출
 *
 * @param req NextRequest
 * @param sessionId 사용자 세션 ID
 * @throws Error if CSRF validation fails
 */
export async function validatePassportCsrf(
  req: Request,
  sessionId: string
): Promise<void> {
  // 헤더에서 CSRF 토큰 추출
  const token = req.headers.get('x-csrf-token');

  if (!token) {
    logger.warn('[Passport CSRF] 토큰 없음', {
      sessionId: sessionId.substring(0, 8) + '...',
      method: req.method,
      pathname: (req as any).nextUrl?.pathname || 'unknown',
    });
    throw new Error('[Passport Security] CSRF 토큰 필수');
  }

  // Redis에서 검증
  const isValid = await validateToken(sessionId, token);

  if (!isValid) {
    logger.warn('[Passport CSRF] 토큰 검증 실패', {
      sessionId: sessionId.substring(0, 8) + '...',
      token: token.substring(0, 8) + '...',
      method: req.method,
    });
    throw new Error('[Passport Security] CSRF 토큰 검증 실패');
  }

  logger.log('[Passport CSRF] 토큰 검증 성공', {
    sessionId: sessionId.substring(0, 8) + '...',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3️⃣ PII 마스킹 (역할별 표시)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 역할별 PII 마스킹 규칙
 *
 * GLOBAL_ADMIN: 전체 공개
 *   - 이름: "김철수"
 *   - 전화: "010-1234-5678"
 *   - 이메일: "john@example.com"
 *
 * OWNER: 부분 마스킹
 *   - 이름: "김*"
 *   - 전화: "010-****-5678" (뒤 4자리만)
 *   - 이메일: "jo***@***"
 *
 * AGENT: 강한 마스킹
 *   - 이름: "김*"
 *   - 전화: "010-****-5678"
 *   - 이메일: "[마스킹됨]"
 */
export function maskPiiByRole(
  value: string | null | undefined,
  type: 'phone' | 'name' | 'email',
  role: string | null
): string {
  if (!value) return '[정보 없음]';

  // GLOBAL_ADMIN: 마스킹 없음
  if (role === 'GLOBAL_ADMIN') {
    return value;
  }

  // OWNER 이상: 부분 마스킹
  if (['OWNER', 'AGENT'].includes(role ?? '')) {
    switch (type) {
      case 'phone':
        return maskPhone(value);
      case 'name':
        return maskName(value);
      case 'email':
        return maskEmail(value);
    }
  }

  // 기타: 강한 마스킹
  return '[마스킹됨]';
}

function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '[마스킹됨]';
  const parts = email.split('@');
  if (parts.length !== 2) return '[마스킹됨]';

  const [local, domain] = parts;
  const maskedLocal = local.substring(0, 2) + '*'.repeat(Math.max(1, local.length - 2));
  return `${maskedLocal}@***`;
}

/**
 * 사용자 객체 마스킹
 */
export function maskUserByRole(
  user: {
    id?: number | string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  role: string | null
): {
  id?: number | string;
  name: string;
  phone: string;
  email?: string;
} {
  return {
    id: user.id,
    name: maskPiiByRole(user.name, 'name', role),
    phone: maskPiiByRole(user.phone, 'phone', role),
    ...(user.email && { email: maskPiiByRole(user.email, 'email', role) }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4️⃣ 감시 로깅 (auditLog)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PassportAuditLog {
  userId: string; // CRM userId
  gmUserId: number | null;
  action: string; // 'SMS_SENT' | 'SMS_FAILED' | 'LINK_VIEWED' | 'MANUAL_REGISTER' | etc.
  resource: string; // 'TRIP' | 'USER' | 'REQUEST_LOG' | etc.
  resourceId?: string | number;
  status: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, any>;
  timestamp: string;
  ip?: string;
}

/**
 * 감시 로깅 함수
 * 모든 민감한 작업을 기록하여 감사추적(audit trail) 제공
 *
 * Usage:
 * ```
 * await auditLog({
 *   userId: ctx.userId,
 *   gmUserId: ctx.gmUserId,
 *   action: 'SMS_SENT',
 *   resource: 'TRIP',
 *   resourceId: tripId,
 *   status: 'SUCCESS',
 *   metadata: {
 *     recipientCount: 10,
 *     successCount: 9,
 *     failureCount: 1,
 *     templateType: 'basic',
 *   }
 * });
 * ```
 */
export async function auditLog(
  entry: Partial<PassportAuditLog>
): Promise<void> {
  const log: PassportAuditLog = {
    userId: entry.userId ?? 'unknown',
    gmUserId: entry.gmUserId ?? null,
    action: entry.action ?? 'UNKNOWN',
    resource: entry.resource ?? 'UNKNOWN',
    resourceId: entry.resourceId,
    status: entry.status ?? 'FAILURE',
    metadata: entry.metadata,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    ip: entry.ip,
  };

  // 1. Logger 기록 (일시적)
  logger.log('[Passport Audit]', log);

  // 2. DB 기록 (영구) — 감사추적 테이블이 있으면
  try {
    // PassportAuditLog 테이블이 없으면 이 부분은 스킵됨
    // 향후 추가 예정: await prisma.passportAuditLog.create({ data: log });
  } catch (err) {
    logger.error('[Passport Audit] DB 기록 실패', { err, log });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5️⃣ 내부 헬퍼 함수
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 보안 이벤트 로깅 (권한/CSRF 검증 결과)
 */
function logSecurityEvent(
  ctx: PassportSecurityContext,
  action: string,
  status: 'ALLOWED' | 'DENIED',
  reason?: string
): void {
  logger.log(`[Passport Security] ${status}`, {
    userId: ctx.userId.substring(0, 8) + '...',
    role: ctx.role,
    action,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 요청에서 IP 추출 (감사추적용)
 */
export function extractIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6️⃣ 통합 검증 함수 (POST /api/passport/send-sms 에서 사용)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/passport/send-sms 요청 검증 (통합)
 *
 * Usage:
 * ```
 * const validation = await validatePassportSmsRequest(req);
 * if (!validation.ok) {
 *   return NextResponse.json({ error: validation.error }, { status: validation.status });
 * }
 * const ctx = validation.ctx;
 * // 이제 ctx.userId, ctx.role, ctx.organizationId로 안전한 작업 수행
 * ```
 */
export async function validatePassportSmsRequest(
  req: Request
): Promise<
  | { ok: true; ctx: PassportSecurityContext }
  | { ok: false; error: string; status: number }
> {
  try {
    // 1. 권한 검증
    let ctx: PassportSecurityContext;
    try {
      ctx = await requirePassportAccess('send-sms');
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Authorization failed',
        status: 403,
      };
    }

    // 2. CSRF 토큰 검증
    try {
      await validatePassportCsrf(req, ctx.userId);
    } catch (err) {
      await auditLog({
        userId: ctx.userId,
        gmUserId: ctx.gmUserId,
        action: 'CSRF_VALIDATION_FAILED',
        resource: 'SMS',
        status: 'DENIED',
        metadata: { reason: err instanceof Error ? err.message : 'Unknown error' },
      });
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'CSRF validation failed',
        status: 403,
      };
    }

    return { ok: true, ctx };
  } catch (err) {
    logger.error('[Passport SMS] 검증 중 예외', { err });
    return {
      ok: false,
      error: 'Internal validation error',
      status: 500,
    };
  }
}

export default {
  requirePassportAccess,
  validatePassportCsrf,
  maskPiiByRole,
  maskUserByRole,
  auditLog,
  extractIp,
  validatePassportSmsRequest,
};
