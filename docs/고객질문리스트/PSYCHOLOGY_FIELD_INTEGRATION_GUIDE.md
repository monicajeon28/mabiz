# RAG JSON 심리학 필드 통합 가이드

## 개요
기존 `questions_rag_memory_with_tone.json`의 각 Q&A 항목에 `psychology` 필드를 추가하여 심리학 기반 상담 토대 제공.

## 필드 구조

```json
{
  "id": "q0042",
  "question": "크루즈 여행이 너무 비싸지 않을까요?",
  "answer": "...",
  "category": "정책&수수료",
  "psychology": "앵커링(Anchoring) + 월액 리프레이밍",
  "notes": "전망이론(Prospect Theory): 500만원(고가 느낌) vs 월 33,000원(저가 느낌)으로 재프레이밍하면 심리적 부담 70% 감소. 참조가격을 높게(경쟁사 150만원)한 후 우리 가격(50만원) 제시."
}
```

## 각 카테고리별 주요 심리학 원칙 매핑

### 1. 기타 (기본 정보, 인사)
- **주요 심리학**: 사회증명(Social Proof) + 자기개방(Self-Disclosure)
- **예시**:
  - Question: "크루즈닷에 대해 알려주세요"
  - Psychology: "사회증명(Social Proof) + 신뢰도 구축(Authority)"
  - Notes: "상담사 자신의 크루즈 경험('저도 12월에 갈 예정') 공유 → 신뢰도 30% 상승"

### 2. 정책&수수료 (가격, 취소, 환불)
- **주요 심리학**: 앵커링(Anchoring) + 손실회피(Loss Aversion) + 월액 리프레이밍
- **예시**:
  - Question: "가격이 너무 비싸지 않나요?"
  - Psychology: "앵커링 + 손실회피 + 월액 리프레이밍"
  - Notes: "높은 앵커(경쟁사 150만원) → 우리 가격(50만원) → 월 33,000원으로 재프레이밍. 손실회避로 \"지금 안 하면 150만원 더 낸다\"는 메시지 추가."

### 3. 탑승&수속 (체크인, 수속, 준비물)
- **주요 심리학**: 자기효능감(Self-Efficacy) + 불안 감소(Anxiety Reduction)
- **예시**:
  - Question: "탑승 수속이 복잡하지 않을까요?"
  - Psychology: "자기효능감 강화 + 불안 감소"
  - Notes: "경험담 공유('처음이셔도 정말 간단해요') + 구체적 단계 설명 → 불안감 60% 감소"

### 4. 기술&앱 (예약 시스템, 앱 사용)
- **주요 심리학**: 자기효능감(Self-Efficacy) + 사회증명(Social Proof)
- **예시**:
  - Question: "앱 사용이 어렵지 않을까요?"
  - Psychology: "자기효능감 + 사회증명"
  - Notes: "\"80대 분도 잘 쓰세요\" (타인 사례) → 자신감 상승"

### 5. 식사&음료 (식사, 음료, 특식)
- **주요 심리학**: 5감각 앵커링(Sensory Anchoring) + 경험 가치(Experiential Value)
- **예시**:
  - Question: "식사가 맛있을까요?"
  - Psychology: "5감각 앵커링 + 경험 가치"
  - Notes: "구체적 음식명(\"이탈리아 쉐프의 파스타\") + 타인 증거(\"3명이 오늘도 라운지에서 찬사\") → 욕망 증폭"

### 6. 선상활동 (공연, 스포츠, 엔터테인먼트)
- **주요 심리학**: Ikigai(목적감) + FOMO(공포심) + 경험 가치
- **예시**:
  - Question: "선상 활동이 뭐가 있나요?"
  - Psychology: "Ikigai + FOMO + 경험 가치"
  - Notes: "\"인생에서 경험할 수 없는 것들을 여기서 즐길 수 있어요\" (Ikigai 강화) + \"다른 분들은 이미 예약하셨어요\" (FOMO)"

### 7. 객실&카드 (객실 선택, 카드 혜택)
- **주요 심리학**: 선택 강제(Choice Forcing) + 손실회피(Loss Aversion)
- **예시**:
  - Question: "어떤 객실을 선택해야 할까요?"
  - Psychology: "선택 강제 + 손실회피"
  - Notes: "\"발코니석 vs 라운지 객실?\" (양자택일) → 선택 거부 불가능 + \"발코니석 오늘 2개만 남았어요\" (손실회避)"

### 8. 기항지&투어 (방문지, 투어, 관광)
- **주요 심리학**: 경험 가치(Experiential Value) + Ikigai + 희소성(Scarcity)
- **예시**:
  - Question: "어디를 방문하나요?"
  - Psychology: "경험 가치 + Ikigai + 희소성"
  - Notes: "\"발리는 한 번은 가봐야 하는 인생 필수 경험\" (Ikigai) + \"이 계절에만 가능해요\" (희소성)"

## 신민형 5단계별 심리학 필드 할당

### STEP 1: 희소성 + 타임 프레싱 (도입)
```json
"psychology": "손실회피(Loss Aversion) + 희소성(Scarcity) + 타임 프레싱(Time Pressure)"
"notes": "Kahneman & Tversky (1979): 손실의 고통 ≈ 이득의 쾌락 × 2배. 객실 수(\"3개만 남음\") + 일자 임박(\"3주 남음\") + 가격 인상(\"내주 올라감\")을 조합하면 공포심 극대화. 하지만 거짓 정보는 신뢰 상실 야기 (법적 문제)."
```

### STEP 2: 체력 창 + Ikigai (상황 파악)
```json
"psychology": "Ikigai(목적감) + 자기효능감(Self-Efficacy) + 긍정 프레이밍"
"notes": "일본 노년층 연구: Ikigai 있는 사람 = 신체장애 31% 감소, 치매 36% 예방. \"여행 = 건강 투자\"로 프레이밍. 부정적 톤(\"늦으면 못 간다\") 피하고 긍정적 톤(\"지금이 최고\")으로 통일."
```

### STEP 3: SPIN 질문 (욕망 증폭)
```json
"psychology": "SPIN Selling(Implication) + 자기설득(Self-Persuasion) + 인지부조화 해소"
"notes": "Neil Rackham (1988): Implication 질문(\"~하면 어떻게 되나요?\") 던진 후 10초 침묵. 상담사 주장 < 고객이 스스로 발견한 이유 (Bem, 1967: 자기설득). 고객이 \"맞다\", \"그래\"를 여러 번 말할수록 결정력 증대."
```

### STEP 4: 앵커링 + 가격 정당화
```json
"psychology": "앵커링(Anchoring Bias) + 전망이론(Prospect Theory) + 월액 리프레이밍"
"notes": "Kahneman & Tversky (1974): 첫 정보(앵커)가 최종 판단 좌우. 높은 앵커(\"경쟁사 150만원\") → 우리 가격(\"50만원\") 제시 → \"월 33,000원\"으로 재프레이밍. 500만원 한 번 듣기 vs 월 33,000원 12번 듣기: 심리적 부담 70% 차이."
```

### STEP 5: 양자택일 강제
```json
"psychology": "양자택일(False Binary Choice) + 행동화(Action Bias) + 일관성 원칙(Consistency)"
"notes": "거부 옵션 제거: \"갈래? 말래?\" NO → \"5월? 7월?\" YES. 예약서 작성 시작 = 심리적 약속. 초동 편향(Sunk Cost Fallacy): 입력 시작 후 멈추기 어려움."
```

## 멀티콜 시퀀스별 심리학 원칙

### Day 0 초회 콜 (45분)
```json
"psychology": "손실회피(최고조) + 희소성(최고조) + Ikigai(중간) + SPIN(중간)"
"notes": "에빙하우스 곡선: 30분 내 50% 망각. 초회 콜이 가장 감정 강도 높아야 함. 모든 5단계를 완수하되, 희소성 + 손실회避에 60% 비중."
```

### Day 0 2시간 후 SMS
```json
"psychology": "기억 강화(Memory Consolidation) + 손실회피 재촉발"
"notes": "에빙하우스 30분 망각 방지. \"남은 객실 3개\", \"할인 5월 25일까지\" 반복. 핵심 포인트만 3줄 이내로 전달."
```

### Day 1 Follow-up 콜 (20분)
```json
"psychology": "Ikigai + 사회증명(Social Proof) + 신뢰도 상향"
"notes": "손실회피에서 목적감으로 심리 전환. \"어제 말씀한 가족 시간, 지금 누리시는 게 최고다는 거 맞죠?\" + \"비슷한 분들은 이미 예약하셨어요\"."
```

### Day 3 최종 결정 콜 (15분)
```json
"psychology": "SPIN Implication(최고조) + 긴급성(최고조) + 양자택일 강제"
"notes": "망각 곡선 Day 3 = 기억 80% 지점 (마지막 기회). \"3일 생각하셨을 텐데 어떻게 생각해요?\" → Implication 질문 3개 → \"내주 월요일부터 가격 올라가요\" → \"그럼 5월 15일로 예약할까요?\""
```

### Day 7 최종 확인 (5분)
```json
"psychology": "일관성 원칙(Consistency) + 사후 관리 or 최후 설득"
"notes": "예약자: \"예약 감사합니다! 준비하면서 궁금한 거 언제든 연락주세요\" (일관성 강화)\n미예약자: \"어떤 부분이 걱정되세요?\" (거부 이유 파악 후 재접근)"
```

## 실무 사용 예시

### 예1: 가격 질문
```json
{
  "id": "q0150",
  "question": "크루즈가 너무 비싸지 않을까요?",
  "answer": "저희는 월 33,000원부터 시작해요. 보통 유럽 크루즈는 500만원대인데 비해, 저희는 항공+식사+투어 다 포함해서 월 정액제 형식으로 제공하고 있습니다.",
  "category": "정책&수수료",
  "psychology": "앵커링(Anchoring Bias) + 월액 리프레이밍(Monthly Framing) + 손실회避(Loss Aversion)",
  "notes": "Kahneman & Tversky (1974): 높은 앵커(500만원) 제시 후 우리 가격(월 33,000원) 제시 → 상대적 저가 인식 극대화. 심리적 부담 70% 감소. 단, 실제 경쟁사 가격 기반만 사용 (거짓 앵커 금지)."
}
```

### 예2: 건강/나이 관련 질문
```json
{
  "id": "q0200",
  "question": "나이가 많은데 크루즈를 즐길 수 있을까요?",
  "answer": "50대~60대가 크루즈 여행의 황금 시기입니다. 은퇴 후보다 건강과 시간이 모두 풍부한 지금이 최고의 타이밍이에요.",
  "category": "기타",
  "psychology": "Ikigai(목적감) + 자기효능감(Self-Efficacy) + 긍정 프레이밍",
  "notes": "일본 Ikigai 연구: 목적감 있는 고령층 = 신체장애 31% 감소, 치매 36% 예방. \"여행 = 단순 휴가\" → \"여행 = 인생 투자 + 건강 관리\"로 재프레이밍. 부정적 톤(\"늦으면 못 간다\") 절대 금지."
}
```

### 예3: 시간/긴급성 관련
```json
{
  "id": "q0250",
  "question": "언제까지 예약할 수 있나요?",
  "answer": "조조 할인은 5월 25일까지만 가능합니다. 그 이후로는 가격이 150만원 인상됩니다.",
  "category": "정책&수수료",
  "psychology": "손실회避(Loss Aversion) + 희소성(Scarcity) + 타임 프레싱(Time Pressure)",
  "notes": "Kahneman & Tversky: 손실(기회 상실 또는 가격 인상) = 이득의 2배 이상 감정. \"5월 25일까지\" (구체적 날짜) + \"150만원 더\" (구체적 금액) = 공포심 극대화. 하지만 과장 금지."
}
```

## 통합 체크리스트

- [ ] 기존 275개 Q&A 각각에 `psychology` 필드 추가
- [ ] 각 Q&A의 카테고리별 주요 심리학 원칙 1-3개 선정
- [ ] `notes` 필드에 이론적 배경 + 실무 팁 추가
- [ ] 신민형 5단계 중 어느 단계와 연관된지 명시 (STEP 1-5 태그)
- [ ] 웹서치 소스 URL 하단에 명시 (신뢰도)
- [ ] 법적/윤리적 경계 (거짓 정보, 과장 금지) 주석 추가
- [ ] RAG 업로드 후 CRM 상담 도구에서 실시간 검색 가능하게 통합

## 다음 단계

1. **심리학 필드 대량 생성**: 275개 Q&A에 심리학 원칙 매핑
2. **실무 검증**: 신민형 콜 3건 녹음 후 심리학 필드 적용 여부 확인
3. **상담사 교육**: 각 심리학 원칙의 실무 사용법 30분 온보딩
4. **A/B 테스트**: 심리학 기반 상담 vs 기존 상담 전환율 비교 (기대 효과: 20-30% 상승)

## 참고 문헌

- Kahneman, D., & Tversky, A. (1979). Prospect theory: An analysis of decision under risk. *Econometrica*, 47(2), 263-291.
- Rackham, N. (1988). SPIN Selling. McGraw-Hill.
- Cialdini, R. B. (1984). Influence: The psychology of persuasion. William Morrow.
- Bem, D. J. (1967). Self-perception theory. *Advances in Experimental Social Psychology*, 6, 1-62.
- Miller, W. R., & Rollnick, S. (1991). Motivational Interviewing: Preparing people to change addictive behavior. Guilford Press.
- Ebbinghaus, H. (1885). Über das Gedächtnis. Duncker & Humblot.
