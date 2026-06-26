/**
 * POST /api/documents/[id]/send-contract-sms
 * 계약서 공개 서명링크(/contract/sign/[docId]?token=...)를 고객에게 문자(SMS)로 발송.
 *
 * - buyerEmail 이 없어 이메일 전달이 불가능한 건도 휴대폰 번호만 있으면 문자로 전달 가능.
 * - 발신은 로그인 본인 Aligo 설정(개인 > 조직 > env, resolveUserSmsConfig).
 * - 멀티테넌트 조직격리 + per-user(AGENT/FREE_SALES 본인 발급건만) 격리.
 * - 기존 이메일 발송 경로는 그대로 두고, 문자/링크복사 보조 채널을 추가하는 목적.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { checkOrigin } from '@/lib/origin-guard';
import { resolveUserSmsConfig, sendSms } from '@/lib/aligo';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// 휴대폰 번호 정규화 (하이픈/공백 제거)
function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

export async function POST(req: Request, { params }: Params) {
  try {
    if (!checkOrigin(req, 'ContractSendSms')) {
      return NextResponse.json({ ok: false, message: '잘못된 접근입니다.' }, { status: 403 });
    }

    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const body = await req.json().catch(() => null);
    // 담당자가 직접 입력한 수신 번호(선택). 없으면 발급 시 저장된 buyerTel 사용.
    const overridePhone = typeof body?.phone === 'string' ? body.phone.trim() : '';

    const doc = await prisma.salesDocument.findFirst({
      where: { id, organizationId: orgId, documentType: 'PURCHASE_CONTRACT' },
      select: { id: true, createdBy: true, generatedData: true },
    });
    if (!doc) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // per-user 격리: AGENT 는 본인이 발급한 계약서만 문자 발송 가능
    if (ctx.role === 'AGENT' && doc.createdBy !== ctx.userId) {
      return NextResponse.json({ ok: false, message: '본인이 발급한 계약서만 발송할 수 있습니다.' }, { status: 403 });
    }

    const gd = (doc.generatedData ?? {}) as Record<string, unknown>;
    const signToken = typeof gd.signToken === 'string' ? gd.signToken : '';
    if (!signToken) {
      return NextResponse.json({ ok: false, message: '이 계약서에는 서명 링크가 없습니다.' }, { status: 400 });
    }

    // 서명 링크 만료 확인
    const expRaw = typeof gd.signTokenExpiresAt === 'string' ? gd.signTokenExpiresAt : null;
    if (expRaw) {
      const exp = new Date(expRaw);
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return NextResponse.json(
          { ok: false, message: '서명 링크 유효기간(7일)이 지났습니다. 계약서를 다시 발급해주세요.' },
          { status: 400 },
        );
      }
    }

    const buyerName = typeof gd.buyerName === 'string' ? gd.buyerName : '';
    const productName = typeof gd.productName === 'string' ? gd.productName : '크루즈 상품';
    const storedTel = typeof gd.buyerTel === 'string' ? gd.buyerTel : '';

    const targetPhoneRaw = overridePhone || storedTel;
    const targetPhone = normalizePhone(targetPhoneRaw);
    if (!targetPhone || targetPhone.length < 9) {
      return NextResponse.json(
        { ok: false, message: '받는 분 휴대폰 번호가 없어요. 번호를 입력해주세요.' },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mabizcruisedot.com';
    const signUrl = `${appUrl}/contract/sign/${doc.id}?token=${signToken}`;

    // 50대 친화 문자 본문 (간결·한글). 링크 7일 유효 안내 포함.
    const greeting = buyerName ? `${buyerName}님, ` : '';
    const msg =
      `[크루즈닷] ${greeting}여행계약서 서명을 요청드립니다.\n` +
      `상품: ${productName}\n` +
      `아래 링크에서 내용 확인 후 서명해주세요 (7일 이내).\n${signUrl}`;

    const config = await resolveUserSmsConfig(orgId, ctx.userId); // 발신: 본인 설정
    if (!config) {
      return NextResponse.json(
        { ok: false, message: '문자 발신 설정이 없어요. 설정 > 문자에서 발신번호를 등록해주세요.' },
        { status: 400 },
      );
    }

    // after / try-catch: 발송 실패가 응답 전체를 깨지 않도록 방어
    let ok = false;
    try {
      const res = await sendSms({
        config,
        receiver: targetPhone,
        msg,
        title: '계약서 서명 요청',
        msgType: 'LMS',
        organizationId: orgId,
        channel: 'MANUAL',
      });
      ok = (res.result_code ?? -1) > 0;
      logger.log('[POST /api/documents/[id]/send-contract-sms]', { docId: id, ok, code: res.result_code });
    } catch (sendErr) {
      logger.error('[POST /api/documents/[id]/send-contract-sms] send 실패', {
        docId: id,
        err: sendErr instanceof Error ? sendErr.message : String(sendErr),
      });
      ok = false;
    }

    return NextResponse.json(
      {
        ok,
        message: ok ? '계약서 서명 링크를 문자로 보냈어요.' : '문자 발송에 실패했어요. 잠시 후 다시 시도해주세요.',
        signUrl, // 클립보드 복사 폴백용으로 응답에 포함
      },
      { status: ok ? 200 : 502 },
    );
  } catch (err) {
    logger.error('[POST /api/documents/[id]/send-contract-sms]', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, message: '발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
