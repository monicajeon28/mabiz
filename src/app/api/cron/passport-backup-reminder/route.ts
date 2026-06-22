export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  validateCronSecret,
  findBackupReminderTargets,
  enrichTargetsWithContactInfo,
  PASSPORT_BACKUP_SMS_TEMPLATES,
  sendPassportBackupSms,
  updateReminderLogAfterSend,
} from "@/lib/passport-backup-reminder-sms";

/**
 * M4-3: Ebbinghaus SMS 알림 — 여권 백업 정기 상기
 *
 * 매일 06:00 UTC (= 15:00 KST) 실행
 *
 * 발송 로직:
 * 1. Day 1: 복구 후 1일 → "백업 완료 + 자동복구 가능"
 * 2. Day 3: 복구 후 3일 → "재확인 + 정기 백업"
 * 3. Day 7: 복구 후 7일 → "1주 유지 + 추가입력 불필요"
 * 4. Day 30: 복구 후 30일 → "1개월 안전 + 신뢰감"
 *
 * 심리학:
 * - L6 (손실회피): "여권 데이터 손실 방지" (Day 1, 3)
 * - L8 (반복 습관): "정기적 백업 권장" (Day 1, 3, 7, 30 간격 증가)
 *
 * 50대 친화:
 * - 기술용어 0개 ("복구", "자동" 포함)
 * - 글자 크기 고려 (문단 최소화)
 * - 다정한 톤 ("안심하세요", "계속 보호")
 */
export async function GET(req: Request) {
  // ── 1. Cron 인증 ────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";

  if (!validateCronSecret(authHeader)) {
    logger.warn("[PassportBackupReminder] 인증 실패", {
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. 시간 범위 검증 (06:00~07:00 UTC, 또는 15:00~16:00 KST) ───
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMin = now.getUTCMinutes();

  // 06:00~07:00 UTC 범위 (1시간)
  if (now.getUTCHours() !== 6) {
    logger.warn("[PassportBackupReminder] 허용 시간 외 실행 시도 — 스킵", {
      utcHour: now.getUTCHours(),
      kstHour,
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "out_of_window" });
  }

  try {
    // ── 3. 각 발송 날짜별 실행 (Day 1, 3, 7, 30) ──────────────────
    const dayOffsets = [1, 3, 7, 30];
    const allResults: Record<
      number,
      {
        dayOffset: number;
        sent: number;
        failed: number;
        errors: Array<{ reminderId: string; reason: string }>;
      }
    > = {};

    for (const dayOffset of dayOffsets) {
      const result = {
        dayOffset,
        sent: 0,
        failed: 0,
        errors: [] as Array<{ reminderId: string; reason: string }>,
      };

      try {
        // 발송 대상 조회
        const targets = await findBackupReminderTargets(dayOffset);

        if (targets.length === 0) {
          logger.log(`[PassportBackupReminder] Day ${dayOffset} 대상 없음`);
          allResults[dayOffset] = result;
          continue;
        }

        logger.log(`[PassportBackupReminder] Day ${dayOffset} 발송 시작`, {
          targetCount: targets.length,
        });

        // Contact 정보 보강
        const enrichedTargets = await enrichTargetsWithContactInfo(targets);

        if (enrichedTargets.length === 0) {
          logger.warn(
            `[PassportBackupReminder] Day ${dayOffset} 연결된 Contact 없음`
          );
          allResults[dayOffset] = result;
          continue;
        }

        // SMS 템플릿 조회
        const template =
          PASSPORT_BACKUP_SMS_TEMPLATES[dayOffset as 1 | 3 | 7 | 30];
        if (!template) {
          logger.error(`[PassportBackupReminder] Day ${dayOffset} 템플릿 없음`);
          allResults[dayOffset] = result;
          continue;
        }

        // 배치별 발송 (병렬 처리, 배치당 10개)
        const batchSize = 10;
        for (let i = 0; i < enrichedTargets.length; i += batchSize) {
          const batch = enrichedTargets.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(enrichedTargets.length / batchSize);

          logger.log(
            `[PassportBackupReminder] Day ${dayOffset} 배치 ${batchNum}/${totalBatches} 처리 중`,
            { count: batch.length }
          );

          const promises = batch.map(async (target) => {
            if (!target.contact) return;

            const smsResult = await sendPassportBackupSms({
              phone: target.contact.phone,
              message: template.message,
              dayOffset,
              organizationId: target.organizationId,
              reminderId: target.id,
            });

            if (smsResult.success) {
              result.sent++;
              await updateReminderLogAfterSend({
                reminderId: target.id,
                dayOffset: dayOffset as 1 | 3 | 7 | 30,
                success: true,
              });
              logger.log(
                `[PassportBackupReminder] Day ${dayOffset} SMS 발송 성공`,
                {
                  reminderId: target.id,
                  msgId: smsResult.msgId,
                }
              );
            } else {
              result.failed++;
              result.errors.push({
                reminderId: target.id,
                reason: smsResult.error ?? "Unknown error",
              });
              await updateReminderLogAfterSend({
                reminderId: target.id,
                dayOffset: dayOffset as 1 | 3 | 7 | 30,
                success: false,
              });
              logger.warn(
                `[PassportBackupReminder] Day ${dayOffset} SMS 발송 실패`,
                {
                  reminderId: target.id,
                  error: smsResult.error,
                }
              );
            }
          });

          await Promise.all(promises);

          // 배치 간 딜레이 (Aligo 레이트 제한: 초당 500건)
          if (i + batchSize < enrichedTargets.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }

        logger.log(
          `[PassportBackupReminder] Day ${dayOffset} 발송 완료`,
          {
            sent: result.sent,
            failed: result.failed,
          }
        );

        allResults[dayOffset] = result;
      } catch (dayErr) {
        logger.error(
          `[PassportBackupReminder] Day ${dayOffset} 오류`,
          {
            error: dayErr instanceof Error ? dayErr.message : String(dayErr),
          }
        );
        allResults[dayOffset] = result;
      }
    }

    // ── 4. 통합 결과 반환 ────────────────────────────────────────
    const totalSent = Object.values(allResults).reduce(
      (sum, r) => sum + r.sent,
      0
    );
    const totalFailed = Object.values(allResults).reduce(
      (sum, r) => sum + r.failed,
      0
    );

    logger.log("[PassportBackupReminder] 전체 발송 완료", {
      totalSent,
      totalFailed,
      byDay: allResults,
    });

    return NextResponse.json({
      ok: true,
      totalSent,
      totalFailed,
      results: allResults,
    });
  } catch (err) {
    logger.error("[PassportBackupReminder] 전체 오류", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
