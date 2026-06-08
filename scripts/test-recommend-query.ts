import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. CallLog 거절 집계 (전체 — userId 무관 테스트)
  const objCount = await prisma.callLog.count({
    where: {
      createdAt: { gte: weekAgo },
      OR: [
        { customerReaction: 'negative' },
        { result: { in: ['REJECTED', '거절', 'PENDING', '보류'] } },
        { objectionId: { not: null } },
      ],
    },
  });
  console.log('✅ 최근7일 거절·이의 콜:', objCount, '건');

  // 2. 출발 임박 고객 (전체)
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dep = await prisma.contact.count({
    where: { deletedAt: null, departureDate: { gte: now, lte: in7 } },
  });
  console.log('✅ 출발임박(7일내) 고객:', dep, '명');

  // 3. 세그먼트 groupBy
  const seg = await prisma.contact.groupBy({
    by: ['autoSegment'],
    where: { deletedAt: null, autoSegment: { not: null } },
    _count: { autoSegment: true },
    orderBy: { _count: { autoSegment: 'desc' } },
    take: 3,
  });
  console.log('✅ 세그먼트 분포 top3:', JSON.stringify(seg));

  console.log('\n모든 쿼리 정상 실행 — 런타임 에러 없음');
}
main().catch(e => console.error('❌ 쿼리 실패:', e.message)).finally(() => prisma.$disconnect());
