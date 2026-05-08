export const dynamic = 'force-dynamic';

// app/api/admin/refund-policy-groups/route.ts
// 환불/취소 규정 그룹 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfFromRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { ADMIN_ERRORS } from '@/lib/constants/admin-errors';

// POST 입력 검증 스키마
const createRefundPolicyGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().nullable(),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or less'),
});

// GET: 그룹 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    const groups = await prisma.refundPolicyGroup.findMany({
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true
      }
    });

    const total = await prisma.refundPolicyGroup.count();

    return NextResponse.json({
      ok: true,
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        createdAt: g.createdAt.toISOString()
      })),
      total,
      hasMore: offset + limit < total
    });
  } catch (error: any) {
    logger.error('[Refund Policy Groups API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_FETCH },
      { status: 500 }
    );
  }
}

// POST: 새 그룹 저장
export async function POST(req: NextRequest) {
  try {
    const { user: adminUser, isAdmin } = await checkAdminAuth();
    if (!isAdmin || !adminUser) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    if (!await validateCsrfFromRequest(req)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_CSRF }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createRefundPolicyGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: ADMIN_ERRORS.INVALID_INPUT, details: parsed.error.errors },
        { status: 400 }
      );
    }

    const group = await prisma.refundPolicyGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        content: parsed.data.content,
        adminId: adminUser.id,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt.toISOString()
      }
    });
  } catch (error: any) {
    logger.error('[Refund Policy Groups API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_SAVE },
      { status: 500 }
    );
  }
}
