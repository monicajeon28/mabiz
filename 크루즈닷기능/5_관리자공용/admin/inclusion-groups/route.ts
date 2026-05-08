export const dynamic = 'force-dynamic';

// app/api/admin/inclusion-groups/route.ts
// 포함/불포함 세트 그룹 관리 API (Prisma DB 저장소)

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfFromRequest } from '@/lib/api-middleware';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { ADMIN_ERRORS } from '@/lib/constants/admin-errors';
import { inclusionSetArraySchema, inclusionSetSchema, type InclusionSet } from '@/lib/schemas/inclusionSet';

// POST 입력 검증 스키마 (id, createdAt은 선택사항)
const createInclusionSetSchema = inclusionSetSchema
  .pick({ name: true, includes: true, excludes: true })
  .extend({
    id: z.string().optional(),
    createdAt: z.string().datetime().optional(),
  });

// DELETE 입력 검증 스키마
const deleteInclusionSetSchema = z.object({
  setId: z.string().min(1, 'setId is required'),
});

// GET: 모든 세트 조회
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    const groups = await prisma.inclusionExclusionGroup.findMany({
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        includes: true,
        excludes: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      ok: true,
      sets: groups.map(g => ({
        id: g.id.toString(),
        name: g.name,
        description: g.description,
        includes: Array.isArray(g.includes) ? g.includes : [],
        excludes: Array.isArray(g.excludes) ? g.excludes : [],
        createdAt: g.createdAt.toISOString()
      }))
    });
  } catch (error: any) {
    logger.error('[Inclusion Groups API] GET error:', { error: String(error) });
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_FETCH },
      { status: 500 }
    );
  }
}

// POST: 새 세트 저장
export async function POST(req: NextRequest) {
  try {
    const authResult = await checkAdminAuth();
    if (!authResult.isAdmin || !authResult.user) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const cookieStore = await cookies();
    const csrfTokenFromCookie = cookieStore.get('csrf-token')?.value;
    const csrfTokenFromHeader = req.headers.get('x-csrf-token');
    if (!validateCsrfToken(csrfTokenFromCookie, csrfTokenFromHeader)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_CSRF }, { status: 403 });
    }

    const body = await req.json();

    // Zod 검증 (id, createdAt, description은 제외)
    const bodySchema = z.object({
      name: z.string().min(1).max(50),
      includes: z.array(z.string().min(1).max(100)),
      excludes: z.array(z.string().min(1).max(100))
    });
    const parsed = bodySchema.parse(body);

    // Prisma로 DB에 저장
    const group = await prisma.inclusionExclusionGroup.create({
      data: {
        name: parsed.name,
        includes: parsed.includes,
        excludes: parsed.excludes,
        adminId: authResult.user.id
      }
    });

    return NextResponse.json({
      ok: true,
      set: {
        id: group.id.toString(),
        name: group.name,
        includes: Array.isArray(group.includes) ? group.includes : [],
        excludes: Array.isArray(group.excludes) ? group.excludes : [],
        createdAt: group.createdAt.toISOString()
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.error('[Inclusion Groups API] Validation error:', { errors: error.errors });
      return NextResponse.json(
        { ok: false, error: ADMIN_ERRORS.INVALID_INPUT },
        { status: 400 }
      );
    }
    logger.error('[Inclusion Groups API] POST error:', { error: String(error) });
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_SAVE },
      { status: 500 }
    );
  }
}

// DELETE: 특정 세트 삭제
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await checkAdminAuth();
    if (!authResult.isAdmin || !authResult.user) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    if (!await validateCsrfFromRequest(req)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_CSRF }, { status: 403 });
    }

    const body = await req.json();

    // Zod 검증
    const parsed = deleteInclusionSetSchema.parse(body);

    // setId를 정수로 변환
    const groupId = parseInt(parsed.setId, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_INPUT }, { status: 400 });
    }

    // Prisma로 DB에서 삭제 (IDOR 방지: 본인이 생성한 것만 삭제 가능)
    await prisma.inclusionExclusionGroup.delete({
      where: {
        id: groupId,
        adminId: authResult.user.id
      }
    });

    return NextResponse.json({
      ok: true,
      message: 'Set deleted successfully'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.error('[Inclusion Groups API] Validation error:', { errors: error.errors });
      return NextResponse.json(
        { ok: false, error: ADMIN_ERRORS.INVALID_INPUT },
        { status: 400 }
      );
    }
    logger.error('[Inclusion Groups API] DELETE error:', { error: String(error) });
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_DELETE },
      { status: 500 }
    );
  }
}
