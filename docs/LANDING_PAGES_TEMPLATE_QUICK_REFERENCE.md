# Landing Pages 템플릿 빠른 참조 (2026-06-15)

## 📌 10가지 템플릿 요약표

| 번호 | 템플릿 ID | 템플릿명 | 기본 필드 | 주요 CTA | 심리학 렌즈 | SMS 프레임워크 | 기대 전환율 | LTV |
|------|----------|---------|----------|---------|----------|----------|---------|-----|
| 1 | GENERAL_FORM | 일반 폼 | name, phone, email, destination, month | "상품문의", "예약하기" | L3, L6 | PASONA | 25% | 800K |
| 2 | VIP_FORM | VIP 폼 | name, phone, email, occupation, income | "VIP상담", "프리미엄패키지" | L10, L7 | GRANT_CARDONE | 60% | 1.5M |
| 3 | SURVEY_FORM | 설문폼 | 선호도(radio), 예산(select) | "결과보기", "상담신청" | L1, L5 | SPIN | 35% | 950K |
| 4 | EVENT_FORM | 이벤트폼 | name, phone, event_type | "참가등록", "초대권신청" | L6, L8 | PASONA | 45% | 700K |
| 5 | BOOKING_FORM | 예약폼 | name, phone, date, destination | "예약확정", "자세히보기" | L2, L3 | PASONA | 55% | 1.1M |
| 6 | INQUIRY_FORM | 문의폼 | name, phone, inquiry_type | "문의전송", "콜백신청" | L0, L1 | SPIN | 30% | 750K |
| 7 | NEWSLETTER_FORM | 뉴스레터 | name, email, interest_type | "구독", "추천받기" | L8, L5 | PASONA | 20% | 500K |
| 8 | QUIZ_FORM | 퀴즈폼 | quiz_answers (dynamic) | "결과보기", "컨설팅받기" | L10, L3 | GRANT_CARDONE | 50% | 1.2M |
| 9 | REFERRAL_FORM | 추천폼 | name, phone, referee_name | "추천등록", "보상신청" | L7, L8 | PASONA | 40% | 900K |
| 10 | REVIEW_FORM | 리뷰폼 | name, rating, review_text | "리뷰완료", "특전신청" | L8, L9 | PASONA | 35% | 850K |

---

## 🎯 렌즈별 전환율 기대치

```
L0 (부재중/재활성)      → 15% (전 고객 재참여)
L1 (가격이의)           → 25% (할인 효과)
L2 (준비불안)          → 35% (가이드 제공)
L3 (차별성미인지)       → 30% (경쟁사 비교)
L4 (멤버십저항)         → 28% (유연성 강조)
L5 (적합성의문)         → 32% (커스터마이즈)
L6 (시간감/긴박감)      → 40% (희소성+시간제한)
L7 (동반자설득)         → 45% (사회증명)
L8 (재구매고객)         → 50% (로열티 특전)
L9 (의료/안전)          → 38% (신뢰감 강조)
L10 (즉시구매)          → 65% (권위성 + 클로징)
```

---

## 🔄 SMS Day 0-3 템플릿 매핑

### PASONA 프레임워크 (일반/이벤트/뉴스레터/추천/리뷰)
```
Day 0: [문제] + [자극]           "지금이 기회다" (5분)
       L1(가격), L6(시간)
       
Day 1: [해결책]                  "우리가 도와드립니다" (24시간)
       L2(준비), L5(적합)
       
Day 2: [오퍼] + [범위축소]       "이 조건, 이 시간뿐" (48시간)
       L6(희소), L8(신뢰)
       
Day 3: [행동]                    "지금 결정하세요" (72시간)
       L6(긴박), L10(클로징)
```

### GRANT_CARDONE 클로징 (VIP/퀴즈)
```
Day 0: Assumptive Close (당연한 것처럼)
       "이 패키지를 위해 당신을 위해 준비했습니다"
       L10(권위), L8(신뢰)
       
Day 1: Social Proof Close (사회증명)
       "지난주 3명의 VIP가 이미 예약했습니다"
       L8(신뢰), L7(동반)
       
Day 2: Scarcity Close (희소성)
       "남은 자리는 2석뿐입니다"
       L6(시간), L10(긴박)
       
Day 3: Loss Aversion Close (손실회피)
       "지금 예약하지 않으면 다음달이 됩니다"
       L6(긴박), L1(손실)
```

### SPIN 프레임워크 (설문/문의)
```
Day 0: [상황질문]                "당신의 상황을 파악하고 싶습니다"
       L1(예산), L2(준비)
       
Day 1: [문제질문]                "어떤 문제를 겪고 계신가요?"
       L0(재활성), L2(불안)
       
Day 2: [함의질문]                "이 문제를 해결하면 어떻게 될까요?"
       L3(차별), L5(적합)
       
Day 3: [필요보상질문]            "필요한 해결책이 있다면?"
       L1(가격), L7(동반)
```

---

## 📊 메트릭 수집 포인트

### 자동 수집 필드
```
✓ 폼 제출 시간 (formFilledTimeMs)
✓ 제출자 전화번호 (중복 제거)
✓ CTA ID (어떤 버튼 클릭)
✓ 자동 태그 적용 (몇 개)
✓ 렌즈 감지 결과 (L0-L10)
✓ Lead Score 증가분
✓ SMS 발송 (Day 0-3)
✓ SMS 클릭/전환 (Event tracking)
✓ Contact 전환 여부
✓ 최종 구매 여부 (Webhook)
```

### 대시보드 주요 KPI
```
Hero 지표 (상단):
  • 폼 제출 → 전환율 (목표 대비)
  • CPA (목표 대비)
  • LTV (목표 대비)
  • Risk Score (0-100, 색상)

렌즈별 분해:
  • L0-L10 각각의 전환율 / LTV

채널별 성과:
  • CPA vs ROAS (4사분면)

위험도 대시보드:
  • GREEN / YELLOW / RED 비율

필터링:
  • 기간, 렌즈, 페이지, 담당자
```

---

## 🎬 CTA 실행 워크플로우

```
사용자 제출 → executeCTA()
  ├─ [1] CTA 설정 로드
  │    └─ tagRules.autoTag (자동 태그)
  │    └─ tagRules.groupId (그룹 배정)
  │    └─ smsConfig (SMS 설정)
  │
  ├─ [2] Contact 조회/생성
  │    └─ CREATE: name, phone, email, leadScore
  │
  ├─ [3] 자동 태그 적용
  │    └─ contact.tags += ["크루즈관심", ...]
  │
  ├─ [4] 그룹 자동 배정
  │    └─ ContactGroupMember 생성
  │
  ├─ [5] SMS 시퀀스 스케줄
  │    └─ Day 0: +5분
  │    └─ Day 1: +24시간
  │    └─ Day 2: +48시간
  │    └─ Day 3: +72시간
  │
  ├─ [6] 렌즈 감지 + 자동분류
  │    └─ detectLensFromFormResponse()
  │    └─ ContactLensClassification 생성
  │
  ├─ [7] Lead Score 계산
  │    └─ +10 (폼제출) + 필드수*5 + 템플릿보너스
  │
  └─ [8] Contact 최종 업데이트
       └─ tags, leadScore, sourceType, sourceId
```

---

## 💡 심리학 렌즈 빠른 선택 가이드

### 사용자 특성에 따른 렌즈 매핑

```
"이전에 쇼핑한 적이 있지만 오래됐다"
→ L0 (부재중/재활성)
   ∘ 태그: ["재활성고객"]
   ∘ 전략: 감정적 재연결 + SPIN 질문
   ∘ 예상 전환: 15%

"가격이 비싼데요?"
→ L1 (가격이의)
   ∘ 태그: ["가격민감", "할인선호"]
   ∘ 전략: 가치 재정의 + 할인/번들 오퍼
   ∘ 예상 전환: 25%

"준비가 복잡할 것 같은데 어떻게 해야 하나요?"
→ L2 (준비불안)
   ∘ 태그: ["준비불안", "가이드필요"]
   ∘ 전략: 5단계 중재 질문 + 체크리스트
   ∘ 예상 전환: 35%

"다른 회사는 뭐가 다른가요?"
→ L3 (차별성미인지)
   ∘ 태그: ["차별성강조", "경쟁사비교"]
   ∘ 전략: 경쟁사 비교표 + 배타적 특전
   ∘ 예상 전환: 30%

"지금 예약 안 해도 나중에 할 수 있지 않나요?"
→ L6 (시간감/긴박감)
   ∘ 태그: ["시간제한", "성수기", "마감임박"]
   ∘ 전략: 남은 시간 표시 + 가격 인상 일정
   ∘ 예상 전환: 40%

"혼자인데 괜찮을까요? 가족이 반대해요."
→ L7 (동반자설득)
   ∘ 태그: ["동반자설득", "가족설득"]
   ∘ 전략: 가족 함께 경험 강조 + 사회증명
   ∘ 예상 전환: 45%

"저는 매년 크루즈를 타는데 뭐가 특별한가요?"
→ L8 (재구매고객)
   ∘ 태그: ["재구매고객", "VIP", "로열티"]
   ∘ 전략: VIP 특전 + 업그레이드 자동 제공
   ∘ 예상 전환: 50%

"건강상 어떤 문제가 없을까봐 걱정돼요."
→ L9 (의료/안전)
   ∘ 태그: ["의료안전중심", "신뢰감필요"]
   ∘ 전략: 의료 전문가 자격 표시 + 사례
   ∘ 예상 전환: 38%

"지금 최고예산인데 최고 경험을 받고 싶어요."
→ L10 (즉시구매)
   ∘ 태그: ["즉시구매대상", "VIP", "의사결정권자"]
   ∘ 전략: Grant Cardone 10 클로징 + 가정적 마감
   ∘ 예상 전환: 65%
```

---

## 🚀 구현 체크리스트

### Phase 1: 템플릿 정의
- [ ] 10가지 FormTemplate 객체 생성
- [ ] 각 템플릿별 fields[] 정의
- [ ] 각 템플릿별 ctas[] 정의
- [ ] benchmarks 값 설정
- [ ] DB 마이그레이션 (formTemplateId)

### Phase 2: CTA 엔진
- [ ] getCTAConfig() 함수
- [ ] applyTagsToContact() 구현
- [ ] assignContactToGroup() 구현
- [ ] calculateLeadScoreIncrement() 구현
- [ ] executeCTA() 통합

### Phase 3: SMS 자동화
- [ ] SMS 시퀀스 템플릿 정의 (PASONA, GRANT_CARDONE, SPIN)
- [ ] scheduleSmsSequence() 구현
- [ ] Cron 작업 (Day 0-3 자동 발송)
- [ ] SMS 클릭/전환 Event tracking

### Phase 4: 렌즈 감지
- [ ] LENS_DETECTION_RULES 정의
- [ ] matchSignal() 함수
- [ ] detectLensFromFormResponse() 구현
- [ ] getLensGroupMapping() 함수
- [ ] getFollowUpStrategy() 함수
- [ ] ContactLensClassification 자동 생성

### Phase 5: 메트릭 추적
- [ ] collectFormMetrics() 구현
- [ ] smsMetrics 수집 (Day 0-3)
- [ ] conversionMetrics 계산
- [ ] costMetrics 계산
- [ ] ltv 계산
- [ ] riskMetrics 계산

### Phase 6: 대시보드
- [ ] /metrics/page.tsx 구성
- [ ] Hero KPI 섹션
- [ ] 렌즈별 분해 차트
- [ ] 채널별 CPA vs ROAS
- [ ] Risk 대시보드
- [ ] 필터링 UI

### Phase 7: 테스트 & 배포
- [ ] 단위 테스트 (각 함수)
- [ ] 통합 테스트 (폼 제출 → 메트릭)
- [ ] E2E 테스트 (Playwright)
- [ ] 성과 검증
- [ ] Vercel 배포

---

## 📞 참고 자료

**CLAUDE.md**:
- T1: 판매/CRM 기능
- T4: SMS 자동화
- T5: CRM 자동화
- T10: 심리학 렌즈 통합

**메모리 파일**:
- [[grant_cardone_closing]]
- [[pasona_framework_complete]]
- [[spin_selling_complete]]
- [[lens_detection_engine]]
- [[rental_sms_3day_sequence]]

**문서**:
- LANDING_PAGES_BLOCK_SYSTEM_AUTOMATION.md
- LANDING_PAGES_BLOCK_IMPLEMENTATION_GUIDE.md

