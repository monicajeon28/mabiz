export const dynamic = 'force-dynamic';

/**
 * PUT  /api/affiliate/contracts/[contractId]/approve  — 계약 승인 + 계정 자동 생성
 * GET  /api/affiliate/contracts/[contractId]/approve  — 계약 상태 조회
 *
 * 접근 권한: GLOBAL_ADMIN 전용
 *
 * P0 수정 완료:
 * - getAuthContext() + GLOBAL_ADMIN 검증
 * - Race Condition 방지 (PROCESSING 상태 잠금)
 * - 단일 트랜잭션 (provisionAffiliateAccounts)
 * - tempPassword API 응답 불포함
 * - amount 기본값 제거 (필수값)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import { provisionSingleGradeAccount } from '@/lib/affiliate/provision';
import {
  VALID_AMOUNTS,
  VALID_AMOUNTS_LABEL,
  getPriceTierByAmount,
  getPriceTierInfo,
} from '@/lib/affiliate/priceTiers';
import { sendSms, getOrgSmsConfig } from '@/lib/aligo';
import { sendFunnelEmail } from '@/lib/email';
import { renderPartnerWelcomeEmail, renderPartnerContractSignedEmail } from '@/lib/email-templates';
import { checkSmsRateLimit, checkEmailRateLimit } from '@/lib/affiliate-rate-limit';
import { notifyCruisedotAffiliateCreated } from '@/lib/affiliate/notify-cruisedot';
import { generatePartnerContractPDF } from '@/lib/contract-pdf-generator';
import { backupPartnerContractToGoogleDrive } from '@/lib/google-drive';

// ── 개인정보 마스킹 헬퍼 (서버 전용 — 평문 전체노출 금지) ──────────
/**
 * 주민등록번호 마스킹: 901010-1******  (앞 7자리만 노출)
 */
function maskResidentId(rid: string | null | undefined): string | null {
  if (!rid) return null;
  const digits = rid.replace(/\D/g, '');
  if (digits.length < 7) return '******';
  // 생년월일 6자리 + 성별구분 1자리만 노출, 나머지 6자리 마스킹
  return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
}

/**
 * 계좌번호 마스킹: 은행명 + 뒤 4자리만 노출 (예: "국민 ****1234")
 */
function maskBankAccount(bankName: string | null | undefined, account: string | null | undefined): string | null {
  if (!account) return bankName ? bankName : null;
  const digits = account.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : digits;
  const masked = `****${last4}`;
  return bankName ? `${bankName} ${masked}` : masked;
}

// 외부 API 호출 타임아웃 래퍼
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`[타임아웃] ${label} (${ms}ms 초과)`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// 계약 metadata 타입 (Record<string,any> 제거)
interface ContractMeta {
  type?: string;
  tierKey?: string;
  agentCode?: string;
  contractRef?: string;
  amount?: number;
  approvedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  rejectedByName?: string;
  managerLinkCode?: string;
  agentLinkCode?: string;
  [key: string]: unknown;
}

// ── PUT: 계약 승인 ────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    // 1. 인증 — GLOBAL_ADMIN만 허용
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 },
      );
    }

    const { contractId: contractIdStr } = await params;
    const contractId = parseInt(contractIdStr, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return NextResponse.json(
        { ok: false, message: '유효한 계약 ID가 아닙니다.' },
        { status: 400 },
      );
    }

    // 2. amount 검증 (필수값 — 기본값 없음)
    const body = await req.json();
    const amount: number | undefined = body.amount;
    if (!amount) {
      return NextResponse.json(
        { ok: false, message: `계약금은 필수입니다. (${VALID_AMOUNTS_LABEL})` },
        { status: 400 },
      );
    }
    if (!VALID_AMOUNTS.includes(amount as any)) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 계약금입니다. (${VALID_AMOUNTS_LABEL})` },
        { status: 400 },
      );
    }

    // 3. Race Condition 방지 — 원자적 상태 잠금
    // PENDING 상태인 경우만 PROCESSING으로 전환 (동시 요청 차단)
    const locked = await prisma.gmAffiliateContract.updateMany({
      where: { id: contractId, status: { notIn: ['APPROVED', 'PROCESSING'] } },
      data: { status: 'PROCESSING' },
    });

    if (locked.count === 0) {
      // 이미 처리 중이거나 승인된 계약
      const contract = await prisma.gmAffiliateContract.findUnique({
        where: { id: contractId },
        select: { status: true },
      });
      if (!contract) {
        return NextResponse.json(
          { ok: false, message: '계약을 찾을 수 없습니다.' },
          { status: 404 },
        );
      }
      if (contract.status === 'APPROVED') {
        return NextResponse.json(
          { ok: false, message: '이미 승인된 계약입니다.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { ok: false, message: '현재 처리 중인 계약입니다. 잠시 후 다시 시도해주세요.' },
        { status: 409 },
      );
    }

    // 4. 계약 정보 조회
    const contract = await prisma.gmAffiliateContract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      // PROCESSING으로 잠갔다가 계약이 없으면 원복
      await prisma.gmAffiliateContract.updateMany({
        where: { id: contractId, status: 'PROCESSING' },
        data: { status: 'submitted' },
      });
      return NextResponse.json(
        { ok: false, message: '계약을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (!contract.email) {
      await prisma.gmAffiliateContract.updateMany({
        where: { id: contractId, status: 'PROCESSING' },
        data: { status: 'submitted' },
      });
      return NextResponse.json(
        { ok: false, message: '계약자 이메일이 없습니다. 계약서를 확인해주세요.' },
        { status: 400 },
      );
    }

    // 5. 가격 정책 확인
    const tierKey = getPriceTierByAmount(amount)!;
    const tierInfo = getPriceTierInfo(tierKey);

    // 6. CRM 조직 ID 결정 (GLOBAL_ADMIN이 속한 본사 조직 또는 신규 생성)
    const organizationId = ctx.organizationId || process.env.BONSA_ORG_ID || '';
    if (!organizationId) {
      await prisma.gmAffiliateContract.updateMany({
        where: { id: contractId, status: 'PROCESSING' },
        data: { status: 'submitted' },
      });
      return NextResponse.json(
        { ok: false, message: '조직 ID를 확인할 수 없습니다.' },
        { status: 500 },
      );
    }

    // 7. 추천 지사(소속) 자동 해소 — agentCode가 있으면 신규 계정을 '추천 지사의 조직' 밑으로
    //    귀속(managerId=추천 지사 멤버). 추천 지사 없으면 본사(organizationId) 소속.
    let supervisorOrganizationId = organizationId; // 기본 = 본사
    let supervisorMemberId: string | null = null;
    const contractMeta = contract.metadata as ContractMeta | null;
    if (contractMeta?.agentCode) {
      try {
        const referrer = await prisma.gmAffiliateProfile.findUnique({
          where: { affiliateCode: contractMeta.agentCode },
          select: { userId: true },
        });
        if (referrer) {
          const crmMember = await prisma.organizationMember.findFirst({
            where: { userId: String(referrer.userId) },
            select: { id: true, organizationId: true },
          });
          if (crmMember) {
            // 신규 계정은 추천 지사의 조직 밑으로 귀속
            supervisorOrganizationId = crmMember.organizationId;
            supervisorMemberId = crmMember.id;
            logger.info('[AFFILIATE-PROVISION] 추천 지사 소속 자동 해소', {
              contractId, agentCode: contractMeta.agentCode,
              supervisorOrganizationId, supervisorMemberId,
            });
          }
        }
      } catch (err) {
        logger.warn('[AFFILIATE-PROVISION] agentCode 추천 지사 조회 실패', {
          contractId, agentCode: contractMeta.agentCode,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 8. 계정 생성 (단일 트랜잭션 — 실패 시 전체 롤백)
    let provisionResult;
    try {
      provisionResult = await withTimeout(
        provisionSingleGradeAccount({
          contractId,
          contractorName: contract.name || '계약자',
          contractorEmail: contract.email,
          contractorPhone: contract.phone || '',
          approvedByMemberId: ctx.userId,
          grade: tierKey,                  // 계약금액→등급(마케터330/대리점장1=540/대리점장2=750)
          supervisorOrganizationId,        // 추천 지사 → 없으면 본사
          supervisorMemberId,
        }),
        30_000,
        'provisionSingleGradeAccount',
      );
    } catch (provisionErr) {
      // 프로비저닝 실패 시 계약 상태 원복
      await prisma.gmAffiliateContract.updateMany({
        where: { id: contractId, status: 'PROCESSING' },
        data: { status: 'submitted' },
      });
      throw provisionErr;
    }

    // 8.5. 계약서 PDF 생성 + Google Drive 저장 + 이메일 발송
    try {
      // 등급(grade)으로 PDF 역할 결정 (마케터=PRE_SALES / 대리점장1=SALES_AGENT / 대리점장2=BRANCH_MANAGER)
      const profileType: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'PRE_SALES' =
        tierKey === 'SALES_330' ? 'PRE_SALES' : tierKey === 'BRANCH_750' ? 'BRANCH_MANAGER' : 'SALES_AGENT';

      // PDF 생성
      const pdfUint8Array = await generatePartnerContractPDF(
        provisionResult.crmMemberId,
        contract.name || '계약자',
        profileType,
        new Date(),
        undefined // signatureImageUrl은 나중에 서명 이미지가 있을 때 사용
      );
      // Uint8Array → Buffer 변환
      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Google Drive 저장
      const driveResult = await backupPartnerContractToGoogleDrive(
        provisionResult.crmMemberId,
        contract.name || '계약자',
        pdfBuffer
      );

      // 이메일 발송 (Drive 링크 포함)
      if (contract.email) {
        const emailTemplate = renderPartnerContractSignedEmail({
          partnerName: contract.name || '파트너',
          partnerEmail: contract.email,
          contractSignedAt: new Date().toLocaleDateString('ko-KR'),
          driveLinkUrl: `https://drive.google.com/file/d/${driveResult.contractFileId}/view`,
          adminEmail: 'admin@cruisedot.co.kr',
        });

        // 이메일 발송 (Drive 링크로 대체)
        try {
          const emailResult = await sendFunnelEmail({
            organizationId,
            to: contract.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          });
          if (emailResult.result_code === 1) {
            logger.log('[AFFILIATE-PROVISION] 계약서 이메일 발송 완료', {
              contractId,
              email: contract.email,
              driveFileId: driveResult.contractFileId,
            });
          } else {
            logger.warn('[AFFILIATE-PROVISION] 계약서 이메일 발송 실패', {
              contractId,
              email: contract.email,
              result_code: emailResult.result_code,
            });
          }
        } catch (emailErr) {
          logger.warn('[AFFILIATE-PROVISION] 계약서 이메일 발송 실패', {
            contractId,
            email: contract.email,
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
          // 이메일 실패는 계약 승인을 취소하지 않음
        }
      }
    } catch (contractPdfErr) {
      logger.error('[AFFILIATE-PROVISION] 계약서 PDF 생성/저장 실패', {
        contractId,
        error: contractPdfErr instanceof Error ? contractPdfErr.message : String(contractPdfErr),
      });
      // PDF 실패는 계약 승인을 취소하지 않음 — 로그만 남김
    }

    // 9. SMS 발송 — 임시 비밀번호는 SMS로만 전달 (API 응답 절대 불포함)
    let smsSent = false;
    try {
      if (contract.phone) {
        // Rate Limit 검증 — SMS 발송 전
        const smsLimitResult = checkSmsRateLimit(contract.phone, 'phone');
        if (!smsLimitResult.allowed) {
          logger.warn('[AFFILIATE-PROVISION] SMS 발송 Rate Limit 초과', {
            contractId,
            phone: contract.phone,
            resetAt: new Date(smsLimitResult.resetAt),
          });
          // SMS 실패는 계약 승인을 취소하지 않음 — 로그만 남김
        } else {
          const smsConfig = await getOrgSmsConfig(organizationId);
          if (smsConfig) {
            const msg = [
              `[마비즈] ${contract.name} ${provisionResult.gradeLabel}님, 계약이 승인되었습니다.`,
              `코드: ${provisionResult.affiliateCode}`,
              `임시 비밀번호: ${provisionResult.tempPassword}`,
              `로그인: ${process.env.NEXT_PUBLIC_APP_URL}/login`,
            ].join('\n');

            const smsResult = await sendSms({
              config: { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
              receiver: contract.phone,
              msg,
              msgType: 'LMS',
              organizationId,
            });
            smsSent = Number(smsResult.result_code) === 1;
          }
        }
      }
    } catch (smsErr) {
      // SMS 실패는 계약 승인을 취소하지 않음 — 로그만 남김
      logger.warn('[AFFILIATE-PROVISION] SMS 발송 실패 — 계약 승인은 유지됨', {
        contractId,
        phone: contract.phone,
        error: smsErr instanceof Error ? smsErr.message : String(smsErr),
      });
    }

    // 10. 이메일 발송 — 환영 메시지 + 대리점 코드
    let emailSent = false;
    try {
      if (contract.email) {
        // Rate Limit 검증 — 이메일 발송 전
        const emailLimitResult = checkEmailRateLimit(contract.email, 'email');
        if (!emailLimitResult.allowed) {
          logger.warn('[AFFILIATE-PROVISION] 이메일 발송 Rate Limit 초과', {
            contractId,
            email: contract.email,
            resetAt: new Date(emailLimitResult.resetAt),
          });
          // 이메일 실패는 계약 승인을 취소하지 않음 — 로그만 남김
        } else {
          const { subject, html } = renderPartnerWelcomeEmail({
            name: contract.name,
            tier: tierInfo.label,
            managerCode: provisionResult.affiliateCode,
            managerLink: provisionResult.linkUrl,
            agentCode: undefined,
            agentLink: undefined,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://mabizcruisedot.com',
          });

          const emailResult = await sendFunnelEmail({
            organizationId,
            to: contract.email,
            subject,
            html,
          });
          emailSent = Number(emailResult.result_code) === 1;
        }
      }
    } catch (emailErr) {
      // 이메일 실패는 계약 승인을 취소하지 않음 — 로그만 남김
      logger.warn('[AFFILIATE-PROVISION] 환영 이메일 발송 실패', {
        contractId,
        email: contract.email,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    logger.info('[AFFILIATE-PROVISION] 계약 승인 완료', {
      contractId,
      amount,
      tierKey,
      gmUserId: provisionResult.gmUserId,
      crmMemberId: provisionResult.crmMemberId,
      grade: provisionResult.grade,
      approvedBy: ctx.userId,
    });

    // P1-5: 감사 로그 기록 (실패해도 승인 결과에 영향 없음)
    try {
      await prisma.gmAffiliateContractAudit.create({
        data: {
          contractId,
          action: 'APPROVED',
          approvedBy: ctx.userId ? Number(ctx.userId) : null,
          approvalTier: tierKey,
        },
      });
    } catch (auditErr) {
      logger.warn('[AFFILIATE-PROVISION] 감사 로그 저장 실패', { auditErr });
    }

    // 11. 크루즈닷몰 웹훅 발송 (비차단 — 실패 시 계약 승인 유지)
    const contractMeta2 = contract.metadata as ContractMeta | null;
    notifyCruisedotAffiliateCreated({
      event: 'contract.approved',
      contractId,
      contractRef: contractMeta2?.contractRef ?? undefined,
      contractorName: contract.name || '계약자',
      approvedAt: new Date().toISOString(),
      // 등급에 맞는 슬롯 1개만 전송 (마케터=presales / 대리점장1·2=agent)
      ...(tierKey === 'SALES_330'
        ? {
            presales: {
              partnerId: provisionResult.partnerId,
              role: 'affiliate_presales' as const,
              affiliateCode: provisionResult.affiliateCode,
              linkCode: provisionResult.linkCode,
              linkUrl: provisionResult.linkUrl,
            },
          }
        : {
            agent: {
              partnerId: provisionResult.partnerId,
              role: 'affiliate_agent' as const,
              affiliateCode: provisionResult.affiliateCode,
              linkCode: provisionResult.linkCode,
              linkUrl: provisionResult.linkUrl,
            },
          }),
    }).catch((e) =>
      logger.error('[AFFILIATE-PROVISION] 크루즈닷몰 웹훅 발송 실패', { contractId, error: e })
    );

    // 응답 — 비밀번호 절대 포함 금지
    return NextResponse.json({
      ok: true,
      message: '계약이 승인되었습니다. 임시 비밀번호가 SMS로 발송됩니다.',
      data: {
        contractId,
        tier: {
          key: tierKey,
          label: tierInfo.label,
          amount,
        },
        // 계약당 1계정 — 생성된 단일 계정 반환
        account: {
          grade: provisionResult.grade,
          gradeLabel: provisionResult.gradeLabel,
          partnerId: provisionResult.partnerId,
          gmUserId: provisionResult.gmUserId,
          crmMemberId: provisionResult.crmMemberId,
          affiliateCode: provisionResult.affiliateCode,
          linkCode: provisionResult.linkCode,
          linkUrl: provisionResult.linkUrl,
        },
        smsSent,
        emailSent,
      },
    });
  } catch (err) {
    logger.error('[AFFILIATE-PROVISION] 계약 승인 실패', {
      contractId: 'unknown',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, message: '계약 승인 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

// ── GET: 계약 상태 조회 ───────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    // 인증 — GLOBAL_ADMIN만 허용
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 },
      );
    }

    const { contractId: contractIdStr } = await params;
    const contractId = parseInt(contractIdStr, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return NextResponse.json(
        { ok: false, message: '유효한 계약 ID가 아닙니다.' },
        { status: 400 },
      );
    }

    const contract = await prisma.gmAffiliateContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const metadata = contract.metadata as ContractMeta | null;
    const tierKey = metadata?.tierKey && metadata?.amount != null
      ? getPriceTierByAmount(metadata.amount)
      : null;
    const tierInfo = tierKey ? getPriceTierInfo(tierKey) : null;

    return NextResponse.json({
      ok: true,
      data: {
        contractId: contract.id,
        status: contract.status,
        name: contract.name,
        email: contract.email,
        phone: contract.phone,
        isApproved: contract.status === 'APPROVED',
        tier: tierInfo
          ? {
              label: tierInfo.label,
              amount: metadata?.amount,
            }
          : null,
        approvedAt: metadata?.approvedAt || null,
        links: metadata
          ? {
              managerCode: metadata.managerLinkCode,
              agentCode: metadata.agentLinkCode,
            }
          : null,
        // ── 제출 원문 (관리자 검토용 — 민감정보는 서버에서 마스킹) ──
        submission: {
          address: contract.address || null,
          // 주민등록번호: 마스킹 (앞 7자리만)
          residentIdMasked: maskResidentId(contract.residentId),
          // 정산계좌: 은행명 + 뒤 4자리만
          bankAccountMasked: maskBankAccount(contract.bankName, contract.bankAccount),
          bankAccountHolder: contract.bankAccountHolder || null,
          // 동의 5종 (✅/❌ 표시용 boolean)
          consents: {
            privacy: contract.consentPrivacy,        // 개인정보 수집·이용 동의
            dbUse: contract.consentDbUse,            // DB 활용 동의
            nonCompete: contract.consentNonCompete,  // 경업금지 동의
            penalty: contract.consentPenalty,        // 위약 조항 동의
            refund: contract.consentRefund,          // 환불 정책 동의
          },
          // 서명 이미지 (있을 때만 표시)
          signatureImageUrl: contract.signatureImageUrl || null,
          // 첨부 서류 존재 여부 (평문 경로는 노출 안 함)
          hasIdCard: Boolean(contract.idCardPath),
          hasBankbook: Boolean(contract.bankbookPath),
          submittedAt: contract.submittedAt ? contract.submittedAt.toISOString() : null,
        },
      },
    });
  } catch (err) {
    logger.error('[AFFILIATE-PROVISION] 계약 조회 실패', {
      contractId: 'unknown',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, message: '계약 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
