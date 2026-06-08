import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 랜딩페이지 + 결제 설정 + 그룹 연결 확인
  const pages = await prisma.crmLandingPage.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      isActive: true,
      paymentEnabled: true,
      paymentType: true,
      productName: true,
      productPrice: true,
      cycleDay: true,
      expireDate: true,
      groupId: true,
      group: { select: { name: true } },
      pageGroup: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n━━━ 랜딩페이지 결제 연결 현황 ━━━\n');
  for (const p of pages) {
    const hasPay = !!p.paymentEnabled;
    const hasGroup = !!p.groupId;
    const status = !p.isActive ? '🔴 비활성' : hasPay && hasGroup ? '✅ 완전 연결' : hasPay && !hasGroup ? '⚠️  결제있음/그룹없음' : !hasPay && hasGroup ? '⬜ 그룹있음/결제없음' : '⬜ 미설정';

    console.log(`${status} | ${p.slug}`);
    console.log(`  제목: ${p.title ?? '(없음)'}`);
    console.log(`  결제: ${hasPay ? `${p.productName} ${p.productPrice?.toLocaleString()}원 (${p.paymentType})` : '없음'}`);
    console.log(`  그룹: ${p.group?.name ?? '미연결'} (pageGroup: ${p.pageGroup ?? 'null'})`);
    console.log('');
  }

  // 최근 결제 완료 건 확인
  const recentPaid = await prisma.payAppPayment.findMany({
    where: { status: 'paid' },
    select: { orderId: true, customerName: true, customerPhone: true, amount: true, paidAt: true, landingPageId: true },
    orderBy: { paidAt: 'desc' },
    take: 5,
  });

  console.log('━━━ 최근 결제완료 5건 ━━━\n');
  if (recentPaid.length === 0) {
    console.log('결제 완료 건 없음\n');
  } else {
    for (const p of recentPaid) {
      console.log(`  ${p.paidAt?.toLocaleDateString('ko-KR')} | ${p.customerName} | ${p.amount?.toLocaleString()}원 | 랜딩: ${p.landingPageId ?? '없음'}`);
    }
  }

  // Contact 중 type=CUSTOMER 이면서 channel=b2b 최근 5건
  const recentBuyers = await prisma.contact.findMany({
    where: { type: 'CUSTOMER', channel: 'b2b' },
    select: { name: true, phone: true, purchasedAt: true, groups: { select: { group: { select: { name: true } } } } },
    orderBy: { purchasedAt: 'desc' },
    take: 5,
  });

  console.log('\n━━━ 최근 B2B 구매자 5명 (Contact) ━━━\n');
  if (recentBuyers.length === 0) {
    console.log('없음\n');
  } else {
    for (const c of recentBuyers) {
      const groups = c.groups.map(g => g.group.name).join(', ') || '그룹 없음';
      console.log(`  ${c.name} | ${c.phone.slice(0, 4)}*** | ${c.purchasedAt?.toLocaleDateString('ko-KR')} | 그룹: ${groups}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
