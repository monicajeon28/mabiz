import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/messages/[id]
 * 특정 Message 조회
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const organizationId = req.headers.get('x-organization-id') || '';

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const message = await prisma.crmMarketingMessage.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            email: true,
            phone: true,
            name: true
          }
        }
      }
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 테넌트 격리 확인
    if (message.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(message);
  } catch (err) {
    logger.error('[Message] GET [id] 실패', {
      id: params.id,
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/messages/[id]
 * Message 수정
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const organizationId = req.headers.get('x-organization-id') || '';
    const body = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    // 기존 Message 확인
    const existing = await prisma.crmMarketingMessage.findUnique({
      where: { id },
      select: { organizationId: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 테넌트 격리 확인
    if (existing.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedMessage = await prisma.crmMarketingMessage.update({
      where: { id },
      data: {
        content: body.content || body.contentPreview,
        status: body.status,
        updatedAt: new Date()
      }
    });

    logger.log('[Message] PUT [id] 완료', {
      id,
      organizationId,
      status: body.status
    });

    return NextResponse.json(updatedMessage);
  } catch (err) {
    logger.error('[Message] PUT [id] 실패', {
      id: params.id,
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/[id]
 * Message 삭제 (소프트 삭제)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const organizationId = req.headers.get('x-organization-id') || '';

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    // 기존 Message 확인
    const existing = await prisma.crmMarketingMessage.findUnique({
      where: { id },
      select: { organizationId: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 테넌트 격리 확인
    if (existing.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 소프트 삭제 (status를 DELETED로 변경)
    const deletedMessage = await prisma.crmMarketingMessage.update({
      where: { id },
      data: {
        status: 'DELETED',
        updatedAt: new Date()
      }
    });

    logger.log('[Message] DELETE [id] 완료', {
      id,
      organizationId
    });

    return NextResponse.json({ ok: true, deletedAt: new Date() });
  } catch (err) {
    logger.error('[Message] DELETE [id] 실패', {
      id: params.id,
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
