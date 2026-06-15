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

---

## ⚡ 병렬 서브에이전트 워크플로우 (v4.0 핵심 규칙)

### 왜 병렬 에이전트가 필요한가?
- `npm run build`는 dev 서버 실행 중 실행하면 EBUSY 파일 잠금 오류 발생
- 에이전트가 같은 파일을 동시에 수정하면 Git 충돌 발생
- **해결책**: 도메인별 파일 소유권을 명확히 분리하고, 빌드 대신 TSC만 사용

---

### 도메인 격리 테이블 (에이전트별 파일 소유권)

| 도메인 | 에이전트 코드 | 전담 경로 | 공유 금지 |
|--------|------------|---------|---------|
| **CRM/Contacts** | Agent-CRM | `src/app/(dashboard)/contacts/` `src/app/api/contacts/` | prisma/schema.prisma |
| **Marketing/Campaigns** | Agent-MKT | `src/app/(dashboard)/marketing/` `src/app/(dashboard)/campaigns/` `src/app/api/campaigns/` | prisma/schema.prisma |
| **SMS/Messages** | Agent-SMS | `src/app/(dashboard)/messages/` `src/app/(dashboard)/sms-logs/` `src/app/api/messages/` `src/app/api/cron/` | prisma/schema.prisma |
| **Affiliate/Partner** | Agent-AFF | `src/app/(dashboard)/partner*/` `src/app/(dashboard)/commission-ledger/` `src/app/api/affiliate*/` | prisma/schema.prisma |
| **Admin/Analytics** | Agent-ADM | `src/app/(dashboard)/admin/` `src/app/(dashboard)/dashboard/` `src/app/api/admin/` | prisma/schema.prisma |
| **Webhooks** | Agent-WHK | `src/app/api/webhooks/` `src/app/api/payapp/` | prisma/schema.prisma |
| **Settings/Auth** | Agent-SET | `src/app/(dashboard)/settings/` `src/app/api/auth/` | prisma/schema.prisma |
| **Lib/Utils** | Agent-LIB | `src/lib/` | 다른 에이전트와 동시 수정 금지 |
| **Prisma/DB** | (순차 전용) | `prisma/` | **병렬 절대 금지** |

> **규칙**: 각 에이전트는 자기 도메인 파일만 수정. `src/lib/` 수정 필요시 순차 실행.

---

### 빌드 검증 전략 (EBUSY 완전 방지)

```powershell
# ✅ 올바른 방법: TSC만 실행 (dev 서버 실행 중에도 안전)
npx tsc --noEmit

# ✅ Prisma 타입만 재생성 (dev 서버 실행 중에도 안전)
npx prisma generate

# ❌ 절대 금지: dev 서버 실행 중 전체 빌드
npm run build   # EBUSY 오류 → 사용 금지

# ✅ 풀 빌드가 꼭 필요하면: dev 서버 먼저 종료
# Ctrl+C로 dev 서버 종료 → npm run build
```

---

### 병렬 에이전트 실행 프로토콜

```
Phase 1: 분석 (1개 에이전트, 순차)
  └─ 작업 분해 → 도메인별 서브태스크 목록 생성

Phase 2: 병렬 구현 (도메인별 독립 에이전트 동시 실행)
  ├─ Agent-CRM  → contacts 도메인 파일만 수정
  ├─ Agent-MKT  → campaigns 도메인 파일만 수정
  ├─ Agent-SMS  → messages/cron 도메인 파일만 수정
  └─ Agent-AFF  → affiliate 도메인 파일만 수정

Phase 3: 검증 (1개 에이전트, 순차)
  └─ npx tsc --noEmit → 에러 0개 확인 → git commit
```

---

### 에이전트 프롬프트 필수 헤더

모든 서브에이전트 프롬프트 시작에 아래 헤더 포함 필수:

```
[도메인: Agent-CRM | 전담 경로: src/app/(dashboard)/contacts/, src/app/api/contacts/]
[금지: prisma/schema.prisma 수정, 다른 도메인 파일 수정]
[검증: npx tsc --noEmit (npm run build 절대 사용 금지)]
```

---

### Workflow 스크립트 위치

병렬 에이전트 실행을 위한 Workflow 스크립트:
- `scripts/parallel-agents.js` — 도메인별 병렬 에이전트 실행 템플릿
- 호출: `/workflow scripts/parallel-agents.js`

---

---

## 🎨 Steve Jobs: 50대 친화적 UI/UX 설계 (2026-06-15)

### 핵심 원칙: "초등학생도 쓸 수 있을 정도로"

모든 UI는 **단순함(Simplicity) + 명확성(Clarity) + 일관성(Consistency)** 기준으로 설계. 특히 50대 사용자 기준 (동공축소 → 글자 크기 증가, 손가락 굵음 → 버튼 확대).

---

### 📐 타이포그래피 규칙

| 역할 | 크기 | 사용처 | 색상 |
|------|------|--------|------|
| **제목** | 20px | 섹션 헤드라인, 모달 제목 | #1A1A1A (진검정) |
| **본문** | 16px+ | 모든 읽을 거리 (최소값) | #333333 (검정) |
| **설명** | 14px | 도움말, 보조 텍스트 | #666666 (진회색) |
| **라벨** | 14px | 폼 필드 레이블, 버튼 텍스트 | #1A1A1A (진검정) |

✅ **규칙**:
- 본문 14px 미만 금지 (50대 가독성 저하)
- 제목 16px 이상 (한눈에 인식)
- 대비도 4.5:1 이상 (WCAG AA)

---

### 🖱️ 버튼 & 터치 규칙

| 속성 | 값 | 설명 |
|------|-----|------|
| **최소 크기** | 48px × 48px | 성인 손가락폭 8-10mm |
| **패딩** | 12px (상하좌우) | 텍스트 주변 공간 |
| **외부 간격** | 16px (최소) | 버튼 간 거리 |
| **호버 피드백** | 색상 변경 + 언더라인 | 즉각적 반응 필수 |
| **포커스 표시** | 2px 테두리 | 키보드 네비게이션 표시 |

✅ **규칙**:
```
❌ 작은 버튼 (40px 미만)
✅ 큰 버튼 (48px 이상)

❌ 버튼 겹침 (8px)
✅ 버튼 간격 (16px 이상)

❌ 로딩 후 반응 (3초+)
✅ 즉시 반응 (0.2초 이내)
```

---

### 🎨 색상 체계 (심리학 렌즈별)

각 렌즈(L0-L10)는 고유 색상 + 연관 배경색으로 일관성 유지:

| 렌즈 | 이름 | 주색 | 배경색 | 사용처 |
|------|------|------|--------|--------|
| **L0** | 부재중 고객 | #9B59B6 (보라) | #F3E5F5 (연보라) | 재활성화 CTA |
| **L1** | 가격 이의 | #FFD700 (황금) | #FFFACD (연황색) | 할부제안 카드 |
| **L3** | 경쟁사 비교 | #4A90E2 (파란) | #EBF4FF (연파랑) | 비교표 섹션 |
| **L6** | 타이밍/손실 | #E74C3C (빨강) | #FADBD8 (연분홍) | 긴박감 배너 |
| **L10** | 즉시 구매 | #27AE60 (초록) | #D5F4E6 (연초록) | 체크아웃 CTA |

✅ **규칙**:
- 렌즈별 색상 일관성 (혼동 방지)
- 배경색은 주색 + 15% 투명도
- 다크모드: 주색 -20% 명도, 배경 +10% 명도

---

### 📏 간격 (Spacing) 규칙

```
┌──────────────────────────────────┐
│ 섹션 (24px 상단/하단 마진)       │
├──────────────────────────────────┤
│                                  │
│  카드 1                          │  ← 요소 간격 16px (내부)
│  ┌──────────────────────────────┐│
│  │ 패딩 16px (모든 방향)        ││
│  │                            ││
│  │ 텍스트 라인 높이: 1.6      ││
│  │ 문단 간 16px              ││
│  └──────────────────────────────┘│
│                                  │
│  카드 2 ← 24px 간격              │  ← 섹션 간격 24px (외부)
│  ┌──────────────────────────────┐│
│  │ 패딩 16px                    ││
│  └──────────────────────────────┘│
│                                  │
└──────────────────────────────────┘
```

✅ **규칙**:
- 한 화면 최대 정보: 4개 섹션 (혼동 방지)
- 섹션 간: 24px (화면 호흡)
- 요소 간: 16px (그룹화)
- 라인 높이: 1.6 (읽기 편함)

---

### 🎯 레이아웃 패턴 (50대 기준)

#### 패턴 1: 선택형 카드 (L1-L10 설정 화면)

```
┌─────────────────────────────────────┐
│ 💰 "가격이 비싼 고객"              │
│ (제목 20px, 아이콘 + 한글)         │
│                                     │
│ 이런 고객에게 자동으로 메시지?     │ ← 설명 16px (명확)
│                                     │
│ ☐ 안함    ⭕ 응! 해줘            │ ← 라디오 버튼 (48px)
│                                     │
│ 어떤 메시지?  [▼ 선택하기]         │ ← 드롭다운 (48px 높이)
│              ↳ 인기: 할부제안      │
│                                     │
│ 📱 실제로 이렇게 보내요: (미리보기)│
│ ┌─────────────────────────────────┐│
│ │ Day 1 (내일)                   ││
│ │ "좋은 소식입니다!"              ││
│ │ 월 60만원씩 5개월 할부 가능     ││
│ │ [자세히 보기]                  ││
│ └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

**체크리스트:**
- [ ] 제목 20px (아이콘 포함)
- [ ] 설명 16px (명확한 한글)
- [ ] 라디오/체크박스 48px × 48px
- [ ] 드롭다운 높이 48px 이상
- [ ] 미리보기 즉시 반영 (0ms)
- [ ] 섹션 간 24px 여백

#### 패턴 2: 폼 필드 (Contact 생성/수정)

```
┌─────────────────────────────────────┐
│ 이름                                │ ← 라벨 14px
│ [                              ]   │ ← 입력창 48px 높이
│ 예: 김철수                         │ ← 도움말 14px, 회색
│                                     │
│ 전화번호                            │
│ [010-1234-5678                 ]   │ ← 마스킹 자동 (국가코드)
│ 📍 위치 자동감지 ✅               │ ← 상태 표시 14px
│                                     │
│ [확인 (48px)]  [취소]             │ ← 기본 48px, 보조 40px
│                                     │
└─────────────────────────────────────┘
```

**체크리스트:**
- [ ] 입력창 높이 48px 이상
- [ ] 라벨 14px, 진검정
- [ ] 도움말 14px, 회색
- [ ] 입력 후 상태 표시 (로딩/성공/오류)
- [ ] 자동완성 지원 (이전 입력값)
- [ ] 엔터 키 제출 가능

#### 패턴 3: 테이블/비교표 (비교견적서)

```
┌──────────────────────────────────────┐
│ 상품 비교 (테이블 헤더 16px)       │
├──────────────────────────────────────┤
│ 항목       │ 우리     │ Royal       │
├──────────────────────────────────────┤
│ 가격       │ $250K   │ $320K      │
│ 위치       │ 아시아  │ 유럽       │
│ 포함       │ 와인✅   │ 없음       │
│ 한국어     │ 있음✅   │ 없음       │
├──────────────────────────────────────┤
│ [전체 비교표 다운로드 (48px)]       │
└──────────────────────────────────────┘
```

**체크리스트:**
- [ ] 헤더 행 16px, 진검정, 배경 연회색
- [ ] 데이터 행 14px, 검정
- [ ] 체크 아이콘 (✅/❌) 명확
- [ ] 행 높이 40px 이상
- [ ] 열 너비 유연 (모바일 스크롤)
- [ ] CTA 버튼 48px × 48px

---

### 📱 모바일 규칙 (반응형)

| 화면 | 이름 | 너비 | 여백 | 폰트 |
|------|------|------|------|------|
| **Mobile** | 스마트폰 | <640px | 12px | 본문 16px |
| **Tablet** | 태블릿 | 640px-1024px | 16px | 본문 16px |
| **Desktop** | 데스크톱 | >1024px | 24px | 본문 16px |

✅ **규칙**:
- 모든 버튼 최소 48px (모든 화면)
- 폰트 최소 16px (모든 화면)
- 모바일 세로: 1칼럼
- 태블릿/데스크톱: 2-3칼럼
- Safe Area 존중 (iPhone)

---

### ✨ 미리보기 & 피드백

#### 미리보기 규칙 (실시간 반영)

```javascript
// ❌ 나쁜 예시
선택 → 500ms 로딩 → 미리보기 표시

// ✅ 좋은 예시
선택 → 즉시 미리보기 표시 (0ms)
(백그라운드에서 데이터 로딩)
```

**체크리스트:**
- [ ] 미리보기 즉시 반영 (0.2초 이내)
- [ ] 딜레이가 있으면 로딩 스피너 표시
- [ ] 폰 모양으로 렌더링 (리얼함)
- [ ] 실제 발송 시간 표시 ("Day 1 (내일)")
- [ ] 메시지 전체 내용 보임 (스크롤 필요시)

---

### 🎯 배포 전 체크리스트 (Steve 기준)

```
✅ 타이포그래피
  - [ ] 제목 20px 이상
  - [ ] 본문 16px 이상
  - [ ] 모든 텍스트 명확한 한글
  - [ ] 색상 대비 4.5:1 이상

✅ 버튼 & 터치
  - [ ] 모든 버튼 48px × 48px
  - [ ] 버튼 간격 16px 이상
  - [ ] 호버/포커스 피드백 명확
  - [ ] 키보드 네비게이션 가능

✅ 색상 & 대비
  - [ ] 배경과 텍스트 구분 명확
  - [ ] 렌즈별 색상 일관성
  - [ ] 다크모드 호환성

✅ 구조 & 배치
  - [ ] 한 화면 4개 섹션 이하
  - [ ] 섹션 간 24px 여백
  - [ ] 요소 간 16px 여백
  - [ ] 라인 높이 1.6 (16px × 1.6 = 25.6px)

✅ 언어 & 설명
  - [ ] 기술용어 0개 (100% 한글)
  - [ ] 각 섹션에 도움말 있음
  - [ ] 아이콘 + 한글 이름 병기
  - [ ] "?" 버튼 (옵션)

✅ 미리보기 & 피드백
  - [ ] 선택 후 즉시 반영 (0.2초)
  - [ ] 폰 모양으로 표시
  - [ ] 실제 메시지 전체 보임
  - [ ] 발송 시간 명시 ("Day 1 내일")

✅ 반응형 (모바일)
  - [ ] 모든 화면에서 48px 버튼
  - [ ] 모든 화면에서 16px 본문
  - [ ] 모바일 세로 모드 1칼럼
  - [ ] Safe Area 존중
```

---

### 💡 Steve의 최종 원칙

**"Simplicity is the ultimate sophistication"**

1. **버튼은 크게** (48px) → 딸깍하기 쉬움
2. **글자는 크게** (16px 이상) → 읽기 편함
3. **색상은 명확하게** (렌즈별 고유색) → 혼동 없음
4. **설명은 쉽게** (기술용어 제거) → 초등학생도 이해
5. **피드백은 빠르게** (0.2초 이내) → 신뢰감 상승
6. **한눈에 보기** (4개 이하) → 정보 과부하 방지

---

**마지막 업데이트**: 2026-06-15 | **버전**: 5.0 (Steve Jobs UI/UX 가이드 추가)

### 버전 히스토리
- v2.0 (2026-05-24): T1-T6 Template 6가지 완성
- v3.0 (2026-05-26): T7-T12 Template 6가지 추가 (CRM고급/Affiliate/SMS고급/렌즈통합/Analytics/Partner)
- v4.0 (2026-05-30): 병렬 서브에이전트 워크플로우 + 도메인 격리 + EBUSY 방지 규칙 추가
- v5.0 (2026-06-15): Steve Jobs 50대 친화적 UI/UX 설계 가이드 추가
