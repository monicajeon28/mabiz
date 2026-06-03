import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 전체 상태 분포
const stats = await prisma.$queryRaw`
  SELECT status, COUNT(*) as cnt
  FROM "AffiliateContract"
  GROUP BY status
  ORDER BY cnt DESC
`;
console.log('\n계약 상태 현황:');
stats.forEach(s => console.log(`  ${s.status}: ${s.cnt}건`));

// 최근 계약 10건 (모든 상태)
const recent = await prisma.gmAffiliateContract.findMany({
  select: { id: true, name: true, email: true, phone: true, status: true, submittedAt: true },
  orderBy: { submittedAt: 'desc' },
  take: 10
});
console.log('\n최근 계약 10건:');
recent.forEach(c => {
  console.log(`  ID: ${c.id} | ${c.name} | ${c.status} | ${c.submittedAt?.toISOString().slice(0,10)}`);
});

await prisma.$disconnect();
