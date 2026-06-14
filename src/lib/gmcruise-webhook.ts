import prisma from '@/lib/prisma';

type PrismaClientLike = typeof prisma;

export async function resolveGmcruiseWebhookContext(
  db: PrismaClientLike,
  affiliateCode?: string | null,
  defaultOrganizationId?: string | null
): Promise<{
  organizationId: string | null;
  contact: { id: string } | null;
  affiliateContact: { id: string } | null;
}> {
  let organizationId: string | null = null;

  if (affiliateCode) {
    const existingSale = await db.affiliateSale.findFirst({
      where: { affiliateCode },
      select: { organizationId: true },
      orderBy: { createdAt: 'desc' },
    });
    organizationId = existingSale?.organizationId ?? null;

    if (!organizationId) {
      const existingContact = await db.contact.findFirst({
        where: { affiliateCode },
        select: { organizationId: true },
        orderBy: { createdAt: 'desc' },
      });
      organizationId = existingContact?.organizationId ?? null;
    }
  }

  if (!organizationId) {
    organizationId = defaultOrganizationId ?? null;
  }

  let contact: { id: string } | null = null;
  if (organizationId && affiliateCode) {
    contact = await db.contact.findFirst({
      where: { affiliateCode, organizationId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  return { organizationId, contact, affiliateContact: contact };
}
