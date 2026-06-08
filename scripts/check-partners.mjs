import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // OrganizationMember 전체 OWNER 목록
  console.log('=== 전체 OWNER(대리점장) 계정 ===');
  const owners = await prisma.organizationMember.findMany({
    where: { role: 'OWNER' },
    select: { id: true, displayName: true, role: true, isActive: true },
    take: 20,
  });
  owners.forEach(o => console.log(` - ${o.displayName ?? '(이름없음)'}  active:${o.isActive}`));

  console.log('\n=== 전체 AGENT(소속판매원) 계정 (최근 10건) ===');
  const agents = await prisma.organizationMember.findMany({
    where: { role: 'AGENT' },
    select: { id: true, displayName: true, role: true, isActive: true },
    orderBy: { id: 'desc' },
    take: 10,
  });
  agents.forEach(a => console.log(` - ${a.displayName ?? '(이름없음)'}  active:${a.isActive}`));

  console.log('\n=== GmUser AGENT 계정 (크루즈닷몰, 최근 10건) ===');
  const gmAgents = await prisma.$queryRawUnsafe(
    `SELECT id, name, email, role FROM "User" WHERE role IN ('agent','owner','대리점장','AGENT','OWNER') ORDER BY id DESC LIMIT 10`
  );
  const arr = Array.isArray(gmAgents) ? gmAgents : [];
  arr.forEach(u => console.log(` - ${u.name}(${u.email}) role:${u.role}`));

  console.log('\n=== OrganizationMember 전체 수 ===');
  const total = await prisma.organizationMember.count();
  console.log(`총 ${total}명`);
}

main()
  .catch(e => { console.error('에러:', e.message); })
  .finally(() => prisma.$disconnect());
