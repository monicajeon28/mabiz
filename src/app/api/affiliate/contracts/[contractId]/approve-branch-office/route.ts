export const dynamic = 'force-dynamic';
// PDF 생성(puppeteer chromium 콜드스타트)·Drive·이메일까지 시간 여유
export const maxDuration = 60;

/**
 * PUT /api/affiliate/contracts/[contractId]/approve-branch-office
 *
 * 지사 협력계약(BRANCH_OFFICE) 승인 — 계정 생성·금액 없음.
 * 서명된 지사 협력 계약서를 PDF로 만들어 Google Drive에 보관하고,
 * 본사(ADMIN_EMAIL) + 지사에게 PDF 첨부 이메일을 발송한 뒤 status=APPROVED 처리한다.
 * 지사 boss 계정은 별도로 /affiliate-issuance(어필리에이트 발급)에서 수동 생성한다.
 *
 * 접근: GLOBAL_ADMIN 전용.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import { generatePartnerContractPDF } from '@/lib/contract-pdf-generator';
import { backupPartnerContractToGoogleDrive } from '@/lib/google-drive';
import { sendSystemEmail } from '@/lib/system-email';
import { renderPartnerContractSignedEmail } from '@/lib/email-templates';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { contractId: idStr } = await params;
    const contractId = parseInt(idStr, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return NextResponse.json({ ok: false, message: '유효한 계약 ID가 아닙니다.' }, { status: 400 });
    }

    // 원자적 잠금 — APPROVED/PROCESSING이 아닌 경우만 PROCESSING으로 (동시 요청 차단)
    const locked = await prisma.gmAffiliateContract.updateMany({
      where: { id: contractId, status: { notIn: ['APPROVED', 'PROCESSING'] } },
      data: { status: 'PROCESSING' },
    });
    if (locked.count === 0) {
      const c = await prisma.gmAffiliateContract.findUnique({ where: { id: contractId }, select: { status: true } });
      if (!c) return NextResponse.json({ ok: false, message: '계약을 찾을 수 없습니다.' }, { status: 404 });
      if (c.status === 'APPROVED') return NextResponse.json({ ok: false, message: '이미 승인된 계약입니다.' }, { status: 409 });
      return NextResponse.json({ ok: false, message: '현재 처리 중인 계약입니다. 잠시 후 다시 시도해주세요.' }, { status: 409 });
    }

    const contract = await prisma.gmAffiliateContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      await prisma.gmAffiliateContract.updateMany({ where: { id: contractId, status: 'PROCESSING' }, data: { status: 'submitted' } });
      return NextResponse.json({ ok: false, message: '계약을 찾을 수 없습니다.' }, { status: 404 });
    }

    const meta = (contract.metadata as Record<string, unknown> | null) ?? {};
    if (meta.contractTemplate !== 'BRANCH_OFFICE') {
      // 일반 등급 계약은 이 경로 사용 불가 — 원복
      await prisma.gmAffiliateContract.updateMany({ where: { id: contractId, status: 'PROCESSING' }, data: { status: 'submitted' } });
      return NextResponse.json({ ok: false, message: '지사 협력계약이 아닙니다. 일반 계약 승인을 사용하세요.' }, { status: 400 });
    }

    // 지사 협력계약서(서명·내용 그대로) PDF 생성 → Drive 보관 → 본사+지사 첨부 이메일
    let driveFileId: string | null = null;
    try {
      const pdfUint8 = await generatePartnerContractPDF(
        `지사-${contract.id}`,
        contract.name || '지사',
        'BRANCH_OFFICE',
        contract.contractSignedAt ?? new Date(),
        contract.signatureImageUrl ?? undefined,
      );
      const pdfBuffer = Buffer.from(pdfUint8);

      // Google Drive 보관 (독립 try — 실패해도 첨부 이메일은 진행)
      try {
        const driveResult = await backupPartnerContractToGoogleDrive(`지사-${contract.id}`, contract.name || '지사', pdfBuffer);
        driveFileId = driveResult.contractFileId ?? null;
      } catch (driveErr) {
        logger.warn('[BRANCH-OFFICE-APPROVE] Drive 백업 실패(첨부 이메일은 진행)', {
          contractId, error: driveErr instanceof Error ? driveErr.message : String(driveErr),
        });
      }

      // 본사 SMTP로 본사+지사 양쪽에 PDF 첨부 발송
      const adminEmail = process.env.ADMIN_EMAIL ?? process.env.GLOBAL_ADMIN_NOTIFY_EMAIL ?? '';
      const recipients = [contract.email, adminEmail].filter(
        (e): e is string => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
      );
      if (recipients.length > 0) {
        const emailTemplate = renderPartnerContractSignedEmail({
          partnerName: contract.name || '지사',
          partnerEmail: contract.email ?? '',
          contractSignedAt: new Date().toLocaleDateString('ko-KR'),
          driveLinkUrl: driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : '',
          adminEmail,
        });
        try {
          await sendSystemEmail({
            to: recipients,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            attachments: [{
              filename: `지사협력계약서_${contract.name || '지사'}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            }],
          });
          logger.log('[BRANCH-OFFICE-APPROVE] 계약서 PDF 첨부 이메일 발송', { contractId, recipients: recipients.length, driveFileId });
        } catch (emailErr) {
          logger.warn('[BRANCH-OFFICE-APPROVE] 이메일 발송 실패(승인 유지)', {
            contractId, error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
        }
      }
    } catch (pdfErr) {
      // PDF 실패는 승인을 취소하지 않음 — 로그만
      logger.error('[BRANCH-OFFICE-APPROVE] PDF 생성/보관 실패(승인은 유지)', {
        contractId, error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
      });
    }

    // 승인 확정 — status=APPROVED + metadata 갱신(드라이브 파일 ID 포함)
    await prisma.gmAffiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'APPROVED',
        metadata: {
          ...meta,
          approvedAt: new Date().toISOString(),
          approvedBy: ctx.userId,
          ...(driveFileId ? { contractPdfDriveId: driveFileId } : {}),
        },
      },
    });

    // 감사 로그 (best-effort)
    try {
      await prisma.gmAffiliateContractAudit.create({
        data: { contractId, action: 'APPROVED', approvedBy: Number.isInteger(Number(ctx.userId)) ? Number(ctx.userId) : null, approvalTier: 'BRANCH_OFFICE' },
      });
    } catch (auditErr) {
      logger.warn('[BRANCH-OFFICE-APPROVE] 감사 로그 저장 실패', { auditErr });
    }

    logger.info('[BRANCH-OFFICE-APPROVE] 지사 협력계약 승인 완료', { contractId, driveFileId, by: ctx.userId });
    return NextResponse.json({
      ok: true,
      message: '지사 협력계약이 승인·보관되었습니다. 지사 계정은 어필리에이트 발급에서 생성하세요.',
      data: { contractId, isBranchOffice: true, driveFileId },
    });
  } catch (err) {
    logger.error('[BRANCH-OFFICE-APPROVE] 실패', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, message: '지사 협력계약 승인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
