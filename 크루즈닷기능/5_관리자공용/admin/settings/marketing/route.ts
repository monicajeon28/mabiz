export const dynamic = 'force-dynamic';

// app/api/admin/settings/marketing/route.ts
// 마케팅 픽셀 및 API 설정 관리

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

// GET: 마케팅 설정 조회
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    // role 체크: getSession()에서 이미 대문자로 정규화됨
    if (!session || session.role !== 'ADMIN') {
      console.error('[Marketing Config API] Unauthorized:', {
        hasSession: !!session,
        role: session?.role,
        userId: session?.userId,
      });
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 마케팅 설정 조회 (없으면 기본값 반환)
    let config = await prisma.marketingConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      // 기본 설정 생성
      config = await prisma.marketingConfig.create({
        data: {},
      });
    }

    return NextResponse.json({
      ok: true,
      config: {
        id: config.id,
        googlePixelId: config.googlePixelId || '',
        googleTagManagerId: config.googleTagManagerId || '',
        googleAdsId: config.googleAdsId || '',
        googleApiKey: config.googleApiKey || '',
        googleTestMode: config.googleTestMode,
        facebookPixelId: config.facebookPixelId || '',
        facebookAppId: config.facebookAppId || '',
        facebookAccessToken: config.facebookAccessToken || '',
        facebookTestMode: config.facebookTestMode,
        naverPixelId: config.naverPixelId || '',
        kakaoPixelId: config.kakaoPixelId || '',
        isGoogleEnabled: config.isGoogleEnabled,
        isFacebookEnabled: config.isFacebookEnabled,
        isNaverEnabled: config.isNaverEnabled,
        isKakaoEnabled: config.isKakaoEnabled,
        metadata: config.metadata,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Marketing Config API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const errorStack = error instanceof Error ? error.stack : String(error);
    console.error('[Marketing Config API] Error details:', {
      message: errorMessage,
      stack: errorStack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: '마케팅 설정을 불러오는데 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// POST: 마케팅 설정 저장
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    // role 체크: getSession()에서 이미 대문자로 정규화됨
    if (!session || session.role !== 'ADMIN') {
      console.error('[Marketing Config API] Unauthorized:', {
        hasSession: !!session,
        role: session?.role,
        userId: session?.userId,
      });
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      googlePixelId,
      googleTagManagerId,
      googleAdsId,
      googleApiKey,
      googleTestMode,
      facebookPixelId,
      facebookAppId,
      facebookAccessToken,
      facebookTestMode,
      naverPixelId,
      kakaoPixelId,
      isGoogleEnabled,
      isFacebookEnabled,
      isNaverEnabled,
      isKakaoEnabled,
      metadata,
    } = body;

    // 기존 설정 조회 또는 생성
    let config = await prisma.marketingConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      config = await prisma.marketingConfig.create({
        data: {
          googlePixelId: googlePixelId || null,
          googleTagManagerId: googleTagManagerId || null,
          googleAdsId: googleAdsId || null,
          googleApiKey: googleApiKey || null,
          googleTestMode: googleTestMode || false,
          facebookPixelId: facebookPixelId || null,
          facebookAppId: facebookAppId || null,
          facebookAccessToken: facebookAccessToken || null,
          facebookTestMode: facebookTestMode || false,
          naverPixelId: naverPixelId || null,
          kakaoPixelId: kakaoPixelId || null,
          isGoogleEnabled: isGoogleEnabled || false,
          isFacebookEnabled: isFacebookEnabled || false,
          isNaverEnabled: isNaverEnabled || false,
          isKakaoEnabled: isKakaoEnabled || false,
          metadata: metadata || null,
        },
      });
    } else {
      config = await prisma.marketingConfig.update({
        where: { id: config.id },
        data: {
          googlePixelId: googlePixelId !== undefined ? (googlePixelId || null) : config.googlePixelId,
          googleTagManagerId: googleTagManagerId !== undefined ? (googleTagManagerId || null) : config.googleTagManagerId,
          googleAdsId: googleAdsId !== undefined ? (googleAdsId || null) : config.googleAdsId,
          googleApiKey: googleApiKey !== undefined ? (googleApiKey || null) : config.googleApiKey,
          googleTestMode: googleTestMode !== undefined ? googleTestMode : config.googleTestMode,
          facebookPixelId: facebookPixelId !== undefined ? (facebookPixelId || null) : config.facebookPixelId,
          facebookAppId: facebookAppId !== undefined ? (facebookAppId || null) : config.facebookAppId,
          facebookAccessToken: facebookAccessToken !== undefined ? (facebookAccessToken || null) : config.facebookAccessToken,
          facebookTestMode: facebookTestMode !== undefined ? facebookTestMode : config.facebookTestMode,
          naverPixelId: naverPixelId !== undefined ? (naverPixelId || null) : config.naverPixelId,
          kakaoPixelId: kakaoPixelId !== undefined ? (kakaoPixelId || null) : config.kakaoPixelId,
          isGoogleEnabled: isGoogleEnabled !== undefined ? isGoogleEnabled : config.isGoogleEnabled,
          isFacebookEnabled: isFacebookEnabled !== undefined ? isFacebookEnabled : config.isFacebookEnabled,
          isNaverEnabled: isNaverEnabled !== undefined ? isNaverEnabled : config.isNaverEnabled,
          isKakaoEnabled: isKakaoEnabled !== undefined ? isKakaoEnabled : config.isKakaoEnabled,
          metadata: metadata !== undefined ? metadata : config.metadata,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: '마케팅 설정이 저장되었습니다.',
      config: {
        id: config.id,
        googlePixelId: config.googlePixelId || '',
        googleTagManagerId: config.googleTagManagerId || '',
        googleAdsId: config.googleAdsId || '',
        googleApiKey: config.googleApiKey || '',
        googleTestMode: config.googleTestMode,
        facebookPixelId: config.facebookPixelId || '',
        facebookAppId: config.facebookAppId || '',
        facebookAccessToken: config.facebookAccessToken || '',
        facebookTestMode: config.facebookTestMode,
        naverPixelId: config.naverPixelId || '',
        kakaoPixelId: config.kakaoPixelId || '',
        isGoogleEnabled: config.isGoogleEnabled,
        isFacebookEnabled: config.isFacebookEnabled,
        isNaverEnabled: config.isNaverEnabled,
        isKakaoEnabled: config.isKakaoEnabled,
        metadata: config.metadata,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Marketing Config API] Save error:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const errorStack = error instanceof Error ? error.stack : String(error);
    console.error('[Marketing Config API] Error details:', {
      message: errorMessage,
      stack: errorStack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: '마케팅 설정 저장에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
