export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  requirePartnerContext,
} from '@/app/api/partner/_utils';
import { backupSmsLog } from '@/lib/message-backup';

interface Recipient {
  id?: number;
  name: string;
  phone: string;
}

export async function POST(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const payload = await req.json().catch(() => ({}));

    const { recipients, message, content, title, scheduledAt, productName, linkUrl } = payload as {
      recipients: Recipient[];
      message?: string;
      content?: string;
      title?: string;
      scheduledAt?: string;
      productName?: string;
      linkUrl?: string;
    };

    if (!recipients || recipients.length === 0) {
      throw new PartnerApiError('수신자를 선택해주세요.', 400);
    }

    // message 또는 content 중 하나 사용
    const messageContent = message || content || '';
    if (!messageContent.trim()) {
      throw new PartnerApiError('메시지를 입력해주세요.', 400);
    }

    // SMS 설정 가져오기
    const isManager = profile.type === 'BRANCH_MANAGER';
    let smsConfig;
    if (isManager) {
      smsConfig = await prisma.partnerSmsConfig.findUnique({
        where: { profileId: profile.id },
      });
    } else {
      smsConfig = await prisma.affiliateSmsConfig.findUnique({
        where: { profileId: profile.id },
      });
    }

    if (!smsConfig || !smsConfig.isActive) {
      throw new PartnerApiError('SMS API 설정이 필요합니다. 설정 페이지에서 SMS API를 먼저 설정해주세요.', 400);
    }

    const { apiKey, userId, senderPhone } = smsConfig;

    // 예약 발송인 경우
    if (scheduledAt) {
      // AdminMessage에 예약 메시지 저장
      const scheduledDate = new Date(scheduledAt);

      for (const recipient of recipients) {
        // 치환 태그 처리
        const finalMessage = messageContent
          .replace(/\{이름\}/g, recipient.name || '고객')
          .replace(/\{\{이름\}\}/g, recipient.name || '고객')
          .replace(/\{연락처\}/g, recipient.phone || '')
          .replace(/\{\{연락처\}\}/g, recipient.phone || '')
          .replace(/\{상품\}/g, productName || '')
          .replace(/\{\{상품명\}\}/g, productName || '')
          .replace(/\{링크\}/g, linkUrl || '');

        await prisma.adminMessage.create({
          data: {
            messageType: 'SMS',
            senderId: sessionUser.id,
            recipientType: 'individual',
            recipientCount: 1,
            content: finalMessage,
            status: 'SCHEDULED',
            scheduledAt: scheduledDate,
            targetFilters: {
              phone: recipient.phone,
              name: recipient.name,
              leadId: recipient.id,
              profileId: profile.id,
            },
          },
        });
      }

      return NextResponse.json({
        ok: true,
        message: `${recipients.length}건의 SMS가 예약되었습니다.`,
        scheduled: true,
        scheduledAt: scheduledDate.toISOString(),
      });
    }

    // 즉시 발송
    const ALIGO_BASE_URL = 'https://apis.aligo.in';
    const results: { phone: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        // 치환 태그 처리
        const finalMessage = messageContent
          .replace(/\{이름\}/g, recipient.name || '고객')
          .replace(/\{\{이름\}\}/g, recipient.name || '고객')
          .replace(/\{연락처\}/g, recipient.phone || '')
          .replace(/\{\{연락처\}\}/g, recipient.phone || '')
          .replace(/\{상품\}/g, productName || '')
          .replace(/\{\{상품명\}\}/g, productName || '')
          .replace(/\{링크\}/g, linkUrl || '');

        const messageByteLength = new Blob([finalMessage]).size;
        const msgType = messageByteLength > 90 ? 'LMS' : 'SMS';

        const formData = new URLSearchParams();
        formData.append('key', apiKey);
        formData.append('user_id', userId);
        formData.append('sender', senderPhone);
        formData.append('receiver', recipient.phone.replace(/[^0-9]/g, ''));
        formData.append('msg', finalMessage);
        formData.append('msg_type', msgType);

        const response = await fetch(`${ALIGO_BASE_URL}/send/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: formData.toString(),
        });

        const result = await response.json();

        if (result.result_code === '1') {
          results.push({ phone: recipient.phone, success: true });
        } else {
          results.push({
            phone: recipient.phone,
            success: false,
            error: result.message || `오류 코드: ${result.result_code}`,
          });
        }
      } catch (error) {
        results.push({
          phone: recipient.phone,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // 발송 로그 기록
    await prisma.adminMessage.create({
      data: {
        messageType: 'SMS',
        senderId: sessionUser.id,
        recipientType: recipients.length > 1 ? 'bulk' : 'individual',
        recipientCount: recipients.length,
        content: messageContent,
        status: failCount === 0 ? 'SENT' : failCount === recipients.length ? 'FAILED' : 'PARTIAL',
        sentAt: new Date(),
        targetFilters: {
          recipients: recipients.map((r) => ({ name: r.name, phone: r.phone, leadId: r.id })),
          profileId: profile.id,
          results,
        },
      },
    });

    // Google Spreadsheet 백업 (비동기, 실패해도 메인 응답에 영향 없음)
    backupSmsLog({
      sentAt: new Date(),
      senderName: profile.displayName || sessionUser.name || '파트너',
      senderType: isManager ? 'BRANCH_MANAGER' : 'SALES_AGENT',
      messageType: 'SMS',
      content: messageContent,
      recipients: recipients.map((r) => ({ name: r.name, phone: r.phone })),
      recipientCount: recipients.length,
      status: failCount === 0 ? 'SENT' : failCount === recipients.length ? 'FAILED' : 'PARTIAL',
      successCount,
      failCount,
    }).catch((err) => console.error('[SMS Backup] 스프레드시트 백업 실패:', err));

    return NextResponse.json({
      ok: true,
      message: `총 ${recipients.length}건 중 ${successCount}건 발송 성공${failCount > 0 ? `, ${failCount}건 실패` : ''}`,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Partner Message Center Send SMS] Error:', error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'SMS 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
