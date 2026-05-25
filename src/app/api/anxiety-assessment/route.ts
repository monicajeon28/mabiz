import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

interface AnxietyAssessmentRequest {
  contactId: string;
  organizationId: string;
  // SPIN 질문 답변
  hasCruiseExperience: boolean;
  visaRequired: boolean;
  passportExpiryDays: number;
  hasKids: boolean;
  healthConcerns: string[]; // 배멀미, 당뇨, 고혈압 등
  // 심리학 레이어
  preparationComplexity: number; // 1-5
  confidenceLevel: number; // 1-5
}

interface AnxietyAssessmentResponse {
  contactId: string;
  anxietyScore: number; // 0-125
  anxietyCategory: 'low' | 'medium' | 'high';
  preparationStage: string;
  breakdown: {
    visaRequired: number;
    passportDaysLeft: number;
    firstTimeCruise: number;
    familyWithKids: number;
    healthConcerns: number;
  };
  recommendations: string[];
  nextActions: string[];
  smsSequenceTemplate: string; // Day 0-3 자동화 템플릿명
}

/**
 * L2 렌즈: 준비 불안도 평가 엔드포인트
 * SPIN 질문법 기반 5단계 anxiety assessment
 *
 * 불안도 산출 알고리즘:
 * - visa_required: Y → +40점
 * - passport_days_left: <180 → +30점 (급할수록 높음)
 * - first_time_cruise: Y → +20점
 * - family_with_kids: Y → +20점
 * - health_concerns: +15점 (항목당)
 * - preparation_complexity_score: 복잡도 × 5
 * - confidence_gap: (5 - confidence) × 8
 * Total: 80점 이상 = high_anxiety
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const body: AnxietyAssessmentRequest = await request.json();
    const {
      contactId,
      hasCruiseExperience,
      visaRequired,
      passportExpiryDays,
      hasKids,
      healthConcerns,
      preparationComplexity,
      confidenceLevel,
    } = body;

    // 불안도 점수 계산
    let anxietyScore = 0;
    const breakdown = {
      visaRequired: 0,
      passportDaysLeft: 0,
      firstTimeCruise: 0,
      familyWithKids: 0,
      healthConcerns: 0,
    };

    // 1. 비자 필요 (+40)
    if (visaRequired) {
      anxietyScore += 40;
      breakdown.visaRequired = 40;
    }

    // 2. 여권 유효기간 (+0-30)
    if (passportExpiryDays < 180) {
      const daysScore = Math.max(0, 30 - (passportExpiryDays / 6));
      anxietyScore += daysScore;
      breakdown.passportDaysLeft = Math.ceil(daysScore);
    }

    // 3. 첫 크루즈 여행 (+20)
    if (!hasCruiseExperience) {
      anxietyScore += 20;
      breakdown.firstTimeCruise = 20;
    }

    // 4. 자녀 동반 (+20)
    if (hasKids) {
      anxietyScore += 20;
      breakdown.familyWithKids = 20;
    }

    // 5. 건강 관련 우려 (+15 per concern)
    if (healthConcerns && healthConcerns.length > 0) {
      const healthScore = healthConcerns.length * 15;
      anxietyScore += healthScore;
      breakdown.healthConcerns = healthScore;
    }

    // 6. 준비 복잡도 점수 (복잡도 × 5, max 25)
    anxietyScore += Math.min(preparationComplexity * 5, 25);

    // 7. 자신감 격차 점수 ((5 - confidence) × 8, max 32)
    anxietyScore += Math.max(0, (5 - confidenceLevel) * 8);

    // 불안도 분류
    let anxietyCategory: 'low' | 'medium' | 'high';
    if (anxietyScore >= 80) {
      anxietyCategory = 'high';
    } else if (anxietyScore >= 40) {
      anxietyCategory = 'medium';
    } else {
      anxietyCategory = 'low';
    }

    // 준비 단계 파악
    let preparationStage = 'inquiry';
    if (visaRequired) preparationStage = 'visa_concern';
    if (healthConcerns?.length > 0) preparationStage = 'health_concern';
    if (passportExpiryDays < 180) preparationStage = 'passport_concern';
    if (anxietyScore < 20) preparationStage = 'ready';

    // 맞춤 추천사항
    const recommendations: string[] = [];
    if (visaRequired) {
      recommendations.push('비자 신청 프로세스 가이드 제공');
      recommendations.push('대사관 연락처 및 체크리스트 공유');
    }
    if (passportExpiryDays < 180) {
      recommendations.push('여권 갱신 절차 안내');
      recommendations.push('긴급 갱신 옵션 (급행) 설명');
    }
    if (healthConcerns?.includes('배멀미')) {
      recommendations.push('배멀미 관리 팁 및 약물 정보');
      recommendations.push('선실 위치 선택 가이드');
    }
    if (healthConcerns?.includes('당뇨') || healthConcerns?.includes('고혈압')) {
      recommendations.push('식단 관리 및 의료 서비스 안내');
      recommendations.push('선내 의료진 소개');
    }
    if (!hasCruiseExperience) {
      recommendations.push('크루즈 첫 탑승자 가이드');
      recommendations.push('선배 탑승자 영상 및 후기 공유');
    }
    if (hasKids) {
      recommendations.push('가족 동반 크루즈 팁');
      recommendations.push('키즈 프로그램 안내');
    }

    // 다음 액션
    const nextActions: string[] = [];
    if (anxietyCategory === 'high') {
      nextActions.push('1:1 상담사 배정 및 화상 상담 예약');
      nextActions.push('Day 0 SMS: 불안도 진단 봇 시작');
      nextActions.push('Day 1 SMS: 세그먼트별 가이드 PDF 발송');
    } else if (anxietyCategory === 'medium') {
      nextActions.push('이메일로 준비 가이드 발송');
      nextActions.push('FAQ 및 자료실 링크 제공');
      nextActions.push('필요시 상담 예약 가능 안내');
    } else {
      nextActions.push('예약 확정 축하 메시지');
      nextActions.push('기본 준비물 체크리스트 제공');
    }

    // SMS 시퀀스 템플릿 결정
    let smsSequenceTemplate = 'default';
    if (anxietyCategory === 'high') {
      smsSequenceTemplate = 'high_anxiety_support';
    } else if (visaRequired && passportExpiryDays < 180) {
      smsSequenceTemplate = 'visa_passport_urgent';
    } else if (healthConcerns?.length > 0) {
      smsSequenceTemplate = 'health_concern_support';
    } else if (!hasCruiseExperience) {
      smsSequenceTemplate = 'first_timer_guide';
    }

    // 조직 격리 검증: contactId가 현재 조직 소속인지 확인
    const contactExists = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: { id: true },
    });
    if (!contactExists) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // 데이터베이스 저장
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        anxietyScore,
        anxietyCategory,
        preparationStage,
        visaRequired,
        passportDaysLeft: passportExpiryDays,
        firstTimeCruise: !hasCruiseExperience,
        familyWithKids: hasKids,
        healthConcerns: healthConcerns?.join(','),
        anxietyAssessmentAt: new Date(),
      },
    });

    const response: AnxietyAssessmentResponse = {
      contactId,
      anxietyScore: Math.ceil(anxietyScore),
      anxietyCategory,
      preparationStage,
      breakdown,
      recommendations,
      nextActions,
      smsSequenceTemplate,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[POST /api/anxiety-assessment]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET: 고객의 불안도 평가 조회
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId required' },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: {
        id: true,
        name: true,
        phone: true,
        anxietyScore: true,
        anxietyCategory: true,
        preparationStage: true,
        visaRequired: true,
        passportDaysLeft: true,
        firstTimeCruise: true,
        familyWithKids: true,
        healthConcerns: true,
        anxietyAssessmentAt: true,
        anxietySequenceStartedAt: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    logger.error('[GET /api/anxiety-assessment]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
