/**
 * GET /api/cron/backup-affiliate-contracts
 * 파트너 계약 신청 전체를 타입별 시트로 구분하여 Google Drive Excel 백업
 * 스케줄: 매일 21:00 UTC (한국 시간 06:00)
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { CONTRACT_PRICE_TIERS } from '@/lib/affiliate/priceTiers';
import {
  backupAffiliateContractsToExcel,
  type AffiliateContractRow,
} from '@/lib/affiliate-contracts-backup';

const MAX_DURATION_MS = 55_000; // 55초 타임아웃

function verifySecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET ?? '';
  if (!cronSecret) return false;
  const incoming = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;
  if (incoming.length !== expected.length) return false;
  return timingSafeEqual(
    Buffer.from(incoming, 'utf8'),
    Buffer.from(expected, 'utf8'),
  );
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  if (!verifySecret(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    logger.info('[CRON backup-affiliate-contracts] 시작');

    // 전체 계약 조회 (소프트삭제 없음 — gmAffiliateContract는 물리 삭제 없음)
    const rawContracts = await prisma.gmAffiliateContract.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        metadata: true,
        createdAt: true,
        submittedAt: true,
        contractSignedAt: true,
        bankName: true,
        bankAccount: true,
        bankAccountHolder: true,
        address: true,
      },
    });

    if (Date.now() - startTime > MAX_DURATION_MS) {
      return NextResponse.json({ ok: false, error: '조회 타임아웃' }, { status: 504 });
    }

    // metadata에서 필드 추출
    const contracts: AffiliateContractRow[] = rawContracts.map((c) => {
      const meta = c.metadata as Record<string, unknown> | null;
      const tierKey = meta?.tierKey as string | undefined;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        status: c.status,
        contractType: (meta?.type as string | undefined) ?? 'SALES_AGENT',
        tierLabel: tierKey
          ? (CONTRACT_PRICE_TIERS[tierKey as keyof typeof CONTRACT_PRICE_TIERS]?.label ?? tierKey)
          : null,
        createdAt: c.createdAt,
        submittedAt: c.submittedAt,
        contractSignedAt: c.contractSignedAt,
        approvedAt: meta?.approvedAt as string | null | undefined,
        rejectedAt: meta?.rejectedAt as string | null | undefined,
        rejectReason: meta?.rejectReason as string | null | undefined,
        rejectedByName: meta?.rejectedByName as string | null | undefined,
        bankName: c.bankName,
        bankAccount: c.bankAccount,
        bankAccountHolder: c.bankAccountHolder,
        address: c.address,
      };
    });

    const dateLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const result = await backupAffiliateContractsToExcel(contracts, dateLabel);

    logger.info('[CRON backup-affiliate-contracts] 완료', {
      total: contracts.length,
      elapsed: Date.now() - startTime,
      latestFileId: result.latestFileId,
    });

    return NextResponse.json({
      ok: true,
      total: contracts.length,
      latestViewUrl: result.latestViewUrl,
      monthlyViewUrl: result.monthlyViewUrl,
    });
  } catch (err) {
    logger.error('[CRON backup-affiliate-contracts] 실패', { error: err });
    return NextResponse.json({ ok: false, error: '백업 실패' }, { status: 500 });
  }
}
