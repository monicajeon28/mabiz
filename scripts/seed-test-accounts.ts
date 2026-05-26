/**
 * Seed Test Accounts
 * 로컬 테스트용 계정을 자동 생성합니다.
 *
 * 사용법:
 *   npx ts-node scripts/seed-test-accounts.ts
 */

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

interface TestAccount {
  phone: string;
  password: string;
  displayName: string;
  type: 'admin' | 'member';
  role?: string;
}

const TEST_ACCOUNTS: TestAccount[] = [
  // GlobalAdmin 계정
  {
    phone: 'admin1',
    password: '0313',
    displayName: '관리자 1',
    type: 'admin',
  },
  {
    phone: 'admin2',
    password: '0313',
    displayName: '관리자 2',
    type: 'admin',
  },
  // OrganizationMember 계정
  {
    phone: 'boss1',
    password: '1101',
    displayName: '대리점장 1',
    type: 'member',
    role: 'OWNER',
  },
  {
    phone: 'sales1',
    password: '1101',
    displayName: '판매원 1',
    type: 'member',
    role: 'AGENT',
  },
  {
    phone: 'pre1',
    password: '1101',
    displayName: '프리세일즈 1',
    type: 'member',
    role: 'FREE_SALES',
  },
];

async function main() {
  try {
    console.log('🌱 테스트 계정 생성 시작...\n');

    // GlobalAdmin 계정 생성
    const adminAccounts = TEST_ACCOUNTS.filter(a => a.type === 'admin');
    for (const account of adminAccounts) {
      const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

      const existing = await prisma.globalAdmin.findFirst({
        where: { phone: account.phone },
      });

      if (existing) {
        console.log(`✓ GlobalAdmin 이미 존재: ${account.phone}`);
        continue;
      }

      const admin = await prisma.globalAdmin.create({
        data: {
          phone: account.phone,
          passwordHash,
          displayName: account.displayName,
        },
      });

      console.log(`✓ GlobalAdmin 생성: ${account.phone} (${account.displayName})`);
    }

    console.log('');

    // OrganizationMember 계정 생성을 위해 먼저 테스트용 Organization 확인
    let testOrg = await prisma.organization.findFirst({
      where: { name: 'Test Organization' },
    });

    if (!testOrg) {
      testOrg = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
        },
      });
      console.log(`✓ 테스트 조직 생성: ${testOrg.name} (ID: ${testOrg.id})\n`);
    } else {
      console.log(`✓ 테스트 조직 이미 존재: ${testOrg.name} (ID: ${testOrg.id})\n`);
    }

    // OrganizationMember 계정 생성
    const memberAccounts = TEST_ACCOUNTS.filter(a => a.type === 'member');
    for (const account of memberAccounts) {
      const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

      const existing = await prisma.organizationMember.findFirst({
        where: {
          organizationId: testOrg.id,
          phone: account.phone,
        },
      });

      if (existing) {
        console.log(`✓ OrganizationMember 이미 존재: ${account.phone} (역할: ${account.role})`);
        continue;
      }

      const member = await prisma.organizationMember.create({
        data: {
          organizationId: testOrg.id,
          userId: `user_${account.phone}`,
          phone: account.phone,
          passwordHash,
          displayName: account.displayName,
          role: account.role || 'AGENT',
          isActive: true,
        },
      });

      console.log(`✓ OrganizationMember 생성: ${account.phone} (${account.displayName}, 역할: ${account.role})`);
    }

    console.log('\n✅ 테스트 계정 생성 완료!\n');
    console.log('🔐 로그인 테스트:');
    console.log('  - GlobalAdmin: admin1 / 0313, admin2 / 0313');
    console.log('  - OrganizationMember: boss1 / 1101, sales1 / 1101, pre1 / 1101');
    console.log('\n');

  } catch (error) {
    console.error('❌ 에러:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
