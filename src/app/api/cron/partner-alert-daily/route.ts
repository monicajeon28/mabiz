import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  updatePartnerRiskScore,
  generateDay03Messages,
} from '@/lib/partner-risk-scoring';
import { sendPartnerAlertSms } from '@/lib/aligo-sms-service';

/**
 * GET /api/cron/partner-alert-daily
 * 일일 파트너 Alert SMS 자동 발송
 *
 * Vercel Cron: 매일 00:00 UTC에 실행
 * @see https://vercel.com/docs/cron-jobs
 */
export async function GET(req: NextRequest) {
  try {
    // Vercel Cron Job 검증
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      logger.warn('[partner-alert-daily] 인증 실패', {
        hasAuthHeader: !!authHeader,
      });
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();

    // 모든 조직 조회
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    logger.log('[partner-alert-daily] 시작', {
      organizationCount: organizations.length,
    });

    let totalSent = 0;
    let totalFailed = 0;

    // 조직별 처리
    for (const org of organizations) {
      try {
        // 해당 조직의 모든 파트너 조회 (Alert가 필요한 파트너)
        const partners = await prisma.partner.findMany({
          where: {
            organizationId: org.id,
            status: 'ACTIVE',
            onboardingStatus: { in: ['IN_PROGRESS', 'COMPLETED'] },
          },
          select: {
            id: true,
            name: true,
            phone: true,
            createdAt: true,
            riskFlags: {
              select: {
                totalRiskScore: true,
              },
            },
          },
        });

        for (const partner of partners) {
          if (!partner.phone) continue;

          try {
            // Risk Score 재계산
            const riskResult = await updatePartnerRiskScore(
              partner.id,
              org.id
            );

            if (!riskResult) {
              totalFailed++;
              continue;
            }

            // 오늘의 Day 결정 (0, 1, 2, 3)
            const daysSinceCreation = Math.floor(
              (Date.now() - partner.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            let targetDay: 'day0' | 'day1' | 'day2' | 'day3' = 'day0';
            if (daysSinceCreation === 1) targetDay = 'day1';
            else if (daysSinceCreation === 2) targetDay = 'day2';
            else if (daysSinceCreation === 3) targetDay = 'day3';

            // 이미 해당 Day SMS를 발송했는지 확인
            const existingSms = await prisma.partnerSmsLog.findFirst({
              where: {
                organizationId: org.id,
                partnerId: partner.id,
                day: targetDay,
                createdAt: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
              },
            });

            if (existingSms) {
              // 이미 발송했으므로 스킵
              continue;
            }

            // Day 0-3 메시지 생성
            const messages = generateDay03Messages(
              riskResult,
              partner.name,
              partner.phone
            );
            const targetMessage = messages[targetDay];

            // SMS 발송
            const smsResult = await sendPartnerAlertSms(
              org.id,
              partner.id,
              targetDay,
              riskResult.level,
              getMessageType(riskResult.level, targetDay),
              targetMessage,
              partner.phone
            );

            if (smsResult.success) {
              totalSent++;
            } else {
              totalFailed++;
            }
          } catch (partnerError: unknown) {
            logger.error('[partner-alert-daily] 파트너 처리 오류', {
              partnerId: partner.id,
              error:
                partnerError instanceof Error
                  ? partnerError.message
                  : String(partnerError),
            });
            totalFailed++;
          }
        }
      } catch (orgError: unknown) {
        logger.error('[partner-alert-daily] 조직 처리 오류', {
          organizationId: org.id,
          error:
            orgError instanceof Error ? orgError.message : String(orgError),
        });
      }
    }

    const elapsedMs = Date.now() - startTime;

    logger.log('[partner-alert-daily] 완료', {
      totalSent,
      totalFailed,
      totalProcessed: totalSent + totalFailed,
      elapsedMs,
    });

    return NextResponse.json({
      ok: true,
      totalSent,
      totalFailed,
      totalProcessed: totalSent + totalFailed,
      elapsedMs,
    });
  } catch (error: unknown) {
    logger.error('[partner-alert-daily] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

function getMessageType(
  riskLevel: 'RED' | 'YELLOW' | 'GREEN',
  day: string
): string {
  if (riskLevel === 'RED') {
    if (day === 'day0' || day === 'day1') return 'URGENT_RETENTION';
    if (day === 'day2' || day === 'day3') return 'URGENT_INCENTIVE';
  }
  if (riskLevel === 'YELLOW') {
    return 'TRAINING_OFFER';
  }
  return 'POSITIVE_REINFORCEMENT';
}
