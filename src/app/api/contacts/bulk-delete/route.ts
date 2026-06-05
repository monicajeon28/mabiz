import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST /api/contacts/bulk-delete
 * 고객 일괄 삭제 (소프트 삭제: deletedAt 설정)
 * 대리점장(OWNER) 및 관리자(GLOBAL_ADMIN)만 가능
 *
 * Request:
 *   {
 *     contactIds: string[]           // 삭제할 고객 ID 배열 (1-500개)
 *     organizationId?: string         // GLOBAL_ADMIN이 명시적으로 선택한 조직 (선택)
 *   }
 *
 * Response:
 *   {
 *     ok: boolean
 *     count: number                   // 삭제된 고객 수
 *     message?: string                // 에러 메시지
 *     code?: string                   // 에러 코드 (FORBIDDEN, INVALID_JSON, INVALID_TYPE, EMPTY_ARRAY, LIMIT_EXCEEDED, INVALID_ID_FORMAT)
 *   }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // ⚠️ 대리점장(OWNER)과 관리자(GLOBAL_ADMIN)만 삭제 가능
    // 판매원(AGENT, FREE_SALES) 불가
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '고객 삭제는 대리점장 이상만 가능합니다', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // JSON 파싱 에러 처리
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(
        { ok: false, message: 'JSON 파싱 오류', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { contactIds, organizationId: bodyOrgId } = body as { contactIds?: unknown; organizationId?: string };

    // 타입 검증: contactIds는 배열이어야 함
    if (!Array.isArray(contactIds)) {
      return NextResponse.json(
        { ok: false, message: 'contactIds는 배열이어야 합니다', code: 'INVALID_TYPE' },
        { status: 400 }
      );
    }

    // 빈 배열 검증
    if (contactIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: '삭제할 고객을 선택하세요', code: 'EMPTY_ARRAY' },
        { status: 400 }
      );
    }

    // 500명 초과 검증
    if (contactIds.length > 500) {
      return NextResponse.json(
        { ok: false, message: '한 번에 500명까지 삭제 가능합니다', code: 'LIMIT_EXCEEDED' },
        { status: 400 }
      );
    }

    // ID 형식 검증: 모두 문자열이어야 함
    const invalidIds = contactIds.filter(id => typeof id !== 'string' || !String(id).trim());
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { ok: false, message: '모든 ID는 빈 문자열이 아닌 문자열이어야 합니다', code: 'INVALID_ID_FORMAT', invalidIds },
        { status: 400 }
      );
    }

    // organizationId 결정
    let orgId: string;
    if (ctx.role === 'GLOBAL_ADMIN') {
      // GLOBAL_ADMIN: Body에 organizationId가 있으면 사용, 없으면 resolveOrgId()로 본사 기본값(BONSA_ORG_ID) 사용
      orgId = bodyOrgId || resolveOrgId(ctx);
    } else {
      // OWNER: 자신의 organizationId 사용 (필수)
      try {
        orgId = requireOrgId(ctx);
      } catch (err) {
        return NextResponse.json(
          { ok: false, message: '조직 정보가 없습니다', code: 'ORG_REQUIRED' },
          { status: 400 }
        );
      }
    }

    // 하드 삭제: DB에서 완전 제거 (백업: Neon → Supabase → Google Drive)
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.contact.deleteMany({
        where: {
          id: { in: contactIds as string[] },
          organizationId: orgId,
        },
      });

      return deleted.count;
    });

    // 🔴 부분 삭제 경고: 요청한 ID 중 일부만 삭제됨
    if (result < contactIds.length) {
      logger.warn('[POST /api/contacts/bulk-delete] Partial deletion detected', {
        orgId,
        requested: contactIds.length,
        deleted: result,
        missing: contactIds.length - result,
        deletedBy: ctx.userId,
      });
    }

    logger.log('[POST /api/contacts/bulk-delete]', {
      orgId,
      count: result,
      total: contactIds.length,
      deletedBy: ctx.userId,
    });

    return NextResponse.json({ ok: true, count: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';

    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (msg === 'ORGANIZATION_REQUIRED') {
      return NextResponse.json(
        { ok: false, message: '조직 정보가 없습니다', code: 'ORG_REQUIRED' },
        { status: 400 }
      );
    }

    logger.error('[POST /api/contacts/bulk-delete]', { message: msg, stack });
    return NextResponse.json(
      { ok: false, message: '고객 삭제 중 오류가 발생했습니다', code: 'INTERNAL_ERROR', error: msg },
      { status: 500 }
    );
  }
}
