import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const guidAnswerSchema = z.object({
  key: z.string().min(1).max(100),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5000),
  source: z.string().max(100).optional().default('ai-generated'),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const [pending, approved] = await Promise.all([
      prisma.botGuideAnswer.findMany({
        where: { isActive: false },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.botGuideAnswer.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({ ok: true, pending, approved });
  } catch (error) {
    logger.error('[admin/bot/guide-answers] GET 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = guidAnswerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: '요청 데이터가 유효하지 않습니다.', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const existing = await prisma.botGuideAnswer.findUnique({
      where: { key: parsed.data.key },
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 키입니다.' },
        { status: 409 }
      );
    }

    const answer = await prisma.botGuideAnswer.create({
      data: parsed.data,
    });

    logger.log('[admin/bot/guide-answers] 새 답변 생성', {
      id: answer.id,
      key: answer.key,
      userId: user.id,
    });

    return NextResponse.json({ ok: true, answer }, { status: 201 });
  } catch (error) {
    logger.error('[admin/bot/guide-answers] POST 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: '데이터 생성 실패' }, { status: 500 });
  }
}
