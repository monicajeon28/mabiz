export function formatAmount(n: number): string {
  if (!isFinite(n)) return '0원';
  return n.toLocaleString('ko-KR') + '원';
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM → 'YYYY년 M월' (50대 친화 한글 포맷) */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

export function maskPhone(tel: string | null | undefined): string {
  if (!tel) return "-";
  const digits = tel.replace(/[^0-9+]/g, "");
  if (digits.length < 4) return "-";

  if (tel.includes("+")) {
    const countryCode = tel.match(/^\+\d+/)?.[0] || "";
    const localDigits = digits.slice(countryCode.replace("+", "").length);
    return countryCode + "-****-" + localDigits.slice(-4);
  }

  // [LIB-TYPES-MASKPHONE-INTL-001] 국내 지역번호(02/031 등) 처리
  // 11자리: 010-xxxx-xxxx → 010-****-1234
  // 10자리: 02-xxx-xxxx 또는 031-xxx-xxxx → 02-****-1234 또는 031-****-1234
  // 9자리:  02-xx-xxxx → 02-****-1234
  // 그 외:  앞 자리는 유지하고 중간을 ****로 마스킹
  if (digits.length >= 10) {
    // 11자리(010): 3자리 + ****
    // 10자리(031 등): 3자리 + ****
    return digits.substring(0, 3) + "-****-" + digits.slice(-4);
  }
  // 9자리 이하(02 지역번호: 실제 번호 앞 2자리 유지)
  const prefixLen = digits.length <= 9 ? 2 : 3;
  return digits.substring(0, prefixLen) + "-****-" + digits.slice(-4);
}

export function maskCustomerName(name: string | null | undefined): string {
  if (!name) return '-';
  if (name.length <= 1) return name;
  return name[0] + '*'.repeat(Math.min(name.length - 1, 3));
}
