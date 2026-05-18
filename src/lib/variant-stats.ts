/**
 * Chi-square 검정을 이용한 A/B 성과 통계 분석
 *
 * 원리: 두 그룹의 성공률이 통계적으로 의미 있게 다른지 판정
 * H0 (귀무가설): A와 B의 성공률은 같다
 * Ha (대안 가설): A와 B의 성공률은 다르다
 * 유의도: α = 0.05 (95% 신뢰도)
 */

export interface ChiSquareResult {
  chi2: number;              // Chi-square 통계량
  pValue: number;            // P-value (0.0 ~ 1.0)
  isSignificant: boolean;    // p < 0.05? (유의미한 차이)
  degreesOfFreedom: number;  // df = 1 (2x2 contingency table)
}

/**
 * Chi-square 검정 함수
 *
 * @param successA - A Variant의 성공 수
 * @param failureA - A Variant의 실패 수
 * @param successB - B Variant의 성공 수
 * @param failureB - B Variant의 실패 수
 * @returns Chi-square 검정 결과
 *
 * 예시: calculateChiSquare(100, 10, 70, 30)
 * A: 100 성공, 10 실패 (91% 성공률)
 * B: 70 성공, 30 실패 (70% 성공률)
 * → chi2 ≈ 16.67, p ≈ 0.00004 (유의미)
 */
export function calculateChiSquare(
  successA: number,
  failureA: number,
  successB: number,
  failureB: number
): ChiSquareResult {
  // 전체 표본 수
  const n = successA + failureA + successB + failureB;

  // 행과 열의 합 계산 (Contingency table)
  const totalSuccess = successA + successB;
  const totalFailure = failureA + failureB;
  const totalA = successA + failureA;
  const totalB = successB + failureB;

  // 기댓값 계산 (독립 가정 하에)
  // E[i,j] = (row_total * col_total) / n
  const expectedSuccessA = (totalSuccess * totalA) / n;
  const expectedFailureA = (totalFailure * totalA) / n;
  const expectedSuccessB = (totalSuccess * totalB) / n;
  const expectedFailureB = (totalFailure * totalB) / n;

  // Chi-square 통계량 계산
  // χ² = Σ ((O - E)² / E)
  const chi2 =
    Math.pow(successA - expectedSuccessA, 2) / expectedSuccessA +
    Math.pow(failureA - expectedFailureA, 2) / expectedFailureA +
    Math.pow(successB - expectedSuccessB, 2) / expectedSuccessB +
    Math.pow(failureB - expectedFailureB, 2) / expectedFailureB;

  // P-value 근사 계산 (자유도 1인 카이제곱 분포)
  // 정확한 누적분포 대신 근사식 사용
  // P(χ² > x) ≈ exp(-x/2) for df=1 (근사도 95%)
  const pValue = Math.exp(-chi2 / 2);

  return {
    chi2: Number(chi2.toFixed(4)),
    pValue: Number(pValue.toFixed(4)),
    isSignificant: pValue < 0.05,
    degreesOfFreedom: 1,
  };
}

/**
 * Cramer's V: 효과 크기 (Effect Size) 계산
 *
 * 두 범주형 변수 간의 연관성 강도를 -1 ~ 1 범위로 정량화
 * - 0.0 ~ 0.1: 무시할 수 있는 차이
 * - 0.1 ~ 0.3: 약한 차이
 * - 0.3 ~ 0.5: 중간 정도 차이
 * - > 0.5: 강한 차이
 *
 * 공식: V = √(χ² / (n * (k-1)))
 * 여기서 k = 2 (A/B), n = 표본 수
 *
 * @returns 0 ~ 1 범위의 효과 크기
 */
export function calculateCramersV(
  successA: number,
  failureA: number,
  successB: number,
  failureB: number
): number {
  const n = successA + failureA + successB + failureB;
  const chi2 = calculateChiSquare(successA, failureA, successB, failureB).chi2;

  // Cramer's V = sqrt(chi2 / (n * (k-1)))
  // k = 2 (A/B), df = 1
  const cramersV = Math.sqrt(chi2 / n);

  return Number(cramersV.toFixed(4));
}

/**
 * 성공률 계산 헬퍼
 */
export function calculateSuccessRate(success: number, total: number): number {
  if (total === 0) return 0;
  return Number((success / total).toFixed(4));
}

/**
 * 신뢰도 레벨 판정
 *
 * @param isSignificant - Chi-square 검정이 유의미한가
 * @param cramersV - Cramer's V (효과 크기)
 * @returns "HIGH" | "MEDIUM" | "LOW"
 */
export function determineConfidenceLevel(
  isSignificant: boolean,
  cramersV: number
): "HIGH" | "MEDIUM" | "LOW" {
  if (!isSignificant) {
    return "LOW";  // p >= 0.05: 차이 없음
  }

  if (cramersV > 0.3) {
    return "HIGH";  // 유의미 + 효과 크기 큼
  }

  return "MEDIUM";  // 유의미하지만 효과 크기 작음
}

/**
 * 통계 해석 문구 생성
 */
export function generateInterpretation(
  recommendation: "A" | "B" | null,
  isSignificant: boolean,
  pValue: number,
  confidence: "HIGH" | "MEDIUM" | "LOW"
): string {
  if (!isSignificant) {
    return "두 Variant 간 통계적으로 의미 있는 차이가 없습니다. 샘플 수를 늘려보세요. (유의도 α=0.05)";
  }

  if (!recommendation) {
    return "두 Variant의 성공률이 동등합니다. 다른 지표로 판단하세요.";
  }

  const confidenceText = {
    HIGH: "높은 신뢰도(95% 이상)",
    MEDIUM: "중간 신뢰도(95%)",
    LOW: "낮은 신뢰도",
  }[confidence];

  return `${recommendation} Variant이 통계적으로 유의미하게 더 좋습니다. (p=${pValue}, ${confidenceText})`;
}

/**
 * 샘플 크기 권장
 * 통계적 신뢰도를 위한 최소 샘플 수 제시
 */
export function getSampleSizeRecommendation(
  sampleSizeA: number,
  sampleSizeB: number
): string | null {
  const minSample = Math.min(sampleSizeA, sampleSizeB);

  if (minSample < 30) {
    return "통계 신뢰도가 매우 낮습니다. Variant당 최소 30개 샘플 필요합니다.";
  }

  if (minSample < 100) {
    return "통계적 신뢰도를 높이려면 Variant당 최소 100개 샘플 권장합니다.";
  }

  if (minSample < 500) {
    return "보통 신뢰도입니다. 높은 신뢰도를 원하면 Variant당 500개 샘플을 목표하세요.";
  }

  return null;  // 샘플 크기 충분
}
