/**
 * O-2: POST /api/sms/send
 * SMS 발송 엔드포인트
 *
 * Request:
 * {
 *   "phoneNumber": "010-1234-5678",
 *   "message": "예약이 확인되었습니다.",
 *   "type": "reservation|payment|reminder|cancellation",
 *   "userId": 123,
 *   "provider": "aligo|twilio"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendSms } from '@/lib/sms-service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * SMS 발송 요청 스키마
 */
const sendSmsSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, '유효한 전화번호 필수')
    .regex(/^010-?\d{3,4}-?\d{4}$/, '전화번호 형식 오류'),
  message: z.string().min(1, '메시지 필수').max(1000, '메시지는 1000자 이하'),
  type: z.enum(['reservation', 'payment', 'reminder', 'cancellation']),
  userId: z.number().int().optional(),
  provider: z.enum(['aligo', 'twilio']).default('aligo'),
});

type SendSmsRequest = z.infer<typeof sendSmsSchema>;

/**
 * POST /api/sms/send
 * SMS 발송
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 입력 검증
    const validationResult = sendSmsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid input',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { phoneNumber, message, type, userId, provider } = validationResult.data;

    // SMS 발송
    const success = await sendSms({
      phoneNumber,
      message,
      type,
      userId,
      provider,
    });

    if (!success) {
      // 사용자가 알림을 거부한 경우 또는 발송 실패
      return NextResponse.json(
        {
          ok: false,
          error: userId
            ? 'User has disabled SMS notifications or sending failed'
            : 'Failed to send SMS',
        },
        { status: 403 }
      );
    }

    logger.log('SMS: Message sent successfully', {
      phoneNumber: maskPhone(phoneNumber),
      type,
      userId,
      context: 'POST /api/sms/send',
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'SMS sent successfully',
        status: 'SENT',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('SMS: Error in send endpoint', {
      error: error instanceof Error ? error.message : String(error),
      context: 'POST /api/sms/send',
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * 전화번호 마스킹
 */
function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d*(\d{4})/, '$1-***-$2');
}
