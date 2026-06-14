import type { InquiryTracking } from '@/types/contact';

export function formatInquiryTrackingSummary(tracking?: InquiryTracking | null): string | null {
  if (!tracking) return null;

  const parts = [
    tracking.isGold ? '골드' : null,
    tracking.deviceType ?? null,
    tracking.ip ?? null,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return parts.length > 0 ? parts.join(' · ') : null;
}
