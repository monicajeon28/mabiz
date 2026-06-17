export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import {
  updatePartnerRiskScore,
  generateDay03Messages,
} from '@/lib/partner-risk-scoring';
import { sendPartnerAlertSms } from '@/lib/aligo-sms-service';
import { checkRateLimitAsync } from '@/lib/rate-limit';

// T-013: PII 마스킹 헬퍼
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  const visibleEnd = phone.slice(-4);
  const masked = phone.slice(0, phone.length - 4).replace(/./g, '*');
  return masked + visibleEnd;
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return local.slice(0, 2) + '***@' + domain;
}

/**
 * GET /api/affiliate/partner-alert
 * 파트너 위험도 대시보드 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    if (!session.organizationId && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '조직 정보가 없습니다.' },
        { status: 401 }
      );
    }

    // OWNER·GLOBAL_ADMIN만 파트너 위험도 조회 허용
    if (session.role !== 'OWNER' && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // T-004: GET rate limiting — 분당 30회 제한
    const rlGet = await checkRateLimitAsync(
      `partner-alert:get:${session.userId}`,
      30,
      60_000
    );
    if (!rlGet.allowed) {
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다.' },
        { status: 429 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const riskLevel = searchParams.get('riskLevel'); // RED, YELLOW, GREEN
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // T-012: UUID 형식 검증 — 비 UUID cursor 입력 시 첫 페이지로 안전하게 fallback
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawCursor = searchParams.get('cursor') || undefined;
    const cursor = rawCursor && UUID_REGEX.test(rawCursor) ? rawCursor : undefined;
    if (rawCursor && !cursor) {
      logger.warn('[partner-alert GET] cursor UUID 형식 오류, 첫 페이지로 fallback', { rawCursor });
    }

    const where: Prisma.PartnerRiskFlagsWhereInput = {};
    if (riskLevel && ['RED', 'YELLOW', 'GREEN'].includes(riskLevel)) {
      if (riskLevel === 'RED') {
        where.totalRiskScore = { gte: 67 };
      } else if (riskLevel === 'YELLOW') {
        where.totalRiskScore = { gte: 34, lte: 66 };
      } else {
        where.totalRiskScore = { lt: 34 };
      }
    }

    // cursor 유효성 검사 — 파트너 삭제 시 Prisma cursor 에러 방지
    if (cursor) {
      const cursorExists = await prisma.partnerRiskFlags.findUnique({
        where: { partnerId: cursor },
        select: { partnerId: true },
      });
      if (!cursorExists) {
        logger.warn('[partner-alert GET] cursor 만료됨, 첫 페이지로 fallback', { cursor });
        return NextResponse.json({
          ok: true,
          data: [],
          total: 0,
          nextCursor: null,
          hasNextPage: false,
          cursorExpired: true,
        });
      }
    }

    const orgFilter = session.role === 'GLOBAL_ADMIN'
      ? {}
      : { partner: { organizationId: session.organizationId! } };

    const [partners, total] = await Promise.all([
      prisma.partnerRiskFlags.findMany({
        where: { ...orgFilter, ...where },
        select: {
          partnerId: true,
          totalRiskScore: true,
          lowPerformanceScore: true,
          churnScore: true,
          dishonestyScore: true,
          skillGapScore: true,
          partner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              automationRate: true,
              monthlyIncomeGoal: true,
              totalRevenue: true,
            },
          },
        },
        orderBy: { totalRiskScore: 'desc' },
        cursor: cursor ? { partnerId: cursor } : undefined,
        skip: cursor ? 1 : 0,
        take: limit + 1,
      }),
      prisma.partnerRiskFlags.count({
        where: { ...orgFilter, ...where },
      }),
    ]);

    const hasNextPage = partners.length > limit;
    const pageData = hasNextPage ? partners.slice(0, limit) : partners;
    const nextCursor = hasNextPage ? pageData[pageData.length - 1].partnerId : null;

    const shouldMask = session.role !== 'GLOBAL_ADMIN';
    const mapped = pageData.map((p) => ({
      partnerId: p.partnerId,
      name: p.partner.name,
      email: shouldMask ? maskEmail(p.partner.email) : p.partner.email,
      phone: shouldMask ? maskPhone(p.partner.phone) : p.partner.phone,
      riskScore: p.totalRiskScore,
      riskLevel:
        p.totalRiskScore > 66 ? 'RED' : p.totalRiskScore > 33 ? 'YELLOW' : 'GREEN',
      automationRate: p.partner.automationRate,
      monthlyIncomeGoal: p.partner.monthlyIncomeGoal,
      totalRevenue: p.partner.totalRevenue,
    }));

    return NextResponse.json({
      ok: true,
      data: mapped,
      total,
      nextCursor,
      hasNextPage,
      limit,
    });
  } catch (error: unknown) {
    logger.error('[partner-alert GET] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/affiliate/partner-alert/:partnerId/trigger-sms
 * 파트너 Alert SMS 트리거 (Day 0-3 시퀀스)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    if (!session.organizationId && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 401 });
    }

    // OWNER·GLOBAL_ADMIN만 파트너 Alert SMS 발송 허용
    if (session.role !== 'OWNER' && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // T-003: POST rate limiting — 실제 SMS 발송이므로 분당 5회 제한 (비용 폭발 방지)
    const rlPost = await checkRateLimitAsync(
      `partner-alert:post:${session.userId}`,
      5,
      60_000
    );
    if (!rlPost.allowed) {
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { partnerId, day } = body;

    if (!partnerId) {
      return NextResponse.json(
        { ok: false, error: 'partnerId가 필요합니다.' },
        { status: 400 }
      );
    }
    // T-011: UUID 형식 검증 — 비 UUID 입력 시 PostgreSQL invalid UUID 에러(500) 방지
    const UUID_REGEX_POST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX_POST.test(partnerId)) {
      return NextResponse.json(
        { ok: false, error: '올바른 파트너 ID 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    const VALID_DAYS = ['day0', 'day1', 'day2', 'day3'] as const;
    if (day !== undefined && !VALID_DAYS.includes(day)) {
      return NextResponse.json(
        { ok: false, error: 'day는 day0~day3 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    // T-017: IDOR 방지 — 소유권 포함 단일 쿼리 (findFirst + organizationId 조건)
    // findUnique → findFirst로 교체하여 권한 없는 파트너 존재 여부 열거 불가
    const partner = await prisma.partner.findFirst({
      where: {
        id: partnerId,
        ...(session.role !== 'GLOBAL_ADMIN' ? { organizationId: session.organizationId! } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        phone: true,
        email: true,
        riskFlags: {
          select: {
            lowPerformanceScore: true,
            churnScore: true,
            dishonestyScore: true,
            skillGapScore: true,
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json(
        { ok: false, error: '파트너를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!partner.phone) {
      return NextResponse.json(
        { ok: false, error: '파트너 전화번호가 없습니다.' },
        { status: 400 }
      );
    }

    // Risk Score 재계산 (GLOBAL_ADMIN은 organizationId=null이므로 파트너의 조직 사용)
    const effectiveOrgId = session.organizationId ?? partner.organizationId;
    if (!effectiveOrgId) {
      return NextResponse.json(
        { ok: false, error: '조직 정보를 확인할 수 없습니다.' },
        { status: 400 }
      );
    }
    const riskResult = await updatePartnerRiskScore(
      partnerId,
      effectiveOrgId
    );

    if (!riskResult) {
      return NextResponse.json(
        { ok: false, error: '위험도 데이터를 계산할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Day 0-3 메시지 생성
    const messages = generateDay03Messages(
      riskResult,
      partner.name,
      partner.phone
    );

    // 특정 day 메시지 선택 (기본값: day0)
    const targetDay = day || 'day0';
    const targetMessage = messages[targetDay] || messages.day0;

    // SMS 발송 (실제 Aligo 연동)
    const smsResult = await sendPartnerAlertSms(
      effectiveOrgId,
      partnerId,
      targetDay as 'day0' | 'day1' | 'day2' | 'day3',
      riskResult.level,
      getMessageType(riskResult.level, targetDay),
      targetMessage,
      partner.phone
    );

    // T-004: 발송 본문은 서버 내부 로그에만 기록 (PII/메시지 내용 API 응답 노출 방지)
    // T-021: messagePreview 제거 — PII 로그 노출 방지 (비PII 메타데이터만 기록)
    logger.info('[partner-alert POST] SMS 발송 완료', {
      partnerId,
      day: targetDay,
      riskLevel: riskResult.level,
      smsSent: smsResult.success,
      smsId: smsResult.smsId,
      senderId: session.userId,
    });

    // T-004: smsResult.error는 내부 로그에만 기록하고 클라이언트 응답에서 제거 (정보 노출 방지)
    if (!smsResult.success) {
      logger.warn('[partner-alert POST] SMS 발송 실패 (내부 오류)', {
        partnerId,
        smsError: smsResult.error,
      });
    }

    return NextResponse.json({
      ok: smsResult.success,
      partnerId,
      riskLevel: riskResult.level,
      riskScore: riskResult.totalRiskScore,
      day: targetDay,
      smsSent: smsResult.success,
      smsId: smsResult.smsId,
      ...(smsResult.success ? {} : { error: 'SMS 발송에 실패했습니다.' }),
    });
  } catch (error: unknown) {
    logger.error('[partner-alert POST] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function getMessageType(
  riskLevel: 'RED' | 'YELLOW' | 'GREEN',
  day: string
): 'URGENT_RETENTION' | 'URGENT_INCENTIVE' | 'TRAINING_OFFER' | 'POSITIVE_REINFORCEMENT' {
  if (riskLevel === 'RED') {
    if (day === 'day0' || day === 'day1') return 'URGENT_RETENTION';
    if (day === 'day2' || day === 'day3') return 'URGENT_INCENTIVE';
  }
  if (riskLevel === 'YELLOW') {
    return 'TRAINING_OFFER';
  }
  return 'POSITIVE_REINFORCEMENT';
}
