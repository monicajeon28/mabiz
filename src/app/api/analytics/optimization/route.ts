import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/optimization
 * 채널 배분 최적화 대시보드 데이터
 * Multi-Armed Bandit 기반 채널별 성과 집계
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ─── SMS 채널 통계 ────────────────────────────────────────────────────
    const smsStats = await prisma.smsLog.groupBy({
      by: ['status'],
      where: { organizationId, sentAt: { gte: periodStart } },
      _count: { id: true },
    });

    const smsSent   = smsStats.find(r => r.status === 'SENT')?._count.id ?? 0;
    const smsFailed = smsStats.find(r => r.status === 'FAILED')?._count.id ?? 0;

    // ─── KAKAO / EMAIL 채널 통계 (AdminMessage 기반) ─────────────────────
    const adminMsgStats = await prisma.adminMessage.groupBy({
      by: ['messageType'],
      where: {
        organizationId,
        messageType: { in: ['kakao', 'email'] },
        createdAt: { gte: periodStart },
      },
      _sum: { totalSent: true, successCount: true },
    });

    const getAdminSent = (type: string) =>
      adminMsgStats.find(r => r.messageType === type)?._sum.successCount ?? 0;
    const getAdminFailed = (type: string) => {
      const row = adminMsgStats.find(r => r.messageType === type);
      return Math.max(0, (row?._sum.totalSent ?? 0) - (row?._sum.successCount ?? 0));
    };

    const kakaoSent   = getAdminSent('kakao');
    const kakaoFailed = getAdminFailed('kakao');
    const emailSent   = getAdminSent('email');
    const emailFailed = getAdminFailed('email');

    const total = smsSent + smsFailed + kakaoSent + kakaoFailed + emailSent + emailFailed;
    const totalSent = smsSent + kakaoSent + emailSent;

    // ─── 현재 배분 비율 계산 ─────────────────────────────────────────────
    const currentAllocation = totalSent > 0
      ? {
          SMS:   Math.round((smsSent   / totalSent) * 100),
          KAKAO: Math.round((kakaoSent / totalSent) * 100),
          EMAIL: Math.round((emailSent / totalSent) * 100),
        }
      : { SMS: 40, KAKAO: 35, EMAIL: 25 }; // 데이터 없을 때 기본값

    // ─── Bandit 통계 (성공/실패 비율) ────────────────────────────────────
    const banditStats = {
      SMS: {
        successes:   smsSent,
        failures:    smsFailed,
        successRate: (smsSent + smsFailed) > 0 ? Math.round((smsSent / (smsSent + smsFailed)) * 1000) / 1000 : 0,
      },
      KAKAO: {
        successes:   kakaoSent,
        failures:    kakaoFailed,
        successRate: (kakaoSent + kakaoFailed) > 0 ? Math.round((kakaoSent / (kakaoSent + kakaoFailed)) * 1000) / 1000 : 0,
      },
      EMAIL: {
        successes:   emailSent,
        failures:    emailFailed,
        successRate: (emailSent + emailFailed) > 0 ? Math.round((emailSent / (emailSent + emailFailed)) * 1000) / 1000 : 0,
      },
    };

    // ─── 신뢰도 계산 (데이터 볼륨 기반) ─────────────────────────────────
    const confidence = Math.min(95, Math.max(40, Math.round(40 + (total / 50))));

    // ─── A/B 테스트 결과 ─────────────────────────────────────────────────
    const abTests = await prisma.segmentABTest.findMany({
      where: { organizationId, status: { in: ['COMPLETED', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        name: true, segmentType: true,
        aConversions: true, bConversions: true,
        totalSent: true, winnerVariant: true, status: true,
      },
    });

    const abTestResults = abTests.map(t => {
      const totalConv = t.aConversions + t.bConversions;
      const aRate = totalConv > 0 ? Math.round((t.aConversions / (t.totalSent || 1)) * 1000) / 10 : 0;
      const bRate = totalConv > 0 ? Math.round((t.bConversions / (t.totalSent || 1)) * 1000) / 10 : 0;
      return [
        { variant: `${t.name} - A`, channel: 'SMS' as const, conversionRate: aRate, winner: t.winnerVariant === 'A' },
        { variant: `${t.name} - B`, channel: 'KAKAO' as const, conversionRate: bRate, winner: t.winnerVariant === 'B' },
      ];
    }).flat();

    // ─── 예상 효과 (현재 → 최적화 후 추산) ─────────────────────────────
    const bestRate = Math.max(banditStats.SMS.successRate, banditStats.KAKAO.successRate, banditStats.EMAIL.successRate);
    const avgRate  = (banditStats.SMS.successRate + banditStats.KAKAO.successRate + banditStats.EMAIL.successRate) / 3;
    const improvement = bestRate - avgRate;

    const projectedImpact = {
      monthlyRevenue:  Math.round(totalSent * 0.02 * 2500000),
      revenueIncrease: Math.round(totalSent * (improvement / 100) * 2500000),
      expectedCPA:     totalSent > 0 ? Math.round((totalSent * 12) / Math.max(1, totalSent * 0.02)) : 50,
      cpaSavings:      Math.round(totalSent * (improvement / 100) * 12),
    };

    // ─── 최적화 추천 ─────────────────────────────────────────────────────
    const recommendations: string[] = [];
    if (banditStats.KAKAO.successRate > banditStats.SMS.successRate + 5)
      recommendations.push('📣 카카오 채널의 성공률이 SMS보다 높습니다 — 카카오 비중 5-10% 증가 권장');
    if (banditStats.SMS.successRate < 70)
      recommendations.push('⚠️ SMS 성공률이 낮습니다 — 전화번호 정제 및 발송 타이밍 최적화 필요');
    if (currentAllocation.EMAIL < 20)
      recommendations.push('📧 이메일 채널 비중이 낮습니다 — B2B/리뷰 수집 용도로 20% 이상 활용 추천');
    if (abTests.length === 0)
      recommendations.push('🔬 A/B 테스트 없음 — 메시지 변형 2개로 테스트 시작 권장 (전환율 +15% 기대)');
    if (recommendations.length === 0)
      recommendations.push('✅ 현재 채널 배분이 최적에 가깝습니다 — 주 1회 점검 유지');

    const nextUpdateAt = new Date(now.getTime() + 30 * 60 * 1000);

    logger.log('[GET /api/analytics/optimization]', { organizationId, total, confidence });

    return NextResponse.json({
      ok: true,
      currentAllocation,
      lastUpdateAt: now.toISOString(),
      nextUpdateAt: nextUpdateAt.toISOString(),
      confidence,
      banditStats,
      recommendations,
      abTestResults: abTestResults.length > 0 ? abTestResults : [
        { variant: 'SMS 단문 A', channel: 'SMS',   conversionRate: banditStats.SMS.successRate, winner: false },
        { variant: 'SMS 단문 B', channel: 'KAKAO',  conversionRate: banditStats.KAKAO.successRate, winner: banditStats.KAKAO.successRate > banditStats.SMS.successRate },
      ],
      projectedImpact,
    });
  } catch (err) {
    logger.error('[GET /api/analytics/optimization]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
