import 'server-only';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { UserRole } from '@/lib/rbac';

export const MABIZ_SESSION_COOKIE = 'mabiz.sid';

export interface MabizAuthContext {
  userId: string;          // memberId, adminId, 또는 mallUserId 문자열
  role: UserRole;
  organizationId: string | null;
  // GMcruise User 기반 세션일 때 채워짐
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

type RawMallUser = {
  id: number;
  name: string | null;
  mallUserId: string | null;
  affiliateType: string | null;
  affiliateProfileId: number | null;
};

export async function getMabizSession(): Promise<MabizAuthContext | null> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(MABIZ_SESSION_COOKIE)?.value;
    if (!sid) return null;

    const session = await prisma.mabizSession.findUnique({
      where: { id: sid },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.mabizSession.delete({ where: { id: sid } }).catch(() => {});
      return null;
    }

    // GlobalAdmin 세션
    if (session.adminId) {
      return {
        userId: session.adminId,
        role: 'GLOBAL_ADMIN',
        organizationId: null,
        member: null,
      };
    }

    // OrganizationMember 세션
    if (session.memberId && session.organizationId) {
      const member = await prisma.organizationMember.findUnique({
        where: { id: session.memberId },
        select: { id: true, organizationId: true, role: true, displayName: true, isActive: true },
      });

      if (!member || !member.isActive) return null;

      const role: UserRole =
        member.role === 'OWNER'      ? 'OWNER'      :
        member.role === 'FREE_SALES' ? 'FREE_SALES' : 'AGENT';

      return {
        userId: session.memberId,
        role,
        organizationId: member.organizationId,
        member: {
          id: member.id,
          organizationId: member.organizationId,
          role: member.role,
          displayName: member.displayName,
        },
      };
    }

    // GMcruise User 세션 (mallUserId 기반)
    if (session.mallUserId) {
      const rows = await prisma.$queryRawUnsafe<RawMallUser[]>(
        `SELECT u.id, u.name, u."mallUserId",
                ap.type as "affiliateType",
                ap.id as "affiliateProfileId"
         FROM "User" u
         LEFT JOIN "AffiliateProfile" ap ON ap."userId" = u.id AND ap.status = 'ACTIVE'
         WHERE u.id = $1 AND u."isLocked" = false
         LIMIT 1`,
        session.mallUserId
      );

      const mallUser = rows[0];
      if (!mallUser) return null;

      const role = session.role as UserRole;

      return {
        userId: String(session.mallUserId),
        role,
        organizationId: session.organizationId ?? null,
        mallUser: {
          id: mallUser.id,
          name: mallUser.name,
          mallUserId: mallUser.mallUserId,
          affiliateType: mallUser.affiliateType,
          affiliateProfileId: mallUser.affiliateProfileId,
        },
        member: null,
      };
    }

    return null;
  } catch (err) {
    logger.error('[getMabizSession]', { err });
    return null;
  }
}
