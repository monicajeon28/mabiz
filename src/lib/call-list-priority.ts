import prisma from "@/lib/prisma";

export interface CallListItem {
  contactId: string;
  name: string;
  phone: string;
  priority: number;
  funnelStage: "신청" | "문자" | "응답" | "계약";
  psyLens: string;
  psyTip: string;
  daysSince: number;
  lastSmsStatus?: string;
}

export async function generateCallListPriority(
  organizationId: string
): Promise<CallListItem[]> {
  const now = new Date();

  // 모든 연락 대상 Contact 조회
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      deletedAt: null,
      phone: { not: "" }, // 전화번호 있는 것만
    },
  });

  // 병렬로 계약, SMS 조회
  const [contracts, allSmses] = await Promise.all([
    prisma.contractInstance.findMany({
      where: { organizationId },
    }),
    prisma.scheduledSms.findMany({
      where: { organizationId },
    }),
  ]);

  // Map으로 빠른 조회
  const contractMap: Map<string | null, typeof contracts[0]> = new Map();
  contracts.forEach((c) => {
    if (c.contactId) {
      contractMap.set(c.contactId, c);
    }
  });

  const smsMap: Map<string, typeof allSmses> = new Map();
  allSmses.forEach((sms) => {
    if (sms.contactId) {
      if (!smsMap.has(sms.contactId)) {
        smsMap.set(sms.contactId, []);
      }
      smsMap.get(sms.contactId)!.push(sms);
    }
  });

  const callList: CallListItem[] = contacts.map((contact) => {
    const contract = contractMap.get(contact.id);
    const smses = (smsMap.get(contact.id) || []).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // 퍼널 단계 판정
    let funnelStage: "신청" | "문자" | "응답" | "계약" = "신청";
    if (smses.length > 0) {
      funnelStage = "문자";
    }
    if (
      smses.some(
        (s) =>
          s.status === "DELIVERED" ||
          s.status === "OPENED" ||
          s.status === "CLICKED"
      )
    ) {
      funnelStage = "응답";
    }
    if (
      contract &&
      (contract.status === "SIGNED" || contract.status === "COMPLETED")
    ) {
      funnelStage = "계약";
    }

    // 우선도 계산
    let priority = 100;
    const recentSms = smses[0];

    if (
      recentSms?.status === "OPENED" ||
      recentSms?.status === "CLICKED"
    ) {
      priority = 999;
    } else if (
      recentSms?.status === "DELIVERED" &&
      priority < 500
    ) {
      priority = 500;
    }

    if (contract?.expiresAt) {
      const daysLeft = Math.floor(
        (contract.expiresAt.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 2 && daysLeft > 0 && priority < 300) {
        priority = 300;
      }
    }

    const daysSince = Math.floor(
      (now.getTime() - contact.createdAt.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysSince >= 7 && priority === 100) {
      priority = 200;
    }

    // 심리학 렌즈
    let psyLens = "L0";
    let psyTip = "";

    if (
      recentSms?.status === "OPENED" ||
      recentSms?.status === "CLICKED"
    ) {
      psyLens = "L10";
      psyTip =
        "🔥 지금 전화하세요! 고객이 관심 있음. (긴박감) — '제가 원하신 상품이 맞나요?'";
    } else if (
      recentSms?.status === "DELIVERED" &&
      priority >= 500
    ) {
      psyLens = "L2";
      psyTip =
        '💡 SPIN 질문으로 이의 파악 — "어떤 부분이 걱정되세요?" (준비 불안도)';
    } else if (daysSince >= 7) {
      psyLens = "L1";
      psyTip =
        '💡 손실회피 강조 — "이 기회를 놓치면 언제 또 있을지..." (희소성)';
    } else if (contract?.expiresAt) {
      const daysLeft = Math.floor(
        (contract.expiresAt.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 2 && daysLeft > 0) {
        psyLens = "L6";
        psyTip =
          '💡 타이밍 강조 — "이달 말까지 예약하시면 특별혜택!" (타이밍)';
      } else {
        psyLens = "L6";
        psyTip = '💡 기본 타이밍 강조 — "지금이 최적의 타이밍입니다"';
      }
    } else {
      psyLens = "L0";
      psyTip = '💡 기본 정보 수집 — "어떤 일정으로 생각하고 계신가요?"';
    }

    return {
      contactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      priority,
      funnelStage,
      psyLens,
      psyTip,
      daysSince,
      lastSmsStatus: recentSms?.status,
    };
  });

  return callList.sort((a, b) => b.priority - a.priority);
}
