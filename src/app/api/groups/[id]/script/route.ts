export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/groups/[id]/script - 등록 스크립트 조회
// seq 토큰이 있으면 자동 생성, 없으면 새로 생성
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getAuthContext();
    const groupId = params.id;
    const { origin } = new URL(req.url);

    const group = await prisma.contactGroup.findUnique({
      where: { id: groupId },
      select: { name: true, organizationId: true, ownerId: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }
    if (ctx.role === 'OWNER' && group.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    let token = await prisma.groupToken.findFirst({
      where: {
        groupId,
        active: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      const seq = require('crypto').randomBytes(6).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      token = await prisma.groupToken.create({
        data: { id: seq, groupId, expiresAt, active: true },
      });
      logger.log('[AutoCreateGroupToken]', { groupId, seq });
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
