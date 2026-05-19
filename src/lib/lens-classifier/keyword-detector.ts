/**
 * Menu #38 Phase 4 Step 5-2: 키워드 감지 엔진
 *
 * 콜 노트나 자유입력에서 L1-L10 신호를 추출합니다.
 *
 * @file src/lib/lens-classifier/keyword-detector.ts
 */

import { KeywordSignal, LensType } from './types';

/**
 * 키워드 데이터베이스 (렌즈별 키워드)
 */
const KEYWORD_DATABASE: Record<LensType, KeywordDefinition[]> = {
  L1: [
    {
      keyword: '월 33,000',
      patterns: ['월.*33', '33000', '33만'],
      confidence: 0.95,
      category: 'PRICE',
    },
    {
      keyword: '광고',
      patterns: ['광고.*비싸', '광고.*사기', '광고가', '광고는'],
      confidence: 0.8,
      category: 'PRICE',
    },
    {
      keyword: '비싸다',
      patterns: ['비싼', '비싸', '가격이.*높', '너무.*비'],
      confidence: 0.85,
      category: 'PRICE',
    },
    {
      keyword: '실제가격',
      patterns: ['실제.*가격', '진짜.*가격', '정말.*금액', '얼마냐', '정확한.*가격'],
      confidence: 0.9,
      category: 'PRICE',
    },
    {
      keyword: '멤버비vs상품비',
      patterns: ['멤버.*상품', '둘.*다', '추가.*비용', '더.*내야'],
      confidence: 0.85,
      category: 'PRICE',
    },
  ],
  L2: [
    {
      keyword: '준비가복잡',
      patterns: ['준비.*복잡', '준비가.*어렵', '준비.*많아'],
      confidence: 0.9,
      category: 'PREPARATION',
    },
    {
      keyword: '시간부족',
      patterns: ['시간.*없', '바빠서', '바쁜', '시간이.*없'],
      confidence: 0.85,
      category: 'PREPARATION',
    },
    {
      keyword: '일정미정',
      patterns: ['일정.*없', '일정이.*모르', '언제.*갈지', '휴가.*못'],
      confidence: 0.8,
      category: 'PREPARATION',
    },
  ],
  L3: [
    {
      keyword: '배타는것',
      patterns: ['배.*타', '배만', '배타는', '배.*뭐', '배가'],
      confidence: 0.8,
      category: 'EXPERIENCE',
    },
    {
      keyword: '일반여행비교',
      patterns: ['일반.*여행', '호텔.*여행', '여행이랑', '호텔이랑', '일반이랑'],
      confidence: 0.85,
      category: 'EXPERIENCE',
    },
    {
      keyword: '차별성못느낌',
      patterns: ['뭐가.*달라', '뭐가.*다른', '다를.*것', '차이가'],
      confidence: 0.8,
      category: 'EXPERIENCE',
    },
    {
      keyword: '배에대한오해',
      patterns: ['배.*멀미', '배.*흔들', '배.*배멀미', '배.*외로', '배.*답답'],
      confidence: 0.75,
      category: 'EXPERIENCE',
    },
  ],
  L4: [
    {
      keyword: '약정',
      patterns: ['약정', '자동결제', '위약금', '계약', '약속'],
      confidence: 0.9,
      category: 'MEMBERSHIP',
    },
    {
      keyword: '자유도욕구',
      patterns: ['자유', '자유롭게', '필요할.*때', '한두번', '자유.*원'],
      confidence: 0.75,
      category: 'MEMBERSHIP',
    },
    {
      keyword: '멤버십불필요',
      patterns: ['멤버.*필요', '멤버.*왜', '굳이.*멤버', '굳이.*가입'],
      confidence: 0.8,
      category: 'MEMBERSHIP',
    },
  ],
  L5: [
    {
      keyword: '자신감부족',
      patterns: ['나.*맞을까', '나.*적합', '나같은', '나.*가능', '자신감'],
      confidence: 0.85,
      category: 'EXPERIENCE',
    },
    {
      keyword: '혼자불안',
      patterns: ['혼자', '혼자.*가능', '혼자.*괜찮', '동반자', '함께'],
      confidence: 0.75,
      category: 'COMPANION',
    },
  ],
  L6: [
    {
      keyword: '언제갈지',
      patterns: ['언제', '언제.*갈', '언제.*예약', '일정.*못', '일정.*아직'],
      confidence: 0.9,
      category: 'TIME',
    },
    {
      keyword: '다음달',
      patterns: ['다음', '나중에', '미루고', '조금.*후', '아직.*멀'],
      confidence: 0.8,
      category: 'TIME',
    },
    {
      keyword: '타이밍미결',
      patterns: ['타이밍', '시즌', '날씨', '비수기', '성수기'],
      confidence: 0.7,
      category: 'TIME',
    },
  ],
  L7: [
    {
      keyword: '함께갈사람',
      patterns: ['함께', '누구', '배우자', '아내', '남편', '아이', '자녀', '친구', '부모', '엄마', '아빠'],
      confidence: 0.85,
      category: 'COMPANION',
    },
    {
      keyword: '동반자유형',
      patterns: ['부부', '가족', '혼자', '혼자.*가능', '꼭.*함께'],
      confidence: 0.75,
      category: 'COMPANION',
    },
  ],
  L8: [
    {
      keyword: '지난번경험',
      patterns: ['지난번', '작년', '그때', '예전에', '예전.*탔'],
      confidence: 0.9,
      category: 'EXPERIENCE',
    },
    {
      keyword: '멤버십필요성',
      patterns: ['멤버.*좋', '할인', '할인.*많', '계속.*탈', '자주.*탈'],
      confidence: 0.8,
      category: 'MEMBERSHIP',
    },
    {
      keyword: '부재중재활성화',
      patterns: ['오래.*안', '처음.*연락', '정말.*오래', '얼마.*안'],
      confidence: 0.85,
      category: 'EXPERIENCE',
    },
  ],
  L9: [
    {
      keyword: '멀미',
      patterns: ['멀미', '배멀미', '흔들', '어지러', '메스껍', '배.*멀미', '멀미.*할'],
      confidence: 0.95,
      category: 'HEALTH',
    },
    {
      keyword: '지병',
      patterns: ['지병', '건강.*문제', '몸.*약', '건강.*걱정', '의료', '아픔', '증상'],
      confidence: 0.85,
      category: 'HEALTH',
    },
    {
      keyword: '아이안전',
      patterns: ['아이.*안전', '물.*빠지', '아기.*안전', '자녀.*안전', '아들.*안전', '딸.*안전'],
      confidence: 0.8,
      category: 'HEALTH',
    },
    {
      keyword: '임신',
      patterns: ['임신', '임신.*가능', '임신.*괜찮', '임신중', '임신.*안전'],
      confidence: 0.9,
      category: 'HEALTH',
    },
  ],
  L10: [
    {
      keyword: '이미결정',
      patterns: ['이미.*정했', '정했어요', '정해졌어', '배.*정했', '결정했'],
      confidence: 0.95,
      category: 'DECISION',
    },
    {
      keyword: '마지막고민',
      patterns: ['마지막', '마지막.*고민', '마지막.*확인', '지금.*할까', '정말.*마지막'],
      confidence: 0.9,
      category: 'DECISION',
    },
    {
      keyword: '선택직전',
      patterns: ['선택.*완료', '객실.*정했', '날짜.*정했', '선택.*끝'],
      confidence: 0.85,
      category: 'DECISION',
    },
    {
      keyword: '지금예약',
      patterns: ['지금.*예약', '바로.*예약', '언제.*예약', '예약.*가능'],
      confidence: 0.8,
      category: 'DECISION',
    },
  ],
};

/**
 * 키워드 정의
 */
interface KeywordDefinition {
  keyword: string;
  patterns: string[]; // 정규표현식 패턴
  confidence: number; // 0-1
  category: KeywordSignal['category'];
}

/**
 * 콜 노트에서 L1-L10 렌즈 신호를 추출합니다.
 *
 * @param callNotes - 콜 노트 텍스트
 * @returns 감지된 키워드 신호 배열 (신뢰도 순 정렬)
 *
 * @example
 * const signals = detectKeywords('월 33,000원이라고 했는데 150만원이라고?');
 * // Returns:
 * // [
 * //   {
 * //     keyword: '월 33,000',
 * //     lenses: ['L1'],
 * //     confidence: 0.95,
 * //     category: 'PRICE'
 * //   }
 * // ]
 */
export function detectKeywords(callNotes: string): KeywordSignal[] {
  const signals: KeywordSignal[] = [];
  const normalizedText = callNotes.toLowerCase();

  // 각 렌즈의 키워드 검사
  for (const [lensType, keywords] of Object.entries(KEYWORD_DATABASE)) {
    for (const keywordDef of keywords) {
      // 모든 패턴 검사
      for (const pattern of keywordDef.patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          if (regex.test(normalizedText)) {
            signals.push({
              keyword: keywordDef.keyword,
              lenses: [lensType as LensType],
              confidence: keywordDef.confidence,
              category: keywordDef.category,
            });
            break; // 이 키워드는 한 번만 추가
          }
        } catch (error) {
          // 정규표현식 에러 무시
          console.warn(`Invalid regex pattern: ${pattern}`);
        }
      }
    }
  }

  // 신뢰도 높은 순으로 정렬
  signals.sort((a, b) => b.confidence - a.confidence);

  // 중복 제거 (같은 렌즈 신호는 한 번만)
  const uniqueSignals = new Map<string, KeywordSignal>();
  for (const signal of signals) {
    const key = signal.lenses.join(',');
    if (!uniqueSignals.has(key)) {
      uniqueSignals.set(key, signal);
    }
  }

  return Array.from(uniqueSignals.values());
}

/**
 * 특정 렌즈에 해당하는 키워드 목록 반환
 */
export function getKeywordsForLens(lensType: LensType): string[] {
  const keywords = KEYWORD_DATABASE[lensType];
  if (!keywords) {
    return [];
  }
  return keywords.map((k) => k.keyword);
}

/**
 * 키워드 감지 강도 계산 (0-100)
 * 감지된 신호의 개수와 신뢰도 기반
 */
export function calculateKeywordStrength(signals: KeywordSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  // 신뢰도 평균 × 신호 개수
  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const signalCount = signals.length;

  // 최대 100, 최소 0
  return Math.min(100, Math.round(avgConfidence * signalCount * 50));
}

/**
 * 콜 노트 품질 평가 (무엇을 입력해야 할지 제안)
 */
export function suggestKeywordsToCheck(callNotes: string | undefined): string[] {
  if (!callNotes) {
    return [
      '가격 관련 표현 (월 33,000, 비싸다 등)',
      '준비 부담 표현 (시간, 일정 등)',
      '크루즈 경험 (첫 경험, 예전에 탔다 등)',
      '건강 우려 (멀미, 지병 등)',
      '결정 상태 (이미 정했다, 마지막 고민 등)',
    ];
  }

  const missing: string[] = [];
  const textLower = callNotes.toLowerCase();

  // 각 카테고리별 키워드 확인
  const categories = {
    '가격 신호':
      textLower.includes('가격') ||
      textLower.includes('비용') ||
      textLower.includes('비싸') ||
      textLower.includes('33000'),
    '준비 신호': textLower.includes('준비') || textLower.includes('시간') || textLower.includes('일정'),
    '경험 신호': textLower.includes('경험') || textLower.includes('처음') || textLower.includes('크루즈'),
    '건강 신호': textLower.includes('멀미') || textLower.includes('건강') || textLower.includes('지병'),
    '결정 신호':
      textLower.includes('정했') ||
      textLower.includes('마지막') ||
      textLower.includes('예약') ||
      textLower.includes('객실'),
  };

  for (const [category, hasSignal] of Object.entries(categories)) {
    if (!hasSignal) {
      missing.push(category);
    }
  }

  return missing;
}
