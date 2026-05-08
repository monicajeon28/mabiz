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
    console.error('[Send Kakao Alimtalk] Auth check error:', error);
    return null;
  }
}

// 전화번호 형식 정규화 (하이픈 제거, 010 형식으로 통일)
const normalizePhone = (phone: string | null): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('010')) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `0${cleaned}`;
  }
  return cleaned.length >= 10 ? cleaned : null;
};

// POST: 카카오 알림톡 발송
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { userIds, mallUserIds, title, content, directPhones } = body;

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 알리고 카카오 알림톡 설정 확인
    const aligoApiKey = process.env.ALIGO_API_KEY;
    const aligoUserId = process.env.ALIGO_USER_ID;
    const aligoKakaoSenderKey = process.env.ALIGO_KAKAO_SENDER_KEY;
    const aligoKakaoTemplateCode = process.env.ALIGO_KAKAO_TEMPLATE_CODE || ''; // 템플릿 코드 (선택사항)

    if (!aligoApiKey || !aligoUserId || !aligoKakaoSenderKey) {
      return NextResponse.json(
        { 
          ok: false, 
          error: '알리고 카카오 알림톡 설정이 완료되지 않았습니다. 관리자 패널에서 확인하세요.',
        },
        { status: 400 }
      );
    }

    // 대상 사용자 조회 (전화번호가 있는 사용자만)
    let targetUsers: Array<{ id: number; name: string | null; phone: string | null }> = [];
    
    console.log('[Send Kakao Alimtalk] Request body:', { userIds, mallUserIds, directPhones: directPhones?.length || 0 });
    
    // 크루즈가이드 사용자
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds.map((id: any) => parseInt(id)) },
          role: 'user',
          phone: { not: null },
        },
        select: { id: true, name: true, phone: true },
      });
      console.log('[Send Kakao Alimtalk] Cruise Guide users found:', users.length, 'out of', userIds.length, 'requested');
      targetUsers = users.filter(u => u.phone !== null).map(u => ({ ...u })) as any;
    }

    // 크루즈몰 사용자
    if (mallUserIds && Array.isArray(mallUserIds) && mallUserIds.length > 0) {
      const mallUsers = await prisma.user.findMany({
        where: {
          id: { in: mallUserIds.map((id: any) => parseInt(id)) },
          role: 'community',
          phone: { not: null },
        },
        select: { id: true, name: true, phone: true },
      });
      console.log('[Send Kakao Alimtalk] Mall users found:', mallUsers.length, 'out of', mallUserIds.length, 'requested');
      const mallUsersList = mallUsers
        .filter(u => u.phone !== null && u.phone.trim() !== '')
        .map(u => ({ ...u })) as any;
      
      const existingPhones = new Set(targetUsers.map(u => u.phone));
      const newMallUsers = mallUsersList.filter((u: any) => !existingPhones.has(u.phone));
      targetUsers = [...targetUsers, ...newMallUsers];
    }

    // 직접 입력된 전화번호 추가
    if (directPhones && Array.isArray(directPhones) && directPhones.length > 0) {
      const validPhones = directPhones
        .filter((phone: string) => phone && phone.trim() && /^[0-9-]+$/.test(phone))
        .map((phone: string) => normalizePhone(phone.trim()))
        .filter((phone: string | null): phone is string => phone !== null);
      
      const existingPhones = new Set(targetUsers.map(u => u.phone));
      const newDirectPhones = validPhones
        .filter((phone: string) => !existingPhones.has(phone))
        .map((phone: string) => ({ 
          id: 0,
          name: null, 
          phone, 
        })) as any;
      
      targetUsers = [...targetUsers, ...newDirectPhones];
      console.log('[Send Kakao Alimtalk] Direct phones added:', newDirectPhones.length);
    }

    console.log('[Send Kakao Alimtalk] Total target users:', targetUsers.length);

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { 
          ok: false, 
          error: '카카오 알림톡을 발송할 고객이 없습니다.',
          message: '전화번호가 등록된 고객이 없거나 선택한 고객이 조건에 맞지 않습니다.',
        },
        { status: 400 }
      );
    }

    // 알리고 카카오 알림톡 API 호출
    const results = [];
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const user of targetUsers) {
      try {
        const normalizedPhone = normalizePhone(user.phone);
        
        if (!normalizedPhone || normalizedPhone.length < 10) {
          failCount++;
          const errorMsg = '유효하지 않은 전화번호입니다.';
          errors.push(`${user.phone || 'N/A'}: ${errorMsg}`);
          results.push({ userId: user.id, phone: user.phone, success: false, error: errorMsg });
          continue;
        }

        // 알리고 카카오 알림톡 API 호출
        // 템플릿 코드가 있으면 템플릿 사용, 없으면 일반 메시지 발송
        const alimtalkApiUrl = aligoKakaoTemplateCode 
          ? 'https://apis.aligo.in/akv10/alimtalk/send/' 
          : 'https://apis.aligo.in/akv10/alimtalk/send/';

        const messageText = `${title}\n\n${content}`;
        
        const requestParams: any = {
          key: aligoApiKey,
          user_id: aligoUserId,
          senderkey: aligoKakaoSenderKey,
          receiver: normalizedPhone,
          receiver_1: normalizedPhone,
        };

        // 템플릿 코드가 있으면 추가
        if (aligoKakaoTemplateCode) {
          requestParams.tpl_code = aligoKakaoTemplateCode;
          // 템플릿 변수 (템플릿에 따라 조정 필요)
          requestParams.variable = JSON.stringify({
            '#{제목}': title,
            '#{내용}': content,
          });
        } else {
          // 템플릿 코드가 없으면 메시지 직접 전송
          requestParams.message = messageText;
        }

        const response = await fetch(alimtalkApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(requestParams),
        });

        const apiResult = await response.json();
        
        // 알리고 API 응답 코드: 1 = 성공, 그 외는 실패
        if (apiResult.result_code === '1') {
          successCount++;
          results.push({ 
            userId: user.id, 
            phone: user.phone, 
            success: true,
            messageId: apiResult.message_id || null,
          });
          console.log(`[Send Kakao Alimtalk] 알림톡 발송 성공: ${user.phone} (메시지 ID: ${apiResult.message_id || 'N/A'})`);
        } else {
          failCount++;
          const errorMsg = apiResult.message || `카카오 알림톡 발송 실패 (코드: ${apiResult.result_code})`;
          errors.push(`${user.phone}: ${errorMsg}`);
          results.push({ userId: user.id, phone: user.phone, success: false, error: errorMsg });
          console.error(`[Send Kakao Alimtalk] 알림톡 발송 실패 (${user.phone}):`, apiResult);
        }
      } catch (apiError) {
        failCount++;
        const errorMessage = apiError instanceof Error ? apiError.message : '알 수 없는 오류';
        errors.push(`${user.phone || 'N/A'}: ${errorMessage}`);
        results.push({ userId: user.id, phone: user.phone, success: false, error: errorMessage });
        console.error(`[Send Kakao Alimtalk] 알리고 API 호출 실패 (${user.phone}):`, apiError);
      }
    }

    // AdminMessage에 기록
    try {
      for (const user of targetUsers) {
        if (user.id && user.id > 0) {
          await prisma.adminMessage.create({
            data: {
              adminId: admin.id,
              userId: user.id,
              title,
              content,
              messageType: 'kakao',
              totalSent: 1,
              updatedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      console.error('[Send Kakao Alimtalk] 메시지 기록 실패:', error);
    }

    return NextResponse.json({
      ok: true,
      totalSent: targetUsers.length,
      successCount,
      failCount,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: successCount > 0 
        ? `카카오 알림톡 발송이 완료되었습니다. (성공: ${successCount}명${failCount > 0 ? `, 실패: ${failCount}명` : ''})`
        : '카카오 알림톡 발송에 실패했습니다.',
    });
  } catch (error) {
    console.error('[Send Kakao Alimtalk] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '카카오 알림톡 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
