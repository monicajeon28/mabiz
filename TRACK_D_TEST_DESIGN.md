# Phase 3 Track D: 12주 A/B 테스트 운영 설계서

## 1. 테스트 개요

| 항목 | 상세 |
|------|------|
| **테스트명** | Cold Call Opening Script A/B 테스트 |
| **기간** | 12주 (2026-05-22 ~ 2026-08-13) |
| **표본 크기** | 600 콜 (A: 300, B: 300) |
| **목표 전환율** | A: 45% (135 전환), B: 55% (165 전환) |
| **최소 검정력** | 80% (β = 0.20) |
| **신뢰도** | 95% (α = 0.05, 양측검정) |
| **주간 목표 콜** | 50 콜/주 (A: 25, B: 25) |

---

## 2. 테스트 일정

### 2.1 타임라인

```
2026-05-22 (Week 1 시작)  → 테스트 킥오프
    ├─ Day 1: Migration 배포, CallLog 필드 활성화
    ├─ Day 2-3: 상담사 교육 (스크립트 A vs B 구분)
    ├─ Day 4-7: 데이터 수집 시작 (Week 1: 50 콜 목표)
    │
2026-06-18 (Week 4 종료)  → 첫 중간분석
    ├─ 콜 누적: ~200개 (목표 200)
    ├─ 전환 누적: ~60개 (목표 45-75)
    ├─ 분석: p-value 계산, 조기종료 규칙 적용
    ├─ 의사결정: Success / Inconclusive / Futility 분류
    │
2026-07-16 (Week 8 종료)  → 두 번째 중간분석
    ├─ 콜 누적: ~400개 (목표 400)
    ├─ 전환 누적: ~120개 (목표 90-150)
    ├─ 분석: p-value 재계산, O'Brien-Fleming 보정
    ├─ 의사결정: 조기 종료 vs 계속 진행
    │
2026-08-13 (Week 12 종료)  → 최종분석
    ├─ 콜 누적: 600개
    ├─ 전환 누적: 240개 (120 per group 기대)
    ├─ 분석: 카이제곱 검정, 신뢰도 구간
    ├─ 의사결정: B 채택 / A 유지
    └─ 보고서 작성

2026-08-20 ~ 2026-08-27   → 최종 보고 및 의사결정
    ├─ 경영진 리뷰
    ├─ 전사 적용 계획 (B 채택 시)
    └─ Phase 4 시작
```

### 2.2 주별 상세 일정

| Week | 날짜 | 목표 콜 | 누적 콜 | 중간점검 | 상태 |
|------|------|--------|--------|---------|------|
| 1 | 05/22-05/28 | 50 | 50 | - | 🟢 시작 |
| 2 | 05/29-06/04 | 50 | 100 | - | ⏳ 진행 |
| 3 | 06/05-06/11 | 50 | 150 | - | ⏳ 진행 |
| 4 | 06/12-06/18 | 50 | 200 | 🔍 중간분석 1 | 🟡 검토 |
| 5 | 06/19-06/25 | 50 | 250 | - | ⏳ 진행 |
| 6 | 06/26-07/02 | 50 | 300 | - | ⏳ 진행 |
| 7 | 07/03-07/09 | 50 | 350 | - | ⏳ 진행 |
| 8 | 07/10-07/16 | 50 | 400 | 🔍 중간분석 2 | 🟡 검토 |
| 9 | 07/17-07/23 | 50 | 450 | - | ⏳ 진행 |
| 10 | 07/24-07/30 | 50 | 500 | - | ⏳ 진행 |
| 11 | 07/31-08/06 | 50 | 550 | - | ⏳ 진행 |
| 12 | 08/07-08/13 | 50 | 600 | 🔍 최종분석 | 🟢 종료 |

---

## 3. 상담사 할당 정책

### 3.1 배치 원칙

```
편향 방지를 위한 3가지 원칙:

1. 상담사별 균등 분배
   - 각 상담사는 A와 B를 거의 동등하게 처리
   - 예: A상담사 → A: 150콜, B: 150콜
   - 한 상담사가 한 그룹만 담당 금지 ❌

2. 그룹별 최소 3명 배정
   - A 그룹: 3명 이상 상담사
   - B 그룹: 3명 이상 상담사 (겹칠 수 있음)
   - 목적: 개별 상담사 스타일 편향 최소화

3. 랜덤 할당 (Monday.com 자동화)
   - 고객 전화 들어오면 자동 할당
   - 수동 선택 금지
   - 매주 검증: 할당 비율 A:B = 50:50 ± 5%
```

### 3.2 상담사 교육 계획 (Week 1)

```
Day 1-2: 기본 교육 (모든 상담사)
├─ 목표: A/B 테스트의 중요성 이해
├─ 내용: 통계, 차이점, 일관성 유지
├─ 시간: 2시간 (온라인 + 오프라인)
├─ 자료: TRACK_D_STATISTICS_SPECIFICATION.md

Day 3: Script v13-A vs v13-B 실습
├─ 모듈 A: 표준 Opening (13분)
│  ├─ 인사 → 신원확인 → 욕망 탐색 (기본)
│  ├─ 포인트: 고객 리드 중심, 빠른 전개
│  └─ 상담사 A, B, C 담당
├─ 모듈 B: 욕망강화 Opening (21분)
│  ├─ 인사 → 신원확인 → 욕망 깊이 있는 탐색
│  ├─ 포인트: 심리적 임팩트, 시간투자
│  └─ 상담사 D, E, F 담당
├─ 실습: 각자 10회씩 시뮬레이션
└─ 검증: 녹음 재생 후 피드백

Day 4-7: 본격 운영 시작
├─ 고객 전화 → 자동 할당 (A or B)
├─ 상담사는 이미 배정된 스크립트 따름
├─ 일일 보고: Slack #ab-test-daily-report
└─ 이상 신호 즉시 보고
```

### 3.3 상담사 할당표 (예시)

| 상담사 | 이름 | 주요 역할 | A 목표 | B 목표 | 비고 |
|--------|------|---------|--------|--------|------|
| user_001 | 김상담 | Senior | 150 | 150 | 리더 역할 |
| user_002 | 이상담 | Lead | 100 | 100 | - |
| user_003 | 박상담 | Lead | 50 | 50 | 반일제 |
| user_004 | 정상담 | Junior | 0 | 150 | B 전담 |
| user_005 | 최상담 | Junior | 150 | 0 | A 전담 |
| user_006 | 허상담 | Intern | 0 | 50 | 신입 |

**자동 할당 알고리즘 (Monday.com)**

```javascript
// 고객 전화 들어올 때 실행
async function assignCallToAgent(contact) {
  // 1. 가용 상담사 조회 (online + 할당 가능)
  const availableAgents = await getAvailableAgents();

  // 2. 해당 상담사의 누적 A/B 비율 조회
  const agentStats = availableAgents.map(agent => ({
    userId: agent.id,
    aCount: await getACallCount(agent.id),
    bCount: await getBCallCount(agent.id),
    ratio: aCount / (aCount + bCount + 1)  // 최초: 0.5
  }));

  // 3. 그룹별로 가장 뒤처진 상담사 선택
  //    → A 비율이 낮으면 A 할당, B 비율이 낮으면 B 할당
  const targetGroup = getRatioDeficitGroup(agentStats);  // 'A' or 'B'
  const assignedAgent = selectLeastAssignedInGroup(agentStats, targetGroup);

  // 4. 상담사에게 전달
  return assignCall(contact, assignedAgent, targetGroup);
}
```

---

## 4. 중간분석 의사결정 규칙

### 4.1 Week 4 중간분석 (n ≈ 200)

```
상황 1: B가 명백히 우위 (p < 0.001, Δ > 15%)
├─ 신호: "조기 성공"
├─ 판정: B 쪽이 압도적으로 우위
├─ 의사결정:
│  ├─ Option 1: Week 8에 조기 종료 (더 이상 테스트 불필요)
│  ├─ Option 2: Week 12까지 계속 (확실성 극대화)
│  └─ 추천: Option 1 (비용 절감, 빨리 배포)
└─ 액션: 경영진 보고, Week 5 이후 전사 공지 검토

상황 2: B와 A 비슷 (2% ≤ Δ ≤ 15%, 0.05 < p < 0.80)
├─ 신호: "유보 중"
├─ 판정: 데이터 부족, 계속 수집 필요
├─ 의사결정:
│  └─ Week 12까지 계속 진행
└─ 액션: 스크립트 일관성 점검, 상담사 교육 재강화

상황 3: A와 B 차이 거의 없음 (p > 0.80, Δ < 2%)
├─ 신호: "효과 없음"
├─ 판정: B의 추가 효과가 뚜렷하지 않음
├─ 의사결정:
│  ├─ Option 1: Week 12 대기 (혹시 모르니 계속)
│  ├─ Option 2: Week 8에 중단 (자원 낭비 방지)
│  └─ 추천: Option 2 (스크립트 재설계 검토)
└─ 액션:
   ├─ 콜 분석: 이탈 단계, 고객 반응 재검토
   ├─ 스크립트팀: v13-B 문제점 파악
   └─ Week 8 결과로 최종 판단
```

### 4.2 Week 8 중간분석 (n ≈ 400)

```
상황 1: B 통계 유의성 확정 (p < 0.01 AND B > A)
├─ 신호: "조기 성공 확정"
├─ 의사결정: ✅ B 채택 (더 이상 테스트 불필요)
├─ 액션:
│  ├─ 경영진 최종 승인
│  ├─ Week 9부터 B 전사 적용 가능
│  └─ 전사 공지 및 교육
└─ 테스트 종료 (Week 12 대기 불필요)

상황 2: 아직 유의성 없음 (p ≥ 0.05)
├─ 신호: "계속 진행"
├─ 의사결정: Week 12까지 계속 (추가 200콜)
├─ 액션:
│  ├─ 스크립트 일관성 재검증
│  ├─ 이탈 분석 깊이 있게 (어느 단계 문제인가)
│  └─ 상담사별 편향 점검
└─ 테스트 계속 (추가 4주)

상황 3: 효과 없음 확정 (p > 0.50 AND Δ < 3%)
├─ 신호: "조기 무효"
├─ 의사결정: ❌ A 유지 (B의 효과 없음)
├─ 액션:
│  ├─ 스크립트팀: 원인 분석
│  │  ├─ 이탈 패턴 분석
│  │  ├─ 상담사 피드백 수집
│  │  └─ 심리학 검증 (PASONA/SPIN 문제?)
│  ├─ Phase 4: 새로운 스크립트 설계 (v13-C)
│  └─ 테스트 종료
└─ 비용 절감 (추가 200콜 불필요)
```

### 4.3 Week 12 최종분석

```
최종 의사결정 (600콜 전체 데이터 기반)

┌─ p-value < 0.05 AND B > A
│  └─→ ✅ B 채택 (통계적으로 유의)
│       ├─ 신뢰도 구간: B: 55% ± 5%, A: 45% ± 5% (겹치지 않음)
│       ├─ 효과 크기: RR = 1.22 (22% 개선)
│       └─ 경영진 승인 후 전사 배포
│
└─ p-value ≥ 0.05
   └─→ ❌ A 유지 (통계적 유의성 부족)
       ├─ 결론: B의 추가 효과 입증 못함
       ├─ 권장: 스크립트 재설계 필요 (v13-C)
       └─ Phase 4: 새로운 실험 계획
```

---

## 5. 데이터 수집 모니터링

### 5.1 Daily Dashboard (매일 자동 생성)

```
┌─────────────────────────────────────────┐
│   A/B Test Daily Report                 │
│   Date: 2026-05-22                      │
├─────────────────────────────────────────┤
│ Test Status: ACTIVE (Week 1 of 12)      │
│                                          │
│ TODAY'S RESULTS                         │
│  A: 5 calls, 2 conversions (40%)        │
│  B: 4 calls, 2 conversions (50%)        │
│                                          │
│ CUMULATIVE (5 days)                     │
│  A: 25 calls, 11 conversions (44%)      │
│  B: 23 calls, 12 conversions (52%)      │
│  p-value: 0.62 (not significant)        │
│                                          │
│ TARGET THIS WEEK                        │
│  Goal: 50 calls (25 each group)         │
│  Current: 48/50 (96%) 📈               │
│                                          │
│ ALERTS                                  │
│  ✅ No issues detected                  │
│  ✅ Data quality good                   │
│  ⚠️  Agent user_004 only assigned B     │
│      → Remind: assign A too             │
└─────────────────────────────────────────┘
```

### 5.2 주간 리포트 (매주 목요일)

```sql
-- Automated query run every Thursday 9:00 AM
-- Output: Slack #ab-test-weekly-report channel

SELECT
  'Week ' || EXTRACT(WEEK FROM now())::text as week,
  abTestGroup,
  COUNT(*) as calls,
  SUM(CASE WHEN conversionDay IS NOT NULL THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(...) / COUNT(*), 2) as conversion_rate,
  COUNT(DISTINCT userId) as agents
FROM "CallLog"
WHERE callStartedAt >= now()::date - INTERVAL '7 days'
GROUP BY abTestGroup
ORDER BY abTestGroup;
```

**예시 결과:**
```
Week 1 Results
├─ Group A: 25 calls, 11 conversions (44%), 3 agents
├─ Group B: 24 calls, 12 conversions (50%), 2 agents
├─ Total: 49/50 target (98% ✅)
├─ p-value: 0.58 (not significant, continue)
└─ Alerts: None
```

### 5.3 Slack 알림 규칙

```
조건 1: 주간 목표 미달 (콜 < 45)
└─→ ⚠️  "Week N 콜 부족: 45개 목표, 40개 실적"
    → 액션: 상담사 연장 근무 또는 추가 콜 요청

조건 2: 그룹 불균형 (A/B 차이 > 10)
└─→ ⚠️  "할당 불균형: A 27개, B 18개"
    → 액션: Monday.com 할당 알고리즘 점검

조건 3: 이탈률 급증 (이전주 대비 > 10% 상승)
└─→ 🚨 "이탈 증가: 주 29% → 38%"
    → 액션: 스크립트 점검, 상담사 피드백 수집

조건 4: 중간분석 시점 (Week 4, 8, 12)
└─→ 📊 "Week 4 중간분석 결과: p-value = 0.62 (inconclusive)"
    → 액션: 경영진 알림, 의사결정 회의
```

---

## 6. 이탈 분석 및 개선

### 6.1 이탈 단계별 분석

```sql
-- 각 그룹별 이탈 단계 분포
SELECT
  abTestGroup,
  abandonmentPhase,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY abTestGroup), 1) as percent
FROM "CallLog"
WHERE abandonmentPhase IS NOT NULL
GROUP BY abTestGroup, abandonmentPhase
ORDER BY abTestGroup, count DESC;
```

**예상 결과 분석:**

| 단계 | A (표준) | B (욕망강화) | 해석 |
|------|---------|---------|------|
| Opening 중 | 15% | 10% | B가 도입부에서 더 효과적 |
| Desire 중 | 25% | 15% | B의 욕망강화가 고객 몰입 증대 |
| Implication 중 | 35% | 40% | B가 너무 길어서 중간 이탈 증가? |
| Close 중 | 20% | 25% | B의 클로징이 더 어려움? |
| Completed | 5% | 10% | B의 완료율이 더 높음 ✅ |

**개선 액션:**
- B의 "Implication 단계 이탈 40%"가 고민거리라면:
  - 스크립트 길이 단축 (21분 → 18분)
  - 또는 고객 질문 더 많이 포함 (일방적 설명 감소)

### 6.2 콜 지속시간 분석

```sql
SELECT
  abTestGroup,
  ROUND(AVG(callDurationMs) / 1000.0 / 60.0, 1) as avg_duration_min,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY callDurationMs) / 1000.0 / 60.0, 1) as median_min,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY callDurationMs) / 1000.0 / 60.0, 1) as p75_min
FROM "CallLog"
WHERE callStartedAt >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY abTestGroup;
```

**예상 결과:**
- A (표준): 평균 13분, 중앙값 12분, P75 16분
- B (욕망강화): 평균 19분, 중앙값 18분, P75 24분
  - 차이: B가 약 6분 더 길음 (설계상 의도)
  - 이탈이 P75 이상에서 많으면 → 길이 단축 필요

---

## 7. 최종 보고서 구성

### 7.1 보고서 제출 일정

```
2026-08-13 (Week 12 종료)   → 데이터 분석 시작
2026-08-15 (금)            → Draft 보고서 완성
2026-08-18 (월)            → 경영진 리뷰 회의
2026-08-20 (수)            → 최종 보고서 확정
2026-08-22 (금)            → 전사 공지 (A or B 확정)
2026-08-27 (수)            → Phase 4 시작
```

### 7.2 최종 보고서 목차

```
PHASE 3 TRACK D: A/B TEST FINAL REPORT

1. Executive Summary (1page)
   ├─ 목적: "Opening Script의 욕망강화 효과 검증"
   ├─ 결론: "B 채택 / A 유지" 명확한 결정
   ├─ 기대효과: "전환율 45% → 55% (10% 개선)"
   └─ 재무영향: "Monthly 고객 +100명 예상"

2. 통계 분석 (3 pages)
   ├─ 표본 크기 검증 (600 콜 수집 완료)
   ├─ 카이제곱 검정 결과
   │  └─ χ² = X.XX, p-value = 0.0XX
   ├─ 신뢰도 구간 95% CI
   │  └─ A: 45% ± 5%, B: 55% ± 5%
   └─ 효과 크기
      └─ RR = 1.22 (22% 개선)

3. 세부 분석 (5 pages)
   ├─ 주간 진행률 (Week 1-12 추이)
   ├─ 세그먼트별 결과 (나이, 성별, 채널)
   ├─ 이탈 분석 (단계별, 지속시간)
   ├─ 상담사별 성과 (편향 검증)
   └─ 중간분석 결과 (Week 4, 8 검토)

4. 권장사항 (2 pages)
   ├─ B 채택 경우:
   │  ├─ 즉시: Week 9부터 전사 적용
   │  ├─ 단계: Agent 재교육 → 점진적 롤아웃
   │  └─ 모니터링: 3개월 지속 추적
   └─ A 유지 경우:
      ├─ 원인: "이탈 단계 분석" (어디가 문제?)
      ├─ 개선: "v13-C 설계" (새로운 스크립트)
      └─ Phase 4: "신규 테스트" 계획

5. 부록 (10 pages)
   ├─ A. 주간 모니터링 데이터 (표/차트)
   ├─ B. 중간분석 상세 (Week 4, 8)
   ├─ C. 이상치 처리 기록
   ├─ D. 스크립트 v13-A vs v13-B (전문)
   ├─ E. 상담사 교육 자료
   └─ F. SQL 쿼리 및 계산식
```

---

## 8. 체크리스트

### 8.1 개발팀 (Day 1-4)

- [ ] Prisma Migration 배포 (CallLog 12개 필드 추가)
- [ ] 인덱스 생성 확인 (abTestGroup, callStartedAt, abandonmentPhase)
- [ ] 분석 SQL 쿼리 배포 및 테스트
- [ ] Daily/Weekly 자동 리포트 스크립트 배포
- [ ] Slack 연동 (alerting 테스트)

### 8.2 운영팀 (Day 2-7)

- [ ] 상담사 교육 완료 (모든 에이전트)
- [ ] Monday.com 자동 할당 알고리즘 활성화
- [ ] 스크립트 A/B 매뉴얼 배포
- [ ] 녹음 동의 SOP 수립
- [ ] 첫 week 콜 50개 수집 (target)

### 8.3 분석팀 (Week 1-12)

- [ ] 매일 Daily Dashboard 확인
- [ ] 매주 목요일 리포트 검토
- [ ] 중간분석 (Week 4, 8) 의사결정
- [ ] 이탈 분석 깊이 있게 (상담팀 피드백)
- [ ] Week 12: 최종 보고서 작성

---

## 9. 리스크 관리

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| 콜 부족 (주 30개 미만) | 중 | 높음 | 주 1회 목표 점검, 할당 조정 |
| 이탈 급증 (50% 이상) | 낮 | 높음 | 스크립트 긴급 점검, 상담사 피드백 |
| 상담사 편향 (한 그룹만 담당) | 중 | 중 | Monday.com 자동화 강화, 주간 감시 |
| 외부 변수 (마케팅 변화) | 중 | 중 | 주간 리뷰, 혼동 변수 기록 |
| 녹음 거부 급증 | 낮 | 낮음 | 사전 고지 개선, 법무팀 협의 |

---

## 10. 예산 및 자원

| 항목 | 비용 | 기간 | 주체 |
|------|------|------|------|
| 상담사 추가 근무 (Week 1-12) | ~$5,000 | 12주 | 운영팀 |
| 데이터 분석 (분석팀) | ~$3,000 | 12주 | 분석팀 |
| 스크립트 개발 및 교육 | ~$2,000 | 1주 | 교육팀 |
| IT 인프라 (DB, 모니터링) | ~$1,000 | 12주 | 개발팀 |
| **Total** | **~$11,000** | **12주** | **전사** |

**ROI 예상:**
- 전환율 개선: 45% → 55% (+10%)
- 월간 추가 고객: ~100명
- 월간 추가 수익: ~$50,000
- **ROI: 4.5배** (11주차부터 수익성)

---

## 참고: 의사결정권자

```
경영 의사결정: 대표이사
스크립트 수정: 콜센터 팀장
데이터 분석: Analytics 담당자
IT 배포: 개발팀 리드
```
