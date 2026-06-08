import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // CruiseProductInquiry 컬럼 확인
  const cols = await prisma.$queryRaw(
    Prisma.sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'CruiseProductInquiry' ORDER BY column_name`
  ) as { column_name: string }[];
  console.log('CruiseProductInquiry 컬럼:');
  cols.forEach(c => console.log(' -', c.column_name));

  // agentId, managerId 있는지 확인
  const hasAgent = cols.some(c => c.column_name === 'agentId');
  const hasMgr = cols.some(c => c.column_name === 'managerId');
  console.log('\nagentId 있음:', hasAgent);
  console.log('managerId 있음:', hasMgr);

  // 실제 쿼리 테스트
  const test = await prisma.$queryRaw(
    Prisma.sql`SELECT id, "agentId", "managerId", "productCode", status FROM "CruiseProductInquiry" WHERE "productCode" LIKE '%GOLD%' LIMIT 3`
  ) as { id: number; agentId: number|null; managerId: number|null; productCode: string; status: string }[];
  console.log('\nGOLD 문의 샘플:', test.length, '건');
  test.forEach(r => console.log(' ', JSON.stringify(r)));
}
main().catch(e => console.error('에러:', e.message)).finally(() => prisma.$disconnect());
