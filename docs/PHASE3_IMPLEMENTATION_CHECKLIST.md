# Phase 3: VoicePlayback 구현 체크리스트

**작성일:** 2026-06-03  
**상태:** 🚀 GO (즉시 구현 가능)  
**예상 소요:** 3.5시간  
**담당:** (Agent-Playbook 2시간 + Agent-Auto 1.5시간 병렬)

---

## 🎯 전체 구현 로드맵

```
Phase 3-1 (30분)  : call-situations.ts 작성
                     ├─ Enum + Library + 함수
                     └─ Agent-Playbook

Phase 3-2 (30분)  : audio-cache.ts + sentiment-analyzer.ts
                     ├─ AudioCache 클래스
                     ├─ SentimentAnalyzer 함수
                     └─ Agent-Playbook

Phase 3-3 (1시간) : VoicePlayback 개선 + 통합
                     ├─ /playbook/VoicePlayback.tsx 개선
                     ├─ /playbook-viewer/VoicePlayback.tsx 개선
                     ├─ /playbook/page.tsx 수정
                     └─ VoicePlaybackUnified.tsx (신규)

Phase 3-4 (1시간) : ToolClickTracker API
                     ├─ src/app/api/tools/click-tracker/route.ts
                     └─ src/lib/click-tracker.ts

Phase 3-5 (30분)  : AutoFeedbackGenerator
                     ├─ src/app/api/tools/auto-feedback/route.ts
                     └─ src/lib/sms-templates/day0-3-by-lens.ts

Phase 3-6 (15분)  : 최종 검증
                     ├─ npx tsc --noEmit
                     ├─ 빌드
                     └─ 커밋

총 소요: 3.5시간
병렬: Phase 3-1/2/3 (Agent-Playbook) + Phase 3-4/5 (Agent-Auto)
```

---

## ✅ Phase 3-1: call-situations.ts (30분)

**파일:** `src/lib/playbook/call-situations.ts` (500줄)

### Task 1-1: Enum + Library 작성 (20분)
```
☐ CallSituation enum 정의
  ├─ Core: PRICE_OBJECTION, HEALTH_CONCERN, REFUND_REQUEST, COMPLAINT
  ├─ Growth: FOOD_CONSULTATION, UPSELL, REBOOKING, CONTRACT_RENEWAL
  └─ 8개 값 모두 정의 ✅

☐ SituationInfo 인터페이스 정의
  ├─ situation: CallSituation
  ├─ displayName: string
  ├─ category: 'core' | 'growth'
  ├─ primaryLens: string (L0-L10)
  ├─ secondaryLenses: string[]
  ├─ openings: { opening1, opening2, opening3 }
  ├─ rebuttal: string (Grant Cardone 반박법)
  ├─ expectedConversionLift: number (%)
  └─ psyPhrase: string (심리학 원리 요약)

☐ CALL_SITUATION_LIBRARY 구현 (400줄)
  ├─ PRICE_OBJECTION (L1+L6+L10, 오프닝 3개, 반박법)
  ├─ HEALTH_CONCERN (L9+L5, 오프닝 3개, 반박법)
  ├─ REFUND_REQUEST (L3+L10, 오프닝 3개, 반박법)
  ├─ COMPLAINT (L0+L3+L8, 오프닝 3개, 반박법)
  ├─ FOOD_CONSULTATION (L7+L8+L9, 오프닝 3개, 반박법)
  ├─ UPSELL (L8+L5+L6, 오프닝 3개, 반박법)
  ├─ REBOOKING (L6+L8, 오프닝 3개, 반박법)
  └─ CONTRACT_RENEWAL (L8+L10+L5, 오프닝 3개, 반박법)

검증 체크리스트:
  ☐ 모든 상황의 primaryLens가 L0-L10 범위
  ☐ 모든 상황의 openings 3개 다 문자열
  ☐ 모든 상황의 rebuttal이 비어있지 않음
  ☐ expectedConversionLift가 0-20% 범위
```

### Task 1-2: suggestCallSituations() 함수 (10분)
```
☐ 함수 시그니처
  suggestCallSituations(
    lens: string,
    callStage?: string,
    sentiment?: string
  ): SituationSuggestion

☐ 로직 구현
  1단계: Lens 기반 1순위 (primary)
    ├─ L0 → COMPLAINT
    ├─ L1 → PRICE_OBJECTION
    ├─ L2 → HEALTH_CONCERN
    ├─ L3 → REFUND_REQUEST
    ├─ L6 → REBOOKING
    ├─ L8 → UPSELL
    ├─ L9 → HEALTH_CONCERN
    ├─ L10 → CONTRACT_RENEWAL
    └─ 기타 → FOOD_CONSULTATION

  2단계: CallStage 기반 2순위들 (secondary)
    ├─ PROSPECT → PRICE_OBJECTION, HEALTH_CONCERN
    ├─ CUSTOMER → REBOOKING, UPSELL
    └─ INACTIVE → COMPLAINT, CONTRACT_RENEWAL

  3단계: Sentiment 오버라이드
    ├─ NEGATIVE → COMPLAINT 최우선
    ├─ POSITIVE → UPSELL 우선
    └─ NEUTRAL → 그대로

☐ 반환 값
  {
    primary: CallSituation,
    secondary: CallSituation[],
    sentiment?: string
  }

검증 체크리스트:
  ☐ suggestCallSituations('L1') → primary = PRICE_OBJECTION
  ☐ suggestCallSituations('L6', 'CUSTOMER') → primary = REBOOKING
  ☐ suggestCallSituations('L10', undefined, 'NEGATIVE')
    → primary = COMPLAINT (Sentiment 오버라이드)
  ☐ secondary는 중복 제거되고 상위 3개만
```

### Task 1-3: 헬퍼 함수 및 export (5분)
```
☐ getSituationInfo(situation: CallSituation): SituationInfo
☐ getAllSituations(): CallSituation[]
☐ getCoreSituations(): CallSituation[]
☐ getGrowthSituations(): CallSituation[]

☐ 모든 함수 export
  export { CallSituation, CALL_SITUATION_LIBRARY, suggestCallSituations, ... }

검증 체크리스트:
  ☐ TypeScript 타입 에러 0개 (tsc --noEmit)
  ☐ import 가능 확인
```

---

## ✅ Phase 3-2: audio-cache.ts + sentiment-analyzer.ts (30분)

### Task 2-1: AudioCache 클래스 (20분)

**파일:** `src/lib/playbook/audio-cache.ts` (350줄)

```
☐ 상수 정의
  ├─ STORAGE_KEY = 'mabiz_audio_cache'
  ├─ METADATA_KEY = 'mabiz_audio_cache_metadata'
  ├─ TTL_MS = 7 * 24 * 60 * 60 * 1000 (7일)
  └─ MAX_SIZE_BYTES = 5 * 1024 * 1024 (5MB)

☐ 인터페이스 정의
  ├─ CacheEntry { url, blob, timestamp, size }
  └─ CacheMetadata { version, entries[], totalSize }

☐ Public 메서드 (5개)
  1. set(url: string, blob: Blob): Promise<void>
     ├─ localStorage에 Base64로 저장
     ├─ 메타데이터 업데이트
     ├─ 크기 초과 시 LRU eviction
     └─ 에러 시 조용히 실패

  2. get(url: string): Promise<Blob | null>
     ├─ URL 기반 조회
     ├─ TTL 확인 (7일 초과 시 null)
     ├─ Base64 → Blob 변환
     └─ 미존재/만료 시 null

  3. remove(url: string): void
     ├─ 특정 파일 제거
     └─ 메타데이터 업데이트

  4. clear(): void
     └─ 전체 캐시 초기화

  5. stats(): { count, totalSize, maxSize, utilizationPercent }
     └─ 캐시 사용량 통계

검증 체크리스트:
  ☐ AudioCache.set('url1', blob1) → localStorage에 저장됨
  ☐ AudioCache.get('url1') → blob1 반환
  ☐ AudioCache.set('url2', blob2) → 메타데이터 업데이트
  ☐ 7일 후 AudioCache.get('url1') → null (TTL 초과)
  ☐ 5MB 초과 시 → 오래된 항목부터 자동 제거
  ☐ stats() → { count: 2, totalSize: ~5MB, utilizationPercent: 99% }
```

### Task 2-2: SentimentAnalyzer 함수 (10분)

**파일:** `src/lib/playbook/sentiment-analyzer.ts` (150줄)

```
☐ 타입 정의
  ├─ ContactSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  └─ SentimentScore { sentiment, score: -1~+1, reasons[] }

☐ analyzeContactSentiment(contact: any): SentimentScore
  1단계: Lens 기반 점수 (30% 비중)
    ├─ L0: -0.5, L1: -0.2, L2: -0.1, L3: 0, ..., L10: +0.5
    └─ score += lensScore * 0.3

  2단계: 콜 결과 기반 점수 (40% 비중)
    ├─ COMPLETED_POSITIVE: +0.8
    ├─ COMPLETED_NEUTRAL: +0.2
    ├─ NO_ANSWER: -0.3
    ├─ COMPLAINT: -0.8
    └─ 최근 3개 콜 평균
    └─ score += callScore * 0.4

  3단계: 메모 텍스트 분석 (30% 비중)
    ├─ 부정 키워드: 불만, 환불, 화남, 짜증, ...
    ├─ 긍정 키워드: 만족, 추천, 좋음, 최고, ...
    ├─ 점수 = (긍정 개수 - 부정 개수) * 0.2
    └─ score += notesScore * 0.3

  4단계: 최종 판정
    ├─ score > +0.2 → POSITIVE
    ├─ score < -0.2 → NEGATIVE
    └─ 그 외 → NEUTRAL

검증 체크리스트:
  ☐ analyzeContactSentiment({ lens: 'L10', callResults: [COMPLETED_POSITIVE] })
    → { sentiment: 'POSITIVE', score: +0.7, reasons: [...] }

  ☐ analyzeContactSentiment({ lens: 'L0', notes: '불만많음, 환불원함' })
    → { sentiment: 'NEGATIVE', score: -0.4, reasons: [...] }

  ☐ analyzeContactSentiment({ lens: 'L5' })
    → { sentiment: 'NEUTRAL', score: +0.05, reasons: [...] }
```

---

## ✅ Phase 3-3: VoicePlayback 개선 + 통합 (1시간)

### Task 3-1: /playbook/VoicePlayback.tsx 개선 (25분)

**파일:** `src/app/(dashboard)/playbook/VoicePlayback.tsx` (400줄)

```
☐ 상태 추가
  ├─ audioRetryCount: number = 0
  ├─ networkMode: NetworkMode = 'WIFI'
  └─ isPlaying: boolean = false

☐ 에러 재시도 로직 구현
  1. audioRetryCount < 3이면 지수 백오프 재시도
     ├─ delay = 1000 * Math.pow(2, audioRetryCount)
     ├─ audioRef.current?.load()
     ├─ setAudioRetryCount(+1)
     └─ setError('재시도 중... (N/3)')

  2. audioRetryCount >= 3이면 최종 실패
     ├─ setAudioEnabled(false)
     ├─ setError('음성 로드 실패. 텍스트를 사용하세요.')
     └─ 텍스트 폴백으로 전환

검증:
  ☐ 첫 실패 → 1초 후 재시도
  ☐ 두 번째 실패 → 2초 후 재시도
  ☐ 세 번째 실패 → 4초 후 재시도
  ☐ 네 번째 시도 실패 → 최종 포기

☐ 안전한 종료 함수 작성
  stopAudioSafely() {
    ├─ audioRef.current.pause()
    ├─ audioRef.current.currentTime = 0
    ├─ audioRef.current.src = ''
    ├─ setIsPlaying(false)
    ├─ setError(null)
    └─ setAudioRetryCount(0)
  }

검증:
  ☐ stopAudioSafely() 호출 후 메모리 누수 없음

☐ 캐시 연계 구현
  if (networkMode === 'CELLULAR') {
    const cached = await AudioCache.get(audioUrl);
    if (cached) {
      ├─ Blob → Data URL 변환
      ├─ audioRef.current.src = dataUrl
      └─ preload="auto" (이미 메모리에 있으니 빠름)
    } else {
      ├─ 네트워크에서 로드
      └─ await AudioCache.set(audioUrl, blob)
  }

검증:
  ☐ WiFi: 캐시 스킵, 직접 스트리밍
  ☐ Cellular: 캐시 확인 후 캐시 없으면 로드 & 저장
  ☐ Offline: 음성 비활성, 텍스트만 표시

☐ 로깅 추가
  logger.log('[VoicePlayback] play', { audioUrl, networkMode, ... })
  logger.warn('[VoicePlayback] error', { reason, retryCount, ... })

검증 체크리스트 (5개):
  ☐ TypeScript 타입 에러 0개
  ☐ 네트워크 모드 전환 시 안전 종료
  ☐ 캐시 적중률 90%+ (Cellular)
  ☐ 로깅 포함
  ☐ useEffect cleanup 완벽
```

### Task 3-2: /playbook-viewer/VoicePlayback.tsx 통합 (15분)

**파일:** `src/app/(dashboard)/tools/playbook-viewer/VoicePlayback.tsx` (350줄)

```
☐ 로깅 추가
  logger.log('[VoicePlayback-Synthesis] play', { scriptId, networkMode, speed })

☐ 재시도 로직 추가 (speech synthesis용)
  // SpeechSynthesis API는 자체 에러 처리가 제한적이므로
  // onend/onerror 후 간단한 상태 관리만 추가

☐ NavigatorConnection 타입 강화
  interface NavigatorConnection {
    effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
    saveData?: boolean;
    type?: string;
    addEventListener?: (type: string, cb: () => void) => void;
    removeEventListener?: (type: string, cb: () => void) => void;
  }

검증 체크리스트:
  ☐ TypeScript 타입 에러 0개
  ☐ 로깅 정상 작동
  ☐ NetworkMode 배지 정상 표시
```

### Task 3-3: /playbook/page.tsx 수정 (15분)

**파일:** `src/app/(dashboard)/playbook/page.tsx` (200줄 추가)

```
☐ Contact 자동 감지 로직
  const { lens, callStage, sentiment: contactSentiment } = contact || {};

☐ 추천 상황 계산
  const suggestions = suggestCallSituations(lens, callStage, contactSentiment);
  // → { primary: PRICE_OBJECTION, secondary: [COMPLAINT, ...], ... }

☐ UI 구현: 추천 스크립트 상단 고정
  <div className="mb-6 p-4 bg-blue-100 rounded-lg">
    <h3 className="font-bold mb-2">📌 이 고객에게 추천</h3>
    {[suggestions.primary, ...suggestions.secondary].map(situation => (
      <button
        key={situation}
        onClick={() => openScript(situation)}
        className="w-full text-left p-2 mb-2 bg-white rounded hover:bg-blue-50"
      >
        {getSituationInfo(situation).openings.opening1}
      </button>
    ))}
  </div>

☐ Lens가 undefined인 경우 처리
  const lens = contact?.lens || 'L0';

검증 체크리스트:
  ☐ Contact L1일 때 → PRICE_OBJECTION 상단 표시
  ☐ Contact NEGATIVE sentiment → COMPLAINT 상단 표시
  ☐ Contact가 없을 때 → L0 기본값으로 처리
  ☐ 버튼 클릭 → 해당 스크립트 열림
```

### Task 3-4: VoicePlaybackUnified.tsx 신규 (10분)

**파일:** `src/app/(dashboard)/playbook/VoicePlaybackUnified.tsx` (200줄)

```
☐ 새 컴포넌트 작성
  export default function VoicePlaybackUnified({
    audioUrl?: string,      // 파일 기반 (playbook용)
    text?: string,          // 텍스트 기반 (playbook-viewer용)
    scriptId?: string,
    ...props
  })

☐ 모드 결정 로직
  if (audioUrl) {
    return <AudioPlayback audioUrl={audioUrl} {...props} />;
  }
  return <SynthesisPlayback text={text} scriptId={scriptId} {...props} />;

☐ 두 컴포넌트 import
  import AudioPlayback from './VoicePlayback';         // 파일 기반
  import SynthesisPlayback from '../tools/playbook-viewer/VoicePlayback'; // 합성

검증 체크리스트:
  ☐ audioUrl 있을 때 → AudioPlayback 사용
  ☐ audioUrl 없을 때 → SynthesisPlayback 사용
  ☐ 둘 다 없을 때 → null 반환
```

---

## ✅ Phase 3-4: ToolClickTracker API (1시간)

### Task 4-1: API 엔드포인트 (40분)

**파일:** `src/app/api/tools/click-tracker/route.ts` (350줄)

```
☐ 데이터 모델 정의
  interface ClickEvent {
    id: string;
    userId: string;
    scriptId: string;
    event: 'click' | 'use' | 'success';
    situation?: string;
    timestamp: Date;
    durationMs?: number;
    tenantId: string;
  }

☐ POST /api/tools/click-tracker (클릭 이벤트 저장)
  Request: { scriptId, event, situation?, durationMs? }
  Response: { success: true, trackId: string }

  1. getMabizSession() → userId, tenantId
  2. 입력값 검증
     ├─ scriptId: 필수, UUID 형식
     ├─ event: 필수, 'click'|'use'|'success' 중 하나
     └─ situation: 선택, CallSituation enum 값 중 하나

  3. PII 검증 ❌
     ├─ contactId는 절대 저장 금지
     ├─ phone, email, name 저장 금지
     └─ userId만 저장

  4. DB 저장
     await db.clickEvent.create({
       data: {
         userId,
         scriptId,
         event,
         situation,
         timestamp: new Date(),
         durationMs,
         tenantId
       }
     })

  5. 응답
     { success: true, trackId: newEvent.id }

검증:
  ☐ POST /api/tools/click-tracker
    { "scriptId": "abc-123", "event": "click", "situation": "PRICE_OBJECTION" }
    → { "success": true, "trackId": "evt-456" }

☐ GET /api/tools/click-tracker/stats (통계 조회)
  Query: ?scriptId=abc-123&days=7
  Response: { usageCount, successCount, successRate, ranking }

  1. 권한 확인
     ├─ AGENT/FREE_SALES: 본인 기록만
     ├─ MANAGER: 팀 기록
     └─ ADMIN/OWNER: 전체

  2. 쿼리
     const events = await db.clickEvent.findMany({
       where: {
         scriptId,
         timestamp: { gte: now - days * 24h },
         userId: role === 'AGENT' ? sessionUserId : undefined
       }
     })

  3. 통계 계산
     ├─ usageCount = events.length
     ├─ successCount = events.filter(e => e.event === 'success').length
     ├─ successRate = (successCount / usageCount) * 100
     └─ ranking = 전체 스크립트 중 상위 N%

  4. 응답
     {
       usageCount: 45,
       successCount: 9,
       successRate: 20,
       ranking: 72  // 상위 72%
     }

검증:
  ☐ GET /api/tools/click-tracker/stats?scriptId=abc-123&days=7
    → { "usageCount": 45, "successRate": 20, ... }

☐ 에러 처리
  ├─ 401: 권한 없음
  ├─ 400: 입력값 유효하지 않음
  ├─ 500: DB 오류

검증 체크리스트:
  ☐ TypeScript 타입 에러 0개
  ☐ PII 검증 완벽 (contactId 저장 금지)
  ☐ 권한 제어 정확함
  ☐ DB 스키마와 일치
```

### Task 4-2: 클라이언트 SDK (20분)

**파일:** `src/lib/click-tracker.ts` (100줄)

```
☐ trackScriptClick 함수 작성
  export async function trackScriptClick({
    scriptId: string,
    event: 'click' | 'use' | 'success',
    situation?: string,
    durationMs?: number
  }): Promise<{ success: boolean; trackId?: string }>

  1. API 호출
     const res = await fetch('/api/tools/click-tracker', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ scriptId, event, situation, durationMs })
     })

  2. 응답 처리
     const data = await res.json();
     if (!res.ok) {
       logger.warn('click-tracker failed', { status: res.status, error: data });
       return { success: false };  // 조용히 실패
     }
     return { success: true, trackId: data.trackId };

  3. 에러 처리
     try { ... } catch (error) {
       logger.error('click-tracker error', error);
       return { success: false };  // 조용히 실패
     }

검증 체크리스트:
  ☐ trackScriptClick({ scriptId: 'abc-123', event: 'click' })
    → { success: true, trackId: '...' }

  ☐ import 가능
    import { trackScriptClick } from '@/lib/click-tracker';

  ☐ VoicePlayback.tsx에서 호출 가능
    onClick={() => {
      trackScriptClick({ scriptId, event: 'click' });
      handlePlay();
    }}
```

---

## ✅ Phase 3-5: AutoFeedbackGenerator (30분)

### Task 5-1: SMS 템플릿 데이터 (15분)

**파일:** `src/lib/sms-templates/day0-3-by-lens.ts` (400줄)

```
☐ SMS_TEMPLATES_BY_LENS 객체 작성
  export const SMS_TEMPLATES_BY_LENS: Record<string, SmsTemplate> = {
    'L0': { day0: '...', day1: '...', day2: '...', day3: '...' },
    'L1': { ... },
    ...
    'L10': { ... }
  }

☐ 각 렌즈별 Day0-3 템플릿 (PASONA 프레임워크)
  L0 (부재/이탈):
    day0: "{{name}}님, 다시 뵙고 싶어요. 특별한 오퍼가 있어서 연락드립니다."
    day1: "부재 고객님을 위한 특가: 40% 할인. 언제가 좋으신가요?"
    day2: "이전 여행의 추억을 다시 경험하세요. 1박 특가로 복귀 이벤트 진행 중"
    day3: "오늘 예약하시면 추가 10% 할인. 남은 좌석 2개입니다. 서둘러주세요!"

  L1 (가격 저항):
    day0: "{{name}}님, 합리적인 가격으로 크루즈 즐기는 방법이 있어요."
    day1: "월 33,000원부터 시작하는 프리미엄 크루즈. 당신의 예산은?"
    day2: "같은 수준 경쟁사 대비 30% 저렴한 이유를 알려드립니다."
    day3: "오늘 예약 시 추가 할인권 증정. 기한: 자정"

  L6 (타이밍 불확실):
    day0: "크루즈 시즌이 성큼 다가왔어요. {{name}}님은 준비되셨나요?"
    day1: "여름 성수기 좌석 예약이 80% 찼습니다. 서두르세요!"
    day2: "8월 크루즈: 남은 선실 5개. 이번 주 예약 필수!"
    day3: "TODAY ONLY: 마지막 선실 1개. 지금 예약하세요!"

  ... (L0-L10 모두 정의)

☐ 변수 플레이스홀더 정의
  {{name}}: 고객 이름
  {{productName}}: 상품명 (크루즈명)
  {{discount}}: 할인율 (%)
  {{price}}: 가격
  {{daysLeft}}: 남은 날짜
  {{seatsLeft}}: 남은 좌석 수

검증 체크리스트:
  ☐ SMS_TEMPLATES_BY_LENS['L0'].day0 존재 및 문자열
  ☐ SMS_TEMPLATES_BY_LENS['L10'].day3 존재 및 문자열
  ☐ 모든 렌즈의 day0~day3 4개씩 정의됨
  ☐ 각 텍스트에 {{변수}} 플레이스홀더 포함
```

### Task 5-2: AutoFeedback API (15분)

**파일:** `src/app/api/tools/auto-feedback/route.ts` (300줄)

```
☐ POST /api/tools/auto-feedback 엔드포인트
  Request: {
    contactId: string,
    email: string,
    phone: string,
    name: string,
    lens?: string,  // 선택, 미제공 시 자동 감지
    discount?: number  // 선택, 기본 30%
  }

☐ 렌즈 자동 감지 (미제공 시)
  if (!lens) {
    lens = await detectLandingLens({
      email, phone, signupSource, ...
    });
    // 기존 detectLandingLens 함수 재사용
  }

☐ SMS 템플릿 로드
  const templates = SMS_TEMPLATES_BY_LENS[lens] || SMS_TEMPLATES_BY_LENS['L0'];

☐ 변수 치환
  const personalizeTemplate = (template: string, data: any) => {
    return template
      .replace('{{name}}', data.name)
      .replace('{{discount}}', data.discount)
      .replace('{{productName}}', data.productName || '크루즈 여행')
      .replace('{{price}}', data.price || '최고급 가격')
      .replace('{{daysLeft}}', data.daysLeft || '7')
      .replace('{{seatsLeft}}', data.seatsLeft || '10');
  }

  const personalizedDay0 = personalizeTemplate(templates.day0, {
    name, discount, productName: '크루즈 특가', ...
  });

☐ ScheduledSms 레코드 생성
  const now = new Date();
  const schedules = [
    {
      contactId, content: personalizedDay0, scheduledAt: now + 0h, day: 0 },
    {
      contactId, content: personalizedDay1, scheduledAt: now + 24h, day: 1 },
    {
      contactId, content: personalizedDay2, scheduledAt: now + 48h, day: 2 },
    {
      contactId, content: personalizedDay3, scheduledAt: now + 72h, day: 3 }
  ];

  await db.scheduledSms.createMany({ data: schedules });

☐ 응답
  {
    success: true,
    contactId,
    lens,
    scheduleCount: 4,
    estimatedSendTime: new Date(now + 72h)
  }

검증 체크리스트:
  ☐ 신규 Contact 생성 → Day0-3 SMS 자동 등록
  ☐ Contact lens = 'L1' → PASONA L1 템플릿 사용
  ☐ {{name}} 치환됨 (예: '김철수님, 합리적인...')
  ☐ ScheduledSms 테이블에 4개 레코드 생성
  ☐ Cron job이 자동으로 발송
```

---

## ✅ Phase 3-6: 최종 검증 (15분)

### Task 6-1: TypeScript 컴파일 확인
```
☐ npx tsc --noEmit
  예상: 0 에러
  
  해결 방법 (에러 시):
  ├─ call-situations.ts: CallSituation, CALL_SITUATION_LIBRARY export
  ├─ audio-cache.ts: AudioCache class export
  ├─ sentiment-analyzer.ts: analyzeContactSentiment export
  ├─ click-tracker.ts: trackScriptClick export
  └─ SMS 템플릿 타입 정의
```

### Task 6-2: 빌드 확인
```
☐ npm run build (또는 next build)
  예상: 성공
  
  주의: npm run build 금지 (EBUSY)
       대신 npx tsc --noEmit만 사용 (dev 서버 실행 중)
```

### Task 6-3: 커밋
```
☐ git add -A
☐ git commit -m "feat(phase3): Playbook 완전화 + Auto P2-P3 구현"
  
  커밋 메시지 요소:
  ├─ call-situations.ts (8가지 상황)
  ├─ audio-cache.ts (캐시 관리)
  ├─ sentiment-analyzer.ts (감정 분석)
  ├─ VoicePlayback 개선 (4개 이슈 해결)
  ├─ ToolClickTracker API (클릭 추적)
  └─ AutoFeedbackGenerator (SMS 자동화)
```

### Task 6-4: 테스트 계획
```
☐ 환경 1: WiFi (MacBook)
  └─ 음성 재생 <1s

☐ 환경 2: Cellular (iPhone)
  └─ 캐시 로드 <2s

☐ 환경 3: Offline (DevTools offline 토글)
  └─ 텍스트 폴백 즉시

☐ 환경 4: Network Switch (WiFi → Cellular)
  └─ 재생 중 전환 시 안전 종료 + 에러 메시지

☐ 성능 메트릭
  ├─ Playbook 로딩: <500ms
  ├─ Voice 재생: <1s (WiFi) / <2s (Cellular)
  ├─ SMS 자동 생성: 100% 정확도
  └─ 클릭 추적: 99%+ 정확도
```

---

## 📊 최종 체크리스트

```
Phase 3-1 (30분): call-situations.ts
  ☐ Enum 정의 (8개)
  ☐ CALL_SITUATION_LIBRARY (500줄)
  ☐ suggestCallSituations() 함수
  ☐ TypeScript 에러 0개 ✅

Phase 3-2 (30분): audio-cache.ts + sentiment-analyzer.ts
  ☐ AudioCache 클래스 (350줄)
  ☐ SentimentAnalyzer 함수 (150줄)
  ☐ TypeScript 에러 0개 ✅

Phase 3-3 (1시간): VoicePlayback 개선
  ☐ /playbook/VoicePlayback.tsx (개선)
  ☐ /playbook-viewer/VoicePlayback.tsx (통합)
  ☐ /playbook/page.tsx (수정)
  ☐ VoicePlaybackUnified.tsx (신규)
  ☐ TypeScript 에러 0개 ✅
  ☐ 캐시 정상 작동 ✅

Phase 3-4 (1시간): ToolClickTracker API
  ☐ POST /api/tools/click-tracker
  ☐ GET /api/tools/click-tracker/stats
  ☐ src/lib/click-tracker.ts (SDK)
  ☐ PII 보호 완벽 ✅
  ☐ 권한 제어 정확 ✅

Phase 3-5 (30분): AutoFeedbackGenerator
  ☐ src/lib/sms-templates/day0-3-by-lens.ts
  ☐ POST /api/tools/auto-feedback
  ☐ SMS 4개 자동 등록 ✅

Phase 3-6 (15분): 최종 검증
  ☐ npx tsc --noEmit → 0 에러
  ☐ npm run build → 성공
  ☐ git commit → 완료
  ☐ 4가지 환경 테스트 → 완료

전체 소요: 3.5시간
예상 배포: 2026-06-03 18:00
```

---

**체크리스트 완료: 구현 준비 완료 ✅**
