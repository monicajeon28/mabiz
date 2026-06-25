export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { B2B_PROSPECT_STATUSES, B2BProspectUpdateSchema } from "@/lib/b2b/validation";

// T-014: SSOT — B2B_PROSPECT_STATUSES from @/lib/b2b/validation으로 통합 (ACTIVE 포함)
const ALLOWED_STATUSES = B2B_PROSPECT_STATUSES;

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return phone;
  const visibleEnd = phone.slice(-4);
  const masked = phone.slice(0, phone.length - 4).replace(/./g, '*');
  return masked + visibleEnd;
}

// GET /api/b2b-prospects?eduType=INQUIRER&q=검색어&page=1&limit=50
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 대리점장·마케터 완전 차단
    if (ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    // Rate limit: 사용자당 30초에 30회 (전화번호 열거 공격 방지)
    const rlGet = await checkRateLimitAsync(
      `b2bProspects:get:${ctx.userId ?? 'anon'}`,
      30,
      30_000
    );
    if (!rlGet.allowed) {
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const orgId = resolveOrgIdOrNull(ctx);

    const { searchParams } = new URL(req.url);
    const eduType = searchParams.get("eduType") ?? undefined;
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const rawLimit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    // T-029: GLOBAL_ADMIN 전체 조회 시 limit 강제 축소 (seq scan 방지)
    const limit = (orgId === null) ? Math.min(rawLimit, 50) : rawLimit;
    const skip = (page - 1) * limit;
    // T-015: GET status 파라미터 검증 (PATCH와 동일한 허용 목록 적용)
    const rawStatus = searchParams.get("status");
    const status = rawStatus && (ALLOWED_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : undefined;

    // T-001: eduType allowlist 검증 (BUYER / INQUIRER 외 값 차단)
    if (eduType && !['BUYER', 'INQUIRER'].includes(eduType)) {
      return NextResponse.json(
        { ok: false, error: 'eduType이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    const where = {
      ...(orgId !== null ? { organizationId: orgId } : {}),
      deletedAt: null,
      ...(eduType ? { eduType } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          eduType: true,
          productName: true,
          paymentAmount: true,
          paymentDate: true,
          notes: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          organizationId: true, // T-029: 전체 조회 시 조직 식별 용도
        },
      }),
      prisma.b2BProspect.count({ where }),
    ]);

    // T-010: OWNER는 organizationId 필터로 본인 조직 데이터만 조회하므로 마스킹 불필요
    const shouldMask = ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER';
    const maskedProspects = prospects.map((p) => ({
      ...p,
      phone: shouldMask ? maskPhone(p.phone) : p.phone,
      // T-020: email 마스킹 추가 — PATCH 응답(line 214)과 일관성 확보
      email: shouldMask && p.email
        ? p.email.replace(/(.{2}).+(@.+)/, '$1***$2')
        : p.email,
    }));

    // T-015: organizationId는 내부 식별자 — 클라이언트에 노출 불필요, 모든 역할에서 제거
    const safeProspects = maskedProspects.map((p) => {
      const { organizationId: _oid, ...rest } = p;
      return rest;
    });

    return NextResponse.json({
      ok: true,
      prospects: safeProspects,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    // T-013: 문자열 부분 매칭(includes) 대신 엄격한 === 비교로 교체 — 외부 라이브러리 에러 메시지와의 우발적 충돌 방지
    const isUnauth = err instanceof Error && err.message === 'UNAUTHORIZED';
    if (isUnauth) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
    }
    logger.error("[GET /api/b2b-prospects]", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}

// PATCH /api/b2b-prospects?id=xxx — 상태 변경
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 대리점장·마케터 완전 차단
    if (ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    // T-002: Rate limit identifier를 userId 기반으로 변경 (x-forwarded-for 헤더 위조 우회 방지)
    const identifier = `b2bProspects:patch:${ctx.userId ?? 'anon'}`;
    const rateLimitResult = await checkRateLimitAsync(identifier, 20, 30_000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const orgId = resolveOrgIdOrNull(ctx);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }

    // T-001: Zod B2BProspectUpdateSchema로 body 검증 (notes 길이 무제한 DoS/XSS 방지)
    const rawBody = await req.json();
    const parsed = B2BProspectUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: `입력 오류: ${parsed.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // T-013: status enum 유효성 검사 (Zod 스키마 이후 추가 검증 — SSOT 허용 목록 기준)
    if (body.status !== undefined && !(ALLOWED_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: `status는 ${ALLOWED_STATUSES.join('/')} 중 하나여야 합니다` },
        { status: 400 }
      );
    }

    // T-020: TOCTOU 레이스 컨디션 방지 — updateMany로 소유권 + deletedAt 조건을 원자적으로 적용
    // (findFirst 소유권 확인 → update PK만 사용 구조를 제거하여 소프트 삭제 레코드 갱신 방지)
    const updated = await prisma.b2BProspect.updateMany({
      where: {
        id,
        ...(orgId !== null ? { organizationId: orgId } : {}),
        deletedAt: null, // 소프트 삭제된 레코드 갱신 방지
      },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ ok: false, error: '업데이트에 실패했습니다' }, { status: 404 });
    }

    // T-003: 업데이트 후 결과 조회 — organizationId 필터 + deletedAt: null 추가 (소유권 재확인)
    const result = await prisma.b2BProspect.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(orgId !== null ? { organizationId: orgId } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        eduType: true,
        productName: true,
        status: true,
        createdAt: true,
      },
    });

    // T-026: result null 체크 — 업데이트 성공 후 소프트삭제 등으로 레코드를 찾을 수 없는 경우
    if (!result) {
      return NextResponse.json(
        { ok: false, error: '레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // T-003 + T-010: PII 마스킹 (GLOBAL_ADMIN / OWNER 제외)
    const shouldMaskResult = ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER';
    return NextResponse.json({
      ok: true,
      prospect: {
        ...result,
        phone: shouldMaskResult ? maskPhone(result.phone) : result.phone,
        email: shouldMaskResult && result.email
          ? result.email.replace(/(.)(.+)(@.+)/, '$1***$3')
          : result.email,
      },
    });
  } catch (err) {
    logger.error("[PATCH /api/b2b-prospects]", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
