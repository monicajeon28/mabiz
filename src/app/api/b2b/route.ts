export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import {
  getB2BProspects,
  createB2BProspect,
} from '@/lib/b2b/service';
import {
  B2BProspectCreateSchema,
  B2B_PROSPECT_STATUSES,
} from '@/lib/b2b/validation';
import { resolveGlobalAdminOrgId } from '@/lib/partner-stats';
import { checkRateLimitAsync } from '@/lib/rate-limit';

// NOTE: requirePartnerContext()는 GLOBAL_ADMIN을 role='admin'으로 매핑함
// 이 상수를 변경할 경우 passport-auth.ts의 매핑도 반드시 함께 변경
const PARTNER_CTX_GLOBAL_ADMIN_ROLE = 'admin' as const;
const PARTNER_CTX_AGENT_ROLE = 'agent' as const; // T-002: 매직 스트링 제거 — passport-auth.ts 매핑 변경 시 여기만 수정

export async function GET(req: Request) {
  try {
    // P1: 보안 - 권한 검증 강화
    const ctx = await requirePartnerContext();
    if (!ctx) {
      // T-025: 인증 상태 열거 방지 — 세션 유무와 관계없이 동일한 403 + 동일 메시지 반환
      logger.warn('[b2b] GET: 미인증/권한없음 요청');
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    // AGENT 차단: requirePartnerContext()가 소문자 'agent'를 반환
    // FREE_SALES: T-001에서 passport-auth 레벨에서 차단됨 (null 반환 → 위 403 처리)
    const ctxRole = ctx.sessionUser?.role;
    if (ctxRole === PARTNER_CTX_AGENT_ROLE) {
      logger.warn('[b2b] GET: AGENT 접근 차단', { role: ctxRole });
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    // requirePartnerContext 반환 role: 'admin'(=GLOBAL_ADMIN), 'owner'(=OWNER), 'agent'(=AGENT)
    // GLOBAL_ADMIN(role='admin')은 organizationId 없이도 접근 가능
    if (!ctx.organizationId && ctxRole !== PARTNER_CTX_GLOBAL_ADMIN_ROLE) {
      logger.error('[b2b] GET: organizationId 없음', { userId: ctx.sessionUser?.id });
      return NextResponse.json({ ok: false, error: '조직 정보 없음. 관리자에게 문의하세요.' }, { status: 403 });
    }

    // T-012: Rate limiting (GET — 스크래핑 방지)
    const rlGet = await checkRateLimitAsync(`b2b:get:${ctx.sessionUser?.id ?? 'anon'}`, 30, 30_000);
    if (!rlGet.allowed) {
      return NextResponse.json({ ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);

    // P1: 안정성 - 입력 검증 강화
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    // 쿼리 파라미터 검증
    const eduType = searchParams.get('eduType');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    // eduType 검증
    if (eduType && !['BUYER', 'INQUIRER'].includes(eduType)) {
      logger.warn('[b2b] GET: 잘못된 eduType', { eduType });
      return NextResponse.json(
        { ok: false, error: 'eduType이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // status 검증 (T-014: B2B_PROSPECT_STATUSES SSOT 사용 — /api/b2b-prospects와 공유)
    // NOTE: requirePartnerContext()는 내부적으로 GLOBAL_ADMIN→'admin', OWNER→'owner', AGENT→'agent'로 매핑함
    // ctx.sessionUser?.role !== 'admin' 비교는 위 매핑에 의존함. 리팩토링 시 반드시 함께 수정 필요.
    if (status && !(B2B_PROSPECT_STATUSES as readonly string[]).includes(status)) {
      logger.warn('[b2b] GET: 잘못된 status', { status });
      return NextResponse.json(
        { ok: false, error: 'status가 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // GLOBAL_ADMIN(admin role)은 organizationId=null → service에서 전체 조회
    const effectiveOrgId: string | null = ctx.organizationId ?? null;

    // T-016: GLOBAL_ADMIN 전체 조회 시 limit 강제 축소 (seq scan 방지)
    // /api/b2b-prospects(line 51)와 동일한 정책 적용
    const effectiveLimit = effectiveOrgId === null ? Math.min(limit, 50) : limit;

    // P1: 성능 - 병렬 쿼리 실행 (getB2BProspects 내부에서 처리)
    const result = await getB2BProspects(effectiveOrgId, {
      page,
      limit: effectiveLimit,
      eduType: eduType || undefined,
      status: status || undefined,
      q: q || undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    logger.error('[b2b] GET /api/b2b error', { err });
    return NextResponse.json(
      { ok: false, error: '목록 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // P1: 보안 - 권한 검증 강화
    const ctx = await requirePartnerContext();
    if (!ctx) {
      // T-025: 인증 상태 열거 방지 — 세션 유무와 관계없이 동일한 403 + 동일 메시지 반환
      logger.warn('[b2b] POST: 미인증/권한없음 요청');
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    // AGENT 차단: requirePartnerContext()가 소문자 'agent'를 반환
    // FREE_SALES: T-001에서 passport-auth 레벨에서 차단됨 (null 반환 → 위 403 처리)
    const postCtxRole = ctx.sessionUser?.role;
    if (postCtxRole === PARTNER_CTX_AGENT_ROLE) {
      logger.warn('[b2b] POST: AGENT 접근 차단', { role: postCtxRole });
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    // T-012: Rate limiting (POST — 전화번호 열거 공격 방지)
    const rlPost = await checkRateLimitAsync(`b2b:post:${ctx.sessionUser?.id ?? 'anon'}`, 10, 60_000);
    if (!rlPost.allowed) {
      return NextResponse.json({ ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    // GLOBAL_ADMIN(role=PARTNER_CTX_GLOBAL_ADMIN_ROLE)은 organizationId=null → resolveGlobalAdminOrgId()로 안전하게 처리
    // (BONSA_ORG_ID 환경변수 우선 → DB 최오래된 조직 순서로 fallback)
    let effectiveOrgId = ctx.organizationId;
    if (!effectiveOrgId) {
      if (postCtxRole !== PARTNER_CTX_GLOBAL_ADMIN_ROLE) { // PARTNER_CTX_GLOBAL_ADMIN_ROLE = 'admin' = GLOBAL_ADMIN
        logger.error('[b2b] POST: organizationId 없음', { userId: ctx.sessionUser?.id });
        return NextResponse.json({ ok: false, error: '조직 정보 없음' }, { status: 403 });
      }
      try {
        effectiveOrgId = await resolveGlobalAdminOrgId();
      } catch {
        logger.error('[b2b] POST: 조직 없음 — BONSA_ORG_ID 환경변수 확인 필요');
        return NextResponse.json({ ok: false, error: '조직을 찾을 수 없습니다' }, { status: 500 });
      }
    }

    let body;
    try {
      body = await req.json();
    } catch (err) {
      logger.warn('[b2b] POST: 잘못된 JSON 형식', { error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json(
        { ok: false, error: 'JSON 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = B2BProspectCreateSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn('[b2b] POST: 검증 실패', { errors });
      return NextResponse.json(
        { ok: false, error: `검증 오류: ${errors}` },
        { status: 400 }
      );
    }

    // P1: 보안 - effectiveOrgId로 생성 (클라이언트 전달값 무시, IDOR 방지)
    const result = await createB2BProspect(effectiveOrgId, parseResult.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && (err as { code?: string }).code === 'DUPLICATE_PROSPECT') {
      logger.warn('[b2b] POST: 중복 prospect');
      return NextResponse.json(
        { ok: false, error: '같은 조직에 이미 존재하는 전화번호입니다' },
        { status: 409 }
      );
    }

    logger.error('[b2b] POST /api/b2b error', { err });
    return NextResponse.json(
      { ok: false, error: '생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
