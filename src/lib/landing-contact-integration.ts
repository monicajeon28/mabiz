/**
 * Landing Page → CRM Contact Integration
 *
 * 역할:
 * 1. 랜딩 페이지 양식 제출 → Contact 생성
 * 2. 렌즈 감지 → 최적 SMS 템플릿 선택
 * 3. Day 0-3 SMS 자동 스케줄
 * 4. 매니저 자동 할당 (Weighted Round-Robin)
 * 5. Risk Flag 자동 생성 + Lead Score 계산
 */

import { prisma as db } from '@/lib/prisma';
import { selectSmsSequence } from './landing-sms-templates';

/**
 * 랜딩 페이지 양식 데이터
 */
export interface LandingFormData {
  name: string;
  phone: string;
  email?: string;
  budgetRange?: string; // "33-50", "50-70", "70-100", "100+"
  interests?: string[]; // ["domestic", "japan", "southeast_asia", "family"]
  hasPassport?: boolean;
  travelersCount?: number;
  source?: string; // "web", "kakao", "naver"
  organizationId: string;
}

/**
 * Step 1: Contact 생성 또는 업데이트
 */
export async function createOrUpdateContact(
  data: LandingFormData
): Promise<{ contactId: string; isNewContact: boolean; lens: string }> {
  const existingContact = await db.contact.findFirst({
    where: {
      phone: data.phone,
      organizationId: data.organizationId,
      deletedAt: null
    }
  });

  if (existingContact) {
    // 기존 Contact 업데이트
    await db.contact.update({
      where: { id: existingContact.id },
      data: {
        name: data.name,
        email: data.email || existingContact.email,
        budgetRange: data.budgetRange || existingContact.budgetRange,
        type: 'INQUIRY',
        tags: Array.from(
          new Set([...(existingContact.tags || []), 'landing-revisit'])
        ),
        updatedAt: new Date()
      }
    });

    return {
      contactId: existingContact.id,
      isNewContact: false,
      lens: detectLens(existingContact)
    };
  }

  // 신규 Contact 생성
  const newContact = await db.contact.create({
    data: {
      phone: data.phone,
      name: data.name,
      email: data.email,
      organizationId: data.organizationId,
      type: 'INQUIRY',
      budgetRange: data.budgetRange,
      cruiseInterest: (data.interests || []).join(','),
      tags: ['landing-new', data.source || 'web'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  return {
    contactId: newContact.id,
    isNewContact: true,
    lens: detectLens(newContact)
  };
}

/**
 * Step 2: 렌즈 감지 (Landing Page 전용)
 *
 * Heuristics:
 * - L0: 기본값
 * - L1: budgetRange = "33-50" (가격 민감)
 * - L2: hasPassport = false (준비 불안)
 * - L3: tags 포함 "comparing" (경쟁사 비교)
 * - L6: 이전 방문 + 24h 미만 (타이밍/긴박감)
 * - L7: travelersCount >= 5 (동반자)
 * - L8: purchasedAt 존재 (재구매)
 * - L9: tags 포함 "health-concern" (건강/의료)
 * - L10: purchasedAt + 재구매 신청 (클로징)
 */
function detectLens(contact: any): string {
  // L10: 재구매 고객
  if (contact.purchasedAt && contact.reEngageCount > 0) {
    return 'L10';
  }

  // L9: 건강 관심
  if (contact.tags?.includes('health-concern')) {
    return 'L9';
  }

  // L8: 재구매 고객
  if (contact.purchasedAt) {
    return 'L8';
  }

  // L6: 재방문 (24h 미만) — Date/string 양쪽 안전 처리
  if (contact.lastContactedAt) {
    const ts = contact.lastContactedAt instanceof Date
      ? contact.lastContactedAt.getTime()
      : new Date(contact.lastContactedAt).getTime();
    if (!isNaN(ts) && (Date.now() - ts) / (1000 * 60 * 60) < 24) {
      return 'L6';
    }
  }

  // L7: 동반자/그룹
  if (contact.tags?.includes('group') || contact.tags?.includes('family')) {
    return 'L7';
  }

  // L3: 경쟁사 비교
  if (contact.tags?.includes('comparing')) {
    return 'L3';
  }

  // L2: 준비 불안
  if (contact.tags?.includes('passport-concern')) {
    return 'L2';
  }

  // L1: 가격 민감
  if (
    contact.budgetRange === '33-50' ||
    contact.adminMemo?.includes('low-budget')
  ) {
    return 'L1';
  }

  // L0: 기본값
  return 'L0';
}

/**
 * Step 3: Day 0-3 SMS 자동 스케줄
 *
 * 주의: 현재 SmsQueue 모델은 Contact 링크가 없으므로,
 * CRM 시스템의 별도 SMS 큐 메커니즘 사용
 * (예: workflows, automations 등)
 */
export async function scheduleDay0To3SMS(
  contactId: string,
  organizationId: string,
  lens: string
): Promise<void> {
  const smsTemplate = selectSmsSequence(lens);

  // Contact에 SMS 시퀀스 메타데이터 저장
  // 실제 발송은 workflow engine이 담당
  const smsSchedule = {
    contactId,
    lens,
    sequences: [
      { day: 0, message: smsTemplate.day0, scheduled: new Date() },
      {
        day: 1,
        message: smsTemplate.day1,
        scheduled: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        day: 2,
        message: smsTemplate.day2,
        scheduled: new Date(Date.now() + 48 * 60 * 60 * 1000)
      },
      {
        day: 3,
        message: smsTemplate.day3,
        scheduled: new Date(Date.now() + 72 * 60 * 60 * 1000)
      }
    ]
  };

  // Contact 메모에 SMS 스케줄 저장 (임시 구현)
  await db.contact.update({
    where: { id: contactId },
    data: {
      adminMemo: JSON.stringify(smsSchedule),
      tags: ['sms_day0_3_scheduled']
    }
  });

  console.log(`[SMS Scheduled] Contact: ${contactId}, Lens: ${lens}, Days: 0-3`);
}

/**
 * Step 4: 매니저 자동 할당 (Weighted Round-Robin)
 *
 * 렌즈별 매니저 우선순위:
 * - L0: 온보딩 전문가
 * - L1: 가치 전달 전문가 (가격 이의 대응)
 * - L2: 신뢰 구축 전문가 (불안 해소)
 * - L6: 클로징 전문가 (긴박감/긴급)
 * - L10: 최고급 매니저 (VIP)
 */
export async function assignManagerAuto(
  contactId: string,
  lens: string,
  organizationId: string
): Promise<string | null> {
  // 렌즈별 매니저 타입 매핑
  const lensToManagerType = {
    L0: 'onboarding_specialist',
    L1: 'value_expert',
    L2: 'trust_builder',
    L3: 'competitor_handler',
    L6: 'closing_specialist',
    L7: 'group_coordinator',
    L8: 'loyalty_manager',
    L9: 'medical_advisor',
    L10: 'vip_manager'
  };

  const managerType =
    lensToManagerType[lens as keyof typeof lensToManagerType] ||
    'onboarding_specialist';

  // 해당 타입의 매니저 중 가장 한적한 사람 찾기 (Weighted Round-Robin)
  // 주의: User 모델이 없으면 이 함수는 선택적으로 사용
  // 실제 구현 시 실제 User 모델 구조에 맞게 조정 필요
  const managers: any[] = [];

  // 임시: User 모델이 없을 경우 대응
  // const managers = await db.user.findMany({...});

  // 현재는 User 모델이 정의되지 않아 매니저 할당 기능 제외
  // 실제 User 모델이 추가되면 아래 코드 활성화:
  // if (managers.length === 0) return null;
  // const assignedManager = managers[0];

  // 임시: 태그만 생성
  await db.contact.update({
    where: { id: contactId },
    data: {
      lastContactedAt: new Date(),
      tags: ['manager_pending', `manager_type_${managerType}`] // 추적용 태그
    }
  });

  console.log(
    `[Manager Assignment Pending] Contact: ${contactId}, Lens: ${lens}, ManagerType: ${managerType}`
  );

  return null; // 실제 구현 시 manager ID 반환
}

/**
 * Step 5: Risk Flag 자동 생성 + Lead Score 계산
 */
export async function generateRiskFlagsAndScore(
  contactId: string,
  organizationId: string,
  formData: LandingFormData
): Promise<{ riskFlags: string[]; leadScore: number }> {
  const riskFlags: string[] = [];
  let leadScore = 50; // 기본값

  // 위험 신호 감지
  if (!formData.hasPassport) {
    riskFlags.push('no_passport');
    leadScore -= 10;
  }

  if (!formData.email) {
    riskFlags.push('no_email');
    leadScore -= 5;
  }

  if (formData.budgetRange === '33-50') {
    riskFlags.push('price_sensitive');
    leadScore -= 5;
  }

  if (!formData.interests || formData.interests.length === 0) {
    riskFlags.push('unclear_preference');
    leadScore -= 10;
  }

  // 긍정 신호
  if (formData.email) {
    leadScore += 10;
  }

  if (formData.travelersCount && formData.travelersCount >= 2) {
    leadScore += 15; // 그룹 예약 = 높은 전환율
  }

  if (formData.hasPassport) {
    leadScore += 20; // 여권 있음 = 준비 완료
  }

  // Contact 업데이트
  await db.contact.update({
    where: { id: contactId },
    data: {
      leadScore,
      tags: Array.from(new Set([...riskFlags, 'landing_scored']))
    }
  });

  return { riskFlags, leadScore };
}

/**
 * 통합 함수: 랜딩 페이지 양식 제출 → 전체 자동화 실행
 *
 * 반환값:
 * - contactId: 생성/업데이트된 Contact ID
 * - successMessage: 클라이언트에 표시할 메시지
 */
export async function processLandingFormSubmission(
  formData: LandingFormData
): Promise<{
  contactId: string;
  lens: string;
  leadScore: number;
  successMessage: string;
  error?: string;
}> {
  try {
    // Step 1: Contact 생성/업데이트
    const contactResult = await createOrUpdateContact(formData);
    const { contactId, isNewContact, lens } = contactResult;

    // Step 2: Day 0-3 SMS 스케줄
    await scheduleDay0To3SMS(contactId, formData.organizationId, lens);

    // Step 3: 매니저 자동 할당
    await assignManagerAuto(contactId, lens, formData.organizationId);

    // Step 4: Risk Flag + Lead Score
    const { leadScore } = await generateRiskFlagsAndScore(
      contactId,
      formData.organizationId,
      formData
    );

    // Step 5: 감사 로그
    console.log(`[Landing Form] Contact: ${contactId}, Lens: ${lens}, Score: ${leadScore}`);

    return {
      contactId,
      lens,
      leadScore,
      successMessage: isNewContact
        ? '신청 완료! 2시간 내 매니저가 연락드릴게요. 😊'
        : '업데이트 완료! 더 좋은 상품으로 안내해드릴게요. 💚',
      error: undefined
    };
  } catch (error) {
    console.error('[Landing Form Error]', error);
    return {
      contactId: '',
      lens: '',
      leadScore: 0,
      successMessage: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 매니저 통계 (매니저별 담당 Contact 수)
 */
export async function getManagerWorkload(
  organizationId: string
): Promise<
  Array<{
    managerId: string;
    managerName: string;
    contactCount: number;
  }>
> {
  const stats = await db.contact.groupBy({
    by: ['assignedUserId'],
    where: {
      organizationId,
      deletedAt: null,
      assignedUserId: { not: null }
    },
    _count: {
      id: true
    }
  });

  // 실제 User 모델이 있을 경우만 매니저 이름 조회
  // 현재는 ID만 반환
  const result = stats.map((stat: any) => ({
    managerId: stat.assignedUserId!,
    managerName: stat.assignedUserId!,
    contactCount: stat._count.id
  }));

  return result.sort((a: any, b: any) => a.contactCount - b.contactCount);
}
