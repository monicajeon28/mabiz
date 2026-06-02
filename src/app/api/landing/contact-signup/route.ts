/**
 * Landing Page Contact Auto-Creation API
 * POST /api/landing/contact-signup
 *
 * 크루즈닷 랜딩페이지 신청 → Contact 자동생성 → 렌즈 감지 → Day 0 SMS 큐 등록
 *
 * Request Body:
 * {
 *   name: string,
 *   email: string,
 *   phone: string,
 *   problem: string? (신청 문제),
 *   travelType: string? (국내/해외/프리미염),
 *   budget: string? (20-30만원/130만원/159만원)
 * }
 */

import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { detectLandingLens } from '@/lib/landing-lens-detector';
import { encryptLandingNotes } from '@/lib/sensitive-data-encryption';

export async function POST(request: Request) {
  try {
    // 1. 조직 인증
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 요청 본문 파싱
    const body = await request.json();
    const { name, email, phone, problem, travelType, budget } = body;

    // 3. 필수 필드 검증
    if (!name || !email || !phone) {
      return Response.json(
        {
          error: '이름, 이메일, 폰번호는 필수입니다',
          fields: { name: !!name, email: !!email, phone: !!phone }
        },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: '올바른 이메일 형식이 아닙니다' },
        { status: 400 }
      );
    }

    // 폰번호 형식 검증 (010-0000-0000 또는 01000000000)
    const phoneClean = phone.replace(/-/g, '');
    const phoneRegex = /^01[0-9]\d{7,8}$/;
    if (!phoneRegex.test(phoneClean)) {
      return Response.json(
        { error: '올바른 폰번호 형식이 아닙니다' },
        { status: 400 }
      );
    }

    // 4. 중복 가입 확인
    const existingContact = await prisma.contact.findFirst({
      where: {
        organizationId: session.organizationId,
        email: email.toLowerCase(),
        deletedAt: null
      }
    });

    if (existingContact) {
      // 이미 가입된 고객이지만 성공으로 처리 (멱등성)
      return Response.json(
        {
          success: true,
          contactId: existingContact.id,
          isDuplicate: true,
          message: '이미 가입된 이메일입니다. 매니저가 2시간 내 연락 드릴 예정입니다'
        },
        { status: 200 }
      );
    }

    // 5. 렌즈 감지
    const lens = detectLandingLens({
      problem,
      travelType,
      budget
    });

    // 6. 태그 생성/연결 (자동화)
    // Contact 모델의 tags는 String[] 배열이므로 직접 저장
    const tagsArray = [
      'Landing_Signup',
      `Lens_${lens}`,
      'Day0_SMS_Queued'
    ];

    // 골드 회원 프로그램 관심 시 태그 추가
    if (travelType === 'gold-member' || problem?.includes('골드')) {
      tagsArray.push('Gold_Member_Interest');
    }

    // 7. Contact 생성
    // adminMemo: 민감 정보 암호화 (AES-256-GCM)
    const encryptedMemo = encryptLandingNotes({
      travelType,
      budget,
      problem
    });

    const contact = await prisma.contact.create({
      data: {
        organizationId: session.organizationId,
        name: name.trim(),
        email: email.toLowerCase(),
        phone: phoneClean,
        type: 'INQUIRY',
        channel: 'landing_page',
        utmSource: 'LANDING_CRUISEDOT',
        cruiseInterest: travelType || undefined,
        budgetRange: budget || undefined,
        adminMemo: encryptedMemo,
        tags: tagsArray
      }
    });

    // 8. Contact Lens Classification 자동 생성
    // (Day 0-3 SMS 시퀀스 트리거)
    await prisma.contactLensClassification.upsert({
      where: {
        organizationId_contactId_lensType: {
          organizationId: session.organizationId,
          contactId: contact.id,
          lensType: lens
        }
      },
      create: {
        organizationId: session.organizationId,
        contactId: contact.id,
        lensType: lens,
        lensLabel: getLensLabel(lens),
        confidenceScore: 75,
        identificationMethod: 'LANDING_FORM',
        status: 'ACTIVE',
        decisionLevel: 1,
        readinessScore: 50
      },
      update: {
        confidenceScore: 75,
        status: 'ACTIVE'
      }
    });

    // 9. 감사 로그
    logLandingSignup({
      contactId: contact.id,
      email: contact.email,
      phone: contact.phone,
      lens,
      travelType,
      budget,
      timestamp: new Date().toISOString()
    });

    // 10. 성공 응답
    return Response.json({
      success: true,
      contactId: contact.id,
      lens,
      message: '신청 완료! 매니저가 2시간 내 연락 드릴 예정입니다.',
      nextAction: 'AWAITING_MANAGER_CONTACT',
      smsScheduledFor: 'Day 0 (지금 바로)'
    });

  } catch (error) {
    console.error('[landing-contact-signup] 에러:', error);

    // 데이터베이스 관련 에러 로깅
    if (error instanceof Error) {
      console.error('[landing-contact-signup] 에러 메시지:', error.message);
      console.error('[landing-contact-signup] 스택:', error.stack);
    }

    return Response.json(
      {
        error: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * 렌즈 타입별 레이블
 */
function getLensLabel(lens: string): string {
  const labels: Record<string, string> = {
    'L0': '부재중',
    'L1': '가격이의',
    'L2': '준비불안',
    'L3': '경쟁사',
    'L4': '피처중심',
    'L5': '의료신뢰',
    'L6': '타이밍',
    'L7': '동반자',
    'L8': '재구매',
    'L9': '신뢰도',
    'L10': '클로징'
  };
  return labels[lens] || '미분류';
}

/**
 * 감사 로그: 나중에 분석용 DB 저장 가능
 */
function logLandingSignup(data: any) {
  const logData = {
    ...data,
    level: 'INFO',
    service: 'landing-contact-signup'
  };
  console.log('[LandingSignupLog]', JSON.stringify(logData, null, 2));
}

// OPTIONS 메서드 (CORS 프리플라이트)
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
