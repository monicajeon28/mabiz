import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';
import { google } from 'googleapis';
import { formatDetailAmount, formatPercent } from '@/lib/margin-calculator';

// 구글 드라이브 인증
async function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

// 손익계산서 텍스트 생성
function generateReportContent(record: any): string {
  const { year, month, salesData, commissionData, fixedCostsData, variableCostsData, resultData, budgetData } = record;
  const result = resultData;

  let content = `
================================================================================
                        ${year}년 ${month}월 손익계산서
================================================================================
                        생성일: ${new Date().toLocaleDateString('ko-KR')}
--------------------------------------------------------------------------------

【 매출 현황 】
--------------------------------------------------------------------------------
  총 매출액              ${formatDetailAmount(result.grossSales)}
  환불 금액              ${formatDetailAmount(result.refundAmount)} (${formatPercent(result.refundRate)})
  ────────────────────────────────────────────────────────────────
  순매출액               ${formatDetailAmount(result.netSales)}

【 수당 지출 】
--------------------------------------------------------------------------------
  판매원 수당            ${formatDetailAmount(commissionData.salesAgentCommission)}
  멘토 수당              ${formatDetailAmount(commissionData.mentorCommission)}
  대리점장 오버라이드    ${formatDetailAmount(commissionData.branchManagerCommission)}
  기타 수당              ${formatDetailAmount(commissionData.otherCommission)}
  ────────────────────────────────────────────────────────────────
  총 수당 지출           ${formatDetailAmount(result.totalCommission)} (매출 대비 ${formatPercent(result.commissionRate)})

【 매출총이익 】
--------------------------------------------------------------------------------
  매출총이익             ${formatDetailAmount(result.grossProfit)}
  매출총이익률           ${formatPercent(result.grossProfitMargin)}

【 고정비 】
--------------------------------------------------------------------------------
  사무실 월세            ${formatDetailAmount(fixedCostsData.officeRent)}
  전기세                 ${formatDetailAmount(fixedCostsData.electricity)}
  수도세                 ${formatDetailAmount(fixedCostsData.water)}
  인터넷/통신비          ${formatDetailAmount(fixedCostsData.internet)}
  AI 플랫폼 비용         ${formatDetailAmount(fixedCostsData.aiPlatformFee)}
  서버/호스팅            ${formatDetailAmount(fixedCostsData.serverCost)}
  보험료                 ${formatDetailAmount(fixedCostsData.insurance)}
  기타 고정비            ${formatDetailAmount(fixedCostsData.otherFixed)}
  ────────────────────────────────────────────────────────────────
  총 고정비              ${formatDetailAmount(result.totalFixedCosts)}

【 변동비 】
--------------------------------------------------------------------------------
  마케팅/광고비          ${formatDetailAmount(variableCostsData.marketingCost)}
  영업비                 ${formatDetailAmount(variableCostsData.salesCost)}
  출장비                 ${formatDetailAmount(variableCostsData.travelCost)}
  접대비                 ${formatDetailAmount(variableCostsData.entertainmentCost)}
  소모품비               ${formatDetailAmount(variableCostsData.suppliesCost)}
  기타 변동비            ${formatDetailAmount(variableCostsData.otherVariable)}
  ────────────────────────────────────────────────────────────────
  총 변동비              ${formatDetailAmount(result.totalVariableCosts)}

================================================================================
                              최종 손익
================================================================================
  순매출액               ${formatDetailAmount(result.netSales)}
  (-) 총 수당            ${formatDetailAmount(result.totalCommission)}
  (-) 총 고정비          ${formatDetailAmount(result.totalFixedCosts)}
  (-) 총 변동비          ${formatDetailAmount(result.totalVariableCosts)}
  ════════════════════════════════════════════════════════════════
  순이익                 ${formatDetailAmount(result.netProfit)}
  순이익률               ${formatPercent(result.netProfitMargin)}
  손익 상태              ${result.isProfitable ? '흑자' : '적자'}
================================================================================

【 분석 지표 】
--------------------------------------------------------------------------------
  손익분기점 매출        ${formatDetailAmount(result.breakEvenSales)}
  손익분기 달성률        ${formatPercent(result.salesVsBreakEven)}
  상태                   ${result.statusMessage}
`;

  if (budgetData) {
    content += `
【 예산 대비 실적 】
--------------------------------------------------------------------------------
  매출 목표              ${formatDetailAmount(budgetData.salesTarget)}
  매출 달성률            ${formatPercent((result.netSales / budgetData.salesTarget) * 100)}
  이익 목표              ${formatDetailAmount(budgetData.profitTarget)}
  이익 달성률            ${formatPercent((result.netProfit / budgetData.profitTarget) * 100)}
`;
  }

  content += `
================================================================================
                    크루즈닷 재무관리시스템 자동 생성
================================================================================
`;

  return content;
}

// POST: 구글 드라이브 백업
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { year, month } = body;

    // 해당 월 기록 조회
    const record = await prisma.financeRecord.findFirst({
      where: { year, month },
    });

    if (!record) {
      return NextResponse.json(
        { error: '해당 월의 기록이 없습니다. 먼저 저장해주세요.' },
        { status: 404 }
      );
    }

    // 구글 드라이브 클라이언트
    const drive = await getGoogleDriveClient();

    // 손익계산서 내용 생성
    const content = generateReportContent({
      year: record.year,
      month: record.month,
      salesData: record.salesData,
      commissionData: record.commissionData,
      fixedCostsData: record.fixedCostsData,
      variableCostsData: record.variableCostsData,
      resultData: record.resultData,
      budgetData: record.budgetData,
    });

    const fileName = `손익계산서_${year}년${month}월_${new Date().toISOString().split('T')[0]}.txt`;

    // 구글 드라이브에 업로드
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FINANCE_FOLDER_ID || 'root'],
    };

    const media = {
      mimeType: 'text/plain',
      body: content,
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
    });

    // 백업 시간 업데이트
    await prisma.financeRecord.update({
      where: { id: record.id },
      data: {
        backedUpAt: new Date(),
        backupFileId: file.data.id,
      },
    });

    return NextResponse.json({
      success: true,
      fileName: file.data.name,
      fileId: file.data.id,
      webViewLink: file.data.webViewLink,
    });
  } catch (error) {
    console.error('Backup failed:', error);
    return NextResponse.json(
      { error: '백업에 실패했습니다. 구글 드라이브 설정을 확인해주세요.' },
      { status: 500 }
    );
  }
}
