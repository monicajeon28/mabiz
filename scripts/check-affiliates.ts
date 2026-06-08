import prisma from '../src/lib/prisma';

async function main() {
  const profiles = await prisma.gmAffiliateProfile.findMany({
    where: { type: 'BRANCH_MANAGER' },
    select: { id: true, userId: true, affiliateCode: true, displayName: true, contactPhone: true, status: true },
  });

  for (const p of profiles) {
    const gmUser = await prisma.gmUser.findUnique({
      where: { id: p.userId },
      select: { id: true, name: true, phone: true, email: true, role: true },
    });
    console.log(`[${p.displayName ?? '-'}] code=${p.affiliateCode} userId=${p.userId}`);
    console.log(`  GmUser: name=${gmUser?.name} phone=${gmUser?.phone} email=${gmUser?.email}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
