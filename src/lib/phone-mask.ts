/**
 * 전화번호 마스킹 공용 유틸.
 * 숫자만 추출한 뒤 앞 3자리·뒤 4자리만 노출하고 가운데를 가린다.
 * 형식 무관(하이픈 유무·자릿수 변형에 안전) — 정규식 매칭 실패로 '조용히 원본 노출'되는 사고를 막는다.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = String(phone).replace(/[^0-9]/g, '');
  if (d.length >= 7) return d.slice(0, 3) + '****' + d.slice(-4);
  return '****';
}
