import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

/**
 * 대리점장(manager)과 판매원(agent) 계정을 자동으로 생성합니다.
 * 계약 완료 시에만 호출됩니다.
 */
export async function createAffiliateAccountPair(
  contractId: number,
  contractorName: string,
  contractorEmail: string,
  contractorPhone: string,
  commissionRate: number,
) {
  const transaction = await prisma.$transaction(async (tx) => {
    // 1. manager (대리점장) User 생성
    const managerPassword = generateRandomPassword();
    const managerUser = await tx.user.create({
      data: {
        email: `manager-${contractId}-${Date.now()}@cruiseai.local`,
        name: `${contractorName} 대리점장`,
        phone: contractorPhone,
        role: 'AFFILIATE_MANAGER',
        passwordHash: await hashPassword(managerPassword),
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 2. manager AffiliateProfile 생성
    const managerCode = generateAffiliateCode('MGR');
    const managerProfile = await tx.affiliateProfile.create({
      data: {
        userId: managerUser.id,
        type: 'MANAGER',
        status: 'ACTIVE',
        contractStatus: 'SIGNED',
        displayName: `${contractorName} 대리점`,
        contactPhone: contractorPhone,
        contactEmail: contractorEmail,
        affiliateCode: managerCode,
        agentCommissionRate: commissionRate,
        contractSignedAt: new Date(),
        onboardedAt: new Date(),
        publishedAt: new Date(),
        welcomeEmailSentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 3. agent (판매원) User 생성
    const agentPassword = generateRandomPassword();
    const agentUser = await tx.user.create({
      data: {
        email: `agent-${contractId}-${Date.now()}@cruiseai.local`,
        name: `${contractorName} 판매원`,
        phone: contractorPhone,
        role: 'AFFILIATE_AGENT',
        passwordHash: await hashPassword(agentPassword),
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 4. agent AffiliateProfile 생성
    const agentCode = generateAffiliateCode('AGT');
    const agentProfile = await tx.affiliateProfile.create({
      data: {
        userId: agentUser.id,
        type: 'AGENT',
        status: 'ACTIVE',
        contractStatus: 'SIGNED',
        displayName: `${contractorName} 판매원`,
        contactPhone: contractorPhone,
        contactEmail: contractorEmail,
        affiliateCode: agentCode,
        guarantorId: managerProfile.id,
        contractSignedAt: new Date(),
        onboardedAt: new Date(),
        publishedAt: new Date(),
        welcomeEmailSentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 5. manager ↔ agent 관계 생성
    await tx.affiliateRelation.create({
      data: {
        managerId: managerProfile.id,
        agentId: agentProfile.id,
        status: 'ACTIVE',
        connectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 6. 계약과 manager 연결
    await tx.affiliateContract.update({
      where: { id: contractId },
      data: {
        userId: managerUser.id,
        status: 'APPROVED',
        contractSignedAt: new Date(),
      },
    });

    logger.info('[AFFILIATE-AUTO] 계정 쌍 생성 완료', {
      contractId,
      managerId: managerProfile.id,
      agentId: agentProfile.id,
      managerCode,
      agentCode,
    });

    return {
      manager: {
        user: managerUser,
        profile: managerProfile,
        password: managerPassword,
        affiliateCode: managerCode,
      },
      agent: {
        user: agentUser,
        profile: agentProfile,
        password: agentPassword,
        affiliateCode: agentCode,
      },
    };
  });

  return transaction;
}

/**
 * 난수 비밀번호 생성 (16글자)
 */
function generateRandomPassword(): string {
  return randomBytes(12).toString('hex').substring(0, 16);
}

/**
 * 어필리에이트 코드 생성
 * 형식: PREFIX-XXXXXXXX (8글자 난수)
 */
function generateAffiliateCode(prefix: string): string {
  const randomPart = randomBytes(6).toString('hex').substring(0, 8);
  return `${prefix}-${randomPart.toUpperCase()}`;
}

/**
 * 비밀번호 해시 (실제 구현은 bcrypt 권장)
 */
async function hashPassword(password: string): Promise<string> {
  // TODO: bcryptjs 사용 권장
  // import bcrypt from 'bcryptjs';
  // return bcrypt.hash(password, 10);

  // 임시: 간단한 해시
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}
