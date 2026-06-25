export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GMcruise ProductInquiry 실제 status 값 (소문자)
const VALID_STATUSES = new Set(['pending', 'unavailable', 'passport_waiting', 'confirmed', 'refund']);

function buildAssigneeLabel(
  affiliateCode: string | null,
  agentId: number | null,
  agentDisplayName: string | null,
  agentType: string | null
): string {
  if (!affiliateCode && !agentId) return '본사';
  if (!agentDisplayName) return affiliateCode ? '(' + affiliateCode + ')' : '본사';
  const rolePrefix =
    agentType === 'OWNER' ? '지사장' :
    agentType === 'AGENT' ? '대리점장' :
    agentType === 'FREE_SALES' ? '마케터' : '';
  return rolePrefix ? rolePrefix + ' ' + agentDisplayName : agentDisplayName;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  }
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

type RawInquiry = {
  id: number;
  productCode: string;
  name: string;
  phone: string;
  message: string | null;
  status: string;
  createdAt: Date;
  userId: number | null;
  agentId: number | null;
  managerId: number | null;
  agentDisplayName: string | null;
  agentType: string | null;
  affiliateCode: string | null;
};

/**
 * GET /api/gold-inquiries
 * GMcruise CruiseProductInquiry 목록 조회
 *
 * GLOBAL_ADMIN: 전체 조회
 * OWNER: managerId=자신 OR agentId=자신인 문의만 (mallUser 연동 필수)
 * AGENT: agentId=자신인 문의만 (mallUser 연동 필수)
 * FREE_SALES: 403
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '이 기능에 접근할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // OWNER/AGENT는 organizationId가 필수
    if ((ctx.role === 'OWNER' || ctx.role === 'AGENT') && !ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '조직 정보가 없습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset = (page - 1) * limit;

    const rawStatus = searchParams.get('status');
    const q         = searchParams.get('q')?.trim() ?? '';
    // 대소문자 모두 처리: UI가 보내는 값 소문자 정규화
    const statusRaw = rawStatus?.toLowerCase() ?? '';
    const status    = statusRaw && VALID_STATUSES.has(statusRaw) ? statusRaw : null;

    const statusCondition: Prisma.Sql = status
      ? Prisma.sql`AND pi.status = ${status}`
      : Prisma.empty;
    const searchCondition: Prisma.Sql = q
      ? Prisma.sql`AND (pi.name ILIKE ${`%${q}%`} OR pi.phone ILIKE ${`%${q}%`})`
      : Prisma.empty;

    // 역할별 어필리에이트 필터
    const mallUserId = ctx.mallUser?.id ?? null;

    // AGENT(대리점장)는 GMcruise 미연동이면 403 (agentId 필터에 mallUser 필요).
    // OWNER(지사장)는 조직(organizationId) 기준 스코프라 mallUser 없어도 됨.
    if (ctx.role === 'AGENT' && !mallUserId) {
      return NextResponse.json(
        { ok: false, error: 'GMCRUISE_LINK_REQUIRED', message: '크루즈닷몰 계정 연동이 필요합니다.' },
        { status: 403 }
      );
    }

    const affiliateFilter: Prisma.Sql = (() => {
      if (ctx.role === 'GLOBAL_ADMIN') return Prisma.empty;
      // OWNER(지사장) = 본인 조직(지사) 전체 = 본인 + 산하 대리점장·마케터 문의. 다른 지사 불가.
      if (ctx.role === 'OWNER') {
        return ctx.organizationId
          ? Prisma.sql`AND pi."organizationId" = ${ctx.organizationId}`
          : Prisma.sql`AND 1=0`;
      }
      // AGENT(대리점장) = 본인 담당(agentId)만 + 조직 격리.
      if (ctx.role === 'AGENT') {
        return (mallUserId && ctx.organizationId)
          ? Prisma.sql`AND pi."agentId" = ${mallUserId} AND pi."organizationId" = ${ctx.organizationId}`
          : Prisma.sql`AND 1=0`;
      }
      return Prisma.sql`AND 1=0`;
    })();

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawInquiry[]>(Prisma.sql`
        SELECT
          pi.id,
          pi."productCode",
          pi.name,
          pi.phone,
          pi.message,
          pi.status,
          pi."createdAt",
          pi."userId",
          pi."agentId",
          pi."managerId",
          pi."affiliateCode",
          COALESCE(ap."displayName", agent.name, '') AS "agentDisplayName",
          ap.type AS "agentType"
        FROM "CruiseProductInquiry" pi
        LEFT JOIN "User" agent ON agent.id = pi."agentId"
        LEFT JOIN "AffiliateProfile" ap ON ap."userId" = pi."agentId"
        WHERE pi."productCode" LIKE 'GOLD_MEMBERSHIP%'
          ${statusCondition}
          ${searchCondition}
          ${affiliateFilter}
        ORDER BY pi."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "CruiseProductInquiry" pi
        WHERE pi."productCode" LIKE 'GOLD_MEMBERSHIP%'
          ${statusCondition}
          ${searchCondition}
          ${affiliateFilter}
      `),
    ]);

    const total = countRows.length > 0 && countRows[0] ? Number(countRows[0].total) : 0;

    const inquiries = rows.map((r) => ({
      id:          r.id,
      productCode: r.productCode,
      name:        r.name,
      phone:       r.phone ? maskPhone(r.phone) : null,
      message:     r.message,
      status:      r.status,
      submittedAt: new Date(r.createdAt).toISOString(), // $queryRaw는 문자열 반환 가능 → 방어적 처리
      createdAt:   new Date(r.createdAt).toISOString(),
      tier:        null,
      agentName:   buildAssigneeLabel(r.affiliateCode, r.agentId, r.agentDisplayName, r.agentType),
      agentId:     r.agentId ?? null,
      managerId:   r.managerId ?? null,
    }));

    logger.log('[GET /api/gold-inquiries]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, inquiries, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/gold-inquiries]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '문의 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
