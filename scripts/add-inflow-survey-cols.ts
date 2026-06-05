import prisma from '../src/lib/prisma';

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "inflowDate" TIMESTAMP(3)`);
  console.log('inflowDate 추가 완료');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "surveyData" JSONB`);
  console.log('surveyData 추가 완료');

  const cols = await prisma.$queryRawUnsafe<Array<{column_name: string; data_type: string}>>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Contact' AND column_name IN ('inflowDate','surveyData')`
  );
  console.log('확인:', JSON.stringify(cols));
}

main().catch(console.error).finally(() => prisma.$disconnect());
