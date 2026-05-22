export function formatAmount(n: number): string {
  return n.toLocaleString() + "원";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}.${m}`;
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

  return digits.substring(0, 3) + "-****-" + digits.slice(-4);
}
