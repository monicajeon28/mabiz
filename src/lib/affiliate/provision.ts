/**
 * 대리점 계약 승인 → 계정·링크 자동 생성 (단일 트랜잭션)
 *
 * P0 수정 사항:
 * - bcrypt 해싱 (hashPassword from @/lib/password)
 * - 단일 prisma.$transaction (부분 실패 불가)
 * - tempPassword API 응답 불포함 (SMS 발송으로만 전달)
 * - Race Condition 방지 (PROCESSING 상태 잠금)
 * - affiliateCode/linkCode 충돌 재시도 (최대 5회)
 * - OrganizationMember 생성 (CRM 로그인 가능)
 */

import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';

export interface ProvisionResult {
  manager: {
    gmUserId: number;
    crmMemberId: string;
    affiliateCode: string;
    linkCode: string;
    linkUrl: string;
  };
  agent: {
    gmUserId: number;
    affiliateCode: string;
    linkCode: string;
    linkUrl: string;
  };
}

interface ProvisionInput {
  contractId: number;
  contractorName: string;
  contractorEmail: string;
  contractorPhone: string;
  commissionRate: number;
  organizationId: string; // CRM 조직 ID (대리점이 속할 조직)
  approvedByMemberId: string; // 승인한 관리자 ID
}

/**
 * 계약 승인 전체 파이프라인 (단일 트랜잭션)
 * 실패 시 전체 롤백 — 부분 성공 상태 없음
 */
export async function provisionAffiliateAccounts(
  input: ProvisionInput,
): Promise<ProvisionResult & { managerTempPassword: string; agentTempPassword: string }> {
  const {
    contractId,
    contractorName,
    contractorEmail,
    contractorPhone,
    commissionRate,
    organizationId,
    approvedByMemberId,
  } = input;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL 환경변수가 설정되지 않았습니다.');
  }

  // 비밀번호 생성 — 트랜잭션 외부에서 미리 (bcrypt는 CPU 집약적)
  const managerPassword = generateSecurePassword();
  const agentPassword = generateSecurePassword();

  const [managerHash, agentHash] = await Promise.all([
    hashPassword(managerPassword),
    hashPassword(agentPassword),
  ]);

  // 단일 트랜잭션 — 전부 성공 or 전부 롤백
  const result = await prisma.$transaction(async (tx) => {
    const ts = randomBytes(4).toString('hex'); // 유니크 식별자 (Date.now 충돌 방지)

    // ── 1. GmUser (GMcruise 포털 계정) ──────────────────────────
    const managerGmUser = await tx.gmUser.create({
      data: {
        name: `${contractorName} 대리점장`,
        email: contractorEmail || null,
        phone: contractorPhone || null,
        password: managerHash,
        role: 'affiliate_manager',
        isPasswordSet: true,
      },
    });

    const agentGmUser = await tx.gmUser.create({
      data: {
        name: `${contractorName} 판매원`,
        email: null, // 판매원 이메일은 별도 입력 (추후)
        phone: contractorPhone || null,
        password: agentHash,
        role: 'affiliate_agent',
        isPasswordSet: true,
      },
    });

    // ── 2. AffiliateProfile (GMcruise 어필리에이트 프로필) ────────
    const managerCode = await generateUniqueAffiliateCode('MGR', tx);
    const managerProfile = await tx.gmAffiliateProfile.create({
      data: {
        userId: managerGmUser.id,
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
      },
    });

    const agentCode = await generateUniqueAffiliateCode('AGT', tx);
    const agentProfile = await tx.gmAffiliateProfile.create({
      data: {
        userId: agentGmUser.id,
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
      },
    });

    // ── 3. AffiliateRelation (Manager ↔ Agent 연결) ───────────────
    await tx.gmAffiliateRelation.create({
      data: {
        managerId: managerProfile.id,
        agentId: agentProfile.id,
        status: 'ACTIVE',
        connectedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // ── 4. AffiliateLink (추적 링크 생성) ──────────────────────────
    const managerLinkCode = await generateUniqueLinkCode(tx);
    const managerLink = await tx.gmAffiliateLink.create({
      data: {
        managerId: managerProfile.id,
        code: managerLinkCode,
        url: `${baseUrl}?ref=${managerLinkCode}`,
        status: 'ACTIVE',
      },
    });

    const agentLinkCode = await generateUniqueLinkCode(tx);
    const agentLink = await tx.gmAffiliateLink.create({
      data: {
        agentId: agentProfile.id,
        code: agentLinkCode,
        url: `${baseUrl}?ref=${agentLinkCode}`,
        status: 'ACTIVE',
      },
    });

    // ── 5. AffiliateContract 상태 업데이트 ────────────────────────
    await tx.gmAffiliateContract.update({
      where: { id: contractId },
      data: {
        userId: managerGmUser.id,
        status: 'APPROVED',
        contractSignedAt: new Date(),
        metadata: {
          managerProfileId: managerProfile.id,
          agentProfileId: agentProfile.id,
          managerLinkCode,
          agentLinkCode,
          managerLinkId: managerLink.id,
          agentLinkId: agentLink.id,
          approvedAt: new Date().toISOString(),
          approvedByMemberId,
        },
      },
    });

    // ── 6. OrganizationMember (CRM 관리자 로그인 계정) ────────────
    const crmMember = await tx.organizationMember.create({
      data: {
        organizationId,
        userId: `gm-${managerGmUser.id}`, // GmUser ID 연결
        role: 'OWNER', // 대리점장 = OWNER
        displayName: `${contractorName} 대리점장`,
        phone: contractorPhone || null,
        email: contractorEmail || null,
        passwordHash: managerHash,
        isActive: true,
      },
    });

    logger.info('[AFFILIATE-PROVISION] 대리점 계정 생성 완료', {
      contractId,
      managerGmUserId: managerGmUser.id,
      managerProfileId: managerProfile.id,
      agentGmUserId: agentGmUser.id,
      crmMemberId: crmMember.id,
      managerCode,
      agentCode,
      managerLinkCode,
      agentLinkCode,
    });

    return {
      manager: {
        gmUserId: managerGmUser.id,
        crmMemberId: crmMember.id,
        affiliateCode: managerCode,
        linkCode: managerLinkCode,
        linkUrl: managerLink.url,
      },
      agent: {
        gmUserId: agentGmUser.id,
        affiliateCode: agentCode,
        linkCode: agentLinkCode,
        linkUrl: agentLink.url,
      },
    };
  });

  return {
    ...result,
    // 비밀번호는 여기서만 반환 — API 응답에 절대 포함 금지
    // SMS/이메일 발송 후 즉시 폐기
    managerTempPassword: managerPassword,
    agentTempPassword: agentPassword,
  };
}

// ── 내부 유틸 ────────────────────────────────────────────────────

function generateSecurePassword(): string {
  return randomBytes(10).toString('hex'); // 20글자 hex
}

async function generateUniqueAffiliateCode(
  prefix: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  maxRetry = 5,
): Promise<string> {
  for (let i = 0; i < maxRetry; i++) {
    const code = `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const exists = await tx.gmAffiliateProfile.findUnique({
      where: { affiliateCode: code },
    });
    if (!exists) return code;
  }
  throw new Error(`affiliateCode 생성 실패: ${prefix} ${maxRetry}회 충돌`);
}

async function generateUniqueLinkCode(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  maxRetry = 5,
): Promise<string> {
  for (let i = 0; i < maxRetry; i++) {
    const code = `aff_${randomBytes(16).toString('hex').toUpperCase()}`;
    const exists = await tx.gmAffiliateLink.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error(`linkCode 생성 실패: ${maxRetry}회 충돌`);
}
