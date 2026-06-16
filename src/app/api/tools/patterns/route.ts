import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    if (!orgId) {
      logger.error('[Patterns] 조직 정보 없음', { userId: ctx?.userId });
      return NextResponse.json({ ok: false, message: '조직 정보 없음. 관리자에게 문의하세요.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const persona  = searchParams.get('persona');
    const category = searchParams.get('category');

    const patterns = await prisma.scriptPattern.findMany({
      where: {
        organizationId: orgId,
        status: 'APPROVED',
        ...(persona  ? { personaType: persona } : {}),
        ...(category ? { category }             : {}),
      },
      orderBy: [{ conversionRate: 'desc' }, { extractedAt: 'desc' }],
      take: 50,
    });

    return NextResponse.json({ ok: true, patterns });
  } catch (e) {
    logger.log('[Patterns] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/tools/patterns
// 새 스크립트 패턴 등록
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음.' }, { status: 403 });
    }

    const body = await req.json() as {
      personaType: string;
      category: string;
      patternText: string;
      conversionRate?: number;
      objectionType?: string;
      exampleCall?: string;
      productType?: string;
    };

    if (!body.personaType || !body.category || !body.patternText?.trim()) {
      return NextResponse.json({ ok: false, message: '필수 항목(페르소나, 카테고리, 패턴 내용)을 입력하세요.' }, { status: 400 });
    }

    const pattern = await prisma.scriptPattern.create({
      data: {
        organizationId: orgId,
        personaType: body.personaType,
        category: body.category,
        patternText: body.patternText.trim(),
        conversionRate: body.conversionRate ?? 0,
        objectionType: body.objectionType ?? null,
        exampleCall: body.exampleCall ?? null,
        productType: body.productType ?? 'GENERAL',
        status: 'DRAFT',
      },
    });

    logger.log('[patterns POST] 패턴 생성', { id: pattern.id });
    return NextResponse.json({ ok: true, pattern });
  } catch (e) {
    logger.error('[patterns POST]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
