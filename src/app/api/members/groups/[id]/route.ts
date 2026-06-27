import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

// 그룹 소유자(작성자) 또는 GLOBAL_ADMIN만 수정·삭제 가능
async function authorize(id: string) {
  const session = await getMabizSession();
  if (!session) return { error: NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 }) };

  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) return { error: NextResponse.json({ ok: false, error: '잘못된 그룹 ID입니다.' }, { status: 400 }) };

  const group = await prisma.gmUserGroup.findUnique({ where: { id: groupId } });
  if (!group) return { error: NextResponse.json({ ok: false, error: '그룹을 찾을 수 없습니다.' }, { status: 404 }) };

  const userId = parseInt(session.userId, 10);
  if (group.createdByUserId !== userId && session.role !== 'GLOBAL_ADMIN') {
    return { error: NextResponse.json({ ok: false, error: '이 그룹을 수정할 권한이 없습니다.' }, { status: 403 }) };
  }
  return { groupId };
}

// PATCH /api/members/groups/[id] — 회원그룹 이름·색상 수정
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (auth.error) return auth.error;

    const body = await req.json();
    const { name, color } = body as { name?: string; color?: string };

    const data: { name?: string; color?: string } = {};
    if (typeof name === 'string') {
      if (name.trim() === '') {
        return NextResponse.json({ ok: false, error: '그룹 이름은 비울 수 없습니다.' }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (typeof color === 'string' && color.trim() !== '') data.color = color.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    const group = await prisma.gmUserGroup.update({ where: { id: auth.groupId }, data });
    return NextResponse.json({ ok: true, group: { id: group.id, name: group.name, color: group.color } });
  } catch (err) {
    logger.error('[PATCH /api/members/groups/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/members/groups/[id] — 회원그룹 삭제(소속 연결 먼저 정리)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (auth.error) return auth.error;

    await prisma.$transaction([
      prisma.gmUserGroupMember.deleteMany({ where: { groupId: auth.groupId } }),
      prisma.gmUserGroup.delete({ where: { id: auth.groupId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/members/groups/[id]]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
