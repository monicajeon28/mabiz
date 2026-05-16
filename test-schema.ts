import prisma from '@/lib/prisma';

async function main() {
  try {
    const tables = await prisma.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'Gm%'
      ORDER BY table_name
    `;

    console.log('📋 Gm* 테이블:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
  } catch (e) {
    console.error('❌', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
