'use client';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';

/**
 * GET /api/b2b-landing/categories
 * 카테고리 목록 조회 (사용 페이지 수 포함)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: '로그인 필요' }, { status: 401 });
    }

    const orgId = req.nextUrl.searchParams.get('orgId');
    if (!orgId) {
      return Response.json({ ok: false, message: 'orgId 필수' }, { status: 400 });
    }

    // 권한 확인: AGENT 이상
    const member = await db.organizationMember.findFirst({
      where: { organizationId: orgId, userId: session.user.id },
    });

    if (!member || !['OWNER', 'MANAGER', 'AGENT', 'GLOBAL_ADMIN'].includes(member.role)) {
      return Response.json({ ok: false, message: '권한 없음' }, { status: 403 });
    }

    // 1. 카테고리 목록 조회
    const categories = await db.b2BLandingCategory.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });

    // 2. 각 카테고리별 활성 페이지 수 계산
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await db.b2BLandingPage.count({
          where: {
            organizationId: orgId,
            category: cat.name,
            isActive: true,
          },
        });
        return {
          ...cat,
          usageCount: count,
        };
      })
    );

    return Response.json({
      ok: true,
      data: {
        categories: categoriesWithCount,
        total: categoriesWithCount.length,
      },
    });
  } catch (error) {
    console.error('카테고리 조회 실패:', error);
    return Response.json({ ok: false, message: '조회 실패' }, { status: 500 });
  }
}

/**
 * POST /api/b2b-landing/categories
 * 새 카테고리 추가
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: '로그인 필요' }, { status: 401 });
    }

    const { orgId, name, description } = await req.json();

    if (!orgId || !name) {
      return Response.json({ ok: false, message: 'orgId, name 필수' }, { status: 400 });
    }

    // 권한 확인: GLOBAL_ADMIN만
    const member = await db.organizationMember.findFirst({
      where: { organizationId: orgId, userId: session.user.id },
    });

    if (!member || member.role !== 'GLOBAL_ADMIN') {
      return Response.json({ ok: false, message: '관리자만 추가 가능' }, { status: 403 });
    }

    // 중복 검증
    const existing = await db.b2BLandingCategory.findUnique({
      where: { organizationId_name: { organizationId: orgId, name } },
    });

    if (existing) {
      return Response.json(
        { ok: false, message: '이미 있는 카테고리입니다' },
        { status: 409 }
      );
    }

    // 카테고리 생성
    const category = await db.b2BLandingCategory.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description?.trim(),
        usageCount: 0,
      },
    });

    return Response.json(
      {
        ok: true,
        data: category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('카테고리 추가 실패:', error);
    return Response.json({ ok: false, message: '추가 실패' }, { status: 500 });
  }
}
