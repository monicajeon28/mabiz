/**
 * seed-global-admin.js
 *
 * CRM GlobalAdmin 계정을 초기화합니다.
 * 이미 존재하면 아무것도 하지 않습니다.
 *
 * 실행:
 *   node scripts/seed-global-admin.js
 *
 * 환경변수 (.env.local 또는 .env):
 *   DATABASE_URL, ADMIN_PHONE, ADMIN_PASSWORD
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ADMIN_PHONE    = process.env.ADMIN_PHONE    || '01032893800';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_QUICK_PASSWORD || 'temp123';
const ADMIN_NAME     = process.env.ADMIN_NAME     || '크루즈닷 관리자';

async function main() {
  console.log('🌱 GlobalAdmin 시드 시작...');

  const existing = await prisma.globalAdmin.findFirst({
    where: { phone: ADMIN_PHONE },
  });

  if (existing) {
    console.log(`✅ 이미 존재합니다 (id=${existing.id}, phone=${existing.phone}). 변경 없이 종료.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.globalAdmin.create({
    data: {
      phone:        ADMIN_PHONE,
      passwordHash,
      displayName:  ADMIN_NAME,
    },
  });

  console.log(`✅ GlobalAdmin 생성 완료 (id=${admin.id}, phone=${admin.phone})`);
  console.log(`   비밀번호: ${ADMIN_PASSWORD}  ← 반드시 변경하세요!`);
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
