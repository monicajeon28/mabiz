# 마비즈 CRM 에이전트 지시서 (2026-05-26)

에이전트는 모든 작업에서 **심리학 + 마케팅 + 자동화** 통합 프레임워크를 적용하고, 12가지 Template과 195+ 메모리 파일을 자동으로 활용합니다.

---

## 🎯 12가지 Agent Template 자동 선택 규칙

### 작업 유형별 Template 선택

| 작업 유형 | Template | 사용 가능한 메뉴 | 핵심 체크리스트 |
|---------|----------|-----------------|-----------------|
| **T1: 판매/CRM 기능** | `CLAUDE_AGENT_PROMPTS.md - Template 1` | Menu #36-40, 콜 플레이북, CRM 자동분류 | ✅ 심리학 10렌즈 3개 이상 / ✅ Day 0-3 SMS 시퀀스 / ✅ Grant Cardone 반박법 |
| **T2: 마케팅/광고** | `CLAUDE_AGENT_PROMPTS.md - Template 2` | 광고관리, SNS 캠페인, 마케팅 자동화 | ✅ 채널별 최적화 (Facebook/Google/Naver) / ✅ Russell Brunson 퍼널 / ✅ PASONA/SPIN 카피 |
| **T3: 파트너 교육** | `CLAUDE_AGENT_PROMPTS.md - Template 3` | 신입 온보딩, 성공 템플릿, 교육 자료 | ✅ 세그먼트별 페르소나 / ✅ 체크리스트 자동화 / ✅ 성과 추적 |
| **T4: SMS 자동화** | `CLAUDE_AGENT_PROMPTS.md - Template 4` | 메시지 시퀀스, Day 0-3 자동화, 렌탈 마법사 | ✅ PASONA + SPIN 통합 / ✅ 심리학 트리거 / ✅ A/B테스트 자동화 |
| **T5: CRM 자동화** | `CLAUDE_AGENT_PROMPTS.md - Template 5` | Contact 분류, Workflow, Risk Flag, 태그 규칙 | ✅ 렌즈 감지 엔진 / ✅ 자동 세그먼테이션 / ✅ Risk Score 산출 |
| **T6: 대시보드/KPI** | `CLAUDE_AGENT_PROMPTS.md - Template 6` | 성과 리포팅, 대시보드 설계, KPI 추적 | ✅ 현재 vs 목표 메트릭 / ✅ 주간/월간 리포팅 / ✅ 자동 경고 시스템 |
| **T7: CRM 자동화 고급** | `CLAUDE_AGENT_PROMPTS.md - Template 7` | Menu #42-45, Workflow Chain, Multi-step Auto | ✅ Trigger Chain 3단계 / ✅ Workflow 8가지 패턴 / ✅ Risk Flag 10개 + 가중치 |
| **T8: Affiliate 시스템** | `CLAUDE_AGENT_PROMPTS.md - Template 8` | Menu #46-48, 제휴 파트너, Commission 추적 | ✅ Affiliate Type 4가지 / ✅ Commission 3단계 자동화 / ✅ Attribution 6메트릭 |
| **T9: SMS/Email 고급** | `CLAUDE_AGENT_PROMPTS.md - Template 9` | Menu #29, #38 심화, Dynamic Content, A/B Test | ✅ Dynamic Content 5가지 / ✅ A/B 테스트 자동화 / ✅ Ebbinghaus 망각곡선 |
| **T10: 심리학 렌즈 통합** | `CLAUDE_AGENT_PROMPTS.md - Template 10` | Menu #49-52, L3-L10 구현, Lens Detection Engine | ✅ 렌즈 감지 엔진 10가지 / ✅ Auto-Segmentation / ✅ 렌즈별 Workflow 10가지 |
| **T11: Analytics 대시보드** | `CLAUDE_AGENT_PROMPTS.md - Template 11` | Menu #9, #35, 심화 성과 추적, 의사결정 자동화 | ✅ 5계층 피라미드 / ✅ 위험도 대시보드 / ✅ 주간/월간 리포트 자동생성 |
| **T12: Partner Success** | `CLAUDE_AGENT_PROMPTS.md - Template 12` | Menu #21 심화, 파트너 온보딩, 교육, 추적 | ✅ 4단계 라이프사이클 / ✅ 페르소나별 맞춤경로 / ✅ Churn 방지 자동화 |

---

## 📂 RAG 검색 자동화 (CLAUDE_RAG_INDEX.md)

작업 시작 시 **작업 유형별로 아래 패턴으로 자동 검색**:

### 판매/심리학 관련 (Grant Cardone 10렌즈)
```
[[grant_cardone_closing]]
[[grant_cardone_rebuttal]]
[[grant_cardone_followup_mistakes]]
[[grant_cardone_deal_killer]]
[[l0_reactivation_inactive_customers]]
[[l1_lens_complete]]
[[l2_lens_5step_mediation_questions]]
[[l3_lens_differentiation_misinception]]
[[l5_suitability_self_projection]]
[[l6_timing_loss_aversion]]
[[l7_companion_family_persuasion]]
[[l8_repurchase_habitual_growth]]
[[l9_health_safety_medical_trust]]
[[l10_immediate_purchase_closing]]
```

### 마케팅 관련 (SNS 8채널 + Russell Brunson)
```
[[sns_facebook_advertising]]
[[sns_instagram_basics]]
[[sns_facebook_operations]]
[[sns_facebook_safety]]
[[sns_performance_ads]]
[[sns_blog_marketing]]
[[pasona_framework_complete]]
[[spin_selling_complete]]
```

### CRM/자동화 관련 (Menu별 메모리)
```
[[menu_*_complete]]
[[rental_sms_3day_sequence]]
[[grant_cardone_millions_phone]]
[[cold_call_script_v6_complete]]
```

---

## ⚙️ 에이전트 기본 작업 프로세스

### 1️⃣ 작업 시작 (문제 정의)
- [ ] 작업 유형 파악 (T1-T6 중 선택)
- [ ] CLAUDE_AGENT_PROMPTS.md에서 **해당 Template 복사**
- [ ] CLAUDE_RAG_INDEX.md에서 **관련 메모리 파일 3-5개 검색**
- [ ] 기존 관련 커밋/이슈 확인

### 2️⃣ 심리학 프레임워크 적용
- [ ] **Grant Cardone 10렌즈** 중 최소 3개 이상 분석
  - 손실회피, 사회증명, 희소성, 긴박감, 일관성, 권위성, 상호성, 집단사고, 이야기, 자기투영
- [ ] **세그먼트별 페르소나 매핑** (최소 3가지)
- [ ] **이의 대응 시나리오** 5가지 이상 (가격/준비/기항지/자유/능력/의료/시간)
- [ ] **성과 메트릭 자동 정의**
  - 현재: [기존 전환율]% → 목표: [심리학 적용 후]%

### 3️⃣ 자동화 시퀀스 설계
- [ ] **Day 0-3 SMS/이메일 자동화** (필수)
  - Day 0: 초기 액션 + 기본 SMS (PASONA P단계)
  - Day 1: Follow-up + 이의 대응 첫 번째 (PASONA S단계)
  - Day 2: 가치 강조 + 사례 스토리 (PASONA O단계)
  - Day 3: 긴박감 + 최종 결정 촉구 (PASONA A단계)
  - Day 7: 재접근 + 제한 해제 (Grant Cardone Follow-up)
- [ ] **멀티채널 자동화** (해당 시 필수)
  - SMS + 이메일 + 콜 스크립트 동시 진행
  - CRM 태그 자동 생성
  - 다음 액션 자동 스케줄링

### 4️⃣ 성과 추적 자동화
- [ ] **KPI 정의** (현재 vs 목표 비교 표)
  - 전환율 (%)
  - CPA (고객획득비용)
  - LTV (생명주기가치)
  - Risk Score (위험도 0-100)
- [ ] **주간/월간 리포팅** 템플릿 자동 생성
- [ ] **자동 경고 시스템**
  - CPA 초과 → 자동 중단
  - 전환율 저하 → 자동 A/B테스트
  - Risk Flag 감지 → 자동 개입 알림

---

## 📋 Template 체크리스트 (구현 전 필수)

### T1: 판매/CRM 기능 (Menu #36-40)
```
✅ 심리학 10렌즈 최소 3개 이상 적용
✅ Day 0-3 SMS 자동화 시퀀스 설계
✅ Grant Cardone 반박법 또는 SPIN 질문 통합
✅ 성과 메트릭 자동 추적 대시보드 (현재 vs 목표)
✅ 세그먼트별 페르소나 매핑 (최소 3가지)
✅ 이의대응 시나리오 5가지 이상 준비
✅ CRM 자동분류 규칙 정의 (렌즈 감지)
✅ Risk Flag 10개 자동 생성
```

### T2: 마케팅/광고
```
✅ 채널별 최적화 설정 (Facebook/Instagram/Google/Naver/Blog)
✅ Russell Brunson 퍼널 6단계 (Hook→Story→Offer→Objection→Urgency→Close)
✅ PASONA 또는 SPIN 카피라이팅 통합
✅ CPC/CPA/ROAS 목표 설정
✅ A/B테스트 자동 실행 (최소 2가지 변형)
✅ 파트너별 세그먼트 분류
✅ 월별 KPI 추적 (도달/노출/클릭/전환)
```

### T3: 파트너 교육
```
✅ 세그먼트별 페르소나 3-5가지 정의
✅ 성공 템플릿 체크리스트 5-10개 항목
✅ 주간 성과 추적 (이메일/Slack 자동)
✅ 실패 패턴 조기 감지 (Risk Score)
✅ 자동 개입 프로세스 정의
✅ 월별 교육 자료 업데이트
```

### T4: SMS 자동화
```
✅ PASONA + SPIN 통합 메시지 구조
✅ Day 0-3 자동화 시퀀스 정의
✅ 심리학 트리거 최소 3개 (희소성/긴박감/손실회피)
✅ 세그먼트별 메시지 변형 5가지 이상
✅ A/B테스트 자동 실행 (메시지별)
✅ 응답율/전환율 실시간 추적
✅ 자동 재시도 로직 (실패 시 Day 7/14)
```

### T5: CRM 자동화
```
✅ 렌즈 감지 엔진 (L0-L10 자동 분류)
✅ Contact 필드 자동화 (태그/상태/D-day)
✅ Workflow 자동화 (Rule-based)
✅ Risk Flag 10개 자동 생성
✅ 자동 세그먼테이션 규칙 정의
✅ 다음 액션 자동 스케줄링
✅ 담당자 자동 할당 (Weighted Round-Robin)
```

### T6: 대시보드/KPI
```
✅ 현재 vs 목표 메트릭 비교 표
✅ 주간/월간 리포팅 템플릿
✅ 세그먼트별 성과 분해 (진로별 분석)
✅ Risk Score 대시보드 (0-100 점)
✅ 자동 경고 시스템 (CPA초과/전환율저하/Risk상승)
✅ A/B테스트 결과 자동 정렬 (승패 판정)
✅ 월 $XXXX 예상 효과 산출
```

### T7: CRM 자동화 고급 (Workflow + Risk Flag)
```
✅ Trigger Chain 3단계 (감지→분기→액션)
✅ Workflow 자동화 8가지 패턴 (신규/부재/이의/업셀/재구매/의료/가족/Risk)
✅ Risk Flag 10개 가중치 자동 계산
✅ Multi-step Workflow 에러 처리 (Fallback)
✅ 성과 메트릭 자동 추적 (자동화율/수동시간 단축)
✅ Workflow 분기별 이벤트 로깅 (감사추적)
✅ A/B 테스트 (Workflow 변형 2가지 이상)
```

### T8: Affiliate 시스템 구축
```
✅ Affiliate Type 4가지 정의 (직접/제휴사/인플루언서/플랫폼)
✅ Commission 구조 (15-25%) + 3단계 자동화 (기록→계산→정산)
✅ Revenue Tracking 6가지 메트릭 (소스별/파트너별/CPA/LTV/Retention)
✅ 파트너 Tier 시스템 4단계 (Tier별 보너스 차등)
✅ Affiliate Retention 추적 (목표 85%+)
✅ Churn 신호 감지 + 자동 개입 (Day 7/14/21/30)
✅ 세금 자동 계산 + 월별 정산서 자동 생성
```

### T9: SMS/Email 자동화 고급
```
✅ Dynamic Content 5가지 (이름/상품/금액/톤/시간) 개인화
✅ A/B 테스트 자동화 (주간 5가지 테스트 실행)
✅ 승리 기준 명확화 (오픈율/클릭율/전환율 임계값)
✅ Ebbinghaus 망각곡선 + Spaced Repetition 설계
✅ Day 0/1/3/7/14 시퀀스 자동 최적화
✅ 세그먼트별 언어톤 5가지 변형
✅ A/B 테스트 결과 자동 집계 + 승패 판정
```

### T10: 심리학 렌즈 CRM 통합
```
✅ 렌즈 감지 엔진 10가지 (L0-L10 자동 분류 규칙)
✅ 렌즈별 자동 Workflow 10가지 설계 + 트리거
✅ Auto-Segmentation (렌즈 × 인구통계 × 위험도)
✅ 렌즈별 기대 전환율 + LTV 정의 (L0: 35% → L10: 95%)
✅ Contact 자동 태그 생성 (Lens + Segment + SubSegment + Risk)
✅ 렌즈별 콜 스크립트 자동 제시
✅ 렌즈별 성과 대시보드 (전환율, LTV, 추이)
```

### T11: Analytics & Reporting 대시보드 (심화)
```
✅ 5계층 피라미드 대시보드 (Hero→렌즈→채널→위험도→BM)
✅ Hero KPI 실시간 업데이트 (5분 주기)
✅ 렌즈별 성과 분해 (L0-L10 전환율, LTV, 누적매출)
✅ 채널별 성과 Matrix (CPA vs ROAS 4사분면)
✅ 위험도 대시보드 (Risk Scoring 자동계산, GREEN/YELLOW/RED)
✅ 5가지 필터 기능 (시간/렌즈/채널/세그먼트/담당자)
✅ 주간/월간 리포트 자동생성 (금요일/월초)
```

### T12: Partner Success Program
```
✅ 4단계 라이프사이클 (Onboarding→Activation→Scaling→Retention)
✅ 파트너 페르소나 3가지 + 맞춤 경로 (도전형/신중형/기술형)
✅ Onboarding 자동화 (Day 1-14 이메일+비디오 시퀀스)
✅ 주간/월간 리포팅 자동생성 (성과 + 격려 + 권장사항)
✅ 자동화 체크리스트 4단계 (진행상황 추적)
✅ Churn 신호 감지 + 자동 개입 (Day 1/7/14/21/30)
✅ Commission 자동계산 + 월별 정산, Tier 시스템 자동관리
```

---

## 🔑 핵심 원칙 (필독)

### 1. 모든 기능에 심리학 기법 최소 1개 이상 적용
- Grant Cardone 10렌즈 중 선택 (손실회피, 희소성 등)
- PASONA 프레임워크 적용 (문제→자극→해결→오퍼→좁혀진범위→행동)
- SPIN 질문 기법 적용 (상황→문제→함의→필요/보상)

### 2. SMS 설계 시 Day 0-3 자동화 시퀀스 필수
- Day 0: P(Problem) + A(Agitate) 단계
- Day 1: S(Solution) 단계
- Day 2: O(Offer) + N(Narrow) 단계
- Day 3: A(Action) 단계
- Day 7+: Grant Cardone Follow-up (5-12회 접촉 80% 판매)

### 3. 성과 메트릭 자동 정의 (현재 vs 목표)
```
현재: [기존 전환율]% → 목표: [심리학 적용 후]%
CPA: [현재 비용] → [최적화 목표]
LTV: [현재 가치] → [재구매율 기반]
Risk Score: [조기신호] → [자동 개입]
```

### 4. 세그먼트별 페르소나 매핑 최소 3가지
- 신민형 전략: 욕망깨우기 → 프리미엄 → 비용해결 → 클로징
- 모니카 전략: 감정적 재연결 → 가치 재정의 → 이의 대응
- Russell Brunson: Hook → Story → Offer → Objection → Urgency → Close

### 5. 이의 대응 시나리오 5가지 이상
- 가격 (가치 재정의)
- 준비 (불안 해소)
- 기항지 (차별성 강조)
- 자유 (유연성 증명)
- 의료/능력 (권위성 + 신뢰)

### 6. CRM 자동분류 규칙 (렌즈 감지)
- L0: 부재중 3-6/6-12/1년+ 고객
- L1: 가격 이의 플래그 감지
- L2: 준비 복잡도 점수 (문의글 분석)
- L3: 경쟁사 언급 자동 감지
- L4-L10: 세그먼트별 추가 렌즈

---

## 📁 참고 파일 구조

```
D:\mabiz-crm\
├── CLAUDE.md (이 파일 - 에이전트 지시서, 2026-05-26 업데이트: T7-T12 추가)
├── AGENTS.md (Next.js 기본 규칙)
├── docs/
│   ├── CLAUDE_AGENT_PROMPTS.md (12가지 Template T1-T12, 2026-05-26 완성)
│   ├── CLAUDE_RAG_INDEX.md (195+ 메모리 파일 매핑)
│   └── CLAUDE_AGENT_USAGE_GUIDE.md (3가지 활용 방식)
├── src/app/(dashboard)/
│   └── [메뉴별 폴더]
└── [기타 구조]
```

---

## 🚀 에이전트 작업 시작 예시

### 예시 1: Menu #40 (수익 계산기) 개선
```
1. 작업 유형 확인: T1 (판매/CRM) + T4 (SMS 자동화)
2. Template 선택: CLAUDE_AGENT_PROMPTS.md - Template 1 + 4 복사
3. RAG 검색: [[l6_timing_loss_aversion]], [[grant_cardone_closing]], [[rental_sms_3day_sequence]]
4. 심리학 적용: L6 (타이밍 손실회피) + L10 (즉시 구매 클로징)
5. SMS 설계: PASONA 기반 Day 0-3 자동화
6. 성과 정의: 현재 전환율 → 목표 전환율 (% 증가율 계산)
7. CRM 규칙: 가격 민감도 플래그 자동 생성
```

### 예시 2: 마케팅 캠페인 (Facebook 광고)
```
1. 작업 유형 확인: T2 (마케팅)
2. Template 선택: CLAUDE_AGENT_PROMPTS.md - Template 2 복사
3. RAG 검색: [[sns_facebook_advertising]], [[pasona_framework_complete]], [[spin_selling_complete]]
4. 채널 최적화: CPC 20-30% ↓, 전환율 2-4% 목표
5. 카피 작성: FABE + 호기심 헤드라인 (40자 이내)
6. A/B테스트: 최소 2가지 변형 (카피/이미지/CTA)
7. KPI 추적: 도달/노출/클릭/전환 일일 리포팅
```

### 예시 3: Menu #42-45 (CRM 자동화 고급) - T7 적용
```
1. 작업 유형 확인: T7 (CRM 자동화 고급)
2. Template 선택: CLAUDE_AGENT_PROMPTS.md - Template 7 복사
3. 설계 항목: Trigger Chain 3단계 + 8가지 Workflow 패턴
4. Risk Flag: 10개 신호 + 가중치 계산
5. 성과 목표: 자동화율 30% → 80% (수동작업 40% 단축)
6. 주간 모니터: Workflow 실행 통계 + A/B 테스트 결과
```

### 예시 4: Menu #46-48 (Affiliate 시스템) - T8 적용
```
1. 작업 유형 확인: T8 (Affiliate 시스템)
2. Template 선택: CLAUDE_AGENT_PROMPTS.md - Template 8 복사
3. 설계 항목: 4가지 Affiliate Type + Commission 구조 (15-25%)
4. 자동화: 3단계 Commission 자동화 (기록→계산→정산)
5. 파트너 관리: Tier 시스템 + Churn 방지 (목표 85% 유지율)
6. KPI 추적: 소스별 매출 + 파트너별 성과 Ranking
```

### 예시 5: Menu #49-52 (심리학 렌즈 통합) - T10 적용
```
1. 작업 유형 확인: T10 (심리학 렌즈 CRM 통합)
2. Template 선택: CLAUDE_AGENT_PROMPTS.md - Template 10 복사
3. 렌즈 감지 엔진: 10가지 L0-L10 자동 분류 규칙
4. Auto-Segmentation: 렌즈 × 인구통계 × 위험도
5. Workflow: 렌즈별 10가지 자동 트리거
6. 성과 목표: 전환율 15% → 45% (+200% 증대), LTV 800K → 950K
```

---

## ✅ 배포 전 최종 체크리스트

모든 에이전트 작업은 **배포 전 이 체크리스트 완료 필수**:

- [ ] Template 체크리스트 모두 완료 (T1-T12 중 해당 템플릿)
- [ ] 심리학 10렌즈 최소 3개 이상 코드/설계에 반영
- [ ] Day 0-3 SMS 시퀀스 자동화 완료 (해당 시)
- [ ] 세그먼트별 페르소나 3가지 이상 정의
- [ ] 성과 메트릭 정의 (현재 vs 목표)
- [ ] CRM 자동분류 규칙 또는 태그 정의 (해당 시)
- [ ] Risk Flag 10개 자동 생성 (해당 시)
- [ ] 이의 대응 시나리오 5가지 이상 (해당 시)
- [ ] 코드 검토 완료 (10렌즈: 보안/성능/접근성/UX/확장성/에러/테스트/유지보수/호환성/비즈니스)
- [ ] 관련 메모리 파일 최소 3-5개 참고 확인

---

## 📞 문의 및 피드백

- **Template 변경**: 새로운 작업 유형 발견 시 CLAUDE_AGENT_PROMPTS.md 업데이트
- **메모리 추가**: 새 기능 완료 시 CLAUDE_RAG_INDEX.md에 링크 추가
- **심리학 검증**: 모든 기능 배포 전 심리학 기법 최소 3개 이상 확인

---

**마지막 업데이트**: 2026-05-26 | **버전**: 3.0 (T7-T12 추가 완성)

### 버전 히스토리
- v2.0 (2026-05-24): T1-T6 Template 6가지 완성
- v3.0 (2026-05-26): T7-T12 Template 6가지 추가 (CRM고급/Affiliate/SMS고급/렌즈통합/Analytics/Partner)
