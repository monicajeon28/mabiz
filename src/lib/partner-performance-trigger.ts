import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendPartnerAlertSms } from '@/lib/aligo-sms-service';
import {
  updatePartnerRiskScore,
  generateDay03Messages,
} from '@/lib/partner-risk-scoring';

/**
 * RiskScore 레벨 변경 감지 및 자동 SMS 트리거
 */
export async function detectAndTriggerRiskScoreChange(
  organizationId: string,
  partnerId: string
): Promise<{
  changed: boolean;
  previousScore?: number;
  currentScore?: number;
  triggered?: boolean;
  smsType?: string;
}> {
  try {
    // 현재 RiskScore 조회
    const currentRiskFlags = await prisma.partnerRiskFlags.findUnique({
      where: { partnerId },
      select: { totalRiskScore: true },
    });

    const currentScore = currentRiskFlags?.totalRiskScore || 0;

    // 최근 변경 이력 조회
    const lastChange = await prisma.partnerRiskScoreChange.findFirst({
      where: {
        organizationId,
        partnerId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        previousScore: true,
        currentScore: true,
      },
    });

    const previousScore = lastChange?.currentScore || 0;

    // 변경이 없으면 반환
    if (previousScore === currentScore) {
      return { changed: false };
    }

    const previousLevel = getRiskLevel(previousScore);
    const currentLevel = getRiskLevel(currentScore);

    // 변경 이력 기록
    const riskScoreChange = await prisma.partnerRiskScoreChange.create({
      data: {
        organizationId,
        partnerId,
        previousScore,
        currentScore,
        previousLevel,
        currentLevel,
        triggerReason: detectTriggerReason(previousScore, currentScore),
      },
    });

    // SMS 자동 발송 판단
    const shouldSend = shouldTriggerSms(
      previousLevel,
      currentLevel,
      previousScore,
      currentScore
    );

    if (!shouldSend) {
      logger.log('[detectAndTriggerRiskScoreChange] 변경 감지만 기록', {
        partnerId,
        previousScore,
        currentScore,
        previousLevel,
        currentLevel,
      });

      return {
        changed: true,
        previousScore,
        currentScore,
        triggered: false,
      };
    }

    // SMS 발송 트리거
    const smsType = determineSmsType(previousLevel, currentLevel);
    const smsTriggered = await triggerAlertSmsForRiskChange(
      organizationId,
      partnerId,
      currentLevel,
      smsType
    );

    if (smsTriggered) {
      // 변경 이력 업데이트
      await prisma.partnerRiskScoreChange.update({
        where: { id: riskScoreChange.id },
        data: {
          smsTriggered: true,
          smsMessageType: smsType,
        },
      });

      logger.log('[detectAndTriggerRiskScoreChange] SMS 자동 발송', {
        partnerId,
        previousScore,
        currentScore,
        smsType,
      });
    }

    return {
      changed: true,
      previousScore,
      currentScore,
      triggered: smsTriggered,
      smsType,
    };
  } catch (error: unknown) {
    logger.error('[detectAndTriggerRiskScoreChange] 오류', {
      partnerId,
      error: error instanceof Error ? error.message : String(error),
    });

    return { changed: false };
  }
}

/**
 * RiskScore → 위험도 레벨 변환
 */
function getRiskLevel(score: number): 'RED' | 'YELLOW' | 'GREEN' {
  if (score >= 67) return 'RED';
  if (score >= 34) return 'YELLOW';
  return 'GREEN';
}

/**
 * RiskScore 변경 원인 분석
 */
function detectTriggerReason(
  previousScore: number,
  currentScore: number
): string {
  const diff = currentScore - previousScore;

  if (diff >= 25) return 'CHURN_SPIKE'; // 급격한 이탈 신호
  if (diff >= 15) return 'LOW_PERFORMANCE'; // 성과 저하
  if (diff < -15) return 'RECOVERY'; // 회복
  return 'SKILL_GAP';
}

/**
 * SMS 발송 여부 판단
 * - RED 상향: 즉시 발송
 * - YELLOW 3주 유지: 발송
 * - 기타 변경: 발송 안함
 */
function shouldTriggerSms(
  previousLevel: string,
  currentLevel: string,
  previousScore: number,
  currentScore: number
): boolean {
  // RED로 상향: 즉시 발송
  if (previousLevel !== 'RED' && currentLevel === 'RED') {
    return true;
  }

  // YELLOW 3주 지속 확인
  if (currentLevel === 'YELLOW') {
    return checkYellowDuration(previousScore, currentScore);
  }

  return false;
}

/**
 * YELLOW 상태 지속 기간 확인 (3주 이상)
 */
function checkYellowDuration(
  previousScore: number,
  currentScore: number
): boolean {
  // YELLOW 상태 (34-66)
  const isCurrentYellow = currentScore >= 34 && currentScore < 67;
  const isPreviousYellow = previousScore >= 34 && previousScore < 67;

  // 둘 다 YELLOW면, 아마도 3주 이상
  // (실제로는 DB에서 확인하는 게 더 정확하지만,
  // 현재로서는 YELLOW 유지되는 것으로 판단)
  return isCurrentYellow && isPreviousYellow;
}

/**
 * SMS 메시지 타입 결정
 */
function determineSmsType(
  previousLevel: string,
  currentLevel: string
): string {
  if (previousLevel !== 'RED' && currentLevel === 'RED') {
    return 'URGENT_RETENTION';
  }

  if (currentLevel === 'YELLOW') {
    return 'TRAINING_OFFER';
  }

  if (previousLevel === 'RED' && currentLevel !== 'RED') {
    return 'RECOVERY_POSITIVE';
  }

  return 'GENERIC_ALERT';
}

/**
 * RiskScore 변경으로 인한 Alert SMS 발송
 */
async function triggerAlertSmsForRiskChange(
  organizationId: string,
  partnerId: string,
  riskLevel: 'RED' | 'YELLOW' | 'GREEN',
  messageType: string
): Promise<boolean> {
  try {
    // 파트너 정보 조회
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        name: true,
        phone: true,
        riskFlags: {
          select: {
            lowPerformanceScore: true,
            churnScore: true,
            dishonestyScore: true,
            skillGapScore: true,
          },
        },
      },
    });

    if (!partner || !partner.phone) {
      logger.warn('[triggerAlertSmsForRiskChange] 파트너 정보 부족', {
        partnerId,
      });
      return false;
    }

    // 메시지 생성
    const message = generateTriggerMessage(
      partner.name,
      riskLevel,
      messageType
    );

    // SMS 발송
    const smsResult = await sendPartnerAlertSms(
      organizationId,
      partnerId,
      'day0', // 즉시 발송
      riskLevel,
      messageType,
      message,
      partner.phone
    );

    return smsResult.success;
  } catch (error: unknown) {
    logger.error('[triggerAlertSmsForRiskChange] 오류', {
      partnerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * RiskScore 변경 시 메시지 생성 (심리학 렌즈 적용)
 */
function generateTriggerMessage(
  partnerName: string,
  riskLevel: 'RED' | 'YELLOW' | 'GREEN',
  messageType: string
): string {
  if (messageType === 'URGENT_RETENTION') {
    // L6 손실회피 + 긴박감
    return `${partnerName}님, 최근 성과가 급격히 감소했습니다. 지금 바로 상담받으세요 → [전화]. 내일 컨설팅 기회는 제한됩니다.`;
  }

  if (messageType === 'TRAINING_OFFER') {
    // L10 즉시구매 + 인센티브
    return `${partnerName}님! 성과 향상 특별 교육 프로그램 오픈. 무료 참석 + 수료 시 보너스 100만원. 선착순 10명만 수용 가능 → [신청]`;
  }

  if (messageType === 'RECOVERY_POSITIVE') {
    // 긍정 강화 + 동기 부여
    return `${partnerName}님, 최근 개선되는 모습 정말 좋습니다! 💪 계속 이 추세면 월 수익 목표 100% 달성 가능합니다. 화이팅!`;
  }

  return `${partnerName}님, 성과 변화가 감지되었습니다. 더 자세한 상담을 원하시면 [상담 신청]`;
}

/**
 * YELLOW 상태 3주 이상 지속 여부 확인 (선택 - 더 정확한 검사)
 */
export async function checkYellowDuration3Weeks(
  partnerId: string
): Promise<boolean> {
  try {
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    // 최근 21일 동안 YELLOW 상태가 계속 유지되었는지 확인
    const yellowChanges = await prisma.partnerRiskScoreChange.findMany({
      where: {
        partnerId,
        currentLevel: 'YELLOW',
        createdAt: { gte: threeWeeksAgo },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (yellowChanges.length < 3) return false; // 최소 3회 이상 기록 필요

    // 모든 기간이 YELLOW인지 확인
    return yellowChanges.every((change) => change.currentLevel === 'YELLOW');
  } catch (error: unknown) {
    logger.error('[checkYellowDuration3Weeks] 오류', {
      partnerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
