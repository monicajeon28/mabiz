import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/response';
import { logger } from '@/lib/logger';

/**
 * POST /api/unsubscribe
 *
 * 수신거부 신청 (공개, 로그인 불필요)
 *
 * Body:
 * - organizationId: string (필수) — 조직 ID (기본값: process.env.NEXT_PUBLIC_ORG_ID)
 * - phone: string (필수) — 연락처 (정규화: 010-1234-5678 → 01012345678)
 * - name: string | null (선택) — 이름
 *
 * Response:
 * - 200: { success: true, message: "수신거부 처리되었습니다" }
 * - 400: { error: "연락처는 필수입니다" }
 * - 409: { error: "이미 수신거부 처리되었습니다" }
 * - 500: { error: "서버 오류가 발생했습니다" }
 */
export async function POST(req: Request) {
  try {
    const { organizationId, phone, name } = await req.json();

    // 1. 입력값 검증
    if (!organizationId) {
      return NextResponse.json(
        { error: '조직 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: '연락처는 필수입니다.' },
        { status: 400 }
      );
    }

    // 2. 전화번호 정규화: 010-1234-5678 → 01012345678
    const normalizedPhone = phone.replace(/\D/g, '');

    // 3. 전화번호 형식 검증 (한국 휴대폰: 11자리)
    if (!/^01[0-9]{9}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { error: '올바른 연락처 형식이 아닙니다. (예: 010-1234-5678)' },
        { status: 400 }
      );
    }

    // 4. 조직 존재 여부 확인
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return NextResponse.json(
        { error: '조직을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 5. 중복 체크 (유니크 제약: organizationId + phone)
    const existing = await prisma.unsubscribed.findUnique({
      where: {
        organizationId_phone: {
          organizationId,
          phone: normalizedPhone,
        },
      },
    });

    if (existing) {
      logger.info(`[Unsubscribe] Already unsubscribed: ${normalizedPhone}`);
      // 409 대신 200으로 반환 (이미 처리됨)
      return NextResponse.json({
        success: true,
        message: '이미 수신거부 처리되었습니다.',
      });
    }

    // 6. 수신거부 기록 생성
    const unsubscribed = await prisma.unsubscribed.create({
      data: {
        organizationId,
        phone: normalizedPhone,
        name: name?.trim() || null,
        createdBy: 'SELF', // 자가 신청
      },
    });

    logger.info(`[Unsubscribe] New unsubscribe: ${normalizedPhone}`, {
      id: unsubscribed.id,
      name: unsubscribed.name,
    });

    return NextResponse.json({
      success: true,
      message: '영구적으로 수신거부되었습니다.',
    });
  } catch (error) {
    return handleApiError(error, '[POST /api/unsubscribe]');
  }
}
