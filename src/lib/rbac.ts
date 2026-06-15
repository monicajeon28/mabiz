/**
 * RBAC (Role-Based Access Control)
 *
 * 역할 계층:
 *   GLOBAL_ADMIN  - 모든 조직 DB 접근 + 삭제 권한 (관리자)
 *   OWNER         - 자기 조직 전체 + 소속 AGENT DB 접근 (대리점장)
 *   AGENT         - 자기에게 배당된 고객만 접근, 삭제 불가 (330만 직속판매원)
 *   FREE_SALES    - 내 판매 현황 + 어필리에이트 링크만 (고객 DB 접근 없음)
 */
import { ContactVisibility } from "@prisma/client";

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
 *   )
 *   AND visibility != 'ADMIN_ONLY'  -- idx_contact_org_visibility 병렬 필터
 *   AND deletedAt IS NULL
 * ```
 */
export function buildContactWhere(ctx: AuthContext, extra: Record<string, unknown> = {}) {
  if (ctx.role === "FREE_SALES") {
    // 프리세일즈: 고객 DB 접근 불가 — API에서 차단
    throw new Error("FREE_SALES_NO_ACCESS");
  }
  // deletedAt: null은 항상 마지막에 고정 — extra로 덮어씌워지지 않도록
  if (ctx.role === "GLOBAL_ADMIN") {
    return { ...extra, deletedAt: null };
  }
  if (ctx.role === "OWNER") {
    return {
      ...extra,
      organizationId: ctx.organizationId!,
      visibility: { not: ContactVisibility.ADMIN_ONLY }, // 대리점장은 ADMIN_ONLY 제외
      deletedAt: null,
    };
  }
  // AGENT: 할당된 고객 + visibility !== ADMIN_ONLY
  // 성능: PostgreSQL BitmapOr로 2개 인덱스 병합 (15-25ms)
  return {
    ...extra,
    organizationId: ctx.organizationId!,
    OR: [
      { assignedUserId: ctx.userId }, // 할당된 고객 (idx_contact_org_assigned)
      { createdBy: ctx.userId }, // 작성한 고객 (idx_contact_org_created_by)
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
 * - 대리점장: 여러 판매원 관리 (affiliateAgentId IN (...))
 * - 판매원: 자신의 고객만 (affiliateAgentId = agentId)
 */
export function buildContactWhereWithSourceFilter(
  ctx: AuthContext,
  extra: Record<string, unknown> = {},
  userAffiliateMeta?: { managerId?: string | number; agentId?: string | number }
) {
  const baseWhere = buildContactWhere(ctx, extra);

  // AGENT 역할인데 어필리에이트 메타데이터가 있으면 소스 기반 필터 적용
  if (ctx.role === "AGENT" && userAffiliateMeta) {
    if (userAffiliateMeta.managerId) {
      // 본사: 자신의 managerId를 가진 어필리에이트만
      return {
        ...baseWhere,
        OR: [
          { assignedUserId: ctx.userId }, // 기존 할당된 고객
          { sourceType: 'affiliate', affiliateManagerId: String(userAffiliateMeta.managerId) },
        ],
      };
    }
    if (userAffiliateMeta.agentId) {
      // 판매원: 자신의 agentId를 가진 어필리에이트만
      return {
        ...baseWhere,
        OR: [
          { assignedUserId: ctx.userId },
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

/** 연락처 마스킹 — 현재 AGENT는 할당된 고객 전체 정보 접근 가능 */
export function maskContactInfo<T extends object>(contact: T, _ctx: AuthContext): T {
  return contact; // 할당된 고객은 실명/연락처 공개
}

/** 삭제 권한 체크 (판매원 AGENT/FREE_SALES 불가) */
export function canDelete(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN" || ctx.role === "OWNER";
}

/** 휴지통(삭제 DB) 조회 권한 — 대리점장(OWNER)·시스템관리자(GLOBAL_ADMIN) */
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
