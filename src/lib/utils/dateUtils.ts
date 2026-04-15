/**
 * KST(UTC+9) 날짜 포맷 유틸
 * Vercel은 UTC 환경이므로 toLocaleDateString("ko-KR")은 타임존 변환 없이 동작함
 * → 서버에서 KST 날짜를 정확히 출력하려면 직접 +9시간 offset 적용 필요
 */

/** Date → "2025.04.15" 형식 (KST 기준) */
export function formatKSTDate(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** "YYYYMMDD" 형식 (파일명용, KST 기준) */
export function formatKSTDateCompact(date: Date): string {
  return formatKSTDate(date).replace(/\./g, '');
}
