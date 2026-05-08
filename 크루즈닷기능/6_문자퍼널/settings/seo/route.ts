export const dynamic = 'force-dynamic';

// app/api/admin/settings/seo/route.ts
// SEO 설정 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

// GET: SEO 설정 목록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pagePath = searchParams.get('pagePath');

    if (pagePath) {
      // 특정 페이지의 SEO 설정 조회
      const config = await prisma.seoConfig.findUnique({
        where: { pagePath },
      });

      return NextResponse.json({
        ok: true,
        config: config || null,
      });
    } else {
      // 모든 SEO 설정 목록 조회
      const configs = await prisma.seoConfig.findMany({
        orderBy: { lastUpdated: 'desc' },
        take: 100, // 최대 100개
      });

      return NextResponse.json({
        ok: true,
        configs,
        total: configs.length,
      });
    }
  } catch (error) {
    console.error('[SEO Config API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'SEO 설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: SEO 설정 저장/수정
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      pagePath,
      pageType,
      title,
      description,
      keywords,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      ogUrl,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      canonicalUrl,
      robots,
      structuredData,
    } = body;

    if (!pagePath) {
      return NextResponse.json(
        { ok: false, error: '페이지 경로(pagePath)는 필수입니다.' },
        { status: 400 }
      );
    }

    // 기존 설정 조회
    const existing = await prisma.seoConfig.findUnique({
      where: { pagePath },
    });

    let config;
    if (existing) {
      // 업데이트
      config = await prisma.seoConfig.update({
        where: { pagePath },
        data: {
          pageType: pageType || existing.pageType,
          title: title !== undefined ? (title || null) : existing.title,
          description: description !== undefined ? (description || null) : existing.description,
          keywords: keywords !== undefined ? (keywords || null) : existing.keywords,
          ogTitle: ogTitle !== undefined ? (ogTitle || null) : existing.ogTitle,
          ogDescription: ogDescription !== undefined ? (ogDescription || null) : existing.ogDescription,
          ogImage: ogImage !== undefined ? (ogImage || null) : existing.ogImage,
          ogType: ogType !== undefined ? (ogType || null) : existing.ogType,
          ogUrl: ogUrl !== undefined ? (ogUrl || null) : existing.ogUrl,
          twitterCard: twitterCard !== undefined ? (twitterCard || null) : existing.twitterCard,
          twitterTitle: twitterTitle !== undefined ? (twitterTitle || null) : existing.twitterTitle,
          twitterDescription: twitterDescription !== undefined ? (twitterDescription || null) : existing.twitterDescription,
          twitterImage: twitterImage !== undefined ? (twitterImage || null) : existing.twitterImage,
          canonicalUrl: canonicalUrl !== undefined ? (canonicalUrl || null) : existing.canonicalUrl,
          robots: robots !== undefined ? (robots || null) : existing.robots,
          structuredData: structuredData !== undefined ? structuredData : existing.structuredData,
        },
      });
    } else {
      // 생성
      config = await prisma.seoConfig.create({
        data: {
          pagePath,
          pageType: pageType || 'page',
          title: title || null,
          description: description || null,
          keywords: keywords || null,
          ogTitle: ogTitle || null,
          ogDescription: ogDescription || null,
          ogImage: ogImage || null,
          ogType: ogType || 'website',
          ogUrl: ogUrl || null,
          twitterCard: twitterCard || 'summary_large_image',
          twitterTitle: twitterTitle || null,
          twitterDescription: twitterDescription || null,
          twitterImage: twitterImage || null,
          canonicalUrl: canonicalUrl || null,
          robots: robots || null,
          structuredData: structuredData || null,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'SEO 설정이 저장되었습니다.',
      config,
    });
  } catch (error) {
    console.error('[SEO Config API] Save error:', error);
    return NextResponse.json(
      { ok: false, error: 'SEO 설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: SEO 설정 삭제
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pagePath = searchParams.get('pagePath');

    if (!pagePath) {
      return NextResponse.json(
        { ok: false, error: '페이지 경로(pagePath)는 필수입니다.' },
        { status: 400 }
      );
    }

    await prisma.seoConfig.delete({
      where: { pagePath },
    });

    return NextResponse.json({
      ok: true,
      message: 'SEO 설정이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[SEO Config API] Delete error:', error);
    return NextResponse.json(
      { ok: false, error: 'SEO 설정 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
