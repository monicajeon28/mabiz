/**
 * 크루즈 세일즈봇 설득 이미지 카탈로그 (봇 v2 Phase B — 인라인 이미지)
 *
 * 50대 손님은 글보다 사진에 반응한다. 상담 흐름(문제→해결→신뢰→후기)의 결정적 순간에
 * 봇이 응답 끝에 `[IMG:키]` 마커를 남기면, chat route가 이 카탈로그로 URL을 붙여 채팅에 인라인 표시한다.
 *
 * 표시 URL = **공개 이미지 프록시** (`/api/public/landing-image?id={fileId}`).
 *  - 비로그인 손님 화면에서 동작해야 하므로 인증 게이트가 있는 내부 proxy는 쓰지 않는다.
 *  - 주의(배포 의존): 이 프록시는 우리 DB(ImageAsset)에 driveFileId 로 등록된 파일만 서빙한다.
 *    아래 fileId 9종이 ImageAsset 에 없으면 404 → 이미지가 안 뜬다. 시드/등록이 선행돼야 한다.
 */

/** 공개(비로그인) 이미지 프록시 경로. 손님 채팅에 그대로 <img src>로 넣는다. */
export function publicImageUrl(fileId: string): string {
  return `/api/public/landing-image?id=${encodeURIComponent(fileId)}`;
}

export interface BotImage {
  /** Google Drive 파일 ID (ImageAsset.driveFileId 와 일치해야 프록시가 서빙) */
  fileId: string;
  /** 50대용 한글 설명(이미지 alt + 접근성). 화면 한글만. */
  label: string;
}

/**
 * 설득 이미지 9종. key → {fileId,label}.
 * 키는 시스템프롬프트가 `[IMG:키]`로 지목하는 값과 1:1.
 */
export const BOT_IMAGES: Record<string, BotImage> = {
  opening: {
    fileId: "1IbCG85sqfX7iAOduZNO7Y_cKvvaQ70zb",
    label: "티켓 한 장 들고 떠나는 자유여행의 막막함",
  },
  problem1: {
    fileId: "14zr_DQzuVbGJ8EPVIkfVIYsPtSewPN3w",
    label: "혼자 떠나는 자유여행에서 겪는 문제들",
  },
  problem2: {
    fileId: "1MX0ghJ6PkC0lJgI28E5vV0G4LrX5yezX",
    label: "안내 없이 가면 겪게 되는 어려움",
  },
  solution1: {
    fileId: "19m-9Ue86JAeSP5SFJj7Ef7rBkF6pYLYR",
    label: "크루즈닷 특별 안내와 한국어 방송",
  },
  solution2: {
    fileId: "102y1nFcJ6OBua4iEAd3wobQgEDaTHIph",
    label: "전담 스탭이 함께 동행하는 안내",
  },
  trust1: {
    fileId: "1akmDLojUh25LSaV2fXVGPFbmHSRk_Eb8",
    label: "선사 인증을 받은 전문 스탭",
  },
  trust2: {
    fileId: "1LHKF1XHkXJIXe44CfGYWHQNnIU1NVto4",
    label: "상품 단가와 스탭 인증 정보",
  },
  review1: {
    fileId: "1EpdRFkq95Jo7a6yzuhU10Eg679POav4m",
    label: "다녀오신 고객님 후기",
  },
  review2: {
    fileId: "1a7g1rQIO4kO_IH3f7egTdUHIFWoLaJxx",
    label: "고객님이 보내주신 후기 메시지",
  },
};

/** chat route가 인라인 표시에 쓰는 형태. */
export interface ResolvedBotImage {
  url: string;
  label: string;
}

/**
 * 키 배열 → 표시용 [{url,label}]. 모르는 키는 조용히 무시한다(프롬프트 오타·환각 키 방어).
 */
export function resolveBotImages(keys: string[]): ResolvedBotImage[] {
  const out: ResolvedBotImage[] = [];
  const seen = new Set<string>();
  for (const raw of keys) {
    const key = String(raw ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const img = BOT_IMAGES[key];
    if (!img) continue; // 모르는 키 무시
    out.push({ url: publicImageUrl(img.fileId), label: img.label });
  }
  return out;
}
