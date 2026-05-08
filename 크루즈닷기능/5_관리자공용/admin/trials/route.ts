/**
 * GET /api/admin/trials
 * Trial CRM 사용자 목록 + 필터
 *
 * P0 Security: requireAdmin() 검증 + Rate Limiting + Zod 입력검증
 * P0 Performance: Prisma select (필요 필드만)
 * P1 Features: 페이지네이션 + 필터링 (status, email, affiliateCode)
 * P1 Compliance: 감시 로깅 (조회 기록)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';
import { checkRateLimit, RateLimitPolicies } from '@/lib/rate-limiter';
import { getClientIpAddress } from '@/lib/utils/ip-utils';

// P0: Zod 입력 검증 스키마
const getTrialsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'CONVERTED', 'CANCELLED']).optional(),
  email: z.string().email('유효한 이메일을 입력하세요').optional(),
  affiliateCode: z.string().max(4, '이하 코드는 최대 4자').optional(),
  page: z.coerce.number().int().positive('페이지는 1 이상').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(10, '최소 10개')
    .max(100, '최대 100개')
    .default(20),
});

type GetTrialsQuery = z.infer<typeof getTrialsQuerySchema>;

interface TrialCRMRow {
  id: number;
  userId: number;
  code: string;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  affiliateCode: string | null;
  consentedAt: Date | null;
  consentVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    email: string;
    name: string | null;
  };
}

export async function GET(request: NextRequest) {
  try {
    // P0 Security: Admin 권한 검증
    const admin = await requireAdmin();

    // P0 Security: Rate Limiting (분당 60 API 요청)
    const clientIp = getClientIpAddress(request);
    const rateLimitKey = `admin:trials:${admin.userId}`;
    const { limited, resetTime } = await checkRateLimit(rateLimitKey, RateLimitPolicies.API);

    if (limited) {
      logger.warn('[Trial-Admin] Rate limit exceeded', {
        adminId: admin.userId,
        clientIp: clientIp ? clientIp.substring(0, 10) : 'unknown',
        resetTime,
      });
      return NextResponse.json(
        {
          ok: false,
          error: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetTime ? Math.ceil(resetTime / 1000).toString() : '60',
          },
        }
      );
    }

    // P0: Zod 입력 검증
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const validatedQuery = getTrialsQuerySchema.parse(queryParams);

    const { status, email, affiliateCode, page, limit } = validatedQuery;

    // P0: WHERE 조건 구성
    const where: any = {};
    if (status) where.status = status;
    if (affiliateCode) where.affiliateCode = affiliateCode;
    if (email) {
      where.User = {
        email: {
          contains: email,
          mode: 'insensitive',
        },
      };
    }

    // P1: 페이지네이션
    const skip = (page - 1) * limit;

    // P0 Performance: Prisma select (필요 필드만)
    const [trials, total] = await Promise.all([
      prisma.trial.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.trial.count({ where }),
    ]);

    // P1: 응답 포맷팅
    const formattedTrials = trials.map((trial): TrialCRMRow => ({
      id: trial.id,
      userId: trial.userId,
      code: trial.code,
      status: trial.status,
      startedAt: trial.startedAt,
      expiresAt: trial.expiresAt,
      endedAt: trial.endedAt,
      affiliateCode: trial.affiliateCode,
      consentedAt: trial.consentedAt,
      consentVersion: trial.consentVersion,
      createdAt: trial.createdAt,
      updatedAt: trial.updatedAt,
      user: trial.User,
    }));

    // P0 Logging: 구조화된 로깅 (민감정보 마스킹)
    logger.log('[Trial-Admin] GET trials list', {
      adminId: admin.userId,
      adminEmail: admin.email,
      totalCount: total,
      pageCount: Math.ceil(total / limit),
      appliedFilters: {
        status,
        hasEmail: !!email,
        affiliateCode,
      },
      clientIp: clientIp ? clientIp.substring(0, 10) : 'unknown',
    });

    return NextResponse.json({
      ok: true,
      trials: formattedTrials,
      pagination: {
        total,
        page,
        pageSize: limit,
        pageCount: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    // P0: Admin 인증 오류
    if (error instanceof AdminAuthError) {
      logger.warn('[Trial-Admin] Admin auth failed', {
        status: error.status,
        message: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    // P0: Zod 검증 오류 (400)
    if (error instanceof z.ZodError) {
      logger.warn('[Trial-Admin] Input validation failed', {
        issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid query parameters',
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    // P0: 에러 마스킹 (시스템 정보 노출 금지)
    logger.error('[Trial-Admin] Unhandled error in GET /trials', {
      errorType: error?.constructor?.name || 'Unknown',
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
