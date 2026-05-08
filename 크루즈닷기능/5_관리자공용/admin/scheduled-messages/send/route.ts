export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: {
        User: {
          select: {
            id: true,
            role: true,
            name: true,
          },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return null;
    }

    return session.User;
  } catch (error) {
    console.error('[Scheduled Messages Send] Auth check error:', error);
    return null;
  }
}

/**
 * POST /api/admin/scheduled-messages/send
 * 예약 메시지 자동 발송 처리
 *
 * 이 API는 크론잡으로 정기적으로 호출되거나 수동으로 트리거됩니다.
 *
 * 로직:
 * 1. 활성화된 예약 메시지 조회
 * 2. 각 메시지의 대상 고객 그룹 멤버 조회
 * 3. 각 멤버의 addedAt 기준으로 발송해야 할 단계 계산
 * 4. 발송 조건 확인 (daysAfter, sendTime)
 * 5. 이미 발송된 로그가 있는지 확인
 * 6. 메시지 발송 및 로그 기록
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    console.log('[Scheduled Messages Send] 자동 발송 프로세스 시작');

    // 현재 시간 (한국 시간 기준)
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentHour = koreaTime.getHours();
    const currentMinute = koreaTime.getMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    console.log('[Scheduled Messages Send] 현재 시각:', currentTimeStr);

    // 활성화된 예약 메시지 조회
    const activeMessages = await prisma.scheduledMessage.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: koreaTime } },
        ],
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
        CustomerGroup: {
          include: {
            CustomerGroupMember: {
              where: {
                releasedAt: null, // 그룹에서 해제되지 않은 멤버만
              },
              include: {
                User_CustomerGroupMember_userIdToUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log(`[Scheduled Messages Send] 활성 메시지 ${activeMessages.length}개 발견`);

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // 각 메시지 처리
    for (const message of activeMessages) {
      console.log(`[Scheduled Messages Send] 메시지 처리: ${message.title} (ID: ${message.id})`);

      if (!message.CustomerGroup) {
        console.log(`[Scheduled Messages Send] 고객 그룹이 지정되지 않음, 스킵`);
        continue;
      }

      const members = message.CustomerGroup.CustomerGroupMember;
      console.log(`[Scheduled Messages Send] 대상 고객 ${members.length}명`);

      // 각 고객별 처리
      for (const member of members) {
        const user = member.User_CustomerGroupMember_userIdToUser;
        const addedAt = new Date(member.addedAt);
        const daysSinceAdded = Math.floor((koreaTime.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24));

        // 각 단계별 발송 여부 확인
        for (const stage of message.ScheduledMessageStage) {
          // 발송 조건 확인
          if (daysSinceAdded < stage.daysAfter) {
            continue; // 아직 발송 시기가 아님
          }

          // 발송 시간 확인 (지정된 경우)
          if (stage.sendTime) {
            const [stageHour, stageMinute] = stage.sendTime.split(':').map(Number);
            // 현재 시간과 정확히 일치하거나 5분 이내인 경우만 발송
            const timeDiff = Math.abs(currentHour * 60 + currentMinute - (stageHour * 60 + stageMinute));
            if (timeDiff > 5) {
              continue; // 발송 시간이 아님
            }
          }

          // 이미 발송된 로그가 있는지 확인
          const existingLog = await prisma.scheduledMessageLog.findFirst({
            where: {
              scheduledMessageId: message.id,
              userId: user.id,
              stageNumber: stage.stageNumber,
              status: 'sent',
            },
          });

          if (existingLog) {
            totalSkipped++;
            continue; // 이미 발송됨
          }

          // 메시지 발송 (실제 발송 로직은 sendMethod에 따라 다름)
          try {
            console.log(`[Scheduled Messages Send] 발송: ${user.name} (${user.id}) - ${stage.stageNumber}회차`);

            // NOTE: 실제 발송 로직 구현 필요 (See GitHub Issue #TBD)
            // - SMS: sendMethod === 'sms' -> SMS API 통합
            // - Email: sendMethod === 'email' -> SMTP 설정
            // - Kakao: sendMethod === 'kakao' -> 카카오톡 API 연동
            // - Cruise Guide: sendMethod === 'cruise-guide' -> 내부 메시지 시스템
            console.log(`[Scheduled Message] Simulated send: ${stage.title} to user ${user.id}`);

            // 발송 로그 기록
            await prisma.scheduledMessageLog.create({
              data: {
                scheduledMessageId: message.id,
                userId: user.id,
                stageNumber: stage.stageNumber,
                sentAt: koreaTime,
                status: 'sent',
                metadata: {
                  sendMethod: message.sendMethod,
                  senderPhone: message.senderPhone,
                  senderEmail: message.senderEmail,
                  title: stage.title,
                  contentLength: stage.content.length,
                },
              },
            });

            totalSent++;
          } catch (error: any) {
            console.error(`[Scheduled Messages Send] 발송 실패:`, error);

            // 실패 로그 기록
            await prisma.scheduledMessageLog.create({
              data: {
                scheduledMessageId: message.id,
                userId: user.id,
                stageNumber: stage.stageNumber,
                sentAt: koreaTime,
                status: 'failed',
                errorMessage: error?.message || '알 수 없는 오류',
              },
            });

            totalFailed++;
          }
        }
      }
    }

    console.log(`[Scheduled Messages Send] 완료: 발송 ${totalSent}건, 스킵 ${totalSkipped}건, 실패 ${totalFailed}건`);

    return NextResponse.json({
      ok: true,
      summary: {
        sent: totalSent,
        skipped: totalSkipped,
        failed: totalFailed,
        processedAt: koreaTime.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Scheduled Messages Send] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to send scheduled messages',
      },
      { status: 500 }
    );
  }
}
