/**
 * PNR SMS 발송 lib — processApisSyncQueue(PNR 타입)에서 사용
 * Aligo API 직접 호출, GmReservation.pnrStatus 갱신
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const ALIGO_BASE_URL = 'https://apis.aligo.in';

const DEFAULT_TEMPLATE = `[크루즈 가이드] PNR 정보 입력 안내

{고객명}님, 안녕하세요.
예약하신 {상품명} 크루즈 여행({출발일} 출발)을 위해 객실 배정 및 탑승자 정보가 필요합니다.

아래 링크에서 객실별 탑승자 정보를 입력해 주세요:
{링크}

※ 같은 객실에 함께 탑승할 분들의 정보를 입력해 주세요.
※ 입력 후 여권 정보 요청이 별도로 안내됩니다.

감사합니다.
크루즈 가이드 고객지원팀 드림`;

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('010')) return digits;
  if (digits.length === 10) return `0${digits}`;
  return digits.length >= 10 ? digits : null;
}

function fillTemplate(template: string, replacements: Record<string, string | null | undefined>) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = replacements[key.trim()];
    return value != null && value !== '' ? value : match;
  });
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().split('T')[0];
}

function buildPnrLink(reservationId: number): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com').replace(/\/$/, '');
  return `${base}/customer/pnr/${reservationId}`;
}

export interface PnrSendResult {
  success: boolean;
  reservationId: number;
  error?: string;
}

export async function sendPnrSmsForReservation(reservationId: number): Promise<PnrSendResult> {
  const apiKey = process.env.ALIGO_API_KEY;
  const aligoUserId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER_PHONE;

  if (!apiKey || !aligoUserId || !sender) {
    return { success: false, reservationId, error: '알리고 API 환경변수 미설정' };
  }

  // 예약 조회
  const reservation = await prisma.gmReservation.findUnique({
    where: { id: reservationId },
    include: {
      mainUser: { select: { id: true, name: true, phone: true } },
      trip: { select: { shipName: true, departureDate: true, productCode: true } },
    },
  });

  if (!reservation) {
    return { success: false, reservationId, error: '예약 없음' };
  }

  const phone = normalizePhone(reservation.mainUser?.phone);
  if (!phone) {
    return { success: false, reservationId, error: '유효한 전화번호 없음' };
  }

  const productName = reservation.trip?.productCode ?? reservation.trip?.shipName ?? '크루즈 여행';
  const link = buildPnrLink(reservationId);
  const msg = fillTemplate(DEFAULT_TEMPLATE, {
    고객명: reservation.mainUser?.name ?? '고객',
    상품명: productName,
    출발일: formatDate(reservation.trip?.departureDate),
    링크: link,
  });

  const msgType: 'SMS' | 'LMS' = new Blob([msg]).size > 90 ? 'LMS' : 'SMS';

  const form = new URLSearchParams();
  form.append('key', apiKey);
  form.append('user_id', aligoUserId);
  form.append('sender', sender);
  form.append('receiver', phone);
  form.append('msg', msg);
  form.append('msg_type', msgType);
  if (msgType === 'LMS') form.append('title', '[크루즈 가이드] PNR 정보 입력 안내');

  try {
    const res = await fetch(`${ALIGO_BASE_URL}/send/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { result_code: string; message?: string };

    if (String(json.result_code) !== '1') {
      return { success: false, reservationId, error: json.message ?? `Aligo 오류(${json.result_code})` };
    }

    // pnrStatus 갱신
    await prisma.gmReservation.update({
      where: { id: reservationId },
      data: { pnrStatus: 'SENT', updatedAt: new Date() },
    });

    logger.log('[PnrSmsSend] 발송 완료', { reservationId, phone });
    return { success: true, reservationId };
  } catch (err) {
    const msg2 = err instanceof Error ? err.message : String(err);
    logger.error('[PnrSmsSend] 발송 실패', { reservationId, error: msg2 });
    return { success: false, reservationId, error: msg2 };
  }
}
