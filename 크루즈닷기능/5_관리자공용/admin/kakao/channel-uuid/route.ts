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
    console.error('[Kakao Channel UUID] Auth check error:', error);
    return null;
  }
}

// GET: 카카오 채널 UUID 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const adminKey = process.env.KAKAO_ADMIN_KEY;
    const channelPublicId = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID;
    
    if (!adminKey) {
      return NextResponse.json(
        { ok: false, error: '카카오 Admin 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (!channelPublicId) {
      return NextResponse.json(
        { ok: false, error: '카카오 채널 공개 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 카카오 채널 정보 조회 API
    // 주의: 카카오 API는 채널 공개 ID로 직접 UUID를 조회할 수 없을 수 있습니다.
    // 대신 채널 친구 목록 조회 API를 통해 채널 UUID를 확인할 수 있습니다.
    
    // 방법 1: 채널 친구 목록 조회를 통해 채널 UUID 확인 시도
    // 하지만 이 방법은 채널 UUID를 직접 반환하지 않을 수 있습니다.
    
    // 방법 2: 카카오 개발자센터에서 확인
    // https://developers.kakao.com/console/app 에서 앱 선택 > 카카오톡 채널 > 채널 정보에서 확인
    
    // 현재는 환경 변수에서 읽어오거나, 사용자에게 수동으로 확인하도록 안내
    const channelUuid = process.env.KAKAO_CHANNEL_UUID;
    
    if (channelUuid) {
      return NextResponse.json({
        ok: true,
        channelUuid,
        channelPublicId,
        source: 'environment',
        message: '환경 변수에서 채널 UUID를 확인했습니다.',
      });
    }

    // 채널 UUID가 없으면 확인 방법 안내
    return NextResponse.json({
      ok: false,
      channelPublicId,
      message: '채널 UUID가 설정되지 않았습니다.',
      instructions: [
        '1. 카카오 개발자센터 접속: https://developers.kakao.com/console/app',
        '2. 앱 선택 (크루즈닷)',
        '3. 좌측 메뉴에서 "카카오톡 채널" 선택',
        '4. "채널 정보" 또는 "채널 관리"에서 채널 UUID 확인',
        '5. 또는 카카오톡 채널 관리자센터: https://center-pf.kakao.com/',
        '6. 채널 선택 > 채널 관리 > 상세설정 > 채널 정보에서 채널 ID 확인',
        '7. 확인한 채널 UUID를 .env.local 파일에 KAKAO_CHANNEL_UUID로 추가',
      ],
    });
  } catch (error) {
    console.error('[Kakao Channel UUID] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '채널 UUID 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
