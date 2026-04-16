/**
 * RBAC (Role-Based Access Control)
 *
 * 역할 계층:
 *   GLOBAL_ADMIN  - 모든 조직 DB 접근 + 삭제 권한 (관리자)
 *   OWNER         - 자기 조직 전체 + 소속 AGENT DB 접근 (대리점장)
 *   AGENT         - 자기에게 배당된 고객만 접근, 삭제 불가 (330만 직속판매원)
 *   FREE_SALES    - 내 판매 현황 + 어필리에이트 링크만 (고객 DB 접근 없음)
 */

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export type UserRole = "GLOBAL_ADMIN" | "OWNER" | "AGENT" | "FREE_SALES";

export interface AuthContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  member: {
    id: string;
    organizationId: string;
    role: string;
    displayName: string | null;
  } | null;
}

/** 현재 사용자의 권한 컨텍스트 조회 */
export async function getAuthContext(): Promise<AuthContext> {
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHORIZED");

  // 글로벌 관리자 체크
  const isGlobalAdmin = await prisma.globalAdmin.findUnique({ where: { userId } });
  if (isGlobalAdmin) {
    return { userId, role: "GLOBAL_ADMIN", organizationId: null, member: null };
  }

  // 조직 멤버 조회
  const member = await prisma.organizationMember.findFirst({
    where: { userId, isActive: true },
    select: { id: true, organizationId: true, role: true, displayName: true },
  });

  if (!member) throw new Error("NO_ORGANIZATION");

  const role: UserRole =
    member.role === "OWNER"      ? "OWNER"      :
    member.role === "FREE_SALES" ? "FREE_SALES" : "AGENT";

  return { userId, role, organizationId: member.organizationId, member };
}

/** 고객 목록 조회 조건 (역할 기반) */
export function buildContactWhere(ctx: AuthContext, extra: Record<string, unknown> = {}) {
  if (ctx.role === "GLOBAL_ADMIN") {
    return extra;
  }
  if (ctx.role === "FREE_SALES") {
    // 프리세일즈: 고객 DB 접근 불가 — API에서 차단
    throw new Error("FREE_SALES_NO_ACCESS");
  }
  if (ctx.role === "OWNER") {
    return { organizationId: ctx.organizationId!, ...extra };
  }
  // AGENT: 할당된 고객만
  return {
    organizationId: ctx.organizationId!,
    assignedUserId: ctx.userId,
    ...extra,
  };
}

/** FREE_SALES 역할 차단 */
export function requireNotFreeSales(ctx: AuthContext): void {
  if (ctx.role === "FREE_SALES") throw new Error("FREE_SALES_NO_ACCESS");
}

/** 연락처 마스킹 — 현재 AGENT는 할당된 고객 전체 정보 접근 가능 */
export function maskContactInfo<T extends object>(contact: T, _ctx: AuthContext): T {
  return contact; // 할당된 고객은 실명/연락처 공개
}

/** 삭제 권한 체크 */
export function canDelete(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN" || ctx.role === "OWNER";
}

/** SMS/이메일 설정 권한 (OWNER 이상만) */
export function canManageSettings(ctx: AuthContext): boolean {
  return ctx.role === "GLOBAL_ADMIN" || ctx.role === "OWNER";
}

/** 조직 ID 강제 획득 (없으면 에러) */
export function requireOrgId(ctx: AuthContext): string {
  if (!ctx.organizationId) throw new Error("ORGANIZATION_REQUIRED");
  return ctx.organizationId;
}
