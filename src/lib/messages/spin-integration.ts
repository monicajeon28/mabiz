/**
 * SPIN 질문 프레임워크 통합 (Neil Rackham)
 * - Day 1: S (Situation) — 상황 파악 질문
 * - Day 2: I (Implication) — 함축 / 심각성 강조 질문
 *
 * SMS 특성상 각 렌즈별 1문장 추가만 가능
 * 콜센터에서 P(Problem)→N(Need-Payoff)는 라이브 콜에서 처리
 */

// Day 1: 고객의 현재 상황을 파악하는 질문 (S단계)
const SPIN_DAY1_SITUATION: Record<string, string> = {
  L0: '혹시 최근에 해외 여행을 생각해본 적이 있으셨나요?',
  L1: '현재 여행 예산을 결정할 때 가장 중요한 요소가 무엇인가요?',
  L2: '크루즈 여행을 준비할 때 가장 복잡하다고 느껴지는 부분이 있나요?',
  L3: '여행 선택할 때 다른 상품들과 비교해보시나요?',
  L4: '현재 회사나 팀에서 단합과 신뢰를 높이는 방법을 찾고 계신가요?',
  L5: '처음 경험해보는 여행 상품에 대해 걱정되는 부분이 있으신가요?',
  L6: '현재 시간 여유가 있으신 편이신가요, 아니면 바쁜 편이신가요?',
  L7: '가족이나 팀원들과 함께할 여행이라면 어떤 점이 가장 중요할까요?',
  L8: '지난해 여행이나 휴가 경험이 어떠셨나요?',
  L9: '여행할 때 건강이나 안전 관련해서 걱정되시는 부분이 있나요?',
  L10: '여행을 결정할 때 보통 얼마나 빨리 결정하시는 편이신가요?',
};

// Day 2: 문제 방치 시 결과를 인식하게 하는 질문 (I단계 - 함축)
const SPIN_DAY2_IMPLICATION: Record<string, string> = {
  L0: '계속 미루다 보면 나중에 예약할 수 없는 상황이 올 수도 있잖아요?',
  L1: '지금의 특가를 놓치면 나중에는 더 높은 가격을 내야 할 것 같은데요?',
  L2: '준비가 복잡해서 계속 미루다 보면, 결국 여행을 포기하게 되지 않을까요?',
  L3: '다른 상품을 고민하다 실수로 좋은 기회를 놓치지는 않을까 걱정돼요?',
  L4: '팀 단합을 미루면 나중에 직원 이탈이나 소통 문제가 생기지 않을까요?',
  L5: '안전에 대한 불안감 때문에 새로운 경험을 계속 피하다 보면 인생이 반복되지 않을까요?',
  L6: '지금이 아니면 언제 여유를 가질 수 있을지 모르잖아요?',
  L7: '가족과의 추억은 지금 만들어야 나중에 후회하지 않을 것 같은데요?',
  L8: '작년의 피로가 풀리지 않으면 올해도 같은 악순환이 반복되지 않을까요?',
  L9: '건강 문제 때문에 여행을 미루다 보면, 나중에는 갈 수 없는 상태가 될 수도 있잖아요?',
  L10: '지금 결정을 미루면, 이 특가는 다시 없을 수도 있는데요?',
};

/**
 * 렌즈별 SPIN 질문 반환
 * @param day 1 (S단계) 또는 2 (I단계)
 * @param lens 렌즈 코드 (L0~L10)
 * @returns 1문장의 SPIN 질문, 없으면 ''
 */
export function getSpinQuestion(day: 1 | 2, lens: string | undefined): string {
  if (!lens || !lens.startsWith('L')) return '';

  const map = day === 1 ? SPIN_DAY1_SITUATION : SPIN_DAY2_IMPLICATION;
  return map[lens] || '';
}

/**
 * 메시지에 SPIN 질문 추가
 * @param message 원본 메시지
 * @param spinQuestion SPIN 질문 1줄
 * @returns "메시지 + 공백 + 질문" 또는 그냥 메시지
 */
export function appendSpinQuestion(message: string, spinQuestion: string): string {
  if (!spinQuestion) return message;
  return `${message}\n\n💭 ${spinQuestion}`;
}
