import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Reservation, Traveler 테이블 존재 확인
  const tables = await prisma.$queryRaw(
    Prisma.sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Trip','Reservation','Traveler') ORDER BY table_name`
  ) as { table_name: string }[];
  console.log('존재 테이블:', tables.map(t => t.table_name).join(', '));

  // Traveler 컬럼 확인 (APIS 필드)
  const travelerCols = await prisma.$queryRaw(
    Prisma.sql`SELECT column_name FROM information_schema.columns WHERE table_name='Traveler' ORDER BY column_name`
  ) as { column_name: string }[];
  console.log('Traveler 컬럼:', travelerCols.map(c => c.column_name).join(', '));

  // Reservation 컬럼
  const resCols = await prisma.$queryRaw(
    Prisma.sql`SELECT column_name FROM information_schema.columns WHERE table_name='Reservation' AND column_name IN ('pnrNumber','cabinType','airlineName','agentName') ORDER BY column_name`
  ) as { column_name: string }[];
  console.log('Reservation 핵심컬럼:', resCols.map(c => c.column_name).join(', '));

  // 실제 쿼리 테스트 (apis-by-trip과 동일)
  try {
    const test = await prisma.$queryRaw(Prisma.sql`
      SELECT tr.id, r."pnrNumber", tr."passportNo"
      FROM "Traveler" tr JOIN "Reservation" r ON r.id = tr."reservationId"
      LIMIT 1
    `) as unknown[];
    console.log('\nJOIN 쿼리 성공:', test.length, '건');
  } catch (e) {
    console.log('\nJOIN 쿼리 실패:', (e as Error).message);
  }
}
main().catch(e => console.error('에러:', e.message)).finally(() => prisma.$disconnect());
