# Phase 3 Track D: A/B 테스트 통계 유효성 명세서

## 1. 표본 크기 계산 (Two-Proportion Z-Test)

### 1.1 가정 및 설정

```
귀무가설 (H0): A/B 전환율 같음 → p_A = p_B
대립가설 (H1): B가 A보다 높음 → p_A = 45%, p_B = 55% (10% 차이)

통계적 요구사항:
- 유의수준 (Significance level, α) = 0.05 (양측검정: α/2 = 0.025)
- 검정력 (Power, 1-β) = 0.80 (β = 0.20)
  → 실제 효과가 있을 때 이를 감지할 확률 80%
  
표준정규분포 값:
- z_{α/2} = 1.96 (양측 5% 신뢰도)
- z_β = 0.84 (80% 파워)
```

### 1.2 표본 크기 공식

```
Two-Proportion Z-Test 표본 크기:

n = 2 × (z_{α/2} + z_β)² × p̄(1-p̄) / (p_B - p_A)²

여기서:
p̄ = (p_A + p_B) / 2 = (0.45 + 0.55) / 2 = 0.50
```

### 1.3 계산

```
n = 2 × (1.96 + 0.84)² × 0.50 × 0.50 / (0.55 - 0.45)²
  = 2 × (2.80)² × 0.25 / (0.10)²
  = 2 × 7.84 × 0.25 / 0.01
  = 3.92 / 0.01
  = 392 명 per group

총 필요 표본: 392 × 2 = 784 콜

현실 고려:
- 전화 응답률: ~70% (발신 중 30% 미응답)
- 콜 완료율: ~80% (이탈 20%)
- 컨버전 추적률: ~90% (정보 누락 10%)

보수적 추정:
필요 발신: 784 / (0.70 × 0.80 × 0.90) ≈ 1,555 통화
→ 주당 130콜 필요 (12주 기준)

권장: 800-1000 콜 최종 데이터 수집 (주당 70-85콜)
```

### 1.4 기존 계획 vs 개선안 비교

| 항목 | 기존 (4주) | 개선안 (12주) |
|------|----------|----------|
| **계획 기간** | 4주 | 12주 |
| **총 콜 수** | 200 (A:100, B:100) | 600 (A:300, B:300) |
| **주당 콜** | 50 | 50 |
| **표본 크기 비율** | 200/784 = **26%** | 600/784 = **76%** |
| **통계 검증 가능성** | ❌ 불가능 | ✅ 충분 |
| **신뢰도** | <50% | >80% |
| **검증 불가 이유** | 최소 표본의 1/4 | - |
| **이탈률 50% 시** | 콜 성공 100개만 (완전 무효) | 콜 성공 300개 (유효) |

**결론: 200콜은 표본 크기 부족으로 인해 통계적 결론 도출 불가능. 12주 600콜로 확대 필수.**

---

## 2. 조기 종료(Early Stopping) 정책

### 2.1 목적

- 효과가 명백할 경우: **조기 성공** (Week 8 종료 가능)
- 효과가 없을 경우: **조기 무효** (Week 12 대기 생략)
- 중간 신호 감지: **수정 조치** (스크립트 팀 협의)

### 2.2 중간 분석 일정 및 규칙

```json
{
  "interim_analyses": [
    {
      "week": 4,
      "planned_conversions": 60,
      "description": "초기 신호 감지",
      "rules": {
        "success_indicator": {
          "condition": "B의 전환율 - A의 전환율 > 15%",
          "p_value_threshold": "p < 0.001",
          "action": "Week 8에 조기 종료 고려, 추가 콜 10개 모니터링"
        },
        "futility_indicator": {
          "condition": "B의 전환율 - A의 전환율 < 2%",
          "p_value_threshold": "p > 0.80",
          "action": "스크립트 재검토, Week 8 전 수정 계획 수립"
        },
        "inconclusive": {
          "condition": "2% ≤ 차이 ≤ 15%",
          "action": "계획대로 Week 8까지 진행"
        }
      }
    },
    {
      "week": 8,
      "planned_conversions": 120,
      "description": "중간 점검(데이터 30% 수집 후)",
      "rules": {
        "stop_early_success": {
          "condition": "B > A에서 p-value < 0.01",
          "action": "최종 정책: Week 12 대기 없이 B 채택 확정, 이유: 효과 명백"
        },
        "stop_early_futility": {
          "condition": "차이 < 3% AND p-value > 0.50",
          "action": "A유지 권고, 추가 자원 낭비 방지"
        },
        "continue": {
          "condition": "그 외",
          "action": "Week 12까지 진행, 추가 콜 300개 수집"
        }
      }
    },
    {
      "week": 12,
      "planned_conversions": 240,
      "description": "최종 분석(전체 데이터)",
      "rules": {
        "final_decision": {
          "condition": "p-value < 0.05 AND B > A",
          "action": "✅ B 채택 확정 (통계적 유의성 입증)"
        },
        "no_significance": {
          "condition": "p-value ≥ 0.05",
          "action": "❌ A 유지 (차이 없음), 프로젝트 완료"
        }
      }
    }
  ]
}
```

### 2.3 의사결정 나무

```
┌─ Week 4 (60 conversions)
│  ├─ B >> A (p < 0.001) ──→ "조기 성공 신호" → Monitor Week 8
│  ├─ B ≈ A (p > 0.80) ────→ "효과 없음 신호" → Script Review
│  └─ 2% ≤ Δ ≤ 15% ────────→ "유보 중" → Continue
│
├─ Week 8 (120 conversions)
│  ├─ p < 0.01 AND B > A ──→ ✅ 조기 종료 (효과 명백)
│  ├─ p > 0.50 AND Δ < 3% ─→ ❌ 조기 무효 (낭비 방지)
│  └─ Inconclusive ────────→ Continue to Week 12
│
└─ Week 12 (240 conversions)
   ├─ p < 0.05 AND B > A ──→ ✅ 최종 채택 (공식 결론)
   └─ p ≥ 0.05 ───────────→ ❌ A 유지 (프로젝트 종료)
```

---

## 3. 통계 검증 방법

### 3.1 카이제곱 검정 (χ²-test)

최종 분석에서 사용하는 기본 방법:

```
             B 전환    B 미전환    합계
A 그룹        a          b       a+b
B 그룹        c          d       c+d
합계        a+c        b+d       n

χ² = n(ad - bc)² / [(a+b)(c+d)(a+c)(b+d)]

p-value 계산 → Contingency table 사용
```

### 3.2 추가 검증: Fisher's Exact Test

표본이 작으면 (n < 40 in any cell):
- 피셔의 정확확률 검정 사용
- p-value 더 정확

### 3.3 신뢰도 구간 (95% CI)

```
각 그룹 전환율: p ± z_{α/2} × √[p(1-p)/n]
  → A 전환율: 45% ± 1.96 × √[0.45×0.55/300] ≈ 45% ± 5.6%
           → [39.4%, 50.6%]
  → B 전환율: 55% ± 1.96 × √[0.55×0.45/300] ≈ 55% ± 5.6%
           → [49.4%, 60.6%]

신뢰도 구간이 겹치지 않으면 → 통계적으로 유의 (p < 0.05)
```

### 3.4 효과 크기 (Effect Size)

```
상대 위험도 (Relative Risk):
RR = p_B / p_A = 55% / 45% ≈ 1.22
  → B가 A보다 22% 더 효과적

수우드스 H 통계량:
H = 2 × [√(p_B/(1-p_B)) - √(p_A/(1-p_A))]
  → 정규성 가정 완화
```

---

## 4. 중간 분석 보정 (Multiple Testing Correction)

중간 분석 3회 시행 → 다중 비교 문제 발생 가능
→ 알파 값 조정 필요

### 4.1 Bonferroni 방법 (보수적)

```
원래 α = 0.05
분석 3회 → 각 분석 α' = 0.05 / 3 ≈ 0.0167
```

### 4.2 O'Brien-Fleming 방법 (권장)

더 정확한 중간 분석 보정:

```
Week 4:  α₁ = 0.001  (0.05 / 2.80)
Week 8:  α₂ = 0.013  (0.05 / √2)
Week 12: α₃ = 0.048  (0.05 / 1.04)

→ Week 4에서는 매우 엄격 (p < 0.001)
→ Week 12에서는 원래대로 (p < 0.05)
```

**적용: SQL 쿼리에서 Week별 p-value 임계값 지정**

---

## 5. 샘플 크기 감시 대시보드

### 5.1 주간 모니터링 메트릭스

```sql
-- 매주 목요일 자동 생성 리포트
SELECT
  EXTRACT(WEEK FROM callStartedAt) as test_week,
  abTestGroup,
  COUNT(*) as total_calls,
  SUM(CASE WHEN result = 'COMPLETED' THEN 1 ELSE 0 END) as completed_calls,
  SUM(CASE WHEN conversionDay IS NOT NULL THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(CASE WHEN conversionDay IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
  ROUND(AVG(callDurationMs) / 1000.0, 1) as avg_duration_sec,
  COUNT(DISTINCT contactId) as unique_contacts
FROM "CallLog"
WHERE abTestGroup IS NOT NULL
GROUP BY test_week, abTestGroup
ORDER BY test_week DESC, abTestGroup;
```

### 5.2 목표 vs 실제

| Week | 목표 콜 | 목표 전환 | 실제 콜 | 실제 전환 | 진행율 | 상태 |
|------|--------|---------|--------|---------|-------|------|
| 1 | 50 | 22-27 | ? | ? | ? | ⏳ |
| 2 | 50 | 22-27 | ? | ? | ? | ⏳ |
| 3 | 50 | 22-27 | ? | ? | ? | ⏳ |
| 4 | 50 | 22-27 | ? | ? | ? | 🔍 중간분석 |
| 5-8 | 200 | 90-110 | ? | ? | ? | ⏳ |
| 9-12 | 300 | 135-165 | ? | ? | ? | 🔍 최종분석 |

---

## 6. 데이터 수집 체크리스트

### 6.1 상담사 준비

- [ ] A/B 그룹 무작위 할당 (Monday.com 자동화)
- [ ] 스크립트 v13-A (표준) vs v13-B (욕망강화) 준비
- [ ] 상담사별 할당: 각 그룹 최소 3명 (편향 방지)
- [ ] 콜 전 script version 입력 (필수)

### 6.2 기술 준비

- [ ] CallLog 필드 추가 SQL 배포
- [ ] 통화 녹음 자동 capturing (callStartedAt/callEndedAt)
- [ ] 녹음 동의 자동 수집 (법적 준수)
- [ ] Weekly 대시보드 자동화 (Slack 통보)

### 6.3 분석 준비

- [ ] 3개 분석 SQL 쿼리 배포
- [ ] p-value 계산 자동화 (Python script)
- [ ] 중간 분석 규칙 코드화
- [ ] 의사결정 나무 의사결정권자 공유

---

## 7. 리스크 및 완화 전략

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|------|------|---------|
| 응답률 저조 (<60%) | 중 | 높음 | Week 2-3에서 콜 수 30% 증대 |
| 스크립트 바뀜 (일관성 부족) | 중 | 높음 | 주간 스크립트 감시, 에이전트 교육 |
| 이탈 집중 (한 그룹) | 낮 | 높음 | 그룹별 이탈 분석, 스크립트 수정 |
| 외부 요인 (마케팅 변화) | 중 | 중 | 주간 리뷰, 혼동 변수 기록 |
| 녹음 동의 거부 | 낮 | 낮음 | 사전 고지, SMS 동의 확인 |

---

## 8. 최종 보고서 구성

테스트 종료 후 (Week 12):

```
1. Executive Summary
   - A vs B 최종 전환율
   - p-value 및 신뢰도 구간
   - 의사결정 (채택/기각)

2. 통계 분석
   - 표본 크기 검증
   - 카이제곱 검정 상세
   - 효과 크기 (RR, NNT)

3. 세부 분석
   - 세그먼트별 결과 (나이, 성별, 채널, etc)
   - 이탈 분석 (어느 단계에서 많이 끊김)
   - 콜 지속시간 비교

4. 권장사항
   - B 채택 시: 전사 적용 일정
   - A 유지 시: 원인 분석 및 개선 방향
   - 추가 연구: 필요 시 Phase 4 주제 제시

5. 부록
   - 주간 모니터링 데이터
   - 중간 분석 결과
   - 이상치 처리 기록
```

---

## 참고문헌

- Campbell, D. T., & Stanley, J. C. (1963). **Experimental and quasi-experimental designs for research**.
- Zar, J. H. (2013). **Biostatistical Analysis** (5th ed.). Prentice Hall.
- Power analysis: https://www.sample-size.net/
- 한국통계청 표본크기 계산: https://kostat.go.kr/
