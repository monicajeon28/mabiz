import type { Prisma } from '@prisma/client';

export type InquiryDeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export interface InquiryTrackingInput {
  source?: string | null;
  productName?: string | null;
  productCode?: string | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  ip?: string | null;
  isGold?: boolean | null;
  submittedAt?: string | null;
}

export function detectInquiryDeviceType(userAgent?: string | null): InquiryDeviceType {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return 'unknown';
  if (/(bot|crawler|spider|crawling)/i.test(ua)) return 'bot';
  if (/(ipad|tablet|kindle|silk|playbook)/i.test(ua)) return 'tablet';
  if (/(mobi|android|iphone|ipod|iemobile|blackberry|opera mini)/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function extractInquiryIp(headers: Headers): string | null {
  const headerKeys = [
    'cf-connecting-ip',
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
  ];

  for (const key of headerKeys) {
    const value = headers.get(key);
    if (!value) continue;
    const ip = key === 'x-forwarded-for' ? value.split(',')[0]?.trim() : value.trim();
    if (ip) return ip;
  }

  return null;
}

export function buildInquiryTracking(input: InquiryTrackingInput): Prisma.InputJsonValue {
  const userAgent = input.userAgent ?? null;
  const deviceType = input.deviceType ?? detectInquiryDeviceType(userAgent);
  const source = input.source ?? undefined;
  const isGold = input.isGold ?? undefined;
  const timestamp = input.submittedAt ?? new Date().toISOString();

  return {
    ...(source ? { source } : {}),
    ...(input.productName ? { productName: input.productName } : {}),
    ...(input.productCode ? { productCode: input.productCode } : {}),
    ...(input.pageUrl ? { pageUrl: input.pageUrl } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(deviceType ? { deviceType } : {}),
    ...(input.ip ? { ip: input.ip } : {}),
    ...(typeof isGold === 'boolean' ? { isGold } : {}),
    timestamp,
    capturedAt: timestamp,
  } as Prisma.InputJsonValue;
}
