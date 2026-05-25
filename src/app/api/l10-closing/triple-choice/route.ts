import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth-middleware';

/**
 * L10 렌즈 - 삼중선택 클로징 오퍼 생성
 *
 * 심리학 기법:
 * - 삼중선택: 선택지 제한으로 신청 회피 불가능
 * - 비율: 즉시(40%) > 내일(45%) > 주말(15%)
 * - 감정 트리거: 가족, 꿈, 모험
 */

interface TripleChoiceRequest {
  contactId: string;
  emotionalTrigger?: string; // "family_reunion", "dream_achieved", "adventure"
  emotionalTone?: string; // "hopeful", "fearful", "excited"
  timeframe?: string; // "24hours", "3days", "1week"
}

interface TripleChoice {
  option_a: {
    label: string;
    description: string;
    emoji: string;
    psychologyBridge: string;
    selectedRate: number;
  };
  option_b: {
    label: string;
    description: string;
    emoji: string;
    psychologyBridge: string;
    selectedRate: number;
  };
  option_c: {
    label: string;
    description: string;
    emoji: string;
    psychologyBridge: string;
    selectedRate: number;
  };
}

const tripleChoiceVariations: Record<string, Record<string, TripleChoice>> = {
  // 가족 재회 시나리오
  family_reunion: {
    hopeful: {
      option_a: {
        label: '오늘 신청',
        description: '아이의 첫 크루즈, 지금 예약하면 선실 최고',
        emoji: '⭐',
        psychologyBridge: '손실회피: 지금 아니면 never',
        selectedRate: 42,
      },
      option_b: {
        label: '내일 신청',
        description: '내일 예약해도 선실 충분함',
        emoji: '💭',
        psychologyBridge: '합리성: 시간의 여유',
        selectedRate: 43,
      },
      option_c: {
        label: '주말 신청',
        description: '주말에 다시 생각해보고 신청',
        emoji: '⏰',
        psychologyBridge: '결정 유예: 최후의 방어',
        selectedRate: 15,
      },
    },
    fearful: {
      option_a: {
        label: '지금 바로 신청 (선실 보장)',
        description: '지금 신청하면 100% 최고 선실 확정',
        emoji: '🔒',
        psychologyBridge: '확실성: 위험 제거',
        selectedRate: 50,
      },
      option_b: {
        label: '내일 신청 (85% 선실 확정)',
        description: '내일 신청해도 좋은 선실 있을 가능성',
        emoji: '⚖️',
        psychologyBridge: '위험도 선택: 약간의 불안',
        selectedRate: 35,
      },
      option_c: {
        label: '주말 신청 (60% 확률)',
        description: '주말에 신청하면 선실 없을 가능성',
        emoji: '❌',
        psychologyBridge: '손실: 후회의 씨앗',
        selectedRate: 15,
      },
    },
    excited: {
      option_a: {
        label: '오늘 신청! 🎉',
        description: '지금 신청하면 우리가 12시간 내 확정',
        emoji: '🚀',
        psychologyBridge: '긴급감: 움직임의 힘',
        selectedRate: 45,
      },
      option_b: {
        label: '내일 신청 (추천)',
        description: '내일 신청해도 모든 선실 가능',
        emoji: '✅',
        psychologyBridge: '권위성: "추천"의 신뢰',
        selectedRate: 40,
      },
      option_c: {
        label: '주말 신청',
        description: '시간이 있으면 주말에 신청',
        emoji: '🌙',
        psychologyBridge: '미결정 선택',
        selectedRate: 15,
      },
    },
  },

  // 꿈 성취 시나리오
  dream_achieved: {
    hopeful: {
      option_a: {
        label: '꿈의 크루즈, 오늘 예약',
        description: '평생 꿈이던 크루즈, 이제 시작하세요',
        emoji: '✨',
        psychologyBridge: '자기투영: 꿈과 현실의 만남',
        selectedRate: 40,
      },
      option_b: {
        label: '일주일 내 예약',
        description: '준비하면서 설렘을 곱씹기',
        emoji: '🎁',
        psychologyBridge: '기대감: 준비 과정의 즐거움',
        selectedRate: 45,
      },
      option_c: {
        label: '나중에 생각하기',
        description: '차분히 고민한 후 신청',
        emoji: '⏸️',
        psychologyBridge: '유예: 결정 미루기',
        selectedRate: 15,
      },
    },
    fearful: {
      option_a: {
        label: '꿈을 놓치지 마세요 (지금)',
        description: '이 가격은 다시 안 나옵니다',
        emoji: '⛔',
        psychologyBridge: '희소성: 이번 기회',
        selectedRate: 52,
      },
      option_b: {
        label: '일주일 내 (70% 할인 보장)',
        description: '일주일 내 신청하면 할인 유지',
        emoji: '📅',
        psychologyBridge: '보증: 안전의 폭 확대',
        selectedRate: 33,
      },
      option_c: {
        label: '나중에 (할인 미보장)',
        description: '나중에 신청하면 할인 적용 안 될 수 있음',
        emoji: '📈',
        psychologyBridge: '가격 상승: 손실의 위험',
        selectedRate: 15,
      },
    },
    excited: {
      option_a: {
        label: '꿈의 크루즈 지금 신청! 🎊',
        description: '지금 신청하면 당신의 꿈이 확정됩니다',
        emoji: '🌟',
        psychologyBridge: '즉시성: 행동의 힘',
        selectedRate: 48,
      },
      option_b: {
        label: '3일 내 신청 (확정)',
        description: '3일 내 신청해도 모든 혜택 동일',
        emoji: '💯',
        psychologyBridge: '유연성: 시간의 여유',
        selectedRate: 37,
      },
      option_c: {
        label: '여유 있을 때 신청',
        description: '시간이 나면 신청',
        emoji: '❓',
        psychologyBridge: '미결정: 선택 회피',
        selectedRate: 15,
      },
    },
  },

  // 모험/경험 시나리오
  adventure: {
    hopeful: {
      option_a: {
        label: '모험을 시작하세요 (지금)',
        description: '당신의 새로운 경험이 기다려요',
        emoji: '🏝️',
        psychologyBridge: '기대감: 경험의 시작',
        selectedRate: 41,
      },
      option_b: {
        label: '한 주 내 예약',
        description: '준비하면서 기대감을 키우기',
        emoji: '🗓️',
        psychologyBridge: '준비: 설렘의 과정',
        selectedRate: 44,
      },
      option_c: {
        label: '생각해본 후 예약',
        description: '충분히 고민한 후 신청',
        emoji: '🤔',
        psychologyBridge: '신중함: 결정의 유예',
        selectedRate: 15,
      },
    },
    fearful: {
      option_a: {
        label: '이 모험, 지금 놓치면 1년 뒤 (지금)',
        description: '같은 시간대, 같은 가격은 내년',
        emoji: '⏳',
        psychologyBridge: '시간 손실: 긴박감',
        selectedRate: 51,
      },
      option_b: {
        label: '72시간 내 (가격 보장)',
        description: '3일 내 신청하면 이 가격 유지',
        emoji: '🔐',
        psychologyBridge: '보증 폭 확대: 안전',
        selectedRate: 34,
      },
      option_c: {
        label: '나중에 (가격 미보장)',
        description: '시간이 지나면 가격이 올라갑니다',
        emoji: '❗',
        psychologyBridge: '비용 상승: 경제적 손실',
        selectedRate: 15,
      },
    },
    excited: {
      option_a: {
        label: '모험 시작하기! (지금 신청) 🎯',
        description: '지금 예약하면 12시간 내 모든 확정',
        emoji: '⚡',
        psychologyBridge: '즉각성: 행동 유도',
        selectedRate: 46,
      },
      option_b: {
        label: '5일 내 예약 (추천) ✅',
        description: '5일 내 신청해도 모든 혜택 동일',
        emoji: '👍',
        psychologyBridge: '권위성: 추천의 신뢰',
        selectedRate: 39,
      },
      option_c: {
        label: '시간 될 때 예약',
        description: '여유가 생기면 신청',
        emoji: '😐',
        psychologyBridge: '무결정: 선택 방지',
        selectedRate: 15,
      },
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: TripleChoiceRequest = await request.json();
    const {
      contactId,
      emotionalTrigger = 'family_reunion',
      emotionalTone = 'hopeful',
      timeframe = '24hours',
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
        emotionalTriggers: true,
        closingStage: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    if (contact.organizationId !== auth.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 삼중선택 오퍼 생성
    const selectedVariation = tripleChoiceVariations[emotionalTrigger]?.[emotionalTone] ||
      tripleChoiceVariations.family_reunion.hopeful;

    // Contact 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        emotionalTriggers: emotionalTrigger
          ? [emotionalTrigger, ...contact.emotionalTriggers.filter(t => t !== emotionalTrigger)]
          : contact.emotionalTriggers,
        tripleChoiceOffered: true,
        l10ClosingScore: Math.min(100, (contact.l10ClosingScore || 0) + 20),
        closingStage: 'ready_close',
        l10ClosingAttempts: (contact.l10ClosingAttempts || 0) + 1,
      },
    });

    return NextResponse.json({
      success: true,
      contactId: updatedContact.id,
      contactName: updatedContact.name,
      tripleChoice: selectedVariation,
      psychologyTips: {
        trigger: emotionalTrigger,
        tone: emotionalTone,
        bridge: '시간 압박 + 선택지 제한 = 신청 확정',
        expectedConversion: '70-95%',
      },
      nextSteps: {
        onSelectionImmediate: 'Immediate closing + gratitude',
        onSelectionNextDay: 'Confirmation call + excitement building',
        onSelectionWeekend: 'Follow-up message + scarcity reminder',
      },
    });
  } catch (error) {
    console.error('Error in triple-choice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
