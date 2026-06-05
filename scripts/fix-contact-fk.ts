import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('FK 제약 수정 중...');

  await prisma.$executeRawUnsafe(`ALTER TABLE "ShortLink" DROP CONSTRAINT IF EXISTS "ShortLink_contactId_fkey"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  console.log('✅ ShortLink FK 수정 완료');

  await prisma.$executeRawUnsafe(`ALTER TABLE "ShortLinkClick" DROP CONSTRAINT IF EXISTS "ShortLinkClick_contactId_fkey"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShortLinkClick" ADD CONSTRAINT "ShortLinkClick_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  console.log('✅ ShortLinkClick FK 수정 완료');

  await prisma.$executeRawUnsafe(`ALTER TABLE "SalesDocument" DROP CONSTRAINT IF EXISTS "SalesDocument_contactId_fkey"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  console.log('✅ SalesDocument FK 수정 완료');

  console.log('모든 FK 제약 수정 완료!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
