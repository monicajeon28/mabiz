import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sanitizeHtml } from '@/lib/html-sanitizer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, message: 'ID 필수' }, { status: 400 });

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      include: { template: { select: { name: true, htmlContent: true } } },
    });

    if (!instance) {
      return NextResponse.json({ ok: false, message: '계약서 없음' }, { status: 404 });
    }

    // 만료 확인
    if (instance.expiresAt && new Date() > instance.expiresAt) {
      return NextResponse.json(
        {
          ok: false,
          message: '서명 기한이 만료되었습니다',
          expired: true,
        },
        { status: 410 }
      );
    }

    // 이미 서명 확인
    const alreadySigned = instance.status === 'SIGNED' || instance.status === 'COMPLETED';

    // boundData에서 {{변수명}} 치환 (XSS 방지 - 각 값 sanitize)
    let renderedHtml = instance.template?.htmlContent ?? '';
    if (instance.boundData && typeof instance.boundData === 'object') {
      Object.entries(instance.boundData).forEach(([key, value]) => {
        // 각 치환 값을 먼저 sanitize하여 XSS 방지
        const sanitizedValue = sanitizeHtml(String(value ?? ''));
        renderedHtml = renderedHtml.replace(new RegExp(`{{${key}}}`, 'g'), sanitizedValue);
      });
    }

    // 최종 HTML 전체 sanitize (다층 방어)
    renderedHtml = sanitizeHtml(renderedHtml);

    return NextResponse.json({
      ok: true,
      status: instance.status,
      templateName: instance.template?.name ?? '',
      renderedHtml,
      boundData: instance.boundData ?? {},
      expiresAt: instance.expiresAt?.toISOString(),
      alreadySigned,
      signedAt: instance.signedAt?.toISOString() ?? null,
    });
  } catch (e) {
    logger.log('[PublicContractGet] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
