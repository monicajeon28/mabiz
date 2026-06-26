import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * 고객 DB 공유·변경 알림 헬퍼 (콜로케이션, contacts 도메인 전용)
 *
 * ⚠️ 스키마 제약(중요):
 *   라이브 DB의 AdminNotification.userId 컬럼은 integer 이고 organizationId 컬럼은 없다.
 *   반면 CRM 사용자(OrganizationMember.id) 와 ctx.userId 는 String(cuid) 이다.
 *   → 정수 userId 컬럼에는 NULL 을 넣고, 수신자/조직/고객 라우팅 정보는
 *     모두 metadata(JSON) 안에 문자열로 저장한다. (스키마 변경 회피)
 *
 *   feed/route.ts 는 이 metadata 키들을 읽어 역할별로 필터링한다:
 *     - AGENT : metadata->>'recipientUserId' = ctx.userId
 *     - OWNER : metadata->>'organizationId'  = orgId
 *
 * 알림 타입(notificationType):
 *   CONTACT_SHARED      고객 DB를 전달받음
 *   CONTACT_UPDATED     공유받은 고객 정보가 수정됨
 *   CONTACT_NOTE_ADDED  공유받은 고객에 메모/콜기록이 추가됨
 */

export type ContactNotificationType =
  | "CONTACT_SHARED"
  | "CONTACT_UPDATED"
  | "CONTACT_NOTE_ADDED";

interface NotifyInput {
  /** 수신자 OrganizationMember.id 목록 (문자열). 중복·빈값은 내부에서 제거 */
  recipientUserIds: Array<string | null | undefined>;
  /** 알림이 속한 조직 (수신자 조직). feed OWNER 필터용 */
  organizationId: string | null;
  notificationType: ContactNotificationType;
  title: string;
  content: string;
  /** 관련 고객 id (클릭 시 이동·중복판단용) */
  contactId: string;
  /** 보낸/변경한 사람 id — 본인에게는 알림 보내지 않음 */
  actorUserId?: string;
}

/**
 * 공유받은 사람들에게 알림 생성 (fire-and-forget 안전).
 * userId 정수 컬럼은 NULL, 라우팅은 metadata 로만 처리한다.
 */
export async function notifyContactShareEvent(input: NotifyInput): Promise<void> {
  try {
    const recipients = [
      ...new Set(
        input.recipientUserIds.filter(
          (uid): uid is string =>
            typeof uid === "string" && uid.length > 0 && uid !== input.actorUserId
        )
      ),
    ];
    if (recipients.length === 0) return;

    await prisma.adminNotification.createMany({
      data: recipients.map((recipientUserId) => ({
        // 정수 컬럼 — CRM member(cuid)는 담을 수 없으므로 NULL.
        userId: null,
        notificationType: input.notificationType,
        title: input.title,
        content: input.content,
        priority: "normal",
        isRead: false,
        metadata: {
          recipientUserId,
          organizationId: input.organizationId,
          contactId: input.contactId,
          actorUserId: input.actorUserId ?? null,
        },
      })),
    });
  } catch (err) {
    // 알림 실패는 본 작업(공유·수정)을 막지 않는다.
    logger.error("[notifyContactShareEvent] 알림 생성 실패", {
      notificationType: input.notificationType,
      contactId: input.contactId,
      err,
    });
  }
}

/**
 * 특정 고객을 공유받은 사람(ContactSharing.sharedTo) 전원 조회.
 * sharedBy 기준 없이 contactId 로 모은 뒤 중복 제거한다.
 */
export async function getContactSharedRecipients(
  contactId: string
): Promise<string[]> {
  try {
    const rows = await prisma.contactSharing.findMany({
      where: { contactId },
      select: { sharedTo: true },
    });
    return [...new Set(rows.map((r) => r.sharedTo).filter(Boolean))];
  } catch (err) {
    logger.error("[getContactSharedRecipients] 조회 실패", { contactId, err });
    return [];
  }
}
