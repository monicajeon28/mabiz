export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// GET /api/groups/[id]/script — seq 기반 embed HTML 반환
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const ctx = await getAuthContext();
    const { origin } = new URL(req.url);

    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId ?? undefined },
      select: { name: true, seq: true, ownerId: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    // seq가 없으면 자동 생성 후 저장
    let seq = group.seq;
    if (!seq) {
      for (let i = 0; i < 5; i++) {
        const candidate = crypto.randomBytes(8).toString('hex');
        const exists = await prisma.contactGroup.findFirst({ where: { seq: candidate }, select: { id: true } });
        if (!exists) {
          await prisma.contactGroup.update({ where: { id: groupId }, data: { seq: candidate } });
          seq = candidate;
          break;
        }
      }
      if (!seq) return NextResponse.json({ ok: false, error: 'SEQ_GEN_FAILED' }, { status: 500 });
    }

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? origin;
    const script = `<!-- include form -->
<form action="${appOrigin}/api/public/group-join" onsubmit="return step_submit(this);">
  <input type="hidden" name="seq" value="${seq}"/>
  <input type="hidden" name="result_url" value=""/><!--신청후 이동할 url-->
  <input type="text" name="nm" placeholder="이름 입력"/>
  <input type="text" name="hp" placeholder="휴대폰번호 입력"/>
  <input type="text" name="em" placeholder="이메일 입력"/>
  <input type="submit" value="신청하기"/>
</form>
<script>function step_submit(frm){if(frm.nm.value==""){alert("이름이 없습니다");return false;}var regExp=/^01([0|1|6|7|8|9]?)-?([0-9]{3,4})-?([0-9]{4})$/;if(!regExp.test(frm.hp.value)){alert('잘못된 휴대폰 번호입니다. 숫자, -를 포함한 숫자만 입력하세요.');return false;}return true;}<\/script>
<!-- //include form -->`;

    return NextResponse.json({ ok: true, seq, groupId, groupName: group.name, script });
  } catch (err) {
    logger.error('[GET /api/groups/[id]/script]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/groups/[id]/script — seq 재생성 (분실/교체 시)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const ctx = await getAuthContext();

    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId ?? undefined },
      select: { name: true, ownerId: true },
    });

    if (!group) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    let newSeq: string | null = null;
    for (let i = 0; i < 5; i++) {
      const candidate = crypto.randomBytes(8).toString('hex');
      const exists = await prisma.contactGroup.findFirst({ where: { seq: candidate }, select: { id: true } });
      if (!exists) { newSeq = candidate; break; }
    }
    if (!newSeq) return NextResponse.json({ ok: false, error: 'SEQ_GEN_FAILED' }, { status: 500 });

    await prisma.contactGroup.update({ where: { id: groupId }, data: { seq: newSeq } });

    return NextResponse.json({ ok: true, seq: newSeq, groupId, groupName: group.name });
  } catch (err) {
    logger.error('[POST /api/groups/[id]/script]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
