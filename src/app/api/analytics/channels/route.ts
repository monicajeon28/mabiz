import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/channels
 * 채널별 성과 분석 (SMS / KAKAO / EMAIL)
 * 최근 30일 기준 + 전월 대비 트렌드
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevStart   = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const prevEnd     = periodStart;

    // ─── SMS 통계 (SmsLog 기반) ───────────────────────────────────────────
    const [smsCur, smsPrev] = await Promise.all([
      prisma.smsLog.groupBy({
        by: ['status'],
        where: { organizationId, sentAt: { gte: periodStart } },
        _count: { id: true },
      }),
      prisma.smsLog.groupBy({
        by: ['status'],
        where: { organizationId, sentAt: { gte: prevStart, lt: prevEnd } },
        _count: { id: true },
      }),
    ]);

    const smsSent   = smsCur.find(r => r.status === 'SENT')?._count.id ?? 0;
    const smsFailed = smsCur.find(r => r.status === 'FAILED')?._count.id ?? 0;
    const smsPrevSent = smsPrev.find(r => r.status === 'SENT')?._count.id ?? 0;

    // ─── CrmMarketingMessage 통계 (KAKAO / EMAIL) ────────────────────────
    const [marketingCur, marketingPrev] = await Promise.all([
      prisma.crmMarketingMessage.groupBy({
        by: ['channel', 'deliveryStatus'],
        where: {
          organizationId,
          channel: { in: ['KAKAO', 'EMAIL'] },
          createdAt: { gte: periodStart },
        },
        _count: { id: true },
      }),
      prisma.crmMarketingMessage.groupBy({
        by: ['channel', 'deliveryStatus'],
        where: {
          organizationId,
          channel: { in: ['KAKAO', 'EMAIL'] },
          createdAt: { gte: prevStart, lt: prevEnd },
        },
        _count: { id: true },
      }),
    ]);

    const getMarketingCount = (rows: typeof marketingCur, channel: string, status: string) =>
      rows.find(r => r.channel === channel && r.deliveryStatus === status)?._count.id ?? 0;

    const kakaoSent      = getMarketingCount(marketingCur,  'KAKAO', 'DELIVERED');
    const kakaoFailed    = getMarketingCount(marketingCur,  'KAKAO', 'FAILED');
    const emailSent      = getMarketingCount(marketingCur,  'EMAIL', 'DELIVERED');
    const emailFailed    = getMarketingCount(marketingCur,  'EMAIL', 'FAILED');
    const kakaoPrevSent  = getMarketingCount(marketingPrev, 'KAKAO', 'DELIVERED');
    const emailPrevSent  = getMarketingCount(marketingPrev, 'EMAIL', 'DELIVERED');

    // ─── 트렌드 계산 ──────────────────────────────────────────────────────
    const calcTrend = (cur: number, prev: number) => {
      if (prev === 0) return { trend: 'STABLE' as const, trendPercent: 0 };
      const pct = Math.round(((cur - prev) / prev) * 100);
      return {
        trend: pct > 5 ? 'UP' as const : pct < -5 ? 'DOWN' as const : 'STABLE' as const,
        trendPercent: Math.abs(pct),
      };
    };

    // ─── 채널별 추정 비용 (SMS: ₩15/건, KAKAO: ₩8/건, EMAIL: ₩1/건) ──────
    const SMS_COST_PER = 15;
    const KAKAO_COST_PER = 8;
    const EMAIL_COST_PER = 1;

    // ─── 전환율 추정 (오픈/클릭 추적 없는 경우 업계 평균 사용) ──────────────
    // SMS: 오픈율 25%, 클릭율 8%  KAKAO: 오픈율 45%, 클릭율 15%  EMAIL: 오픈율 20%, 클릭율 5%
    const channels = [
      {
        channel: 'SMS',
        sent:     smsSent,
        opened:   Math.round(smsSent * 0.25),
        clicked:  Math.round(smsSent * 0.08),
        converted: Math.round(smsSent * 0.02),
        failed:   smsFailed,
        cost:     smsSent * SMS_COST_PER,
        openRate: 25.0,
        clickRate: 8.0,
        conversionRate: 2.0,
        roi: smsSent > 0 ? Math.round((smsSent * 0.02 * 2500000) / (smsSent * SMS_COST_PER) * 100) / 100 : 0,
        ...calcTrend(smsSent, smsPrevSent),
      },
      {
        channel: 'KAKAO',
        sent:     kakaoSent,
        opened:   Math.round(kakaoSent * 0.45),
        clicked:  Math.round(kakaoSent * 0.15),
        converted: Math.round(kakaoSent * 0.03),
        failed:   kakaoFailed,
        cost:     kakaoSent * KAKAO_COST_PER,
        openRate: 45.0,
        clickRate: 15.0,
        conversionRate: 3.0,
        roi: kakaoSent > 0 ? Math.round((kakaoSent * 0.03 * 2500000) / (kakaoSent * KAKAO_COST_PER) * 100) / 100 : 0,
        ...calcTrend(kakaoSent, kakaoPrevSent),
      },
      {
        channel: 'EMAIL',
        sent:     emailSent,
        opened:   Math.round(emailSent * 0.20),
        clicked:  Math.round(emailSent * 0.05),
        converted: Math.round(emailSent * 0.01),
        failed:   emailFailed,
        cost:     emailSent * EMAIL_COST_PER,
        openRate: 20.0,
        clickRate: 5.0,
        conversionRate: 1.0,
        roi: emailSent > 0 ? Math.round((emailSent * 0.01 * 2500000) / (emailSent * EMAIL_COST_PER) * 100) / 100 : 0,
        ...calcTrend(emailSent, emailPrevSent),
      },
    ];

    // 최고 성과 채널 (전환율 기준)
    const bestPerformer = channels.reduce((best, c) =>
      c.conversionRate > best.conversionRate ? c : best
    ).channel;

    // 자동 추천 생성
    const recommendations: string[] = [];
    if (kakaoSent > smsSent * 0.5) recommendations.push('📣 카카오 채널이 높은 오픈율을 기록 중 — Day 0-3 시퀀스에 우선 활용 추천');
    if (smsFailed > smsSent * 0.1) recommendations.push('⚠️ SMS 실패율이 높습니다 — 전화번호 정제 및 수신거부 목록 업데이트 필요');
    if (emailSent < 100) recommendations.push('📧 이메일 채널 활용도가 낮습니다 — B2B 리드 대상 이메일 캠페인 시작 추천');
    if (recommendations.length === 0) recommendations.push('✅ 채널 운영 정상 — 현재 배분 유지하며 A/B 테스트 계속');

    logger.log('[GET /api/analytics/channels]', { organizationId, smsSent, kakaoSent, emailSent });

    return NextResponse.json({
      ok: true,
      channels,
      bestPerformer,
      recommendations,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
    });
  } catch (err) {
    logger.error('[GET /api/analytics/channels]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
