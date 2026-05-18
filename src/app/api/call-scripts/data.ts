// Mock data for call scripts
// In production, these would be loaded from the database

export const CALL_SCRIPTS_DATA: Record<string, any> = {
  healthcare: {
    "신혼부부 (30-35세)": {
      1: {
        id: "healthcare_newlyweds_1",
        category: "healthcare",
        segment: "신혼부부 (30-35세)",
        phase: "1",
        phaseName: "인사 + 신뢰감",
        estimatedTime: "0-2분",
        content: `"안녕하세요! 크루즈 건강관리팀의 모니카입니다.

저희가 지난 3년간 500명 이상의 고객분들을
도와드렸고, 특히 모니카님 연령대의 분들이
가장 만족해하는 프로그램이 있어서
말씀드렸습니다.

편하신 시간에 5분만 들어주시겠어요?"`,
        psychologyPrinciples: ["Social Proof", "Authority", "Segmentation"],
        pasonaPhase: "Problem",
        tips: [
          "전문성을 신뢰할 수 있도록 구체적 성과 제시",
          "연령대 언급으로 자신감 형성",
          "5분이라는 짧은 시간 제시로 거절감 감소",
        ],
      },
      2: {
        id: "healthcare_newlyweds_2",
        category: "healthcare",
        segment: "신혼부부 (30-35세)",
        phase: "2",
        phaseName: "욕구 발굴",
        estimatedTime: "2-5분",
        content: `"요즘 건강 관리하시면서
가장 힘든 부분이 뭔가요?

예를 들면:
- 피로감이 자꾸 생긴다던지
- 뭘 먹어야 할지 모른다던지
- 어떻게 관리해야 하는지 막연하다던지..."

[고객 답변 경청 - 최소 30초]

"그렇군요. 정확히 그런 분들이 많아요."

---

"그렇다면 만약 지금부터
건강관리를 제대로 한다면,

3년 뒤 어떤 모습이 되고 싶으세요?

예를 들면:
- 에너지가 넘쳐나고
- 의사 갈 일이 거의 없고
- 자신감 있게 일상을 즐기는 그런 느낌?"

[고객 답변 경청 - 최소 40초]

"정말 좋은 모습이네요.
저희가 정확히 그 방향으로 함께 가는 거예요."`,
        psychologyPrinciples: ["Pain Point Articulation", "Future Visioning", "Active Listening"],
        pasonaPhase: "Agitation",
        tips: [
          "통증점을 구체적으로 이끌어내기",
          "30초 이상 경청하여 신뢰도 증대",
          "미래 상태를 구체적으로 시각화",
        ],
      },
      3: {
        id: "healthcare_newlyweds_3",
        category: "healthcare",
        segment: "신혼부부 (30-35세)",
        phase: "3",
        phaseName: "패키지 설명",
        estimatedTime: "5-10분",
        content: `"그럼 저희 건강관리 패키지는 정말 간단해요.
3단계예요:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1) 초기 건강검진
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
처음에 한 번 검진합니다.
혈액검사, 체성분, 생활 습관 등.
저희가 모두 준비해드려요.
모니카님은 와서 10분만 받으면 돼요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2) 맞춤 관리 계획
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
검진 결과 바탕으로 전문가가
개인별 계획을 만들어드려요.
- 뭘 먹으면 좋을지
- 어떤 운동이 좋을지
- 언제 약을 먹을지

이것도 상담으로 25분이면 끝.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3) 월 1회 진행상황 체크
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
매달 한 번 온라인으로
진행상황을 체크하고 계획을 보완해요.
15분 정도 소요됩니다.

기본 비용:
- 초기 검진: 12만원
- 맞춤 계획: 8만원
- 월 관리비: 5만원"`,
        psychologyPrinciples: ["Simplicity", "Chunking", "Specificity"],
        pasonaPhase: "Solution",
        tips: [
          "3단계로 극단적으로 단순화",
          "시간을 명확히 제시하여 불안감 제거",
          "가격을 단계별로 명확히 제시",
        ],
      },
      4: {
        id: "healthcare_newlyweds_4",
        category: "healthcare",
        segment: "신혼부부 (30-35세)",
        phase: "4",
        phaseName: "가격 + 기대감",
        estimatedTime: "10-13분",
        content: `"가격은 좀 비싸 보일 수 있지만,
생각을 바꿔보세요.

월 5만원이라는 건:
- 커피 한잔 가격보다 적어요 ☕
- 헬스장 한 달보다 싸요 💪
- 약국 처방약 한번 비용도 안 돼요 💊

그런데 이것만으로 끝나는 게 아니라,

3개월 뒤:
"어? 뭔가 에너지가 생겼네?"

6개월 뒤:
"어제 의사 갈 일이 없었어?"

1년 뒤:
"완전히 달라졌어! 동료들에게 자랑했어"

이런 변화를 경험하는 거고,

더 중요한 건, 지금부터 관리하면
앞으로 10년, 20년을 건강하게 살 수 있다는 거예요.

그 가치를 생각하면,
월 5만원은 정말 저렴한 투자 같지 않나요?

그리고 지금 신청하시면,
🎁 첫 달은 상담료를 50% 할인해드리는 중이에요.

"`,
        psychologyPrinciples: ["Relativity", "Time Perspective", "Loss Aversion"],
        pasonaPhase: "Narrowing",
        tips: [
          "가격을 일상적인 것과 비교하여 상대적 가치 강조",
          "시간 경과에 따른 변화 구체적 제시",
          "현재의 기회를 놓치면 손실된다는 심리 활용",
        ],
      },
      5: {
        id: "healthcare_newlyweds_5",
        category: "healthcare",
        segment: "신혼부부 (30-35세)",
        phase: "5",
        phaseName: "클로징",
        estimatedTime: "13-15분",
        content: `"그럼 일단 첫 번째 스텝으로,
검진 일정을 잡아볼까요?

[고객 일정 확인]

"자, 그럼 2월 15일 목요일
오후 2시로 잡겠습니다.

혹시 취소할 일이 있으면
3일 전에라도 톡으로 연락 주시면 돼요.

검진받으실 때:
- 신분증 꼭 가져오세요
- 2시간 전부터 식사 안 하셔야 해요
- 편한 복장 오세요

그럼 다음 주 금요일에 뵐게요!
건강 함께 만들어가요! 💪"`,
        psychologyPrinciples: ["Commitment", "Specificity", "Clarity"],
        pasonaPhase: "Action",
        tips: [
          "구체적인 일시를 제시하여 약속 확정",
          "실행 전 주의사항을 명확히 전달",
          "긍정적이고 따뜻한 톤으로 마무리",
        ],
      },
    },
    "자녀있는가정 (40-50세)": {
      1: {
        id: "healthcare_family_1",
        category: "healthcare",
        segment: "자녀있는가정 (40-50세)",
        phase: "1",
        phaseName: "인사 + 신뢰감",
        estimatedTime: "0-2분",
        content: `"안녕하세요! 크루즈 건강관리팀의 모니카입니다.

저희가 지난 3년간 500명 이상의 고객분들을
도와드렸는데, 특히 40대 50대
아이들 있는 분들이
"이걸 왜 진작 안 했지?" 이렇게 말씀하시는
프로그램이 있어서 전화드렸습니다.

편하신 시간에 5분만 들어주시겠어요?"`,
        psychologyPrinciples: ["Social Proof", "Relatability", "Regret Avoidance"],
        pasonaPhase: "Problem",
        tips: [
          "같은 연령대 부모들의 후회 심리 활용",
          "자녀를 생각하는 부모의 심리 터치",
          "짧은 시간 요청으로 진입장벽 낮추기",
        ],
      },
      // ... (다른 phases는 유사하게)
    },
    "시니어 (55세+)": {
      // ... 시니어 세그먼트 스크립트
    },
  },
  rental: {
    "초심자": {
      1: {
        id: "rental_beginner_1",
        category: "rental",
        segment: "초심자",
        phase: "1",
        phaseName: "인사 + 신뢰감",
        estimatedTime: "0-2분",
        content: `"안녕하세요! 렌탈 서비스 전문 모니카입니다.

저희가 지난 5년간 50,000명 이상의
고객분들을 도와드렸고,
특히 처음 렌탈을 생각하시는 분들이
가장 만족해하는 패키지가 있어서
말씀드렸습니다.

편하신 시간에 5분만 들어주시겠어요?"`,
        psychologyPrinciples: ["Social Proof", "Authority"],
        pasonaPhase: "Problem",
        tips: [
          "50,000명 사용자로 대규모 신뢰도 강조",
          "처음 사용자를 위한 맞춤 패키지임을 암시",
        ],
      },
      // ... (다른 phases)
    },
  },
  product_new_db: {
    "모든 고객": {
      1: {
        id: "product_new_1",
        category: "product_new_db",
        segment: "모든 고객",
        phase: "1",
        phaseName: "인사 + 신뢰감",
        estimatedTime: "0-2분",
        content: `"안녕하세요! LG 전자 협력사 크루즈닷 모니카입니다.

저희 신제품이 출시되었는데,
이미 100,000명이 신뢰하고 있는 상품이에요.
평점도 4.8/5.0으로
업계 최고 수준입니다.

편하신 시간에 3분만 설명해드릴게요!"`,
        psychologyPrinciples: ["Authority (LG)", "Social Proof", "Credibility"],
        pasonaPhase: "Problem",
        tips: [
          "LG 협력이라는 권위 즉시 강조",
          "100,000 사용자와 4.8/5 평점으로 신뢰도 구축",
          "짧은 3분으로 부담 감소",
        ],
      },
      // ... (다른 phases)
    },
  },
  product_inactive_db: {
    "모든 고객": {
      1: {
        id: "product_inactive_1",
        category: "product_inactive_db",
        segment: "모든 고객",
        phase: "1",
        phaseName: "인사 + 신뢰감",
        estimatedTime: "0-2분",
        content: `"안녕하세요 모니카님! 오래간만이에요 😊

저희가 v2.0을 완전 새로 만들어서
기존 고객분들께만 먼저 소개하고 있어요.

v1.0은 좋아하셨는데,
v2.0은 더 빠르고 더 효과적이 되었거든요.

2분만 설명해도 될까요?"`,
        psychologyPrinciples: ["Familiarity", "Upgrade", "Exclusivity"],
        pasonaPhase: "Problem",
        tips: [
          "반가움과 친숙함으로 시작",
          "새로운 버전과 개선사항 암시",
          "기존 고객 전용으로 특별감 부여",
        ],
      },
      // ... (다른 phases)
    },
  },
};
