export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// GET /api/groups/[id]/tokens - 토큰 목록 조회
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const ctx = await getAuthContext();

    // [SEC-002] IDOR 방지: organizationId 필터 추가 (groupId만으로는 다른 조직 접근 가능)
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId ?? undefined },
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

    // PERF-001: DB 레벨에서 expired 계산 (raw query)
    const tokens = await prisma.$queryRaw<
      Array<{
        id: string;
        expiresAt: Date;
        active: boolean;
        createdAt: Date;
        expired: boolean;
      }>
    >`
      SELECT
        id,
        "expiresAt",
        active,
        "createdAt",
        ("expiresAt" < NOW()) as expired
      FROM "GroupToken"
      WHERE "groupId" = ${groupId}
      ORDER BY "createdAt" DESC
    `;

    return NextResponse.json({
      ok: true,
      tokens,
    });
  } catch (err) {
    logger.error('[GET /api/groups/[id]/tokens]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/groups/[id]/tokens - 새 토큰 생성
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const ctx = await getAuthContext();

    // [SEC-002] IDOR 방지: organizationId 필터 추가
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId ?? undefined },
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

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const token = await prisma.groupToken.create({
      data: { groupId, expiresAt, active: true },
      select: { id: true, expiresAt: true, active: true, createdAt: true },
    });

    logger.log('[CreateGroupToken]', { groupId, tokenId: token.id });

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const ctx = await getAuthContext();
    const body = await req.json();
    const { tokenId, action } = body; // action: 'refresh' | 'deactivate'

    // [SEC-002] IDOR 방지: organizationId 필터 추가
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId ?? undefined },
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
        where: { id: tokenId, groupId },
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
        where: { id: tokenId, groupId },
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
