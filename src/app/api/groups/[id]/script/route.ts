export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/groups/[id]/script - 기존 토큰으로 등록 스크립트 조회 (토큰 없으면 404)
// PERF-003 + SCALE-003: 토큰 생성은 POST로 분리 (캐싱 가능하게 함)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getAuthContext();
    const groupId = params.id;
    const { origin } = new URL(req.url);

    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId },
      select: { name: true, organizationId: true, ownerId: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    // 기존 유효한 토큰 조회만 (생성하지 않음)
    const token = await prisma.groupToken.findFirst({
      where: {
        groupId,
        active: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'NO_TOKEN', message: '유효한 토큰이 없습니다. POST /api/groups/[id]/script로 토큰을 생성하세요.' },
        { status: 404 }
      );
    }

    const formFields = [
      { name: 'name', label: '이름', required: true, placeholder: '이름을 입력하세요' },
      { name: 'phone', label: '전화번호', required: true, placeholder: '010-0000-0000' },
      { name: 'email', label: '이메일', required: false, placeholder: 'example@email.com' },
    ];

    const formHtml = formFields
      .map(
        field =>
          `<input type="${field.name === 'email' ? 'email' : 'tel'}" name="${field.name}" placeholder="${field.placeholder}" ${
            field.required ? 'required' : ''
          } style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;font-size:14px;box-sizing:border-box;" />`
      )
      .join('\n');

    const script = `<!-- mabiz 그룹 등록 폼 -->
<form action="${origin}/api/groups/${groupId}/register" method="POST" style="max-width:400px;margin:20px auto;">
  <input type="hidden" name="seq" value="${token.id}" />
  ${formHtml}
  <button type="submit" style="width:100%;padding:14px;background-color:#007bff;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-weight:bold;">신청하기</button>
</form>`;

    return NextResponse.json({
      ok: true,
      token: token.id,
      groupId,
      groupName: group.name,
      script,
      expiresAt: token.expiresAt,
    });
  } catch (err) {
    logger.error('[GET /api/groups/[id]/script]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/groups/[id]/script - 새 토큰 생성
// PERF-003 + SCALE-003: 토큰 생성을 POST로 분리
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getAuthContext();
    const groupId = params.id;

    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId },
      select: { name: true, organizationId: true, ownerId: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    // 기존 활성 토큰이 있으면 비활성화
    await prisma.groupToken.updateMany({
      where: { groupId, active: true },
      data: { active: false },
    });

    // 새 토큰 생성
    const seq = crypto.randomBytes(6).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token = await prisma.groupToken.create({
      data: { id: seq, groupId, expiresAt, active: true },
      select: { id: true, expiresAt: true, createdAt: true },
    });

    logger.log('[CreateGroupToken]', { groupId, seq, action: 'POST' });

    return NextResponse.json({
      ok: true,
      token: token.id,
      groupId,
      groupName: group.name,
      expiresAt: token.expiresAt,
      message: '새 토큰이 생성되었습니다.',
    });
  } catch (err) {
    logger.error('[POST /api/groups/[id]/script]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
