import { logger } from "@/lib/logger";

interface AligoConfig {
  key: string;
  userId: string;
  sender: string;
}

interface SendSmsParams {
  config: AligoConfig;
  receiver: string;     // 수신 전화번호
  msg: string;          // 메시지 내용
  title?: string;       // LMS/MMS 제목
  msgType?: "SMS" | "LMS";
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

// 야간 발송 차단 (21:00 ~ 08:00)
function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 21 || hour < 8;
}

export async function sendSms(params: SendSmsParams): Promise<AligoResponse> {
  const { config, receiver, msg, title, msgType = "SMS" } = params;

  // 수신거부 체크
  const optedOut = await isOptedOut(receiver);
  if (optedOut) {
    logger.warn("[Aligo] 수신거부 번호 발송 차단", {
      phone: receiver.substring(0, 4) + "***",
    });
    return { result_code: -99, message: "수신거부 번호" };
  }

  // 야간 발송 차단
  if (isNightTime()) {
    logger.warn("[Aligo] 야간 발송 차단 (21:00~08:00)", {
      phone: receiver.substring(0, 4) + "***",
    });
    return { result_code: -98, message: "야간 발송 차단" };
  }

  const formData = new URLSearchParams({
    key: config.key,
    user_id: config.userId,
    sender: config.sender,
    receiver,
    msg,
    msg_type: msgType,
    ...(title && msgType === "LMS" ? { title } : {}),
  });

  try {
    const res = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    const data = (await res.json()) as AligoResponse;
    logger.log("[Aligo] 발송 결과", {
      code: data.result_code,
      phone: receiver.substring(0, 4) + "***",
    });
    return data;
  } catch (err) {
    logger.error("[Aligo] 발송 실패", { err });
    return { result_code: -1, message: "발송 오류" };
  }
}

// 조직의 SMS 설정 조회
export async function getOrgSmsConfig(organizationId: string) {
  const { default: prisma } = await import("@/lib/prisma");
  return prisma.orgSmsConfig.findUnique({ where: { organizationId } });
}
