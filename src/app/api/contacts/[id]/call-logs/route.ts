export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { addLeadScore } from "@/lib/lead-score";
import { getAuthContext } from "@/lib/rbac";
import { validateObjectionInput } from "@/lib/objections/validation";
import { CallLogIdSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

const toOptionalInt = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

// GET /api/contacts/[id]/call-logs
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    if (ctx.role !== 'GLOBAL_ADMIN' && !ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
    }
    const contactWhere = ctx.role === 'GLOBAL_ADMIN'
      ? { id }
      : { id, organizationId: ctx.organizationId! };
    const contact = await prisma.contact.findFirst({ where: contactWhere });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 역할별 필터링
    let whereClause: Prisma.CallLogWhereInput = { contactId: id };
    if (ctx.role === 'AGENT') {
      // 판매원은 자신이 만든 콜기록만 봄
      whereClause.userId = ctx.userId;
    }
    // OWNER/GLOBAL_ADMIN은 contactId 필터만으로 OK (조직/전체 콜 모두 볼 수 있음)

    // 페이지 파라미터 추출 (기본값: page=1)
    const pageParam = new URL(_req.url).searchParams.get('page') ?? '1';
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const pageSize = 20;  // 한 페이지에 20개씩
    const skip = (page - 1) * pageSize;

    const logs = await prisma.callLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: skip,
    });

    // 전체 개수도 함께 반환 (프론트에서 페이지 정보 표시용)
    const total = await prisma.callLog.count({ where: whereClause });

    return NextResponse.json({
      ok: true,
      logs,
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    logger.error("[GET call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/contacts/[id]/call-logs?logId=xxx  (단건)
// DELETE /api/contacts/[id]/call-logs             (전체)
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("logId");

    if (ctx.role !== 'GLOBAL_ADMIN' && !ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
    }
    const contactWhere = ctx.role === 'GLOBAL_ADMIN'
      ? { id }
      : { id, organizationId: ctx.organizationId! };
    const contact = await prisma.contact.findFirst({ where: contactWhere });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // AGENT는 자신의 콜로그만 삭제 가능
    const deleteWhere: Prisma.CallLogWhereInput = { contactId: id };
    if (ctx.role === 'AGENT') {
      deleteWhere.userId = ctx.userId;
    }

    if (logId) {
      // [S-001] 로그 ID 검증 (SQL Injection 방지)
      const validation = CallLogIdSchema.safeParse({ logId, contactId: id });
      if (!validation.success) {
        return NextResponse.json(
          { ok: false, message: "유효하지 않은 로그 ID 형식입니다" },
          { status: 400 }
        );
      }

      await prisma.callLog.deleteMany({ where: { ...deleteWhere, id: logId } });
    } else {
      await prisma.callLog.deleteMany({ where: deleteWhere });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PUT /api/contacts/[id]/call-logs?logId=xxx (수정)
export async function PUT(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("logId");

    if (!logId) return NextResponse.json({ ok: false, message: "logId 필수" }, { status: 400 });

    // [S-001] 로그 ID 검증 (SQL Injection 방지)
    const validation = CallLogIdSchema.safeParse({ logId, contactId: id });
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 로그 ID 형식입니다" },
        { status: 400 }
      );
    }

    const contactWhere = ctx.role === 'GLOBAL_ADMIN'
      ? { id }
      : { id, organizationId: ctx.organizationId! };
    const contact = await prisma.contact.findFirst({ where: contactWhere });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 기존 콜 기록 확인
    const existingLog = await prisma.callLog.findFirst({ where: { id: logId, contactId: id } });
    if (!existingLog) return NextResponse.json({ ok: false }, { status: 404 });

    // AGENT는 자신의 콜 기록만 수정 가능
    if (ctx.role === 'AGENT' && existingLog.userId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: '다른 사용자의 콜기록은 수정할 수 없습니다' }, { status: 403 });
    }

    const body = await req.json();
    const {
      content, result, duration, convictionScore, nextAction, scheduledAt,
      objectionId, customerReaction, recovered, recoveryTime
    } = body;

    // Track A: 이의처리 데이터 검증
    const objectionValidation = validateObjectionInput({
      objectionId,
      customerReaction,
      recovered,
      recoveryTime,
    });
    if (!objectionValidation.isValid) {
      return NextResponse.json(
        { ok: false, errors: objectionValidation.errors },
        { status: 400 }
      );
    }

    // 수정
    const updateResult = await prisma.callLog.updateMany({
      where: { id: logId, contactId: id },
      data: {
        content: content ?? existingLog.content,
        result: result ?? existingLog.result,
        duration: duration !== undefined ? toOptionalInt(duration) : existingLog.duration,
        convictionScore: convictionScore !== undefined ? toOptionalInt(convictionScore) : existingLog.convictionScore,
        nextAction: nextAction ?? existingLog.nextAction,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : existingLog.scheduledAt,
        // Track A: 이의처리 필드
        objectionId: objectionId ?? existingLog.objectionId,
        customerReaction: customerReaction ?? existingLog.customerReaction,
        recovered: recovered !== undefined ? recovered : existingLog.recovered,
        recoveryTime: recoveryTime !== undefined ? toOptionalInt(recoveryTime) : existingLog.recoveryTime,
      },
    });
    if (updateResult.count === 0) return NextResponse.json({ ok: false }, { status: 404 });
    const updatedLog = await prisma.callLog.findUnique({ where: { id: logId } });
    if (!updatedLog) return NextResponse.json({ ok: false }, { status: 404 });

    logger.log('[PUT call-logs] 수정 완료', { logId, contactId: id, updatedBy: ctx.userId });
    return NextResponse.json({ ok: true, log: updatedLog }, { status: 200 });
  } catch (err) {
    logger.error("[PUT call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/contacts/[id]/call-logs
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx      = await getAuthContext();
    const { id }   = await params;
    const body     = await req.json();

    if (ctx.role !== 'GLOBAL_ADMIN' && !ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
    }
    const contactWhere = ctx.role === 'GLOBAL_ADMIN'
      ? { id }
      : { id, organizationId: ctx.organizationId! };
    const contact = await prisma.contact.findFirst({
      where: contactWhere,
      select: { id: true, name: true, phone: true },
    });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const {
      content, result, duration, convictionScore, nextAction, scheduledAt,
      objectionId, customerReaction, recovered, recoveryTime
    } = body;

    // [E-004] 폼 유효성 검사: content 필수 검증
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { ok: false, message: '콜 기록 내용을 입력하세요' },
        { status: 400 }
      );
    }

    // Track A: 이의처리 데이터 검증 (빈 문자열 → undefined 정규화)
    const objectionValidation = validateObjectionInput({
      objectionId: objectionId || undefined,
      customerReaction: customerReaction || undefined,
      recovered,
      recoveryTime: (recoveryTime !== undefined && recoveryTime !== "" && recoveryTime !== null)
        ? Number(recoveryTime)
        : undefined,
    });
    if (!objectionValidation.isValid) {
      return NextResponse.json(
        { ok: false, errors: objectionValidation.errors },
        { status: 400 }
      );
    }

    const log = await prisma.callLog.create({
      data: {
        contactId: id,
        userId: ctx.userId,
        content,
        result,
        duration:        toOptionalInt(duration),
        convictionScore: toOptionalInt(convictionScore),
        nextAction,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        // Track A: 이의처리 필드
        objectionId: objectionId || null,
        customerReaction: customerReaction || null,
        recovered: recovered !== undefined ? recovered : null,
        recoveryTime: toOptionalInt(recoveryTime),
      },
    });

    // 마지막 연락일 업데이트
    await prisma.contact.updateMany({
      where: contactWhere,
      data: { lastContactedAt: new Date() },
    });

    // 리드 스코어 (fire-and-forget)
    const scoreMap: Record<string, "CALL_INTERESTED" | "CALL_RESCHEDULED" | "CALL_PENDING" | "CALL_REJECTED"> = {
      INTERESTED:  "CALL_INTERESTED",
      RESCHEDULED: "CALL_RESCHEDULED",
      PENDING:     "CALL_PENDING",
      REJECTED:    "CALL_REJECTED",
    };
    if (result && scoreMap[result]) {
      addLeadScore(id, scoreMap[result]).catch(err => logger.error('[addLeadScore failed]', { err, contactId: id }));
    }

    // ★ 작성자 이름 조회 (응답에 _authorName 포함 → 클라이언트 즉시 표시)
    let _authorName: string | null = null;
    if (ctx.role === 'GLOBAL_ADMIN') {
      const ga = await prisma.globalAdmin.findUnique({
        where: { id: ctx.userId },
        select: { displayName: true },
      });
      _authorName = ga?.displayName ?? '관리자';
    } else {
      _authorName = ctx.member?.displayName ?? null;
    }

    // ★ Google Drive 자동 백업 (BackupJob 큐에 등록)
    if (ctx.userId && process.env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID) {
      const backupUserId  = ctx.role === 'GLOBAL_ADMIN' ? 'admin' : ctx.userId;
      const backupDisplay = _authorName ?? ctx.userId;

      // ✅ BackupJob에 등록 (바로 백업하지 않고, 크론이 나중에 처리)
      await prisma.backupJob.create({
        data: {
          type: 'CALL_LOG',
          targetId: id,
          payload: {
            userId:       backupUserId,
            displayName:  backupDisplay,
            customerName: contact.name,
            customerPhone: contact.phone,
          },
        },
      }).catch(err => {
        // P2: BackupJob 누락은 Neon 저장 성공과 구분해서 별도 추적
        logger.error('[CallLog] BackupJob 등록 실패 — Drive 백업 누락 위험', {
          err,
          contactId: id,
          logId: log.id,
          severity: 'BACKUP_MISSING',
        });
      });
    }

    return NextResponse.json({ ok: true, log: { ...log, _authorName } }, { status: 201 });
  } catch (err) {
    logger.error("[POST call-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
