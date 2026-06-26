// 고객 출처/상태 한글 라벨 SSoT (Single Source of Truth)
// 알림벨·고객목록 등에서 공통 재사용. 영어 코드를 한글로 안전하게 변환.

// 출처별 라벨 및 색상 (sourceType → 한글)
export const SOURCE_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  user: { label: "구매고객", icon: "🟢", color: "bg-green-50 text-green-700" },
  inquiry: { label: "상품문의", icon: "📋", color: "bg-blue-50 text-blue-700" },
  affiliate: { label: "파트너채널", icon: "🟡", color: "bg-yellow-50 text-yellow-700" },
  landing_page: { label: "랜딩페이지", icon: "🔵", color: "bg-cyan-50 text-cyan-700" },
  education: { label: "교육", icon: "🎓", color: "bg-purple-50 text-purple-700" },
  gold_member: { label: "골드회원", icon: "👑", color: "bg-amber-50 text-amber-700" },
};

// 상태/유형별 라벨 및 색상 (type → 한글, 영문 코드 하위 호환 포함)
export const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  // 신규 상태값
  "잠재고객":  { label: "잠재고객",  color: "bg-blue-100 text-blue-700" },
  "문자":      { label: "문자",      color: "bg-sky-100 text-sky-700" },
  "부재":      { label: "부재",      color: "bg-yellow-100 text-yellow-700" },
  "3일부재":   { label: "3일부재",   color: "bg-orange-100 text-orange-700" },
  "소통":      { label: "소통",      color: "bg-purple-100 text-purple-700" },
  "구매완료":  { label: "구매완료",  color: "bg-green-100 text-green-700" },
  "VIP":       { label: "👑 특별한 고객",       color: "bg-gold-100 text-gold-700 font-bold" },
  "수신거부":  { label: "수신거부",  color: "bg-gray-100 text-gray-500" },
  // 기존 영문 코드 → 한국어 (하위 호환)
  LEAD:         { label: "잠재고객",  color: "bg-blue-100 text-blue-700" },
  PROSPECT:     { label: "잠재고객",  color: "bg-blue-100 text-blue-700" },
  INQUIRY:      { label: "문의고객",  color: "bg-sky-100 text-sky-700" },
  CUSTOMER:     { label: "구매완료",  color: "bg-green-100 text-green-700" },
  PURCHASED:    { label: "구매완료",  color: "bg-green-100 text-green-700" },
  GOLD:         { label: "👑 골드회원", color: "bg-amber-100 text-amber-700" },
  ACTIVE:       { label: "활성",      color: "bg-green-100 text-green-700" },
  INACTIVE:     { label: "비활성",    color: "bg-gray-100 text-gray-500" },
  UNSUBSCRIBED: { label: "수신거부",  color: "bg-gray-100 text-gray-500" },
  BLOCKED:      { label: "차단됨",    color: "bg-red-100 text-red-600" },
};

// 출처 코드 → 한글 라벨 (없으면 한글 폴백 '신규 문의')
export function labelForSource(code?: string | null): string {
  if (!code) return "신규 문의";
  return SOURCE_TYPE_LABELS[code]?.label ?? "신규 문의";
}

// 상태 코드 → 한글 라벨 (없으면 원본 코드 또는 '잠재고객' 폴백)
export function labelForType(code?: string | null): string {
  if (!code) return "잠재고객";
  return TYPE_LABELS[code]?.label ?? code;
}

// B2B 유입 출처(source) → 한글 라벨 SSoT
// (정답 매핑은 marketing-funnel SharedCustomerDetailModal getSourceBadge에서 이관)
// 영어 코드가 알림벨 등 화면에 절대 노출되지 않도록 한글 폴백 보장.
export const B2B_SOURCE_LABELS: Record<string, string> = {
  "product-inquiry": "상품문의",
  "phone-consultation": "전화문의",
  "landing-page": "랜딩페이지",
  "test-guide": "3일체험",
  "cruise-guide": "구매고객",
  "mall-signup": "크루즈몰가입",
  "affiliate-manual": "수동등록",
  "affiliate-manual-creation": "수동등록",
  "affiliate-contract-approval": "계약승인",
};

// B2B source 코드 → 한글 라벨
//   - 'mall-' 접두사(mall-{id} 등) → '크루즈몰가입'
//   - 'affiliate-manual' 계열 → '수동등록'
//   - 매핑에 없으면 'B2B 문의' 한글 폴백
export function labelForB2bSource(source?: string | null): string {
  if (!source) return "B2B 문의";
  if (B2B_SOURCE_LABELS[source]) return B2B_SOURCE_LABELS[source];
  if (source.startsWith("mall-")) return "크루즈몰가입";
  if (source.startsWith("affiliate-manual")) return "수동등록";
  return "B2B 문의";
}
