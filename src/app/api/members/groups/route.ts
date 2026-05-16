import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/members/groups
// 크루즈닷 회원 그룹 목록 조회
export async function GET(_req: Request) {
  try {
    // 권한 확인 — GLOBAL_ADMIN 전용
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const groups = await prisma.gmUserGroup.findMany({
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        memberCount: g._count.members,
      })),
    });
  } catch (err) {
    logger.error('[GET /api/members/groups]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/members/groups
// 새 그룹 생성
export async function POST(req: Request) {
  try {
    // 권한 확인 — GLOBAL_ADMIN 전용
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, color } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ ok: false, error: '그룹 이름은 필수입니다.' }, { status: 400 });
    }

    const group = await prisma.gmUserGroup.create({
      data: {
        name: name.trim(),
        color: color || '#6B7280',
      },
    });

    logger.info('[POST /api/members/groups]', { groupId: group.id, name: group.name });

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
        color: group.color,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: 0,
      },
    });
  } catch (err) {
    logger.error('[POST /api/members/groups]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
