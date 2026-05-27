/**
 * Chi-square 테스트 및 신뢰구간 계산
 * A/B 테스트 통계 검증 (라이브러리 의존도 제로)
 */

interface GroupMetrics {
  success: number;
  total: number;
}

interface ChiSquareResult {
  chiSquare: number;
  pValue: number;
  zScore: number;
  isSignificant: boolean;
  relativeRisk: number;
  ciA: { lower: number; upper: number };
  ciB: { lower: number; upper: number };
  ciDifference: { lower: number; upper: number };
}

// Chi-square 분포의 누적분포함수 근사 (Q-function)
function qFunction(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  const t = 1.0 / (1.0 + p * Math.abs(x));
  const d = c * Math.exp(-x * x / 2.0);
  const prob = d * t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));

  return x >= 0 ? prob : 1 - prob;
}

// Chi-square CDF 근사 (자유도 1)
function chiSquareCDF(chi2: number): number {
  if (chi2 < 0) return 0;
  if (chi2 > 100) return 1;

  const z = Math.sqrt(chi2);
  return 2 * qFunction(z) - 1;
}

// Wilson Score 신뢰구간 (95%, z=1.96)
function wilsonCI(successes: number, total: number): { lower: number; upper: number } {
  if (total === 0) return { lower: 0, upper: 0 };

  const p = successes / total;
  const z = 1.96;
  const z2 = z * z;

  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = (z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total))) / denominator;

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

// Chi-square 테스트 (2x2 분할표)
export function chiSquareTest(a: GroupMetrics, b: GroupMetrics, pThreshold = 0.05): ChiSquareResult {
  const aSuccess = a.success;
  const aFail = a.total - a.success;
  const bSuccess = b.success;
  const bFail = b.total - b.success;

  const n = a.total + b.total;

  // Chi-square 계산 (Yates 보정 없음 — 샘플 충분하면 불필요)
  const expectedA = ((aSuccess + bSuccess) / n) * a.total;
  const expectedB = ((aSuccess + bSuccess) / n) * b.total;
  const expectedAFail = ((aFail + bFail) / n) * a.total;
  const expectedBFail = ((aFail + bFail) / n) * b.total;

  const chi2 =
    Math.pow(aSuccess - expectedA, 2) / Math.max(expectedA, 0.5) +
    Math.pow(bSuccess - expectedB, 2) / Math.max(expectedB, 0.5) +
    Math.pow(aFail - expectedAFail, 2) / Math.max(expectedAFail, 0.5) +
    Math.pow(bFail - expectedBFail, 2) / Math.max(expectedBFail, 0.5);

  const pValue = 1 - chiSquareCDF(chi2);
  const zScore = Math.sqrt(chi2);
  const isSignificant = pValue < pThreshold;

  // Relative Risk
  const riskA = a.success / a.total;
  const riskB = b.success / b.total;
  const relativeRisk = riskB > 0 ? riskA / riskB : 0;

  // 신뢰구간
  const ciA = wilsonCI(aSuccess, a.total);
  const ciB = wilsonCI(bSuccess, b.total);

  // 차이의 신뢰구간 (근사)
  const diff = riskB - riskA;
  const se = Math.sqrt(riskA * (1 - riskA) / a.total + riskB * (1 - riskB) / b.total);
  const ciDifference = {
    lower: diff - 1.96 * se,
    upper: diff + 1.96 * se,
  };

  return {
    chiSquare: chi2,
    pValue,
    zScore,
    isSignificant,
    relativeRisk,
    ciA,
    ciB,
    ciDifference,
  };
}

// 권장사항 텍스트 생성
export function computeRecommendation(
  stats: ChiSquareResult,
  aMetrics: GroupMetrics,
  bMetrics: GroupMetrics,
  minSampleSize = 100
): { recommendation: string; winner?: 'A' | 'B' } {
  const totalSample = aMetrics.total + bMetrics.total;

  if (totalSample < minSampleSize) {
    return {
      recommendation: `샘플 크기 부족 (${totalSample}/${minSampleSize}). 더 모아주세요.`,
    };
  }

  if (!stats.isSignificant) {
    return {
      recommendation: `유의성 없음 (p=${stats.pValue.toFixed(3)}). 두 그룹이 차이 없습니다.`,
    };
  }

  const rateA = aMetrics.success / aMetrics.total;
  const rateB = bMetrics.success / bMetrics.total;
  const winner = rateB > rateA ? 'B' : 'A';
  const improvement = Math.abs((rateB - rateA) / Math.min(rateA, rateB) * 100);

  return {
    winner,
    recommendation: `${winner}가 우승자입니다 (p=${stats.pValue.toFixed(3)}, 개선도 ${improvement.toFixed(1)}%). ${winner}으로 확대 권장.`,
  };
}
