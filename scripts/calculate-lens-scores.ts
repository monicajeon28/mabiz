import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface LensScoreInput {
  lensType: string; // L0-L10
  contactId: string;
  organizationId: string;
  metadata: Record<string, any>;
}

interface LensScore {
  score: number; // 0-100
  confidence: number; // 0-100
  indicators: string[];
}

/**
 * Grant Cardone 10렌즈 점수 계산 엔진
 * L0-L10까지 자동으로 심리학 렌즈를 감지하고 점수 산출
 */

// L0: 부재중 고객 재활성화
function calculateL0Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (!contact.lastCruiseDate) {
    score += 25;
    indicators.push('no_cruise_history');
  } else {
    const monthsAgo = Math.floor(
      (Date.now() - contact.lastCruiseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (monthsAgo >= 12) {
      score += 90;
      indicators.push('inactive_1y_plus');
    } else if (monthsAgo >= 6) {
      score += 60;
      indicators.push('inactive_6_12m');
    } else if (monthsAgo >= 3) {
      score += 30;
      indicators.push('inactive_3_6m');
    }
  }

  if (contact.lastSatisfactionScore && contact.lastSatisfactionScore >= 8) {
    score += 20;
    indicators.push('high_past_satisfaction');
  }

  if (contact.cruiseCount > 3) {
    score += 15;
    indicators.push('repeat_customer');
  }

  const confidence = Math.min(100, 60 + indicators.length * 15);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L1: 가격이의 대응
function calculateL1Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  const metadata = contact.lensMetadata as Record<string, any>;

  if (metadata?.priceObjection) {
    score += 70;
    indicators.push('explicit_price_objection');
  }

  if (metadata?.budgetRange === 'LOW') {
    score += 40;
    indicators.push('low_budget_range');
  } else if (metadata?.budgetRange === 'MEDIUM') {
    score += 20;
    indicators.push('medium_budget_range');
  }

  if (contact.quotedPrice && contact.quotedPrice > 5000000) {
    score += 30;
    indicators.push('high_price_point');
  }

  const confidence = Math.min(100, 50 + indicators.length * 20);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L2: 준비/복잡도 불안도
function calculateL2Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (contact.anxietyCategory === 'high') {
    score += 80;
    indicators.push('high_anxiety');
  } else if (contact.anxietyCategory === 'medium') {
    score += 40;
    indicators.push('medium_anxiety');
  }

  if (contact.visaRequired) {
    score += 25;
    indicators.push('visa_required');
  }

  if (contact.passportDaysLeft && contact.passportDaysLeft < 180) {
    score += 30;
    indicators.push('passport_expiry_soon');
  }

  if (contact.firstTimeCruise) {
    score += 35;
    indicators.push('first_time_cruiser');
  }

  if (contact.familyWithKids) {
    score += 25;
    indicators.push('traveling_with_kids');
  }

  if (contact.healthConcerns) {
    score += 40;
    indicators.push('health_concerns_present');
  }

  const confidence = Math.min(100, 55 + indicators.length * 12);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L3: 차별성 미인지
function calculateL3Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (contact.competitorMentioned) {
    score += 75;
    indicators.push('competitor_mentioned');
  }

  if (contact.competitorNames && contact.competitorNames.length > 0) {
    score += 20 * Math.min(3, contact.competitorNames.length);
    indicators.push(`considering_${contact.competitorNames.length}_competitors`);
  }

  if (contact.differentiationScore && contact.differentiationScore < 50) {
    score += 50;
    indicators.push('low_differentiation_understanding');
  }

  if (contact.preparationFrameworkLevel === 'inquiry') {
    score += 40;
    indicators.push('early_stage_inquiry');
  }

  const confidence = Math.min(100, 60 + indicators.length * 15);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L5: 자기투영 (의료/건강)
function calculateL5Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (contact.selfProjectionScore > 0) {
    score += contact.selfProjectionScore * 0.8;
    indicators.push('self_projection_detected');
  }

  if (contact.personalHealthConcern) {
    score += 35;
    indicators.push('personal_health_concern');
  }

  if (contact.spouseHealthConcern) {
    score += 30;
    indicators.push('spouse_health_concern');
  }

  if (contact.compoundHealthRisk) {
    score += 40;
    indicators.push('compound_health_risk');
  }

  if (contact.familyHealthProfile) {
    score += 20;
    indicators.push('family_health_documented');
  }

  const confidence = Math.min(100, 65 + indicators.length * 12);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L6: 타이밍/손실회피
function calculateL6Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (contact.timingUrgencyScore > 0) {
    score += contact.timingUrgencyScore * 0.9;
    indicators.push('timing_urgency_detected');
  }

  if (contact.priceDeadlineDate && contact.priceDeadlineDate > new Date()) {
    const daysLeft = Math.floor(
      (contact.priceDeadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft < 7) {
      score += 80;
      indicators.push('price_deadline_imminent');
    } else if (daysLeft < 30) {
      score += 50;
      indicators.push('price_deadline_approaching');
    }
  }

  if (contact.seatAvailability !== null && contact.seatAvailability < 5) {
    score += 70;
    indicators.push('seat_scarcity_high');
  }

  if (contact.healthWindowStatus === 'closing_soon') {
    score += 60;
    indicators.push('health_window_closing');
  }

  if (contact.ageRelevanceScore > 60) {
    score += 40;
    indicators.push('age_related_urgency');
  }

  const confidence = Math.min(100, 70 + indicators.length * 10);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L7: 동반자 설득 (가족)
function calculateL7Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (contact.familyInfluenceScore > 0) {
    score += contact.familyInfluenceScore * 0.8;
    indicators.push('family_influence_detected');
  }

  if (contact.decisionMaker && contact.decisionMaker !== 'self') {
    score += 60;
    indicators.push(`decision_maker_is_${contact.decisionMaker}`);
  }

  if (contact.familyComposition === 'spouse') {
    score += 40;
    indicators.push('spouse_involved');
  } else if (contact.familyComposition === 'parents') {
    score += 35;
    indicators.push('parents_involved');
  } else if (contact.familyComposition === 'mixed') {
    score += 50;
    indicators.push('mixed_family_dynamics');
  }

  if (contact.spouseEngagement === 'hesitant' || contact.spouseEngagement === 'aware') {
    score += 50;
    indicators.push('companion_hesitant');
  }

  if (contact.familyObjections && contact.familyObjections.length > 0) {
    score += 20 * Math.min(3, contact.familyObjections.length);
    indicators.push(`family_objections_${contact.familyObjections.length}`);
  }

  const confidence = Math.min(100, 65 + indicators.length * 12);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L8: 재방문 습관화
function calculateL8Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (contact.cruiseCount > 0) {
    score += Math.min(50, contact.cruiseCount * 10);
    indicators.push(`cruise_repeat_${contact.cruiseCount}times`);
  }

  if (contact.cruiseClubTier && contact.cruiseClubTier !== 'bronze') {
    score += 40;
    indicators.push(`tier_${contact.cruiseClubTier}`);
  }

  if (contact.ltvTotal > 0) {
    if (contact.ltvTotal > 10000000) {
      score += 80;
      indicators.push('high_ltv');
    } else if (contact.ltvTotal > 5000000) {
      score += 50;
      indicators.push('medium_ltv');
    }
  }

  if (contact.cruiseReturnInterestLevel > 70) {
    score += 40;
    indicators.push('high_return_interest');
  }

  const confidence = Math.min(100, 70 + indicators.length * 10);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

// L10: 즉시 구매 클로징
function calculateL10Score(contact: any): LensScore {
  const indicators: string[] = [];
  let score = 0;

  if (contact.emotionalConnectionScore > 70) {
    score += contact.emotionalConnectionScore * 0.8;
    indicators.push('strong_emotional_connection');
  }

  if (contact.urgencyLevel > 70) {
    score += contact.urgencyLevel * 0.7;
    indicators.push('high_urgency_detected');
  }

  if (contact.closingStage === 'ready_close') {
    score += 80;
    indicators.push('ready_for_close');
  } else if (contact.closingStage === 'qualified') {
    score += 40;
    indicators.push('qualified_lead');
  }

  if (contact.tripleChoiceOffered) {
    score += 30;
    indicators.push('triple_choice_presented');
  }

  if (contact.l10ClosingAttempts > 2) {
    score += 20;
    indicators.push(`closing_attempts_${contact.l10ClosingAttempts}`);
  }

  const confidence = Math.min(100, 70 + indicators.length * 12);

  return {
    score: Math.min(100, score),
    confidence,
    indicators,
  };
}

/**
 * 모든 렌즈 점수를 계산하는 주 함수
 */
async function calculateAllLensScores() {
  console.log('시작: 심리학 렌즈 점수 계산 (L0-L10)');

  try {
    // 모든 Contact 조회
    const contacts = await prisma.contact.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        organization: true,
      },
      take: 1000,
    });

    console.log(`처리 대상: ${contacts.length}명의 Contact`);

    const results = {
      L0: { count: 0, avgScore: 0, totalScore: 0 },
      L1: { count: 0, avgScore: 0, totalScore: 0 },
      L2: { count: 0, avgScore: 0, totalScore: 0 },
      L3: { count: 0, avgScore: 0, totalScore: 0 },
      L5: { count: 0, avgScore: 0, totalScore: 0 },
      L6: { count: 0, avgScore: 0, totalScore: 0 },
      L7: { count: 0, avgScore: 0, totalScore: 0 },
      L8: { count: 0, avgScore: 0, totalScore: 0 },
      L10: { count: 0, avgScore: 0, totalScore: 0 },
    };

    for (const contact of contacts) {
      // L0: 부재중 고객
      const l0 = calculateL0Score(contact);
      if (l0.score > 20) {
        results.L0.count++;
        results.L0.totalScore += l0.score;
        console.log(`  [L0] ${contact.phone}: ${l0.score}점 (${l0.indicators.join(', ')})`);
      }

      // L1: 가격이의
      const l1 = calculateL1Score(contact);
      if (l1.score > 20) {
        results.L1.count++;
        results.L1.totalScore += l1.score;
      }

      // L2: 준비 불안도
      const l2 = calculateL2Score(contact);
      if (l2.score > 20) {
        results.L2.count++;
        results.L2.totalScore += l2.score;
      }

      // L3: 차별성 미인지
      const l3 = calculateL3Score(contact);
      if (l3.score > 20) {
        results.L3.count++;
        results.L3.totalScore += l3.score;
      }

      // L5: 자기투영
      const l5 = calculateL5Score(contact);
      if (l5.score > 20) {
        results.L5.count++;
        results.L5.totalScore += l5.score;
      }

      // L6: 타이밍/손실회피
      const l6 = calculateL6Score(contact);
      if (l6.score > 20) {
        results.L6.count++;
        results.L6.totalScore += l6.score;
      }

      // L7: 동반자 설득
      const l7 = calculateL7Score(contact);
      if (l7.score > 20) {
        results.L7.count++;
        results.L7.totalScore += l7.score;
      }

      // L8: 재방문 습관화
      const l8 = calculateL8Score(contact);
      if (l8.score > 20) {
        results.L8.count++;
        results.L8.totalScore += l8.score;
      }

      // L10: 즉시 구매
      const l10 = calculateL10Score(contact);
      if (l10.score > 20) {
        results.L10.count++;
        results.L10.totalScore += l10.score;
      }

      // Contact 내 lensMetadata 업데이트
      const lensMetadata = {
        ...(contact.lensMetadata as Record<string, any>),
        l0Score: l0.score,
        l1Score: l1.score,
        l2Score: l2.score,
        l3Score: l3.score,
        l5Score: l5.score,
        l6Score: l6.score,
        l7Score: l7.score,
        l8Score: l8.score,
        l10Score: l10.score,
        calculatedAt: new Date().toISOString(),
      };

      await prisma.contact.update({
        where: { id: contact.id },
        data: { lensMetadata },
      });
    }

    // 평균 계산
    Object.entries(results).forEach(([lens, data]) => {
      if (data.count > 0) {
        data.avgScore = Math.round(data.totalScore / data.count);
      }
    });

    console.log('\n렌즈별 계산 결과:');
    console.log('=====================================');
    Object.entries(results).forEach(([lens, data]) => {
      console.log(`${lens}: ${data.count}명 대상, 평균 점수 ${data.avgScore}점`);
    });

    return results;
  } catch (error) {
    console.error('오류:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
calculateAllLensScores()
  .then(() => {
    console.log('\n완료: 심리학 렌즈 점수 계산 성공!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('실패:', error);
    process.exit(1);
  });
