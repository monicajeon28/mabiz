import 'server-only';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { UserRole } from '@/lib/rbac';

export const MABIZ_SESSION_COOKIE = 'mabiz.sid';

export interface MabizAuthContext {
  userId: string;          // memberId 또는 adminId
  role: UserRole;
  organizationId: string | null;
  member: {
    id: string;
    organizationId: string;
    role: string;
    displayName: string | null;
  } | null;
}

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

    if (session.adminId) {
      return {
        userId: session.adminId,
        role: 'GLOBAL_ADMIN',
        organizationId: null,
        member: null,
      };
    }

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

    return null;
  } catch (err) {
    logger.error('[getMabizSession]', { err });
    return null;
  }
}
