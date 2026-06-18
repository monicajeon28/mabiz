export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    // FREE_SALES 차단
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    const { id } = await context.params;
    const { content } = await req.json() as { content: string };
    if (!content?.trim()) return NextResponse.json({ ok: false, error: '내용을 입력해주세요.' }, { status: 400 });

    // B1: deletedAt 체크 포함 — 삭제된 회원에 상담 등록 방지
    // P0: organizationId 격리 — 다른 조직의 골드회원에 상담 등록 방지
    const member = await prisma.goldMember.findUnique({
      where: { id, deletedAt: null },
      select: { organizationId: true, agentId: true },
    });
    if (!member) {
      return NextResponse.json({ ok: false, error: '골드회원을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (ctx.role !== 'GLOBAL_ADMIN') {
      if (!ctx.organizationId || member.organizationId !== ctx.organizationId) {
        return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
      }
      // AGENT는 자기 담당 고객만 상담 등록 가능
      if (ctx.role === 'AGENT') {
        const numericId = parseInt(ctx.userId, 10);
        if (!isNaN(numericId) && member.agentId !== numericId) {
          return NextResponse.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
        }
      }
    }

    const consultation = await prisma.goldMemberConsultation.create({
      data: { goldMemberId: id, content: content.trim(), authorId: ctx.userId },
    });
    return NextResponse.json({ ok: true, consultation });
  } catch (err) {
    logger.error('[POST /api/gold-members/[id]/consultation]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
