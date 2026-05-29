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
 *
 * Phase 4 수정:
 * - partnerId 자동 생성 (boss1, boss2... / sales1, sales2...)
 * - 비밀번호 1101로 통일 (GMcruise 동기화)
 * - Neon + Supabase 자동 동기화
 */

import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';
import pg from 'pg';

const { Client: PgClient } = pg;

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
  organizationId: string; // CRM 조직 ID (대리점이 속할 조직)
  approvedByMemberId: string; // 승인한 관리자 ID
  managerId?: number; // 담당 매니저 ID (선택사항)
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
    organizationId,
    approvedByMemberId,
  } = input;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL 환경변수가 설정되지 않았습니다.');
  }

  // Phase 4: 비밀번호 1101로 통일 (GMcruise 동기화)
  const sharedPassword = '1101';
  const passwordHash = await hashPassword(sharedPassword);

  // 단일 트랜잭션 — 전부 성공 or 전부 롤백
  const result = await prisma.$transaction(async (tx) => {
    const ts = randomBytes(4).toString('hex'); // 유니크 식별자 (Date.now 충돌 방지)

    // Phase 4: partnerId 자동 생성 (boss1, boss2... / sales1, sales2...)
    const managerPartnerId = await generateUniquePartnerId('boss', tx);
    const agentPartnerId = await generateUniquePartnerId('sales', tx);

    // ── 1. GmUser (GMcruise 포털 계정) ──────────────────────────
    const managerGmUser = await tx.gmUser.create({
      data: {
        name: `${contractorName} 대리점장`,
        email: contractorEmail || null,
        phone: managerPartnerId, // Phase 4: partnerId를 phone에 저장
        password: passwordHash,
        role: 'affiliate_manager',
        isPasswordSet: true,
      },
    });

    const agentGmUser = await tx.gmUser.create({
      data: {
        name: `${contractorName} 판매원`,
        email: null,
        phone: agentPartnerId, // Phase 4: partnerId를 phone에 저장
        password: passwordHash,
        role: 'affiliate_agent',
        isPasswordSet: true,
      },
    });

    // ── 2. AffiliateProfile (GMcruise 어필리에이트 프로필) ────────
    const managerCode = await generateUniqueAffiliateCode('MGR', tx);
    const managerProfile = await tx.gmAffiliateProfile.create({
      data: {
        userId: managerGmUser.id,
        type: 'BRANCH_MANAGER',
        status: 'ACTIVE',
        contractStatus: 'SIGNED',
        displayName: `${contractorName} 대리점`,
        contactPhone: contractorPhone,
        contactEmail: contractorEmail,
        affiliateCode: managerCode,
        agentCommissionRate: null, // 수수료율은 상품별 별도 관리
        contractSignedAt: new Date(),
        onboardedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    const agentCode = await generateUniqueAffiliateCode('AGT', tx);
    const agentProfile = await tx.gmAffiliateProfile.create({
      data: {
        userId: agentGmUser.id,
        type: 'SALES_AGENT',
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
        status: 'ACTIVE',
        issuedById: managerGmUser.id,
      },
    });

    const agentLinkCode = await generateUniqueLinkCode(tx);
    const agentLink = await tx.gmAffiliateLink.create({
      data: {
        agentId: agentProfile.id,
        code: agentLinkCode,
        status: 'ACTIVE',
        issuedById: agentGmUser.id,
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
        passwordHash: passwordHash, // bcrypt 해시된 비밀번호
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
      managerPartnerId,
      agentPartnerId,
      manager: {
        gmUserId: managerGmUser.id,
        crmMemberId: crmMember.id,
        affiliateCode: managerCode,
        linkCode: managerLinkCode,
        linkUrl: `${baseUrl}?ref=${managerLinkCode}`,
      },
      agent: {
        gmUserId: agentGmUser.id,
        affiliateCode: agentCode,
        linkCode: agentLinkCode,
        linkUrl: `${baseUrl}?ref=${agentLinkCode}`,
      },
    };
  });

  // Phase 4: Supabase 자동 동기화 (백업) — DLQ 기반 재시도
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL;
  if (!supabaseUrl) {
    logger.warn('[AFFILIATE-PROVISION] SUPABASE_BACKUP_URL 미설정 — 동기화 스킵');
  } else {
    try {
      const supabaseClient = new PgClient({ connectionString: supabaseUrl });
      await supabaseClient.connect();

      // Manager 동기화 시도
      try {
        await supabaseClient.query(`
          INSERT INTO "User" (
            id, phone, password, name, role, email, "mallUserId", "isLocked",
            "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            phone = $2, password = $3, name = $4, role = $5, email = $6,
            "isLocked" = $8, "updatedAt" = NOW()
        `, [
          result.manager.gmUserId,
          result.managerPartnerId,
          passwordHash,
          `${contractorName} 대리점장`,
          'affiliate_manager',
          contractorEmail || null,
          null,
          false,
        ]);
        logger.log('[AFFILIATE-PROVISION] ✅ Manager Supabase 동기화 성공', {
          gmUserId: result.manager.gmUserId,
          partnerId: result.managerPartnerId,
        });
      } catch (managerErr) {
        const errMsg = managerErr instanceof Error ? managerErr.message : String(managerErr);
        const dlq = await prisma.syncDeadLetterQueue.create({
          data: {
            syncType: 'NEON_TO_SUPABASE',
            operationType: 'INSERT_OR_UPDATE',
            tableName: 'User',
            recordId: String(result.manager.gmUserId),
            data: { gmUserId: result.manager.gmUserId, partnerId: result.managerPartnerId, name: `${contractorName} 대리점장`, passwordHash },
            error: errMsg,
            nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
            status: 'PENDING',
          },
        });
        logger.warn('[AFFILIATE-PROVISION] ❌ Manager Supabase 동기화 실패 → DLQ 기록', {
          gmUserId: result.manager.gmUserId,
          dlqId: dlq.id,
          error: errMsg,
        });
      }

      // Agent 동기화 시도
      try {
        await supabaseClient.query(`
          INSERT INTO "User" (
            id, phone, password, name, role, email, "mallUserId", "isLocked",
            "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            phone = $2, password = $3, name = $4, role = $5, email = $6,
            "isLocked" = $8, "updatedAt" = NOW()
        `, [
          result.agent.gmUserId,
          result.agentPartnerId,
          passwordHash,
          `${contractorName} 판매원`,
          'affiliate_agent',
          null,
          null,
          false,
        ]);
        logger.log('[AFFILIATE-PROVISION] ✅ Agent Supabase 동기화 성공', {
          gmUserId: result.agent.gmUserId,
          partnerId: result.agentPartnerId,
        });
      } catch (agentErr) {
        const errMsg = agentErr instanceof Error ? agentErr.message : String(agentErr);
        const dlqData = {
          agentGmUserId: result.agent.gmUserId,
          partnerId: result.agentPartnerId,
          name: `${contractorName} 판매원`,
          error: errMsg,
        };
        const dlq = await prisma.syncDeadLetterQueue.create({
          data: {
            syncType: 'NEON_TO_SUPABASE',
            operationType: 'INSERT_OR_UPDATE',
            tableName: 'User',
            recordId: String(result.agent.gmUserId),
            data: dlqData,
            error: errMsg,
            nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
            status: 'PENDING',
          },
        });
        logger.warn('[AFFILIATE-PROVISION] ❌ Agent Supabase 동기화 실패 → DLQ 기록', {
          gmUserId: result.agent.gmUserId,
          dlqId: dlq.id,
          error: errMsg,
        });
      }

      await supabaseClient.end();
    } catch (err) {
      logger.error('[AFFILIATE-PROVISION] ❌ Supabase 네트워크 오류 — 동기화 전체 실패', {
        error: err instanceof Error ? err.message : String(err),
        managerGmUserId: result.manager.gmUserId,
        agentGmUserId: result.agent.gmUserId,
      });
    }
  }

  return {
    ...result,
    managerTempPassword: sharedPassword,
    agentTempPassword: sharedPassword,
  };
}

// ── 내부 유틸 ────────────────────────────────────────────────────

// Phase 4: partnerId 자동 생성 (boss1, boss2... / sales1, sales2...)
async function generateUniquePartnerId(
  prefix: 'boss' | 'sales',
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  for (let i = 1; i <= 9999; i++) {
    const partnerId = `${prefix}${i}`;
    const exists = await tx.gmUser.findFirst({
      where: { phone: partnerId },
    });
    if (!exists) return partnerId;
  }
  throw new Error(`${prefix} partnerId 생성 실패: 9999개 초과`);
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
