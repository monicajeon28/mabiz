import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendSmsWithAligoPublic } from "@/lib/aligo-sms-service";
import { resolveUserSmsConfig } from "@/lib/aligo";
import { resolveSenderUserId } from "@/lib/aligo/sender-resolver";

/**
 * L8 렌즈: 재방문 습관화 SMS 자동 발송 (Cron Job)
 *
 * 실행: 매일 09:00 UTC (한국시간 18:00)
 * 처리:
 * - Day 10 (±1): 크루즈 종료 후 10일 경과
 * - Day 30 (±1): 크루즈 종료 후 30일 경과
 * - Day 60 (±1): 크루즈 종료 후 60일 경과
 * - Day 90 (±1): 크루즈 종료 후 90일 경과
 *
 * 심리학 기법:
 * Day 10: 감정적 재연결 + 호혜성 (설문 → 할인)
 * Day 30: 손실회피 + 희소성 (추억 되찾기 + 시즌 한정)
 * Day 60: 희소성 + 긴박감 (60% 마감 + 3주 남음)
 * Day 90: 손실회피 + 긴박감 (마지막 기회 + 자정 만료)
 */

const SMS_TEMPLATES: Record<number, (name: string, course?: string) => string> = {
  10: (name, _) =>
    `안녕하세요 ${name}님! 크루즈 여행 어떠셨나요? 🚢\n\n짧은 설문 참여 시 다음 예약에서 $50 할인!\n\n[만족도 평가하기]\nhttps://bit.ly/cruise-nps`,

  30: (name, course) =>
    `${name}님, 다음 여행은? 🌍\n\n지난번 ${course || "크루즈"}의 추억을 다시...\n\n✨ 추천: 알래스카 빙하 (6월 출발)\n📸 실제 고객 사진\n💰 조기 예약 $300 추가 할인\n\n[코스 보기]\nhttps://bit.ly/cruise-next`,

  60: (name, course) =>
    `${name}님께 특별 안내 🎁\n\n"${course || "인기 코스"}" 마감까지 3주 남았습니다!\n\n❌ 60% 이미 예약됨\n✅ VIP 고객 우선 배정\n💎 동반자 50% 할인 (제한된 수량)\n\n[지금 예약하기]\nhttps://bit.ly/cruise-limited`,

  90: (name, course) =>
    `${name}님, 마지막 기회입니다 ⏰\n\n크루즈 복귀 고객 최대 25% 할인\n+ 무료 객실 업그레이드 (4박 이상)\n+ 동반자 50% 추가 할인\n\n이 혜택은 오늘 자정에 만료됩니다.\n\n[지금 예약]\nhttps://bit.ly/cruise-lastchance`,
};

interface CronResult {
  day: number;
  total: number;
  sent: number;
  failed: number;
  errors: string[];
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const results: CronResult[] = [];

  try {
    // CRON 인증 확인
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const cronSecret = req.headers.get("x-cron-secret") ?? "";
    const cronBuf = Buffer.from(cronSecret, "utf8");
    const expectedBuf = Buffer.from(expectedToken, "utf8");
    if (cronBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(cronBuf, expectedBuf)) {
      logger.warn("[CRON_AUTH_FAILED]", { cronSecret: "***" });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 모든 조직 가져오기
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    logger.log("[L8_SMS_CRON_START]", {
      organizationCount: organizations.length,
      timestamp: new Date().toISOString(),
    });

    // Day 10, 30, 60, 90 처리
    for (const day of [10, 30, 60, 90]) {
      const dayResult: CronResult = {
        day,
        total: 0,
        sent: 0,
        failed: 0,
        errors: [],
      };

      // 각 조직별로 처리
      for (const org of organizations) {
        const contacts = await getContactsForDay(org.id, day);
        dayResult.total += contacts.length;

        for (const contact of contacts) {
          try {
            const smsText = SMS_TEMPLATES[day](
              contact.name,
              contact.nextCruiseRecommendation || "다음 크루즈"
            );

            // SMS 발송 — 담당자 개인 알리고(미설정 시 조직>env 폴백)
            const senderUserId = resolveSenderUserId({ contactAssignedUserId: contact.assignedUserId });
            const sent = await sendSmsViaAligo(org.id, contact.phone, smsText, senderUserId);

            if (sent) {
              // DB 업데이트
              const fieldName = `smsDay${day}ReturnSent`;
              const fieldNameAt = `smsDay${day}ReturnSentAt`;

              await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  [fieldName]: true,
                  [fieldNameAt]: new Date(),
                },
              });

              dayResult.sent++;
            } else {
              dayResult.failed++;
              dayResult.errors.push(`${contact.id}: SMS send failed`);
            }
          } catch (error) {
            dayResult.failed++;
            dayResult.errors.push(
              `${contact.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      results.push(dayResult);

      logger.log(`[L8_SMS_CRON_DAY${day}]`, {
        total: dayResult.total,
        sent: dayResult.sent,
        failed: dayResult.failed,
      });
    }

    const elapsed = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: elapsed,
      organizationCount: organizations.length,
      results,
      totals: {
        totalContacts: results.reduce((sum, r) => sum + r.total, 0),
        totalSent: results.reduce((sum, r) => sum + r.sent, 0),
        totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      },
    };

    logger.log("[L8_SMS_CRON_COMPLETE]", summary);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error("[L8_SMS_CRON_ERROR]", {
      error: errorMsg,
      executionTimeMs: elapsed,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        executionTimeMs: elapsed,
      },
      { status: 500 }
    );
  }
}

/**
 * 특정 Day에 SMS를 발송해야 할 연락처 조회
 */
async function getContactsForDay(organizationId: string, day: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - day);

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const fieldName = `smsDay${day}ReturnSent`;

  return prisma.contact.findMany({
    where: {
      organizationId,
      lastCruiseEndDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      [fieldName]: false,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      nextCruiseRecommendation: true,
      assignedUserId: true, // 담당자 개인 알리고 발송
    },
  });
}

/**
 * Aligo SMS API를 통해 SMS 발송
 */
async function sendSmsViaAligo(
  organizationId: string,
  phone: string,
  text: string,
  senderUserId?: string, // 담당자 개인 알리고(미설정/미검증 시 조직>env 자동 폴백)
): Promise<boolean> {
  try {
    // SMS 설정 가져오기 (담당자 개인 우선, 복호화된 키)
    const config = await resolveUserSmsConfig(organizationId, senderUserId);

    if (!config) {
      logger.warn("[SMS_CONFIG_INACTIVE]", { organizationId });
      return false;
    }

    const result = await sendSmsWithAligoPublic(
      config.userId,
      config.key,
      config.sender,
      phone,
      text,
    );

    if (result.success) {
      logger.log("[SMS_SENT]", {
        phone: phone.slice(0, 4) + "***",
        textPreview: text.substring(0, 50),
        organizationId,
      });
    }
    return result.success;
  } catch (error) {
    logger.error("[ALIGO_SEND_ERROR]", {
      error: error instanceof Error ? error.message : String(error),
      organizationId,
    });
    return false;
  }
}

/**
 * Vercel Cron 설정 (vercel.json)
 * ```json
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/l8-sms-return-sequence",
 *       "schedule": "0 9 * * *"
 *     }
 *   ]
 * }
 * ```
 *
 * 또는 GitHub Actions를 사용하는 경우:
 * ```yaml
 * name: L8 SMS Return Sequence
 * on:
 *   schedule:
 *     - cron: '0 9 * * *'  # 매일 09:00 UTC
 * jobs:
 *   trigger-cron:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - name: Trigger SMS Cron
 *         run: |
 *           curl -X POST "${{ secrets.CRON_URL }}/api/cron/l8-sms-return-sequence" \
 *             -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
 * ```
 */
