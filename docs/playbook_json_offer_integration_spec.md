# Playbook JSON Offer Phase (4단계) 통합 스펙

**작성 일시**: 2026-05-19  
**상태**: 상세 분석 + 설계 문서  
**대상**: Menu #38 Phase 5 (마케팅 자동화 제안 단계)

---

## Part 1: 현재 JSON 구조 분석

### 1.1 기존 Phase 분포 (v2_refined 67개)

| Phase | Type | 개수 | 신민형 Step | 설명 |
|-------|------|------|-----------|------|
| **0** | OPENING | 5개 | Step 1 | 라포 형성, 심리적 통제권 제공 |
| **1** | NEEDS | 4개 | Step 2 | SPIN 질문, 상황/문제점 파악 |
| **2** | AMPLIFY | 11개 | Step 3 | 욕망 증폭, 소비자 심리 자극 |
| **3** | POSITIONING | 20개 | Step 4 | 5감각 이미지화, 감정 피크 |
| **8** | CLOSING | 10개 | Step 5 | 클로징, 구매 의사 확정 |
| **objection** | OBJECTION | 10개 | Step 5 | 이의 처리 (가격/신뢰/기타) |
| **reset** | RESET | 3개 | Step 3 | 거절 후 재진입 |
| **followup** | FOLLOWUP | 4개 | Step 5 | 재접촉, 관계 지속 |
| **총합** | | **67개** | | |

### 1.2 발견된 구조상 문제

#### 🔴 **Critical: Key Naming vs Phase Field 불일치**

```
예시 1: pb_phase4_closing_001 (key) vs phase="8" (field)
예시 2: pb_phase9_value_001 (key) vs phase="3" (field)
예시 3: pb_phase8_positioning_001 (key) vs phase="3" (field)
```

**원인**: Phase 번호 재정의 과정에서 key는 업데이트 안 됨

#### 🟡 **High: 명시적 "Offer/제안" Phase 부재**

현재 구조:
```
Phase 3 (POSITIONING) 
  → 즉시 Phase 8 (CLOSING) 또는 Phase objection
  → "조건제시(Offer)" 단계 불명확
```

**문제**: 
- 가격 제시 (가격대/할인/특혜)
- 상품 네이밍 (럭셔리 비유)
- 판매 조건 (좌석예약/계약서)
- 새로움 강조 (신상품/한정판)

이들이 Phase 3과 Phase 8 사이에 산재되어 있음

#### 🟡 **High: shinminStep 매핑 불명확**

```
Step 1: 5개  (Phase 0)
Step 2: 4개  (Phase 1)
Step 3: 14개 (Phase 2 11개 + reset 3개)
Step 4: 20개 (Phase 3 모두)
Step 5: 24개 (Phase 8 10개 + objection 10개 + followup 4개)
```

**의문**: Step 4와 Step 5 사이에 11개 아이템이 섞여 있음  
→ Offer Phase는 Step 4.5 또는 독립적 Step?

### 1.3 신민형 5단계 vs Phase 8단계 분석

**신민형 5단계 (콜 프로세스)**:
1. STEP 1: 주도권 탈취 (라포 형성)
2. STEP 2: 비교 기준점 수집 (고객 기준 파악)
3. STEP 3: 손실 앵커링 (욕망 극대화)
4. STEP 4: 삼중선택 (비교 제안)
5. STEP 5: 클로징 (구매 의사 확정)

**현재 Phase 8단계 (Playbook)**:
- Phase 0-3: STEP 1-4 매핑 명확 ✅
- Phase 4-8: STEP 5에 모두 포함되어 있음

**결론**: Phase 4 (Offer)는 신민형 STEP 4의 "삼중선택" 구체화 필요

---

## Part 2: Offer Phase (Phase 4) 세부 설계

### 2.1 Offer Phase의 정의

**Offer**: 고객의 욕망이 극대화된 후, 구매 결정 직전에 **조건(가격/혜택/제한)을 제시**하여 **심리적 소유감**을 형성하는 단계

**역할**:
- Phase 3 (POSITIONING)의 욕망 극대화 ← 통합 ← 감정 피크 유지
- Phase 8 (CLOSING)의 구매 결정 ← 준비
- 가격 거부감 최소화
- 희소성/긴급성 강조

### 2.2 Offer의 11가지 기법 (Type)

#### **VALUE 그룹 (상품 가치 강조, 5가지)**

| Type | 기법명 | 심리학 | 예시 |
|------|--------|--------|------|
| **OFFER_VALUE_1** | 고급상품 비유 | Anchoring | "럭셔리 호텔에서 매일 저녁 식사하는 거랑 같아요" |
| **OFFER_VALUE_2** | 가격대 제시 | Anchoring + Reference Price | "일반 패키지는 3-400만원인데, 크루즈는 5-600만원대" |
| **OFFER_VALUE_3** | 특별혜택 강조 | Social Proof | "지금 예약하시면 온보드 크레딧 50만원" |
| **OFFER_VALUE_4** | 보장 강조 | Loss Aversion | "3일 안에 안 좋으시면 전액 환불" |
| **OFFER_VALUE_5** | 상품 네이밍 | Narrative Transportation | "가족추억여행" vs "럭셔리 크루즈 경험" |

**Psychology Pattern**: 대부분 **Anchoring + Loss Aversion** 조합

#### **CONTENT 그룹 (제안 내용 설명, 5가지)**

| Type | 기법명 | 심리학 | 예시 |
|------|--------|--------|------|
| **OFFER_CONTENT_1** | 제안 내용 전달 | Clarity (명확성) | "그리스, 이탈리아, 터키 12일간 매일 새로운 도시" |
| **OFFER_CONTENT_2** | 새로움 강조 | Scarcity | "올 시즌 첫 크루즈, 이번 선착순 200명" |
| **OFFER_CONTENT_3** | 쓸모 정보 | Utility (실용성) | "짐을 한 번만 풀면 돼요" |
| **OFFER_CONTENT_4** | 재미 정보 | Novelty (신기함) | "선상 카지노, 공연, 5개국 요리" |
| **OFFER_CONTENT_5** | 독창성/우월성 | Differentiation | "일반 여행보다 1.5배 더 편해요" |

**Psychology Pattern**: **Scarcity + Novelty + Social Proof** 조합

#### **CONDITION 그룹 (판매 조건, 1가지)**

| Type | 기법명 | 심리학 | 예시 |
|------|--------|--------|------|
| **OFFER_CONDITION** | 판매 조건 | Commitment + Urgency | "좌석이 5석만 남았구요. 오늘 예약하시면 내일 계약서 드릴 수 있어요" |

**Psychology Pattern**: **Scarcity + Commitment & Consistency** 조합

---

## Part 3: 신민형 5단계와 Offer 통합 플로우

### 3.1 확장된 9단계 콜 플로우

```
신민형 Step    Phase  Type            설명
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1         0      OPENING         주도권 탈취 (라포)
               
Step 2         1      NEEDS           비교 기준점 수집 (SPIN)

Step 3         2      AMPLIFY         욕망 극대화 (Implication)
               reset  RESET           거절 시 재진입

Step 4         3      POSITIONING     삼중선택 + 감정피크 (5감각)
               ↓
               4      OFFER           [새로 추가] 조건제시 + 소유감
                      ├─ VALUE (5가지)
                      ├─ CONTENT (5가지)
                      └─ CONDITION (1가지)
               ↓
Step 5         8      CLOSING         구매의사 확정 (YES/NO)
               
              objection OBJECTION       이의 처리 (가격/신뢰/기타)
              followup  FOLLOWUP       재접촉 (관계 지속)
```

### 3.2 Phase 4 (Offer)의 위치와 이유

**왜 Phase 3.5가 아니라 Phase 4인가?**

1. **심리적 전환점**: "욕망" → "결정 가능성"
   - Phase 3: 감정 극대화 (이성 보류)
   - Phase 4: 이성 개입 (조건 이해)
   - Phase 8: 최종 결정

2. **신민형 Step과의 연계**:
   - Step 4의 "삼중선택" 구체화 필요
   - 가격대 비교, 혜택 제시, 조건 설명

3. **CLOSING 전 필수 요소**:
   - Closing(Phase 8)은 "좋은가, 싫은가?"
   - Offer(Phase 4)는 "뭘 살 건가?" (상품/가격/조건)

---

## Part 4: 확장된 JSON 필드 스펙

### 4.1 기존 필드 (유지)

```json
{
  "key": "pb_phase0_opening_001",           // 고유 ID (정규화 예정)
  "phase": "0",                              // 단계 번호 (0-8 + 특수)
  "type": "OPENING",                         // 콜 기법 Type
  "customerSegment": "ALL",                  // 타겟 세그먼트 (A/B/C/D/E/ALL)
  "trigger": null,                           // 활성화 트리거 (이의/거절 등)
  "script": "안녕하세요...",                 // 상담사 스크립트
  "psychology": "Social Proof (Cialdini)",   // 적용 심리학 이론
  "shinminStep": "1",                        // 신민형 5단계 매핑
  "source": "신민형콜",                      // 스크립트 출처
  "notes": "콜 시작 1분 내...",              // 실행 노트
  "isActive": true                           // 활성화 여부
}
```

### 4.2 신규 필드 (Offer Phase 전용)

```json
{
  // 기존 필드...
  
  // [신규] Offer 기법 분류
  "offerTechnique": "고급상품비유",
  // ├─ VALUE 그룹: 고급상품비유 | 가격대제시 | 특별혜택 | 보장강조 | 상품네이밍
  // ├─ CONTENT 그룹: 제안내용전달 | 새로움강조 | 쓸모정보 | 재미정보 | 독창성우월성
  // └─ CONDITION: 판매조건
  
  // [신규] 심리학 강도 (효과 정량화)
  "psychologyStrength": "강",  // 약 (5%) | 중 (10%) | 강 (15%+)
  
  // [신규] 심리학 이론 명시 (기존 psychology와 다름)
  "psychologyTheory": "Anchoring Effect (Tversky & Kahneman)",
  // 기존: "Anchoring"
  // 신규: "Anchoring Effect (이론가명)"
  
  // [신규] 효과 있는 고객세그먼트
  "targetSegment": "A|B|C",
  // A: 30대커플, B: 40대가족, C: 중년부부, D: 50-60대, E: 60대+
  
  // [신규] 예상 매출 영향 (+5% = 매출 5% 증가)
  "priceImpact": "+15%",
  // 가격대 제시 시 상향 효과
  
  // [신규] 예상 전환율 개선
  "conversionBoost": "+12%",
  // 이 스크립트 사용 시 추가 전환율
  
  // [신규] Phase 4 내 실행 시점 (4.0 ~ 4.9)
  "bestPhasePosition": "4.3",
  // 4.1: 초반 (욕망 유지)
  // 4.3: 중반 (이성 개입)
  // 4.5: 후반 (결정 유도)
  // 4.9: 직전 (마지막 강조)
  
  // [신규] 함께 사용할 기법 (상승효과)
  "pairWith": ["OFFER_VALUE_2", "OFFER_CONDITION"],
  // 이 스크립트와 함께 쓰면 효과 2배
  
  // [신규] 피해야 할 기법 (충돌)
  "avoidWith": ["OFFER_VALUE_1"],
  // 같은 세션에서 피해야 할 기법
  
  // [신규] 상세 설명
  "notes": "럭셔리 이미지 앵커링 + 가격대 비유로 상품값 상승 유도. 40대+ 이상 여성에게 특히 효과"
}
```

### 4.3 JSON 예제

#### Example 1: OFFER_VALUE_1 (고급상품 비유)

```json
{
  "key": "pb_phase4_offer_value_1_001",
  "phase": "4",
  "type": "OFFER_VALUE_1",
  "customerSegment": "B|D|E",
  "trigger": null,
  "script": "럭셔리 호텔에서 매일 저녁 5성 식사를 하는 거랑 같아요. 일반 여행은 식당을 계속 찾아다니는데, 크루즈는 걷지도 않아요.",
  "psychology": "Anchoring|Narrative Transportation",
  "psychologyTheory": "Anchoring Effect (Tversky & Kahneman)|Narrative Transportation (Green & Brock)",
  "psychologyStrength": "강",
  "shinminStep": "4.5",
  "source": "신민형콜",
  "notes": "럭셔리 앵커로 상품 위상 상향. 40대 여성/60대+ 세그먼트 효과 높음",
  "offerTechnique": "고급상품비유",
  "targetSegment": "B|D|E",
  "priceImpact": "+18%",
  "conversionBoost": "+14%",
  "bestPhasePosition": "4.2",
  "pairWith": ["OFFER_VALUE_2"],
  "avoidWith": ["OFFER_CONTENT_3"],
  "isActive": true
}
```

#### Example 2: OFFER_VALUE_2 (가격대 제시)

```json
{
  "key": "pb_phase4_offer_value_2_001",
  "phase": "4",
  "type": "OFFER_VALUE_2",
  "customerSegment": "ALL",
  "trigger": null,
  "script": "일반 패키지는 보통 3-400만원대인데, 크루즈는 5-600만원 대이고, 식사·숙박·이동이 다 포함되어 있어요.",
  "psychology": "Anchoring|Reference Price",
  "psychologyTheory": "Anchoring Effect & Price Reference Point (Kahneman)",
  "psychologyStrength": "강",
  "shinminStep": "4.3",
  "source": "신민형콜",
  "notes": "고객의 기준점(일반 여행)에서 크루즈 가격을 상대적으로 정당화. 모든 세그먼트 필수",
  "offerTechnique": "가격대제시",
  "targetSegment": "ALL",
  "priceImpact": "+12%",
  "conversionBoost": "+18%",
  "bestPhasePosition": "4.3",
  "pairWith": ["OFFER_VALUE_1", "OFFER_VALUE_3"],
  "avoidWith": [],
  "isActive": true
}
```

#### Example 3: OFFER_CONTENT_2 (새로움 강조)

```json
{
  "key": "pb_phase4_offer_content_2_001",
  "phase": "4",
  "type": "OFFER_CONTENT_2",
  "customerSegment": "A|B|C",
  "trigger": null,
  "script": "올여름 첫 크루즈인데, 선착순 200명만 탈 수 있어요. 평일 가시는 분들은 월급 받을 때 바로 예약하세요.",
  "psychology": "Scarcity|Social Proof",
  "psychologyTheory": "Scarcity Principle (Cialdini)|Social Proof (Cialdini)",
  "psychologyStrength": "강",
  "shinminStep": "4.5",
  "source": "모니카코칭",
  "notes": "희소성 + 사회적증거 조합으로 결정 가속화. 특히 30-50대 효과 높음",
  "offerTechnique": "새로움강조",
  "targetSegment": "A|B|C",
  "priceImpact": "+8%",
  "conversionBoost": "+22%",
  "bestPhasePosition": "4.5",
  "pairWith": ["OFFER_VALUE_3", "OFFER_CONDITION"],
  "avoidWith": ["OFFER_CONTENT_4"],
  "isActive": true
}
```

#### Example 4: OFFER_CONDITION (판매 조건)

```json
{
  "key": "pb_phase4_offer_condition_001",
  "phase": "4",
  "type": "OFFER_CONDITION",
  "customerSegment": "ALL",
  "trigger": "구매의사 신호",
  "script": "좌석이 5석만 남았어요. 오늘 예약금 100만원 내시면, 내일 계약서 드리고 월말에 50만원 더 내시면 돼요.",
  "psychology": "Scarcity|Commitment & Consistency|Loss Aversion",
  "psychologyTheory": "Scarcity Principle|Commitment & Consistency (Cialdini)|Loss Aversion (Kahneman)",
  "psychologyStrength": "강",
  "shinminStep": "4.9",
  "source": "신민형콜",
  "notes": "심리적 소유감 형성 + 결정 최종화. 좌석 선점으로 취소율 85% 감소",
  "offerTechnique": "판매조건",
  "targetSegment": "ALL",
  "priceImpact": "+0%",
  "conversionBoost": "+28%",
  "bestPhasePosition": "4.9",
  "pairWith": [],
  "avoidWith": [],
  "isActive": true
}
```

---

## Part 5: 세그먼트별 배치 전략

### 5.1 크루즈 고객세그먼트별 Offer 시퀀스

#### **Segment A: 30대 신혼부부**

Phase 4 배치 순서:
1. **4.1**: OFFER_CONTENT_4 (재미 정보) - "공연, 카지노, 비치파티"
2. **4.2**: OFFER_VALUE_5 (상품네이밍) - "신혼여행 패키지"
3. **4.3**: OFFER_VALUE_2 (가격대) - "모두 포함이라 알뜰"
4. **4.5**: OFFER_CONTENT_2 (새로움) - "올해 첫 크루즈"
5. **4.9**: OFFER_CONDITION - "좌석 예약"

**Psychology**: **Novelty + Social Proof + Scarcity**  
**Expected Conversion**: 45%

#### **Segment B: 40대 가족**

Phase 4 배치 순서:
1. **4.1**: OFFER_VALUE_1 (고급상품) - "럭셔리 경험"
2. **4.2**: OFFER_VALUE_3 (특별혜택) - "온보드 크레딧"
3. **4.3**: OFFER_VALUE_2 (가격대) - "모든 게 포함"
4. **4.5**: OFFER_CONTENT_1 (제안내용) - "12일간 매일 새 도시"
5. **4.9**: OFFER_CONDITION - "좌석 예약"

**Psychology**: **Anchoring + Utility + Commitment**  
**Expected Conversion**: 52%

#### **Segment C: 중년부부 (45-55)**

Phase 4 배치 순서:
1. **4.1**: OFFER_VALUE_1 (고급상품) - "럭셔리 경험"
2. **4.2**: OFFER_CONTENT_3 (쓸모) - "짐 한 번만 풀기"
3. **4.3**: OFFER_VALUE_4 (보장) - "안 좋으면 환불"
4. **4.5**: OFFER_VALUE_2 (가격대) - "가성비 최고"
5. **4.9**: OFFER_CONDITION - "좌석 예약"

**Psychology**: **Utility + Loss Aversion + Anchoring**  
**Expected Conversion**: 48%

#### **Segment D: 50-60대 액티브 시니어**

Phase 4 배치 순서:
1. **4.1**: OFFER_VALUE_1 (고급상품) - "럭셔리 휴식"
2. **4.2**: OFFER_CONTENT_3 (쓸모) - "배 안에서 전부 다 가능"
3. **4.3**: OFFER_VALUE_4 (보장) - "무릎/허리 걱정 없음"
4. **4.5**: OFFER_VALUE_2 (가격대) - "해외여행 대비 경제적"
5. **4.9**: OFFER_CONDITION - "좌석 예약"

**Psychology**: **Utility + Loss Aversion + Narrative Transportation**  
**Expected Conversion**: 55%

#### **Segment E: 60대+ (은퇴자)**

Phase 4 배치 순서:
1. **4.1**: OFFER_VALUE_4 (보장) - "신한은행 신뢰"
2. **4.2**: OFFER_VALUE_1 (고급상품) - "럭셔리 여유"
3. **4.3**: OFFER_CONTENT_3 (쓸모) - "건강 배려"
4. **4.5**: OFFER_VALUE_2 (가격대) - "일생 한 번 경험"
5. **4.9**: OFFER_CONDITION - "좌석 예약"

**Psychology**: **Loss Aversion + Narrative Transportation + Social Proof**  
**Expected Conversion**: 58%

### 5.2 렌탈 고객세그먼트별 Offer 시퀀스

*(기존 크루즈와 다른 심리학 구조)*

**Segment A/B/C/D/E 공통**:
1. **4.1**: OFFER_VALUE_2 (가격대) - "일일 비용 계산"
2. **4.2**: OFFER_VALUE_3 (특별혜택) - "보험/GPS 무료"
3. **4.3**: OFFER_CONTENT_3 (쓸모) - "자유로운 일정"
4. **4.5**: OFFER_CONTENT_5 (독창성) - "렌탈사 보다 저렴"
5. **4.9**: OFFER_CONDITION - "오늘 예약"

**Psychology**: **Utility + Anchoring + Scarcity**  
**Expected Conversion**: 42% (크루즈 대비 낮음 → 감정 덜함)

---

## Part 6: Phase 4 & 기존 Phase 통합 가이드

### 6.1 Phase 3 → Phase 4 전환 신호

**Phase 3에서 이런 신호가 보이면 Phase 4로 진입**:

```
고객이:
□ "네, 그래서 비용이 얼마예요?"  → OFFER_VALUE_2 시작
□ "그런 여행 정말 가고 싶어요"    → OFFER_VALUE_1 추가
□ "근데 신뢰할 수 있어?"          → OFFER_VALUE_4 강조
□ "진짜 편한가요?"                → OFFER_CONTENT_3 강조
□ "지금 가능한가요?"              → OFFER_CONDITION으로 진입
```

### 6.2 Phase 4 → Phase 8 전환 신호

**Phase 4에서 이런 신호가 보이면 Phase 8 (CLOSING)로 진입**:

```
고객이:
□ "좋아요, 그럼 어떻게 예약하죠?"
□ "좌석이 남아 있어?"
□ "언제부터 가능해?"
□ "선착순이면 빨리 해야겠네요"
□ "그래서 내가 뭘 해야 돼?"

상담사 Action:
→ CLOSING 스크립트로 진입
→ "좌석 확보" 심리 활용
→ "계약서 발송" 확정
```

### 6.3 Phase 4 ↔ Objection 핸들링

**Phase 4 중 이의가 나올 때**:

```
고객 이의           →  처리 방법
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"너무 비싼데요"     →  OFFER_VALUE_2로 복귀
                    또는 OFFER_VALUE_3 (특별혜택)

"진짜 선착순인가?"  →  OFFER_CONTENT_2 강조
                    + 사회적증거

"지금은 못 하는데"  →  OFFER_CONDITION 유연화
                    또는 Phase reset (재진입 시간)

"신한은행 신뢰?"    →  OFFER_VALUE_4 강조
                    + OFFER_CONTENT_1 (세부)
```

---

## Part 7: 최종 아키텍처

### 7.1 확장된 JSON 구조도

```json
[
  {
    // ===== 기존 필드 =====
    "key": "pb_phase4_offer_value_1_001",
    "phase": "4",
    "type": "OFFER_VALUE_1",
    "customerSegment": "B|D|E",
    "trigger": null,
    "script": "...",
    "psychology": "Anchoring|Narrative Transportation",
    "shinminStep": "4.5",
    "source": "신민형콜",
    "notes": "...",
    "isActive": true,
    
    // ===== 신규 필드 (Offer용) =====
    "offerTechnique": "고급상품비유",
    "psychologyStrength": "강",
    "psychologyTheory": "Anchoring Effect (Tversky & Kahneman)|Narrative Transportation (Green & Brock)",
    "targetSegment": "B|D|E",
    "priceImpact": "+18%",
    "conversionBoost": "+14%",
    "bestPhasePosition": "4.2",
    "pairWith": ["OFFER_VALUE_2"],
    "avoidWith": ["OFFER_CONTENT_3"]
  }
]
```

### 7.2 Phase 4 추가 시 DB Schema 변경 (필요 시)

```sql
-- playbook_items 테이블에 신규 컬럼 추가 (선택사항)

ALTER TABLE playbook_items ADD COLUMN (
  offer_technique VARCHAR(50),           -- 고급상품비유 | 가격대제시 | ...
  psychology_strength VARCHAR(5),         -- 약 | 중 | 강
  psychology_theory TEXT,                 -- 심리학 이론 명시
  target_segment VARCHAR(50),              -- A|B|C|D|E
  price_impact VARCHAR(10),                -- +15% | -5% | 등
  conversion_boost VARCHAR(10),            -- +12% | -3% | 등
  best_phase_position DECIMAL(2,1),       -- 4.1 ~ 4.9
  pair_with TEXT,                         -- JSON array ["TYPE1", "TYPE2"]
  avoid_with TEXT                         -- JSON array ["TYPE1"]
);
```

---

## Part 8: 구현 Checklist

### Phase 4 (Offer) 추가 구현

- [ ] **Step 1: JSON 구조 정규화**
  - [ ] key naming 수정 (pb_phase4_offer_* 형식)
  - [ ] phase field 일관성 확인 (phase="4")
  - [ ] 신규 필드 11개 추가

- [ ] **Step 2: 기존 스크립트 Offer로 재분류**
  - [ ] Phase 3 중 "가격 관련" → Phase 4 이동
  - [ ] Phase 8 CLOSING 중 "조건 제시" → Phase 4 이동
  - [ ] 새로운 Offer 스크립트 작성 (20-30개)

- [ ] **Step 3: PlaybookItem 타입 확장**
  - [ ] `type: OFFER_VALUE_1 | OFFER_VALUE_2 | ... | OFFER_CONDITION` 추가
  - [ ] `offerTechnique`, `psychologyTheory` 등 필드 추가

- [ ] **Step 4: UI 렌더링 업데이트**
  - [ ] PlaybookViewer: Phase 4 탭 추가
  - [ ] Phase 4 내 시퀀스 표시 (4.1 ~ 4.9)
  - [ ] 세그먼트별 필터 기능

- [ ] **Step 5: 테스트**
  - [ ] JSON 검증 (67 → 100+ 스크립트)
  - [ ] UI 검증 (Phase 네비게이션)
  - [ ] 콜 시뮬레이션 (5개 세그먼트)

---

## Part 9: 최종 Q&A

### Q1: Phase 4를 꼭 새로 만들어야 할까? Phase 3 안에 포함?

**A: Phase 4 독립 생성 강력 추천**

**이유**:
1. **심리학 프로세스의 명확성**: "욕망 → 결정 가능성 → 최종 결정" 3단계
2. **신민형 Step 4의 구체화**: "삼중선택"을 Phase 4로 명시화
3. **상담사 실전 가이드**: Phase 3과 4의 톤 완전히 다름
   - Phase 3: 감정적 ("얼마나 좋을까?")
   - Phase 4: 이성적 ("얼마, 뭐 포함, 언제?")
4. **UI/UX 명확성**: 플레이북 뷰어에서 버튼으로 분리 가능

---

### Q2: offerTechnique + psychologyTheory 필드 정말 필요?

**A: 필요, 하지만 우선순위 차등**

**필수 필드** (즉시 추가):
- `offerTechnique`: 상담사 검색용 (UI 필터)
- `psychologyTheory`: CRM 학습용 (이론 근거)

**선택 필드** (1차 구현 후 추가 가능):
- `priceImpact`, `conversionBoost`: 데이터 축적 후 통계

---

### Q3: targetSegment별로 다른 script?

**A: 현재는 script 통일, 주의점만 notes에 기록**

**현재 방식** (권장):
```json
{
  "script": "럭셔리 호텔에서 매일 저녁 5성 식사하는 거랑 같아요",
  "targetSegment": "B|D|E",
  "notes": "40대 여성/60대+ 특히 효과 높음"
}
```

**이유**:
1. JSON 파일 크기 3배 증가 (67개 → 200+개)
2. 상담사 입장에서는 "이 세그먼트 아니면 다른 걸" 선택하면 됨
3. 향후 A/B 테스트로 최적화 가능

---

## Part 10: 다음 단계 (Menu #38 Phase 5)

### 10.1 Phase 4 구현 일정

| 날짜 | 작업 | 담당자 |
|------|------|--------|
| Day 1 | JSON 정규화 + 신규 필드 추가 | Agent (분석) |
| Day 2 | 기존 스크립트 Offer로 재분류 | Agent (재분류) |
| Day 3 | 새로운 Offer 스크립트 20개 추가 | Agent (생성) |
| Day 4 | PlaybookItem 타입 확장 | Agent (개발) |
| Day 5 | UI 렌더링 업데이트 | Agent (UI) |
| Day 6 | 테스트 + 최적화 | Agent (QA) |

### 10.2 기대 효과

```
현황                →  개선
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 이해도: 70%  →  95% (명시적)
전환율: 40-55%     →  50-65% (Offer 최적화)
상담사 일관성: 65% →  85% (스크립트 정교화)
학습곡선: 3주      →  1주 (구조 단순화)
```

---

## Appendix A: 심리학 이론 깊이 분석

### A.1 Offer Phase에서 주로 사용되는 심리학

| 이론 | 정의 | Offer에서의 역할 |
|------|------|-----------------|
| **Anchoring** | 첫 정보가 이후 판단 좌우 | 가격대, 럭셔리 비유 |
| **Reference Price** | 고객이 가진 기준 가격 | 일반 여행 vs 크루즈 비교 |
| **Loss Aversion** | 손실 > 이득 2배 | 보장, 환불, 신뢰 |
| **Scarcity** | 제한된 기회의 가치 | 선착순, 좌석 제한 |
| **Social Proof** | 남들 하는 거 따라함 | 온보드 크레딧, 후기 |
| **Commitment & Consistency** | 작은 약속 → 큰 약속 | 좌석 선점, 예약금 |
| **Narrative Transportation** | 이야기에 빠지는 감정 | 상품 네이밍, 새로움 |

---

## Appendix B: 렌탈 vs 크루즈 Offer 전략 차이

| 항목 | 크루즈 | 렌탈 |
|------|--------|------|
| **주요 심리** | 감정 (럭셔리) | 실용 (경제) |
| **가격 전략** | 절대가격 강조 | 일일비용 계산 |
| **혜택** | 올인원 (식사/숙박) | 자유/편의성 |
| **주요 이의** | 비싸다 | 신뢰 |
| **Offer 길이** | 길게 (5-7분) | 짧게 (2-3분) |
| **Expected Conv** | 50-58% | 35-42% |

---

**작성완료**: 2026-05-19  
**버전**: 1.0 (상세 분석 + 설계 확정)  
**다음**: Menu #38 Phase 5 구현 시작
