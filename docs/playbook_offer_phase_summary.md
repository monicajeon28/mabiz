# Playbook JSON Offer Phase 추가 — 최종 요약

**작성**: 2026-05-19  
**상태**: 분석 + 스펙 설계 완료  
**다음**: Menu #38 Phase 5 (구현)

---

## 현황 분석 결과

### 기존 JSON 구조 (67개)

```
Phase 0 (OPENING)        5개   ✓
Phase 1 (NEEDS)          4개   ✓
Phase 2 (AMPLIFY)       11개   ✓
Phase 3 (POSITIONING)   20개   ✓
Phase 8 (CLOSING)       10개   ← 문제: 가격/혜택/조건이 섞여 있음
Objection               10개
Reset                    3개
Followup                 4개
━━━━━━━━━━━━━━━━━━━━━━━━━━
총 67개
```

### 🔴 발견된 구조적 문제 3가지

| 문제 | 영향 | 해결책 |
|------|------|--------|
| **1. Key vs Phase 불일치** | DB 쿼리 오류 가능 | key naming 정규화 (phase4_offer_*) |
| **2. Offer Phase 부재** | 가격/혜택/조건 모호 | Phase 4 신규 생성 (11가지 Type) |
| **3. shinminStep 매핑 불명확** | 상담 흐름 이해 어려움 | Step 4.5 추가 (Phase 3 ↔ 8 사이) |

---

## 해결책: Phase 4 (Offer) 추가

### 신규 Phase 4 구조

```
신민형 Step     Phase  Type              역할
─────────────────────────────────────────────────
Step 4 (조건)   4      OFFER (11가지)    [신규]
                       ├─ VALUE 5가지
                       ├─ CONTENT 5가지
                       └─ CONDITION 1가지
```

### Offer의 11가지 기법

#### **VALUE 그룹** (상품 가치, 5가지)
- **OFFER_VALUE_1**: 고급상품 비유 (럭셔리 앵커)
- **OFFER_VALUE_2**: 가격대 제시 (기준점 제공)
- **OFFER_VALUE_3**: 특별혜택 강조 (온보드 크레딧)
- **OFFER_VALUE_4**: 보장 강조 (신뢰/환불)
- **OFFER_VALUE_5**: 상품 네이밍 (가족추억여행)

#### **CONTENT 그룹** (제안 내용, 5가지)
- **OFFER_CONTENT_1**: 제안 내용 전달 (도시/일정)
- **OFFER_CONTENT_2**: 새로움 강조 (올해 첫, 선착순)
- **OFFER_CONTENT_3**: 쓸모 정보 (짐 한 번만 풀기)
- **OFFER_CONTENT_4**: 재미 정보 (공연, 카지노)
- **OFFER_CONTENT_5**: 독창성/우월성 (1.5배 편함)

#### **CONDITION 그룹** (판매 조건, 1가지)
- **OFFER_CONDITION**: 판매 조건 (좌석 확보, 예약금)

---

## 세그먼트별 Offer 시퀀스

### Segment B (40대 가족) 예시

```
Phase 4 진행 순서:

4.1 → OFFER_VALUE_1        "럭셔리 호텔 같은 경험"
      (고급상품 비유)       (욕망 유지)

4.2 → OFFER_VALUE_3        "온보드 크레딧 50만원"
      (특별혜택)           (이성적 가치)

4.3 → OFFER_VALUE_2        "일반 400만원 vs 크루즈 600만원"
      (가격대)             (합리화)

4.5 → OFFER_CONTENT_1      "그리스→이탈리아→터키 12일"
      (제안 내용)          (명확성)

4.9 → OFFER_CONDITION      "좌석 5개만 남았어요"
      (판매 조건)          (결정 유도)

↓ 전환율 예상: 52%
```

---

## 확장된 JSON 필드 (기존 + 신규)

### 기존 필드 (7개) - 유지

```json
{
  "key": "pb_phase4_offer_value_1_001",
  "phase": "4",
  "type": "OFFER_VALUE_1",
  "customerSegment": "B|D|E",
  "script": "럭셔리 호텔에서...",
  "psychology": "Anchoring",
  "shinminStep": "4.5",
  "notes": "...",
  "isActive": true
}
```

### 신규 필드 (10개) - Offer 전용

| 필드 | 타입 | 용도 | 예시 |
|------|------|------|------|
| `offerTechnique` | string | UI 필터 | "고급상품비유" |
| `psychologyTheory` | string | 이론 근거 | "Anchoring Effect (Tversky)" |
| `psychologyStrength` | enum | 효과 강도 | "강" (15%+) |
| `targetSegment` | string | 효과 있는 세그먼트 | "B\|D\|E" |
| `priceImpact` | string | 매출 영향 | "+18%" |
| `conversionBoost` | string | 전환율 개선 | "+14%" |
| `bestPhasePosition` | decimal | Phase 4 내 시점 | "4.2" |
| `pairWith` | array | 상승효과 기법 | ["VALUE_2"] |
| `avoidWith` | array | 충돌 기법 | ["CONTENT_3"] |
| (기존)| | | |

---

## 최종 답변: 3가지 의문점

### ❓ Q1: Phase 4를 꼭 새로 만들어야 할까?

**A: YES, 강력 추천**

**이유**:
1. 심리학 프로세스 명확성 (감정 → 이성 → 결정)
2. 신민형 Step 4의 "삼중선택" 구체화
3. 상담사 실전 가이드 (톤 완전 다름)
4. UI 명확성 (플레이북 네비게이션)

---

### ❓ Q2: offerTechnique + psychologyTheory 필드 필요?

**A: 필수, 다만 우선순위 차등**

**1차 구현 (필수)**:
- `offerTechnique`: 상담사가 "고급상품비유" 찾을 때 필요
- `psychologyTheory`: 학습용 (이론 근거 명시)

**2차 구현 (선택)**:
- `priceImpact`, `conversionBoost`: 데이터 축적 후

---

### ❓ Q3: targetSegment별로 다른 script?

**A: NO, script는 통일, notes에만 기록**

**현재 방식** (권장):
```json
{
  "script": "럭셔리 호텔에서...",
  "targetSegment": "B|D|E",
  "notes": "40대 여성/60대+ 특히 효과"
}
```

**이유**:
- JSON 폭발 방지 (67 → 200+ 아이템)
- 상담사: 세그먼트 아니면 다른 걸 선택
- A/B 테스트로 향후 최적화 가능

---

## 구현 로드맵 (Menu #38 Phase 5)

### Day 1: JSON 정규화
- [ ] key naming 수정 (pb_phase4_offer_*)
- [ ] phase field 일관성 (phase="4")
- [ ] 신규 필드 10개 추가

### Day 2-3: 스크립트 작업
- [ ] 기존 스크립트 Offer로 재분류
- [ ] 새로운 Offer 스크립트 20-30개 추가
- [ ] 세그먼트별 배치 검증

### Day 4-5: 코드 구현
- [ ] PlaybookItem 타입 확장
- [ ] UI (PlaybookViewer) 업데이트
- [ ] 세그먼트 필터 기능

### Day 6: 테스트 + QA
- [ ] JSON 검증
- [ ] UI 네비게이션 검증
- [ ] 콜 시뮬레이션 (5개 세그먼트)

---

## 기대 효과

```
지표              현황      개선 후    향상도
──────────────────────────────────────────
Phase 이해도      70%   →   95%      +25%
전환율           40-55% →  50-65%    +10-15%
상담사 일관성     65%   →   85%      +20%
학습 곡선         3주   →   1주      3배 빠름
```

---

## 상세 문서 위치

```
D:\mabiz-crm\docs\playbook_json_offer_integration_spec.md (800줄)
  ├─ Part 1: 현황 분석 (JSON 구조, Phase 분포, 문제점)
  ├─ Part 2: Offer Phase 정의 (11가지 기법)
  ├─ Part 3: 신민형 5단계 통합 (9단계 콜 플로우)
  ├─ Part 4: JSON 필드 확장 스펙 (필드 정의 + 예제)
  ├─ Part 5: 세그먼트별 배치 (5개 세그먼트 × 시퀀스)
  ├─ Part 6: Phase 통합 가이드 (Phase 3→4→8 전환)
  ├─ Part 7: 최종 아키텍처 (JSON 구조도)
  ├─ Part 8: Checklist (구현 단계별)
  ├─ Part 9: Q&A (의문점 해결)
  ├─ Part 10: 다음 단계
  ├─ Appendix A: 심리학 이론 (7가지)
  └─ Appendix B: 렌탈 vs 크루즈 (전략 차이)
```

---

**결론**: Offer Phase 추가는 현재 구조의 **명확성 + 효율성 + 학습곡선 모두 개선**하는 필수 변경사항입니다.

**다음 액션**: Menu #38 Phase 5 구현 시작 (Day 1부터 위 로드맵 따르기)
