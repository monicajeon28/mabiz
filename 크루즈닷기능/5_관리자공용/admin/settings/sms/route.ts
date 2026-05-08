export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Admin SMS Config] Auth check error:', error);
    return null;
  }
}

// GET: SMS API 설정 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    let config;
    try {
      config = await prisma.adminSmsConfig.findUnique({
        where: { adminId: admin.id },
      });
    } catch (dbError: any) {
      console.error('[Admin SMS Config GET] Database error:', dbError);
      // 테이블이 없는 경우 환경 변수에서 가져오기
      if (dbError?.code === 'P2021' || dbError?.message?.includes('does not exist') || dbError?.message?.includes('no such table')) {
        console.warn('[Admin SMS Config GET] Table does not exist, returning config from env');
        const envApiKey = process.env.ALIGO_API_KEY || '';
        const envUserId = process.env.ALIGO_USER_ID || '';
        const envSenderPhone = process.env.ALIGO_SENDER_PHONE || '';
        const isConfiguredFromEnv = !!(envApiKey && envUserId && envSenderPhone);

        return NextResponse.json({
          ok: true,
          config: {
            provider: 'aligo',
            apiKey: envApiKey,
            userId: envUserId,
            senderPhone: envSenderPhone,
            kakaoSenderKey: process.env.ALIGO_KAKAO_SENDER_KEY || '',
            kakaoChannelId: process.env.ALIGO_KAKAO_CHANNEL_ID || '',
            isActive: isConfiguredFromEnv,
          },
        });
      }
      throw dbError;
    }

    // 설정이 없으면 환경 변수에서 기본값 가져오기
    if (!config) {
      const envApiKey = process.env.ALIGO_API_KEY || '';
      const envUserId = process.env.ALIGO_USER_ID || '';
      const envSenderPhone = process.env.ALIGO_SENDER_PHONE || '';
      // 환경 변수에 필수 값이 모두 있으면 isActive를 true로 설정
      const isConfiguredFromEnv = !!(envApiKey && envUserId && envSenderPhone);

      return NextResponse.json({
        ok: true,
        config: {
          provider: 'aligo',
          apiKey: envApiKey,
          userId: envUserId,
          senderPhone: envSenderPhone,
          kakaoSenderKey: process.env.ALIGO_KAKAO_SENDER_KEY || '',
          kakaoChannelId: process.env.ALIGO_KAKAO_CHANNEL_ID || '',
          isActive: isConfiguredFromEnv,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      config: {
        provider: config.provider,
        apiKey: config.apiKey,
        userId: config.userId,
        senderPhone: config.senderPhone,
        kakaoSenderKey: config.kakaoSenderKey || '',
        kakaoChannelId: config.kakaoChannelId || '',
        isActive: config.isActive,
      },
    });
  } catch (error) {
    console.error('[Admin SMS Config GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'SMS 설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: SMS API 설정 저장/업데이트
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { provider, apiKey, userId, senderPhone, kakaoSenderKey, kakaoChannelId, isActive } = body;

    // 필수 필드 검증
    if (!provider || !apiKey || !userId || !senderPhone) {
      return NextResponse.json(
        { ok: false, error: '필수 필드를 모두 입력해주세요. (제공자, API 키, 사용자 ID, 발신번호)' },
        { status: 400 }
      );
    }

    // 기존 설정 확인
    let existing;
    try {
      existing = await prisma.adminSmsConfig.findUnique({
        where: { adminId: admin.id },
      });
    } catch (dbError: any) {
      console.error('[Admin SMS Config POST] Database query error:', dbError);
      // 테이블이 없는 경우
      if (dbError?.code === 'P2021' || dbError?.message?.includes('does not exist') || dbError?.message?.includes('no such table')) {
        return NextResponse.json(
          { 
            ok: false, 
            error: 'SMS 설정 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션을 실행해주세요.',
            details: 'npx prisma db push 또는 npx prisma migrate dev를 실행하세요.'
          },
          { status: 503 }
        );
      }
      throw dbError;
    }

    try {
      if (existing) {
        // 업데이트
        await prisma.adminSmsConfig.update({
          where: { adminId: admin.id },
          data: {
            provider,
            apiKey,
            userId,
            senderPhone,
            kakaoSenderKey: kakaoSenderKey || null,
            kakaoChannelId: kakaoChannelId || null,
            isActive: isActive !== undefined ? isActive : true,
          },
        });
      } else {
        // 생성
        await prisma.adminSmsConfig.create({
          data: {
            adminId: admin.id,
            provider,
            apiKey,
            userId,
            senderPhone,
            kakaoSenderKey: kakaoSenderKey || null,
            kakaoChannelId: kakaoChannelId || null,
            isActive: isActive !== undefined ? isActive : true,
          },
        });
      }
    } catch (dbError: any) {
      console.error('[Admin SMS Config POST] Database write error:', dbError);
      if (dbError?.code === 'P2021' || dbError?.message?.includes('does not exist') || dbError?.message?.includes('no such table')) {
        return NextResponse.json(
          { 
            ok: false, 
            error: 'SMS 설정 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션을 실행해주세요.',
            details: 'npx prisma db push 또는 npx prisma migrate dev를 실행하세요.'
          },
          { status: 503 }
        );
      }
      throw dbError;
    }

    return NextResponse.json({
      ok: true,
      message: 'SMS API 설정이 저장되었습니다.',
    });
  } catch (error) {
    console.error('[Admin SMS Config POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'SMS 설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
