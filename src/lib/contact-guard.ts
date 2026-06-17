import 'server-only';
import prisma from '@/lib/prisma';

/**
 * 주어진 전화번호가 해당 조직의 직원(OrganizationMember) 번호인지 확인한다.
 * true = 직원 번호 → Contact 생성 차단
 * false = 고객 번호 → 정상 등록 허용
 */
export async function isStaffPhone(
  phone: string,
  organizationId: string
): Promise<boolean> {
  if (!phone || !organizationId) return false;
  const found = await prisma.organizationMember.findFirst({
    where: { phone, organizationId },
    select: { id: true },
  });
  return found !== null;
}
