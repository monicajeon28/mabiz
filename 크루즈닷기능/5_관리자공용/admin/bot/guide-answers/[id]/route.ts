import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('deactivate') }),
  z.object({ action: z.literal('update'), answer: z.string().min(1).max(5000) }),
]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID가 유효하지 않습니다.' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: '요청 데이터가 유효하지 않습니다.', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const answer = await prisma.botGuideAnswer.findUnique({
      where: { id },
    });

    if (!answer) {
      return NextResponse.json(
        { error: '답변을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let updated;

    if (parsed.data.action === 'approve') {
      updated = await prisma.botGuideAnswer.update({
        where: { id },
        data: { isActive: true },
      });
      revalidateTag('bot-guide-answers');
      logger.log('[admin/bot/guide-answers] 답변 승인', {
        id,
        key: answer.key,
        userId: user.id,
      });
    } else if (parsed.data.action === 'reject') {
      updated = await prisma.botGuideAnswer.delete({
        where: { id },
      });
      revalidateTag('bot-guide-answers');
      logger.log('[admin/bot/guide-answers] 답변 거부 (삭제)', {
        id,
        key: answer.key,
        userId: user.id,
      });
    } else if (parsed.data.action === 'deactivate') {
      updated = await prisma.botGuideAnswer.update({
        where: { id },
        data: { isActive: false },
      });
      revalidateTag('bot-guide-answers');
      logger.log('[admin/bot/guide-answers] 답변 비활성화', {
        id,
        key: answer.key,
        userId: user.id,
      });
    } else if (parsed.data.action === 'update') {
      if (!parsed.data.answer) {
        return NextResponse.json(
          { error: 'update 액션에는 answer 필드가 필요합니다.' },
          { status: 400 }
        );
      }
      updated = await prisma.botGuideAnswer.update({
        where: { id },
        data: { answer: parsed.data.answer },
      });
      revalidateTag('bot-guide-answers');
      logger.log('[admin/bot/guide-answers] 답변 수정', {
        id,
        key: answer.key,
        userId: user.id,
      });
    }

    return NextResponse.json({ ok: true, answer: updated });
  } catch (error) {
    logger.error('[admin/bot/guide-answers/[id]] PATCH 오류', {
      error: error instanceof Error ? error.message : String(error),
      id: params.id,
    });
    return NextResponse.json({ error: '요청 처리 실패' }, { status: 500 });
  }
}
