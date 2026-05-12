export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_PASSPORT_TEMPLATE_BODY,
  requireAdminUser,
  buildPassportLink,
  fillTemplate,
  sanitizeLegacyTemplateBody,
} from '../_utils';
import { fetchRemain, parseCashValue, AligoSendResponse, AligoRemainResponse } from '@/lib/aligo/client';

export const runtime = 'nodejs';

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
  UserTrip: Array<{
    id: number;
    cruiseName: string | null;
    startDate: Date | null;
    endDate: Date | null;
    reservationCode: string | null;
  }>;
  PassportSubmissions: Array<{
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
    const admin = await requireAdminUser();
    if (!admin) {
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
      template = await prisma.passportRequestTemplate.findUnique({
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
      template = await prisma.passportRequestTemplate.findFirst({
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
        template = await prisma.passportRequestTemplate.create({
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
        await prisma.passportRequestTemplate.update({
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

    const users = (await prisma.user.findMany({
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
        UserTrip: {
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            id: true,
            cruiseName: true,
            startDate: true,
            endDate: true,
            reservationCode: true,
          },
        },
        PassportSubmissions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            isSubmitted: true,
            tripId: true,
          },
        },
      },
    })) as PassportSendUser[];

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
        const latestTrip = user.UserTrip[0] ?? null;
        const existingSubmission = user.PassportSubmissions[0] ?? null;
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
            adminId: admin.id,
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
          const updated = await prisma.passportSubmission.update({
            where: { id: existingSubmission.id },
            data: {
              token,
              tokenExpiresAt,
              tripId: latestTrip?.id ?? existingSubmission.tripId,
              isSubmitted: false,
              updatedAt: new Date(),
              extraData: Prisma.JsonNull,
            },
          });
          submissionId = updated.id;
        } else {
          const now = new Date();
          const createData: any = {
            User: { connect: { id: user.id } },
            token,
            tokenExpiresAt,
            isSubmitted: false,
            driveFolderUrl: null,
            extraData: Prisma.JsonNull,
            updatedAt: now,
          };
          
          if (latestTrip?.id) {
            createData.UserTrip = { connect: { id: latestTrip.id } };
          }
          
          const created = await prisma.passportSubmission.create({
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
          const userId = process.env.ALIGO_USER_ID;
          const sender = process.env.ALIGO_SENDER_PHONE;

          if (!apiKey || !userId || !sender) {
            throw new Error('알리고 API 설정이 완료되지 않았습니다. 환경 변수를 확인해주세요.');
          }

          const formData = new URLSearchParams();
          formData.append('key', apiKey);
          formData.append('user_id', userId);
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

          if (String(sendResponse.result_code) !== '1') {
            sendError = sendResponse.message
              ? String(sendResponse.message)
              : `알리고 오류 (코드: ${sendResponse.result_code})`;
          }
        } catch (sendErr) {
          console.error(`[PassportRequest] Aligo send error for user ${user.id}:`, sendErr);
          sendError = sendErr instanceof Error ? sendErr.message : '알 수 없는 오류가 발생했습니다.';
        }

        const status = sendError ? 'FAILED' : 'SUCCESS';
        const messageId = sendResponse?.message_id || (sendResponse?.msg_id as string | undefined) || null;

        await recordPassportLog({
          userId: user.id,
          adminId: admin.id,
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
        console.error(`[PassportRequest] send error for user ${user.id}:`, error);
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
          adminId: admin.id,
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
      console.error('[PassportRequest] Failed to fetch Aligo remaining balance:', remainError);
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
    console.error('[PassportRequest] POST /send error:', error);
    console.error('[PassportRequest] Error details:', {
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
  adminId: number;
  templateId: number | null;
  messageBody: string;
  messageChannel: string;
  status: 'SUCCESS' | 'FAILED';
  errorReason?: string | null;
}) {
  const { userId, adminId, templateId, messageBody, messageChannel, status, errorReason } = params;

  try {
    await prisma.passportRequestLog.create({
      data: {
        userId,
        adminId,
        templateId,
        messageBody,
        messageChannel,
        status,
        errorReason: errorReason ?? null,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[PassportRequest] Failed to insert request log:', error);
  }
}
