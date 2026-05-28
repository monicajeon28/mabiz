import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 신뢰도 계산 (Chi-square 추정)
function calculateConfidence(variant1Clicks: number, variant1Total: number, variant2Clicks: number, variant2Total: number): number {
  if (variant1Total < 30 || variant2Total < 30) return 0;

  const rate1 = variant1Clicks / variant1Total;
  const rate2 = variant2Clicks / variant2Total;
  const pooledRate = (variant1Clicks + variant2Clicks) / (variant1Total + variant2Total);
  const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / variant1Total + 1 / variant2Total));
  const z = Math.abs((rate1 - rate2) / se);

  // Z-score to confidence mapping
  if (z > 2.576) return 99; // 99%
  if (z > 1.96) return 95;  // 95%
  if (z > 1.645) return 90; // 90%
  if (z > 1.282) return 80; // 80%
  return Math.min(z * 15, 75); // 부분적 신뢰도
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: 'fromDate and toDate are required' },
        { status: 400 }
      );
    }

    // ab_test_assignments 테이블에서 A/B 할당 정보
    const { data: assignments, error: assignError } = await supabase
      .from('ab_test_assignments')
      .select('contact_id, variant, test_type, created_at')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (assignError) throw assignError;

    // campaign_events에서 클릭 및 제출 데이터
    const { data: campaignEvents, error: eventError } = await supabase
      .from('campaign_events')
      .select('contact_id, event_type, created_at, variant')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (eventError) throw eventError;

    // CTA 테스트 결과 (A vs B vs C)
    const ctaVariants = ['a', 'b', 'c'];
    const ctaTests: any[] = [];

    ctaVariants.forEach(variant => {
      const variantAssignments = assignments?.filter(
        a => a.test_type === 'CTA' && a.variant === variant
      ) || [];

      const variantClicks = campaignEvents?.filter(
        e => e.variant === variant && e.event_type === 'LINK_CLICKED'
      ).length || 0;

      const clickRate = variantAssignments.length > 0
        ? (variantClicks / variantAssignments.length) * 100
        : 0;

      ctaTests.push({
        variant: variant.toUpperCase(),
        clicks: variantClicks,
        total: variantAssignments.length,
        rate: Math.round(clickRate * 10) / 10,
      });
    });

    // 신뢰도 및 우승자 계산
    if (ctaTests.length >= 2) {
      const confidence = calculateConfidence(
        ctaTests[0].clicks,
        ctaTests[0].total,
        ctaTests[1].clicks,
        ctaTests[1].total
      );

      ctaTests.forEach((test: any) => {
        test.confidence = confidence;
      });

      const winner = ctaTests.reduce((a: any, b: any) => a.rate > b.rate ? a : b);
      if (confidence >= 95) {
        winner.winner = true;
      }
    }

    // SMS 메시지 버전 테스트 (Day별)
    const smsTests: any[] = [];
    const dayRange = [0, 1, 2, 3];

    dayRange.forEach(day => {
      const dayStart = new Date(fromDate);
      dayStart.setDate(dayStart.getDate() + day);
      const dayPrefix = dayStart.toISOString().split('T')[0];

      ['v1', 'v2'].forEach(version => {
        const versionAssignments = assignments?.filter(
          a =>
            a.test_type === 'SMS' &&
            a.variant === version &&
            a.created_at.startsWith(dayPrefix)
        ) || [];

        const versionClicks = campaignEvents?.filter(
          e =>
            e.variant === version &&
            e.event_type === 'LINK_CLICKED' &&
            e.created_at.startsWith(dayPrefix)
        ).length || 0;

        const clickRate = versionAssignments.length > 0
          ? (versionClicks / versionAssignments.length) * 100
          : 0;

        smsTests.push({
          day,
          version,
          clicks: versionClicks,
          total: versionAssignments.length,
          rate: Math.round(clickRate * 10) / 10,
          recommended: false,
        });
      });
    });

    // SMS 각 day에서 최고 성과 버전 강조
    dayRange.forEach(day => {
      const dayTests = smsTests.filter(t => t.day === day);
      const best = dayTests.reduce((a: any, b: any) => a.rate > b.rate ? a : b, null);
      if (best && best.total > 10) {
        best.recommended = true;
      }
    });

    return NextResponse.json({
      ctaTests,
      smsTests,
      summary: {
        totalVariants: ctaTests.length,
        totalSmsTests: smsTests.length,
        recommendation:
          ctaTests[0]?.winner && ctaTests[0]?.rate > ctaTests[1]?.rate
            ? `CTA Variant ${ctaTests[0].variant}가 ${ctaTests[0].rate}% 클릭율로 우수`
            : 'A/B 테스트 진행 중',
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Loop5 A/B test results error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch A/B test results' },
      { status: 500 }
    );
  }
}
