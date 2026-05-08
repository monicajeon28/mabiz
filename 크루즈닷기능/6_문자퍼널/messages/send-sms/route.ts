export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { backupSmsLog } from '@/lib/message-backup';

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
    console.error('[Send SMS] Auth check error:', error);
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

// 템플릿 변수 치환 함수
const replaceTemplateVariables = (
  text: string,
  name: string,
  phone: string,
  productName: string,
  linkUrl: string
): string => {
  return text
    .replace(/\{이름\}/g, name || '고객')
    .replace(/\{\{이름\}\}/g, name || '고객')
    .replace(/\{연락처\}/g, phone || '')
    .replace(/\{\{연락처\}\}/g, phone || '')
    .replace(/\{상품\}/g, productName || '')
    .replace(/\{\{상품명\}\}/g, productName || '')
    .replace(/\{링크\}/g, linkUrl || '');
};

// POST: SMS 발송
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { title, content, recipients, productName, linkUrl, directPhones, userIds, mallUserIds } = body;

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 대상 사용자 조회 (전화번호가 있는 사용자만)
    let targetUsers: Array<{ id: number; name: string; phone: string }> = [];

    console.log('[Send SMS] Request:', {
      recipientsCount: recipients?.length || 0,
      directPhonesCount: directPhones?.length || 0,
      userIdsCount: userIds?.length || 0,
      mallUserIdsCount: mallUserIds?.length || 0,
      productName: productName || 'N/A',
      linkUrl: linkUrl || 'N/A'
    });

    // 새로운 방식: recipients 배열로 전달 (이름, 전화번호 쌍)
    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      const validRecipients = recipients
        .filter((r: any) => r.phone && r.phone.trim())
        .map((r: any) => ({
          id: 0,
          name: r.name || '고객',
          phone: normalizePhone(r.phone.trim()) || '',
        }))
        .filter(r => r.phone);

      targetUsers = validRecipients;
      console.log('[Send SMS] Recipients from new format:', targetUsers.length);
    }

    // 기존 방식: 크루즈가이드 사용자 ID
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds.map((id: any) => parseInt(id)) },
          role: 'user',
          phone: { not: null },
        },
        select: { id: true, name: true, phone: true },
      });
      console.log('[Send SMS] Cruise Guide users found:', users.length);
      const userList = users
        .filter(u => u.phone !== null)
        .map(u => ({ id: u.id, name: u.name || '고객', phone: u.phone! }));

      const existingPhones = new Set(targetUsers.map(u => u.phone));
      const newUsers = userList.filter(u => !existingPhones.has(u.phone));
      targetUsers = [...targetUsers, ...newUsers];
    }

    // 기존 방식: 크루즈몰 사용자 ID
    if (mallUserIds && Array.isArray(mallUserIds) && mallUserIds.length > 0) {
      const mallUsers = await prisma.user.findMany({
        where: {
          id: { in: mallUserIds.map((id: any) => parseInt(id)) },
          role: 'community',
          phone: { not: null },
        },
        select: { id: true, name: true, phone: true },
      });
      console.log('[Send SMS] Mall users found:', mallUsers.length);
      const mallUsersList = mallUsers
        .filter(u => u.phone !== null && u.phone.trim() !== '')
        .map(u => ({ id: u.id, name: u.name || '고객', phone: u.phone! }));

      const existingPhones = new Set(targetUsers.map(u => u.phone));
      const newMallUsers = mallUsersList.filter(u => !existingPhones.has(u.phone));
      targetUsers = [...targetUsers, ...newMallUsers];
    }

    // 기존 방식: 직접 입력된 전화번호
    if (directPhones && Array.isArray(directPhones) && directPhones.length > 0) {
      const validPhones = directPhones
        .filter((phone: string) => phone && phone.trim() && /^[0-9-]+$/.test(phone))
        .map((phone: string) => normalizePhone(phone.trim()))
        .filter((phone: string | null): phone is string => phone !== null);

      const existingPhones = new Set(targetUsers.map(u => u.phone));
      const newDirectPhones = validPhones
        .filter((phone: string) => !existingPhones.has(phone))
        .map((phone: string) => ({ id: 0, name: '고객', phone }));

      targetUsers = [...targetUsers, ...newDirectPhones];
      console.log('[Send SMS] Direct phones added:', newDirectPhones.length);
    }

    console.log('[Send SMS] Total target users:', targetUsers.length);

    if (targetUsers.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'SMS를 발송할 고객이 없습니다.',
          message: '전화번호가 등록된 고객이 없거나 선택한 고객이 조건에 맞지 않습니다.',
        },
        { status: 400 }
      );
    }

    // SMS 발송
    const results = [];
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // 알리고 API 설정 확인
    const aligoApiKey = process.env.ALIGO_API_KEY;
    const aligoUserId = process.env.ALIGO_USER_ID;
    const aligoSenderPhone = process.env.ALIGO_SENDER_PHONE;

    if (!aligoApiKey || !aligoUserId || !aligoSenderPhone) {
      console.error('[Send SMS] 알리고 API 설정 누락');
      return NextResponse.json(
        {
          ok: false,
          error: '알리고 API 설정이 완료되지 않았습니다.',
          message: '관리자에게 문의하세요. (환경변수: ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_PHONE)',
        },
        { status: 400 }
      );
    }

    for (const user of targetUsers) {
      try {
        const normalizedPhone = normalizePhone(user.phone);

        if (!normalizedPhone || normalizedPhone.length < 10) {
          failCount++;
          const errorMsg = '유효하지 않은 전화번호입니다.';
          errors.push(`${user.phone || 'N/A'}: ${errorMsg}`);
          results.push({ phone: user.phone, success: false, error: errorMsg });
          continue;
        }

        // 템플릿 변수 치환 (각 수신자마다 개별 적용)
        const personalizedTitle = replaceTemplateVariables(title, user.name, normalizedPhone || '', productName || '', linkUrl || '');
        const personalizedContent = replaceTemplateVariables(content, user.name, normalizedPhone || '', productName || '', linkUrl || '');
        const messageText = `${personalizedTitle}\n\n${personalizedContent}`;

        console.log(`[Send SMS] Sending to ${user.name} (${normalizedPhone})`);

        try {
          const smsApiUrl = 'https://apis.aligo.in/send/';

          const response = await fetch(smsApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              key: aligoApiKey,
              user_id: aligoUserId,
              sender: aligoSenderPhone,
              receiver: normalizedPhone,
              msg: messageText,
            }),
          });

          const apiResult = await response.json();

          // 알리고 API 응답 코드: 1 = 성공, 그 외는 실패
          if (apiResult.result_code === '1') {
            successCount++;
            results.push({
              phone: user.phone,
              name: user.name,
              success: true,
              messageId: apiResult.msg_id || null,
            });
            console.log(`[Send SMS] 성공: ${user.name} (${normalizedPhone})`);
          } else {
            failCount++;
            const errorMsg = apiResult.message || `실패 (코드: ${apiResult.result_code})`;
            errors.push(`${user.name} (${user.phone}): ${errorMsg}`);
            results.push({ phone: user.phone, name: user.name, success: false, error: errorMsg });
            console.error(`[Send SMS] 실패 (${user.name}):`, apiResult);
          }
        } catch (apiError) {
          failCount++;
          const errorMessage = apiError instanceof Error ? apiError.message : '알 수 없는 오류';
          errors.push(`${user.name} (${user.phone}): ${errorMessage}`);
          results.push({ phone: user.phone, name: user.name, success: false, error: errorMessage });
          console.error(`[Send SMS] API 호출 실패 (${user.name}):`, apiError);
        }
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        errors.push(`${user.phone || 'N/A'}: ${errorMessage}`);
        results.push({ phone: user.phone, success: false, error: errorMessage });
        console.error(`[Send SMS] 발송 실패:`, error);
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
              messageType: 'sms',
              totalSent: 1,
              updatedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      console.error('[Send SMS] 메시지 기록 실패:', error);
    }

    // Google Spreadsheet 백업 (비동기, 실패해도 메인 응답에 영향 없음)
    backupSmsLog({
      sentAt: new Date(),
      senderName: admin.name || '관리자',
      senderType: 'ADMIN',
      messageType: 'SMS',
      content: `${title}\n\n${content}`,
      recipients: targetUsers.map((u) => ({ name: u.name, phone: u.phone })),
      recipientCount: targetUsers.length,
      status: failCount === 0 ? 'SENT' : failCount === targetUsers.length ? 'FAILED' : 'PARTIAL',
      successCount,
      failCount,
    }).catch((err) => console.error('[Admin SMS Backup] 스프레드시트 백업 실패:', err));

    return NextResponse.json({
      ok: true,
      totalSent: targetUsers.length,
      successCount,
      failCount,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: successCount > 0
        ? `SMS 발송 완료 (성공: ${successCount}명${failCount > 0 ? `, 실패: ${failCount}명` : ''})`
        : 'SMS 발송에 실패했습니다.',
    });
  } catch (error) {
    console.error('[Send SMS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'SMS 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
