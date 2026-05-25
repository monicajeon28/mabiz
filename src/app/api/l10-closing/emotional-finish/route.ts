import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

/**
 * L10 렌즈 - 감정적 마무리 메시지
 *
 * 심리학 기법:
 * - 스토리텔링: 가족 추억, 꿈 성취, 경험 우월성
 * - 신뢰 강화: "당신을 믿습니다"
 * - 결정 확정: 심리적 commitment
 */

interface EmotionalFinishRequest {
  contactId: string;
  finishType?: string; // "family_legacy", "dream_fulfillment", "experience_excellence"
  customMessage?: string;
}

const emotionalFinishTemplates: Record<string, string[]> = {
  // 가족 유산/추억
  family_legacy: [
    `"당신의 자녀가 이 여행을 평생 기억할 거예요. 아버지(어머니)와 함께한 크루즈, 그것이 바로 당신이 남길 유산입니다."`,
    `"배에서 아이가 보는 일몰, 그 모습이 당신 마음에 얼마나 따뜻하게 남을지 상상해보세요. 이게 바로 당신이 원하던 거 아닐까요?"`,
    `"우리가 돕겠습니다. 당신의 가족을 위해, 당신의 꿈을 위해 모든 준비를 완벽하게 해드릴게요."`,
    `"당신이 이 결정을 한다면, 아이들이 나중에 '그때가 최고였어'라고 말할 거예요."`,
    `"배 위에서 아내(남편)와 손을 잡고 별을 보는 순간, 당신은 인생을 제대로 산 거라고 느낄 겁니다."`,
  ],

  // 꿈 성취
  dream_fulfillment: [
    `"평생 꿈꿔던 크루즈, 이제 정말 현실이 될 거예요. 당신의 꿈을 우리가 완벽하게 만들어드리겠습니다."`,
    `"당신이 이 순간을 놓친다면, 5년 뒤에 '그때 했으면 얼마나 좋았을까'라고 생각할 수도 있어요."`,
    `"꿈은 생각할 때보다 행동할 때 이루어집니다. 이 순간이 바로 당신의 꿈이 시작되는 순간입니다."`,
    `"당신은 이미 결정했어요. 이 여행의 설렘이, 당신을 신청하도록 이끌고 있는 거 맞죠?"`,
    `"평생의 추억이 될 이 여행, 이제 당신의 것으로 만드세요. 우리가 모든 불안감을 제거해드리겠습니다."`,
  ],

  // 경험 우월성
  experience_excellence: [
    `"일반 여행과 크루즈의 차이를 아세요? 당신이 할 경험은 다른 누구보다 특별할 거예요."`,
    `"5성 리조트, 미슐랭 레스토랑, 전 세계 최고의 엔터테인먼트가 한 배에 있다면? 당신이 이미 거기 있는 거예요."`,
    `"당신이 경험할 것은 단순한 여행이 아닙니다. 그것은 당신의 인생을 바꿀 경험입니다."`,
    `"세상에 5%의 사람만 경험하는 크루즈 여행, 당신도 이제 그 5% 안에 들어갈 준비가 됐어요."`,
    `"당신의 선택이 맞습니다. 이 여행을 통해 당신은 세상을 다른 눈으로 보게 될 거예요."`,
  ],

  // 신뢰와 안심
  trust_assurance: [
    `"우리는 25년 동안 5만 명 이상의 크루즈 여행객을 봤습니다. 당신의 모든 불안감, 우리가 해결해드릴 수 있습니다."`,
    `"당신이 무엇을 원하든, 우리가 100% 준비하겠습니다. 이것이 우리의 약속입니다."`,
    `"이 순간이 맞아요. 당신의 직감이 틀린 적이 없었잖아요."`,
    `"2,000명이 당신 앞서서 같은 결정을 했어요. 그리고 그들은 모두 감사했습니다."`,
    `"당신을 믿습니다. 당신의 선택이 최고의 선택이 되도록 우리가 모든 책임을 지겠습니다."`,
  ],

  // 긴박감 + 희소성
  urgency_scarcity: [
    `"이 가격은 오늘까지입니다. 내일 아침 8시부터는 250만 원이 올라갑니다. 당신의 최종 결정은?"`,
    `"선실은 2개 남았습니다. 이 선실은 최고 위치의 발코니 선실입니다. 당신이 지금 놓친다면 누가 신청할 거고, 당신은 다시 이 기회를 보지 못할 거예요."`,
    `"2주 뒤 비슷한 날짜의 크루즈는 일정이 가득 참니다. 지금 당신에게 주어진 이 기회는, 앞으로 3개월 동안 다시는 없습니다."`,
    `"당신을 위해 특별히 준비한 이 가격과 날짜 조합은, 실은 다른 고객도 보고 있습니다. 당신이 결정하는 이 순간이, 정말로 마지막입니다."`,
    `"당신의 꿈을 잠깐만 더 미루면, 6개월이 되고, 1년이 됩니다. 지금 신청하세요. 당신의 인생 변화가 시작됩니다."`,
  ],
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: EmotionalFinishRequest = await request.json();
    const {
      contactId,
      finishType = 'family_legacy',
      customMessage,
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
        emotionalConnectionScore: true,
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

    // 감정적 마무리 메시지 선택
    const messages = emotionalFinishTemplates[finishType] || emotionalFinishTemplates.family_legacy;
    const selectedMessage = customMessage || messages[Math.floor(Math.random() * messages.length)];

    // Contact 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        emotionalFinishSentAt: new Date(),
        emotionalFinishType: finishType,
        emotionalConnectionScore: Math.min(
          100,
          (contact.emotionalConnectionScore || 0) + 25
        ),
        l10ClosingScore: Math.min(100, (contact.l10ClosingScore || 0) + 15),
        closingStage: 'closed',
      },
    });

    return NextResponse.json({
      success: true,
      contactId: updatedContact.id,
      contactName: updatedContact.name,
      emotionalMessage: selectedMessage,
      finishType: finishType,
      psychologyFramework: {
        technique: 'Emotional Storytelling + Trust Building',
        emotionalConnectionScore: updatedContact.emotionalConnectionScore,
        l10ClosingScore: updatedContact.l10ClosingScore,
        expectedOutcome: '80-95% 신청 완료',
      },
      followUp: {
        timing: '30분 내',
        action: 'SMS Day 0 확인 메시지',
        message: '신청 완료! 우리가 100% 준비하겠습니다.',
      },
      memo: {
        content: `L10 감정적 마무리 전달됨 (${finishType}). 심리적 commitment 강화. 다음 액션: 신청 확인.`,
        internalOnly: true,
      },
    });
  } catch (error) {
    logger.error('[POST /api/l10-closing/emotional-finish]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
