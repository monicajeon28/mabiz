import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  findBackupReminderTargets,
  enrichTargetsWithContactInfo,
  sendPassportBackupSms,
  updateReminderLogAfterSend,
  PASSPORT_BACKUP_SMS_TEMPLATES,
} from '@/lib/passport-backup-reminder-sms';

/**
 * M4-3: Ebbinghaus 망각곡선 기반 OCR 백업 상기 알림
 *
 * 심리학 기법:
 * - L6 (타이밍/손실회피): "24시간 내 데이터 손실 위험" 긴박감
 * - L8 (반복 습관형 성장): 1/3/7/30일 반복으로 습관화
 *
 * 스케줄:
 * - Day 1: 백업 후 24시간 → "데이터 안전을 확인하세요" (PASONA P/A 단계)
 * - Day 3: 백업 후 72시간 → "3일마다 백업하는 습관" (L8)
 * - Day 7: 백업 후 7일 → "주 1회 정기점검" (L8 반복)
 * - Day 30: 백업 후 30일 → "월 1회 자동 백업 활성화" (CTA)
 *
 * 실행 시간: 매일 06:00 UTC (한국시간 15:00 KST)
 * 타임아웃: 55초
 */

export const maxDuration = 55;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 보안: CRON_SECRET 검증 (MABIZ_BACKUP_CRON_SECRET 또는 CRON_SECRET)
    const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.MABIZ_BACKUP_CRON_SECRET || process.env.CRON_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      logger.warn('[ebbinghaus-reminder] 권한 없음', { secret: secret?.substring(0, 10) });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      day1: { sent: 0, failed: 0 },
      day3: { sent: 0, failed: 0 },
      day7: { sent: 0, failed: 0 },
      day30: { sent: 0, failed: 0 },
    };

    // Day 1: 24시간 경과 (1일)
    const day1Targets = await findBackupReminderTargets(1);
    const day1Enriched = await enrichTargetsWithContactInfo(day1Targets);

    await Promise.all(
      day1Enriched.map(async (target) => {
        try {
          const template = PASSPORT_BACKUP_SMS_TEMPLATES[1];
          const message = template.message.replace('고객님', target.contact?.name || '고객님');

          const result = await sendPassportBackupSms({
            phone: target.contact!.phone,
            message,
            dayOffset: 1,
            organizationId: target.organizationId,
            reminderId: target.id,
          });

          if (result.success) {
            await updateReminderLogAfterSend({
              reminderId: target.id,
              dayOffset: 1,
              success: true,
            });
            results.day1.sent++;
          } else {
            results.day1.failed++;
          }
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day1 발송 예외: ${target.id}`, err);
          results.day1.failed++;
        }
      })
    );

    // Day 3: 72시간 경과 (3일)
    const day3Targets = await findBackupReminderTargets(3);
    const day3Enriched = await enrichTargetsWithContactInfo(day3Targets);

    await Promise.all(
      day3Enriched.map(async (target) => {
        try {
          const template = PASSPORT_BACKUP_SMS_TEMPLATES[3];
          const message = template.message.replace('고객님', target.contact?.name || '고객님');

          const result = await sendPassportBackupSms({
            phone: target.contact!.phone,
            message,
            dayOffset: 3,
            organizationId: target.organizationId,
            reminderId: target.id,
          });

          if (result.success) {
            await updateReminderLogAfterSend({
              reminderId: target.id,
              dayOffset: 3,
              success: true,
            });
            results.day3.sent++;
          } else {
            results.day3.failed++;
          }
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day3 발송 예외: ${target.id}`, err);
          results.day3.failed++;
        }
      })
    );

    // Day 7: 7일
    const day7Targets = await findBackupReminderTargets(7);
    const day7Enriched = await enrichTargetsWithContactInfo(day7Targets);

    await Promise.all(
      day7Enriched.map(async (target) => {
        try {
          const template = PASSPORT_BACKUP_SMS_TEMPLATES[7];
          const message = template.message.replace('고객님', target.contact?.name || '고객님');

          const result = await sendPassportBackupSms({
            phone: target.contact!.phone,
            message,
            dayOffset: 7,
            organizationId: target.organizationId,
            reminderId: target.id,
          });

          if (result.success) {
            await updateReminderLogAfterSend({
              reminderId: target.id,
              dayOffset: 7,
              success: true,
            });
            results.day7.sent++;
          } else {
            results.day7.failed++;
          }
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day7 발송 예외: ${target.id}`, err);
          results.day7.failed++;
        }
      })
    );

    // Day 30: 30일
    const day30Targets = await findBackupReminderTargets(30);
    const day30Enriched = await enrichTargetsWithContactInfo(day30Targets);

    await Promise.all(
      day30Enriched.map(async (target) => {
        try {
          const template = PASSPORT_BACKUP_SMS_TEMPLATES[30];
          const message = template.message.replace('고객님', target.contact?.name || '고객님');

          const result = await sendPassportBackupSms({
            phone: target.contact!.phone,
            message,
            dayOffset: 30,
            organizationId: target.organizationId,
            reminderId: target.id,
          });

          if (result.success) {
            await updateReminderLogAfterSend({
              reminderId: target.id,
              dayOffset: 30,
              success: true,
            });
            results.day30.sent++;
          } else {
            results.day30.failed++;
          }
        } catch (err) {
          logger.error(`[ebbinghaus-reminder] Day30 발송 예외: ${target.id}`, err);
          results.day30.failed++;
        }
      })
    );

    // 3. 결과 로깅
    logger.info('[ebbinghaus-reminder] Cron 완료', {
      ...results,
      totalElapsedMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      ...results,
      totalElapsedMs: Date.now() - startTime,
    });
  } catch (err) {
    logger.error('[ebbinghaus-reminder] Cron 실패', err);
    return NextResponse.json(
      { error: 'Reminder failed', details: String(err) },
      { status: 500 }
    );
  }
}

