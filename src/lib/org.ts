import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function getOrgId(): Promise<string> {
  const session = await getMabizSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (session.organizationId) return session.organizationId;
  // GLOBAL_ADMIN은 organizationId가 null — 첫 번째 조직 사용
  if (session.role === 'GLOBAL_ADMIN') {
    const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
    if (!firstOrg) throw new Error('NO_ORGANIZATION');
    return firstOrg.id;
  }
  throw new Error('NO_ORGANIZATION');
}

export async function getOrgIdSafe(): Promise<string | null> {
  try {
    return await getOrgId();
  } catch {
    return null;
  }
}
