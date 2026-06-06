import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSms, getOrgSmsConfig } from '@/lib/aligo';

async function sendSmsToContact(
  organizationId: string,
  phoneNumber: string,
  content: string,
  contactId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const smsConfig = await getOrgSmsConfig(organizationId);

  if (!smsConfig || !smsConfig.isActive) {
    return { success: false, error: 'SMS config not found or inactive for organization' };
  }

  const result = await sendSms({
    config: { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
    receiver: phoneNumber,
    msg: content,
    msgType: content.length > 90 ? 'LMS' : 'SMS',
    organizationId,
    contactId,
    channel: 'FUNNEL',
  });

  return result.result_code === 1
    ? { success: true, messageId: result.msg_id }
    : { success: false, error: result.message };
}

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 시크릿 검증 (필수)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'MISCONFIGURED' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // 발송 대기 중이고, 스케줄된 시간이 현재 시간 이전인 메시지 조회
    const now = new Date();
    const pendingMessages = await prisma.crmMarketingMessage.findMany({
      where: {
        status: 'pending',
        scheduledTime: {
          lte: now
        }
      },
      include: {
        contact: true,
        organization: true
      },
      take: 100 // 배치 처리
    });

    const results = {
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      timestamp: now.toISOString(),
      details: [] as any[]
    };

    for (const message of pendingMessages) {
      try {
        // SMS 발송 시도
        const sendResult = await sendSmsToContact(
          message.organizationId,
          message.contact.phone,
          message.content,
          message.contactId
        );

        if (sendResult.success) {
          // 발송 성공 - DB 업데이트
          await prisma.crmMarketingMessage.update({
            where: { id: message.id },
            data: {
              status: 'sent',
              sentTime: now,
              metadata: {
                ...(message.metadata as Record<string, unknown> || {}),
                sentVia: 'aligo',
                aligoMessageId: sendResult.messageId
              }
            }
          });

          // Contact의 SMS 발송 플래그 업데이트
          if (message.day === 0) {
            await prisma.contact.update({
              where: { id: message.contactId },
              data: { smsDay0Sent: true, smsDay0SentAt: now }
            });
          } else if (message.day === 1) {
            await prisma.contact.update({
              where: { id: message.contactId },
              data: { smsDay1Sent: true, smsDay1SentAt: now }
            });
          } else if (message.day === 3) {
            await prisma.contact.update({
              where: { id: message.contactId },
              data: { smsDay3Sent: true, smsDay3SentAt: now }
            });
          }

          results.sentCount++;
          results.details.push({
            messageId: message.id,
            status: 'sent',
            day: message.day,
            segment: message.segment,
            phoneNumber: message.contact.phone,
            aligoMessageId: sendResult.messageId
          });
        } else {
          // 발송 실패 - DB에 실패 기록
          await prisma.crmMarketingMessage.update({
            where: { id: message.id },
            data: {
              status: 'failed',
              metadata: {
                ...(message.metadata as Record<string, unknown> || {}),
                failureReason: sendResult.error,
                failedAt: now.toISOString()
              }
            }
          });

          results.failedCount++;
          results.details.push({
            messageId: message.id,
            status: 'failed',
            day: message.day,
            segment: message.segment,
            error: sendResult.error
          });
        }
      } catch (error) {
        results.failedCount++;
        results.details.push({
          messageId: message.id,
          status: 'error',
          error: '발송 처리 중 오류 발생'
        });
      }

      results.processedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processedCount} messages. Sent: ${results.sentCount}, Failed: ${results.failedCount}`,
      ...results
    });
  } catch (error) {
    console.error('Error in send-scheduled:', error);
    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
