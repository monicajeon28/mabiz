export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length < 4) return phone;
  // 01012341234 → 010****1234
  return cleaned.slice(0, 3) + '****' + cleaned.slice(-4);
}

export function maskCustomerName(name: string | null | undefined): string {
  if (!name) return '';
  if (name.length <= 1) return name;
  // 김훈 → 김*
  // 김성훈 → 김*훈
  if (name.length === 2) {
    return name[0] + '*';
  }
  return name[0] + '*' + name.slice(-1);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  // test@example.com → te**@example.com
  const maskedLocal = local.slice(0, 2) + '**';
  return maskedLocal + '@' + domain;
}
