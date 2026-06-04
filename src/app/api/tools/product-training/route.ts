import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export type ProductTrainingCategory =
  | "BUSAN"
  | "JAPAN"
  | "SOUTHEAST_ASIA"
  | "MEDITERRANEAN"
  | "ALASKA"
  | "CRUISE_SERVICE";

export interface ProductTraining {
  id: string;
  category: ProductTrainingCategory;
  title: string;
  description: string;
  icon: string;
  content: string;
}

const PRODUCT_TRAINING_DATA: ProductTraining[] = [
  // ── BUSAN ──────────────────────────────────────────────────────────────
  {
    id: "training-busan-1",
    category: "BUSAN",
    title: "부산 출발 크루즈 핵심 셀링 포인트",
    description: "부산 출발 — 항공 없이 크루즈를 타는 가장 쉬운 방법",
    icon: "⚓",
    content:
      "항공권 없이 부산항에서 바로 승선! 김해공항 2시간보다 편하게 출발할 수 있어요. 국내 출발이라 여권 분실 걱정도 줄고, 배 위에서 자고 일어나면 일본·동남아에 도착합니다.",
  },
  {
    id: "training-busan-2",
    category: "BUSAN",
    title: "부산 출발 고객 FAQ 대응 스크립트",
    description: "부산 출발 고객이 가장 많이 묻는 질문 5가지",
    icon: "💬",
    content:
      "Q: 멀미가 걱정돼요 → 로얄캐리비안 대형선은 흔들림이 거의 없어요, 웬만한 빌딩보다 안정적이에요. Q: 짐이 많으면 어떡하죠 → 승선 시 짐 맡기면 객실로 직접 배달돼요. 캐리어 없이 걸어 다닐 수 있습니다.",
  },
  {
    id: "training-busan-3",
    category: "BUSAN",
    title: "부산 출발 시니어 고객 맞춤 멘트",
    description: "5060 시니어 고객 설득 포인트 — 안전·편의 중심",
    icon: "🧡",
    content:
      "선내에 의무실과 24시간 의료진이 상주해요. 무릎이 안 좋으셔도 엘리베이터·전동 휠체어 무료 대여로 전 구역 이동 가능합니다. 기항지도 선사 공식 투어로 가면 버스 이동이라 체력 부담이 없어요.",
  },

  // ── JAPAN ──────────────────────────────────────────────────────────────
  {
    id: "training-japan-1",
    category: "JAPAN",
    title: "일본 기항 크루즈 핵심 셀링 포인트",
    description: "후쿠오카·나가사키·가고시마 — 일본 재방문 고객의 새로운 선택",
    icon: "🗾",
    content:
      "일반 일본 여행과 달리 호텔 체크인 없이 선내에서 자면서 여러 도시를 돌아요. 후쿠오카 텐진 쇼핑 + 나가사키 짬뽕 + 가고시마 흑돼지까지 한 번에! 일본 재방문객에게 '이런 일본은 처음'이라는 반응 100%예요.",
  },
  {
    id: "training-japan-2",
    category: "JAPAN",
    title: "일본 크루즈 비자·입국 안내 멘트",
    description: "한국인 무비자 일본 입국 — 간단한 절차 설명",
    icon: "🛂",
    content:
      "한국 여권 소지자는 일본 무비자 90일 입국 가능해요. 선사에서 기항지 입국 서류를 단체로 처리해 드리니 개별 준비가 거의 없어요. 여권 유효기간 6개월 이상만 확인하시면 됩니다.",
  },
  {
    id: "training-japan-3",
    category: "JAPAN",
    title: "일본 크루즈 쇼핑 포인트 안내",
    description: "기항지 면세·쇼핑 시간 활용법",
    icon: "🛍️",
    content:
      "후쿠오카 텐진은 도보 10분 거리에 드러그스토어·백화점이 집중돼 있어요. 현금·카드 모두 사용 가능, 쇼핑 후 선박으로 귀환 시간만 지키면 돼요. 면세 한도 800달러, 초과 시 선내 면세점 구매로 분산하세요.",
  },

  // ── SOUTHEAST_ASIA ────────────────────────────────────────────────────
  {
    id: "training-sea-1",
    category: "SOUTHEAST_ASIA",
    title: "동남아 크루즈 핵심 셀링 포인트",
    description: "싱가포르 출발 페낭 기항 — 고객이 물어보는 것 5가지",
    icon: "🌴",
    content:
      "싱가포르 마리나베이 출발, 말레이시아 페낭 기항. 현지인도 찾는 맛집 거리, 조지타운 세계문화유산, 롤스로이스보다 많은 자전거의 도시. 기항 5~6시간이라 핵심만 쏙 뽑아서 다닐 수 있어요.",
  },
  {
    id: "training-sea-2",
    category: "SOUTHEAST_ASIA",
    title: "홍콩 크루즈 핵심 셀링 포인트",
    description: "홍콩 출발 — 야경+딤섬+쇼핑 3박자 완성",
    icon: "🌃",
    content:
      "세계 3대 야경 빅토리아 피크, 딤섬 맛집 거리 침사추이, 몽콕 야시장까지 홍콩에서 출발하는 크루즈예요. 항공 없이 홍콩 공항 내려서 항구로 이동, 승선 후 베트남·대만 기항까지 한 번에 즐길 수 있어요.",
  },
  {
    id: "training-sea-3",
    category: "SOUTHEAST_ASIA",
    title: "동남아 더위 극복 셀링 멘트",
    description: "더위 걱정하는 고객 설득 포인트",
    icon: "❄️",
    content:
      "선내는 24시간 에어컨 완비, 수영장·아이스링크·스파까지 시원하게 즐길 수 있어요. 기항지는 이른 오전 시간대 방문이라 한낮 폭염은 선내에서 피할 수 있어요. 실내 활동만 해도 충분히 재미있는 게 크루즈의 강점이에요.",
  },

  // ── MEDITERRANEAN ─────────────────────────────────────────────────────
  {
    id: "training-med-1",
    category: "MEDITERRANEAN",
    title: "지중해 크루즈 핵심 셀링 포인트",
    description: "산토리니·미코노스·아테네 — 버킷리스트 한 번에",
    icon: "🏛️",
    content:
      "산토리니 파란 지붕, 미코노스 풍차, 아테네 아크로폴리스까지 하나의 크루즈로 전부 가요. 유럽 여행 최대 단점인 도시 간 이동·짐 옮기기가 없어요. 자고 일어나면 다음 목적지, 호텔은 바다 위 리조트입니다.",
  },
  {
    id: "training-med-2",
    category: "MEDITERRANEAN",
    title: "지중해 크루즈 비용 비교 멘트",
    description: "유럽 자유여행 대비 크루즈 가성비 설명법",
    icon: "💶",
    content:
      "유럽 개별 여행하면 호텔+식비+이동비만 1인당 200만 원 이상이에요. 크루즈는 숙박·3식·엔터테인먼트가 포함된 가격이라 실제로 더 저렴한 경우가 많아요. 식비 걱정 없이 원하는 레스토랑을 선택할 수 있어요.",
  },
  {
    id: "training-med-3",
    category: "MEDITERRANEAN",
    title: "지중해 시니어 & 허니문 맞춤 멘트",
    description: "연령·목적별 지중해 크루즈 포인트",
    icon: "💑",
    content:
      "허니문 고객께는 산토리니 선셋 디너 패키지가 인기예요. 시니어 고객께는 아테네 역사 투어를 에어컨 버스로 편하게 다녀올 수 있다고 말씀드리면 돼요. 체력 부담 없이 유럽 문화를 느낄 수 있는 게 크루즈의 최대 장점이에요.",
  },

  // ── ALASKA ────────────────────────────────────────────────────────────
  {
    id: "training-alaska-1",
    category: "ALASKA",
    title: "알래스카 크루즈 핵심 셀링 포인트",
    description: "빙하·고래·오로라 — 극지 자연의 압도적 경험",
    icon: "🧊",
    content:
      "빙하 앞에서 직접 빙하 조각이 떨어지는 소리를 들을 수 있어요. 혹등고래 수중발레, 독수리 군무, 회색곰 연어 사냥까지 자연 다큐멘터리가 현실이 돼요. '살면서 한 번은 가야 할 여행'으로 고객이 직접 주변에 추천하는 상품이에요.",
  },
  {
    id: "training-alaska-2",
    category: "ALASKA",
    title: "알래스카 여름 날씨 & 준비물 안내",
    description: "여름 7~8월 최적 시즌 — 고객 불안 해소 멘트",
    icon: "🌤️",
    content:
      "알래스카 여름은 낮 15~18도, 밖에서 활동하기 딱 좋은 날씨예요. 긴 소매 겉옷 하나만 챙기면 돼요. 백야라 밤 10시에도 밝아서 저녁 투어 후 선내 복귀까지 충분한 시간이 있어요.",
  },

  // ── CRUISE_SERVICE ────────────────────────────────────────────────────
  {
    id: "training-svc-1",
    category: "CRUISE_SERVICE",
    title: "로얄캐리비안 선내 시설 안내 멘트",
    description: "오아시스급 대형선 시설 — 고객 감탄 포인트",
    icon: "🛳️",
    content:
      "오아시스 오브 더 시즈는 축구장 3개 크기예요. 아이스링크, 암벽등반, 집라인, 워터파크, 브로드웨이 뮤지컬까지 배 안에 다 있어요. 기항지 안 나가도 3박 4일이 부족할 정도로 할 게 넘쳐요.",
  },
  {
    id: "training-svc-2",
    category: "CRUISE_SERVICE",
    title: "자유 크루즈 vs 패키지 여행 차이점 설명",
    description: "항공 불포함 자유크루즈 — 고객이 오해하는 포인트 3가지",
    icon: "✈️",
    content:
      "저희 상품은 항공 불포함 자유크루즈예요. 고객이 직접 원하는 항공권을 예약하고 출발지 공항에서 승선항으로 이동해요. 비용 절감 + 원하는 좌석 선택 가능, 마일리지 적립도 직접 받으세요.",
  },
  {
    id: "training-svc-3",
    category: "CRUISE_SERVICE",
    title: "음식·식당 안내 — 포함 식사 vs 유료 레스토랑",
    description: "선내 식사 옵션 설명 — 고객 만족도 높이는 포인트",
    icon: "🍽️",
    content:
      "메인 다이닝·뷔페·일부 카페는 승선 요금에 포함돼요. 추가 비용 없이 3끼 충분히 먹을 수 있어요. 스테이크 레스토랑·스시바·노부 같은 스페셜티 레스토랑은 1인당 3~5만 원 추가인데, 여행 중 특별한 날에 한 번쯤 가시면 평생 기억에 남아요.",
  },
  {
    id: "training-svc-4",
    category: "CRUISE_SERVICE",
    title: "크루즈 예약 프로세스 안내 멘트",
    description: "처음 예약하는 고객을 위한 단계별 설명",
    icon: "📋",
    content:
      "예약은 3단계예요. ① 날짜·객실 선택 → ② 여권 정보 입력 → ③ 입금 완료. 저희가 선사 직접 연결이라 중간 수수료 없어요. 예약 후 바우처 발행까지 보통 2~3시간, 이후 선사 앱 설치하시면 선내 모든 일정 사전 예약 가능해요.",
  },
];

// GET /api/tools/product-training
export async function GET() {
  try {
    await getAuthContext();

    return NextResponse.json({ ok: true, items: PRODUCT_TRAINING_DATA });
  } catch (err) {
    logger.error("[GET /api/tools/product-training]", { err });

    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
