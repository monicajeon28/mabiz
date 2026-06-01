import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/messages/[id]
 * 특정 Message 조회
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const session = await getMabizSession();

    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    if (message.organizationId !== session.organizationId) {
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

// PUT body 검증 스키마
const UpdateMessageSchema = z.object({
  status: z.enum(['SENT', 'PENDING', 'DELETED']).optional(),
  content: z.string().optional(),
  segment: z.string().optional(),
  variant: z.string().optional()
});

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
    const session = await getMabizSession();
    const body = await req.json();

    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Body 검증
    const updateData = UpdateMessageSchema.parse(body);

    // 기존 Message 확인
    const existing = await prisma.crmMarketingMessage.findUnique({
      where: { id },
      select: { organizationId: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 테넌트 격리 확인
    if (existing.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedMessage = await prisma.crmMarketingMessage.update({
      where: { id },
      data: {
        ...(updateData.content && { content: updateData.content }),
        ...(updateData.status && { status: updateData.status }),
        ...(updateData.segment && { segment: updateData.segment }),
        ...(updateData.variant && { variant: updateData.variant }),
        updatedAt: new Date()
      }
    });

    logger.log('[Message] PUT [id] 완료', {
      id,
      organizationId: session.organizationId,
      updatedFields: Object.keys(updateData)
    });

    return NextResponse.json(updatedMessage);
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.warn('[Message] PUT [id] 검증 오류', {
        id: params.id,
        errors: err.issues
      });
      return NextResponse.json(
        { error: 'Invalid request body', details: err.issues },
        { status: 400 }
      );
    }
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
    const session = await getMabizSession();

    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    if (existing.organizationId !== session.organizationId) {
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
      organizationId: session.organizationId
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
