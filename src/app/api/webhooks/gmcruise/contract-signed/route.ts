export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/gmcruise/contract-signed
 *
 * GMcruise(크루즈닷몰)에서 파트너 계약서 서명 완료 시 호출하는 웹훅.
 * 수신 시:
 *   1. HMAC-SHA256 서명 검증
 *   2. Organization 자동 생성 (또는 기존 조직 반환 — idempotent)
 *   3. GLOBAL_ADMIN 이메일 알림 (jmonica@cruisedot.co.kr)
 *
 * 환경변수:
 *   PARTNER_CONTRACT_WEBHOOK_SECRET — GMcruise와 공유하는 HMAC 시크릿
 *   GLOBAL_ADMIN_NOTIFY_EMAIL       — 알림 수신 이메일
 *   NEXT_PUBLIC_APP_URL             — CRM 도메인
 *
 * 요청 헤더 (GMcruise 측 전송):
 *   Content-Type: application/json
 *   X-Signature:  sha256=<hmac-hex>      (rawBody 기준)
 *   X-Timestamp:  <unix-ms>              (재전송 방지 ±5분)
 *
 * 요청 바디:
 * {
 *   contractRef:  string;   // GMcruise 내부 계약 ID (idempotency key)
 *   ownerName:    string;   // 대리점장 이름
 *   ownerPhone:   string;   // 대리점장 전화번호
 *   ownerEmail?:  string;   // 대리점장 이메일 (선택)
 *   orgName:      string;   // 대리점명
 *   signedAt:     string;   // 서명 완료 시각 (ISO8601)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyGmcruiseWebhook } from '@/lib/webhook-verify';
import { findOrCreateOrganization } from '@/lib/organization';
import { sendSystemEmail, COMPANY_EMAIL } from '@/lib/system-email';
import { renderNewOrgEmail } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { recordProcessedWebhookEvent } from '@/lib/webhook-execution';

interface ContractSignedPayload {
  contractRef:  string;
  ownerName:    string;
  ownerPhone:   string;
  ownerEmail?:  string;
  orgName:      string;
  signedAt:     string;
  eventId?:     string;
}

export async function POST(req: NextRequest) {
  // ── 1. 환경변수 확인 ────────────────────────────────────────────────
  const secret = process.env.PARTNER_CONTRACT_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[ContractSignedWebhook] PARTNER_CONTRACT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // ── 2. Raw body 읽기 (서명 검증 전 반드시 buffer로) ─────────────────
  const rawBody = Buffer.from(await req.arrayBuffer());

  // ── 3. HMAC-SHA256 서명 검증 ────────────────────────────────────────
  const sigHdr = req.headers.get('X-Signature') ?? req.headers.get('x-signature');
  const tsHdr  = req.headers.get('X-Timestamp') ?? req.headers.get('x-timestamp');

  const verification = verifyGmcruiseWebhook(rawBody, sigHdr, tsHdr, secret);
  if (!verification.ok) {
    logger.error('[ContractSignedWebhook] 서명 검증 실패', { reason: verification.reason });
    return NextResponse.json({ ok: false, reason: verification.reason }, { status: 401 });
  }

  // ── 4. 페이로드 파싱 ────────────────────────────────────────────────
  let payload: ContractSignedPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf-8')) as ContractSignedPayload;
  } catch {
    return NextResponse.json({ ok: false, message: '페이로드 파싱 실패' }, { status: 400 });
  }

  const { contractRef, ownerName, ownerPhone, ownerEmail, orgName, signedAt, eventId } = payload;

  if (!contractRef || !ownerName || !ownerPhone || !orgName || !eventId) {
    return NextResponse.json(
      { ok: false, message: 'contractRef, ownerName, ownerPhone, orgName 필수' },
      { status: 400 }
    );
  }

  // ── 5-0. eventId 멱등성 체크 ────────────────────────────────────────
  const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
    where: {
      eventId_webhookType: {
        eventId,
        webhookType: 'gmcruise-contract-signed',
      },
    },
    select: { eventId: true },
  });
  if (alreadyProcessed) {
    logger.log('[ContractSignedWebhook] 중복 이벤트 무시', { eventId });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // ── 5. Organization 생성 (idempotent) ──────────────────────────────
  let result: Awaited<ReturnType<typeof findOrCreateOrganization>>;
  try {
    result = await findOrCreateOrganization({
      name:         orgName,
      ownerName,
      ownerPhone,
      ownerEmail,
      contractRef,
      source:       'webhook',
    });
  } catch (err) {
    logger.error('[ContractSignedWebhook] Organization 생성 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // ── 6. GLOBAL_ADMIN 이메일 알림 (비차단) ───────────────────────────
  if (result.created) {
    const createdAt = new Date(signedAt).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const { subject, html } = renderNewOrgEmail({
      orgName,
      orgId:       result.organization.id,
      ownerName,
      ownerPhone:  ownerPhone.slice(0, 3) + '****' + ownerPhone.replace(/[^0-9]/g, '').slice(-4),
      contractRef,
      createdAt,
      crmUrl:      process.env.NEXT_PUBLIC_APP_URL ?? '',
    });

    sendSystemEmail({ to: COMPANY_EMAIL, subject, html }).catch((e: unknown) =>
      logger.error('[ContractSignedWebhook] GLOBAL_ADMIN 알림 실패', { e })
    );
  }

  if (eventId) {
    await recordProcessedWebhookEvent(prisma, {
      eventId,
      webhookType: 'gmcruise-contract-signed',
      context: '[ContractSignedWebhook] SUCCESS 기록 실패',
    });
  }

  logger.warn('[ContractSignedWebhook] 처리 완료', {
    contractRef,
    orgId:   result.organization.id,
    created: result.created,
  });

  return NextResponse.json({
    ok:      true,
    orgId:   result.organization.id,
    orgName: result.organization.name,
    created: result.created,
  });
}
