import { getMabizSession } from '@/lib/auth';

export async function getOrgId(): Promise<string> {
  const session = await getMabizSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (!session.organizationId) throw new Error('NO_ORGANIZATION');
  return session.organizationId;
}

export async function getOrgIdSafe(): Promise<string | null> {
  try {
    return await getOrgId();
  } catch {
    return null;
  }
}
