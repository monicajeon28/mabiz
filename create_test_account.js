const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('0313', 10);
  
  const globalAdmin = await prisma.globalAdmin.create({
    data: {
      phone: '01012345678',
      name: '테스트 어드민',
      passwordHash: hashedPassword,
    },
  });
  
  console.log('✅ 테스트 계정 생성됨:');
  console.log('- 아이디: 01012345678');
  console.log('- 비밀번호: 0313');
  console.log('- 역할: GLOBAL_ADMIN');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
