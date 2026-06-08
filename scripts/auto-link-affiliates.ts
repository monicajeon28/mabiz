/**
 * 미연결 BRANCH_MANAGER → OrganizationMember(OWNER) 일괄 생성
 * 실행: npx dotenvx run -- npx tsx scripts/auto-link-affiliates.ts
 */
import prisma from '../src/lib/prisma';

async function main() {
  const BONSA_ORG_ID = process.env.BONSA_ORG_ID ?? '';
  if (!BONSA_ORG_ID) throw new Error('BONSA_ORG_ID 환경변수 없음');

  const linked = await prisma.organizationMember.findMany({
    where: { userId: { startsWith: 'gm-' } },
    select: { userId: true },
  });
  const linkedSet = new Set(linked.map((m) => m.userId));

  const profiles = await prisma.gmAffiliateProfile.findMany({
    where: { type: 'BRANCH_MANAGER', status: 'ACTIVE' },
    select: { id: true, userId: true, affiliateCode: true, displayName: true, contactPhone: true, contactEmail: true },
  });

  console.log(`대상 BRANCH_MANAGER: ${profiles.length}명`);

  for (const p of profiles) {
    const gmKey = `gm-${p.userId}`;
    if (linkedSet.has(gmKey)) {
      console.log(`  SKIP  ${p.displayName} (${p.affiliateCode}) — 이미 연결됨`);
      continue;
    }
    const gmUser = await prisma.gmUser.findUnique({ where: { id: p.userId } });
    if (!gmUser) {
      console.log(`  ERROR ${p.displayName} (${p.affiliateCode}) — GmUser 없음`);
      continue;
    }
    await prisma.organizationMember.create({
      data: {
        organizationId: BONSA_ORG_ID,
        userId: gmKey,
        role: 'OWNER',
        displayName: p.displayName ?? gmUser.name ?? '대리점장',
        phone: p.contactPhone ?? gmUser.phone ?? null,
        email: p.contactEmail ?? gmUser.email ?? null,
        passwordHash: gmUser.password,
        isActive: true,
      },
    });
    console.log(`  OK    ${p.displayName} (${p.affiliateCode}) phone:${p.contactPhone ?? gmUser.phone ?? '-'}`);
  }

  console.log('\n완료');
}

main().catch(console.error).finally(() => prisma.$disconnect());
