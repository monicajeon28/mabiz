import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, canDelete, buildContactWhere, actorDisplayName } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST /api/contacts/bulk-delete
 * 고객 일괄(복수) 삭제 — 휴지통(소프트 삭제: deletedAt + 삭제자 기록)으로 이동
 * 지사장(OWNER) 및 관리자(GLOBAL_ADMIN)만 가능 (대리점장 AGENT/FREE_SALES 불가)
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

    // ⚠️ 지사장(OWNER)과 관리자(GLOBAL_ADMIN)만 삭제 가능
    // 대리점장(AGENT, FREE_SALES)은 canDelete=false로 차단됨
    if (!canDelete(ctx)) {
      return NextResponse.json(
        { ok: false, message: '삭제 권한이 없습니다. (대리점장은 삭제할 수 없습니다)', code: 'FORBIDDEN' },
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

    const { contactIds } = body as { contactIds?: unknown };

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

    // 휴지통 이동(소프트 삭제): deletedAt + 삭제자 기록.
    // buildContactWhere로 권한 스코프 제한(OWNER=자기조직, GLOBAL_ADMIN=전체) +
    // deletedAt:null 자동 적용 → 남의 조직 고객/이미 삭제된 고객은 대상에서 제외됨.
    const where = buildContactWhere(ctx, { id: { in: contactIds as string[] } });

    // ── Drive 백업 (삭제 전 스냅샷) — 단건 삭제와 동일하게 복수삭제도 백업 ──
    // 백업 준비/실행 실패해도 삭제는 진행하되, 실패는 반드시 로그로 남긴다(조용한 실패 방지).
    try {
      const targets = await prisma.contact.findMany({
        where,
        include: {
          callLogs: { orderBy: { createdAt: 'desc' } },
          memos: { orderBy: { createdAt: 'desc' } },
          groups: { include: { group: { select: { id: true, name: true } } } },
          organization: { select: { id: true, name: true } },
        },
      });

      if (targets.length > 0) {
        const ids = targets.map((c) => c.id);
        const allTransfers = await prisma.contactTransferLog.findMany({
          where: { contactId: { in: ids } },
          orderBy: { createdAt: 'desc' },
        });
        const transfersByContact = new Map<string, typeof allTransfers>();
        for (const t of allTransfers) {
          const arr = transfersByContact.get(t.contactId) ?? [];
          arr.push(t);
          transfersByContact.set(t.contactId, arr);
        }

        // 조직별 그룹핑 (GLOBAL_ADMIN이 여러 조직을 섞어 삭제할 수 있으므로 org별 파일로 분리)
        const byOrg = new Map<string, { orgName: string; contacts: typeof targets }>();
        for (const c of targets) {
          const g = byOrg.get(c.organizationId) ?? { orgName: c.organization.name, contacts: [] };
          g.contacts.push(c);
          byOrg.set(c.organizationId, g);
        }

        for (const [orgId, group] of byOrg) {
          const contacts = group.contacts.map((c) => ({
            ...c,
            tags: c.tags ?? [],
            groups: c.groups,
            transferLogs: (transfersByContact.get(c.id) ?? []).map((t) => ({ ...t, toUserName: null })),
          }));
          import('@/lib/backup-xlsx')
            .then(({ backupContactsToExcel }) =>
              backupContactsToExcel({
                orgName: group.orgName,
                orgId,
                contacts,
                mode: 'pre_delete',
                contactNameForDelete: `일괄삭제_${contacts.length}명`,
              }).catch((err) =>
                logger.error('[bulk-delete] Drive 백업 실패', {
                  orgId, count: contacts.length,
                  error: err instanceof Error ? err.message : String(err),
                })
              )
            )
            .catch((err) =>
              logger.error('[bulk-delete] 백업 모듈 로드 실패', {
                error: err instanceof Error ? err.message : String(err),
              })
            );
        }
      }
    } catch (backupErr) {
      logger.error('[bulk-delete] 백업 준비 중 오류 (삭제는 계속 진행)', {
        error: backupErr instanceof Error ? backupErr.message : String(backupErr),
      });
    }

    const result = await prisma.contact.updateMany({
      where,
      data: {
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        deletedByName: actorDisplayName(ctx),
      },
    });

    // 🔴 부분 처리 경고: 요청한 ID 중 일부만 휴지통 이동됨 (권한 밖/이미 삭제)
    if (result.count < contactIds.length) {
      logger.warn('[POST /api/contacts/bulk-delete] Partial soft-delete detected', {
        requested: contactIds.length,
        deleted: result.count,
        missing: contactIds.length - result.count,
        deletedBy: ctx.userId,
      });
    }

    logger.log('[POST /api/contacts/bulk-delete] 휴지통 이동(soft)', {
      count: result.count,
      total: contactIds.length,
      deletedBy: ctx.userId,
    });

    return NextResponse.json({ ok: true, deleted: result.count });
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
      { ok: false, message: '고객 삭제 중 오류가 발생했습니다', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
