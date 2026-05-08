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

// GET: 카카오 채널 UUID 자동 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const adminKey = process.env.KAKAO_ADMIN_KEY;
    const channelPublicId = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID; // CzxgPn
    const channelBotId = process.env.KAKAO_CHANNEL_BOT_ID; // 68693bcd99efce7dbfa950bb
    
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

    console.log('[Kakao Channel UUID] 채널 UUID 자동 조회 시작...');
    console.log('[Kakao Channel UUID] 채널 공개 ID:', channelPublicId);
    console.log('[Kakao Channel UUID] 봇 ID:', channelBotId);

    // 방법 1: 채널 목록 조회 API를 통해 채널 UUID 찾기
    try {
      const channelsListUrl = 'https://kapi.kakao.com/v1/api/talk/channels';
      console.log('[Kakao Channel UUID] 채널 목록 조회 API 호출:', channelsListUrl);
      
      const channelsResponse = await fetch(channelsListUrl, {
        method: 'GET',
        headers: {
          'Authorization': `KakaoAK ${adminKey}`,
        },
      });

      console.log('[Kakao Channel UUID] 채널 목록 조회 응답 상태:', channelsResponse.status);

      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        console.log('[Kakao Channel UUID] 채널 목록 응답:', JSON.stringify(channelsData, null, 2));
        
        const channels = channelsData.elements || channelsData || [];
        console.log('[Kakao Channel UUID] 조회된 채널 수:', channels.length);
        
        // 채널 공개 ID로 매칭되는 채널 찾기
        const matchedChannel = channels.find((ch: any) => {
          const publicId = ch.channel_public_id || ch.public_id || ch.channelPublicId || ch.publicId;
          const id = ch.id || ch.uuid || ch.channel_id || ch.channelId;
          
          console.log('[Kakao Channel UUID] 채널 비교:', {
            publicId,
            id,
            channelPublicId,
            match: publicId === channelPublicId || id === channelPublicId || id === channelBotId,
          });
          
          return publicId === channelPublicId || 
                 id === channelPublicId || 
                 id === channelBotId ||
                 publicId === `_${channelPublicId}` ||
                 publicId === channelPublicId.toLowerCase();
        });
        
        if (matchedChannel) {
          const channelUuid = matchedChannel.uuid || matchedChannel.id || matchedChannel.channel_id || matchedChannel.channelId;
          console.log('[Kakao Channel UUID] ✅ 채널 UUID 찾기 성공:', channelUuid);
          
          return NextResponse.json({
            ok: true,
            channelUuid,
            channelPublicId,
            channelBotId,
            source: 'channels_list_api',
            channelInfo: {
              uuid: matchedChannel.uuid,
              id: matchedChannel.id,
              channel_public_id: matchedChannel.channel_public_id,
              public_id: matchedChannel.public_id,
              name: matchedChannel.name,
            },
            message: '채널 UUID를 성공적으로 찾았습니다.',
          });
        } else {
          console.log('[Kakao Channel UUID] ⚠️ 채널 목록에서 매칭되는 채널을 찾지 못했습니다.');
        }
      } else {
        const errorData = await channelsResponse.json().catch(() => ({}));
        console.error('[Kakao Channel UUID] 채널 목록 조회 실패:', errorData);
      }
    } catch (error) {
      console.error('[Kakao Channel UUID] 채널 목록 조회 중 오류:', error);
    }

    // 방법 2: 채널 친구 목록 조회를 통해 채널 UUID 확인 (채널 공개 ID 사용)
    try {
      const friendsListUrl = `https://kapi.kakao.com/v1/api/talk/channels/${channelPublicId}/friends`;
      console.log('[Kakao Channel UUID] 채널 친구 목록 조회 시도 (공개 ID 사용):', friendsListUrl);
      
      const friendsResponse = await fetch(friendsListUrl, {
        method: 'GET',
        headers: {
          'Authorization': `KakaoAK ${adminKey}`,
        },
      });

      if (friendsResponse.ok) {
        console.log('[Kakao Channel UUID] ✅ 채널 공개 ID로 친구 목록 조회 성공!');
        return NextResponse.json({
          ok: true,
          channelUuid: channelPublicId,
          channelPublicId,
          channelBotId,
          source: 'public_id_direct',
          message: '채널 공개 ID를 직접 사용할 수 있습니다.',
          note: '채널 공개 ID를 채널 UUID로 사용할 수 있습니다.',
        });
      } else {
        const errorData = await friendsResponse.json().catch(() => ({}));
        console.log('[Kakao Channel UUID] 채널 공개 ID로 친구 목록 조회 실패:', errorData);
      }
    } catch (error) {
      console.error('[Kakao Channel UUID] 채널 친구 목록 조회 중 오류:', error);
    }

    // 방법 3: 봇 ID로 채널 정보 조회 시도
    if (channelBotId) {
      try {
        const botChannelUrl = `https://kapi.kakao.com/v1/api/talk/channels/${channelBotId}/friends`;
        console.log('[Kakao Channel UUID] 봇 ID로 채널 친구 목록 조회 시도:', botChannelUrl);
        
        const botResponse = await fetch(botChannelUrl, {
          method: 'GET',
          headers: {
            'Authorization': `KakaoAK ${adminKey}`,
          },
        });

        if (botResponse.ok) {
          console.log('[Kakao Channel UUID] ✅ 봇 ID로 친구 목록 조회 성공!');
          return NextResponse.json({
            ok: true,
            channelUuid: channelBotId,
            channelPublicId,
            channelBotId,
            source: 'bot_id_direct',
            message: '봇 ID를 채널 UUID로 사용할 수 있습니다.',
          });
        } else {
          const errorData = await botResponse.json().catch(() => ({}));
          console.log('[Kakao Channel UUID] 봇 ID로 친구 목록 조회 실패:', errorData);
        }
      } catch (error) {
        console.error('[Kakao Channel UUID] 봇 ID로 채널 조회 중 오류:', error);
      }
    }

    // 모든 방법 실패
    return NextResponse.json({
      ok: false,
      channelPublicId,
      channelBotId,
      message: '채널 UUID를 자동으로 찾을 수 없습니다.',
      instructions: [
        '1. 카카오 고객센터(1599-9400)에 문의하여 채널 UUID를 확인하세요.',
        '2. 또는 카카오톡 채널 관리자센터(https://center-pf.kakao.com/)에서 채널 홈 설정 > 기본 정보에서 채널 ID를 확인하세요.',
        '3. 확인한 채널 UUID를 .env.local 파일에 KAKAO_CHANNEL_UUID로 설정하세요.',
      ],
      triedMethods: [
        '채널 목록 조회 API',
        '채널 공개 ID로 친구 목록 조회',
        '봇 ID로 친구 목록 조회',
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
