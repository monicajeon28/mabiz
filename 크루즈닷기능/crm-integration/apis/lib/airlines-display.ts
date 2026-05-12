// lib/data/airlines-display.ts
// 고객 화면(ProductDetail) 전용 경량 데이터 — 코드/이름/로고만 포함
// airlines.ts 전체(수하물 정책 등)를 번들에 포함시키지 않기 위해 분리
// ⚠️ airlines.ts에 항공사 추가 시 이 파일도 함께 업데이트 필요 (수동 동기화)

export interface AirlineDisplayInfo {
  name: string;
  logoPath: string;
}

export const AIRLINES_DISPLAY: Record<string, AirlineDisplayInfo> = {
  // 아시아 - 동북아
  KE: { name: '대한항공', logoPath: '/images/airlines/KE.webp' },
  OZ: { name: '아시아나항공', logoPath: '/images/airlines/OZ.webp' },
  '7C': { name: '제주항공', logoPath: '/images/airlines/7C.webp' },
  LJ: { name: '진에어', logoPath: '/images/airlines/LJ.webp' },
  TW: { name: '티웨이항공', logoPath: '/images/airlines/TW.webp' },
  BX: { name: '에어부산', logoPath: '/images/airlines/BX.webp' },
  RS: { name: '에어서울', logoPath: '/images/airlines/RS.webp' },
  JL: { name: '일본항공', logoPath: '/images/airlines/JL.webp' },
  NH: { name: '전일본공수', logoPath: '/images/airlines/NH.webp' },
  CX: { name: '캐세이퍼시픽', logoPath: '/images/airlines/CX.webp' },

  // 아시아 - 동남아/서남아
  SQ: { name: '싱가포르항공', logoPath: '/images/airlines/SQ.webp' },

  // 북아메리카
  DL: { name: '델타항공', logoPath: '/images/airlines/DL.webp' },
  UA: { name: '유나이티드항공', logoPath: '/images/airlines/UA.webp' },

  // 중동
  EK: { name: '에미레이트항공', logoPath: '/images/airlines/EK.webp' },

  // 유럽
  AY: { name: '핀에어', logoPath: '/images/airlines/AY.webp' },
  LH: { name: '루프트한자', logoPath: '/images/airlines/LH.webp' },
};

export function getAirlineDisplay(code: string): AirlineDisplayInfo | undefined {
  return AIRLINES_DISPLAY[code?.toUpperCase()];
}
