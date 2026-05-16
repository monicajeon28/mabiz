export const dynamic = 'force-dynamic';

/**
 * POST /api/affiliate/contracts/send-email-token
 *
 * 이메일 검증 PIN 토큰 발송
 * - 신청 단계에서 이메일 소유권 검증
 * - 6자리 PIN 생성 및 이메일로 발송
 * - 5분 유효기간
 *
 * 요청:
 * { "email": "test@example.com" }
 *
 * 응답:
 * { "ok": true, "message": "인증번호를 이메일로 발송했습니다." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';

interface EmailTokenRecord {
  email: string;
  pin: string;
  token: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  verified: boolean;
}

// 메모리 저장소 (프로덕션에서는 Redis 또는 DB 사용 권장)
const tokenStore = new Map<string, EmailTokenRecord>();

// 5분 유효기간
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function generatePIN(): string {
  return String(randomInt(100000, 999999));
}

function generateToken(): string {
  return `et_${Date.now()}_${randomInt(100000, 999999)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string | undefined = typeof body.email === 'string' ? body.email.trim() : undefined;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { ok: false, message: '유효한 이메일을 입력해 주세요.' },
        { status: 400 },
      );
    }

    // 이메일 도메인 기본 검증
    const domainRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!domainRegex.test(email)) {
      return NextResponse.json(
        { ok: false, message: '유효한 이메일 형식이 아닙니다.' },
        { status: 400 },
      );
    }

    // 1분 내 재발송 제한 (같은 이메일)
    const existing = tokenStore.get(email);
    if (existing && existing.expiresAt.getTime() > Date.now() - 60000) {
      return NextResponse.json(
        { ok: false, message: '1분 후 다시 시도해 주세요.' },
        { status: 429 },
      );
    }

    // PIN 생성 및 저장
    const pin = generatePIN();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    tokenStore.set(email, {
      email,
      pin,
      token,
      expiresAt,
      attempts: 0,
      verified: false,
      createdAt: new Date(),
    });

    // 이메일 발송
    try {
      const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>이메일 인증</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1e3a5f;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                🚢 크루즈닷 CRM
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">
                이메일 인증
              </h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
                아래의 인증번호를 입력하여 이메일 소유권을 확인하세요.
              </p>

              <div style="background:#f0f7ff;border-radius:10px;padding:24px;margin:24px 0;text-align:center;">
                <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">인증번호</p>
                <p style="margin:0;color:#1e3a5f;font-size:32px;font-weight:700;letter-spacing:4px;">
                  ${pin}
                </p>
              </div>

              <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">
                • 이 인증번호는 5분간 유효합니다.<br />
                • 본인이 요청하지 않은 경우 무시하세요.<br />
                • 이메일을 공유하지 마세요.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f9fb;padding:20px 32px;border-top:1px solid #e8eaed;">
              <p style="margin:0;color:#9aa0a6;font-size:12px;line-height:1.6;">
                이 메일은 크루즈닷 CRM 시스템에서 자동 발송되었습니다.<br />
                문의: <a href="mailto:jmonica@cruisedot.co.kr" style="color:#1e3a5f;">jmonica@cruisedot.co.kr</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      // 크루즈닷 기본 조직으로 이메일 발송
      const bonusaOrgId = process.env.BONSA_ORG_ID || '';
      if (bonusaOrgId) {
        await sendFunnelEmail({
          organizationId: bonusaOrgId,
          toEmail: email,
          subject: '[크루즈닷] 이메일 인증번호: ' + pin,
          htmlContent,
        });
      } else {
        logger.warn('[EMAIL-TOKEN] BONSA_ORG_ID 미설정 — 이메일 미발송', { email });
      }
    } catch (emailErr) {
      logger.warn('[EMAIL-TOKEN] 이메일 발송 실패', {
        email,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
      // 이메일 발송 실패해도 token 반환 (일단 로컬에는 저장됨)
    }

    logger.info('[EMAIL-TOKEN] PIN 토큰 생성', { email, expiresAt });

    return NextResponse.json({
      ok: true,
      message: '인증번호를 이메일로 발송했습니다.',
      data: { token, expiresAt },
    });
  } catch (err) {
    logger.error('[EMAIL-TOKEN] 토큰 발송 실패', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, message: '인증번호 발송 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

// 토큰 검증 함수 (외부에서 임포트 가능)
export function verifyEmailToken(email: string, pinInput: string): boolean {
  const record = tokenStore.get(email);

  if (!record) {
    return false;
  }

  if (record.expiresAt.getTime() < Date.now()) {
    tokenStore.delete(email);
    return false;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    tokenStore.delete(email);
    return false;
  }

  record.attempts++;

  if (record.pin === pinInput) {
    record.verified = true;
    return true;
  }

  return false;
}

// 토큰 정리 함수
export function clearEmailToken(email: string): void {
  tokenStore.delete(email);
}
