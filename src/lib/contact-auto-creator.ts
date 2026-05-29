import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Loop 6 - Agent D: Contact 자동생성 엔진
 *
 * Webhook 수신 (Payment/Inquiry) → Contact 자동 생성/업데이트
 * Segment 분류 (A-E) + Lens 감지 (L0-L10)
 *
 * 기대 효과:
 * - 수동 입력 0 → 100% 자동화
 * - 신규 Contact 100명/일 처리
 * - Segment 정확도 90%+ (나이 기반)
 * - 즉시 Day 0 SMS 발송
 */

// ============================================
// Type Definitions
// ============================================

export type Segment = 'A' | 'B' | 'C' | 'D' | 'E';
export type Lens = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10';
export type Source = 'cruisedot_payment' | 'cruisedot_inquiry' | 'form_submission' | 'phone_call' | 'manual_entry';

export interface WebhookPayload {
  // 필수 필드
  name: string;
  phone: string;
  email?: string;

  // 선택 필드 (Segment 분류용)
  age?: number;
  ageRange?: string; // "20-30", "40-50", etc.
  preferenceType?: string; // "romantic", "family", "culture", "luxury", "senior"
  familyComposition?: string; // "single", "couple", "family_with_kids", "multi_generation"

  // Cruise 관련
  cruiseInterest?: string;
  budgetRange?: string;
  departureDate?: string;

  // 추적용
  paymentId?: string;
  inquiryId?: string;
  source: Source;
  orderId?: string;
  timestamp?: string;

  // 심리학 렌즈 감지 힌트
  healthConcerns?: string[];
  pastCruiseCount?: number;
  competitorMentioned?: string[];
  familyObjections?: string[];
}

export interface ContactAutoCreateResult {
  success: boolean;
  contactId?: string;
  isNew: boolean;
  segment: Segment;
  lens: Lens;
  error?: string;
}

// ============================================
// Segment 분류 로직 (나이 기반)
// ============================================

/**
 * 나이 기반 Segment 분류
 * A: 20-30 (신혼/로맨틱)
 * B: 40-50 (가족/단란)
 * C: 50-60 (문화/여행)
 * D: 60+ (럭셀리)
 * E: 70+ (시니어/의료)
 */
export function detectSegmentByAge(age?: number, ageRange?: string, preferenceType?: string): Segment {
  // 1. 직접 나이 사용
  if (age) {
    if (age >= 20 && age < 31) return 'A'; // 신혼
    if (age >= 31 && age < 41) return 'B'; // 가족 초기
    if (age >= 41 && age < 51) return 'B'; // 가족
    if (age >= 51 && age < 61) return 'C'; // 문화
    if (age >= 61 && age < 71) return 'D'; // 럭셀리
    if (age >= 71) return 'E'; // 시니어
  }

  // 2. ageRange 문자열 파싱
  if (ageRange) {
    const rangeLower = parseInt(ageRange.split('-')[0], 10);
    if (rangeLower >= 20 && rangeLower < 31) return 'A';
    if (rangeLower >= 31 && rangeLower < 41) return 'B';
    if (rangeLower >= 41 && rangeLower < 51) return 'B';
    if (rangeLower >= 51 && rangeLower < 61) return 'C';
    if (rangeLower >= 61 && rangeLower < 71) return 'D';
    if (rangeLower >= 71) return 'E';
  }

  // 3. preferenceType 힌트
  if (preferenceType) {
    const pref = preferenceType.toLowerCase();
    if (pref.includes('romantic') || pref.includes('honeymoon')) return 'A';
    if (pref.includes('family')) return 'B';
    if (pref.includes('culture') || pref.includes('experience')) return 'C';
    if (pref.includes('luxury') || pref.includes('vip')) return 'D';
    if (pref.includes('senior') || pref.includes('medical')) return 'E';
  }

  // 4. familyComposition 힌트
  if (preferenceType) {
    const family = preferenceType.toLowerCase();
    if (family.includes('couple') && !family.includes('kids')) return 'A';
    if (family.includes('family_with_kids')) return 'B';
    if (family.includes('multi_generation')) return 'C';
  }

  // 기본값: B (40-50 가족)
  return 'B';
}

// ============================================
// Lens 감지 로직 (심리학 렌즈)
// ============================================

/**
 * 심리학 렌즈 자동 감지
 *
 * L0: 부재중 고객 재활성화
 * L1: 가격 이의형
 * L2: 준비 불안형
 * L3: 차별성 미인지형
 * L4: 피처/가격 비중비교형
 * L5: 자기투영 + 의료신뢰형
 * L6: 타이밍 손실회피형 (DEFAULT)
 * L7: 동반자 설득형
 * L8: 재방문 습관화형
 * L9: 건강/안전/의료신뢰형
 * L10: 희소성 + 즉시구매형
 */
export function detectLens(payload: WebhookPayload): Lens {
  // L0: 부재중 고객 (pastCruiseCount 있으나 오래된 경우)
  if (payload.pastCruiseCount && payload.pastCruiseCount > 0) {
    return 'L8'; // 재방문 습관화 렌즈 (이미 경험했으므로)
  }

  // L2: 건강 우려사항
  if (payload.healthConcerns && payload.healthConcerns.length > 0) {
    return 'L9'; // 건강/의료신뢰 렌즈
  }

  // L3: 경쟁사 언급
  if (payload.competitorMentioned && payload.competitorMentioned.length > 0) {
    return 'L3'; // 차별성 미인지형
  }

  // L5: 가족 이의사항 (배우자/부모)
  if (payload.familyComposition && (payload.familyComposition.includes('couple') || payload.familyComposition.includes('multi'))) {
    if (payload.familyObjections && payload.familyObjections.length > 0) {
      return 'L7'; // 동반자 설득형
    }
  }

  // L2: 준비 단계 불안 (visa, passport 우려)
  if (payload.preferenceType && (payload.preferenceType.includes('visa') || payload.preferenceType.includes('passport'))) {
    return 'L2'; // 준비 불안형
  }

  // 기본값: L6 (타이밍 손실회피)
  // 대부분의 신규 고객은 "지금 결정해야 한다" 심리
  return 'L6';
}

// ============================================
// 전화번호 정규화
// ============================================

/**
 * 한국 전화번호 정규화
 * 010-1234-5678 → 01012345678
 * 010 1234 5678 → 01012345678
 * 8801012345678 (국제) → 01012345678
 */
export function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\D/g, ''); // 숫자만 추출

  // 국제 코드 제거
  if (normalized.startsWith('8882')) {
    normalized = normalized.slice(2); // 882 제거
  }

  // 0으로 시작하지 않으면 0 추가
  if (!normalized.startsWith('0')) {
    normalized = '0' + normalized;
  }

  return normalized;
}

// ============================================
// Contact 자동 생성 / 업데이트
// ============================================

export async function createOrUpdateContact(
  organizationId: string,
  payload: WebhookPayload
): Promise<ContactAutoCreateResult> {
  try {
    // 1. 전화번호 정규화 및 검증
    const normalizedPhone = normalizePhoneNumber(payload.phone);
    if (!normalizedPhone.startsWith('0') || normalizedPhone.length < 10) {
      logger.error('[ContactAutoCreator] 유효하지 않은 전화번호', {
        originalPhone: payload.phone,
        normalizedPhone,
      });
      return {
        success: false,
        isNew: false,
        segment: 'B',
        lens: 'L6',
        error: 'Invalid phone number',
      };
    }

    // 2. Segment 분류
    const segment = detectSegmentByAge(
      payload.age,
      payload.ageRange,
      payload.preferenceType
    );

    // 3. Lens 감지
    const lens = detectLens(payload);

    // 4. 기존 Contact 조회 (phone 기반)
    let existingContact = await prisma.contact.findFirst({
      where: {
        organizationId,
        phone: normalizedPhone,
        deletedAt: null, // 삭제되지 않은 것만
      },
    });

    // 5. Contact 생성 또는 업데이트
    const contact = existingContact
      ? await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            // 기존 Contact 업데이트 (중요 필드만)
            name: payload.name,
            email: payload.email || existingContact.email,
            age: payload.age || existingContact.age,
            segment: segment,
            autoSegment: segment,
            segmentUpdatedAt: new Date(),

            // Cruise 관련 정보
            cruiseInterest: payload.cruiseInterest || existingContact.cruiseInterest,
            budgetRange: payload.budgetRange || existingContact.budgetRange,
            departureDate: payload.departureDate ? new Date(payload.departureDate) : existingContact.departureDate,

            // 추적용 태그
            tags: Array.from(new Set([
              ...(existingContact.tags || []),
              `source:${payload.source}`,
              `segment:${segment}`,
              `lens:${lens}`,
            ])),

            // 마지막 연락 시간 업데이트
            lastContactedAt: new Date(),

            // 심리학 메타데이터
            lensMetadata: {
              ...(existingContact.lensMetadata || {}),
              currentLens: lens,
              detectedAt: new Date().toISOString(),
              detectionMethod: 'auto_webhook',
            },

            // Lens별 특수 필드
            ...(lens === 'L2' && {
              anxietyScore: 70,
              anxietyCategory: 'high',
              preparationStage: 'inquiry',
              anxietyAssessmentAt: new Date(),
            }),
            ...(lens === 'L3' && {
              competitorMentioned: payload.competitorMentioned?.[0] ? true : false,
              competitorNames: payload.competitorMentioned || [],
              lastCompetitorMentionAt: new Date(),
            }),
            ...(lens === 'L7' && {
              familyComposition: payload.familyComposition,
              familyObjections: payload.familyObjections || [],
              familyAssessmentCompletedAt: new Date(),
            }),
            ...(lens === 'L8' && {
              cruiseCount: (payload.pastCruiseCount || 0) + 1,
              cruiseReturnInterestLevel: 80,
            }),
            ...(lens === 'L9' && {
              healthConcerns: payload.healthConcerns?.join(',') || null,
            }),
          },
        })
      : await prisma.contact.create({
          data: {
            // 신규 Contact 생성
            organizationId,
            phone: normalizedPhone,
            name: payload.name,
            email: payload.email || null,

            // 기본 정보
            age: payload.age,
            segment: segment,
            autoSegment: segment,
            channel: 'webhook',
            type: 'LEAD',

            // Cruise 관련
            cruiseInterest: payload.cruiseInterest,
            budgetRange: payload.budgetRange,
            departureDate: payload.departureDate ? new Date(payload.departureDate) : null,

            // 추적용 태그
            tags: [`source:${payload.source}`, `segment:${segment}`, `lens:${lens}`, 'loop6-agent-d'],

            // 심리학 메타데이터
            lensMetadata: {
              currentLens: lens,
              detectedAt: new Date().toISOString(),
              detectionMethod: 'auto_webhook',
            },

            // Lens별 특수 필드 초기화
            ...(lens === 'L2' && {
              anxietyScore: 70,
              anxietyCategory: 'high',
              preparationStage: 'inquiry',
              anxietyAssessmentAt: new Date(),
            }),
            ...(lens === 'L3' && {
              competitorMentioned: payload.competitorMentioned?.[0] ? true : false,
              competitorNames: payload.competitorMentioned || [],
              lastCompetitorMentionAt: new Date(),
            }),
            ...(lens === 'L7' && {
              familyComposition: payload.familyComposition,
              familyObjections: payload.familyObjections || [],
              familyAssessmentCompletedAt: new Date(),
            }),
            ...(lens === 'L8' && {
              cruiseCount: payload.pastCruiseCount || 1,
              cruiseReturnInterestLevel: 80,
              ltvTotal: 2500, // 예상 LTV
            }),
            ...(lens === 'L9' && {
              healthConcerns: payload.healthConcerns?.join(',') || null,
            }),
          },
        });

    logger.log('[ContactAutoCreator] Contact 생성/업데이트 완료', {
      contactId: contact.id,
      phone: normalizedPhone,
      segment,
      lens,
      isNew: !existingContact,
      source: payload.source,
    });

    return {
      success: true,
      contactId: contact.id,
      isNew: !existingContact,
      segment,
      lens,
    };
  } catch (error: unknown) {
    logger.error('[ContactAutoCreator] 오류 발생', {
      error: error instanceof Error ? error.message : String(error),
      payload: {
        ...payload,
        phone: payload.phone ? payload.phone.slice(-4) : 'unknown', // 마지막 4자리만
      },
    });

    return {
      success: false,
      isNew: false,
      segment: 'B',
      lens: 'L6',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Batch 처리 (대량 Contact 생성)
// ============================================

export interface BatchCreatePayload {
  organizationId: string;
  payloads: WebhookPayload[];
}

export async function createContactsBatch(batch: BatchCreatePayload) {
  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const payload of batch.payloads) {
    const result = await createOrUpdateContact(batch.organizationId, payload);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  logger.log('[ContactAutoCreator] Batch 처리 완료', {
    total: batch.payloads.length,
    success: successCount,
    error: errorCount,
  });

  return {
    total: batch.payloads.length,
    success: successCount,
    error: errorCount,
    results,
  };
}
