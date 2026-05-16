export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/b2b-landing — B2B 랜딩페이지 목록
export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
        { status: 401 },
      );
    }
    if (session.role === 'FREE_SALES') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다' },
        { status: 403 },
      );
    }

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const q = searchParams.get('q')?.trim() || undefined;
    const partnerId = searchParams.get('partnerId')?.trim() || undefined;
    const skip = (page - 1) * limit;

    // GLOBAL_ADMIN은 전체, 나머지는 자기 조직만
    const where: Record<string, unknown> = {};
    if (session.role !== 'GLOBAL_ADMIN') {
      where.organizationId = session.organizationId;
    }

    // 검색: title 또는 slug
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

    // 파트너 필터
    if (partnerId) {
      where.partnerId = partnerId;
    }

    const [pages, total] = await Promise.all([
      prisma.crmLandingPage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              registrations: true,
              comments: true,
            },
          },
        },
      }),
      prisma.crmLandingPage.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result = pages.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      partnerId: (p as Record<string, unknown>).partnerId ?? null,
      title: p.title,
      slug: p.slug,
      isActive: p.isActive,
      viewCount: p.viewCount,
      editorMode: p.editorMode,
      paymentEnabled: p.paymentEnabled,
      commentEnabled: p.commentEnabled,
      registrationCount: p._count.registrations,
      commentCount: p._count.comments,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({ ok: true, pages: result, total, page, totalPages });
  } catch (err) {
    logger.error('[GET /api/b2b-landing]', { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/b2b-landing — B2B 랜딩페이지 생성
export async function POST(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
        { status: 401 },
      );
    }
    if (session.role !== 'GLOBAL_ADMIN' && session.role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: 'B2B 랜딩페이지 생성 권한이 없습니다' },
        { status: 403 },
      );
    }

    // organizationId 결정
    let orgId: string;
    if (session.role === 'GLOBAL_ADMIN' && !session.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) {
        return NextResponse.json(
          { ok: false, message: '조직이 없습니다' },
          { status: 500 },
        );
      }
      orgId = firstOrg.id;
    } else {
      orgId = session.organizationId!;
    }

    const body = await req.json();
    const { title, slug } = body;

    if (!title?.trim() || !slug?.trim()) {
      return NextResponse.json(
        { ok: false, message: '제목과 슬러그는 필수입니다.' },
        { status: 400 },
      );
    }

    // 슬러그 중복 체크 (조직 내)
    const existing = await prisma.crmLandingPage.findFirst({
      where: { slug: slug.trim(), organizationId: orgId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, message: '이미 사용 중인 슬러그입니다.' },
        { status: 409 },
      );
    }

    const editorMode = body.editorMode === 'image' ? 'image' : 'html';

    const page = await prisma.crmLandingPage.create({
      data: {
        organizationId: orgId,
        title: title.trim(),
        slug: slug.trim(),
        htmlContent: body.htmlContent ?? '',
        editorMode,
        commentEnabled: body.commentEnabled === true,
        groupId: body.groupId ?? null,
        autoFunnelId: body.autoFunnelId ?? null,
        // 파트너 연결
        ...(body.partnerId ? { partnerId: body.partnerId } : {}),
        // 폼 설정
        ...(body.formConfig
          ? { formConfig: body.formConfig, infoCollection: true }
          : {}),
        // 버튼/완료 페이지
        ...(body.buttonTitle ? { buttonTitle: body.buttonTitle } : {}),
        ...(body.completionPageUrl ? { completionPageUrl: body.completionPageUrl } : {}),
        // 결제 설정
        ...(body.paymentEnabled
          ? {
              paymentEnabled: true,
              paymentType: body.paymentType ?? null,
              productName: body.productName ?? null,
              productPrice: body.productPrice
                ? parseInt(String(body.productPrice), 10)
                : null,
              ...(body.paymentType === 'subscription'
                ? {
                    cycleDay: body.cycleDay
                      ? parseInt(String(body.cycleDay), 10)
                      : null,
                    expireDate: body.expireDate
                      ? new Date(body.expireDate)
                      : null,
                  }
                : {}),
            }
          : {}),
        // 이메일 발송 설정
        ...(body.regEmailEnabled
          ? {
              regEmailEnabled: true,
              regEmailSubject: body.regEmailSubject ?? null,
              regEmailContent: body.regEmailContent ?? null,
            }
          : {}),
        // 노출/SEO
        ...(body.exposureTitle ? { exposureTitle: body.exposureTitle } : {}),
        ...(body.exposureImage ? { exposureImage: body.exposureImage } : {}),
        ...(body.description ? { description: body.description } : {}),
        // 푸터/헤더
        ...(body.footerText ? { footerText: body.footerText } : {}),
        ...(body.headerScript ? { headerScript: body.headerScript } : {}),
      },
    });

    logger.log('[POST /api/b2b-landing] 생성', { id: page.id, orgId });
    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { ok: false, message: '이미 사용 중인 슬러그입니다.' },
        { status: 409 },
      );
    }
    logger.error('[POST /api/b2b-landing]', { err });
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
