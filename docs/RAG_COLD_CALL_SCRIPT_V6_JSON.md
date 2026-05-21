# Cold Call Script V6 - RAG JSON Library

이 문서는 V6 콜 스크립트를 RAG(Retrieval-Augmented Generation) 형식으로 저장합니다.
CRM의 playbook-viewer에서 실시간 검색, 학습, 대화 보조에 활용됩니다.

---

## 📚 RAG Library (JSONL Format - 정확한 제품 구조)

**상품명**: 크루즈닷 골드멤버십
**가격**: 월 27,000원 × 100개월 = 2,700만원 납입
**의미**: 330만원 크루즈를 100회 준비하는 것
**활성화**: 100개월 뒤부터 5년간 골드 회원 혜택
**혜택**: 10~30% 할인 + 단체 업그레이드 (세미→풀 무료) + 스탭 동행
**ROI**: 1,800만원 이상 혜택 (5년 내 회수 가능)



```json
{
  "id": "v6-step1-opening",
  "category": "opening",
  "step": 1,
  "time_budget": "2분",
  "purpose": "신뢰 구축 + 욕망 재연결",
  "psychology": "Dopamine ↑ (0°C → 35°C)",
  "key_phrases": ["당신을 기다렸어요", "욕망 재연결", "정상화"],
  "full_script": {
    "phase_1": {
      "role": "상담사",
      "tone": "따뜻, 판매 냄새 없음",
      "text": "안녕하세요, 김OO님! 저는 크루즈닷 여행상담팀 000이라고 합니다. 저 지금 장기 부재중이신 회원분들에게 꼭 필요한 소식 전해드리고 있거든요. 2분만 시간 주실 수 있을까요?",
      "silence": "1초",
      "notes": "신뢰 신호 침투. 판매 냄새 제거."
    },
    "phase_2": {
      "role": "상담사",
      "text": "OO님, 저희가 지난 OO월에 당신을 처음 뵈었을 때, 어디 가고 싶으셨어요? 그때 어떤 마음이 있으셨나요?",
      "customer_response": "[여행지] + [활동]",
      "follow_up": "아, [여행지]로요. 거기서 [고객이 언급한 활동] 하면서 평생 못 잊을 기억들 만들고 싶으셨군요. 그런 꿈 아직도 있으세요?",
      "silence": "2초",
      "psychology": "욕망 재활성화 (Nostalgia)"
    },
    "phase_3": {
      "role": "상담사",
      "text": "근데 질문 하나 할게요. 지난 1년 동안 왜 못 가셨어요? 실제로 뭐가 제일 막혔어요?",
      "options": ["준비가 복잡해서", "비용이 걱정되서", "타이밍/시간이 없어서"],
      "customer_selects": "1개 선택",
      "normalization": "[고객 답변] 이군요. 사실 우리 재신청 고객들 중 80% 정도가 그 이유때문에 1년을 미루고 있어요. 당신만 그런 게 아니라는 뜻이죠.",
      "psychology": "정상화 + 공감 = 신뢰도 급상승"
    }
  },
  "expected_outcome": "콜드가 따뜻으로 변함 + 고객이 문제를 자기검증",
  "common_objections": [],
  "success_metrics": ["고객이 욕망을 언어화", "침묵에서 공감 표현"]
}
```

```json
{
  "id": "v6-step2-comparison",
  "category": "value_setting",
  "step": 2,
  "time_budget": "3분",
  "purpose": "비교 기준 선점 + 가격 합리화",
  "psychology": "Dopamine 유지 (35°C → 50°C)",
  "key_phrases": ["호텔 vs 크루즈", "실제 비용", "경험 가치"],
  "core_message": {
    "general_travel": "항공(120만) + 호텔(120만) + 가이드(50만) + 보험(30만) = 320만원",
    "cruise_travel": "배 위 리조트(250-280만) = 이동 없음 + 가이드 딸려옴 + 식사 24시간",
    "comparison": "호텔 5박 = 크루즈 5박 (가격 비슷, 경험 비교 불가)"
  },
  "script_sections": [
    {
      "title": "숨은 비용 5가지 노출",
      "text": "당신이 혼자 준비한다면: 홈페이지 검색(30분) + 호텔 비교(1시간) + 비자/예방접종(1시간) + 가이드 구하기(2시간) + 여행보험(30분) = 5시간 + 스트레스"
    },
    {
      "title": "가격 재설정",
      "text": "일반: 320만원, 크루즈: 250-280만원. 호텔 5박 = 크루즈 5박이면, 크루즈가 더 싸네?"
    },
    {
      "title": "경험 가치 강조",
      "text": "호텔은 같은 장소에서 5일, 크루즈는 5일에 5개국. 경험 가치, 비교 불가능하죠?"
    }
  ],
  "expected_outcome": "신뢰도 크게 상승 + 다음 단계로의 자연스러운 Bridge"
}
```

```json
{
  "id": "v6-step3-loss-aversion",
  "category": "fear_amplification",
  "step": 3,
  "time_budget": "5분",
  "purpose": "손실 이미지 + 3중 희소성 폭발",
  "psychology": "Cortisol ↑↑↑ + Amygdala 활성화 (50°C → 75°C)",
  "key_phrases": ["시간의 창", "가격 손실", "반복 패턴", "무기력감"],
  "three_dimensional_loss": {
    "dimension_1": {
      "title": "시간의 창 (파충류 뇌)",
      "script": "당신이 지금 언젠가 하다가 5년이 지나면 어떻게 될까요? 더 건강할까요, 더 피곤할까요? 배우자는? 아이는? 당신의 아이가 [나이]살이면 5년 뒤는 [나이+5]살이죠.",
      "silence": "3-5초",
      "neurochemistry": "구체 나이 제시 = 현실감"
    },
    "dimension_2": {
      "title": "가격 손실 극대화",
      "script": "지금: 월 33K × 60개월 = 198만원. 5년 뒤: 월 45K × 60개월 = 270만원. 72만원을 손으로 날리는 거랑 같아요.",
      "additional_losses": ["가족 여행 5번 못 감 (1,000만원)", "건강 나빠지는 시간", "아이와의 추억"],
      "silence": "5초"
    },
    "dimension_3": {
      "title": "반복 패턴 자각",
      "script": "지난해: 올해는 꼭 가자. 근데 지금도 못 가있죠? 작년도 똑같이 될 가능성 있지 않을까요?",
      "psychology": "무기력감 (자기검증)",
      "silence": "5초"
    }
  },
  "expected_outcome": "고객이 스스로 '뭔가 바뀌어야 한다' 인정"
}
```

```json
{
  "id": "v6-step4-value-reveal",
  "category": "solution_reveal",
  "step": 4,
  "time_budget": "3분",
  "purpose": "월 27,000원 = 8,000만원 가치 재설정 (할인율 95%)",
  "psychology": "Dopamine+Oxytocin ↑↑ (75°C → 90°C)",
  "core_value_proposition": {
    "price": "월 27,000원 (또는 일시불 330만원)",
    "what_it_means": "게이트웨이 (평생 이용권)",
    "total_value": "8,000만원 (크루즈 평생 + 렌탈 200회 + 헬스케어 + 선장특전)",
    "lifetime_horizon": "평생 (횟수 제한 없음)",
    "discount_rate": "95.3%"
  },
  "script_breakdown": [
    {
      "phase": "상황 반전",
      "script": "그래서 우리가 완전히 다른 방법을 준비했어요. 당신이 지금 이 순간 결정하면 이 모든 게 해결돼요.",
      "silence": "1초 + 2초"
    },
    {
      "phase": "월 33K의 진정한 의미",
      "script": "3년에 3회 다니면: 일반(320만 × 3 = 960만) vs 우리(월33K × 36개월 + 할인 = 280만) = 680만원 절감",
      "reframing": "월 33K는 비용이 아니라 절감액이에요"
    },
    {
      "phase": "100회 + 200회 회전력",
      "script": "당신이 평생 다니면: 크루즈 100회 + 렌탈 200회 = 300회 여행 기회. 한 번에 100,000원꼴.",
      "psychology": "평생 기회 강조"
    },
    {
      "phase": "사회적 증명",
      "script": "지난해 12명 → 올해 29명 → 이달 43명. 이 분들은 '다시는 해지 안 하겠다'고 해요. 왜냐하면 한 번 경험하니까 평생 쓸 수 있다는 걸 알거든요.",
      "silence": "2초"
    },
    {
      "phase": "시간 희소성",
      "script": "우리가 월별로 인원 제한을 해요. 이달 남은 자리가 5개예요. 7월까지만 이 가격. 8월부터는 45,000원.",
      "silence": "3초",
      "psychology": "2중 희소성 (자리 + 가격)"
    }
  ],
  "expected_outcome": "고객이 '어? 이게 진짜 좋은데?' 깨닫기 시작"
}
```

```json
{
  "id": "v6-step5-closing",
  "category": "closing",
  "step": 5,
  "time_budget": "1분",
  "purpose": "삼중선택 + 자발적 행동 유도",
  "psychology": "Oxytocin+Adrenaline ↑↑↑ (90°C → 100°C)",
  "key_technique": "삼중선택 (거부 옵션 강제 제거)",
  "three_options": [
    {
      "method": 1,
      "name": "지금 바로",
      "details": ["120만원 우리 지원", "69만원만 내고", "7월에 바로 떠나기"],
      "appeal": "최고의 빠른 해결책"
    },
    {
      "method": 2,
      "name": "월 33K 장기",
      "details": ["당신의 리듬대로", "언제든 크루즈 + 렌탈", "평생 30-40% 할인"],
      "appeal": "자유롭고 유연함"
    },
    {
      "method": 3,
      "name": "일주일 생각",
      "details": ["대화 내용 저장", "나중에 연락주기"],
      "consequence": "(이 경우 가격은 올라가요 = FOMO)",
      "appeal": "생각해볼 시간"
    }
  ],
  "closing_script": {
    "question": "당신 입장에서 어느 쪽이 더 맞아요?",
    "silence": "5초",
    "confirmation": "좋은 결정이에요. 당신은 이제 배 위의 리조트에서 평생 추억들을 만들 수 있어요.",
    "action": "카톡으로 신청 링크 보내드릴게요. 5분이면 끝나요."
  },
  "expected_outcome": "자발적 신청 + momentum 유지"
}
```

```json
{
  "id": "v6-objection-handling",
  "category": "objection_responses",
  "total_count": 20,
  "by_type": [
    {
      "objection": "비싼데요",
      "psychology": "손실회피심리 (이득의 2배 고통)",
      "response": "당신이 1번만 가면 비싸죠. 근데 3년에 3번 다닌다면? 월 33K의 할인만으로도 680만원을 절감해요. 투자가 아니라 절감이에요. 그리고 만약 못 간다면? 월 33K만 내고 끝나는 거죠. 리스크가 없어요.",
      "expected_response_rate": "65-75%"
    },
    {
      "objection": "생각해볼게요",
      "psychology": "의사결정 회피 (시간 벌기)",
      "response": "네, 충분히 생각해보세요. 근데 한 가지만 말씀드릴게요. 이 가격과 자리는 7월까지만이에요. 내일 생각하기로 미루면 이미 8월이 가까워져 있거든요. 지금이 당신이 시간을 생각할 수 있는 마지막 기간이에요. 지금 신청만 해두고 나중에 생각해도 돼요.",
      "conversion_trick": "신청 먼저 (마찰 최소화)"
    },
    {
      "objection": "배우자와 상담해야 해요",
      "psychology": "의사결정 권위 분산 (책임 회피)",
      "response": "당신의 결정이 가장 중요해요. 보통 한 분이 먼저 이게 평생 다닐 수 있다고 깨닫으면 나머지 분도 자연스레 따라와요. 당신의 목소리가 가장 설득력 있거든요. 일단 신청하고 금요일 라이브에서 두 분이 함께 모든 질문 다 물어봐도 돼요.",
      "note": "주도권 탈취 (배우자 설득은 나중에)"
    }
  ]
}
```

---

## 🔍 RAG 검색 예시

### 고객이 "비싼데요"라고 하면
```
검색: "expensive" OR "비싼" OR "high price"
→ v6-objection-handling.objection="비싼데요"
→ 응답 생성: "3년에 3번 다니면 680만원 절감..."
```

### 고객이 "가족과 생각하고 싶다"
```
검색: "family" OR "배우자" OR "상담"
→ v6-objection-handling.objection="배우자와 상담"
→ 응답 생성: "당신의 결정이 가장 중요..."
```

### STEP 3에서 손실 강조하고 싶을 때
```
검색: "loss" OR "5년 뒤" OR "손실"
→ v6-step3-loss-aversion.dimensions
→ 스크립트 인출: 3중 손실 모두 제시
```

---

## 📊 RAG 활용 시나리오

### 1️⃣ CRM 콜센터 실시간 보조
상담사가 고객 응답 입력 → RAG 검색 → 맞춤 응답 제시

### 2️⃣ 신입 상담사 훈련
STEP별 스크립트 + 심리학 + 이의대응 한번에 습득

### 3️⃣ 성과 분석
고객 이의별 성공률 추적 → 약한 부분 보강

### 4️⃣ 자동화 답변 생성
playbook-viewer에서 "비싼데" 입력 → 자동으로 20개 응답 중 최상 1개 선택

---

**이 RAG는 V6 스크립트의 모든 정보를 구조화하여, 실시간 검색, 학습, 최적화에 활용됩니다.**
