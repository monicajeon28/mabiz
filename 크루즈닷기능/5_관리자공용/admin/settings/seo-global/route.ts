export const dynamic = 'force-dynamic';

// app/api/admin/settings/seo-global/route.ts
// SEO 전역 설정 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

// GET: SEO 전역 설정 조회
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // SEO 전역 설정 조회 (없으면 기본값 반환)
    let config = await prisma.seoGlobalConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      // 기본 설정 생성
      config = await prisma.seoGlobalConfig.create({
        data: {
          defaultSiteName: '크루즈 가이드',
          defaultSiteDescription: '크루즈닷AI와 함께하는 특별한 크루즈 여행',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      config: {
        id: config.id,
        googleSearchConsoleVerification: config.googleSearchConsoleVerification || '',
        googleSearchConsolePropertyId: config.googleSearchConsolePropertyId || '',
        googleAnalyticsId: config.googleAnalyticsId || '',
        facebookUrl: config.facebookUrl || '',
        instagramUrl: config.instagramUrl || '',
        youtubeUrl: config.youtubeUrl || '',
        twitterUrl: config.twitterUrl || '',
        naverBlogUrl: config.naverBlogUrl || '',
        kakaoChannelUrl: config.kakaoChannelUrl || '',
        defaultSiteName: config.defaultSiteName || '크루즈 가이드',
        defaultSiteDescription: config.defaultSiteDescription || '',
        defaultKeywords: config.defaultKeywords || '',
        defaultOgImage: config.defaultOgImage || '',
        contactPhone: config.contactPhone || '',
        contactEmail: config.contactEmail || '',
        contactAddress: config.contactAddress || '',
        metadata: config.metadata,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('[SEO Global Config API] Error:', error);
    
    // 테이블이 없는 경우 기본값 반환
    if (error instanceof Error && error.message.includes('does not exist')) {
      console.warn('[SEO Global Config API] Table does not exist, returning default config');
      return NextResponse.json({
        ok: true,
        config: {
          id: 0,
          googleSearchConsoleVerification: '',
          googleSearchConsolePropertyId: '',
          googleAnalyticsId: '',
          facebookUrl: '',
          instagramUrl: '',
          youtubeUrl: '',
          twitterUrl: '',
          naverBlogUrl: '',
          kakaoChannelUrl: '',
          defaultSiteName: '크루즈 가이드',
          defaultSiteDescription: '',
          defaultKeywords: '',
          defaultOgImage: '',
          contactPhone: '',
          contactEmail: '',
          contactAddress: '',
          metadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: 'SEO 전역 설정을 불러오는데 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

// POST: SEO 전역 설정 저장
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      googleSearchConsoleVerification,
      googleSearchConsolePropertyId,
      googleAnalyticsId,
      facebookUrl,
      instagramUrl,
      youtubeUrl,
      twitterUrl,
      naverBlogUrl,
      kakaoChannelUrl,
      defaultSiteName,
      defaultSiteDescription,
      defaultKeywords,
      defaultOgImage,
      contactPhone,
      contactEmail,
      contactAddress,
      metadata,
    } = body;

    // 기존 설정 조회 또는 생성
    let config = await prisma.seoGlobalConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (config) {
      // 기존 설정 업데이트
      config = await prisma.seoGlobalConfig.update({
        where: { id: config.id },
        data: {
          googleSearchConsoleVerification: googleSearchConsoleVerification || null,
          googleSearchConsolePropertyId: googleSearchConsolePropertyId || null,
          googleAnalyticsId: googleAnalyticsId || null,
          facebookUrl: facebookUrl || null,
          instagramUrl: instagramUrl || null,
          youtubeUrl: youtubeUrl || null,
          twitterUrl: twitterUrl || null,
          naverBlogUrl: naverBlogUrl || null,
          kakaoChannelUrl: kakaoChannelUrl || null,
          defaultSiteName: defaultSiteName || null,
          defaultSiteDescription: defaultSiteDescription || null,
          defaultKeywords: defaultKeywords || null,
          defaultOgImage: defaultOgImage || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          contactAddress: contactAddress || null,
          metadata: metadata !== undefined ? metadata : config.metadata,
        },
      });
    } else {
      // 새 설정 생성
      config = await prisma.seoGlobalConfig.create({
        data: {
          googleSearchConsoleVerification: googleSearchConsoleVerification || null,
          googleSearchConsolePropertyId: googleSearchConsolePropertyId || null,
          googleAnalyticsId: googleAnalyticsId || null,
          facebookUrl: facebookUrl || null,
          instagramUrl: instagramUrl || null,
          youtubeUrl: youtubeUrl || null,
          twitterUrl: twitterUrl || null,
          naverBlogUrl: naverBlogUrl || null,
          kakaoChannelUrl: kakaoChannelUrl || null,
          defaultSiteName: defaultSiteName || '크루즈 가이드',
          defaultSiteDescription: defaultSiteDescription || null,
          defaultKeywords: defaultKeywords || null,
          defaultOgImage: defaultOgImage || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          contactAddress: contactAddress || null,
          metadata: metadata || null,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'SEO 전역 설정이 저장되었습니다.',
      config: {
        id: config.id,
        googleSearchConsoleVerification: config.googleSearchConsoleVerification,
        googleSearchConsolePropertyId: config.googleSearchConsolePropertyId,
        googleAnalyticsId: config.googleAnalyticsId,
        facebookUrl: config.facebookUrl,
        instagramUrl: config.instagramUrl,
        youtubeUrl: config.youtubeUrl,
        twitterUrl: config.twitterUrl,
        naverBlogUrl: config.naverBlogUrl,
        kakaoChannelUrl: config.kakaoChannelUrl,
        defaultSiteName: config.defaultSiteName,
        defaultSiteDescription: config.defaultSiteDescription,
        defaultKeywords: config.defaultKeywords,
        defaultOgImage: config.defaultOgImage,
        contactPhone: config.contactPhone,
        contactEmail: config.contactEmail,
        contactAddress: config.contactAddress,
        metadata: config.metadata,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('[SEO Global Config API] Save error:', error);
    
    // 테이블이 없는 경우 에러 메시지 반환
    if (error instanceof Error && error.message.includes('does not exist')) {
      console.warn('[SEO Global Config API] Table does not exist, cannot save');
      return NextResponse.json(
        { 
          ok: false, 
          error: 'SEO 전역 설정 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션을 실행해주세요.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: 'SEO 전역 설정 저장에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}
