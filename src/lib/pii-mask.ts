export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone?.length) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length < 4) return '*'.repeat(Math.max(0, cleaned.length));
  // 01012341234 → 010****1234
  return cleaned.slice(0, 3) + '*'.repeat(Math.max(0, cleaned.length - 7)) + cleaned.slice(-4);
}

export function maskCustomerName(name: string | null | undefined): string {
  if (!name?.length) return '';
  if (name.length <= 1) return name;
  // 김훈 → 김*
  // 김성훈 → 김*훈
  if (name.length === 2) {
    return name[0] + '*';
  }
  return name[0] + '*' + name.slice(-1);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email?.length) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;

  const [local, domain] = parts;
  if (!local?.length || !domain?.length) return email;

  // test@example.com → te**@example.com
  const visibleChars = Math.max(1, Math.ceil(local.length * 0.3));
  const maskedLocal = local.slice(0, visibleChars) + '*'.repeat(Math.max(0, local.length - visibleChars));
  return maskedLocal + '@' + domain;
}
