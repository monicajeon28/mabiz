export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Free=60s / Pro=300s — 플랜 확인 후 조정

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import {
  DEFAULT_PASSPORT_TEMPLATE_BODY,
  buildPassportLink,
  fillTemplate,
  sanitizeLegacyTemplateBody,
  normalizePhoneForSms,
  generatePassportToken,
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
  cash?: string;
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
  // cash 필드에서 원화 잔액 추출 (SMS_CNT는 건수이므로 사용 안 함)
  const raw = response.cash;
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
  sendTarget?: 'passport' | 'pnr';
}

type SendResultItem = {
  userId: number;
  success: boolean;
  link?: string;
  submissionId?: number;
  message?: string;
  error?: string;
  messageId?: string | null;
  resultCode?: string;
  noPhone?: boolean;
};

type PassportSendUser = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
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

    const sendTarget = body.sendTarget ?? 'passport';
    if (!['passport', 'pnr'].includes(sendTarget)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid sendTarget. Must be "passport" or "pnr".' },
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

    // 여권 발송 시에만 template 로드
    if (sendTarget === 'passport') {
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
    }

    // template.body는 이미 위에서 sanitize됨 — 이중 처리 불필요
    const baseMessage =
      body.messageBody?.trim() ||
      template?.body ||
      DEFAULT_PASSPORT_TEMPLATE_BODY;

    if (!baseMessage) {
      return NextResponse.json(
        { ok: false, message: 'Message body cannot be empty.' },
        { status: 400 }
      );
    }

    const users = await prisma.gmUser.findMany({
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
    });

    // PNR 발송 시 각 user의 tripId → reservationId 매핑
    const reservationIds = new Map<number, number | null>();
    if (sendTarget === 'pnr') {
      const tripIds = users
        .flatMap(u => u.trips.map(t => t.id))
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      if (tripIds.length > 0) {
        const reservations = await prisma.gmReservation.findMany({
          where: { tripId: { in: tripIds } },
          select: { id: true, tripId: true },
          orderBy: { createdAt: 'desc' },
          distinct: ['tripId'],
        });

        for (const res of reservations) {
          reservationIds.set(res.tripId, res.id);
        }
      }

      for (const user of users) {
        const tripId = user.trips[0]?.id;
        if (tripId && !reservationIds.has(tripId)) {
          reservationIds.set(tripId, null);
        }
      }
    }

    const usersData = users as PassportSendUser[];

    const usersById = new Map<number, PassportSendUser>(usersData.map((user) => [user.id, user]));
    const missingUserIds = userIds.filter((id) => !usersById.has(id));

    // 일일 발송 제한 — 루프 전 일괄 조회 (N+1 제거: 100명 = 100쿼리 → 1쿼리)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogGroups = await prisma.gmPassportRequestLog.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: 'SUCCESS', sentAt: { gte: cutoff24h } },
      _count: { userId: true },
    });
    const recentSendMap = new Map<number, number>(
      recentLogGroups.map((r) => [r.userId, r._count.userId])
    );

    const results: Array<SendResultItem> = [];
    const pendingLogs: Array<{
      userId: number; adminId: number | null; templateId: number | null;
      messageBody: string; messageChannel: string; status: string;
      errorReason: string | null; sentAt: Date;
    }> = [];
    let aligoRemain: AligoRemainResponse | null = null;
    let remainingCash: number | null = null;
    let lowBalance = false;

    for (const userId of userIds) {
      const user = usersById.get(userId);

      if (!user) {
        results.push({ userId, success: false, error: 'User not found.' });
        continue;
      }

      // 일일 발송 횟수 제한 (Map 조회 — O(1))
      const recentSendCount = recentSendMap.get(userId) ?? 0;
      if (recentSendCount >= 2) {
        results.push({
          userId,
          success: false,
          error: `오늘 이미 ${recentSendCount}회 발송됨 (일일 최대 2회 — 스팸 방지)`,
        });
        continue;
      }

      // 변수 스코프 문제 해결: try 블록 밖에서 선언
      let submissionId: number | undefined;
      let link: string | undefined;
      let token: string | undefined;

      try {
        const latestTrip = user.trips[0] ?? null;
        const existingSubmission = user.passportSubmissions[0] ?? null;
        // 전화번호는 SMS 발송에만 필요 — 링크 생성은 전화번호 없어도 항상 진행
        const normalizedPhone = normalizePhoneForSms(user.phone);

        // 여권 또는 PNR 발송에 따른 분기
        let personalizedMessage = '';
        if (sendTarget === 'passport') {
          // ── 여권 발송 ──
          token = generatePassportToken();
          const tokenExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
          link = buildPassportLink(token);

          personalizedMessage = fillTemplate(baseMessage, {
            고객명: user.name ? `${user.name}님` : '고객님',
            링크: link,
            상품명: latestTrip?.cruiseName ?? '',
            출발일: formatDate(latestTrip?.startDate ?? null),
          });
        } else {
          // ── PNR 발송 ──
          const tripId = latestTrip?.id;
          const reservationId = tripId ? reservationIds.get(tripId) : null;

          if (!reservationId) {
            const errorMessage = '예약 정보가 없습니다.';
            results.push({ userId: user.id, success: false, error: errorMessage });
            continue;
          }

          link = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/pnr/${reservationId}`;
          personalizedMessage = `${user.name ? `${user.name}님` : '고객님'}의 여행 정보 입력을 위한 링크입니다. 아래 링크를 통해 객실 정보 등을 입력해 주세요.\n${link}`;
        }

        // 여권 발송 시에만 PassportSubmission 업데이트
        if (sendTarget === 'passport') {
          const tokenExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

          if (existingSubmission && !existingSubmission.isSubmitted) {
            // user.trips[0]이 존재하면 DB에 이미 있는 trip — 별도 count 불필요
            const nextTripId = latestTrip?.id ?? existingSubmission.tripId;

            const updated = await prisma.gmPassportSubmission.update({
              where: { id: existingSubmission.id },
              data: {
                token: token!,
                tokenExpiresAt,
                tripId: nextTripId,
                isSubmitted: false,
                updatedAt: new Date(),
                extraData: Prisma.JsonNull,
              },
            });
            submissionId = updated.id;
          } else {
            // user.trips[0]이 존재하면 DB에 이미 있는 trip — 별도 count 불필요
            const createData: Prisma.GmPassportSubmissionUncheckedCreateInput = {
              userId: user.id,
              token: token!,
              tokenExpiresAt,
              isSubmitted: false,
              driveFolderUrl: null,
              extraData: Prisma.JsonNull,
              updatedAt: new Date(),
              ...(latestTrip?.id ? { tripId: latestTrip.id } : {}),
            };

            const created = await prisma.gmPassportSubmission.create({
              data: createData,
            });
            submissionId = created.id;
          }
        }

        // 전화번호 없으면 링크만 반환 (SMS 없이)
        if (!normalizedPhone) {
          pendingLogs.push({
            userId: user.id,
            adminId: manager.id > 0 ? manager.id : null,
            templateId: template?.id ?? null,
            messageBody: personalizedMessage,
            messageChannel,
            status: 'FAILED',
            errorReason: '전화번호 없음 — 링크만 생성됨',
            sentAt: new Date(),
          });
          results.push({
            userId: user.id,
            success: true,  // 링크는 생성됨
            link,
            submissionId,
            message: personalizedMessage,
            noPhone: true,  // 명시적 플래그 (프론트 분기용)
          });
          continue;
        }

        const messageByteLength = new Blob([personalizedMessage]).size;
        const msgType: 'SMS' | 'LMS' = messageByteLength > 90 ? 'LMS' : 'SMS';

        let sendResponse: AligoSendResponse | null = null;
        let sendError: string | null = null;

        try {
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
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
          sendError = sendErr instanceof Error ? sendErr.message : '알 수 없는 오류';
        }

        const status = sendError ? 'FAILED' : 'SUCCESS';
        const messageId = sendResponse?.message_id || (sendResponse?.msg_id as string | undefined) || null;

        pendingLogs.push({
          userId: user.id,
          adminId: manager.id > 0 ? manager.id : null,
          templateId: template?.id ?? null,
          messageBody: personalizedMessage,
          messageChannel,
          status,
          errorReason: sendError ?? null,
          sentAt: new Date(),
        });

        // SMS 실패해도 링크는 포함 (success 여부는 SMS 성공 기준)
        results.push({
          userId: user.id,
          success: !sendError,
          link,
          submissionId,
          message: personalizedMessage,
          messageId,
          resultCode: sendResponse?.result_code,
          ...(sendError ? { error: sendError } : {}),
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
          ...(submissionId !== undefined && link ? { submissionId, link } : {}),
        };

        pendingLogs.push({
          userId: user.id,
          adminId: manager.id > 0 ? manager.id : null,
          templateId: template?.id ?? null,
          messageBody: baseMessage,
          messageChannel,
          status: 'FAILED',
          errorReason: message,
          sentAt: new Date(),
        });
        results.push(errorResult);
      }
    }

    // 로그 배치 flush (N+1 제거: 100명 = 100 create → createMany 1쿼리)
    if (pendingLogs.length > 0) {
      try {
        await prisma.gmPassportRequestLog.createMany({ data: pendingLogs });
      } catch (logErr) {
        logger.error('[PassportRequest] Failed to batch insert logs', {
          err: logErr instanceof Error ? logErr.message : String(logErr),
          count: pendingLogs.length,
        });
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
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        ...(process.env.NODE_ENV === 'development' ? {
          error: error instanceof Error ? error.message : String(error),
          details: error instanceof Error ? error.stack : undefined,
        } : {}),
      },
      { status: 500 }
    );
  }
}


