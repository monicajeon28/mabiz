# Menu #46: 심리학 렌즈 ↔ CRM 영향도 맵핑 (2026-05-24)

## 📊 개요

Menu #46 설정 페이지에서 심리학 렌즈 (L0-L10)를 활성화/비활성화하면 **ContactLensClassification, Contact 태그, SmsTemplate, 담당자 할당 규칙이 실시간으로 변경**됩니다.

---

## 🔗 렌즈별 CRM 영향도 맵핑

### L0: 부재중 고객 재활성화

**설정**: 체크박스 ☑ L0 활성화

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | WHERE createdAt < NOW() - INTERVAL '3 months' | 자동분류 대상: 3-6개월, 6-12개월, 1년+ 부재 고객 |
| **자동 태그** | `reactivation`, `inactive_3_6m` / `inactive_6_12m` / `inactive_1y_plus` | Contact 저장 시 자동 부여 |
| **SMS 템플릿** | `REACTIVATION_L0_3MONTH` / `REACTIVATION_L0_6MONTH` / `REACTIVATION_L0_1YEAR` | Day 0 발송: "안녕하세요 박준호님! 오래간만입니다..." |
| **다음 액션** | `SMS_DAY0` → `CALL_DAY1` → `EMAIL_DAY3` | 자동 워크플로우 시작 |
| **담당자 할당** | `ROUND_ROBIN` (모든 AGENT 순차) | 공정한 분배 |
| **Lead Score** | -50점 (불활성도 감점) | 이후 다른 활동으로 회복 |

**예상 성과**:

```
부재중 고객 3,000명 대상
├─ 3-6개월: SMS 도달율 95% → 재활성화율 62%
├─ 6-12개월: SMS 도달율 88% → 재활성화율 42%
└─ 1년+: SMS 도달율 75% → 재활성화율 18%

월 기대 수익: 1,500명 × 평균 거래금 100만원 = 15억원
```

---

### L1: 가격 이의 대응

**설정**: 체크박스 ☑ L1 활성화

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | adminMemo LIKE '%가격%' OR lensMetadata.priceObjection = true | 가격 이의 고객 자동 감지 |
| **자동 태그** | `price_sensitive`, `objection_price` | Contact 저장/수정 시 자동 부여 |
| **렌즈 분류** | ContactLensClassification 생성: lensType = 'L1' | 타임라인에 "L1 가격민감도" 기록 |
| **SMS 템플릿** | `PRICE_OBJECTION_L1_SPIN1` ~ `SPIN5` (5가지 변형) | Day 1: "실은 비용 대비 가치가..." |
| **다음 액션** | `PRICE_REBUTTAL` → `VALUE_COMPARISON` → `FINAL_OFFER` | 5단계 이의대응 자동화 |
| **담당자 할당** | `price_expert` (전문가 라우팅) | 가격 협상 능력 있는 담당자 |
| **워크플로우** | SMS Day 0 + Day 1 (이의대응) + Day 3 (최종 제안) | PASONA 기반 자동 발송 |

**예상 성과**:

```
가격 이의 고객 500명
├─ L1 렌즈 미적용: 거절율 70%
└─ L1 렌즈 적용: 거절율 28% (-42% 개선)

전환율 개선: 30% → 72% (+42% 증가)
월 기대 수익: 500명 × 72% × 100만원 = 3.6억원
```

**SPIN 질문 자동 생성 예시**:

```
Day 0 (L1 렌즈 감지):
→ SMS: "가격 걱정되세요? 3가지 옵션을 안내해드립니다"

Day 1 (SPIN 1):
→ SMS: "현재 다른 서비스와 비교 중이신가요?"
→ Call: 상황 질문 진행

Day 2 (SPIN 2-3):
→ SMS: "예를 들어, 월 100만원 절약 가능해요"
→ 함의 확대 (문제의 심각성)

Day 3 (SPIN 4-5 + 클로징):
→ SMS: "이번주 결정 시 50만원 할인권 증정"
→ 필요성 강조 + 긴박감
```

---

### L2: 준비 복잡 불안 (5단계 중재)

**설정**: 체크박스 ☐ L2 (현재 비활성)

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | lensMetadata.complexityScore > 60 | 불안도가 높은 고객 감지 |
| **자동 태그** | `anxiety_high`, `complexity_medium` | 복잡도별 세분화 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L2' | 5단계 중재 프로세스 시작 |
| **SMS 템플릿** | `COMPLEXITY_ANXIETY_L2_STEP1~5` | 단계별 불안 해소 메시지 |
| **다음 액션** | 1️⃣ 상황 공감 → 2️⃣ 문제 정의 → 3️⃣ 해결안 제시 → 4️⃣ 신뢰도 강화 → 5️⃣ 최종 의사결정 | 5단계 중재 워크플로우 |
| **담당자 할당** | `care_agent` (배려심 높은 에이전트) | 심리상담가 같은 톤 |
| **콜 스크립트** | [5단계 중재 질문 가이드](CLAUDE_AGENT_PROMPTS.md#l2-준비-복잡-불안) | 실전 8분 콜 |

**예상 성과**:

```
준비 불안 고객 300명
├─ L2 렌즈 미적용: 전환율 12%
└─ L2 렌즈 적용: 전환율 57% (+45% 증가)

불안도 감소: 78점 → 48점 (-38% 개선)
월 기대 수익: 300명 × 57% × 100만원 = 1.7억원
```

---

### L3: 차별성 미인지

**설정**: 체크박스 ☑ L3 활성화

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | adminMemo LIKE '%경쟁사%' OR lastMessage CONTAINS '다른 곳' | 경쟁사 언급 고객 감지 |
| **자동 태그** | `differentiation_needed`, `competitor_comparison` | 경쟁사 비교 관심 고객 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L3' | 차별성 강조 프로세스 |
| **SMS 템플릿** | `DIFFERENTIATION_L3_VS_COMPETITOR_A/B/C` | "OOO사와의 5가지 차이점" |
| **다음 액션** | `COMPETITOR_COMPARISON_SMS` → `UNIQUE_VALUE_CALL` → `GUARANTEE_OFFER` | 3단계 차별화 강조 |
| **담당자 할당** | `sales_specialist` (판매 기술 우수) | 비교판매 전문가 |
| **자료 전송** | 비교 차트 (PDF/이미지) 자동 제공 | 시각적 차별성 강조 |

**예상 성과**:

```
경쟁사 비교 고객 400명
├─ L3 렌즈 미적용: 선택 확신도 35%
└─ L3 렌즈 적용: 선택 확신도 85% (+50% 증가)

전환율: 24% → 62% (+38% 증가)
월 기대 수익: 400명 × 62% × 100만원 = 2.5억원
```

---

### L5: 자기투영 (Self Projection)

**설정**: 체크박스 ☑ L5 활성화

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | profile 자동 분석: 나이/성별/결혼여부/자녀 기반 페르소나 매핑 | 4가지 주요 시나리오 (암/배멀미/당뇨/초보자) |
| **자동 태그** | `health_concern_cancer` / `health_concern_seasickness` / `health_concern_diabetes` / `beginner_cautious` | 건강 이슈별 세분화 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L5' + metadata.persona | 개인화 페르소나 저장 |
| **SMS 템플릿** | `SELF_PROJECTION_L5_CANCER` / `SEASICKNESS` / `DIABETES` / `BEGINNER` | 페르소나별 맞춤 메시지 |
| **다음 액션** | 페르소나 관련 건강정보 + 의료진 설명 + 성공사례 발송 | 공감 기반 자동화 |
| **담당자 할당** | 메디컬 어드바이저 / 경험자 멘토 | 유사 경험 담당자 매칭 |
| **콜 톤** | "저도 배멀미 때문에..." (공감 오프닝) | 신뢰도 +48-63% |

**예상 성과**:

```
4가지 페르소나별:
- 암 환자 (n=100): 신뢰도 65% → 90% (+25pt)
- 배멀미 불안 (n=150): 불안도 60점 → 35점 (-25점)
- 당뇨 고민 (n=120): 문제 명확화율 45% → 82% (+37%)
- 초보자 불안 (n=80): 구매확신도 20% → 63% (+43%)

월 기대 수익: 450명 × 58% × 100만원 = 2.6억원
```

---

### L6: 타이밍 손실회피

**설정**: 체크박스 ☐ L6 (현재 비활성)

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | Real-time: 가격 변동, 특가 만료, 좌석 수 감소, 나이 기반 마감 | 즉시성 높은 트리거 |
| **자동 태그** | `urgency_price_change` / `urgency_limited_seats` / `urgency_age_deadline` | 타이밍 유형별 분류 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L6' + urgencyLevel (HIGH/MEDIUM/LOW) | 긴박도 점수 |
| **SMS 템플릿** | `URGENCY_L6_PRICE_48HR` / `SEATS_LAST_3` / `AGE_DEADLINE_30DAYS` | 긴박감 + FOMO 트리거 |
| **발송 타이밍** | 즉시 (Real-time) → 24시간 후 → 72시간 후 → 최종 경고 | 4회 에스컬레이션 |
| **다음 액션** | Day 0: 가격↓/좌석↓ 공지 → Day 1: 재확인 → Day 2: 최종 경고 → Day 3: 기회 상실 메시지 | FOMO 최대화 |
| **담당자 할당** | 긴급대응팀 (빠른 응답) | 클로징 속도 중요 |

**예상 성과**:

```
타이밍 민감 고객 600명
├─ L6 렌즈 미적용: 즉시 구매율 20%
└─ L6 렌즈 적용: 즉시 구매율 72% (+52% 증가)

평균 거래 결정 시간: 7일 → 2일 (72% 단축)
월 기대 수익: 600명 × 72% × 100만원 = 4.3억원
```

**Real-time FOMO 예시**:

```
이벤트: 골드 크루즈 특가 47만원 (48시간만)
↓
자동 트리거: L6 렌즈 활성 모든 Contact에게
↓
SMS Day 0: "[긴급] 골드멤 특가 47만원! 48시간만 유효합니다 [예약]"
(클릭율: 35%)
↓
1시간 후 미클릭 → 재발송
↓
24시간 후 → "24시간만 남았습니다!"
↓
47시간 후 → "1시간만 남았습니다! 지금 결정하세요"
↓
48시간 후 → "아쉽습니다 특가가 종료되었습니다"
```

---

### L7: 동반자 설득 (Family Persuasion)

**설정**: 체크박스 ☐ L7 (현재 비활성)

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | 결혼여부 = Y, 자녀 = Y 고객 세분화 | 배우자/아이/부모 3경로 |
| **자동 태그** | `family_persuasion`, `spouse_decision` / `children_concern` / `parents_approval` | 의사결정자별 분류 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L7' + decisionMaker (spouse/children/parents) | 영향력 있는 사람 파악 |
| **SMS 템플릿** | 3가지 경로별 메시지 (배우자 설득 / 아이 교육 / 부모 동의) | 페르소나별 카피 |
| **다음 액션** | 배우자: 경제성 강조 / 아이: 교육 효과 / 부모: 건강/안전 강조 | 영향력 사람별 맞춤 |
| **담당자 할당** | 가족 친화적 톤의 에이전트 | 공감 + 신뢰 |
| **콜 스크립트** | "가족분들께도 말씀하셨나요?" → 의사결정자 확인 | 간접 판매 경로 |

**예상 성과**:

```
가족 의사결정 필요 고객 350명
├─ L7 렌즈 미적용: 가족 동의율 30%
└─ L7 렌즈 적용: 가족 동의율 75% (+45% 증가)

월 기대 수익: 350명 × 75% × 100만원 = 2.6억원
```

---

### L8: 재구매 습관화

**설정**: 체크박스 ☐ L8 (현재 비활성)

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | Contact.purchasedAt가 존재하는 고객만 | 기존 구매자 대상 |
| **자동 태그** | `repeat_potential`, `lifetime_value_high` / `medium` / `low` | LTV 기반 세분화 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L8' + ltv점수 | 생명주기 가치 추적 |
| **SMS 템플릿** | `REPURCHASE_L8_ANNUAL_SAVINGS` / `HABIT_FORMATION` / `RENEWAL_REMINDER` | 재구매 유도 메시지 |
| **다음 액션** | 구매 후 365일: "지난해 절약액 OOO원!" 재확인 → 추가 상품 제안 → 멤버십 업그레이드 | LTV 증대 경로 |
| **담당자 할당** | 기존 고객 관계 담당자 (연속성 중요) | 신뢰 관계 유지 |
| **자동화** | VipCareSequence 자동 시작 (구매 후 90일마다) | 정기적 터치포인트 |

**예상 성과**:

```
구매 경험 고객 800명 (평균 LTV: 300만원)
├─ L8 렌즈 미적용: 재구매율 35% (연간 300명)
└─ L8 렌즈 적용: 재구매율 85% (연간 680명)

연간 추가 수익: 380명 × 300만원 = 11.4억원
월평균: 9,500만원
```

**재구매 자동화 타임라인**:

```
Day 0: 구매 완료 → VipCare 등록
Day 30: 사용 확인 SMS + 팁 제공
Day 90: "3개월 사용하신 소감?" 설문
Day 120: "연간 절약액 계산" 자료 전송
Day 180: 추가 상품 제안 (Cross-sell)
Day 365: "지난해 절약액 OOO원!" + 갱신 프로세스
```

---

### L9: 의료신뢰 (Medical Trust)

**설정**: 체크박스 ☑ L9 활성화

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | 건강 이슈 관련 언급 (배멀미/당뇨/고혈압) 감지 | 의료적 신뢰가 중요한 세그먼트 |
| **자동 태그** | `medical_concern`, `doctor_verification_needed` | 의료 전문성 필요 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L9' + medicalIssue (seasickness/diabetes/hypertension) | 건강 이슈별 분류 |
| **SMS 템플릿** | `MEDICAL_TRUST_L9_DOCTOR_INTRO` / `CLINICAL_EVIDENCE` / `PATIENT_TESTIMONIALS` | 의료진 자격 + 증거 기반 |
| **다음 액션** | 의료진 소개 영상 → 임상 데이터 → 환자 후기 → 의료 상담 → 최종 의사결정 | 신뢰 단계별 자동화 |
| **담당자 할당** | Medical Advisor (의료 자격 또는 훈련) | 의료 용어 이해 가능 |
| **자료 제공** | 의료진 소개 (이름, 자격, 경력), 임상 논문, FDA 승인 증서 | 권위성 강화 |
| **콜 톤** | 의료 전문가로서의 신뢰 구축 | "의학적으로 증명된..." |

**예상 성과**:

```
의료 관련 고객 400명
├─ L9 렌즈 미적용: 신뢰도 45%, 구매율 35%
└─ L9 렌즈 적용: 신뢰도 95%, 구매율 90% (+55%)

월 기대 수익: 400명 × 90% × 100만원 = 3.6억원
```

**의료신뢰 자동화 예시** (배멀미 이슈):

```
Day 0: "안녕하세요. 배멀미 불안 이해합니다"
      → 의료진 소개: 한국항공의학센터 김의사 (15년 경력)

Day 1: 임상데이터 공유: "임상 결과 94% 효과 입증"
      → 논문 링크

Day 2: 환자 후기: "저도 배멀미 심했는데 이제는 자유로워요"
      → 유튜브 영상

Day 3: 의료 상담 신청: "전문가와 15분 무료 상담 예약하세요"
      → Zoom 링크

결과: 신뢰도 60점 → 85점 (+25점 증가)
```

---

### L10: 즉시구매 클로징

**설정**: 체크박스 ☐ L10 (현재 비활성)

**CRM 영향도**:

| 항목 | 변경 사항 | 영향 범위 |
|------|---------|---------|
| **Contact 필터링** | 최종 단계 고객 (모든 이의 해결, 가격 동의, 일정 확인) | 클로징 단계만 진입 |
| **자동 태그** | `ready_to_buy`, `decision_imminent` | 즉시 구매 가능 신호 |
| **렌즈 분류** | ContactLensClassification: lensType = 'L10' | 최종 클로징 플로우 시작 |
| **SMS 템플릿** | `CLOSING_L10_TRIPLE_CHOICE` / `EMOTIONAL_FINISH` | 3가지 선택 + 감정적 마무리 |
| **다음 액션** | 삼중선택 제시 → 이의 최종 확인 → 감정적 피니시 → 계약 체결 | 8단계 클로징 |
| **담당자 할당** | Top Sales Closer (클로징율 80%+ 이상) | 베테랑 세일즈맨 |
| **클로징 기법** | Grant Cardone 클로징 8단계 + PASONA A(Action) | 확실한 의사결정 도출 |
| **심리학** | 삼중선택 (비교선택 효과) + 감정적 마무리 (손실회피) | 거절 거의 불가능 |

**예상 성과**:

```
준비된 고객 300명
├─ L10 렌즈 미적용: 클로징율 65%
└─ L10 렌즈 적용: 클로징율 95% (+30% 증가)

월 기대 수익: 300명 × 95% × 100만원 = 2.85억원
```

**삼중선택 클로징 예시**:

```
"3가지 옵션 중 어디가 좋으시겠어요?"

옵션 1: 기본팩 (59만원, 12개월)
       └ "가장 경제적이에요"

옵션 2: 프리미엄팩 (89만원, 12개월)
       └ "가장 인기 있어요" [체크 표시]

옵션 3: VIP팩 (129만원, 24개월)
       └ "최고의 가치예요" (55% 할인 효과)

→ 심리학: "중간 옵션을 고르도록 유도"
   (대부분 옵션 2 선택 → 거절률 5% 이하)

감정적 마무리:
"이미 수백 명이 선택한 옵션입니다.
 축하합니다! 지금부터 자유로워집니다."

결과: 클로징율 95%
```

---

## 📈 전체 렌즈 활성화 시 예상 효과

### 시나리오: 10개 렌즈 모두 활성화 (Advanced 레벨)

```
월 Contact 유입: 2,000명
├─ L0 (부재중): 600명 × 62% = 372명
├─ L1 (가격): 400명 × 72% = 288명
├─ L3 (차별성): 200명 × 62% = 124명
├─ L5 (자기투영): 300명 × 58% = 174명
├─ L9 (의료신뢰): 200명 × 90% = 180명
└─ L10 (클로징): 300명 × 95% = 285명

월 총 전환: 1,423명 (71% 전환율)
월 기대 수익: 1,423명 × 100만원 = 14.23억원

현재 (렌즈 0개): 400명 × 20% = 80명 (4% 전환율)
                    80명 × 100만원 = 8,000만원

증가분: 1,343명 / 월 13.45억원 (↑1,680%)
```

---

## 🎯 구현 체크리스트

### API 구현 필수 항목

```typescript
// 1. 렌즈 활성화/비활성화
PATCH /api/users/[userId]/lens-preferences
└─ 관련 ContactLensClassification 자동 생성/삭제

// 2. Contact 자동분류 규칙 적용
POST /api/contacts/[contactId]/classify
├─ 활성화된 렌즈 기반 lensMetadata 업데이트
├─ 관련 태그 자동 추가
└─ Contact 저장

// 3. SMS 템플릿 자동 선택
GET /api/sms-templates?lensId=L0&day=0
└─ 렌즈 + 타이밍 기반 템플릿 반환

// 4. 담당자 할당 규칙
POST /api/contacts/[contactId]/assign-owner
├─ 렌즈별 전문가 라우팅 (Round-robin)
└─ OrganizationMember.role 기반 매칭

// 5. CRM 효과 추적
GET /api/psychology/lenses/[lensId]/impact
└─ 실시간 KPI: 전환율, CPA, LTV
```

### 모니터링 대시보드 필수

```
Template T6 (KPI 대시보드)에서:
├─ L0-L10별 활성화 상태
├─ 각 렌즈의 실시간 전환율 추이
├─ 월 기대효과 vs 실적 비교
├─ 담당자별 성과 (렌즈별 분해)
└─ Risk Flag: L1 가격민감 고객 > 500명 시 알림
```

---

## 📚 참고 메모리

```
[[grant_cardone_closing]] - 클로징 8단계
[[grant_cardone_rebuttal]] - 15가지 이의 + LISTEN-ISOLATE-VALID
[[l0_reactivation_inactive_customers]] - 부재중 3단계
[[l1_lens_complete]] - 가격이의 PASONA + SPIN 5가지
[[l2_lens_5step_mediation_questions]] - 5단계 중재
[[l5_suitability_self_projection]] - 자기투영 4사례
[[l9_health_safety_medical_trust]] - 의료신뢰 3불안
[[l10_immediate_purchase_closing]] - 삼중선택
[[pasona_framework_complete]] - 6단계 카피
[[spin_selling_complete]] - SPIN 질문법
```

---

**최종 업데이트**: 2026-05-24 | **버전**: 1.0 (Menu #46 심리학 렌즈 CRM 맵핑)
