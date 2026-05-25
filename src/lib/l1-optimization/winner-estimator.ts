/**
 * L1 렌즈: A/B 테스트 승자 판정 예상 시간 계산
 *
 * 현재 데이터 수집 상태를 바탕으로, A/B 테스트 우승자를 언제쯤 판정할 수 있을지 예측합니다.
 */

interface WinnerEstimate {
  estimatedDate: string; // ISO 8601 형식
  daysRequired: number; // 지금부터 몇 일이 걸릴지
  samplesRequired: number; // 필요한 총 샘플 수
  currentSamples: number; // 현재 샘플 수
  remainingSamples: number; // 남은 샘플 수
  estimatedDailyVolume: number; // 일일 예상 샘플
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'; // 예측 신뢰도
}

/**
 * A/B 테스트 승자 판정 예상 시간 계산
 *
 * 파라미터:
 * - variantCount: A/B 변형 개수 (2 = A/B, 3 = A/B/C 등)
 * - minSampleSize: 신뢰도 95%, 검정력 80%에서 필요한 변형당 샘플 수
 * - currentSampleSize: 현재까지 수집된 샘플 수
 * - dailyVolume: 일일 예상 샘플 수 (과거 데이터 기반)
 */
export function estimateWinnerAt(
  variantCount: number = 2,
  minSampleSize: number = 50,
  currentSampleSize: number = 0,
  dailyVolume: number = 10
): string {
  // 1. 필요한 총 샘플 수 계산 (모든 변형)
  const samplesRequired = minSampleSize * variantCount;

  // 2. 남은 샘플 수
  const remainingSamples = Math.max(0, samplesRequired - currentSampleSize);

  // 3. 남은 일수 계산 (일일 볼륨 기반)
  const dailyVolumeActual = Math.max(1, dailyVolume);
  const daysRequired = Math.ceil(remainingSamples / dailyVolumeActual);

  // 4. 예상 날짜 계산
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysRequired);

  // 5. 신뢰도 판정 (충분한 데이터 있는가?)
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (currentSampleSize >= minSampleSize * 0.5) {
    confidence = 'MEDIUM';
  }
  if (currentSampleSize >= minSampleSize * 0.8) {
    confidence = 'HIGH';
  }

  return estimatedDate.toISOString().split('T')[0];
}

/**
 * 더 상세한 예측
 */
export function estimateWinnerAtDetailed(
  variantCount: number = 2,
  minSampleSize: number = 50,
  currentSampleSize: number = 0,
  dailyVolume: number = 10
): WinnerEstimate {
  const samplesRequired = minSampleSize * variantCount;
  const remainingSamples = Math.max(0, samplesRequired - currentSampleSize);
  const dailyVolumeActual = Math.max(1, dailyVolume);
  const daysRequired = Math.ceil(remainingSamples / dailyVolumeActual);

  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysRequired);

  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  const dataPercentage = (currentSampleSize / samplesRequired) * 100;
  if (dataPercentage >= 50) confidence = 'MEDIUM';
  if (dataPercentage >= 80) confidence = 'HIGH';

  return {
    estimatedDate: estimatedDate.toISOString().split('T')[0],
    daysRequired,
    samplesRequired,
    currentSamples: currentSampleSize,
    remainingSamples,
    estimatedDailyVolume: dailyVolumeActual,
    confidence,
  };
}

/**
 * 일일 진도율 기반 백분율 계산
 */
export function calculateProgressPercentage(
  currentSamples: number,
  totalRequired: number
): number {
  if (totalRequired === 0) return 0;
  return Math.min(100, Math.round((currentSamples / totalRequired) * 100));
}

/**
 * 필요한 최소 일일 볼륨 계산 (N일 안에 완료하려면)
 */
export function calculateRequiredDailyVolume(
  remainingSamples: number,
  daysTarget: number
): number {
  if (daysTarget <= 0) return Infinity;
  return Math.ceil(remainingSamples / daysTarget);
}

/**
 * 세 가지 시나리오: 낙관, 보수, 현실
 */
export function estimateWinnerAtScenarios(
  variantCount: number,
  minSampleSize: number,
  currentSamples: number,
  historicalDailyVolume: number
): {
  optimistic: string; // 일일 볼륨 20% 상향
  realistic: string; // 기존 일일 볼륨
  conservative: string; // 일일 볼륨 20% 하향
} {
  const samplesRequired = minSampleSize * variantCount;
  const remainingSamples = Math.max(0, samplesRequired - currentSamples);

  const optimisticVolume = Math.ceil(historicalDailyVolume * 1.2);
  const realisticVolume = historicalDailyVolume;
  const conservativeVolume = Math.floor(historicalDailyVolume * 0.8);

  const calculateDate = (dailyVol: number): string => {
    const days = Math.ceil(remainingSamples / Math.max(1, dailyVol));
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  return {
    optimistic: calculateDate(optimisticVolume),
    realistic: calculateDate(realisticVolume),
    conservative: calculateDate(conservativeVolume),
  };
}
