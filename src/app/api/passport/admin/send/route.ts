export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import {
  DEFAULT_PASSPORT_TEMPLATE_BODY,
  buildPassportLink,
  fillTemplate,
  sanitizeLegacyTemplateBody,
} from '@/lib/passport-utils';

export const runtime = 'nodejs';

// ── Aligo 타입 (원본 @/lib/aligo/client 에서 이식) ──────────
interface AligoSendResponse {
  result_code: string;
  message?: string;
  message_id?: string;
  msg_id?: string;
}

interface AligoRemainResponse {
  result_code: number;
  message: string;
  SMS_CNT?: string;
  LMS_CNT?: string;
  MMS_CNT?: string;
}

async function fetchRemain(): Promise<AligoRemainResponse> {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  if (!apiKey || !userId) throw new Error('ALIGO 환경변수 미설정');

  const formData = new URLSearchParams({ key: apiKey, user_id: userId });
  const res = await fetch('https://apis.aligo.in/remain/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  return (await res.json()) as AligoRemainResponse;
}

function parseCashValue(response: AligoRemainResponse): number | null {
  // SMS_CNT 문자열에서 숫자 추출
  const raw = response.SMS_CNT;
  if (!raw) return null;
  const num = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) ? null : num;
}
// ── Aligo 타입 끝 ────────────────────────────────────────────

const VALID_CHANNELS = new Set(['SMS', 'KAKAO', 'ALIMTALK']);
const DEFAULT_EXPIRES_HOURS = 72;
const ALIGO_LOW_BALANCE_THRESHOLD = Number(process.env.ALIGO_REMAIN_ALERT_THRESHOLD ?? '0');

interface SendPassportRequestBody {
  userIds: Array<number | string>;
  templateId?: number;
  messageBody?: string;
  channel?: string;
  expiresInHours?: number;
}

type SendResultItem = {
  userId: number;
  success: boolean;
  link?: string;
  token?: string;
  submissionId?: number;
  message?: string;
  error?: string;
  messageId?: string | null;
  resultCode?: string;
};

type PassportSendUser = {
  id: number;
  name: string | null;
  phone: string | null;
  role: string;
  trips: Array<{
    id: number;
    cruiseName: string | null;
    startDate: Date | null;
    endDate: Date | null;
  }>;
  passportSubmissions: Array<{
    id: number;
    isSubmitted: boolean;
    tripId: number | null;
  }>;
};

function generateToken() {
  // 16바이트로 줄여서 base62 인코딩 시 약 22자 정도로 짧게 만듦
  return randomBytes(16).toString('hex');
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '';
  return value.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({
        ok: false,
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
        details: 'Admin authentication failed'
      }, { status: 403 });
    }

    const body: SendPassportRequestBody = await req.json();
    const rawUserIds = body.userIds || [];

    if (!Array.isArray(rawUserIds) || rawUserIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'userIds must be a non-empty array.' },
        { status: 400 }
      );
    }

    const userIds = rawUserIds
      .map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
      .filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));

    if (userIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'No valid userIds provided.' },
        { status: 400 }
      );
    }

    const expiresInHours = Math.max(1, Math.min(body.expiresInHours ?? DEFAULT_EXPIRES_HOURS, 24 * 14));
    const channel = (body.channel || 'SMS').toUpperCase();
    const messageChannel = VALID_CHANNELS.has(channel) ? channel : 'SMS';

    if (messageChannel !== 'SMS') {
      return NextResponse.json(
        { ok: false, message: '현재는 SMS 채널만 지원합니다. 알림톡 발송은 추후 지원 예정입니다.' },
        { status: 400 }
      );
    }

    let template: { id: number; title: string; body: string; isDefault: boolean } | null = null;
    if (body.templateId) {
      template = await prisma.gmPassportRequestTemplate.findUnique({
        where: { id: body.templateId },
        select: {
          id: true,
          title: true,
          body: true,
          isDefault: true,
        },
      });
      if (!template) {
        return NextResponse.json(
          { ok: false, message: 'Template not found.' },
          { status: 404 }
        );
      }
    } else {
      template = await prisma.gmPassportRequestTemplate.findFirst({
        where: { isDefault: true },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          body: true,
          isDefault: true,
        },
      });

      if (!template) {
        template = await prisma.gmPassportRequestTemplate.create({
          data: {
            title: '여권 제출 안내',
            body: DEFAULT_PASSPORT_TEMPLATE_BODY,
            isDefault: true,
          },
          select: {
            id: true,
            title: true,
            body: true,
            isDefault: true,
          },
        });
      }
    }

    if (template) {
      const sanitizedBody = sanitizeLegacyTemplateBody(template.body);
      if (sanitizedBody !== template.body) {
        await prisma.gmPassportRequestTemplate.update({
          where: { id: template.id },
          data: { body: sanitizedBody },
        });
        template = { ...template, body: sanitizedBody };
      }
    }

    const baseMessage =
      body.messageBody?.trim() ||
      sanitizeLegacyTemplateBody(template?.body) ||
      DEFAULT_PASSPORT_TEMPLATE_BODY;

    if (!baseMessage) {
      return NextResponse.json(
        { ok: false, message: 'Message body cannot be empty.' },
        { status: 400 }
      );
    }

    const users = (await prisma.gmUser.findMany({
      where: {
        id: { in: userIds },
        role: { not: 'admin' },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        trips: {
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            id: true,
            cruiseName: true,
            startDate: true,
            endDate: true,
          },
        },
        passportSubmissions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            isSubmitted: true,
            tripId: true,
          },
        },
      },
    })) as unknown as PassportSendUser[];

    const usersById = new Map<number, PassportSendUser>(users.map((user) => [user.id, user]));
    const missingUserIds = userIds.filter((id) => !usersById.has(id));

    const results: Array<SendResultItem> = [];
    let aligoRemain: AligoRemainResponse | null = null;
    let remainingCash: number | null = null;
    let lowBalance = false;

    for (const userId of userIds) {
      const user = usersById.get(userId);

      if (!user) {
        results.push({ userId, success: false, error: 'User not found.' });
        continue;
      }

      // 변수 스코프 문제 해결: try 블록 밖에서 선언
      let submissionId: number | undefined;
      let link: string | undefined;
      let token: string | undefined;

      try {
        const latestTrip = user.trips[0] ?? null;
        const existingSubmission = user.passportSubmissions[0] ?? null;
        token = generateToken();
        const tokenExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        link = buildPassportLink(token);

        const personalizedMessage = fillTemplate(baseMessage, {
          고객명: user.name ? `${user.name}님` : '고객님',
          링크: link,
          상품명: latestTrip?.cruiseName ?? '',
          출발일: formatDate(latestTrip?.startDate ?? null),
        });

        const normalizedPhone = normalizePhone(user.phone);
        if (!normalizedPhone) {
          const errorMessage = '유효한 전화번호가 없습니다.';
          await recordPassportLog({
            userId: user.id,
            managerId: manager.id,
            templateId: template?.id ?? null,
            messageBody: personalizedMessage,
            messageChannel,
            status: 'FAILED',
            errorReason: errorMessage,
          });
          results.push({ userId: user.id, success: false, error: errorMessage });
          continue;
        }

        if (existingSubmission && !existingSubmission.isSubmitted) {
          // 새로운 Trip이 있으면 그것을 사용, 없으면 기존 tripId 유지
          let nextTripId = existingSubmission.tripId;
          if (latestTrip?.id) {
            // Trip이 실제로 존재하는지 확인 (FK 제약 조건 위반 방지)
            const tripExists = await prisma.gmTrip.count({
              where: { id: latestTrip.id },
            });
            if (tripExists > 0) {
              nextTripId = latestTrip.id;
            }
          }

          const updated = await prisma.gmPassportSubmission.update({
            where: { id: existingSubmission.id },
            data: {
              token,
              tokenExpiresAt,
              tripId: nextTripId,
              isSubmitted: false,
              updatedAt: new Date(),
              extraData: Prisma.JsonNull,
            },
          });
          submissionId = updated.id;
        } else {
          const now = new Date();
          const createData: any = {
            userId: user.id,
            token,
            tokenExpiresAt,
            isSubmitted: false,
            driveFolderUrl: null,
            extraData: Prisma.JsonNull,
            updatedAt: now,
          };

          // latestTrip?.id가 있으면 설정하되, FK 제약 확인
          if (latestTrip?.id) {
            // Trip이 실제로 존재하는지 확인 (FK 제약 조건 위반 방지)
            const tripExists = await prisma.gmTrip.count({
              where: { id: latestTrip.id },
            });
            if (tripExists > 0) {
              createData.tripId = latestTrip.id;
            }
            // Trip이 없으면 tripId를 설정하지 않음 (null로 유지)
          }

          const created = await prisma.gmPassportSubmission.create({
            data: createData,
          });
          submissionId = created.id;
        }

        const messageByteLength = new Blob([personalizedMessage]).size;
        const msgType: 'SMS' | 'LMS' = messageByteLength > 90 ? 'LMS' : 'SMS';

        let sendResponse: AligoSendResponse | null = null;
        let sendError: string | null = null;

        try {
          // 대리점장 대시보드와 동일한 방식으로 알리고 API 호출
          const ALIGO_BASE_URL = 'https://apis.aligo.in';
          const apiKey = process.env.ALIGO_API_KEY;
          const aligoUserId = process.env.ALIGO_USER_ID;
          const sender = process.env.ALIGO_SENDER_PHONE;

          if (!apiKey || !aligoUserId || !sender) {
            throw new Error('알리고 API 설정이 완료되지 않았습니다. 환경 변수를 확인해주세요.');
          }

          const formData = new URLSearchParams();
          formData.append('key', apiKey);
          formData.append('user_id', aligoUserId);
          formData.append('sender', sender);
          formData.append('receiver', normalizedPhone);
          formData.append('msg', personalizedMessage);
          formData.append('msg_type', msgType);
          if (msgType === 'LMS' && template?.title) {
            formData.append('title', template.title);
          }

          const aligoResponse = await fetch(`${ALIGO_BASE_URL}/send/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: formData.toString(),
          });

          if (!aligoResponse.ok) {
            const text = await aligoResponse.text();
            throw new Error(`알리고 API 요청이 실패했습니다. (${aligoResponse.status}) ${text}`);
          }

          sendResponse = await aligoResponse.json();

          if (sendResponse && String(sendResponse.result_code) !== '1') {
            sendError = sendResponse.message
              ? String(sendResponse.message)
              : `알리고 오류 (코드: ${sendResponse.result_code})`;
          }
        } catch (sendErr) {
          logger.error(`[PassportRequest] Aligo send error for user ${user.id}`, {
            err: sendErr instanceof Error ? sendErr.message : String(sendErr),
          });
          sendError = sendErr instanceof Error ? sendErr.message : '알 수 없는 오류가 발생했습니다.';
        }

        const status = sendError ? 'FAILED' : 'SUCCESS';
        const messageId = sendResponse?.message_id || (sendResponse?.msg_id as string | undefined) || null;

        await recordPassportLog({
          userId: user.id,
          managerId: manager.id,
          templateId: template?.id ?? null,
          messageBody: personalizedMessage,
          messageChannel,
          status,
          errorReason: sendError,
        });

        // SMS 발송 실패해도 토큰은 이미 생성되었으므로 링크는 포함
        if (sendError) {
          results.push({
            userId: user.id,
            success: false,
            link, // 토큰은 생성되었으므로 링크 포함
            token, // 토큰 포함
            submissionId, // submission ID 포함
            error: sendError,
            resultCode: sendResponse?.result_code,
          });
          continue;
        }

        results.push({
          userId: user.id,
          success: true,
          link,
          token,
          submissionId,
          message: personalizedMessage,
          messageId,
          resultCode: sendResponse?.result_code,
        });
      } catch (error) {
        logger.error(`[PassportRequest] send error for user ${user.id}`, {
          err: error instanceof Error ? error.message : String(error),
        });
        const message = error instanceof Error ? error.message : 'Unknown error';

        // 토큰이 생성되었는지 확인 (submissionId가 있으면 토큰도 생성됨)
        const errorResult: SendResultItem = {
          userId: user.id,
          success: false,
          error: message,
          ...(submissionId !== undefined && link && token ? { submissionId, link, token } : {}),
        };

        await recordPassportLog({
          userId: user.id,
          managerId: manager.id,
          templateId: template?.id ?? null,
          messageBody: baseMessage,
          messageChannel,
          status: 'FAILED',
          errorReason: message,
        });
        results.push(errorResult);
      }
    }

    try {
      const remainResponse = await fetchRemain();
      aligoRemain = remainResponse;
      remainingCash = parseCashValue(remainResponse);
      lowBalance = typeof remainingCash === 'number' && ALIGO_LOW_BALANCE_THRESHOLD > 0
        ? remainingCash <= ALIGO_LOW_BALANCE_THRESHOLD
        : false;
    } catch (remainError) {
      logger.error('[PassportRequest] Failed to fetch Aligo remaining balance', {
        err: remainError instanceof Error ? remainError.message : String(remainError),
      });
    }

    return NextResponse.json({
      ok: true,
      channel: messageChannel,
      expiresInHours,
      results,
      missingUserIds,
      aligoRemain: aligoRemain ?? undefined,
      remainingCash: remainingCash ?? undefined,
      lowBalance,
    });
  } catch (error) {
    logger.error('[PassportRequest] POST /send error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      {
        ok: false,
        message: 'Failed to send passport request.',
        error: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 }
    );
  }
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('010')) return digits;
  if (digits.length === 10) return `0${digits}`;
  return digits.length >= 10 ? digits : null;
}

async function recordPassportLog(params: {
  userId: number;
  managerId: number;
  templateId: number | null;
  messageBody: string;
  messageChannel: string;
  status: 'SUCCESS' | 'FAILED';
  errorReason?: string | null;
}) {
  const { userId, managerId, templateId, messageBody, messageChannel, status, errorReason } = params;

  try {
    await prisma.gmPassportRequestLog.create({
      data: {
        userId,
        adminId: managerId > 0 ? managerId : null, // ← managerId가 0이면 null로 처리 (FK 제약 조건 회피)
        templateId,
        messageBody,
        messageChannel,
        status,
        errorReason: errorReason ?? null,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('[PassportRequest] Failed to insert request log', {
      err: error instanceof Error ? error.message : String(error),
    });
  }
}
