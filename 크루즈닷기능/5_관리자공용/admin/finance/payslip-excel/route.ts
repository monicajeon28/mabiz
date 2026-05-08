export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface PayslipRow {
  seq: number;
  displayName: string;
  mallUserId: string;
  partnerType: string;
  saleCount: number;
  totalSaleAmount: number;
  totalCommission: number;
  incomeTax: number;
  localTax: number;
  withholdingTotal: number;
  netPayout: number;
}

function buildDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(Date.UTC(year, month, 1));
  end.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

// 원천징수 3.3% = 소득세 3% + 지방소득세 0.3% (원 단위 절사)
function calcWithholding(commission: number) {
  const incomeTax = Math.floor(commission * 0.03);
  const localTax = Math.floor(commission * 0.003);
  const withholdingTotal = incomeTax + localTax;
  const netPayout = commission - withholdingTotal;
  return { incomeTax, localTax, withholdingTotal, netPayout };
}

async function buildPayslipRows(year: number, month: number): Promise<PayslipRow[]> {
  const { start, end } = buildDateRange(year, month);

  // 보안: passportImage, residentId, phone 전체 선택 금지
  // 집계 기준: confirmedAt (소득세법 제127조 — 지급일 기준, withholding-reminder와 통일)
  const sales = await prisma.affiliateSale.findMany({
    where: {
      status: 'CONFIRMED',
      confirmedAt: { gte: start, lt: end },
      OR: [{ managerId: { not: null } }, { agentId: { not: null } }],
    },
    select: {
      managerId: true,
      agentId: true,
      saleAmount: true,
      branchCommission: true,
      salesCommission: true,
      overrideCommission: true,
    },
  });

  if (sales.length === 0) return [];

  const profileIdSet = new Set<number>();
  for (const s of sales) {
    if (s.managerId != null) profileIdSet.add(s.managerId);
    if (s.agentId != null) profileIdSet.add(s.agentId);
  }

  const profiles = await prisma.affiliateProfile.findMany({
    where: { id: { in: Array.from(profileIdSet) } },
    select: {
      id: true,
      displayName: true,
      type: true,
      User: { select: { mallUserId: true } },
    },
  });

  type ProfileRow = typeof profiles[number];
  const profileMap = new Map<number, ProfileRow>(profiles.map((p) => [p.id, p]));

  const accumMap = new Map<number, { saleCount: number; totalSaleAmount: number; totalCommission: number }>();

  const accum = (pid: number, saleAmount: number, commission: number) => {
    if (!profileMap.has(pid)) return;
    const e = accumMap.get(pid);
    if (e) { e.saleCount++; e.totalSaleAmount += saleAmount; e.totalCommission += commission; }
    else accumMap.set(pid, { saleCount: 1, totalSaleAmount: saleAmount, totalCommission: commission });
  };

  for (const s of sales) {
    const isSame = s.managerId != null && s.managerId === s.agentId;
    if (isSame && s.managerId != null) {
      accum(s.managerId, Number(s.saleAmount), Number(s.branchCommission ?? 0) + Number(s.salesCommission ?? 0) + Number(s.overrideCommission ?? 0));
    } else {
      if (s.managerId != null) accum(s.managerId, Number(s.saleAmount), Number(s.branchCommission ?? 0) + Number(s.overrideCommission ?? 0));
      if (s.agentId != null) accum(s.agentId, Number(s.saleAmount), Number(s.salesCommission ?? 0));
    }
  }

  const rows: PayslipRow[] = [];
  for (const [pid, acc] of accumMap.entries()) {
    if (acc.totalCommission <= 0) continue;
    const p = profileMap.get(pid);
    const { incomeTax, localTax, withholdingTotal, netPayout } = calcWithholding(acc.totalCommission);
    rows.push({
      seq: 0,
      displayName: p?.displayName ?? '(미등록)',
      mallUserId: p?.User?.mallUserId ?? '-',
      partnerType: p?.type ?? '-',
      saleCount: acc.saleCount,
      totalSaleAmount: acc.totalSaleAmount,
      totalCommission: acc.totalCommission,
      incomeTax,
      localTax,
      withholdingTotal,
      netPayout,
    });
  }

  rows.sort((a, b) => b.totalCommission - a.totalCommission);
  rows.forEach((r, i) => { r.seq = i + 1; });
  return rows;
}

function buildExcelBuffer(rows: PayslipRow[], year: number, month: number): Buffer {
  const headers = ['순번', '성명', '회원번호', '구분', '판매건수', '판매합계', '수당합계', '소득세(3%)', '지방소득세(0.3%)', '원천징수계', '실지급액'];
  const dataRows = rows.map((r) => [r.seq, r.displayName, r.mallUserId, r.partnerType, r.saleCount, r.totalSaleAmount, r.totalCommission, r.incomeTax, r.localTax, r.withholdingTotal, r.netPayout]);
  const totalRow = [
    '★합계', '', '', '',
    rows.reduce((s, r) => s + r.saleCount, 0),
    rows.reduce((s, r) => s + r.totalSaleAmount, 0),
    rows.reduce((s, r) => s + r.totalCommission, 0),
    rows.reduce((s, r) => s + r.incomeTax, 0),
    rows.reduce((s, r) => s + r.localTax, 0),
    rows.reduce((s, r) => s + r.withholdingTotal, 0),
    rows.reduce((s, r) => s + r.netPayout, 0),
  ];

  const wsData = [headers, ...dataRows, totalRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = headers.map((h, ci) => ({
    wch: Math.min(wsData.reduce((m, row) => Math.max(m, String(row[ci] ?? '').length), h.length) + 2, 30),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${year}년 ${month}월 지급명세서`);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    if (!['admin', 'superadmin'].includes(dbUser?.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한 필요' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get('year') ?? String(now.getUTCFullYear()), 10);
    const month = parseInt(searchParams.get('month') ?? String(now.getUTCMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json({ ok: false, error: '잘못된 year/month 파라미터' }, { status: 400 });
    }

    logger.debug('[finance/payslip-excel] 지급명세서 다운로드 요청', { requestedBy: sessionUser.id, year, month });

    const rows = await buildPayslipRows(year, month);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '해당 월에 CONFIRMED 판매 건이 없습니다.' }, { status: 404 });
    }

    const buffer = buildExcelBuffer(rows, year, month);
    const filename = `payslip_${year}_${String(month).padStart(2, '0')}.xlsx`;

    logger.debug('[finance/payslip-excel] 지급명세서 생성 완료', { year, month, rowCount: rows.length });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    logger.warn('[finance/payslip-excel] 오류 발생', { error: String(error) });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
