export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    const { id } = await context.params;
    const { content } = await req.json() as { content: string };
    if (!content?.trim()) return NextResponse.json({ ok: false, error: '내용을 입력해주세요.' }, { status: 400 });

    const consultation = await prisma.goldMemberConsultation.create({
      data: { goldMemberId: id, content: content.trim(), authorId: ctx.userId },
    });
    return NextResponse.json({ ok: true, consultation });
  } catch (err) {
    logger.error('[POST /api/gold-members/[id]/consultation]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
