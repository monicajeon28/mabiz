export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import {
  updateB2BProspect,
  deleteB2BProspect,
} from '@/lib/b2b/service';
import {
  B2BProspectUpdateSchema,
} from '@/lib/b2b/validation';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // P1: 보안 - 권한 검증 강화
    const ctx = await requirePartnerContext();
    if (!ctx) {
      logger.warn('[b2b] [id] PATCH: 미인증 요청');
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });
    }

    // AGENT(대리점장) 수정 차단
    if (ctx.sessionUser?.role === 'agent') {
      logger.warn('[b2b] [id] PATCH: AGENT 접근 차단', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '수정/삭제 권한이 없습니다' }, { status: 403 });
    }

    // GLOBAL_ADMIN(role='admin')은 organizationId가 null이어도 접근 가능
    if (!ctx.organizationId && ctx.sessionUser?.role !== 'admin') {
      logger.error('[b2b] [id] PATCH: organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      logger.warn('[b2b] [id] PATCH: 잘못된 ID 형식', { id });
      return NextResponse.json(
        { ok: false, error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    // P1: 보안 - ID 검증 추가 (XSS 방지)
    if (!/^[a-zA-Z0-9\-_]+$/.test(id)) {
      logger.warn('[b2b] [id] PATCH: 의심스러운 ID 형식', { id });
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 ID 형식입니다' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      logger.warn('[b2b] [id] PATCH: 잘못된 JSON 형식');
      return NextResponse.json(
        { ok: false, error: 'JSON 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = B2BProspectUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn('[b2b] [id] PATCH: 검증 실패', { errors });
      return NextResponse.json(
        { ok: false, error: `검증 오류: ${errors}` },
        { status: 400 }
      );
    }

    // GLOBAL_ADMIN: prospect의 실제 organizationId 조회
    let effectiveOrgId = ctx.organizationId;
    if (!effectiveOrgId) {
      const probe = await prisma.b2BProspect.findUnique({ where: { id }, select: { organizationId: true, deletedAt: true } });
      if (!probe || probe.deletedAt !== null) {
        return NextResponse.json({ ok: false, error: '찾을 수 없는 prospect입니다' }, { status: 404 });
      }
      effectiveOrgId = probe.organizationId;
    }

    // P1: 보안 - organizationId로 소유권 확인 (IDOR 방지)
    const result = await updateB2BProspect(effectiveOrgId, id, parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errCode = (err as { code?: string })?.code;
    if (errCode === 'PROSPECT_NOT_FOUND') {
      logger.warn('[b2b] [id] PATCH: 리소스 없음');
      return NextResponse.json(
        { ok: false, error: '찾을 수 없는 prospect입니다' },
        { status: 404 }
      );
    }

    logger.error('[b2b] PATCH /api/b2b/[id] error', { err });
    return NextResponse.json(
      { ok: false, error: '업데이트에 실패했습니다' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // P1: 보안 - 권한 검증 강화
    const ctx = await requirePartnerContext();
    if (!ctx) {
      logger.warn('[b2b] [id] DELETE: 미인증 요청');
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });
    }

    // AGENT(대리점장) 삭제 차단
    if (ctx.sessionUser?.role === 'agent') {
      logger.warn('[b2b] [id] DELETE: AGENT 접근 차단', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '수정/삭제 권한이 없습니다' }, { status: 403 });
    }

    // GLOBAL_ADMIN(role='admin')은 organizationId가 null이어도 접근 가능
    if (!ctx.organizationId && ctx.sessionUser?.role !== 'admin') {
      logger.error('[b2b] [id] DELETE: organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      logger.warn('[b2b] [id] DELETE: 잘못된 ID 형식', { id });
      return NextResponse.json(
        { ok: false, error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    // P1: 보안 - ID 검증 추가 (XSS 방지)
    if (!/^[a-zA-Z0-9\-_]+$/.test(id)) {
      logger.warn('[b2b] [id] DELETE: 의심스러운 ID 형식', { id });
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 ID 형식입니다' },
        { status: 400 }
      );
    }

    // GLOBAL_ADMIN: prospect의 실제 organizationId 조회
    let effectiveOrgId = ctx.organizationId;
    if (!effectiveOrgId) {
      const probe = await prisma.b2BProspect.findUnique({ where: { id }, select: { organizationId: true, deletedAt: true } });
      if (!probe || probe.deletedAt !== null) {
        return NextResponse.json({ ok: false, error: '찾을 수 없는 prospect입니다' }, { status: 404 });
      }
      effectiveOrgId = probe.organizationId;
    }

    // P1: 보안 - organizationId로 소유권 확인 (IDOR 방지)
    const result = await deleteB2BProspect(effectiveOrgId, id);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errCode = (err as { code?: string })?.code;
    if (errCode === 'PROSPECT_NOT_FOUND') {
      logger.warn('[b2b] [id] DELETE: 리소스 없음');
      return NextResponse.json(
        { ok: false, error: '찾을 수 없는 prospect입니다' },
        { status: 404 }
      );
    }

    logger.error('[b2b] DELETE /api/b2b/[id] error', { err });
    return NextResponse.json(
      { ok: false, error: '삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
