export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
// Aligo SMS API 인라인 타입 및 함수 (aligo/client 모듈 미존재)
interface AligoSendResponse {
  result_code: string;
  message?: string;
  message_id?: string;
  msg_id?: string;
  msg_type?: string;
  success_cnt?: number;
  error_cnt?: number;
}

interface AligoRemainResponse {
  result_code: string;
  message?: string;
  SMS_CNT?: string;
  LMS_CNT?: string;
  MMS_CNT?: string;
}

async function fetchRemain(): Promise<AligoRemainResponse> {
  const ALIGO_BASE_URL = 'https://apis.aligo.in';
  const apiKey = process.env.ALIGO_API_KEY;
  const aligoUserId = process.env.ALIGO_USER_ID;

  if (!apiKey || !aligoUserId) {
    throw new Error('알리고 API 설정이 완료되지 않았습니다.');
  }

  const formData = new URLSearchParams();
  formData.append('key', apiKey);
  formData.append('user_id', aligoUserId);

  const res = await fetch(`${ALIGO_BASE_URL}/remain/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: formData.toString(),
  });

  if (!res.ok) {
    throw new Error(`알리고 잔액 조회 실패 (${res.status})`);
  }
  return res.json();
}

function parseCashValue(response: AligoRemainResponse): number | null {
  const sms = parseInt(response.SMS_CNT || '0', 10);
  return isNaN(sms) ? null : sms;
}

export const runtime = 'nodejs';

const DEFAULT_PNR_TEMPLATE_BODY = `[크루즈 가이드] PNR 정보 입력 안내

{고객명}님, 안녕하세요.
예약하신 {상품명} 크루즈 여행({출발일} 출발)을 위해 객실 배정 및 탑승자 정보가 필요합니다.

아래 링크에서 객실별 탑승자 정보를 입력해 주세요:
{링크}

※ 같은 객실에 함께 탑승할 분들의 정보를 입력해 주세요.
※ 입력 후 여권 정보 요청이 별도로 안내됩니다.

감사합니다.
크루즈 가이드 고객지원팀 드림`;

interface SendPnrRequestBody {
  reservationId: number;
  messageBody?: string;
}

type SendResultItem = {
  reservationId: number;
  success: boolean;
  link?: string;
  message?: string;
  error?: string;
  messageId?: string | null;
  resultCode?: string;
};

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('010')) return digits;
  if (digits.length === 10) return `0${digits}`;
  return digits.length >= 10 ? digits : null;
}

function fillTemplate(
  template: string,
  replacements: Record<string, string | null | undefined>
) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = replacements[key.trim()];
    if (value === undefined || value === null || value === '') {
      return match;
    }
    return value;
  });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().split('T')[0];
}

function buildPnrLink(reservationId: number): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/customer/pnr/${reservationId}`;
}

export async function POST(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: 인증된 사용자만 (AUTH 필수)
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    authOnly: true,
    errorMessage: '인증이 필요합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    const body: SendPnrRequestBody = await req.json();
    const { reservationId, messageBody } = body;

    if (!reservationId) {
      return NextResponse.json(
        { ok: false, message: '예약 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 예약 정보 조회
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: {
        mainUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        trip: {
          select: {
            id: true,
            shipName: true,
            departureDate: true,
            productCode: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const user = reservation.mainUser;
    if (!user) {
      return NextResponse.json(
        { ok: false, message: '예약에 고객 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(user.phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { ok: false, message: '유효한 전화번호가 없습니다.' },
        { status: 400 }
      );
    }

    // PNR 링크 생성
    const link = buildPnrLink(reservationId);

    // 상품명 구성 (trip에서 직접 가져옴)
    const productName = reservation.trip?.productCode ||
      reservation.trip?.shipName ||
      '크루즈 여행';

    // 메시지 구성
    const baseMessage = messageBody?.trim() || DEFAULT_PNR_TEMPLATE_BODY;
    const personalizedMessage = fillTemplate(baseMessage, {
      고객명: user.name ? `${user.name}` : '고객',
      링크: link,
      상품명: productName,
      출발일: formatDate(reservation.trip?.departureDate),
    });

    const messageByteLength = new Blob([personalizedMessage]).size;
    const msgType: 'SMS' | 'LMS' = messageByteLength > 90 ? 'LMS' : 'SMS';

    // 알리고 API 호출
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
      if (msgType === 'LMS') {
        formData.append('title', '[크루즈 가이드] PNR 정보 입력 안내');
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
      const err = sendErr as Record<string, unknown>;
      logger.error(`[PnrRequest] Aligo send error for reservation ${reservationId}:`, err);
      sendError = sendErr instanceof Error ? sendErr.message : '알 수 없는 오류가 발생했습니다.';
    }

    // PNR 상태 업데이트 (선택적)
    if (!sendError) {
      await prisma.gmReservation.update({
        where: { id: reservationId },
        data: {
          pnrStatus: 'SENT',
          updatedAt: new Date(),
        },
      });
    }

    // 잔액 조회
    let aligoRemain: AligoRemainResponse | null = null;
    let remainingCash: number | null = null;

    try {
      const remainResponse = await fetchRemain();
      aligoRemain = remainResponse;
      remainingCash = parseCashValue(remainResponse);
    } catch (remainError) {
      const err = remainError as Record<string, unknown>;
      logger.error('[PnrRequest] Failed to fetch Aligo remaining balance:', err);
    }

    const result: SendResultItem = {
      reservationId,
      success: !sendError,
      link,
      message: personalizedMessage,
      error: sendError || undefined,
      messageId: sendResponse?.message_id || (sendResponse?.msg_id as string | undefined) || null,
      resultCode: sendResponse?.result_code,
    };

    return NextResponse.json({
      ok: !sendError,
      result,
      aligoRemain: aligoRemain ?? undefined,
      remainingCash: remainingCash ?? undefined,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[PnrRequest] POST /send error:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'PNR 요청 발송에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

// GET: PNR 링크만 생성 (문자 발송 없이)
export async function GET(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const reservationId = parseInt(searchParams.get('reservationId') || '');

    if (isNaN(reservationId)) {
      return NextResponse.json(
        { ok: false, message: '유효한 예약 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 예약 정보 조회
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      include: {
        mainUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        trip: {
          select: {
            id: true,
            shipName: true,
            departureDate: true,
            productCode: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, message: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const link = buildPnrLink(reservationId);

    // 상품명 구성 (trip에서 직접 가져옴)
    const productName = reservation.trip?.productCode ||
      reservation.trip?.shipName ||
      '크루즈 여행';

    // 기본 메시지 생성
    const message = fillTemplate(DEFAULT_PNR_TEMPLATE_BODY, {
      고객명: reservation.mainUser?.name ? `${reservation.mainUser.name}` : '고객',
      링크: link,
      상품명: productName,
      출발일: formatDate(reservation.trip?.departureDate),
    });

    return NextResponse.json({
      ok: true,
      link,
      message,
      reservation: {
        id: reservation.id,
        userName: reservation.mainUser?.name,
        userPhone: reservation.mainUser?.phone,
        productName,
        departureDate: reservation.trip?.departureDate,
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[PnrRequest] GET error:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'PNR 정보 조회에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
