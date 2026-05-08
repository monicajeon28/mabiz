/**
 * B-1: POST /api/admin/gold-members/[id]/generate-code
 * 관리자가 골드회원을 위한 멤버십 코드 생성
 *
 * 요구사항:
 * - generateMembershipCode() 호출로 6자 코드 생성
 * - goldMemberId로 GoldMember 찾기
 * - $transaction으로 코드 저장 + GoldMember.membershipCode 업데이트
 * - Zod 검증 (invalidateExisting 선택)
 * - CSRF 검증 (validateCsrfFromRequest)
 * - 로깅 (debug, error)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAdminAuth } from '@/lib/auth';
import { validateCsrfToken } from '@/lib/csrf';
import { generateMembershipCode, getCodeExpiresAt } from '@/lib/gold-membership';
import { generateCodeRequestSchema } from '@/lib/schemas/goldMemberSchema';

/**
 * CSRF 토큰 검증 (로컬 함수)
 */
function validateCsrfTokenFromRequest(req: NextRequest): boolean {
  const cookies = req.cookies;
  const sessionToken = cookies.get('csrf-token')?.value;
  const requestToken = req.headers.get('x-csrf-token');

  if (!sessionToken || !requestToken) {
    return false;
  }

  return validateCsrfToken(sessionToken, requestToken);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 관리자 권한 확인
    const admin = await requireAdminAuth();

    // 2. CSRF 검증
    if (!validateCsrfTokenFromRequest(req)) {
      logger.debug('[GoldMember API] CSRF validation failed on POST', {
        adminId: admin.id,
      });
      return NextResponse.json(
        { ok: false, message: 'CSRF validation failed', code: 'CSRF_INVALID' },
        { status: 403 }
      );
    }

    // 3. 요청 파싱 및 검증
    const body = await req.json();
    const goldMemberId = parseInt(params.id, 10);

    if (isNaN(goldMemberId)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid gold member ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const validatedData = generateCodeRequestSchema.parse({
      goldMemberId,
      invalidateExisting: body.invalidateExisting ?? false,
    });

    // 4. GoldMember 조회
    const goldMember = await prisma.goldMember.findUnique({
      where: { id: validatedData.goldMemberId },
      select: { id: true, name: true, deletedAt: true },
    });

    if (!goldMember || goldMember.deletedAt) {
      logger.warn('[GoldMember API] GoldMember not found or deleted', {
        adminId: admin.id,
        goldMemberId: validatedData.goldMemberId,
      });
      return NextResponse.json(
        { ok: false, message: 'Gold member not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 5. 트랜잭션: 코드 생성 + GoldMember 업데이트
    const code = generateMembershipCode();
    const expiresAt = getCodeExpiresAt();

    const result = await prisma.$transaction(async (tx) => {
      // 기존 활성 코드 무효화 (선택)
      if (validatedData.invalidateExisting && goldMember.id) {
        await tx.goldMembershipCode.updateMany({
          where: {
            goldMemberId: validatedData.goldMemberId,
            isUsed: false,
          },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });
      }

      // 새 코드 생성
      const newCode = await tx.goldMembershipCode.create({
        data: {
          goldMemberId: validatedData.goldMemberId,
          code,
          createdById: admin.id,
          expiresAt,
        },
      });

      // GoldMember.membershipCode 업데이트
      const updated = await tx.goldMember.update({
        where: { id: validatedData.goldMemberId },
        data: { membershipCode: code },
        select: { id: true, name: true, membershipCode: true },
      });

      return { code: newCode, goldMember: updated };
    });

    logger.debug('[GoldMember API] Membership code generated', {
      adminId: admin.id,
      goldMemberId: validatedData.goldMemberId,
      goldMemberName: goldMember.name,
      code: code.substring(0, 3) + '***', // 마스킹
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          code: result.code.code,
          expiresAt: result.code.expiresAt,
          goldMemberId: result.goldMember.id,
          goldMemberName: result.goldMember.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    logger.error('[GoldMember API] POST /admin/gold-members/[id]/generate-code error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, message: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
