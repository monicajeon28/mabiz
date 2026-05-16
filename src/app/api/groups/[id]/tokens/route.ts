export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// GET /api/groups/[id]/tokens - 토큰 목록 조회
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getAuthContext();
    const groupId = params.id;

    const group = await prisma.contactGroup.findUnique({
      where: { id: groupId },
      select: { organizationId: true, ownerId: true },
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

    const tokens = await prisma.groupToken.findMany({
      where: { groupId },
      select: { id: true, expiresAt: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      tokens: tokens.map(t => ({
        ...t,
        expired: new Date(t.expiresAt) < new Date(),
      })),
    });
  } catch (err) {
    logger.error('[GET /api/groups/[id]/tokens]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/groups/[id]/tokens - 새 토큰 생성
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getAuthContext();
    const groupId = params.id;

    const group = await prisma.contactGroup.findUnique({
      where: { id: groupId },
      select: { organizationId: true, ownerId: true },
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

    const seq = crypto.randomBytes(6).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token = await prisma.groupToken.create({
      data: { id: seq, groupId, expiresAt, active: true },
      select: { id: true, expiresAt: true, active: true, createdAt: true },
    });

    logger.log('[CreateGroupToken]', { groupId, seq });

    return NextResponse.json({
      ok: true,
      token: { ...token, expired: false },
    });
  } catch (err) {
    logger.error('[POST /api/groups/[id]/tokens]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/groups/[id]/tokens/[tokenId] - 토큰 상태 변경 (활성화/비활성화 또는 갱신)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const groupId = params.id;
    const body = await req.json();
    const { tokenId, action } = body; // action: 'refresh' | 'deactivate'

    const group = await prisma.contactGroup.findUnique({
      where: { id: groupId },
      select: { organizationId: true, ownerId: true },
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

    if (action === 'refresh') {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token = await prisma.groupToken.update({
        where: { id: tokenId },
        data: { expiresAt, active: true },
        select: { id: true, expiresAt: true, active: true, createdAt: true },
      });

      logger.log('[RefreshGroupToken]', { groupId, tokenId });

      return NextResponse.json({
        ok: true,
        token: { ...token, expired: false },
      });
    } else if (action === 'deactivate') {
      const token = await prisma.groupToken.update({
        where: { id: tokenId },
        data: { active: false },
        select: { id: true, expiresAt: true, active: true, createdAt: true },
      });

      logger.log('[DeactivateGroupToken]', { groupId, tokenId });

      return NextResponse.json({
        ok: true,
        token: { ...token, expired: new Date(token.expiresAt) < new Date() },
      });
    }

    return NextResponse.json({ ok: false, error: 'INVALID_ACTION' }, { status: 400 });
  } catch (err) {
    logger.error('[PATCH /api/groups/[id]/tokens]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
