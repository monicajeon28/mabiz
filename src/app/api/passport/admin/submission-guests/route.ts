export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { toKstDateString } from '@/lib/passport-date';

// ── 타입 정의 ───────────────────────────────────────────────────

export interface SubmissionGuestItem {
  id: number;
  groupNumber: number;
  name: string;
  nationality: string | null;
  /** 마스킹된 여권번호: M****678 형식 */
  passportNumber: string | null;
  dateOfBirth: string | null;       // YYYY-MM-DD (KST)
  passportExpiryDate: string | null; // YYYY-MM-DD (KST)
}

export interface SubmissionGuestsResponse {
  ok: true;
  submittedAt: string | null;
  guests: SubmissionGuestItem[];
}

// ── 여권번호 마스킹 ─────────────────────────────────────────────
/**
 * 여권번호를 마스킹합니다.
 * 예) M12345678 → M****678  (앞 1자 + **** + 뒤 3자)
 * 길이가 5자 미만이면 전체를 *로 대체합니다.
 */
function maskPassportNumber(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.length < 5) return '****';
  const prefix = s.slice(0, 1);
  const suffix = s.slice(-3);
  return `${prefix}****${suffix}`;
}

// UTC DateTime → KST YYYY-MM-DD 는 공용 헬퍼 toKstDateString(@/lib/passport-date) 사용

/**
 * GET /api/passport/admin/submission-guests?userId=123
 *
 * 해당 userId의 최신 PassportSubmission에 속한 게스트 목록을 반환합니다.
 * 권한: GLOBAL_ADMIN + OWNER (requireCrmManager)
 * - OWNER: 자신의 organizationId 소속 고객만 조회 가능 (AffiliateSale 경유 테넌트 격리)
 * - 여권번호는 마스킹하여 반환 (M****678)
 */
export async function GET(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId');
    const userId = userIdParam ? parseInt(userIdParam, 10) : NaN;

    if (!userId || isNaN(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, message: 'userId가 필요합니다.' }, { status: 400 });
    }

    // ── OWNER 테넌트 격리 ───────────────────────────────────────
    if (manager.role === 'OWNER') {
      if (!manager.organizationId) {
        // organizationId 없는 OWNER는 접근 불가 (보안 기본값)
        return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
      }
      const accessCheck = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*) AS cnt
        FROM "User" u
        JOIN "CrmAffiliateSale" af ON REGEXP_REPLACE(af."customerPhone", '[^0-9]', '', 'g')
            = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
        WHERE u.id = ${userId}
          AND af."organizationId" = ${manager.organizationId}
      `;
      const cnt = Number(accessCheck[0]?.cnt ?? 0);
      if (cnt === 0) {
        return NextResponse.json({ ok: true, submittedAt: null, guests: [] } satisfies SubmissionGuestsResponse);
      }
    }

    // ── 최신 제출된 PassportSubmission 조회 ──────────────────────
    const submission = await prisma.gmPassportSubmission.findFirst({
      where: {
        userId,
        isSubmitted: true,
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        submittedAt: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ ok: true, submittedAt: null, guests: [] } satisfies SubmissionGuestsResponse);
    }

    // ── 게스트 목록 조회 (groupNumber ASC, id ASC 순) ────────────
    const rawGuests = await prisma.gmPassportSubmissionGuest.findMany({
      where: { submissionId: submission.id },
      orderBy: [
        { groupNumber: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        groupNumber: true,
        name: true,
        nationality: true,
        passportNumber: true,
        dateOfBirth: true,
        passportExpiryDate: true,
      },
    });

    const guests: SubmissionGuestItem[] = rawGuests.map(g => ({
      id: g.id,
      groupNumber: g.groupNumber,
      name: g.name,
      nationality: g.nationality,
      passportNumber: maskPassportNumber(g.passportNumber),
      dateOfBirth: toKstDateString(g.dateOfBirth),
      passportExpiryDate: toKstDateString(g.passportExpiryDate),
    }));

    return NextResponse.json({
      ok: true,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      guests,
    } satisfies SubmissionGuestsResponse);

  } catch (error) {
    logger.error('[submission-guests] GET 실패', { error });
    return NextResponse.json(
      { ok: false, message: '탑승자 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
