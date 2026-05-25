/**
 * L1 렌즈: SMS 메시지 템플릿 검증
 *
 * SMS 메시지가 다음 조건을 만족하는지 검증합니다:
 * 1. 길이: 5-160글자 (또는 장문 SMS 80-3000글자)
 * 2. 금지 표현: 5가지 위험한 표현 제거
 * 3. 필수 요소: CTA (Call-to-Action) 포함
 * 4. 심리학 기법: PASONA, 손실회피, 희소성 포함
 * 5. 문법: 한글 띄어쓰기, 맞춤법 (선택사항)
 */

interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  suggestions?: string[];
}

// 금지 표현 (L1 렌즈 고객을 자극할 수 있는 위험한 표현)
const FORBIDDEN_EXPRESSIONS = [
  /지금 즉시 결정하지 않으면 후회/gi, // 과도한 긴박감
  /사기|속임|사기 아닌지|의심/gi, // 신뢰도 저해
  /다른 업체보다 훨씬 저렴/gi, // 과도한 비교
  /가격 할인 (절대|무조건|무조건)은/gi, // 거짓 약속
  /보증|100% 성공|성공 보장/gi, // 과도한 보증
];

// 필수 CTA 표현
const CTA_EXPRESSIONS = [
  '클릭',
  '확인',
  '문의',
  '예약',
  '신청',
  '상담',
  '카톡',
  '전화',
  '응답',
  '이모티콘',
];

// 심리학 기법 표현
const PSYCHOLOGY_EXPRESSIONS = {
  LOSS_AVERSION: [
    '놓칠',
    '후회',
    '마지막',
    '남은',
    '한정',
    '한 번',
    '기회',
    '시간',
  ],
  SCARCITY: [
    '한정',
    '남은',
    '마감',
    '선착순',
    '초대',
    '특별',
    '소수',
    '극소수',
  ],
  SOCIAL_PROOF: [
    '고객',
    '만족',
    '후기',
    '선택',
    '추천',
    '인기',
    '신뢰',
  ],
};

/**
 * SMS 메시지 템플릿 검증
 */
export function validateMessageTemplate(message: string): ValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // 1. 빈 문자열 체크
  if (!message || message.trim().length === 0) {
    return {
      isValid: false,
      error: 'Message is empty',
    };
  }

  // 2. 길이 검증 (5-160글자 또는 장문 SMS)
  const messageLength = message.length;
  if (messageLength < 5) {
    return {
      isValid: false,
      error: 'Message is too short (min 5 characters)',
    };
  }

  if (messageLength > 3000) {
    return {
      isValid: false,
      error: 'Message is too long (max 3000 characters)',
    };
  }

  if (messageLength > 160 && messageLength < 80) {
    return {
      isValid: false,
      error: 'Message length must be 5-160 or 80+ characters for long SMS',
    };
  }

  // 3. 금지 표현 체크
  for (const forbidden of FORBIDDEN_EXPRESSIONS) {
    if (forbidden.test(message)) {
      const match = message.match(forbidden)?.[0];
      return {
        isValid: false,
        error: `Forbidden expression detected: "${match}"`,
      };
    }
  }

  // 4. CTA 포함 여부 (필수)
  const hasCTA = CTA_EXPRESSIONS.some(cta =>
    message.toLowerCase().includes(cta.toLowerCase())
  );

  if (!hasCTA) {
    suggestions.push('Include a Call-to-Action (click, confirm, inquire, book, apply, consult)');
  }

  // 5. 심리학 기법 포함 여부 (권장)
  const psychTechs = Object.entries(PSYCHOLOGY_EXPRESSIONS);
  const usedTechs: string[] = [];

  for (const [techName, keywords] of psychTechs) {
    const hasKeyword = keywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasKeyword) {
      usedTechs.push(techName);
    }
  }

  if (usedTechs.length === 0) {
    suggestions.push('Consider adding psychology techniques (loss aversion, scarcity, social proof)');
  }

  // 6. 특수문자 검증
  if (/[^가-힣a-zA-Z0-9\s\.\,\!\?\(\)\[\]\/\-\~\@\#\$\%\&\*\+\=\_]/g.test(message)) {
    warnings.push('Message contains unusual special characters');
  }

  // 7. 이모티콘 확인 (옵션)
  const hasEmoji = /[\uD800-\uDBFF]|[\p{Extended_Pictographic}]/gu.test(message);
  if (!hasEmoji && messageLength < 80) {
    suggestions.push('Consider adding emoji for better engagement');
  }

  // 8. 변수 플레이홀더 검증
  const placeholders = message.match(/\{\{[^}]+\}\}/g);
  if (placeholders) {
    const validPlaceholders = ['{{customerName}}', '{{phoneNumber}}', '{{discount}}', '{{dueDate}}'];
    for (const placeholder of placeholders) {
      if (!validPlaceholders.some(valid => valid === placeholder)) {
        warnings.push(`Unknown placeholder: ${placeholder}`);
      }
    }
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * 메시지 개선 제안
 */
export function suggestMessageImprovement(message: string): string[] {
  const suggestions: string[] = [];

  // 1. 길이 최적화
  if (message.length < 20) {
    suggestions.push('Message is short. Consider adding more details.');
  }
  if (message.length > 140) {
    suggestions.push('Message is long. Consider shortening or use long SMS (LMS).');
  }

  // 2. 심리학 기법 추가 제안
  if (!/놓칠|한정|기회|남은/i.test(message)) {
    suggestions.push('Add loss aversion: "지금 놓치면 다시 없을 기회"');
  }

  if (!/선착순|한정|소수|초대/i.test(message)) {
    suggestions.push('Add scarcity: "선착순 한정, 남은 자리 3개"');
  }

  // 3. CTA 명확화
  if (!/클릭|확인|문의|신청|상담|카톡|전화|응답/i.test(message)) {
    suggestions.push('Add clear CTA: "지금 확인 >> [링크]" or "카톡으로 상담받기"');
  }

  // 4. 고객 이름 개인화
  if (!message.includes('{{customerName}}')) {
    suggestions.push('Consider personalizing: "OOO님 특별 제안" instead of generic message');
  }

  return suggestions;
}

/**
 * 메시지 점수 계산 (0-100)
 * 더 높은 점수 = 더 나은 메시지
 */
export function calculateMessageQuality(message: string): number {
  let score = 50; // 기본 점수

  const validation = validateMessageTemplate(message);

  // 검증 실패 시 0점
  if (!validation.isValid) {
    return 0;
  }

  // 길이 최적화 (80-160글자 또는 장문)
  if ((message.length >= 80 && message.length <= 160) || message.length > 160) {
    score += 10;
  }

  // 심리학 기법 포함 (+5 each)
  const techCount = Object.values(PSYCHOLOGY_EXPRESSIONS).flat().filter(tech =>
    message.toLowerCase().includes(tech.toLowerCase())
  ).length;
  score += Math.min(15, techCount * 3); // 최대 +15

  // CTA 포함 (+10)
  if (CTA_EXPRESSIONS.some(cta => message.toLowerCase().includes(cta.toLowerCase()))) {
    score += 10;
  }

  // 개인화 (+5)
  if (message.includes('{{customerName}}')) {
    score += 5;
  }

  // 상한선: 100
  return Math.min(100, score);
}
