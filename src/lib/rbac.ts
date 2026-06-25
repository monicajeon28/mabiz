/**
 * RBAC (Role-Based Access Control)
 *
 * 역할 계층:
 *   GLOBAL_ADMIN  - 모든 조직 DB 접근 + 삭제 권한 (관리자)
 *   OWNER         - 자기 조직 전체 + 소속 AGENT DB 접근 (지사장)
 *   AGENT         - 자기에게 배당된 고객만 접근, 삭제 불가 (330만 직속대리점장)
 *   FREE_SALES    - 내 판매 현황 + 어필리에이트 링크만 (고객 DB 접근 없음)
 */
import { ContactVisibility, Prisma } from "@prisma/client";

import 'server-only';
import { getMabizSession } from '@/lib/auth';

export type UserRole = "GLOBAL_ADMIN" | "OWNER" | "AGENT" | "FREE_SALES";

export interface AuthContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  /** GMcruise User 기반 세션일 때 채워짐 */
  mallUser?: {
    id: number;
    name: string | null;
    mallUserId: string | null;
    affiliateType: string | null;
    affiliateProfileId: number | null;
  };
  member: {
    id: string;
    organizationId: string;
    role: string;
    displayName: string | null;
  } | null;
}

/** 현재 사용자의 권한 컨텍스트 조회 */
export async function getAuthContext(): Promise<AuthContext> {
  const session = await getMabizSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

/**
 * 고객 목록 조회 조건 (역할 기반 + visibility 필터)
 *
 * 인덱스 전략 (2026-06-15):
 * - GLOBAL_ADMIN: 전체 테이블 (deletedAt 필터만)
 * - OWNER: idx_contact_org_visibility (organizationId + visibility)
 *   └─ 성능: O(log n), ~5-10ms (조직당 1,000-10,000 고객)
 * - AGENT: idx_contact_org_assigned + idx_contact_org_created_by (BitmapOr)
 *   └─ 성능: O(2 × log n), ~15-25ms (2개 인덱스 병합)
 *   └─ PostgreSQL 옵션: SET enable_bitmapscan = on (기본값)
 *
 * 최적화 옵션:
 * 1. 현재 (즉시): 3개 인덱스 활용, BitmapOr로 OR 최적화
 * 2. 나중 (Phase 2): accessibleBy JSON 필드 추가 → 1개 인덱스만 사용
 *    └─ accessibleBy: ["user-123"] → 단순 JSONB 인덱싱
 *    └─ 성능: O(log n), ~10-15ms (인덱스 1개만)
 *
 * 쿼리 구조:
 * ```sql
 * WHERE organizationId = $1
 *   AND (
 *     assignedUserId = $2          -- idx_contact_org_assigned 활용
 *     OR createdBy = $2            -- idx_contact_org_created_by 활용
 *     OR sharedWith ANY (idx_sharedTo)  -- ContactSharing 공유받은 고객
 *   )
 *   AND visibility != 'ADMIN_ONLY'  -- idx_contact_org_visibility 병렬 필터
 *   AND deletedAt IS NULL
 * ```
 */
export function buildContactWhere(ctx: AuthContext, extra: Record<string, unknown> = {}) {
  if (ctx.role === "FREE_SALES") {
    // 마케터: 고객 DB 접근 불가 — API에서 차단
    throw new Error("FREE_SALES_NO_ACCESS");
  }
  // deletedAt: null은 항상 마지막에 고정 — extra로 덮어씌워지지 않도록
  if (ctx.role === "GLOBAL_ADMIN") {
    return { ...extra, deletedAt: null };
  }
  // OWNER/AGENT는 반드시 organizationId 필요 — null이면 런타임 크래시 방지
  if (!ctx.organizationId) throw new Error('MISSING_ORG_ID');
  if (ctx.role === "OWNER") {
    return {
      ...extra,
      organizationId: ctx.organizationId!,
      visibility: { not: ContactVisibility.ADMIN_ONLY }, // 지사장은 ADMIN_ONLY 제외
      deletedAt: null,
    };
  }
  // AGENT: 할당된 고객 + 작성한 고객 + 공유받은 고객 + visibility !== ADMIN_ONLY
  // 주의: extra에 OR 키를 전달하면 아래 OR 배열과 충돌함.
  // 호출부 계약: extra에는 OR 키를 포함하지 않음. 필요시 반환값에서 직접 병합할 것.
  // 성능: PostgreSQL BitmapOr로 3개 인덱스 병합 (ContactSharing idx_sharedTo 활용)
  const { OR: extraOR, ...restExtra } = extra as { OR?: Prisma.ContactWhereInput[]; [k: string]: unknown };
  return {
    ...restExtra,
    organizationId: ctx.organizationId!,
    OR: [
      { assignedUserId: ctx.userId }, // 할당된 고객 (idx_contact_org_assigned)
      { createdBy: ctx.userId }, // 작성한 고객 (idx_contact_org_created_by)
      { sharedWith: { some: { sharedTo: ctx.userId } } }, // 공유받은 고객 (ContactSharing idx_sharedTo)
      ...(extraOR ?? []),
    ],
    visibility: { not: ContactVisibility.ADMIN_ONLY },
    deletedAt: null,
  };
}

/**
 * P0-6: 출처 기반 RBAC (어필리에이트 링크/담당자 기반)
 *
 * 어필리에이트 조직 구조:
 * - 본사 (Manager): affiliateManagerId = managerId로 필터링
 * - 지사장: 여러 대리점장 관리 (affiliateAgentId IN (...))
 * - 대리점장: 자신의 고객만 (affiliateAgentId = agentId)
 */
export function buildContactWhereWithSourceFilter(
  ctx: AuthContext,
  extra: Record<string, unknown> = {},
  userAffiliateMeta?: { managerId?: string | number; agentId?: string | number }
) {
  const baseWhere = buildContactWhere(ctx, extra);

  // AGENT 역할인데 어필리에이트 메타데이터가 있으면 소스 기반 필터 적용
  // buildContactWhere(AGENT)의 OR 배열을 spread한 후 sourceType 조건만 추가.
  // sharedWith 조건은 baseWhere.OR에 이미 포함되므로 중복 추가하지 않음.
  if (ctx.role === "AGENT" && userAffiliateMeta) {
    const baseOR = (baseWhere as { OR?: Prisma.ContactWhereInput[] }).OR ?? [];
    if (userAffiliateMeta.managerId) {
      // 본사: 자신의 managerId를 가진 어필리에이트만
      return {
        ...baseWhere,
        OR: [
          ...baseOR,
          { sourceType: 'affiliate', affiliateManagerId: String(userAffiliateMeta.managerId) },
        ],
      };
    }
    if (userAffiliateMeta.agentId) {
      // 대리점장: 자신의 agentId를 가진 어필리에이트만
      return {
        ...baseWhere,
        OR: [
          ...baseOR,
          { sourceType: 'affiliate', affiliateAgentId: String(userAffiliateMeta.agentId) },
        ],
      };
    }
  }

  return baseWhere;
}

/** GLOBAL_ADMIN만 하드 삭제 가능, OWNER는 소프트 삭제만 */
export function canHardDelete(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN";
}

/** FREE_SALES 역할 차단 */
export function requireNotFreeSales(ctx: AuthContext): void {
  if (ctx.role === "FREE_SALES") throw new Error("FREE_SALES_NO_ACCESS");
}

/**
 * 연락처 마스킹 (P0 Security Fix)
 * - GLOBAL_ADMIN: 마스킹 없음 (전체 PII 접근)
 * - OWNER: 부분 마스킹 (phone 뒤 4자리만, email 도메인만)
 * - AGENT: 할당된 고객은 전체, 공유받은 고객은 마스킹
 * - FREE_SALES: 전체 마스킹 (phone/email/name)
 */
function maskPhoneNumber(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone;
  // 형식: 010-1234-5678 → 010-XXXX-5678 (중간 자리 마스킹, 뒤 4자리 노출)
  // 정규식 기반: 010/011/지역번호-중간-뒤4자리 모두 처리
  const masked = phone.replace(
    /(\d{2,4})-?(\d{3,4})-?(\d{4})$/,
    (_, a, _b, c) => `${a}-XXXX-${c}`
  );
  // 치환이 발생하지 않았으면(국제번호 등) 원본 반환
  return masked !== phone ? masked : phone;
}

function maskEmail(email: string | null | undefined): string | null | undefined {
  if (!email) return email;
  // 형식: user@example.com → u***@example.com
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 1) return email;
  const masked = local.charAt(0) + '*'.repeat(Math.max(0, local.length - 2)) + local.charAt(local.length - 1);
  return `${masked}@${domain}`;
}

function maskName(name: string | null | undefined): string | null | undefined {
  if (!name) return name;
  // 형식: 김철수 → 김*수, John Doe → J***e
  if (name.length <= 2) return name;
  const first = name.charAt(0);
  const last = name.charAt(name.length - 1);
  const masked = '*'.repeat(Math.max(1, name.length - 2));
  return `${first}${masked}${last}`;
}

export function maskContactInfo<T extends object>(contact: T, ctx: AuthContext): T {
  // GLOBAL_ADMIN: 마스킹 없음
  if (ctx.role === 'GLOBAL_ADMIN') return contact;

  // contact 객체 깊은 복사 (원본 수정 방지)
  const masked = { ...contact } as Record<string, unknown>;

  // OWNER: 부분 마스킹
  if (ctx.role === 'OWNER') {
    if ('phone' in masked) masked.phone = maskPhoneNumber(masked.phone as string | null | undefined);
    if ('email' in masked) masked.email = maskEmail(masked.email as string | null | undefined);
    return masked as unknown as T;
  }

  // AGENT: 할당된 고객은 전체, 공유받은 고객은 마스킹
  if (ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
    // FREE_SALES: 모든 고객 마스킹
    if (ctx.role === 'FREE_SALES') {
      if ('phone' in masked) masked.phone = maskPhoneNumber(masked.phone as string | null | undefined);
      if ('email' in masked) masked.email = maskEmail(masked.email as string | null | undefined);
      if ('name' in masked) masked.name = maskName(masked.name as string | null | undefined);
      return masked as unknown as T;
    }

    // AGENT: 할당된 고객은 전체, 공유받은 고객은 마스킹
    // 규칙: createdBy === userId → 전체 공개
    //       assignedUserId === userId → 전체 공개
    //       sharedWith (공유받음) → 마스킹
    const isOwned = ('createdBy' in masked && masked.createdBy === ctx.userId) ||
                    ('assignedUserId' in masked && masked.assignedUserId === ctx.userId);

    if (!isOwned) {
      // 공유받은 고객: 마스킹
      if ('phone' in masked) masked.phone = maskPhoneNumber(masked.phone as string | null | undefined);
      if ('email' in masked) masked.email = maskEmail(masked.email as string | null | undefined);
      if ('name' in masked) masked.name = maskName(masked.name as string | null | undefined);
    }
    return masked as unknown as T;
  }

  return contact;
}

/** 삭제 권한 체크 (대리점장 AGENT/FREE_SALES 불가) */
export function canDelete(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN" || ctx.role === "OWNER";
}

/** 휴지통(삭제 DB) 조회 권한 — 지사장(OWNER)·시스템관리자(GLOBAL_ADMIN) */
export function canViewTrash(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN" || ctx.role === "OWNER";
}

/**
 * 휴지통 WHERE — 삭제된(deletedAt != null) 고객 스코프.
 * GLOBAL_ADMIN: 전체 / OWNER: 자기 조직 삭제분만 / AGENT·FREE_SALES: 접근 차단
 */
export function buildTrashWhere(ctx: AuthContext, extra: Record<string, unknown> = {}) {
  if (!canViewTrash(ctx)) throw new Error("NO_TRASH_ACCESS");
  if (ctx.role === "GLOBAL_ADMIN") {
    return { ...extra, deletedAt: { not: null } };
  }
  // OWNER: 자기 조직 삭제분만
  return { ...extra, organizationId: ctx.organizationId!, deletedAt: { not: null } };
}

/** 영구삭제(완전 삭제) 권한 — 시스템관리자(GLOBAL_ADMIN)만 */
export function canPurge(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN";
}

/** 삭제자 표시명 — 휴지통 "삭제자" 컬럼 스냅샷용 */
export function actorDisplayName(ctx: AuthContext): string {
  return ctx.member?.displayName ?? ctx.mallUser?.name ?? (ctx.role === "GLOBAL_ADMIN" ? "시스템관리자" : "담당자");
}

/** SMS/이메일 설정 권한 (OWNER 이상만) */
export function canManageSettings(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN" || ctx.role === "OWNER";
}

/** 메시지 검수 권한 (GLOBAL_ADMIN, OWNER만) */
export function canReview(role: UserRole): boolean {
  return role === "GLOBAL_ADMIN" || role === "OWNER";
}

/** P0-6: 구매 고객 관리 조회 권한 (AGENT 이상, FREE_SALES 제외) */
export function canViewPurchases(ctx: AuthContext): boolean {
  return ctx.role !== "FREE_SALES";
}

/** P0-6: 구매 고객 관리 생성/수정 권한 (OWNER 이상) */
export function canManagePurchases(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN" || ctx.role === "OWNER";
}

/** 조직 ID 강제 획득 (없으면 에러) */
export function requireOrgId(ctx: AuthContext): string {
  if (!ctx.organizationId) throw new Error("ORGANIZATION_REQUIRED");
  return ctx.organizationId;
}

/** 본사 조직 ID (GLOBAL_ADMIN 쓰기 작업 기본값)
 * 환경변수 BONSA_ORG_ID로 오버라이드 가능.
 * 예) .env.local: BONSA_ORG_ID=org-cruisedot-main
 */
export const BONSA_ORG_ID = process.env.BONSA_ORG_ID ?? 'org-cruisedot-main';

/**
 * GLOBAL_ADMIN → null (전체 조직 조회, org 필터 없음)
 * 나머지 역할 → organizationId (없으면 에러)
 */
export function resolveOrgIdOrNull(ctx: AuthContext): string | null {
  if (ctx.role === 'GLOBAL_ADMIN') return null;
  return requireOrgId(ctx);
}

/**
 * GLOBAL_ADMIN → BONSA_ORG_ID (쓰기 작업 기본 조직)
 * 나머지 역할 → organizationId (없으면 에러)
 */
export function resolveOrgId(ctx: AuthContext): string {
  if (ctx.role === 'GLOBAL_ADMIN') return BONSA_ORG_ID;
  return requireOrgId(ctx);
}
