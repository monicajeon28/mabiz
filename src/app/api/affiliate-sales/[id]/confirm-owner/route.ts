export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { sendPurchaseConfirm } from '@/lib/affiliate/notify-cruisedot-purchase-confirm';

/**
 * POST /api/affiliate-sales/[id]/confirm-owner
 * 대리점장 구매확인 — 수당귀속(PRESALES | BRANCH_MANAGER)을 확정하고 몰로 발신한다.
 *
 * 돈+외부발신 안전장치:
 *  - 권한: OWNER(자기 조직 managerId 건만) / GLOBAL_ADMIN. AGENT/FREE_SALES 금지.
 *  - 원자 claim(WHERE commissionOwnerConfirmed=false RETURNING) → 0행이면 409 (중복발신·중복차감 차단).
 *  - claim 성공 후 발신, 발신 실패 시 claim 롤백(확정 해제) → 운영자 재시도 가능(은폐 방지).
 *  - 몰은 eventId로 멱등, 409=멱등성공으로 처리.
 *  - secret 미설정 시 확정 거부(조용한 스킵 금지).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    // 대리점장(OWNER) 또는 본사(GLOBAL_ADMIN)만 확정 가능
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '구매확인 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const saleId = parseInt(id, 10);
    if (!saleId || isNaN(saleId) || saleId <= 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 판매 ID' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { ownerType?: unknown };
    const ownerType = body.ownerType;
    if (ownerType !== 'PRESALES' && ownerType !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: "ownerType은 'PRESALES' 또는 'BRANCH_MANAGER'여야 합니다." }, { status: 400 });
    }

    // 발신 시크릿 없으면 확정 자체를 거부 (돈 발신 — 조용한 스킵 금지)
    if (!process.env.CRUISEDOT_WEBHOOK_SECRET) {
      logger.error('[confirm-owner] CRUISEDOT_WEBHOOK_SECRET 미설정 — 확정 거부', { saleId });
      return NextResponse.json({ ok: false, error: '발신 설정이 누락되어 확정할 수 없습니다.' }, { status: 503 });
    }

    const confirmerProfileId = ctx.mallUser?.affiliateProfileId ?? null;
    if (ctx.role === 'OWNER' && !confirmerProfileId) {
      return NextResponse.json({ ok: false, error: '대리점 프로필 정보가 없습니다.' }, { status: 403 });
    }

    // OWNER는 자기 조직(managerId) 건만 — IDOR 차단
    const scopeSql = ctx.role === 'OWNER'
      ? Prisma.sql`AND "managerId" = ${confirmerProfileId}`
      : Prisma.empty;

    // ── 원자 claim: 아직 미확정 + 정상상태 건만 잡는다. 0행이면 409(이미확정/범위밖/환불) ──
    const claimed = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE "AffiliateSale"
      SET "commissionOwnerType"      = ${ownerType},
          "confirmedOwnerById"       = ${confirmerProfileId},
          "confirmedOwnerAt"         = NOW(),
          "commissionOwnerConfirmed" = true
      WHERE id = ${saleId}
        AND "commissionOwnerConfirmed" = false
        AND status NOT IN ('REFUNDED', 'CANCELLED', 'REJECTED')
        ${scopeSql}
      RETURNING id
    `);
    if (claimed.length === 0) {
      return NextResponse.json(
        { ok: false, error: '이미 확정되었거나 확정할 수 없는(환불·취소·권한밖) 건입니다.' },
        { status: 409 }
      );
    }

    // ── 몰로 발신 (claim 성공 후에만) ──
    const eventId = randomUUID();
    try {
      await sendPurchaseConfirm({
        eventId,
        eventType: 'purchase.confirmed',
        saleId,
        ownerType,
        confirmedBy: confirmerProfileId ?? undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (sendErr) {
      // 발신 실패 → claim 롤백(확정 해제). 우리가 방금 잡은 건만 되돌린다.
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "AffiliateSale"
        SET "commissionOwnerConfirmed" = false,
            "commissionOwnerType"      = NULL,
            "confirmedOwnerById"       = NULL,
            "confirmedOwnerAt"         = NULL
        WHERE id = ${saleId} AND "commissionOwnerConfirmed" = true
      `).catch((rbErr) => logger.error('[confirm-owner] 롤백 실패', { saleId, rbErr: String(rbErr) }));
      logger.error('[confirm-owner] 발신 실패 → 확정 해제', {
        saleId, error: sendErr instanceof Error ? sendErr.message : String(sendErr),
      });
      return NextResponse.json(
        { ok: false, error: '크루즈닷몰 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 502 }
      );
    }

    logger.log('[confirm-owner] 확정 완료', { saleId, ownerType, by: confirmerProfileId, role: ctx.role });
    return NextResponse.json({ ok: true, saleId, ownerType });
  } catch (err) {
    logger.error('[confirm-owner] 오류', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
