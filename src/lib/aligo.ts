import { logger } from "@/lib/logger";

interface AligoConfig {
  key: string;
  userId: string;
  sender: string;
}

interface SendSmsParams {
  config: AligoConfig;
  receiver: string;       // 수신 전화번호
  msg: string;            // 메시지 내용
  title?: string;         // LMS/MMS 제목
  msgType?: "SMS" | "LMS";
  // SmsLog 기록용 (선택)
  organizationId?: string;
  contactId?: string;
  channel?: "FUNNEL" | "GROUP" | "MANUAL";
}

interface AligoResponse {
  result_code: number;
  message: string;
  msg_id?: string;
}

// 수신거부 목록 체크
async function isOptedOut(phone: string): Promise<boolean> {
  const { default: prisma } = await import("@/lib/prisma");
  const record = await prisma.smsOptOut.findUnique({ where: { phone } });
  return !!record;
}

// 야간 발송 차단 (21:00 ~ 08:00 KST)
function isNightTime(): boolean {
  // KST = UTC+9 (서버가 UTC인 경우 대비)
  const kstHour = (new Date().getUTCHours() + 9) % 24;
  return kstHour >= 21 || kstHour < 8;
}

// SmsLog fire-and-forget 기록 (실패해도 발송에 영향 없음)
function recordSmsLog(params: {
  organizationId: string;
  contactId?: string;
  phone: string;
  msg: string;
  status: "SENT" | "FAILED" | "BLOCKED";
  blockReason?: string;
  resultCode?: string;
  msgId?: string;
  channel: string;
}) {
  const maskedPhone = params.phone.substring(0, 4) + "***";
  const contentPreview = params.msg.slice(0, 30);

  import("@/lib/prisma").then(({ default: prisma }) =>
    prisma.smsLog.create({
      data: {
        organizationId: params.organizationId,
        contactId:      params.contactId ?? null,
        phone:          maskedPhone,
        contentPreview,
        status:         params.status,
        blockReason:    params.blockReason ?? null,
        resultCode:     params.resultCode ?? null,
        msgId:          params.msgId ?? null,
        channel:        params.channel,
      },
    })
  ).catch((err) => {
    logger.error("[Aligo] SmsLog 저장 실패", { err });
  });
}

export async function sendSms(params: SendSmsParams): Promise<AligoResponse> {
  const {
    config, receiver, msg, title, msgType = "SMS",
    organizationId, contactId, channel = "FUNNEL",
  } = params;

  // 수신거부 체크
  const optedOut = await isOptedOut(receiver);
  if (optedOut) {
    logger.warn("[Aligo] 수신거부 번호 발송 차단", {
      phone: receiver.substring(0, 4) + "***",
    });
    if (organizationId) {
      recordSmsLog({ organizationId, contactId, phone: receiver, msg, status: "BLOCKED", blockReason: "OPT_OUT", channel });
    } else {
      logger.warn("[Aligo] organizationId 미전달 — SmsLog 기록 불가 (수신거부 차단)");
    }
    return { result_code: -99, message: "수신거부 번호" };
  }

  // 야간 발송 차단 (KST 기준)
  if (isNightTime()) {
    logger.warn("[Aligo] 야간 발송 차단 (21:00~08:00 KST)", {
      phone: receiver.substring(0, 4) + "***",
    });
    if (organizationId) {
      recordSmsLog({ organizationId, contactId, phone: receiver, msg, status: "BLOCKED", blockReason: "NIGHT_BLOCK", channel });
    } else {
      logger.warn("[Aligo] organizationId 미전달 — SmsLog 기록 불가 (야간 차단)");
    }
    return { result_code: -98, message: "야간 발송 차단" };
  }

  const formData = new URLSearchParams({
    key:      config.key,
    user_id:  config.userId,
    sender:   config.sender,
    receiver,
    msg,
    msg_type: msgType,
    ...(title && msgType === "LMS" ? { title } : {}),
  });

  try {
    const res  = await fetch("https://apis.aligo.in/send/", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    formData.toString(),
    });
    const data = (await res.json()) as AligoResponse;
    logger.log("[Aligo] 발송 결과", {
      code:  data.result_code,
      phone: receiver.substring(0, 4) + "***",
    });

    if (organizationId) {
      recordSmsLog({
        organizationId, contactId, phone: receiver, msg,
        status:     Number(data.result_code) === 1 ? "SENT" : "FAILED",
        resultCode: String(data.result_code),
        msgId:      data.msg_id,
        channel,
      });
    }
    return data;
  } catch (err) {
    logger.error("[Aligo] 발송 실패", { err });
    if (organizationId) {
      recordSmsLog({ organizationId, contactId, phone: receiver, msg, status: "FAILED", resultCode: "-1", channel });
    }
    return { result_code: -1, message: "발송 오류" };
  }
}

// 조직의 SMS 설정 조회
export async function getOrgSmsConfig(organizationId: string) {
  const { default: prisma } = await import("@/lib/prisma");
  return prisma.orgSmsConfig.findUnique({ where: { organizationId } });
}
