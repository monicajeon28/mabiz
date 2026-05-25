import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface AnxietySequenceRequest {
  contactId: string;
  organizationId: string;
  anxietyCategory: 'low' | 'medium' | 'high';
  preparationStage: string;
  smsSequenceTemplate: string;
  visaRequired?: boolean;
  healthConcerns?: string;
}

interface SMSTemplate {
  day: number;
  variant: number;
  content: string;
  type: 'spin_question' | 'guide' | 'testimonial' | 'consultation';
  cta?: string;
  urgency?: 'low' | 'medium' | 'high';
}

interface SequenceSchedule {
  day: number;
  sendTime: string;
  template: SMSTemplate;
  delay: number; // 분 단위
}

/**
 * POST /api/sms/anxiety-sequence
 *
 * L2 렌즈 Day 0-3 SMS 자동화 시퀀스 시작
 * 불안도별, 준비 단계별 맞춤 메시지 발송
 *
 * PASONA + 손실회피 심리학 적용:
 * - P(Problem): 준비 불안감 인식
 * - A(Agitate): 미준비의 위험성
 * - S(Solution): 체계적 가이드 제시
 * - O(Offer): 1:1 상담 제공
 * - N(Narrow): 시간 제한 강조
 * - A(Action): 즉시 예약 유도
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: AnxietySequenceRequest = await request.json();
    const {
      contactId,
      organizationId,
      anxietyCategory,
      preparationStage,
      smsSequenceTemplate,
      visaRequired,
      healthConcerns,
    } = body;

    // SMS 템플릿 선택
    const templates = getSequenceTemplates(
      anxietyCategory,
      preparationStage,
      smsSequenceTemplate,
      visaRequired,
      healthConcerns
    );

    // 실제 발송 스케줄 (Day 0-3)
    const schedules = generateSchedules(templates);

    // 데이터베이스에 시퀀스 시작 기록
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        anxietySequenceStartedAt: new Date(),
        tags: Array.from(
          new Set([
            ...(await prisma.contact.findUnique({
              where: { id: contactId },
              select: { tags: true },
            }).then(c => c?.tags || [])),
            `anxiety_${anxietyCategory}`,
            `prep_${preparationStage}`,
          ])
        ),
      },
    });

    // TODO: 실제 SMS 발송 스케줄링 로직
    // - ScheduledSms 테이블에 저장
    // - 크론 잡으로 Day 0-3 발송 자동화

    return NextResponse.json({
      contactId,
      sequenceStarted: true,
      schedules,
      totalMessages: schedules.length,
      estimatedCompletion: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  } catch (error) {
    console.error('Anxiety SMS sequence error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * SMS 시퀀스 템플릿 생성
 */
function getSequenceTemplates(
  anxietyCategory: string,
  preparationStage: string,
  template: string,
  visaRequired?: boolean,
  healthConcerns?: string
): SMSTemplate[] {
  const baseTemplates: Record<string, SMSTemplate[]> = {
    high_anxiety_support: [
      // Day 0: SPIN 질문으로 시작
      {
        day: 0,
        variant: 1,
        type: 'spin_question',
        content:
          '안녕하세요! 크루즈 예약이 들어오셨네요. 😊\n혹시 해외 여행 경험이 있으신가요?\n(네/아니오)',
        cta: '응답하기',
        urgency: 'low',
      },
      {
        day: 0,
        variant: 2,
        type: 'spin_question',
        content:
          '크루즈 첫 탑승이신가요? 조금 불안하신 부분이 있으실 것 같은데요.\n우리가 도와드릴 수 있습니다!',
        cta: '가이드 보기',
        urgency: 'medium',
      },

      // Day 1: 세그먼트별 가이드
      {
        day: 1,
        variant: 1,
        type: 'guide',
        content:
          '비자 준비부터 시작해볼까요?\n[대사관 연락처 + 체크리스트]\n완벽한 준비로 불안감을 확신으로 바꾸세요.',
        cta: '가이드 다운로드',
        urgency: 'medium',
      },
      {
        day: 1,
        variant: 2,
        type: 'guide',
        content:
          '배멀미 걱정? 선내 의료진과 예방약이 있습니다.\n선박 중앙 선실 선택 팁을 알려드릴게요.',
        cta: '건강 가이드',
        urgency: 'low',
      },

      // Day 2: 실제 사례/증거
      {
        day: 2,
        variant: 1,
        type: 'testimonial',
        content:
          '"첫 크루즈가 걱정되었는데, 완벽한 준비 덕분에 최고의 경험이었어요!"\n- 김예은, 45세 서울\n선배 탑승자의 영상 후기를 보고 결정했습니다.',
        cta: '후기 보기',
        urgency: 'low',
      },
      {
        day: 2,
        variant: 2,
        type: 'testimonial',
        content:
          '가족과 함께 준비한 덕분에 아이들도 너무 즐거워했어요!\n준비 체크리스트가 정말 도움됐습니다.',
        cta: '가족 팁',
        urgency: 'low',
      },

      // Day 3: 긴박감 + 클로징
      {
        day: 3,
        variant: 1,
        type: 'consultation',
        content:
          '🎯 최종 확정 전, 1:1 상담으로 남은 질문을 해결하세요!\n상담사 배정 완료. 지금 예약하시면 즉시 매칭됩니다.',
        cta: '화상 상담 예약',
        urgency: 'high',
      },
      {
        day: 3,
        variant: 2,
        type: 'consultation',
        content:
          '완벽한 준비가 완벽한 여행을 만듭니다.\n궁금한 것은 없으신가요? 전문가와 10분 상담 무료입니다.',
        cta: '상담 예약',
        urgency: 'high',
      },
    ],

    medium_anxiety_support: [
      // Day 0
      {
        day: 0,
        variant: 1,
        type: 'spin_question',
        content: '크루즈 준비 중 궁금한 것이 있으신가요?\n필요한 정보를 빠르게 찾아드릴게요.',
        cta: '준비 가이드',
        urgency: 'low',
      },

      // Day 1
      {
        day: 1,
        variant: 1,
        type: 'guide',
        content:
          '👉 크루즈 첫 탑승? 이것만 준비하세요!\n[체크리스트 + FAQ + 선배 팁]\n지금 바로 확인해보세요.',
        cta: '가이드 보기',
        urgency: 'medium',
      },

      // Day 2
      {
        day: 2,
        variant: 1,
        type: 'testimonial',
        content:
          '같은 상황이었던 분들의 이야기를 들어보세요.\n"준비만 완벽하면 불안감은 사라집니다."',
        cta: '후기 보기',
        urgency: 'low',
      },

      // Day 3
      {
        day: 3,
        variant: 1,
        type: 'consultation',
        content:
          '남은 질문 있으신가요? 언제든 연락주세요.\n상담은 24시간 가능합니다!',
        cta: '상담 요청',
        urgency: 'medium',
      },
    ],

    low_anxiety_support: [
      // Day 1
      {
        day: 1,
        variant: 1,
        type: 'guide',
        content: '🚢 크루즈 탑승 준비물 체크리스트\n이것만 챙기면 완벽합니다!',
        cta: '체크리스트',
        urgency: 'low',
      },

      // Day 2
      {
        day: 2,
        variant: 1,
        type: 'guide',
        content: '예약 완료 축하합니다! 🎉\n탑승 전 마지막 확인사항을 알려드릴게요.',
        cta: '최종 확인',
        urgency: 'low',
      },
    ],

    visa_passport_urgent: [
      // Day 0: 긴박감 + 비자 불안 해소
      {
        day: 0,
        variant: 1,
        type: 'spin_question',
        content:
          '⏰ 비자 + 여권 준비, 남은 시간이 중요합니다!\n지금부터 시작하면 충분합니다.\n준비 상태를 알려주세요.',
        cta: '상태 입력',
        urgency: 'high',
      },

      // Day 1: 가이드 + 체크리스트
      {
        day: 1,
        variant: 1,
        type: 'guide',
        content:
          '🔗 비자 신청 완벽 가이드\n[단계별 서류 + 대사관 연락처 + 소요 시간]\n1시간 안에 끝낼 수 있습니다!',
        cta: '가이드 받기',
        urgency: 'high',
      },

      // Day 2: 진행 상황 확인
      {
        day: 2,
        variant: 1,
        type: 'consultation',
        content:
          '지금 어디까지 진행되셨나요?\n막히는 부분이 있으면 저희가 도와드릴게요!',
        cta: '상담 예약',
        urgency: 'high',
      },

      // Day 3: 최종 확인
      {
        day: 3,
        variant: 1,
        type: 'consultation',
        content:
          '✅ 비자 + 여권 모두 준비됐나요?\n마지막으로 한 번 확인해드릴까요?',
        cta: '최종 확인',
        urgency: 'high',
      },
    ],

    health_concern_support: [
      // Day 0: 건강 불안 인식
      {
        day: 0,
        variant: 1,
        type: 'spin_question',
        content:
          '배멀미, 당뇨, 고혈압... 크루즈 중 괜찮을까?\n완벽한 준비가 답입니다! 💊',
        cta: '건강 가이드',
        urgency: 'medium',
      },

      // Day 1: 건강 가이드 + 의료 안내
      {
        day: 1,
        variant: 1,
        type: 'guide',
        content:
          '🏥 선내 의료 서비스 완벽 가이드\n- 24시간 의료진 상주\n- 선실 냉장고로 약물 보관\n- 식단 조절 가능\n안심하고 여행하세요!',
        cta: '의료 안내',
        urgency: 'medium',
      },

      // Day 2: 실제 관리 팁
      {
        day: 2,
        variant: 1,
        type: 'testimonial',
        content:
          '"당뇨 관리하면서도 크루즈 완벽 즐겼어요!\n선내 영양사와 의사 상담이 정말 도움됐습니다."',
        cta: '당뇨 팁',
        urgency: 'low',
      },

      // Day 3: 최종 상담
      {
        day: 3,
        variant: 1,
        type: 'consultation',
        content:
          '의료진과 사전 상담을 원하신가요?\n예약 후 영상 상담으로 구체적인 준비를 해드릴게요.',
        cta: '사전 상담',
        urgency: 'medium',
      },
    ],

    first_timer_guide: [
      // Day 0: 환영 + 안심
      {
        day: 0,
        variant: 1,
        type: 'spin_question',
        content:
          '🎉 첫 크루즈 여행이시군요!\n설렘과 불안감, 모두 자연스러워요.\n우리가 완벽하게 준비시켜드릴게요!',
        cta: '첫 타이머 가이드',
        urgency: 'low',
      },

      // Day 1: 전체 프로세스 안내
      {
        day: 1,
        variant: 1,
        type: 'guide',
        content:
          '📋 크루즈 탑승부터 하선까지 완전 가이드\n[탑승 절차 + 선박 투어 + 일정표 읽기]\n이 영상 한 개만 봐도 완벽합니다!',
        cta: '가이드 영상',
        urgency: 'low',
      },

      // Day 2: 커뮤니티 + 후기
      {
        day: 2,
        variant: 1,
        type: 'testimonial',
        content:
          '선배들의 진솔한 첫 크루즈 후기 👇\n"이렇게 쉽고 재미있을 줄 몰랐어요!"\n당신도 같은 경험을 할 수 있습니다.',
        cta: '후기 보기',
        urgency: 'low',
      },

      // Day 3: 최종 확인 + 설렘 고조
      {
        day: 3,
        variant: 1,
        type: 'consultation',
        content:
          '🚢 곧 탈 크루즈 배 정보를 미리 알려드릴까요?\n동료 탑승객들과 커뮤니티도 만들어드립니다!\n지금 예약하세요.',
        cta: '배 정보 받기',
        urgency: 'medium',
      },
    ],
  };

  return baseTemplates[template] || baseTemplates.high_anxiety_support;
}

/**
 * SMS 발송 스케줄 생성
 */
function generateSchedules(templates: SMSTemplate[]): SequenceSchedule[] {
  return templates.map((template, idx) => ({
    day: template.day,
    sendTime: calculateSendTime(template.day),
    template,
    delay: calculateDelay(template.day, idx),
  }));
}

/**
 * 발송 시간 계산 (Day별 최적 시간)
 */
function calculateSendTime(day: number): string {
  const times = ['10:00', '14:00', '18:00', '20:00']; // Day 0-3
  return times[Math.min(day, 3)];
}

/**
 * 지연 시간 계산 (분 단위)
 */
function calculateDelay(day: number, variantIdx: number): number {
  return day * 24 * 60 + variantIdx * 30; // 날짜별 + 변형별 간격
}
