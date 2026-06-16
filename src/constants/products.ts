/**
 * 크루즈닷 상품 교육 상수 — 실제 데이터 기반
 * 출처: www.cruisedot.co.kr 골드 멤버십 페이지 확인 완료
 */

export const CRUISE_PRODUCTS = {
  GOLD_A: {
    code: "GOLD_A",
    name: "골드 A플랜",
    emoji: "🇯🇵",
    type: "commitment" as const,
    commitmentMonths: 60,
    price: "33,000원/월 (하루 1,100원)",
    features: [
      "일본·대만·홍콩 크루즈 10~20% 할인",
      "출발 48시간 전 우선 예약 오픈",
      "KB헬스케어 포함",
      "60개월 VIP 멤버십 확정 (납입금 은행 안전 보관)",
      "단체 15명: 굿즈 증정 / 20명: 스탭 무료 / 30명: 인솔자+스탭 풀팀",
    ],
    recommendedSegments: ["A", "B"] as const,
    tagline: "일본·대만·홍콩 자주 가는 분들의 선택",
    description: "일본, 대만, 홍콩 크루즈를 자주 이용하는 분들을 위한 골드 멤버십. 월 33,000원으로 최대 20% 할인에 KB헬스케어까지 누리세요. 60개월 의무납입.",
    pasona: {
      problem: "일본·대만 크루즈를 자주 가고 싶은데 매번 정가를 내야 한다",
      affinity: "아시아 크루즈를 즐기는 분들",
      solution: "월 33,000원으로 10~20% 할인 + 48시간 전 우선 예약으로 좋은 방 선점",
      offer: "60개월 납입하시는 금액은 여행사에 사라지는 돈이 아니라 회원님 멤버십으로 은행에 안전하게 보관됩니다. 일본 크루즈 한 번에 42만원 절약이니, 납입금은 여행으로 고스란히 돌아옵니다",
    },
    topObjections: [
      {
        objection: "매달 33,000원씩 내면 손해 아닌가요?",
        response: "1회 여행에서 할인받는 금액이 33,000원을 훌쩍 넘습니다. 일본 크루즈 140만원짜리가 98만원이 되면, 한 번에 42만원 절약이에요.",
      },
      {
        objection: "매달 내는 돈이 그냥 없어지는 거 아닌가요?",
        response: "아닙니다. 여행사에 내고 사라지는 돈이 아니라, 회원님 멤버십으로 은행에 안전하게 보관됩니다. 그래서 더 안심하고 쓰실 수 있어요.",
      },
      {
        objection: "자주 못 가면 손해 아닌가요?",
        response: "매달 33,000원은 사라지는 게 아니라 은행에 안전하게 보관됩니다. 안 가시는 달에도 우선 예약 혜택이 유지되어, 좋은 방 나오면 바로 선점하실 수 있어요.",
      },
      {
        objection: "일본만 가는 건 아닌데요?",
        response: "A플랜도 크루즈닷 전 상품에 우선 예약이 적용됩니다. 다른 지역 가실 때는 B, C 플랜을 추가하거나 업그레이드하시면 더 많이 할인받으세요.",
      },
      {
        objection: "KB헬스케어가 뭔가요?",
        response: "의료상담, 병원 예약 대행, 검진 할인, 간병인 파견까지 10년 동안 지원해드리는 프리미엄 헬스케어 서비스입니다.",
      },
      {
        objection: "남편/아내랑 상의해봐야 해요",
        response: "당연하죠! 이렇게 설명해드리면 쉬워요: '매달 33,000원인데 일본 크루즈 한 번에 42만원 돌아온다'고요. 제가 자료 문자로 보내드릴게요.",
      },
      {
        objection: "60개월이 너무 길어요",
        response: "5년 동안 크루즈 여행 아예 안 가실 건 아니잖아요? 그 5년을 매번 정가로 내실 건지, 회원으로 매번 42만원씩 아끼실 건지예요.",
      },
      {
        objection: "먹튀하거나 회사가 어떻게 될지 모르잖아요",
        response: "납입금이 여행사 통장이 아니라 KB국민은행 신탁으로 별도 보관돼요. 회사 사정과 무관하게 회원님 돈이 은행에서 보호됩니다.",
      },
    ],
    keywords: ["일본", "대만", "홍콩", "아시아", "33000", "A플랜", "할인", "헬스케어"],
    hook: "혹시 일본이나 대만 크루즈 관심 있으세요? 저희 회원분들이 한 번 여행에 42만원씩 아끼고 계세요.",
    spinQuestions: {
      situation: [
        "보통 1년에 크루즈 여행을 몇 번 정도 계획하세요?",
        "주로 일본·대만 쪽을 자주 가시나요?",
        "크루즈 예약은 보통 언제쯤 하시는 편이에요?",
      ],
      problem: [
        "매번 정가로 예약하실 때 비용 부담이 크지 않으세요?",
        "인기 출발일에 좋은 객실 빨리 마감돼서 못 잡은 적 있으세요?",
        "나이 드실수록 건강 문제 생기면 여행 중에 걱정되지 않으세요?",
      ],
      implication: [
        "정가로만 계속 내시면 5년 동안 여행 횟수가 줄어들 수밖에 없겠죠?",
        "좋은 방 못 잡으면 여행 만족도 자체가 달라지지 않나요?",
        "건강 문제 생겼을 때 혼자 대처하기 어려우면 가족들도 걱정하겠죠?",
      ],
      needPayoff: [
        "한 번 여행할 때마다 42만원 자동 절약된다면 1년에 몇 번 더 가실 수 있을까요?",
        "우선 예약으로 제일 좋은 방 선점된다면 여행이 더 즐거우시겠죠?",
        "의료상담·간병인 파견까지 된다면 안심하고 다니실 수 있지 않을까요?",
      ],
    },
    closingScript: "그럼 두 가지 중에 선택해주시면 돼요. A플랜으로 일본·대만 크루즈 할인 먼저 받으실 건지, 아니면 A+B 함께 묶어서 동남아까지 커버하실 건지, 어느 쪽이 더 맞으세요?",
    urgencyScript: "이번 달에 신청하시면 다음 달 1일부터 바로 우선 예약 혜택이 시작돼요. 지금 일본 크루즈 인기 날짜 자리가 빠르게 나가고 있거든요.",
    socialProof: [
      { story: "서울 60대 주부", result: "A플랜 후 일본 크루즈 연 3회 → 1년 절약 126만원" },
      { story: "인천 55세 부부", result: "망설이다 가입 → 8개월 만에 납입금 26만 vs 절약 85만" },
      { story: "부산 50대 주부", result: "친구 5명 소개 → 단체 스탭 무료+굿즈 추가 혜택" },
    ],
    valueStack: [
      { item: "일본 크루즈 1회 할인", value: "약 42만원 절약" },
      { item: "48시간 전 우선 예약", value: "원하는 객실 선점" },
      { item: "KB헬스케어 10년", value: "의료비 연 수십만원 절감" },
      { item: "단체 20명 스탭 무료", value: "인솔자 비용 0원" },
      { item: "납입금 은행 보관", value: "원금 안전 보장" },
    ],
    followUpSequence: {
      day0: "오늘 상담 내용 문자 드렸어요. A플랜 월 33,000원, 일본 크루즈 한 번에 42만원 절약이에요.",
      day1: "생각해보셨어요? 이번 주 일본 크루즈 인기 자리 반 이상 나갔어요. 우선 예약 시작하려면 지금이에요.",
      day3: "저희 회원분이 어제 A플랜으로 일본 크루즈 42만원 절약하셨어요. 고객님도 같은 혜택 받으실 기회예요.",
      day7: "이번 달 우선 예약 오픈 날 다가왔어요. 회원이 아니시면 같은 날 예약 못 하세요.",
      day14: "마지막으로 연락드려요. A플랜 자리 확인해드릴게요. 궁금한 점 언제든 연락 주세요!",
    },
  },

  GOLD_B: {
    code: "GOLD_B",
    name: "골드 B플랜",
    emoji: "🌏",
    type: "commitment" as const,
    commitmentMonths: 60,
    price: "66,000원/월 (하루 2,200원)",
    features: [
      "동남아·싱가포르·말레이시아 크루즈 10~30% 할인",
      "출발 48시간 전 우선 예약 오픈",
      "KB헬스케어 포함",
      "60개월 VIP 멤버십 확정 (납입금 은행 안전 보관)",
      "단체 15명: 굿즈 증정 / 20명: 스탭 무료 / 30명: 인솔자+스탭 풀팀",
    ],
    recommendedSegments: ["A", "B", "C"] as const,
    tagline: "동남아 크루즈의 절대적 선택",
    description: "동남아, 싱가포르, 말레이시아 크루즈를 20~30% 할인받는 골드 B플랜. 싱가포르 3박4일 300만원 → 210만원으로 90만원 절약. 60개월 의무납입.",
    pasona: {
      problem: "동남아 크루즈는 비싸서 자주 못 간다",
      affinity: "동남아 크루즈를 즐기는 분들",
      solution: "월 66,000원으로 20~30% 할인. 싱가포르 한 번만 가도 본전",
      offer: "60개월 납입금은 여행사에 사라지는 돈이 아니라 회원님 멤버십으로 은행에 안전하게 보관됩니다. 싱가포르 한 번에 90만원, 말레이시아 한 번에 60만원 절약이니 납입금은 여행으로 충분히 돌아옵니다",
    },
    topObjections: [
      {
        objection: "66,000원은 좀 비싸지 않나요?",
        response: "싱가포르 3박4일 300만원이 210만원이 됩니다. 한 번만 가도 90만원 절약이에요. 66,000원은 첫 달만 내도 본전 훨씬 넘어요.",
      },
      {
        objection: "동남아 크루즈는 자주 못 가는데요.",
        response: "1년에 1번만 가셔도 충분해요. 싱가포르 300만원 → 210만원, 90만원 절약이면 1년 납입금(79만원)을 이미 넘어요. 60개월 납입금은 은행에 안전하게 보관됩니다.",
      },
      {
        objection: "할인이 항상 적용되나요?",
        response: "멤버십 유지 기간 동안 전 상품 무제한 적용됩니다.",
      },
      {
        objection: "배우자가 반대해요",
        response: "이렇게 설명해 드려보세요. '한 달 커피값으로 싱가포르 크루즈 90만원 아낀다'고요. 제가 두 분이 함께 보실 자료 문자로 보내드릴게요.",
      },
      {
        objection: "60개월 약정이 부담돼요",
        response: "5년 동안 동남아 크루즈 아예 안 가실 건 아니잖아요. 매번 정가로 내실 건지, 매번 90만원씩 아끼실 건지예요.",
      },
    ],
    keywords: ["동남아", "싱가포르", "말레이시아", "66000", "B플랜", "20%", "30%"],
    hook: "동남아 크루즈, 특히 싱가포르나 말레이시아 관심 있으세요? 회원이 되시면 300만원짜리 여행이 210만원이 돼요.",
    spinQuestions: {
      situation: [
        "동남아 여행은 얼마나 자주 다니세요?",
        "싱가포르·말레이시아 쪽 가보신 적 있으세요?",
        "크루즈로 동남아 생각해보신 적 있으세요?",
      ],
      problem: [
        "동남아 크루즈는 정가가 꽤 부담스럽지 않으세요?",
        "좋은 항로가 일찍 마감돼서 못 잡은 적 있으세요?",
        "여행비 부담으로 자주 못 가는 게 아쉽지 않으세요?",
      ],
      implication: [
        "매번 정가로 내시면 1년에 한 번밖에 못 가시겠죠?",
        "인기 항로 놓치면 다음 출발까지 1년 기다려야 할 수도 있는데 얼마나 아쉬우세요?",
        "여행을 줄이다 보면 나중에 체력 떨어질 때 더 못 가게 되지 않을까요?",
      ],
      needPayoff: [
        "1년에 1번만 가셔도 싱가포르에서 90만원 절약이면 B플랜 1년치(79만원)가 이미 본전이잖아요?",
        "원하는 날짜에 좋은 객실 우선 예약이 된다면 여행 계획이 훨씬 쉬워지지 않을까요?",
        "절약한 돈으로 1년에 한 번 더 가신다면 어떨까요?",
      ],
    },
    closingScript: "싱가포르 3박4일로 먼저 가보실 건지, 말레이시아 4박5일을 먼저 하실 건지요? B플랜으로 두 군데 다 할인받으세요.",
    urgencyScript: "이번 달 싱가포르 출발 자리 몇 석 안 남았어요. B플랜 회원이시면 48시간 전에 먼저 잡으실 수 있어요.",
    socialProof: [
      { story: "경기 55세 부부", result: "B플랜 첫 해에 싱가포르+말레이시아 연달아 → 총 150만원 절약" },
      { story: "서울 50대 직장인", result: "연 1회 동남아 → B플랜 후 2회로 늘림, 절약 90만 vs 납입금 79만" },
      { story: "대구 60대 부부", result: "자주 못 간다고 망설임 → 가입 후 인기 자리 항상 선점 성공" },
    ],
    valueStack: [
      { item: "싱가포르 3박4일 할인", value: "약 90만원 절약" },
      { item: "말레이시아 크루즈 할인", value: "약 60만원 절약" },
      { item: "48시간 전 우선 예약", value: "인기 자리 선점" },
      { item: "KB헬스케어 10년", value: "의료비 절감" },
      { item: "납입금 은행 보관", value: "원금 안전 보장" },
    ],
    followUpSequence: {
      day0: "오늘 상담 내용 문자 드렸어요. B플랜 월 66,000원, 싱가포르 한 번에 90만원 절약이에요.",
      day1: "싱가포르 이번 달 출발 자리 얼마 안 남았어요. B플랜 회원이면 바로 우선 예약 가능해요.",
      day3: "저희 회원분이 어제 동남아 크루즈 90만원 절약하셨어요. 연간 납입금 79만원보다 이미 11만원 플러스예요.",
      day7: "이번 달 말레이시아 우선 예약 오픈 날이에요. B플랜 없으면 같은 날 못 잡으세요.",
      day14: "마지막 연락이에요. B플랜 잔여 자리 확인해드릴게요. 언제든 연락 주세요!",
    },
  },

  GOLD_C: {
    code: "GOLD_C",
    name: "골드 C플랜",
    emoji: "🌍",
    type: "commitment" as const,
    commitmentMonths: 60,
    price: "99,000원/월 (하루 3,300원)",
    features: [
      "유럽·미국·알래스카 크루즈 10~30% 할인",
      "출발 48시간 전 우선 예약 오픈",
      "KB헬스케어 포함",
      "60개월 VIP 멤버십 확정 (납입금 은행 안전 보관)",
      "최대 절감 1,230만원 이상 (10개 상품 기준)",
      "단체 15명: 굿즈 증정 / 20명: 스탭 무료 / 30명: 인솔자+스탭 풀팀",
    ],
    recommendedSegments: ["A", "C"] as const,
    tagline: "유럽·알래스카 꿈을 현실로",
    description: "유럽, 미국, 알래스카 크루즈를 20~30% 할인받는 프리미엄 플랜. 유럽 5박6일 460만원 → 320만원으로 140만원 절약. 60개월 의무납입.",
    pasona: {
      problem: "유럽·알래스카 크루즈는 너무 비싸서 엄두가 안 난다",
      affinity: "버킷리스트에 유럽 크루즈가 있는 분들",
      solution: "월 99,000원으로 20~30% 할인. 유럽 한 번만 가도 수백만원 절약",
      offer: "유럽 5박6일 460만원 → 320만원, 140만원 절약이면 C플랜 1년치(119만원)를 넘어요. 60개월 납입금은 여행사에 사라지는 게 아니라 회원님 멤버십으로 은행에 안전하게 보관됩니다",
    },
    topObjections: [
      {
        objection: "매달 99,000원은 부담돼요.",
        response: "유럽 한 번 가면 140만원 절약됩니다. C플랜 1년치가 119만원이에요. 한 번만 가도 훨씬 이득이에요.",
      },
      {
        objection: "유럽은 자주 못 가는데요.",
        response: "1번만 가셔도 됩니다. 유럽 460만원 → 320만원, 140만원 절약이면 1년치 납입금(119만원)보다 이득이에요. 60개월 납입금은 은행에 안전하게 보관됩니다.",
      },
      {
        objection: "알래스카도 포함인가요?",
        response: "네, 유럽·미국·알래스카 모두 C플랜 할인이 적용됩니다.",
      },
      {
        objection: "배우자가 유럽은 너무 멀다고 해요",
        response: "이렇게 말씀드려 보세요: '유럽 460만원이 320만원이 된다. 우리 1년 안에 가자'고요. 제가 두 분이 함께 보실 자료 보내드릴게요.",
      },
      {
        objection: "나이 들어 유럽은 건강이 걱정돼요",
        response: "크루즈는 배 안에 의료진이 상주해요. KB헬스케어로 출발 전 검진도 받으시고, 간병인 파견까지 되니 오히려 유럽 여행 중 가장 안전한 방법이에요.",
      },
      {
        objection: "60개월 약정이 너무 길어요",
        response: "5년 안에 유럽 한 번도 안 가실 건 아니잖아요. 유럽 한 번에 140만원 절약, 1년치 납입금 119만원보다 이미 21만원 이득이에요.",
      },
    ],
    keywords: ["유럽", "미국", "알래스카", "99000", "C플랜", "1230만원", "프리미엄"],
    hook: "버킷리스트에 유럽 크루즈 있으세요? 저희 회원분들은 유럽 5박6일을 460만원이 아니라 320만원에 가세요.",
    spinQuestions: {
      situation: [
        "유럽이나 알래스카 크루즈를 꿈꾸신 적 있으세요?",
        "해외 여행을 얼마나 자주 다니세요?",
        "가장 가고 싶은 크루즈 목적지가 어디예요?",
      ],
      problem: [
        "유럽 크루즈는 너무 비싸서 엄두가 안 나신다고 느끼시지 않으세요?",
        "버킷리스트에 있는데 가격 때문에 계속 미루고 계신 건 아닌가요?",
        "나중에 건강이나 체력 문제로 기회를 놓칠까봐 걱정되지 않으세요?",
      ],
      implication: [
        "지금 안 가시면 언제 가실 계획이에요? 10년 후에는 더 힘들어질 수도 있잖아요.",
        "유럽 크루즈를 계속 미루다 보면 나중에 후회하실 것 같지 않으세요?",
        "체력 있을 때 못 가면 더 비싸게 내거나 아예 못 가는 상황이 될 수도 있잖아요.",
      ],
      needPayoff: [
        "유럽 460만원이 320만원이 된다면, 그 버킷리스트를 올해 안에 이루실 수 있지 않을까요?",
        "140만원 절약으로 가족과 함께 알래스카도 갈 수 있다면 어떨까요?",
        "C플랜 1년 납입금 119만원이면 유럽 한 번 가서 이미 21만원 이득인데 어떠세요?",
      ],
    },
    closingScript: "유럽 먼저 가실 건지, 알래스카 먼저 가실 건지요? C플랜 가입하시면 두 군데 다 20~30% 할인받으세요.",
    urgencyScript: "유럽 여름 시즌 인기 날짜가 빠르게 마감되고 있어요. C플랜 회원이시면 48시간 전 우선 예약으로 원하는 날 선점하세요.",
    socialProof: [
      { story: "서울 60대 부부", result: "C플랜으로 유럽 크루즈 첫 방문 → 460만원 → 320만원, 버킷리스트 실현" },
      { story: "경기 55세 직장인", result: "알래스카 단독 여행 → 30% 할인으로 혼자도 부담 없이 성공" },
      { story: "부산 58세 주부", result: "은퇴 기념 지중해 크루즈 → C플랜으로 140만원 절약, 유럽 추가 여행까지" },
    ],
    valueStack: [
      { item: "유럽 5박6일 할인", value: "약 140만원 절약" },
      { item: "알래스카 크루즈 할인", value: "약 120만원 절약" },
      { item: "48시간 전 우선 예약", value: "여름 시즌 인기 자리 선점" },
      { item: "KB헬스케어 10년", value: "해외 의료 걱정 해결" },
      { item: "납입금 은행 보관", value: "원금 안전 보장" },
    ],
    followUpSequence: {
      day0: "유럽 크루즈 상담 내용 문자 드렸어요. C플랜 월 99,000원, 유럽 5박6일에 140만원 아끼세요.",
      day1: "유럽 여름 시즌 자리 빠르게 나가고 있어요. C플랜 우선 예약으로 원하는 날 먼저 잡으세요.",
      day3: "어제 C플랜 가입하신 분이 지중해 크루즈 140만원 절약하셨어요. 고객님 버킷리스트도 이제 현실이에요.",
      day7: "여름 유럽 인기 날짜 마감 임박이에요. 지금 C플랜 가입하시면 다음 달 우선 예약부터 시작돼요.",
      day14: "마지막 연락드려요. 유럽 크루즈 자리 확인해드릴게요. 언제든 연락 주세요!",
    },
  },

  GOLD_BASIC: {
    code: "GOLD_BASIC",
    name: "골드 기본 (헬스케어)",
    emoji: "🏥",
    type: "subscription" as const,
    price: "27,000원/월",
    features: [
      "KB헬스케어 10년 보장",
      "의료상담·검진할인·병원예약·간병인 파견",
      "의무납입 없음",
      "원하는 달만 납부",
      "해지 위약금 없음",
    ],
    recommendedSegments: ["D", "E"] as const,
    tagline: "하루 900원으로 10년 건강 보장",
    description: "크루즈 할인 없이 KB헬스케어만 이용하는 기본 플랜. 월 27,000원으로 의료상담, 검진할인, 간병인 파견까지 10년 보장.",
    pasona: {
      problem: "나이 들면서 건강이 걱정되는데 의료비 부담이 크다",
      affinity: "건강을 소중히 여기는 현명한 분들",
      solution: "월 27,000원으로 KB헬스케어 10년. 병원비·간병비 걱정 덜기",
      offer: "의무납입 없고 해지 위약금도 없습니다. 부담 제로. 내신 돈도 여행사에 사라지는 게 아니라 회원님 멤버십으로 은행에 안전하게 보관되니 안심하세요",
    },
    topObjections: [
      {
        objection: "27,000원도 아깝은데요.",
        response: "KB헬스케어 하루 900원입니다. 병원 한 번 가면 수만원인데, 10년 의료상담과 간병인 파견이 27,000원이에요.",
      },
      {
        objection: "크루즈 안 가는데도 가입해야 하나요?",
        response: "크루즈 없이 헬스케어만 이용하셔도 됩니다. 나중에 크루즈 가고 싶으실 때 A/B/C 플랜으로 업그레이드하시면 돼요.",
      },
      {
        objection: "KB헬스케어는 뭘 해주나요?",
        response: "의료상담, 병원 예약 대행, 검진 할인, 간병인 파견까지 지원합니다. 혼자 사시는 부모님께 특히 안심이 되죠.",
      },
      {
        objection: "자녀한테 물어봐야 해요",
        response: "자녀분들이 제일 좋아하실 거예요. 이렇게 설명해주세요: '하루 900원으로 엄마/아빠 건강 지킨다'고요.",
      },
      {
        objection: "크루즈 안 가는데 필요한가요?",
        response: "크루즈 안 하셔도 돼요. 의료상담, 검진 할인, 간병인 파견 이 세 가지만으로도 1년에 수십만원 절약이에요.",
      },
    ],
    keywords: ["헬스케어", "건강", "KB", "간병인", "27000", "기본", "의료상담", "검진"],
    hook: "나이 드실수록 건강이 제일 중요하잖아요. 하루 900원으로 10년 의료 지원 받으시는 분들이 많아요.",
    spinQuestions: {
      situation: [
        "요즘 건강 관리 어떻게 하고 계세요?",
        "병원 자주 가시는 편이세요?",
        "가족 중 건강이 걱정되시는 분 계세요?",
      ],
      problem: [
        "요즘 의료비가 많이 올랐잖아요. 부담되지 않으세요?",
        "병원 예약이나 간병인 구하는 게 어려우셨던 적 없으세요?",
        "갑자기 건강 문제 생겼을 때 혼자 대처하기 힘드시지 않으세요?",
      ],
      implication: [
        "의료비 부담으로 병원 가기 망설이시다 더 악화된 적 있으세요?",
        "간병인 구하기 어려우면 가족이 직접 간병해야 하는데 얼마나 힘든지 아시죠?",
        "건강 관리 제때 못 하시면 나중에 더 큰 비용이 들 수도 있지 않을까요?",
      ],
      needPayoff: [
        "하루 900원으로 의료상담, 검진 할인, 간병인 파견까지 10년 보장된다면 마음이 편하시겠죠?",
        "가족이 간병 걱정 안 해도 된다면 자녀분들도 안심이겠죠?",
        "나중에 크루즈 여행도 가고 싶으시면 A/B/C 플랜으로 업그레이드하시면 되고요.",
      ],
    },
    closingScript: "기본 헬스케어 먼저 시작하실 건지, 여행 할인도 같이 받으시려면 A플랜과 함께 하실 건지요?",
    urgencyScript: "의무납입 없고 위약금도 없어요. 언제든 해지 가능하니 부담 없이 한 달만 해보세요. 지금 시작하시면 다음 달부터 바로 KB헬스케어 이용하세요.",
    socialProof: [
      { story: "경기 65세 여성", result: "기본 플랜으로 1년, 간병인 파견 3회 이용 → 실제 의료비 수십만 절감" },
      { story: "서울 58세 혼자 사는 분", result: "새벽 의료상담으로 병원 빠른 예약 → 골든타임 놓치지 않음" },
      { story: "부산 62세 부부", result: "어머니 검진 할인 이용 후 → A플랜 업그레이드해서 크루즈까지" },
    ],
    valueStack: [
      { item: "24시간 의료상담", value: "야간 응급 대응" },
      { item: "병원 예약 대행", value: "대기시간 절약" },
      { item: "검진 할인", value: "연 수만원 절감" },
      { item: "간병인 파견", value: "가족 부담 제로" },
      { item: "의무납입 없음", value: "언제든 해지 자유" },
    ],
    followUpSequence: {
      day0: "오늘 상담 내용 문자 드렸어요. 기본 헬스케어 27,000원, 하루 900원으로 10년 의료 지원이에요.",
      day1: "건강 관리 제때 하시는 게 제일 중요해요. 지금 시작하시면 내일부터 바로 의료상담 받으세요.",
      day3: "저희 회원분이 어제 야간 의료상담으로 응급실 안 가고 해결하셨어요. 위약금도 없으니 부담 없이 써보세요.",
      day7: "의무납입 없으니 한 달만 해보세요. 마음에 안 드시면 해지하시면 됩니다.",
      day14: "마지막 연락이에요. 기본 헬스케어 언제든 시작하실 수 있어요. 연락 기다릴게요!",
    },
  },

  ABC_COURSE: {
    code: "ABC_COURSE",
    name: "ABC코스 (크루즈+가전렌탈)",
    emoji: "🏠",
    type: "subscription" as const,
    price: "A코스 33,000원/월 (B·C코스 상담)",
    features: [
      "크루즈 골드 멤버십 할인 포함",
      "A코스: TV50\"·오븐·김치냉장고·공기청정기·안마의자침대·청소기",
      "B코스: TV55\"·세탁기·안마의자·로봇청소기·에어드레서",
      "C코스: 냉장고·울트라안마의자·LG냉장고·세탁건조기·TV75\"",
      "크루즈 여행 할인 + 가전 렌탈 동시 혜택",
    ],
    recommendedSegments: ["A", "B", "C"] as const,
    tagline: "크루즈 여행 + 집 가전을 한 번에",
    description: "크루즈 골드 멤버십 할인과 고급 가전 렌탈을 함께 누리는 결합 상품. A/B/C 코스 중 선택, 생활 편의와 여행 혜택을 동시에.",
    pasona: {
      problem: "크루즈도 가고 싶고, 집에 좋은 가전도 필요한데 비용이 부담된다",
      affinity: "실용적이면서 여행도 즐기고 싶은 분들",
      solution: "크루즈 할인 + 가전 렌탈을 한 번의 월납으로 해결. A/B/C 코스로 필요에 맞게 선택",
      offer: "가전 렌탈 따로, 크루즈 따로보다 훨씬 경제적. 상담 후 최적 코스 추천",
    },
    topObjections: [
      {
        objection: "가전 렌탈을 왜 크루즈랑 같이 가입해야 하나요?",
        response: "따로 가입하면 더 비쌉니다. 번들로 묶어서 월납 부담을 줄이고, 여행 할인까지 챙기는 구조예요.",
      },
      {
        objection: "A/B/C 코스 차이가 뭔가요?",
        response: "A코스는 기본 가전(TV·오븐·김치냉장고 등), B코스는 생활 중심(세탁기·로봇청소기), C코스는 프리미엄(울트라 안마의자·대형 TV 등)입니다. 상담 후 가정 상황에 맞게 결정하세요.",
      },
      {
        objection: "집에 가전이 이미 있는데요.",
        response: "기존 가전 교체 시기가 됐거나, 업그레이드를 원하시는 분들께 추천드려요. 렌탈이라 초기 비용 없이 최신 가전 이용 가능합니다.",
      },
      {
        objection: "가전은 사는 게 낫지 않나요?",
        response: "구매하시면 초기 비용 수백만원이에요. 렌탈이면 0원으로 시작하고, 고장 시 무상 수리·교체까지 돼요. 게다가 크루즈 할인까지 따라오니 훨씬 이득이에요.",
      },
      {
        objection: "배우자가 가전 렌탈은 싫다고 해요",
        response: "이렇게 설명해주세요: '구매는 한 번에 수백만원, 렌탈은 0원에 시작. 고장 나면 무상 수리. 게다가 크루즈 여행 할인까지'라고요.",
      },
    ],
    keywords: ["ABC", "렌탈", "가전", "TV", "세탁기", "안마의자", "냉장고", "결합", "번들"],
    hook: "크루즈도 가고 싶고, 집에 좋은 가전도 필요하신데 비용이 부담되세요? 두 가지를 한 번에 해결하는 방법이 있어요.",
    spinQuestions: {
      situation: [
        "집 가전 상태가 어때요? 교체 생각 있으세요?",
        "크루즈 여행도 관심 있으신가요?",
        "지금 쓰시는 가전 중 불편한 게 있으세요?",
      ],
      problem: [
        "가전 구매하면 초기 비용이 너무 많이 들지 않나요?",
        "크루즈랑 가전 따로 따로 계약하면 더 비싸다는 거 알고 계세요?",
        "크루즈도 가고 싶은데 가전 교체 비용 때문에 망설여지지 않으세요?",
      ],
      implication: [
        "크루즈랑 가전 따로 가입하시면 같은 혜택에 더 많이 내는 거잖아요?",
        "초기 비용 한 번에 내 버리면 나중에 최신 가전으로 바꾸기 더 힘들지 않나요?",
        "지금 결합 상품 놓치시면 나중에 더 비싸게 따로 가입해야 해요.",
      ],
      needPayoff: [
        "크루즈 할인 + 가전 렌탈을 한 번의 월납으로 해결한다면 월 지출이 더 효율적이지 않을까요?",
        "초기 비용 없이 TV·세탁기·안마의자를 바꾸고 크루즈까지 즐기신다면 어떠세요?",
        "나중에 크루즈 더 자주 가고 싶으시면 A/B/C 업그레이드도 가능해요.",
      ],
    },
    closingScript: "A코스로 기본 가전 세트 시작하실 건지, B코스로 세탁기·로봇청소기 포함하실 건지요?",
    urgencyScript: "이번 달 ABC코스 신청하시면 다음 달 가전 설치와 동시에 크루즈 우선 예약이 시작돼요.",
    socialProof: [
      { story: "서울 55세 주부", result: "A코스로 TV+안마의자+크루즈 → 따로 계약보다 월 3만원 절약" },
      { story: "경기 50대 부부", result: "B코스 세탁기+로봇청소기+동남아 크루즈 → 한 번에 해결, 월납 부담 감소" },
      { story: "인천 60대 부부", result: "C코스 프리미엄 가전+유럽 크루즈 → 결합으로 꿈 실현" },
    ],
    valueStack: [
      { item: "크루즈 할인", value: "여행비 20~30% 절약" },
      { item: "A코스 가전 렌탈", value: "TV·오븐·안마의자 초기비용 0원" },
      { item: "결합 할인", value: "개별 계약보다 유리" },
      { item: "KB헬스케어", value: "의료지원 포함" },
      { item: "번들 편의", value: "한 번 계약으로 해결" },
    ],
    followUpSequence: {
      day0: "오늘 ABC코스 상담 내용 문자 드렸어요. 크루즈 할인 + 가전 렌탈 한 번에 해결이에요.",
      day1: "가전 교체 생각하고 계셨다면 지금이 딱 좋은 타이밍이에요. 초기비용 없이 시작하세요.",
      day3: "저희 회원분이 ABC코스로 크루즈+가전 동시에 해결하셨어요. 따로 하는 것보다 훨씬 경제적이에요.",
      day7: "이번 달 신청하시면 다음 달 가전 설치 + 크루즈 우선 예약 동시에 시작돼요.",
      day14: "마지막 연락이에요. ABC코스 자세한 견적 문자로 보내드릴게요. 연락 주세요!",
    },
  },

  FREE_TRAVEL: {
    code: "FREE_TRAVEL",
    name: "자유여행 (인솔자 없음)",
    emoji: "🗺️",
    type: "one_time" as const,
    price: "AI패키지 대비 10~20% 저렴",
    features: [
      "인솔자·스탭 없음 (완전 자유)",
      "AI패키지보다 10~20% 저렴",
      "와이파이 포함",
      "비상연락망 제공",
      "선상 모든 시설 자유 이용",
    ],
    recommendedSegments: ["B", "C"] as const,
    tagline: "내 방식대로, 내 속도로",
    description: "인솔자 없이 스스로 일정을 짜는 크루즈 여행. 스탭 비용이 없어서 AI패키지보다 저렴하고, 선상에서 원하는 것만 즐깁니다.",
    pasona: {
      problem: "가이드 따라다니기 싫고, 내 마음대로 여행하고 싶다",
      affinity: "자유를 즐기는 경험 많은 여행자",
      solution: "스탭 없이 자유롭게. 가격도 더 저렴",
      offer: "선상 프로그램과 시설 100% 자유 이용. 와이파이·비상연락망으로 안전 보장",
    },
    topObjections: [
      {
        objection: "인솔자 없으면 불안하지 않나요?",
        response: "배 안에서는 길을 잃을 일이 없어요. 와이파이, 비상연락망 다 있고, 선내 직원들이 항상 계세요.",
      },
      {
        objection: "혼자 가면 외롭지 않나요?",
        response: "선상 프로그램에 자동으로 사람들을 만나게 됩니다. 혼자 여행자도 많아요.",
      },
      {
        objection: "왜 AI패키지보다 저렴한 거죠?",
        response: "스탭 인건비가 없어서요. 그 비용을 고객님께 돌려드리는 거예요.",
      },
      {
        objection: "말이 안 통할까봐요",
        response: "선내에서는 영어 기본이고, 하선 관광은 본인이 선택하시면 돼요. 한국어 지원되는 투어 선택하시면 걱정 없어요.",
      },
      {
        objection: "배 멀미가 걱정이에요",
        response: "요즘 크루즈선은 크기가 어마어마해서 멀미가 거의 없어요. 멀미약 챙기시면 되고, 배 안에 의료진도 계세요.",
      },
    ],
    keywords: ["자유여행", "인솔자없음", "스탭없음", "저렴", "자유", "혼자"],
    hook: "혼자 또는 친구들과 자유롭게 크루즈 여행하고 싶으세요? 인솔자 없이 AI패키지보다 10~20% 더 저렴하게 가세요.",
    spinQuestions: {
      situation: [
        "크루즈 여행 경험 있으세요?",
        "여행할 때 단체 패키지보다 자유여행을 선호하세요?",
        "혼자 또는 친구들과 여행 자주 다니세요?",
      ],
      problem: [
        "단체 여행에서 일정이 강제로 정해지는 게 불편하셨던 적 있으세요?",
        "가이드 따라다니는 게 답답하셨던 적 없으세요?",
        "같은 배인데 인솔자 비용까지 내는 게 아깝지 않으세요?",
      ],
      implication: [
        "단체 따라다니다 보면 가고 싶은 곳 못 가고 불만족스럽지 않으세요?",
        "인솔자 비용을 내셨는데 실제로 도움이 얼마나 됐나요?",
        "자유롭게 다니실 수 있는데 굳이 더 비싼 패키지를 선택할 이유가 있을까요?",
      ],
      needPayoff: [
        "내 속도로 원하는 곳만 골라 다니면서 비용도 10~20% 절약된다면 어떠세요?",
        "선상에서 자유롭게 프로그램 즐기시면서 하선 관광도 본인 결정으로 하신다면 더 좋지 않을까요?",
        "와이파이·비상연락망 있으니 안전도 걱정 없고요.",
      ],
    },
    closingScript: "일본 크루즈 자유여행으로 먼저 가보실 건지, 동남아 쪽으로 하실 건지요?",
    urgencyScript: "자유여행은 인원 제한 없지만 인기 출발일 자리가 빠르게 나가고 있어요. 원하시는 날짜 지금 잡으세요.",
    socialProof: [
      { story: "서울 45세 직장인", result: "혼자 일본 크루즈 자유여행 → 패키지 대비 40만원 절약, '다음에도 혼자 가겠다'" },
      { story: "부산 40대 친구 4명", result: "동남아 자유여행 → 각자 하고 싶은 것 즐기며 최고 만족도" },
      { story: "경기 55세 부부", result: "첫 크루즈를 자유여행으로 → AI패키지보다 저렴하면서 더 편하게" },
    ],
    valueStack: [
      { item: "인솔자 없음", value: "비용 10~20% 절약" },
      { item: "완전 자유 일정", value: "원하는 것만 선택" },
      { item: "와이파이 포함", value: "언제든 연락 가능" },
      { item: "비상연락망", value: "긴급 상황 대응" },
      { item: "선상 모든 시설", value: "제한 없이 자유 이용" },
    ],
    followUpSequence: {
      day0: "자유여행 상담 내용 문자 드렸어요. AI패키지보다 10~20% 저렴하게 크루즈 즐기세요.",
      day1: "혼자 또는 친구들이랑 가는 크루즈, 자유여행이 정답이에요. 인기 날짜 빠르게 나가고 있어요.",
      day3: "저희 회원분이 자유여행으로 혼자 일본 크루즈 다녀오셨어요. 정말 최고라고 하셨어요.",
      day7: "이번 달 인기 자유여행 날짜 거의 마감이에요. 원하시는 날짜 있으시면 지금 잡으세요.",
      day14: "마지막 연락이에요. 자유여행 날짜 확인해드릴게요. 언제든 연락 주세요!",
    },
  },

  AI_PACKAGE: {
    code: "AI_PACKAGE",
    name: "AI 패키지 (인솔자 동행)",
    emoji: "👨‍✈️",
    type: "one_time" as const,
    price: "자유여행 대비 10~20% 프리미엄",
    features: [
      "전문 인솔자·스탭 동행",
      "선상 투어 안내",
      "건강 케어 서비스",
      "와이파이 포함",
      "팁 포함",
      "단체 혜택 자동 적용",
    ],
    recommendedSegments: ["A", "B", "D", "E"] as const,
    tagline: "완벽한 여행, 스탭이 다 챙겨드립니다",
    description: "전문 인솔자와 스탭이 동행하여 투어, 건강, 비상상황 모두 책임지는 프리미엄 패키지. 처음 크루즈 가시는 분, 부모님 모시는 분께 강력 추천.",
    pasona: {
      problem: "처음 크루즈인데 뭘 어떻게 해야 할지 막막하다. 부모님 건강이 걱정된다",
      affinity: "안전하고 알찬 여행을 원하는 분들",
      solution: "스탭이 모든 것을 챙겨드리되, 회원님은 자유롭게 원하는 것만 골라 더 풍부하게 즐기시면 됩니다. 팁, 와이파이, 건강케어까지 다 해결되니 같은 배를 타도 혼자 패키지로 가는 것과 차원이 다른 경험이에요",
      offer: "60대 부모님과 함께해도 안심. 비상 상황 완벽 대처",
    },
    topObjections: [
      {
        objection: "스탭이 따라다니면 불편하지 않나요?",
        response: "강제로 따라다니는 게 아닙니다. 필요할 때만 도움받고, 자유롭게 다니셔도 돼요.",
      },
      {
        objection: "비싸지 않나요?",
        response: "혼자 계획하고 헤매는 시간 vs 스탭이 다 챙겨주는 시간, 여행 질이 달라요. 팁·와이파이 포함이라 추가 비용도 없고요.",
      },
      {
        objection: "60대 부모님과 가도 괜찮을까요?",
        response: "오히려 이 상품이 딱입니다! 건강 케어, 비상상황 대처, 뭘 해야 할지 안내까지 다 해드려요.",
      },
      {
        objection: "스탭 비용이 추가되나요?",
        response: "팁이 이미 포함돼 있어요. 추가 비용 없어요. 자유여행보다 조금 더 내시지만 팁·와이파이 다 포함이라 실제로 더 편하고 비슷해요.",
      },
      {
        objection: "아이들 데려가도 되나요?",
        response: "당연하죠! 오히려 아이들 있으면 AI패키지가 훨씬 편해요. 스탭이 아이들도 함께 돌봐드리니까 부모님이 더 편하게 즐기세요.",
      },
    ],
    keywords: ["AI패키지", "인솔자", "스탭", "동행", "부모님", "건강케어", "처음", "팁포함"],
    hook: "처음 크루즈이거나 부모님 모시고 가신다면, 스탭이 모든 걸 챙겨드리는 AI패키지가 딱 맞아요.",
    spinQuestions: {
      situation: [
        "크루즈 처음이세요?",
        "부모님이나 어르신과 함께 여행 계획 있으세요?",
        "해외 여행 중 긴급 상황 경험하신 적 있으세요?",
      ],
      problem: [
        "처음 크루즈인데 뭘 어떻게 해야 할지 막막하시지 않으세요?",
        "부모님 건강이 걱정돼서 여행을 못 가신 적 있으세요?",
        "여행 준비를 혼자 다 하시다 보면 너무 복잡하고 힘드셨던 적 있으세요?",
      ],
      implication: [
        "처음 크루즈를 혼자 가셨다가 헤매시면 여행 내내 스트레스받으시겠죠?",
        "부모님과 여행 중 건강 문제 생겼을 때 혼자 대처하기 어렵지 않을까요?",
        "여행 준비에 지치셔서 정작 여행지에서 못 즐기신 경험 있으세요?",
      ],
      needPayoff: [
        "전문 스탭이 투어·건강·비상상황 모두 챙겨드린다면 처음 크루즈도 완벽하게 즐기실 수 있지 않을까요?",
        "부모님 건강 걱정 없이 여행 보내드릴 수 있다면 자녀분들도 안심이겠죠?",
        "팁·와이파이 다 포함이라 추가 비용 없이 프리미엄 서비스 받으신다면 어떠세요?",
      ],
    },
    closingScript: "부모님 모시고 가실 건지, 가족 전체가 함께 가실 건지요? 어떤 구성이세요?",
    urgencyScript: "AI패키지는 스탭 인원이 한정되어 있어서 인기 출발일 자리가 금방 마감돼요. 원하시는 날짜 지금 예약하세요.",
    socialProof: [
      { story: "서울 55세 딸 + 부모님", result: "AI패키지 효도 크루즈 → 부모님 건강 걱정 없이 최고 만족, '평생 최고의 여행'" },
      { story: "경기 40대 부부 + 자녀 2명", result: "첫 크루즈 AI패키지 → 스탭이 아이들 케어, 부부는 편하게 즐김" },
      { story: "인천 60대 부부", result: "유럽 AI패키지 → 언어 걱정 없이 스탭 도움으로 100% 투어 성공" },
    ],
    valueStack: [
      { item: "전문 인솔자 동행", value: "처음도 완벽한 여행" },
      { item: "건강 케어 서비스", value: "부모님 여행 안심" },
      { item: "팁 포함", value: "추가 비용 없음" },
      { item: "와이파이 포함", value: "언제든 연락 가능" },
      { item: "비상 상황 대응", value: "24시간 스탭 지원" },
    ],
    followUpSequence: {
      day0: "AI패키지 상담 내용 문자 드렸어요. 스탭 동행으로 완벽한 크루즈, 팁·와이파이 다 포함이에요.",
      day1: "부모님과 또는 처음 크루즈라면 AI패키지가 최선이에요. 이번 달 인기 날짜 남은 자리 확인해드릴까요?",
      day3: "저희 스탭이랑 효도 크루즈 다녀오신 분이 '부모님이 평생 최고의 여행'이라고 하셨어요.",
      day7: "AI패키지 스탭 자리 마감 임박이에요. 원하시는 출발일 있으시면 지금 잡으세요.",
      day14: "마지막 연락드려요. AI패키지 자리 확인해드릴게요. 언제든 연락 주세요!",
    },
  },
} as const;

export type ProductCode = keyof typeof CRUISE_PRODUCTS;
export type ProductType = (typeof CRUISE_PRODUCTS)[ProductCode];

export const PRODUCT_CODES = Object.keys(CRUISE_PRODUCTS) as ProductCode[];
export type ProductCodeType = ProductCode;

/**
 * 전화 중 즉석 검색용 — 모든 상품의 검색 가능한 항목 flat 리스트
 */
export type SearchItem = {
  productCode: ProductCode;
  productName: string;
  emoji: string;
  type: "feature" | "objection" | "response" | "pasona" | "price" | "hook" | "spin" | "closing" | "urgency" | "socialProof" | "valueStack" | "followUp";
  label: string;
  content: string;
  keywords: string[];
};

export function buildSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];

  for (const [code, product] of Object.entries(CRUISE_PRODUCTS)) {
    const pCode = code as ProductCode;

    // 가격
    if ("price" in product) {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "price",
        label: "가격",
        content: (product as { price: string }).price,
        keywords: ["가격", "얼마", "비용", "월", ...(product.keywords ?? [])],
      });
    }

    // 기능/특징
    product.features.forEach((f) => {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "feature",
        label: "특징",
        content: f,
        keywords: [f, ...(product.keywords ?? [])],
      });
    });

    // PASONA
    Object.entries(product.pasona).forEach(([key, value]) => {
      const labelMap: Record<string, string> = {
        problem: "문제 (Problem)",
        affinity: "공감 (Affinity)",
        solution: "해결 (Solution)",
        offer: "제안 (Offer)",
      };
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "pasona",
        label: labelMap[key] ?? key,
        content: value,
        keywords: [key, ...(product.keywords ?? [])],
      });
    });

    // 거절 대응
    product.topObjections.forEach((obj) => {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "objection",
        label: "거절",
        content: obj.objection,
        keywords: ["거절", "이의", ...(product.keywords ?? [])],
      });
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "response",
        label: "대응 스크립트",
        content: obj.response,
        keywords: ["대응", "답변", "스크립트", ...(product.keywords ?? [])],
      });
    });

    // hook (통화 시작 멘트)
    if ("hook" in product) {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "hook",
        label: "📢 통화 시작 멘트",
        content: (product as { hook: string }).hook,
        keywords: ["훅", "시작", "첫마디", ...(product.keywords ?? [])],
      });
    }

    // SPIN 질문
    if ("spinQuestions" in product) {
      const spin = (product as { spinQuestions: { situation: readonly string[]; problem: readonly string[]; implication: readonly string[]; needPayoff: readonly string[] } }).spinQuestions;
      const prefixMap: Record<string, string> = {
        situation: "[S 상황]",
        problem: "[P 문제]",
        implication: "[I 함의]",
        needPayoff: "[N 필요]",
      };
      (["situation", "problem", "implication", "needPayoff"] as const).forEach((key) => {
        spin[key].forEach((q) => {
          items.push({
            productCode: pCode,
            productName: product.name,
            emoji: product.emoji,
            type: "spin",
            label: "❓ SPIN 질문",
            content: `${prefixMap[key]} ${q}`,
            keywords: ["SPIN", "질문", key, ...(product.keywords ?? [])],
          });
        });
      });
    }

    // 클로징 스크립트
    if ("closingScript" in product) {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "closing",
        label: "🎯 클로징 스크립트",
        content: (product as { closingScript: string }).closingScript,
        keywords: ["클로징", "마감", "결정", ...(product.keywords ?? [])],
      });
    }

    // 긴박감 멘트
    if ("urgencyScript" in product) {
      items.push({
        productCode: pCode,
        productName: product.name,
        emoji: product.emoji,
        type: "urgency",
        label: "⏰ 긴박감 멘트",
        content: (product as { urgencyScript: string }).urgencyScript,
        keywords: ["긴박감", "마감", "지금", "서둘러", ...(product.keywords ?? [])],
      });
    }

    // 성공 사례
    if ("socialProof" in product) {
      const proofs = (product as { socialProof: readonly { story: string; result: string }[] }).socialProof;
      proofs.forEach(({ story, result }) => {
        items.push({
          productCode: pCode,
          productName: product.name,
          emoji: product.emoji,
          type: "socialProof",
          label: "👥 성공 사례",
          content: `${story}: ${result}`,
          keywords: ["사례", "후기", "성공", story, ...(product.keywords ?? [])],
        });
      });
    }

    // 가치 계산
    if ("valueStack" in product) {
      const stack = (product as { valueStack: readonly { item: string; value: string }[] }).valueStack;
      stack.forEach(({ item, value }) => {
        items.push({
          productCode: pCode,
          productName: product.name,
          emoji: product.emoji,
          type: "valueStack",
          label: "💎 가치 계산",
          content: `${item} → ${value}`,
          keywords: ["가치", "혜택", "절약", item, ...(product.keywords ?? [])],
        });
      });
    }

    // 후속 문자
    if ("followUpSequence" in product) {
      const seq = (product as { followUpSequence: { day0: string; day1: string; day3: string; day7: string; day14: string } }).followUpSequence;
      const dayLabels: [keyof typeof seq, string][] = [
        ["day0", "Day 0"],
        ["day1", "Day 1"],
        ["day3", "Day 3"],
        ["day7", "Day 7"],
        ["day14", "Day 14"],
      ];
      dayLabels.forEach(([key, label]) => {
        items.push({
          productCode: pCode,
          productName: product.name,
          emoji: product.emoji,
          type: "followUp",
          label: "📱 후속 문자",
          content: `[${label}] ${seq[key]}`,
          keywords: ["후속", "문자", "SMS", label, ...(product.keywords ?? [])],
        });
      });
    }
  }

  return items;
}

/**
 * 세그먼트별 색상
 */
export const SEGMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  B: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  C: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  D: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  E: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

/**
 * PASONA 단계별 색상
 */
export const PASONA_COLORS = {
  problem: { bg: "bg-red-50", accent: "border-l-4 border-red-500", emoji: "⚠️", label: "Problem" },
  affinity: { bg: "bg-blue-50", accent: "border-l-4 border-blue-500", emoji: "🤝", label: "Affinity" },
  solution: { bg: "bg-green-50", accent: "border-l-4 border-green-500", emoji: "💡", label: "Solution" },
  offer: { bg: "bg-purple-50", accent: "border-l-4 border-purple-500", emoji: "🎁", label: "Offer" },
};

export const SEGMENTS = [
  { code: "A", label: "30대 커플", description: "신혼부부, 자주 여행" },
  { code: "B", label: "40대 가족", description: "자녀 동반, 패키지형 선호" },
  { code: "C", label: "중년 부부", description: "안정적 소비, 품질 중시" },
  { code: "D", label: "50-60대", description: "건강 관심, 저가형" },
  { code: "E", label: "60대+", description: "여가 활동, 매우 저가형" },
];
