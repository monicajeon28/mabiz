import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

/**
 * L10 렌즈 - 시간 압박 긴박감 트리거
 *
 * 심리학 기법:
 * - 손실회피: "지금 아니면 never"
 * - 희소성: 선실, 가격, 일정의 제한성
 * - 사회증명: "2,000명이 이미..."
 */

interface UrgencyTriggerRequest {
  contactId: string;
  urgencyType?: string; // "price_deadline", "seat_availability", "seasonal", "social_proof"
  expiresInHours?: number; // 24, 48, 72
  customReason?: string;
}

const urgencyTriggers: Record<string, Record<number, Record<string, string>>> = {
  // 가격 마감
  price_deadline: {
    24: {
      headline: '⏰ 마지막 24시간: 특가 마감',
      body: `이 가격은 ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}에 끝납니다.`,
      reason: '가격이 25만 원 인상됩니다.',
      psychologyBridge: '손실회피 극대화',
      estimatedConversion: '75-85%',
    },
    48: {
      headline: '⏰ 48시간 남았습니다: 특가 마감',
      body: `이 가격은 ${new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}에 끝납니다.`,
      reason: '가격이 25만 원 인상됩니다.',
      psychologyBridge: '손실회피 중간 수준',
      estimatedConversion: '70-80%',
    },
    72: {
      headline: '⏰ 72시간: 가격 인상 경고',
      body: `이 가격은 ${new Date(Date.now() + 72 * 60 * 60 * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}에 끝납니다.`,
      reason: '가격이 25만 원 인상됩니다.',
      psychologyBridge: '손실회피 약한 수준',
      estimatedConversion: '65-75%',
    },
  },

  // 선실 가용성
  seat_availability: {
    24: {
      headline: '🚢 선실 2개만 남았습니다!',
      body: '당신이 원하던 발코니 선실이 2개만 남았습니다.',
      reason: '다른 고객들도 보고 있습니다.',
      psychologyBridge: '희소성 + 사회증명',
      estimatedConversion: '80-90%',
    },
    48: {
      headline: '🚢 인기 선실 빠르게 매진 중',
      body: '지난 3일간 180명이 신청했습니다. 인기 선실은 5개 남았습니다.',
      reason: '당신의 선실도 다른 누군가를 기다리고 있습니다.',
      psychologyBridge: '희소성 중간 수준',
      estimatedConversion: '72-82%',
    },
    72: {
      headline: '🚢 선실 현황: 70% 매진',
      body: '지난주 기준 70%의 선실이 이미 예약되었습니다.',
      reason: '당신의 날짜는 주말이므로 서둘러야 합니다.',
      psychologyBridge: '희소성 약한 수준',
      estimatedConversion: '68-78%',
    },
  },

  // 시즌/일정 제한
  seasonal: {
    24: {
      headline: '🌴 여름 성수기 마지막 기회',
      body: '여름 휴가 기간의 당신 날짜 크루즈는, 내일 오후 6시 이후 추가 신청이 불가능합니다.',
      reason: '성수기 선실은 빠르게 마감됩니다.',
      psychologyBridge: '시간 + 희소성 + 계절성',
      estimatedConversion: '78-88%',
    },
    48: {
      headline: '🌴 여름 성수기: 48시간만 가능',
      body: '이 가격과 일정의 조합은 이번 시즌 마지막입니다.',
      reason: '7월 성수기 이후는 가격이 다릅니다.',
      psychologyBridge: '시간 제한 + 경제성',
      estimatedConversion: '72-82%',
    },
    72: {
      headline: '🌴 성수기 선택지 감소 중',
      body: '8월 이후 같은 조건의 일정은 품절된 상태입니다.',
      reason: '지금이 이 조건의 크루즈를 탈 수 있는 마지막 기회입니다.',
      psychologyBridge: '계절성 + 시간 유연성',
      estimatedConversion: '68-78%',
    },
  },

  // 사회 증명
  social_proof: {
    24: {
      headline: '👥 오늘 52명이 이미 신청했습니다',
      body: '같은 날 크루즈를 원하는 52명이 오늘 신청했습니다. 당신을 놀라게 할 수도 있는데, 평소 1주일 신청량을 하루 안에 돌파했습니다.',
      reason: '이것이 얼마나 인기 있는 일정인지를 보여줍니다.',
      psychologyBridge: '사회증명 극대화',
      estimatedConversion: '82-92%',
    },
    48: {
      headline: '👥 지난 2일간 150명이 신청했습니다',
      body: '당신과 같은 기간을 원하는 150명이 이미 신청했습니다.',
      reason: '당신도 이 흐름에 함께하세요.',
      psychologyBridge: '사회증명 강화',
      estimatedConversion: '76-86%',
    },
    72: {
      headline: '👥 이 일정은 2,000명 이상이 이미 신청했습니다',
      body: '당신이 고민하는 동안, 2,000명 이상이 같은 크루즈를 선택했습니다.',
      reason: '최고인기 일정입니다.',
      psychologyBridge: '사회증명 중간 수준',
      estimatedConversion: '70-80%',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UrgencyTriggerRequest = await request.json();
    const {
      contactId,
      urgencyType = 'price_deadline',
      expiresInHours = 24,
      customReason,
    } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        name: true,
        phone: true,
        organizationId: true,
        l10ClosingScore: true,
        urgencyLevel: true,
        closingStage: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    if (contact.organizationId !== auth.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 긴박감 트리거 선택
    const triggerData = urgencyTriggers[urgencyType]?.[expiresInHours] ||
      urgencyTriggers.price_deadline[24];

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Contact 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        urgencyLevel: Math.min(100, Math.floor((100 * expiresInHours) / 24)),
        urgencyType: urgencyType,
        urgencyExpiresAt: expiresAt,
        l10ClosingScore: Math.min(100, (contact.l10ClosingScore || 0) + 20),
      },
    });

    return NextResponse.json({
      success: true,
      contactId: updatedContact.id,
      contactName: updatedContact.name,
      urgencyMessage: {
        headline: triggerData.headline,
        body: triggerData.body,
        reason: customReason || triggerData.reason,
        psychologyBridge: triggerData.psychologyBridge,
        estimatedConversion: triggerData.estimatedConversion,
      },
      urgencyMetrics: {
        type: urgencyType,
        level: updatedContact.urgencyLevel,
        expiresAt: expiresAt.toISOString(),
        hoursRemaining: expiresInHours,
      },
      psychologyFramework: {
        technique: 'Loss Aversion + Scarcity + Social Proof',
        mechanism: 'Time pressure 극대화',
        expectedEffect: '신청율 +15-25%',
      },
      followUpActions: [
        {
          timing: '30분 후',
          action: 'Push notification + SMS 발송',
          message: triggerData.headline,
        },
        {
          timing: '6시간 후',
          action: '재확인 콜 (긴박감 재강조)',
          script: '선실이 계속 줄어들고 있습니다. 지금 결정하시는 게 가장 현명합니다.',
        },
        {
          timing: expiresInHours + '시간 후',
          action: '최종 마감 알림 + 클로징',
          message: '이것이 정말 마지막 기회입니다.',
        },
      ],
    });
  } catch (error) {
    logger.error('[POST /api/l10-closing/urgency-trigger]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
