export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { sendApprovedPayslips } from '@/lib/scheduler/payslipSender';

/**
 * Vercel Cron Job: 매월 1일 지급명세서 자동 발송
 * 
 * Vercel Cron 설정:
 * {
 *   "path": "/api/cron/payslip-sender",
 *   "schedule": "0 0 1 * *"
 * }
 */
export async function GET(request: Request) {
  try {
    // Vercel Cron 요청 검증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Payslip sender started');
    
    const result = await sendApprovedPayslips();

    return NextResponse.json({
      ok: true,
      message: 'Payslip sending completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[Cron] Payslip sender error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Payslip sending failed',
      },
      { status: 500 }
    );
  }
}
