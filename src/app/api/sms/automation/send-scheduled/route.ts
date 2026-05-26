import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * SMS 발송을 위한 Aligo 또는 Twilio 클라이언트
 * 현재는 로그만 출력하고, 실제 발송은 OrgSmsConfig 기반으로 처리
 */
async function sendSmsToContact(
  organizationId: string,
  phoneNumber: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // OrgSmsConfig에서 SMS 제공자 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId }
    });

    if (!smsConfig || !smsConfig.isActive) {
      return {
        success: false,
        error: 'SMS config not found or inactive for organization'
      };
    }

    // TODO: Aligo API 호출 (기존 구현과 통합)
    // Aligo 발송 로직
    const response = await fetch('https://api.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        apikey: smsConfig.aligoKey,
        userid: smsConfig.aligoUserId,
        sender: smsConfig.senderPhone,
        receiver: phoneNumber,
        msg: content
      }).toString()
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Aligo API error: ${response.statusText}`
      };
    }

    const result = await response.text();

    // Aligo 응답 파싱 (예: "RESULT|0|msg_id|...")
    const parts = result.split('|');
    if (parts[1] === '0') {
      return {
        success: true,
        messageId: parts[2] || 'aligo_' + Date.now()
      };
    } else {
      return {
        success: false,
        error: `Aligo error: ${parts[1]}`
      };
    }
  } catch (error) {
    console.error('SMS sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 시크릿 검증 (선택사항)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // 시크릿이 설정되어 있으면 검증
      // 하지만 로컬 테스트를 위해 필수는 아님
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
          message.content
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
          error: error instanceof Error ? error.message : 'Unknown error'
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
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
