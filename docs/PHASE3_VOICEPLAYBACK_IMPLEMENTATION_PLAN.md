# Phase 3: VoicePlayback.tsx 완전 구현 계획

**작성일:** 2026-06-03  
**상태:** 🚀 GO (즉시 구현 가능)  
**예상 시간:** 3.5시간  
**병렬 실행:** Track A (Playbook, 2시간) + Track B (Auto, 1.5시간)

---

## 🎯 High-Level Overview

### Track A: Playbook 완전화 (2시간)

```
Phase 3-1 (30분): call-situations.ts (8가지 상황 + 심리학 렌즈)
  ├─ Enum: CallSituation (Core 4가지 + Growth 4가지)
  ├─ CALL_SITUATION_OPENINGS: 상황별 오프닝 3개 + 반박법
  └─ suggestCallSituations(): 렌즈 기반 추천

Phase 3-2 (30분): audio-cache.ts + sentiment-analyzer.ts
  ├─ AudioCache: localStorage 캐시 (TTL 7일, MAX 5MB)
  └─ SentimentAnalyzer: Contact 감정 분석 (POSITIVE/NEUTRAL/NEGATIVE)

Phase 3-3 (1시간): VoicePlayback 개선 + 통합
  ├─ src/lib/playbook/audio-cache.ts (350줄)
  ├─ src/app/(dashboard)/playbook/VoicePlayback.tsx (400줄 개선)
  ├─ src/app/(dashboard)/tools/playbook-viewer/VoicePlayback.tsx (350줄 개선)
  └─ src/app/(dashboard)/playbook/page.tsx (200줄 추가)
```

### Track B: Auto P2-P3 (1.5시간)

```
Phase 3-4 (1시간): ToolClickTracker API
  ├─ src/app/api/tools/click-tracker/route.ts (350줄)
  └─ src/lib/click-tracker.ts (100줄 utility)

Phase 3-5 (30분): AutoFeedbackGenerator
  ├─ src/app/api/tools/auto-feedback/route.ts (300줄)
  └─ src/lib/sms-templates/day0-3-by-lens.ts (400줄 데이터)
```

---

## 📝 Phase 3-1: call-situations.ts (30분)

**파일:** `src/lib/playbook/call-situations.ts` (500줄)

```typescript
/**
 * 거장단 심리학 + 퍼널 전문가 통합
 * - 8가지 상황 분류 (Core 4 + Growth 4)
 * - 각 상황별 오프닝 3개 (Grant Cardone 10렌즈 기반)
 * - 렌즈 기반 추천 로직
 */

// ============================================
// 1. Enum: 8가지 CallSituation 정의
// ============================================

export enum CallSituation {
  // Core 4가지 (필수 대응)
  PRICE_OBJECTION = 'PRICE_OBJECTION',           // L1: 가격 이의
  HEALTH_CONCERN = 'HEALTH_CONCERN',             // L9: 건강 문제
  REFUND_REQUEST = 'REFUND_REQUEST',             // L3/L10: 환불/변경
  COMPLAINT = 'COMPLAINT',                       // L0: 불만 처리

  // Growth 4가지 (수익 증대)
  FOOD_CONSULTATION = 'FOOD_CONSULTATION',       // L7: 음식 상담
  UPSELL = 'UPSELL',                             // L8/L5: 상향 판매
  REBOOKING = 'REBOOKING',                       // L6/L8: 추가 예약
  CONTRACT_RENEWAL = 'CONTRACT_RENEWAL'          // L10/L8: 재계약
}

// ============================================
// 2. 상황별 상세 정보 구조
// ============================================

export interface SituationInfo {
  situation: CallSituation;
  displayName: string;
  category: 'core' | 'growth';
  primaryLens: string;           // L0-L10
  secondaryLenses: string[];     // 추가 렌즈
  openings: {
    opening1: string;            // 렌즈 1 기반
    opening2: string;            // 렌즈 2 기반
    opening3: string;            // 렌즈 3 기반
  };
  rebuttal: string;              // 반박법 (Grant Cardone)
  expectedConversionLift: number;// 예상 전환율 상승 (%)
  psyPhrase: string;             // 심리학 원리 요약
}

// ============================================
// 3. CALL_SITUATION_LIBRARY: 모든 상황 정의
// ============================================

export const CALL_SITUATION_LIBRARY: Record<CallSituation, SituationInfo> = {
  // PRICE_OBJECTION (L1 가격 저항 + L6 시간 손실회피)
  [CallSituation.PRICE_OBJECTION]: {
    situation: CallSituation.PRICE_OBJECTION,
    displayName: '가격 이의 대응',
    category: 'core',
    primaryLens: 'L1',
    secondaryLenses: ['L6', 'L10'],
    openings: {
      opening1: '선사와 직결되어서 안저가 가능한 거예요. 직접 계약이니까요.',  // L10 권위성
      opening2: '환불 100% 보장이니까 가격 리스크 없습니다.',                   // L6 손실회피
      opening3: '월 33,000원부터 시작할 수 있습니다. 부담 없이 시작하세요.'      // L1 가격 프레이밍
    },
    rebuttal: '신뢰하기 어렵다면, 온라인 후기 5,000개+ 확인해보세요. 4.8점입니다.',
    expectedConversionLift: 8,   // +8% 전환율 상승
    psyPhrase: 'L1(가격 저항) + L6(손실회피) = 가치 재정의 + 리스크 제거'
  },

  // HEALTH_CONCERN (L9 신뢰성 + L5 자기투영)
  [CallSituation.HEALTH_CONCERN]: {
    situation: CallSituation.HEALTH_CONCERN,
    displayName: '건강 문제 상담',
    category: 'core',
    primaryLens: 'L9',
    secondaryLenses: ['L5'],
    openings: {
      opening1: '부모님 건강이 최우선이시죠? 저희도 그렇게 생각합니다.',        // L9 신뢰 + 공감
      opening2: '건강검진 무료로 해드립니다. 안심 패키지에 포함되니까요.',        // L5 자기투영 (보살핌)
      opening3: '선박 의료팀과 미리 협의하니까 응급상황도 대비되어 있습니다.'    // L9 신뢰성
    },
    rebuttal: '의료진 경력증명서를 확인해드릴 수 있어요. 평균 18년 경력입니다.',
    expectedConversionLift: 12,  // +12% (건강 관련 신뢰 회복)
    psyPhrase: 'L9(신뢰) + L5(자기투영) = 안심 + 보살핌 느낌'
  },

  // REFUND_REQUEST (L3 차별성 + L10 권위)
  [CallSituation.REFUND_REQUEST]: {
    situation: CallSituation.REFUND_REQUEST,
    displayName: '환불/변경 요청',
    category: 'core',
    primaryLens: 'L3',
    secondaryLenses: ['L10'],
    openings: {
      opening1: '정책을 정확히 안내해드리겠습니다. 우리는 투명성이 원칙입니다.',  // L3 차별 + L10 권위
      opening2: '100% 환불 보장입니다. 단, 이용료만 공제되는데요.',             // L10 명확한 기준
      opening3: '빠른 처리로 도와드리겠습니다. 영업일 2일 내 처리 완료입니다.'    // L6 긴박감
    },
    rebuttal: '위약금은 선사 규정이지만, 동사 전문가로서 최대한 도와드릴게요.',
    expectedConversionLift: 5,   // +5% (신뢰 회복)
    psyPhrase: 'L3(차별) + L10(권위) = 투명성 + 신뢰'
  },

  // COMPLAINT (L0 공감 + L3 차별화 + L8 재구매)
  [CallSituation.COMPLAINT]: {
    situation: CallSituation.COMPLAINT,
    displayName: '불만 처리 및 재계약',
    category: 'core',
    primaryLens: 'L0',
    secondaryLenses: ['L3', 'L8'],
    openings: {
      opening1: '정말 답답하셨겠어요. 완전 이해합니다. 지난번 정말 아쉬웠어요.',  // L0 공감
      opening2: '우리는 그렇게 다르게 합니다. 이번엔 완벽하게 준비했습니다.',     // L3 차별화 강조
      opening3: '다음번은 완벽하게 할 거 약속합니다. 특별 보상 제공해드릴게요.'   // L8 재구매 + L6 긴박
    },
    rebuttal: '어떤 점을 가장 개선하고 싶으신가요? 그 부분을 우선으로 챙기겠습니다.',
    expectedConversionLift: 15,  // +15% (감정 회복)
    psyPhrase: 'L0(공감) + L3(차별) + L8(재구매) = 감정 회복 + 신뢰 재구축'
  },

  // FOOD_CONSULTATION (L7 동반자 + L8 재구매)
  [CallSituation.FOOD_CONSULTATION]: {
    situation: CallSituation.FOOD_CONSULTATION,
    displayName: '음식 상담',
    category: 'growth',
    primaryLens: 'L7',
    secondaryLenses: ['L8', 'L9'],
    openings: {
      opening1: '한국인이라 밥맛이 중요하죠? 우리 인솔자가 맛집을 알거든요.',    // L7 동반자 신뢰
      opening2: '프리미엄 식사 옵션도 있습니다. 미슐랭 쉐프 추천 메뉴예요.',      // L8 재구매 가치
      opening3: '건강한 식단도 요청하면 맞춰드립니다. 영양사와 상담 포함돼요.'    // L9 신뢰성
    },
    rebuttal: '사전에 식성을 알려주시면 선택 오류를 최소화할 수 있어요.',
    expectedConversionLift: 6,   // +6% (만족도 상향)
    psyPhrase: 'L7(동반자) + L8(재구매) = 공동의 즐거움 + 가치 극대화'
  },

  // UPSELL (L8 재구매 + L5 자기투영 + L6 희소성)
  [CallSituation.UPSELL]: {
    situation: CallSituation.UPSELL,
    displayName: '프리미엄 상향 판매',
    category: 'growth',
    primaryLens: 'L8',
    secondaryLenses: ['L5', 'L6'],
    openings: {
      opening1: '더 좋은 경험을 원하시나요? 프리미엄 혜택이 정말 다릅니다.',      // L8 재구매 신호
      opening2: '프리미엄은 스위트룸 + 우선탑승 + 전담 매니저 포함됩니다.',       // L5 자기투영 (특대우)
      opening3: '이 한정 오퍼는 이번달까지만입니다. 얼른 예약하셔야 해요.'        // L6 희소성 + 긴박감
    },
    rebuttal: '기본도 훌륭하지만, 프리미엄은 진짜 특별합니다. 차이가 눈에 띄거든요.',
    expectedConversionLift: 10,  // +10% (프리미엄 전환)
    psyPhrase: 'L8(재구매) + L5(자기투영) + L6(희소성) = 프리미엄 욕구 + 긴박감'
  },

  // REBOOKING (L8 재구매 + L6 희소성 + L6 긴박감)
  [CallSituation.REBOOKING]: {
    situation: CallSituation.REBOOKING,
    displayName: '추가 예약 유도',
    category: 'growth',
    primaryLens: 'L6',
    secondaryLenses: ['L8'],
    openings: {
      opening1: '또 가고 싶으신가요? 정말 반갑습니다. 리피트 고객이 최고예요.',   // L8 재구매
      opening2: '특가 상품이 나왔어요. 작년 같은 시즌 대비 30% 저렴합니다.',      // L6 희소성
      opening3: '예약이 찬다니까 얼른 부탁드려요. 남은 좌석 3개뿐이라고요.'       // L6 긴박감
    },
    rebuttal: '언제쯤 가고 싶으신데요? 일정만 정해지면 바로 예약 진행하겠습니다.',
    expectedConversionLift: 9,   // +9% (재예약율)
    psyPhrase: 'L6(긴박감 + 희소성) + L8(재구매) = 즉시 결정 욕구'
  },

  // CONTRACT_RENEWAL (L8 재구매 + L10 권위 + L5 자기투영)
  [CallSituation.CONTRACT_RENEWAL]: {
    situation: CallSituation.CONTRACT_RENEWAL,
    displayName: '계약 갱신 및 회원 유지',
    category: 'growth',
    primaryLens: 'L8',
    secondaryLenses: ['L10', 'L5'],
    openings: {
      opening1: '올해 여행 계획을 세우셨나요? 골드 회원은 평생 할인받으세요.',    // L8+L10 신뢰 + 지속성
      opening2: '골드 회원은 상위 5%만 가능합니다. 당신은 이미 VIP 대열입니다.',   // L5 자기투영 (지위)
      opening3: '다음 여행을 더 잘 준비해드릴게요. 이번보다 더 깔끔할 거예요.'     // L8 개선의 약속
    },
    rebuttal: '이번엔 어디를 꿈꾸세요? 그 지역 전문가와 직접 상담해드릴게요.',
    expectedConversionLift: 8,   // +8% (재계약율)
    psyPhrase: 'L8(재구매) + L10(권위) + L5(자기투영) = 지속적 신뢰 + VIP 대우'
  }
};

// ============================================
// 4. 렌즈 기반 상황 추천 함수
// ============================================

export interface SituationSuggestion {
  primary: CallSituation;        // 1순위 추천
  secondary: CallSituation[];    // 2순위 추천들
  sentiment?: string;            // POSITIVE/NEUTRAL/NEGATIVE (선택)
}

/**
 * Contact의 렌즈와 단계에 따라 최적 콜 상황 추천
 * @param lens 렌즈 (L0-L10)
 * @param callStage 콜 단계 (PROSPECT/CUSTOMER/INACTIVE, 선택)
 * @param sentiment 감정 (POSITIVE/NEUTRAL/NEGATIVE, 선택)
 */
export function suggestCallSituations(
  lens: string,
  callStage?: string,
  sentiment?: string
): SituationSuggestion {
  // ============================================
  // 단계 1: 렌즈 기반 1순위 추천
  // ============================================
  const lensToSituations: Record<string, CallSituation> = {
    'L0': CallSituation.COMPLAINT,           // 부재/불만 → 공감 먼저
    'L1': CallSituation.PRICE_OBJECTION,     // 가격 저항 → 가치 재정의
    'L2': CallSituation.HEALTH_CONCERN,      // 준비 부담 → 안심
    'L3': CallSituation.REFUND_REQUEST,      // 차별성 의심 → 차별화 강조
    'L6': CallSituation.REBOOKING,           // 타이밍 불명확 → 긴박감
    'L8': CallSituation.UPSELL,              // 재구매 가능성 → 업셀
    'L9': CallSituation.HEALTH_CONCERN,      // 건강 우려 → 안심
    'L10': CallSituation.CONTRACT_RENEWAL,   // 즉시 구매 성향 → 재계약
  };

  const primary = lensToSituations[lens] || CallSituation.FOOD_CONSULTATION;

  // ============================================
  // 단계 2: CallStage 기반 2순위 추천
  // ============================================
  const callStageSituations: Record<string, CallSituation[]> = {
    'PROSPECT': [CallSituation.PRICE_OBJECTION, CallSituation.HEALTH_CONCERN],
    'CUSTOMER': [CallSituation.REBOOKING, CallSituation.UPSELL],
    'INACTIVE': [CallSituation.COMPLAINT, CallSituation.CONTRACT_RENEWAL],
  };

  const stageSuggestions = callStage
    ? callStageSituations[callStage] || []
    : [];

  // ============================================
  // 단계 3: Sentiment 오버라이드
  // ============================================
  let secondary = stageSuggestions.filter(s => s !== primary);

  if (sentiment === 'NEGATIVE') {
    // 부정적 감정 → COMPLAINT 최우선
    if (primary !== CallSituation.COMPLAINT) {
      secondary.unshift(CallSituation.COMPLAINT);
    }
  } else if (sentiment === 'POSITIVE') {
    // 긍정적 감정 → UPSELL/REBOOKING 우선
    if (![CallSituation.UPSELL, CallSituation.REBOOKING].includes(primary)) {
      secondary.unshift(CallSituation.UPSELL);
    }
  }

  return {
    primary,
    secondary: [...new Set(secondary)].slice(0, 3),  // 중복 제거 + 상위 3개
    sentiment
  };
}

// ============================================
// 5. 헬퍼 함수
// ============================================

export function getSituationInfo(situation: CallSituation): SituationInfo {
  return CALL_SITUATION_LIBRARY[situation];
}

export function getAllSituations(): CallSituation[] {
  return Object.values(CallSituation);
}

export function getCoreSituations(): CallSituation[] {
  return getAllSituations().filter(
    s => CALL_SITUATION_LIBRARY[s].category === 'core'
  );
}

export function getGrowthSituations(): CallSituation[] {
  return getAllSituations().filter(
    s => CALL_SITUATION_LIBRARY[s].category === 'growth'
  );
}
```

---

## 📝 Phase 3-2: audio-cache.ts + sentiment-analyzer.ts (30분)

### Part A: audio-cache.ts (350줄)

**파일:** `src/lib/playbook/audio-cache.ts`

```typescript
/**
 * 오디오 파일 localStorage 캐시 관리
 * - TTL: 7일
 * - MAX SIZE: 5MB
 * - LRU eviction (가장 오래된 파일부터 제거)
 */

interface CacheEntry {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

interface CacheMetadata {
  version: number;
  entries: Array<{ url: string; timestamp: number; size: number }>;
  totalSize: number;
}

const STORAGE_KEY = 'mabiz_audio_cache';
const METADATA_KEY = 'mabiz_audio_cache_metadata';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

class AudioCache {
  /**
   * 캐시에 오디오 저장
   * @param url 오디오 URL (key)
   * @param blob 오디오 Blob (value)
   */
  static async set(url: string, blob: Blob): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // 1. 기존 메타데이터 로드
      const metadata = this.getMetadata();

      // 2. 크기 확인
      const newSize = blob.size;
      const currentTotal = metadata.totalSize;
      let availableSpace = MAX_SIZE_BYTES - currentTotal;

      // 3. 공간 확보 (필요시 LRU eviction)
      if (newSize > availableSpace) {
        this.evictUntilSpace(newSize);
      }

      // 4. Blob → Base64 변환 후 저장
      const base64 = await this.blobToBase64(blob);
      localStorage.setItem(`${STORAGE_KEY}_${url}`, base64);

      // 5. 메타데이터 업데이트
      metadata.entries.push({
        url,
        timestamp: Date.now(),
        size: newSize
      });
      metadata.totalSize = metadata.entries.reduce((sum, e) => sum + e.size, 0);
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.warn('[AudioCache] set() error:', error);
      // 조용히 실패 (캐시는 부가 기능)
    }
  }

  /**
   * 캐시에서 오디오 조회
   * @param url 오디오 URL (key)
   * @returns Blob 또는 null (만료/미존재)
   */
  static async get(url: string): Promise<Blob | null> {
    if (!this.isAvailable()) return null;

    try {
      const metadata = this.getMetadata();
      const entry = metadata.entries.find(e => e.url === url);

      // 미존재
      if (!entry) return null;

      // TTL 확인
      if (Date.now() - entry.timestamp > TTL_MS) {
        this.remove(url);
        return null;
      }

      // Base64 → Blob 변환
      const base64 = localStorage.getItem(`${STORAGE_KEY}_${url}`);
      if (!base64) return null;

      return this.base64ToBlob(base64);
    } catch (error) {
      console.warn('[AudioCache] get() error:', error);
      return null;
    }
  }

  /**
   * 특정 URL 캐시 제거
   */
  static remove(url: string): void {
    if (!this.isAvailable()) return;

    try {
      localStorage.removeItem(`${STORAGE_KEY}_${url}`);

      const metadata = this.getMetadata();
      metadata.entries = metadata.entries.filter(e => e.url !== url);
      metadata.totalSize = metadata.entries.reduce((sum, e) => sum + e.size, 0);
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.warn('[AudioCache] remove() error:', error);
    }
  }

  /**
   * 전체 캐시 초기화
   */
  static clear(): void {
    if (!this.isAvailable()) return;

    try {
      const metadata = this.getMetadata();
      metadata.entries.forEach(e => {
        localStorage.removeItem(`${STORAGE_KEY}_${e.url}`);
      });
      localStorage.removeItem(METADATA_KEY);
    } catch (error) {
      console.warn('[AudioCache] clear() error:', error);
    }
  }

  /**
   * 캐시 통계
   */
  static stats(): {
    count: number;
    totalSize: number;
    maxSize: number;
    utilizationPercent: number;
  } {
    const metadata = this.getMetadata();
    return {
      count: metadata.entries.length,
      totalSize: metadata.totalSize,
      maxSize: MAX_SIZE_BYTES,
      utilizationPercent: (metadata.totalSize / MAX_SIZE_BYTES) * 100
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * 저장 가능성 여부 확인
   */
  private static isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
      return false;
    }
  }

  /**
   * 메타데이터 조회 (없으면 초기값 반환)
   */
  private static getMetadata(): CacheMetadata {
    try {
      const json = localStorage.getItem(METADATA_KEY);
      if (!json) {
        return {
          version: 1,
          entries: [],
          totalSize: 0
        };
      }
      return JSON.parse(json);
    } catch {
      return {
        version: 1,
        entries: [],
        totalSize: 0
      };
    }
  }

  /**
   * LRU eviction: 필요한 공간 확보할 때까지 가장 오래된 항목부터 제거
   */
  private static evictUntilSpace(requiredSize: number): void {
    const metadata = this.getMetadata();
    let currentTotal = metadata.totalSize;
    const availableSpace = MAX_SIZE_BYTES - currentTotal;

    if (requiredSize <= availableSpace) return; // 이미 충분

    // 오래된 순서대로 정렬
    metadata.entries.sort((a, b) => a.timestamp - b.timestamp);

    // 필요한 만큼 제거
    let needSpace = requiredSize - availableSpace;
    while (needSpace > 0 && metadata.entries.length > 0) {
      const oldest = metadata.entries.shift();
      if (oldest) {
        localStorage.removeItem(`${STORAGE_KEY}_${oldest.url}`);
        needSpace -= oldest.size;
      }
    }

    // 메타데이터 업데이트
    metadata.totalSize = metadata.entries.reduce((sum, e) => sum + e.size, 0);
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  }

  /**
   * Blob → Base64
   */
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // data:audio/mp3;base64, 부분 제거
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Base64 → Blob
   */
  private static base64ToBlob(base64: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/mpeg' });
  }
}

export { AudioCache };
```

### Part B: sentiment-analyzer.ts (150줄)

**파일:** `src/lib/playbook/sentiment-analyzer.ts`

```typescript
/**
 * Contact 감정 분석 엔진
 * - 과거 상호작용 분석
 * - 콜 결과 기반 감정 도출
 * - 점수 계산 (POSITIVE: +1 ~ NEGATIVE: -1)
 */

export type ContactSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

interface SentimentScore {
  sentiment: ContactSentiment;
  score: number; // -1 ~ +1
  reasons: string[]; // 감정 판단 사유
}

/**
 * Contact 객체 기반 감정 분석
 * @param contact Contact 정보 (callResults, notes, lens 등)
 */
export function analyzeContactSentiment(contact: any): SentimentScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Lens 기반 점수 (렌즈가 부정적일수록 감정 하향)
  if (contact.lens) {
    const lensScore = getLensScore(contact.lens);
    score += lensScore * 0.3; // 30% 비중
    if (lensScore < 0) {
      reasons.push(`렌즈 ${contact.lens} (부정적 신호)`);
    }
  }

  // 2. 콜 결과 기반 점수
  if (contact.callResults && contact.callResults.length > 0) {
    const recentCalls = contact.callResults.slice(-3); // 최근 3개
    const callScore = recentCalls.reduce((sum, call) => {
      return sum + getCallResultScore(call.result);
    }, 0) / recentCalls.length;

    score += callScore * 0.4; // 40% 비중
    if (callScore < 0) {
      reasons.push(`최근 콜 결과: ${recentCalls[0].result}`);
    }
  }

  // 3. 메모(notes) 기반 텍스트 분석
  if (contact.notes) {
    const notesScore = analyzeNotesSentiment(contact.notes);
    score += notesScore * 0.3; // 30% 비중
    if (notesScore < 0) {
      reasons.push('메모에 부정적 키워드 감지');
    }
  }

  // 최종 판정
  let sentiment: ContactSentiment;
  if (score > 0.2) {
    sentiment = 'POSITIVE';
  } else if (score < -0.2) {
    sentiment = 'NEGATIVE';
  } else {
    sentiment = 'NEUTRAL';
  }

  return { sentiment, score, reasons };
}

/**
 * 렌즈별 감정 점수 (-1 ~ +1)
 * L0: 부재 → 부정적 (-0.5)
 * L1: 가격 저항 → 약간 부정적 (-0.2)
 * L6-L10: 긍정적 신호 → 양수
 */
function getLensScore(lens: string): number {
  const lensScores: Record<string, number> = {
    'L0': -0.5,   // 부재/이탈 → 심각
    'L1': -0.2,   // 가격 저항 → 해결 가능
    'L2': -0.1,   // 준비 부담 → 약함
    'L3': 0,      // 차별성 의심 → 중립
    'L4': 0,      // 멤버십 저항 → 중립
    'L5': 0.1,    // 적합성 의심 → 약함
    'L6': 0.3,    // 타이밍/희소성 → 양수
    'L7': 0.2,    // 동반자 확인 → 양수
    'L8': 0.4,    // 재구매 신호 → 강함
    'L9': 0.3,    // 건강/신뢰 → 양수
    'L10': 0.5    // 즉시 구매 → 매우 강함
  };

  return lensScores[lens] || 0;
}

/**
 * 콜 결과 점수
 * COMPLETED_POSITIVE: +0.8
 * COMPLETED_NEUTRAL: +0.2
 * NO_ANSWER: -0.3
 * COMPLAINT: -0.8
 */
function getCallResultScore(result: string): number {
  const resultScores: Record<string, number> = {
    'COMPLETED_POSITIVE': 0.8,
    'COMPLETED_INTERESTED': 0.6,
    'COMPLETED_NEUTRAL': 0.2,
    'COMPLETED_OBJECTION': -0.2,
    'NO_ANSWER': -0.3,
    'CALL_DECLINED': -0.5,
    'COMPLAINT': -0.8,
    'INVALID_NUMBER': -0.3
  };

  return resultScores[result] || 0;
}

/**
 * 메모(notes) 텍스트 감정 분석
 * 부정 키워드 찾기 (불만, 환불 요청, 화남 등)
 */
function analyzeNotesSentiment(notes: string): number {
  if (!notes) return 0;

  const text = notes.toLowerCase();

  // 부정 키워드 (마이너스)
  const negativeKeywords = [
    '불만', '환불', '화남', '짜증', '비추', '후회', '실망',
    '문제', '오류', '버그', '서비스 나쁨', '최악', '최악'
  ];

  // 긍정 키워드 (플러스)
  const positiveKeywords = [
    '만족', '추천', '좋음', '최고', '훌륭', '감사', '기대',
    '프리미엄', '다시 올래', '친구 추천', '좋아'
  ];

  const negativeCount = negativeKeywords.filter(k => text.includes(k)).length;
  const positiveCount = positiveKeywords.filter(k => text.includes(k)).length;

  const diff = positiveCount - negativeCount;
  return Math.max(-1, Math.min(1, diff * 0.2));
}

export { SentimentScore };
```

---

## 🎬 Phase 3-3: VoicePlayback 개선 + playbook/page.tsx (1시간)

### 상세 코드는 다음 섹션에서...

(계속)
