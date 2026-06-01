const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('=== CommissionLedger 조회 ===');
    const ledgers = await prisma.commissionLedger.findMany({
      take: 5,
      select: { id: true, amount: true, isSettled: true, createdAt: true }
    });
    console.log(`총 ${ledgers.length}개 항목:`);
    ledgers.forEach(l => console.log(`  - ID: ${l.id}, Amount: ${l.amount}, Settled: ${l.isSettled}`));

    console.log('\n=== MonthlySettlement 최신 3개 ===');
    const settlements = await prisma.monthlySettlement.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' }
    });
    console.log(`총 ${settlements.length}개 settlement:`);
    settlements.forEach(s => {
      console.log(`  - ID: ${s.id}, Period: ${s.periodStart.toISOString()} ~ ${s.periodEnd.toISOString()}`);
      console.log(`    Status: ${s.status}, Summary:`, JSON.stringify(s.summary));
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
