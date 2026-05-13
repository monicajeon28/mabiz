import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

/**
 * 계약 완료 후 manager와 agent를 위한 어필리에이트 링크를 자동 생성합니다.
 */
export async function generateAffiliateLinksPair(
  managerId: number,
  agentId: number,
  contractId: number,
) {
  const transaction = await prisma.$transaction(async (tx) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cruiseai.co.kr';

    // 1. manager 링크 생성
    const managerLinkCode = generateLinkCode();
    const managerLink = await tx.affiliateLink.create({
      data: {
        managerId,
        url: `${baseUrl}?ref=${managerLinkCode}`,
        code: managerLinkCode,
        status: 'ACTIVE',
        clickCount: 0,
        conversionCount: 0,
        totalRevenue: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 2. agent 링크 생성
    const agentLinkCode = generateLinkCode();
    const agentLink = await tx.affiliateLink.create({
      data: {
        agentId,
        url: `${baseUrl}?ref=${agentLinkCode}`,
        code: agentLinkCode,
        status: 'ACTIVE',
        clickCount: 0,
        conversionCount: 0,
        totalRevenue: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 3. 계약에 링크 메타데이터 저장
    await tx.affiliateContract.update({
      where: { id: contractId },
      data: {
        metadata: {
          ...(await tx.affiliateContract.findUnique({
            where: { id: contractId },
            select: { metadata: true },
          }))?.metadata,
          managerLinkId: managerLink.id,
          agentLinkId: agentLink.id,
          managerLinkCode,
          agentLinkCode,
        },
      },
    });

    logger.info('[AFFILIATE-AUTO] 어필리에이트 링크 생성 완료', {
      contractId,
      managerLinkId: managerLink.id,
      managerLinkCode,
      agentLinkId: agentLink.id,
      agentLinkCode,
    });

    return {
      manager: {
        linkId: managerLink.id,
        code: managerLinkCode,
        url: managerLink.url,
      },
      agent: {
        linkId: agentLink.id,
        code: agentLinkCode,
        url: agentLink.url,
      },
    };
  });

  return transaction;
}

/**
 * 어필리에이트 링크 코드 생성
 * 형식: aff_XXXXXXXXXXXXXXXX (16글자 난수)
 */
function generateLinkCode(): string {
  const random = randomBytes(12).toString('hex').substring(0, 16);
  return `aff_${random.toUpperCase()}`;
}
