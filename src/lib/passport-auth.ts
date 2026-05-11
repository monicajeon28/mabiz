import 'server-only';
import { getMabizSession, type MabizAuthContext } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 여권/PNR/APIS 관리용 인증 어댑터
 * 크루즈닷몰 인증 패턴 → CRM 인증 시스템으로 브릿지
 *
 * 역할 매핑:
 *   크루즈닷몰 admin     → CRM GLOBAL_ADMIN
 *   크루즈닷몰 affiliate → CRM OWNER (대리점장)
 *   크루즈닷몰 agent     → CRM AGENT
 */

// ── Admin 인증 (GLOBAL_ADMIN 전용) ──────────────────────────

export interface AdminUser {
  id: number;         // GMcruise User.id (정수)
  crmUserId: string;  // CRM 세션 userId (문자열)
  name: string | null;
  role: 'GLOBAL_ADMIN';
}

export async function requireCrmAdmin(): Promise<AdminUser | null> {
  try {
    const session = await getMabizSession();
    if (!session || session.role !== 'GLOBAL_ADMIN') return null;

    // GLOBAL_ADMIN은 mallUser가 없을 수 있음 → adminId 사용
    const gmUserId = session.mallUser?.id ?? 0;

    return {
      id: gmUserId,
      crmUserId: session.userId,
      name: session.mallUser?.name ?? session.member?.displayName ?? null,
      role: 'GLOBAL_ADMIN',
    };
  } catch (err) {
    logger.error('[passport-auth] Admin 인증 실패', { err });
    return null;
  }
}

// ── Admin + OWNER 인증 (관리자 또는 대리점장) ────────────────

export interface ManagerUser {
  id: number;
  crmUserId: string;
  name: string | null;
  role: 'GLOBAL_ADMIN' | 'OWNER';
  organizationId: string | null;
  affiliateProfileId: number | null;
}

export async function requireCrmManager(): Promise<ManagerUser | null> {
  try {
    const session = await getMabizSession();
    if (!session) return null;
    if (session.role !== 'GLOBAL_ADMIN' && session.role !== 'OWNER') return null;

    return {
      id: session.mallUser?.id ?? 0,
      crmUserId: session.userId,
      name: session.mallUser?.name ?? session.member?.displayName ?? null,
      role: session.role as 'GLOBAL_ADMIN' | 'OWNER',
      organizationId: session.organizationId,
      affiliateProfileId: session.mallUser?.affiliateProfileId ?? null,
    };
  } catch (err) {
    logger.error('[passport-auth] Manager 인증 실패', { err });
    return null;
  }
}

// ── Partner 인증 (OWNER = 대리점장) ─────────────────────────

export interface PartnerContext {
  sessionUser: {
    id: number;
    crmUserId: string;
    name: string | null;
    role: string;
  };
  profile: {
    id: number;
    type: string;  // BRANCH_MANAGER | SALES_AGENT | PRESALES | HQ
    managerId: number | null;
  };
  organizationId: string | null;
}

export async function requirePartnerContext(): Promise<PartnerContext | null> {
  try {
    const session = await getMabizSession();
    if (!session) return null;

    // GLOBAL_ADMIN도 파트너 기능 접근 가능 (전체 관리)
    if (session.role === 'GLOBAL_ADMIN') {
      return {
        sessionUser: {
          id: session.mallUser?.id ?? 0,
          crmUserId: session.userId,
          name: session.mallUser?.name ?? null,
          role: 'admin',
        },
        profile: {
          id: 0,
          type: 'ADMIN',
          managerId: null,
        },
        organizationId: session.organizationId,
      };
    }

    // OWNER/AGENT: mallUser에서 AffiliateProfile 확인
    if (!session.mallUser?.affiliateProfileId) return null;

    const profile = await prisma.$queryRaw<Array<{
      id: number;
      type: string;
      managerId: number | null;
    }>>`
      SELECT id, type, "managerId"
      FROM "AffiliateProfile"
      WHERE id = ${session.mallUser.affiliateProfileId}
        AND status = 'ACTIVE'
      LIMIT 1
    `;

    if (!profile[0]) return null;

    return {
      sessionUser: {
        id: session.mallUser.id,
        crmUserId: session.userId,
        name: session.mallUser.name,
        role: session.role === 'OWNER' ? 'affiliate' : 'agent',
      },
      profile: {
        id: profile[0].id,
        type: profile[0].type,
        managerId: profile[0].managerId,
      },
      organizationId: session.organizationId,
    };
  } catch (err) {
    logger.error('[passport-auth] Partner 인증 실패', { err });
    return null;
  }
}

// ── Lead 소유권 검증 (파트너가 이 리드에 접근 가능한지) ──────

export async function canAccessLead(
  partnerCtx: PartnerContext,
  leadId: number
): Promise<boolean> {
  // GLOBAL_ADMIN은 모든 리드 접근 가능
  if (partnerCtx.profile.type === 'ADMIN') return true;

  const lead = await prisma.gmAffiliateLead.findUnique({
    where: { id: leadId },
    select: { managerId: true, agentId: true },
  });

  if (!lead) return false;

  const profileId = partnerCtx.profile.id;

  // BRANCH_MANAGER: 자신이 매니저이거나, 자신의 에이전트가 담당
  if (partnerCtx.profile.type === 'BRANCH_MANAGER') {
    if (lead.managerId === profileId) return true;
    // 소속 에이전트 확인
    const relation = await prisma.gmAffiliateRelation.findFirst({
      where: {
        managerId: profileId,
        agentId: lead.agentId ?? -1,
        status: 'ACTIVE',
      },
    });
    return !!relation;
  }

  // SALES_AGENT: 자신이 직접 담당하는 리드만
  if (partnerCtx.profile.type === 'SALES_AGENT') {
    return lead.agentId === profileId;
  }

  return false;
}

// ── Reservation 소유권 검증 ──────────────────────────────────

export async function canAccessReservation(
  session: MabizAuthContext,
  reservationId: number
): Promise<boolean> {
  if (session.role === 'GLOBAL_ADMIN') return true;

  const reservation = await prisma.gmReservation.findUnique({
    where: { id: reservationId },
    select: { mainUserId: true, affiliateSaleId: true },
  });

  if (!reservation) return false;

  // 고객 본인 확인
  if (session.mallUser?.id === reservation.mainUserId) return true;

  // OWNER: 자기 조직의 AffiliateSale인지 확인
  if (session.role === 'OWNER' && reservation.affiliateSaleId) {
    const sale = await prisma.affiliateSale.findFirst({
      where: {
        orderId: String(reservation.affiliateSaleId),
        organizationId: session.organizationId!,
      },
    });
    return !!sale;
  }

  return false;
}
