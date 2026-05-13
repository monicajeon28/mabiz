import manifest from "@/data/image_manifest.json";

type Manifest = {
  items: { path: string; folder: string; tags: string[] }[];
  backgrounds: string[];
  reviews?: string[];
};

const M = manifest as unknown as Manifest;

// 문자열 정리(괄호영문 제거 + 소문자/한글만)
function norm(s: string) {
  return s
    .replace(/\([^)]*\)/g, "")        // ( ... ) 제거
    .replace(/[^\dA-Za-z가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// 문자열에서 질 좋은 키워드 추출(2글자+)
function keywordsFrom(s: string | string[]) {
  const texts = Array.isArray(s) ? s : [s];
  const allKeywords: string[] = [];
  for (const text of texts) {
    const base = norm(text);
    allKeywords.push(...base.split(" ").filter(w => w.length >= 2));
  }
  return allKeywords;
}

// 목적지 한글 alias 반영(예: 나가사키 → 일본나가사키 폴더명에 포함)
const extraAliases: Record<string, string[]> = {
  "퀀텀": ["quantum","퀀텀오브더시즈","퀀텀오브더"],
  "나가사키": ["일본나가사키","나가사키"],
  "도쿄": ["일본도쿄","도쿄"],
  "후쿠오카": ["일본 후쿠오카","후쿠오카"],
  "오키나와": ["오키나와","일본 오키나와","나하"],
  "부산": ["부산 크루즈 터미널 위치","부산","busan"]
  // 필요시 계속 추가
};

function expand(keys: string[]) {
  const set = new Set<string>();
  for (const key of keys) {
    set.add(key);
    const al = extraAliases[key] || [];
    for (const a of al) set.add(a.toLowerCase());
  }
  return Array.from(set);
}

// 점수 계산: 태그가 키워드에 포함되면 +1
function scoreItem(item: {folder: string; tags: string[]}, keys: string[]) {
  const K = new Set(keys);
  let s = 0;
  for (const t of item.tags) {
    const tnorm = t.toLowerCase();
    if (K.has(tnorm)) s += 1;
    // 부분 포함도 가산
    else if ([...K].some(k => tnorm.includes(k) || k.includes(tnorm))) s += 0.5;
  }
  return s;
}

export function pickMessageImage(cruiseName: string, destinations: string[]) {
  const baseKeys = [
    ...keywordsFrom(cruiseName),
    ...keywordsFrom(destinations),
  ];
  const keys = expand(baseKeys);

  // 1) cruise+destination 동시 매칭 높은 순
  const scored = (M.items || []).map(it => ({
    it,
    score: scoreItem(it, keys)
  })).filter(x => x.score > 0)
    .sort((a,b)=> b.score - a.score);

  // 상위 30개 중 랜덤
  if (scored.length > 0) {
    const pool = scored.slice(0, 30).map(x => x.it);
    const choose = pool[Math.floor(Math.random() * pool.length)];
    return choose.path;
  }

  // 2) 목적지(지역) 키워드만으로 다시 시도 (조금 느슨)
  const destKeys = expand(keywordsFrom(destinations));
  const destScored = (M.items || []).map(it => ({
    it, score: scoreItem(it, destKeys)
  }))
    .filter(x => x.score > 0)
    .sort((a,b)=> b.score - a.score);

  if (destScored.length > 0) {
    const pool = destScored.slice(0, 20).map(x => x.it);
    const choose = pool[Math.floor(Math.random() * pool.length)];
    return choose.path;
  }

  // 3) 지역 이미지가 정말 없으면 → '고객 후기 자료' 폴더에서 랜덤
  if (M.reviews && M.reviews.length > 0) {
    return M.reviews[Math.floor(Math.random() * M.reviews.length)];
  }

  // 4) 그래도 없으면 → 배경 풀 랜덤
  if (M.backgrounds && M.backgrounds.length > 0) {
    return M.backgrounds[Math.floor(Math.random() * M.backgrounds.length)];
  }

  // 5) 최후 보루
  return "/크루즈정보사진/크루즈배경이미지/default.jpg";
}








