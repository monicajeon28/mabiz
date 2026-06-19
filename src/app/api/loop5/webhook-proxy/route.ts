/**
 * POST /api/loop5/webhook-proxy
 * ContactForm에서 호출하는 CRM inquiry 웹훅 프록시
 *
 * 목적:
 *  - HMAC 서명 검증 (서버에서만 수행)
 *  - NEXT_PUBLIC_INQUIRY_WEBHOOK_SECRET을 클라이언트에 노출하지 않음
 *  - 보안: 클라이언트는 인증 없이 호출 가능하지만, 서버는 서명 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { buildInquiryTracking, extractInquiryIp } from '@/lib/inquiry-tracking';

interface InquiryPayload {
  phone: string;
  name: string;
  email: string | null;
  affiliateCode: string | null;
  inquiryType: string;
  message: string;
  submittedAt: string;
  organizationId: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  source?: string | null;
  productName?: string | null;
  productCode?: string | null;
  isGold?: boolean | null;
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MABIZ_INQUIRY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('[webhook-proxy] MABIZ_INQUIRY_WEBHOOK_SECRET is required');
      return NextResponse.json(
        { ok: false, error: 'Server configuration error' },
        { status: 503 }
      );
    }

    // HMAC 서명 검증
    const bodyText = await req.text();
    const signature = req.headers.get('x-mabiz-signature') ?? '';
    const expected = createHmac('sha256', secret).update(bodyText).digest('hex');
    let sigValid = false;
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      sigValid = sigBuf.byteLength === expBuf.byteLength && timingSafeEqual(sigBuf, expBuf);
    } catch { sigValid = false; }

    if (!sigValid) {
      logger.warn('[webhook-proxy] HMAC 서명 불일치');
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
    }

    let payload: InquiryPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    const requestIp = extractInquiryIp(req.headers);
    const tracking = buildInquiryTracking({
      source: payload.source,
      productName: payload.productName,
      productCode: payload.productCode,
      pageUrl: payload.pageUrl,
      userAgent: payload.userAgent ?? req.headers.get('user-agent'),
      deviceType: payload.deviceType,
      ip: requestIp,
      isGold: payload.isGold,
      submittedAt: payload.submittedAt,
    });
    const sourceType = payload.isGold ? 'gold_member' : 'landing_page';

    // 필드 검증
    if (!payload.phone || !payload.name || !payload.organizationId) {
      logger.warn('[webhook-proxy] Missing required fields', {
        hasPhone: !!payload.phone,
        hasName: !!payload.name,
        hasOrgId: !!payload.organizationId
      });
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const existingContact = await prisma.contact.findUnique({
      where: {
        phone_organizationId: {
          phone: payload.phone,
          organizationId: payload.organizationId,
        },
      },
      select: {
        surveyData: true,
      },
    });
    const existingSurveyData =
      existingContact?.surveyData &&
      typeof existingContact.surveyData === 'object' &&
      !Array.isArray(existingContact.surveyData)
        ? existingContact.surveyData
        : {};

    // Contact 조회 또는 생성
    const contact = await prisma.contact.upsert({
      where: {
        phone_organizationId: {
          phone: payload.phone,
          organizationId: payload.organizationId,
        },
      },
      update: {
        name: payload.name,
        email: payload.email ?? undefined,
        affiliateCode: payload.affiliateCode ?? undefined,
        lastContactedAt: new Date(),
        sourceType,
        inquiryProductCode: payload.productCode ?? undefined,
        productName: payload.productName ?? undefined,
        surveyData: {
          ...existingSurveyData,
          inquiryTracking: tracking,
        },
      },
      create: {
        phone: payload.phone,
        name: payload.name,
        email: payload.email ?? null,
        organizationId: payload.organizationId,
        affiliateCode: payload.affiliateCode ?? null,
        sourceType,
        inquiryProductCode: payload.productCode ?? null,
        productName: payload.productName ?? null,
        surveyData: { inquiryTracking: tracking },
        lastContactedAt: new Date(),
      },
    });

    // ContactMemo에 문의 내용 저장
    await prisma.contactMemo.create({
      data: {
        contactId: contact.id,
        userId: 'system',
        content: `[Loop5 문의] 유형: ${payload.inquiryType}\n${payload.message || ''}`.trim(),
      },
    });

    logger.log('[webhook-proxy] Inquiry received and verified', {
      phone: payload.phone.replace(/\d(?=\d{4})/g, '*'),
      name: payload.name,
      organizationId: payload.organizationId,
      inquiryType: payload.inquiryType
    });

    return NextResponse.json({ ok: true, contactId: contact.id }, { status: 200 });
  } catch (error) {
    logger.error('[webhook-proxy] Request processing error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
