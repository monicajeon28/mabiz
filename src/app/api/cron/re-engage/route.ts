export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/re-engage
 * 매일 오전 10시 KST (01:00 UTC) — 이탈 리드 자동 재진입 SMS
 *
 * 이탈 조건:
 *   - type = LEAD (구매 미완료)
 *   - lastContactedAt < 14일 전 (또는 null)
 *   - optOutAt = null (수신거부 아님)
 *   - reEngageCount < 2 (재진입 최대 2회)
 *   - reEngagedAt IS NULL OR reEngagedAt < 7일 전 (7일 간격 재시도)
 *
 * 시스템 기본 메시지 (조직 커스텀이 없으면 사용):
 *   1차: 새로운 크루즈 소식 각도
 *   2차: 마지막 기회 각도
 */

const DEFAULT_MSG_1 =
  "[고객명]님, 안녕하세요! 크루즈닷입니다 🚢\n" +
  "최근 새로운 크루즈 일정이 출시됐어요.\n" +
  "잠깐 시간 되실 때 한번 확인해보세요!\n" +
  "궁금하신 점은 언제든 연락 주세요 😊";

const DEFAULT_MSG_2 =
  "[고객명]님, 크루즈닷입니다.\n" +
  "지난번에 관심 보여주셨는데 혹시 아직 고민 중이신가요?\n" +
  "지금 저희 파트너가 직접 상담해드릴 수 있어요.\n" +
  "편한 시간에 연락 주시면 최적의 일정을 찾아드리겠습니다 🙏";

export async function GET(req: Request) {
  // Cron 보안 검증
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now       = new Date();
  const stale14d  = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const stale7d   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

  logger.log("[Cron/re-engage] 시작", { time: now.toISOString() });

  // 이탈 리드 조회 (조직별로 처리)
  const candidates = await prisma.contact.findMany({
    where: {
      type:         "LEAD",
      optOutAt:     null,
      reEngageCount: { lt: 2 },
      OR: [
        { lastContactedAt: null },
        { lastContactedAt: { lt: stale14d } },
      ],
      AND: [
        {
          OR: [
            { reEngagedAt: null },
            { reEngagedAt: { lt: stale7d } },
          ],
        },
      ],
    },
    select: {
      id: true, name: true, phone: true,
      organizationId: true, reEngageCount: true,
    },
    take: 500, // 1회 최대 500명 처리
  });

  logger.log("[Cron/re-engage] 대상 파악", { count: candidates.length });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  // 조직별 SMS 설정 캐시
  const smsConfigCache: Record<string, Awaited<ReturnType<typeof getOrgSmsConfig>>> = {};

  let sentCount     = 0;
  let skippedCount  = 0;
  let failedCount   = 0;

  for (const contact of candidates) {
    try {
      const orgId = contact.organizationId;

      // SMS 설정 캐시 (동일 조직은 1회만 조회)
      if (!(orgId in smsConfigCache)) {
        smsConfigCache[orgId] = await getOrgSmsConfig(orgId);
      }
      const smsConfig = smsConfigCache[orgId];

      if (!smsConfig) {
        skippedCount++;
        continue;
      }

      // 재진입 메시지 선택 (조직 커스텀 > 시스템 기본)
      const isFirst  = contact.reEngageCount === 0;
      const template = isFirst
        ? (smsConfig.reEngageMsg1 || DEFAULT_MSG_1)
        : (smsConfig.reEngageMsg2 || DEFAULT_MSG_2);

      const msg = template
        .replace(/\[고객명\]/g, contact.name)
        .replace(/\[이름\]/g,   contact.name);

      const result = await sendSms({
        config:         { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
        receiver:       contact.phone,
        msg,
        organizationId: orgId,
        contactId:      contact.id,
        channel:        "FUNNEL",
      });

      const ok = Number(result.result_code) === 1;

      if (ok) {
        // 재진입 상태 + 리드스코어 업데이트
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            reEngagedAt:   now,
            reEngageCount: { increment: 1 },
            lastContactedAt: now,
            // 재진입 시도로 최소 15점 보장 (COLD 유지)
            leadScore: { increment: 15 },
          },
        });
        sentCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      logger.error("[Cron/re-engage] 개별 처리 실패", {
        contactId: contact.id, err,
      });
      failedCount++;
    }
  }

  logger.log("[Cron/re-engage] 완료", { sentCount, skippedCount, failedCount });

  return NextResponse.json({
    ok: true,
    total:    candidates.length,
    sentCount,
    skippedCount,
    failedCount,
  });
}
