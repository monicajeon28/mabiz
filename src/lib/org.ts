import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * @deprecated GLOBAL_ADMIN 환경에서는 getAuthContext() + ctx 기반 분기(rbac.ts)를 사용하세요.
 * getOrgId()는 GLOBAL_ADMIN에게 비결정적 org를 반환할 수 있습니다.
 * 새로 작성하는 API route에서는 이 함수를 호출하지 마세요.
 */
export async function getOrgId(): Promise<string> {
  const session = await getMabizSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (session.organizationId) return session.organizationId;
  // GLOBAL_ADMIN은 organizationId가 null — BONSA_ORG_ID 우선, 없으면 가장 오래된 조직
  if (session.role === 'GLOBAL_ADMIN') {
    if (process.env.BONSA_ORG_ID) return process.env.BONSA_ORG_ID;
    const firstOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
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
