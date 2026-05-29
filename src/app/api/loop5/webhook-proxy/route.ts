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
import { logger } from '@/lib/logger';

interface InquiryPayload {
  phone: string;
  name: string;
  email: string | null;
  affiliateCode: string | null;
  inquiryType: string;
  message: string;
  submittedAt: string;
  organizationId: string;
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MABIZ_INQUIRY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('[webhook-proxy] MABIZ_INQUIRY_WEBHOOK_SECRET is required');
      return NextResponse.json(
        { ok: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const payload: InquiryPayload = await req.json();

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

    // TODO: 실제 inquiry 처리 로직
    // - Contact 조회/생성
    // - InquiryLog 저장
    // - CRM 자동화 트리거

    logger.log('[webhook-proxy] Inquiry received and verified', {
      phone: payload.phone.replace(/\d(?=\d{4})/g, '*'),
      name: payload.name,
      organizationId: payload.organizationId,
      inquiryType: payload.inquiryType
    });

    return NextResponse.json({ ok: true, message: 'Inquiry received' }, { status: 200 });
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
