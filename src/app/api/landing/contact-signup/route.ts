/**
 * Landing Page Contact Auto-Creation API
 * POST /api/landing/contact-signup
 *
 * 크루즈닷 랜딩페이지 신청 → Contact 자동생성 → 렌즈 감지 → Day 0-3 SMS 큐 등록
 *
 * Request Body:
 * {
 *   name: string (2-50자),
 *   email: string (유효한 이메일),
 *   phone: string (010-XXXX-XXXX),
 *   problem?: string (신청 문제),
 *   travelType?: string (국내/해외/프리미엄),
 *   budget?: string (20-30만원/130만원/159만원)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   contactId: string,
 *   lens: "L0" | "L1" | "L2" | "L6" | "L10",
 *   message: string,
 *   nextAction: string,
 *   smsScheduledFor: "Day 0-3 자동화 예정"
 * }
 */

import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { detectLandingLens, LENS_SMS_TEMPLATES, type LandingLensType } from '@/lib/landing-lens-detector';
import { encryptLandingNotes } from '@/lib/sensitive-data-encryption';
import { checkRateLimitAsync } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic'; // 쿠키·헤더 의존 → 정적 캐싱 방지

export async function POST(request: Request) {
  try {
    // 0. IP 기반 Rate Limiting (60초 윈도우 내 최대 10건)
    const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const rl = await checkRateLimitAsync(`landing_signup:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return Response.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 });
    }

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

    // 이름 길이 검증 (2-50자)
    if (name.length < 2 || name.length > 50) {
      return Response.json(
        { error: '이름은 2-50자 사이여야 합니다' },
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
        { error: '올바른 폰번호 형식이 아닙니다 (010-1234-5678 형식)' },
        { status: 400 }
      );
    }

    // 4. 중복 가입 확인 (이메일 + 폰번호)
    const existingContact = await prisma.contact.findFirst({
      where: {
        organizationId: session.organizationId,
        email: email.toLowerCase(),
        deletedAt: null
      }
    });

    if (existingContact) {
      // 이미 가입된 고객이지만 성공으로 처리 (멱등성) — contactId 제거로 열거 공격 방지
      return Response.json(
        {
          success: true,
          isDuplicate: true,
          message: '이미 가입된 이메일입니다. 매니저가 2시간 내 연락 드릴 예정입니다',
          nextAction: 'DUPLICATE_CHECK'
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

    // 7. 매니저 자동 배정 (WeightedRoundRobin)
    const assignedManagerId = await assignManagerByWeightedRoundRobin(
      session.organizationId
    );

    // 8. Contact 생성
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
        tags: tagsArray,
        assignedUserId: assignedManagerId || undefined
      }
    });

    // 9. Contact Lens Classification 자동 생성
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

    // 10. Day 0-3 SMS 자동화 큐 등록
    const smsQueue = await scheduleDay0To3Sms(
      session.organizationId,
      contact.id,
      lens as LandingLensType
    );

    // 11. 감사 로그 (PII 마스킹)
    logLandingSignup({
      contactId: contact.id,
      email: contact.email ? `***@${contact.email.split('@')[1]}` : undefined,
      phone: contact.phone ? `****${contact.phone.slice(-4)}` : undefined,
      lens,
      travelType,
      budget,
      assignedManagerId,
      smsQueueSize: smsQueue.length,
      timestamp: new Date().toISOString()
    });

    // 12. 성공 응답
    return Response.json({
      success: true,
      lens,
      message: '신청 완료! 매니저가 2시간 내 연락 드릴 예정입니다.',
      nextAction: 'AWAITING_MANAGER_CONTACT',
      smsScheduledFor: `Day 0-3 자동화 예정 (${smsQueue.length}건)`
      // contactId, smsQueue 배열 제거 — 내부 ID 열거/스케줄 구조 노출 방지
    });

  } catch (error) {
    console.error('[landing-contact-signup] 에러:', error);

    // 데이터베이스 관련 에러 로깅
    if (error instanceof Error) {
      console.error('[landing-contact-signup] 에러 메시지:', error.message);
      if (process.env.NODE_ENV !== 'production') {
        console.error('[landing-contact-signup] 스택:', error.stack);
      }
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
 * 매니저 가중치 기반 자동 배정 (WeightedRoundRobin)
 *
 * Manager 역할 사용자 중 할당된 Contact 수가 적은 사람에게 우선 배정
 * 가중치: 할당된 Contact 수 (적을수록 높은 우선순위)
 *
 * @param organizationId 조직 ID
 * @returns 배정된 Manager의 userId (없으면 null)
 */
async function assignManagerByWeightedRoundRobin(
  organizationId: string
): Promise<string | null> {
  try {
    // Manager 역할 사용자 조회
    const managers = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: 'MANAGER',
      },
      select: {
        userId: true
      }
    });

    if (managers.length === 0) {
      console.warn(
        `[landing-contact-signup-manager] No MANAGER found in org: ${organizationId}`
      );
      return null;
    }

    // 각 Manager의 할당된 Contact 수 계산
    const managerLoadList = await Promise.all(
      managers.map(async (manager) => {
        const contactCount = await prisma.contact.count({
          where: {
            organizationId,
            assignedUserId: manager.userId,
            deletedAt: null
          }
        });

        return {
          userId: manager.userId,
          contactCount
        };
      })
    );

    // 가장 적게 할당된 Manager 선택 (가중치 기반)
    const selectedManager = managerLoadList.reduce((prev, current) => {
      return current.contactCount < prev.contactCount ? current : prev;
    });

    console.log(
      `[landing-contact-signup-manager] Assigned to manager`,
      {
        managerId: selectedManager.userId,
        currentLoad: selectedManager.contactCount,
        totalManagers: managers.length
      }
    );

    return selectedManager.userId;
  } catch (error) {
    console.error('[landing-contact-signup-manager-error]', error);
    return null;
  }
}

/**
 * Day 0-3 SMS 자동화 큐 등록
 * 렌즈별 PASONA 템플릿을 사용하여 4건의 ScheduledSms 생성
 *
 * @param organizationId 조직 ID
 * @param contactId Contact ID
 * @param lens 감지된 렌즈 (L0|L1|L2|L6|L10)
 * @returns 생성된 ScheduledSms 배열
 */
async function scheduleDay0To3Sms(
  organizationId: string,
  contactId: string,
  lens: LandingLensType
): Promise<Array<{ id: string; scheduledAt: Date; delayHours: number }>> {
  try {
    // 렌즈별 메시지 템플릿 가져오기
    const templates = LENS_SMS_TEMPLATES[lens];
    if (!templates) {
      console.warn(`[landing-contact-signup] Unknown lens: ${lens}`);
      return [];
    }

    // Day 0-3 스케줄 (시간 단위)
    const schedules = [
      { day: 0, delayMinutes: 0, messageKey: 'day0' },      // 즉시
      { day: 1, delayMinutes: 1440, messageKey: 'day1' },   // 24시간 후
      { day: 2, delayMinutes: 2880, messageKey: 'day2' },   // 48시간 후
      { day: 3, delayMinutes: 4320, messageKey: 'day3' }    // 72시간 후
    ];

    const createdSmsList: Array<{ id: string; scheduledAt: Date; delayHours: number }> = [];
    const now = new Date();

    // 각 일정에 따라 ScheduledSms 생성
    for (const schedule of schedules) {
      const scheduledAt = new Date(now.getTime() + schedule.delayMinutes * 60 * 1000);
      const message = templates[schedule.messageKey as keyof typeof templates] || templates.day0;

      try {
        const scheduledSms = await prisma.scheduledSms.create({
          data: {
            organizationId,
            contactId,
            message,
            scheduledAt,
            status: 'PENDING',
            channel: 'GENERAL',
            // 메타데이터 추가 (향후 분석용)
            createdByUserId: undefined
          }
        });

        createdSmsList.push({
          id: scheduledSms.id,
          scheduledAt: scheduledSms.scheduledAt,
          delayHours: schedule.delayMinutes / 60
        });

        console.log(
          `[landing-contact-signup-sms] Day ${schedule.day} SMS created`,
          {
            contactId,
            scheduledSmsId: scheduledSms.id,
            lens,
            scheduledAt: scheduledAt.toISOString()
          }
        );
      } catch (smsError) {
        console.error(
          `[landing-contact-signup-sms-error] Failed to schedule Day ${schedule.day} SMS`,
          smsError
        );
        // SMS 생성 실패해도 Contact 생성은 유지 (비치명적)
      }
    }

    return createdSmsList;
  } catch (error) {
    console.error('[landing-contact-signup-sms-queue-error]', error);
    return [];
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

interface LandingSignupLogData {
  contactId: string;
  email?: string;
  phone?: string;
  lens: string;
  travelType?: string;
  budget?: string;
  assignedManagerId?: string | null;
  smsQueueSize: number;
  timestamp: string;
}

/**
 * 감사 로그: 나중에 분석용 DB 저장 가능
 */
function logLandingSignup(data: LandingSignupLogData) {
  // PII 마스킹: phone/email을 로그에 직접 노출하지 않음 (개인정보보호법 준수)
  const masked = {
    ...data,
    phone: data.phone
      ? `${data.phone.slice(0, 3)}****${data.phone.slice(-4)}`
      : undefined,
    email: data.email
      ? `${data.email.slice(0, 2)}***@${data.email.split('@')[1] ?? ''}`
      : undefined,
    level: 'INFO',
    service: 'landing-contact-signup',
  };
  console.log('[LandingSignupLog]', JSON.stringify(masked));
}

// OPTIONS 메서드 (CORS 프리플라이트)
export async function OPTIONS(_request: Request) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://mabizcruisedot.com';
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
