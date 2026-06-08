import { logger } from "@/lib/logger";

export interface AligoConfig {
  key: string;
  userId: string;
  sender: string;
}

/**
 * 한글 메시지 인코딩 검증 결과
 */
export interface EncodingValidationResult {
  valid: boolean;
  encoding: 'UTF-8' | 'EUC-KR';
  bytes: number;
  messageType: 'SMS' | 'LMS';
  issues: string[];
}

/**
 * 메시지 바이트 수 계산 (Aligo EUC-KR 기준)
 * 한글 1자 = 2바이트, ASCII 1자 = 1바이트
 * @param msg 메시지 문자열
 * @returns 바이트 수
 */
export function calculateMessageBytes(msg: string): number {
  let bytes = 0;
  for (const ch of msg) {
    bytes += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return bytes;
}

/**
 * 메시지 타입 자동 감지 (EUC-KR 바이트 기준)
 * 80바이트 초과 시 LMS, 이하 SMS
 * @param msg 메시지 문자열
 * @returns SMS | LMS
 */
export function detectMessageType(msg: string): 'SMS' | 'LMS' {
  const bytes = calculateMessageBytes(msg);
  return bytes > 80 ? 'LMS' : 'SMS';
}

/**
 * 한글 메시지 인코딩 검증
 * - EUC-KR 인코딩 가능 여부 확인
 * - 바이트 길이 검증 (SMS: 최대 80바이트, LMS: 최대 2000바이트)
 * - 특수 문자 검증
 * @param msg 메시지 문자열
 * @returns EncodingValidationResult
 */
export function validateKoreanMessage(msg: string): EncodingValidationResult {
  const issues: string[] = [];

  // 바이트 계산
  const bytes = calculateMessageBytes(msg);
  const messageType = detectMessageType(msg);

  // LMS 최대 길이: 2000바이트 (약 1000자 한글)
  const MAX_SMS_BYTES = 80;
  const MAX_LMS_BYTES = 2000;

  if (messageType === 'SMS' && bytes > MAX_SMS_BYTES) {
    issues.push(`SMS 초과: ${bytes}바이트 > ${MAX_SMS_BYTES}바이트 (자동으로 LMS로 전환됩니다)`);
  }

  if (messageType === 'LMS' && bytes > MAX_LMS_BYTES) {
    issues.push(`LMS 초과: ${bytes}바이트 > ${MAX_LMS_BYTES}바이트 (메시지를 단축해야 합니다)`);
  }

  // EUC-KR 인코딩 불가능한 문자 감지
  // (일반적으로 최신 한글은 대부분 EUC-KR 지원하지만, 고급 한글 또는 Emoji는 문제 가능)
  const problematicChars: string[] = [];
  for (const ch of msg) {
    const charCode = ch.charCodeAt(0);
    // Emoji 범위 (U+1F300 ~ U+1F9FF) 또는 기타 확장 문자
    if (charCode > 0xFFFF || (charCode >= 0xD800 && charCode <= 0xDBFF)) {
      // Surrogate pair (Emoji, 고급 심볼 등)
      problematicChars.push(ch);
    }
  }

  if (problematicChars.length > 0) {
    const uniqueChars = [...new Set(problematicChars)].slice(0, 5).join('');
    issues.push(`EUC-KR 미지원 문자 감지: ${uniqueChars}... (이모지, 특수 심볼 등)`);
  }

  // 공백만 있는 메시지 검증
  if (msg.trim().length === 0) {
    issues.push('메시지가 비어있습니다');
  }

  const valid = issues.length === 0;

  return {
    valid,
    encoding: 'EUC-KR', // Aligo는 EUC-KR 기반, UTF-8 입력은 자동 변환됨
    bytes,
    messageType,
    issues,
  };
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

// SmsLog Redis 큐 기록 (fire-and-forget, DB 오버로드 방지)
async function recordSmsLog(params: {
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
  const { addSmsLog } = await import("@/lib/sms-queue");

  try {
    await addSmsLog({
      organizationId: params.organizationId,
      contactId:      params.contactId ?? null,
      phone:          params.phone,
      msg:            params.msg,
      status:         params.status,
      blockReason:    params.blockReason ?? null,
      resultCode:     params.resultCode ?? null,
      msgId:          params.msgId ?? null,
      channel:        params.channel,
    });
  } catch (err) {
    logger.error("[Aligo] SmsLog 큐 추가 실패", { err });
  }
}

export async function sendSms(params: SendSmsParams): Promise<AligoResponse> {
  const {
    config, receiver, msg, title, msgType,
    organizationId, contactId, channel = "FUNNEL",
  } = params;

  // 1️⃣ 한글 메시지 인코딩 검증
  const encodingResult = validateKoreanMessage(msg);
  if (!encodingResult.valid) {
    logger.warn("[Aligo] 한글 인코딩 경고", {
      receiver: receiver.substring(0, 4) + "***",
      bytes: encodingResult.bytes,
      messageType: encodingResult.messageType,
      issues: encodingResult.issues,
    });
    // ⚠️ 경고만 출력하고 계속 진행 (사용자가 판단)
    // Option: 심각한 오류(LMS 초과)는 발송 중단하도록 변경 가능
    if (encodingResult.messageType === 'LMS' && encodingResult.bytes > 2000) {
      logger.error("[Aligo] LMS 최대 길이 초과 — 발송 중단", {
        receiver: receiver.substring(0, 4) + "***",
        bytes: encodingResult.bytes,
      });
      if (organizationId) {
        recordSmsLog({
          organizationId, contactId, phone: receiver, msg,
          status: "FAILED", blockReason: "LMS_BYTE_LIMIT_EXCEEDED", channel,
        });
      }
      return { result_code: -97, message: "LMS 메시지 길이 초과 (2000바이트 이하여야 합니다)" };
    }
  }

  // 2️⃣ msg_type 자동 감지 (명시적으로 지정되지 않으면)
  const finalMsgType = msgType || detectMessageType(msg);

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
    msg_type: finalMsgType,
    ...(title && finalMsgType === "LMS" ? { title } : {}),
  });

  try {
    // ✅ AbortController + 8초 타임아웃 (Vercel 10초 limit 대비)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch("https://apis.aligo.in/send/", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    formData.toString(),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const data = (await res.json()) as AligoResponse;
    logger.log("[Aligo] 발송 결과", {
      code:  data.result_code,
      phone: receiver.substring(0, 4) + "***",
      bytes: encodingResult.bytes,
      type:  finalMsgType,
      msgId: data.msg_id,
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
    logger.error("[Aligo] 발송 실패", {
      err,
      bytes: encodingResult.bytes,
      type: finalMsgType,
    });
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

/**
 * 사용자 → 조직 → 환경변수 순으로 알리고 설정 resolve
 * userId가 없으면 조직/환경변수 fallback
 */
export async function resolveUserSmsConfig(
  organizationId: string,
  userId?: string
): Promise<AligoConfig | null> {
  const { default: prisma } = await import("@/lib/prisma");
  const { decrypt } = await import("@/lib/crypto");

  // 1. 개인 알리고 설정
  if (userId) {
    const userCfg = await prisma.userSmsConfig.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    // 발신번호 미검증(senderVerified=false)인 개인 설정은 사용하지 않고 조직>env로 폴백한다.
    // (미검증 발신번호로 발송하면 Aligo가 전건 거부 → 개인 경로가 short-circuit되어 메시지가 끊김)
    if (userCfg?.isActive && !userCfg.senderVerified) {
      logger.warn("[aligo] 개인 발신번호 미검증(senderVerified=false) → 조직/시스템 발신으로 폴백", {
        organizationId,
        userId,
      });
    }
    // senderVerified=true인 개인 설정만 개인 발송에 사용
    if (userCfg?.isActive && userCfg.senderVerified) {
      try {
        const key = decrypt(userCfg.aligoKeyEncrypted, "SMS_ENCRYPT_KEY");
        return { key, userId: userCfg.aligoUserId, sender: userCfg.senderPhone };
      } catch (err) {
        // 복호화 실패 시 silent하지 않게 organizationId/userId를 남기고 OrgSmsConfig로 폴백
        logger.error("[aligo] UserSmsConfig 복호화 실패 — OrgSmsConfig로 fallback", { organizationId, userId, err });
      }
    }
  }

  // 2. 조직 알리고 설정
  // OrgSmsConfig.aligoKey는 settings/sms 저장 시 encrypt(_,"SMS_ENCRYPT_KEY")로 암호화된다
  // (verify 라우트도 decrypt해서 사용). 개인 경로와 동일하게 복호화해야 평문 키가 나온다.
  // 복호화 실패(키 회전/구평문 데이터) 시 env로 폴백.
  const orgCfg = await prisma.orgSmsConfig.findUnique({ where: { organizationId } });
  if (orgCfg?.isActive) {
    try {
      const orgKey = decrypt(orgCfg.aligoKey, "SMS_ENCRYPT_KEY");
      return { key: orgKey, userId: orgCfg.aligoUserId, sender: orgCfg.senderPhone };
    } catch (err) {
      logger.error("[aligo] OrgSmsConfig aligoKey 복호화 실패 — env로 fallback", { organizationId, err });
    }
  }

  // 3. 환경변수 fallback
  const key = process.env.ALIGO_API_KEY;
  const aligoUserId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER_PHONE;
  if (key && aligoUserId && sender) return { key, userId: aligoUserId, sender };

  return null;
}

/** Aligo에 등록된 발신번호 목록 조회 후 검증 */
export async function verifySenderNumber(config: AligoConfig): Promise<boolean> {
  try {
    const formData = new URLSearchParams({ key: config.key, user_id: config.userId });
    // ✅ AbortController + 8초 타임아웃 (Vercel 10초 limit 대비)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch('https://apis.aligo.in/sender/', {
        method: 'POST',
        body: formData.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const data = await res.json() as { list?: { flag: string; telnum: string }[] };
    return Array.isArray(data.list) &&
      data.list.some((item) => item.flag === '1' && item.telnum === config.sender);
  } catch {
    return false; // 네트워크 오류 시 검증 불가 → false (저장은 허용, 경고만)
  }
}

// ─── 카카오 알림톡 (Aligo 카카오 API) ─────────────────────────

interface SendKakaoParams {
  config: AligoConfig;
  receiver: string;
  templateCode: string;    // Aligo에 등록된 템플릿 코드
  subject?: string;        // 알림톡 제목
  message: string;         // 템플릿에 맞는 메시지 본문
  buttonTitle?: string;    // 버튼 텍스트
  buttonUrl?: string;      // 버튼 URL
  failoverSms?: boolean;   // 실패 시 SMS 대체 발송
  organizationId?: string;
  contactId?: string;
  channel?: string;
}

/**
 * Aligo 카카오 알림톡 발송
 * API: https://kakaoapi.aligo.in/akv10/alimtalk/send/
 *
 * 사전 조건:
 * - Aligo 계정에서 카카오 알림톡 활성화
 * - 카카오 채널 연동 완료
 * - 템플릿 검수 승인 완료
 */
export async function sendKakaoAlimtalk(params: SendKakaoParams): Promise<AligoResponse> {
  const {
    config, receiver, templateCode, subject, message, buttonTitle, buttonUrl,
    failoverSms = true, organizationId, contactId, channel = "MANUAL",
  } = params;

  // 수신거부 체크
  const optedOut = await isOptedOut(receiver);
  if (optedOut) {
    if (organizationId) {
      recordSmsLog({ organizationId, contactId, phone: receiver, msg: message, status: "BLOCKED", blockReason: "OPT_OUT", channel });
    }
    return { result_code: -99, message: "수신거부 번호" };
  }

  // 야간 차단
  if (isNightTime()) {
    if (organizationId) {
      recordSmsLog({ organizationId, contactId, phone: receiver, msg: message, status: "BLOCKED", blockReason: "NIGHT_BLOCK", channel });
    }
    return { result_code: -98, message: "야간 발송 차단" };
  }

  const apiKey = process.env.ALIGO_KAKAO_API_KEY ?? config.key;
  const senderKey = process.env.ALIGO_KAKAO_SENDER_KEY;

  if (!senderKey) {
    logger.warn("[Aligo/Kakao] ALIGO_KAKAO_SENDER_KEY 미설정 — SMS 대체 발송");
    // 카카오 설정이 안 되어 있으면 SMS로 대체
    if (failoverSms) {
      return sendSms({ config, receiver, msg: message, organizationId, contactId, channel: channel as "FUNNEL" | "GROUP" | "MANUAL" });
    }
    return { result_code: -97, message: "카카오 설정 미완료" };
  }

  const formData = new URLSearchParams({
    apikey: apiKey,
    userid: config.userId,
    senderkey: senderKey,
    tpl_code: templateCode,
    sender: config.sender,
    receiver_1: receiver.replace(/[^0-9]/g, ''),
    subject_1: subject ?? '',
    message_1: message,
    ...(failoverSms ? { failover: 'Y', fsubject_1: subject ?? '', fmessage_1: message } : {}),
  });

  // 버튼 추가
  if (buttonTitle && buttonUrl) {
    formData.set('button_1', JSON.stringify({
      button: [{ name: buttonTitle, linkType: 'WL', linkTypeName: '웹링크', linkMo: buttonUrl, linkPc: buttonUrl }],
    }));
  }

  try {
    // ✅ AbortController + 8초 타임아웃 (Vercel 10초 limit 대비)
    const kakaoController = new AbortController();
    const kakaoTimeoutId = setTimeout(() => kakaoController.abort(), 8000);
    let res: Response;
    try {
      res = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
        signal: kakaoController.signal,
      });
    } finally {
      clearTimeout(kakaoTimeoutId);
    }
    const data = (await res.json()) as AligoResponse;

    logger.log("[Aligo/Kakao] 알림톡 발송 결과", {
      code: data.result_code,
      phone: receiver.substring(0, 4) + "***",
    });

    if (organizationId) {
      recordSmsLog({
        organizationId, contactId, phone: receiver, msg: message,
        status: Number(data.result_code) === 0 ? "SENT" : "FAILED",
        resultCode: String(data.result_code),
        msgId: data.msg_id,
        channel: channel + "_KAKAO",
      });
    }
    return data;
  } catch (err) {
    logger.error("[Aligo/Kakao] 알림톡 발송 실패", { err });
    // 실패 시 SMS 대체 발송
    if (failoverSms) {
      logger.log("[Aligo/Kakao] SMS 대체 발송 시도");
      return sendSms({ config, receiver, msg: message, organizationId, contactId, channel: channel as "FUNNEL" | "GROUP" | "MANUAL" });
    }
    return { result_code: -1, message: "발송 오류" };
  }
}

// ─── 퍼널 3채널 통합 발송 ────────────────────────────────────────

interface SendByChannelParams {
  channel: "SMS" | "EMAIL" | "KAKAO";
  smsConfig: AligoConfig;
  receiver: string;        // 전화번호 (SMS/KAKAO)
  email?: string | null;   // 이메일 주소 (EMAIL)
  msg: string;
  subject?: string;        // 이메일 제목 / 카카오 제목
  templateCode?: string;   // 카카오 알림톡 템플릿
  linkUrl?: string | null;
  organizationId: string;
  contactId?: string;
}

/**
 * 채널별 자동 분기 발송
 * - Cron과 enroll에서 이 함수 하나로 통합 호출
 * - 반환값: result_code 1 = 성공
 */
export async function sendByChannel(params: SendByChannelParams): Promise<AligoResponse> {
  const {
    channel, smsConfig, receiver, email, msg, subject,
    templateCode, linkUrl, organizationId, contactId,
  } = params;

  // 메시지에 [링크] 치환
  const finalMsg = linkUrl ? msg.replace(/\[링크\]/g, linkUrl) : msg;

  switch (channel) {
    case "EMAIL": {
      if (!email) {
        logger.warn("[sendByChannel] EMAIL 채널인데 이메일 주소 없음", { contactId });
        return { result_code: -96, message: "이메일 주소 없음" };
      }
      const { sendFunnelEmail } = await import("@/lib/email");
      const result = await sendFunnelEmail({
        organizationId,
        contactId,
        to: email,
        subject: subject || "안내드립니다",
        html: `<div style="font-family:sans-serif;line-height:1.8;white-space:pre-wrap">${finalMsg}</div>`,
      });
      return { result_code: result.result_code, message: result.message };
    }

    case "KAKAO": {
      return sendKakaoAlimtalk({
        config: smsConfig,
        receiver,
        templateCode: templateCode || "FUNNEL_DEFAULT",
        subject,
        message: finalMsg,
        failoverSms: true,
        organizationId,
        contactId,
        channel: "FUNNEL",
      });
    }

    case "SMS":
    default: {
      // msg_type 자동 감지로 변경 (바이트 기준, 문자 길이 아님)
      return sendSms({
        config: smsConfig,
        receiver,
        msg: finalMsg,
        msgType: detectMessageType(finalMsg),
        organizationId,
        contactId,
        channel: "FUNNEL",
      });
    }
  }
}

export function createAligoClient(config: AligoConfig) {
  return {
    sendSms: (receiver: string, msg: string, msgType?: "SMS" | "LMS") =>
      sendSms({ config, receiver, msg, msgType }),
    verifySender: () => verifySenderNumber(config),
    config,
  };
}
