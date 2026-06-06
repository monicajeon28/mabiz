import "server-only";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import {
  generateMallUserId,
  buildAffiliateCode,
  ensureUniqueAffiliateCode,
  isMallUserIdTaken,
  hashAffiliatePassword,
  type IssueAffiliateInput,
  type IssueAffiliateResult,
} from "@/lib/affiliate-issuance";

export const dynamic = "force-dynamic";

/**
 * GET /api/affiliate-issuance
 * GLOBAL_ADMIN 전용 — 발급된 어필리에이트 목록 조회
 *
 * 쿼리 파라미터:
 *   type   — BRANCH_MANAGER | SALES_AGENT | PRE_SALES | HQ (선택)
 *   status — ACTIVE | DRAFT (선택, 기본 ACTIVE)
 *   q      — 이름/mallUserId 검색 (선택)
 *   page   — 페이지 번호 (기본 1)
 *   limit  — 페이지 크기 (기본 20, 최대 100)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type") ?? undefined;
    const statusFilter = searchParams.get("status") ?? "ACTIVE";
    const q = searchParams.get("q") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const where = {
      ...(typeFilter ? { type: typeFilter } : {}),
      status: statusFilter,
    };

    // 전체 개수와 페이지 데이터 병렬 조회
    const [total, profiles] = await Promise.all([
      prisma.gmAffiliateProfile.count({ where }),
      prisma.gmAffiliateProfile.findMany({
        where,
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          affiliateCode: true,
          displayName: true,
          contactPhone: true,
          contactEmail: true,
          contractStatus: true,
          withholdingRate: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // userId 목록으로 GmUser 일괄 조회
    const userIds = profiles.map((p) => p.userId);
    const users = await prisma.gmUser.findMany({
      where: { id: { in: userIds } },
      select: { id: true, mallUserId: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 검색어 필터 (이름 또는 mallUserId)
    let result = profiles.map((p) => {
      const u = userMap.get(p.userId);
      return {
        id: p.id,
        type: p.type,
        status: p.status,
        affiliateCode: p.affiliateCode,
        displayName: p.displayName,
        mallUserId: u?.mallUserId ?? null,
        name: u?.name ?? null,
        contactPhone: p.contactPhone,
        contactEmail: p.contactEmail,
        contractStatus: p.contractStatus,
        withholdingRate: p.withholdingRate,
        createdAt: p.createdAt,
      };
    });

    if (q) {
      const lower = q.toLowerCase();
      result = result.filter(
        (r) =>
          r.name?.toLowerCase().includes(lower) ||
          r.mallUserId?.toLowerCase().includes(lower) ||
          r.displayName?.toLowerCase().includes(lower)
      );
    }

    return NextResponse.json({ ok: true, profiles: result, total, page, limit });
  } catch (err) {
    logger.error("affiliate-issuance GET 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * POST /api/affiliate-issuance
 * GLOBAL_ADMIN 전용 — 어필리에이트 발급
 *
 * 1. GmUser 생성 (phone=mallUserId=prefix+채번, password=bcrypt)
 * 2. GmAffiliateProfile 생성
 * 3. GmAffiliateRelation 생성 (SALES_AGENT/PRE_SALES 이고 managerProfileId 있을 때)
 * 4. PasswordEvent 기록
 * 5. Prisma 트랜잭션으로 1~4 묶기
 * 6. provision API 호출 (실패해도 발급 성공 처리)
 */
export async function POST(req: Request) {
  try {
    // ── 인증/권한 ──────────────────────────────────────────────────
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    // ── IP / UserAgent 자동 캡처 ───────────────────────────────────
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // ── 입력값 파싱 ────────────────────────────────────────────────
    const body: IssueAffiliateInput = await req.json();
    const {
      type,
      name,
      displayName,
      nickname,
      contactPhone,
      contactEmail,
      bankName,
      bankAccount,
      bankAccountHolder,
      withholdingRate = 3.3,
      agentCommissionRate,
      guarantorName,
      guarantorId,
      managerProfileId,
      contractSignedAt,
      contractSignature,
      contractVersion,
      landingSlug,
      initialPassword = "1101",
    } = body;

    if (!type || !name) {
      return NextResponse.json({ ok: false, error: "type과 name은 필수입니다." }, { status: 400 });
    }

    // ── mallUserId 채번 (최대 5회 재시도) ────────────────────────
    let mallUserId = "";
    let attempts = 0;
    while (attempts < 5) {
      const candidate = await generateMallUserId(type);
      const taken = await isMallUserIdTaken(candidate);
      if (!taken) {
        mallUserId = candidate;
        break;
      }
      attempts++;
    }
    if (!mallUserId) {
      logger.error("affiliate-issuance: mallUserId 채번 실패 (5회 초과)");
      return NextResponse.json({ ok: false, error: "mallUserId 채번 실패" }, { status: 500 });
    }

    // ── affiliateCode 생성 ────────────────────────────────────────
    const baseCode = buildAffiliateCode(name, mallUserId);
    const affiliateCode = await ensureUniqueAffiliateCode(baseCode);

    // ── 비밀번호 해시 ─────────────────────────────────────────────
    const hashedPassword = await hashAffiliatePassword(initialPassword);

    // ── SALES_AGENT/PRE_SALES 여부 (관계 생성 조건) ───────────────
    const needsRelation =
      (type === "SALES_AGENT" || type === "PRE_SALES") &&
      typeof managerProfileId === "number";

    // ── 트랜잭션: User + Profile + Relation + PasswordEvent ───────
    let result: IssueAffiliateResult | undefined;

    await prisma.$transaction(async (tx) => {
      // 1. GmUser 생성
      const user = await tx.gmUser.create({
        data: {
          name,
          phone: mallUserId,
          mallUserId,
          password: hashedPassword,
          mallNickname: displayName ?? name,
          role: "community",
          customerSource: "crm-contract",
          isPasswordSet: true,
        },
      });

      // 2. GmAffiliateProfile 생성
      const profile = await tx.gmAffiliateProfile.create({
        data: {
          userId: user.id,
          affiliateCode,
          type,
          status: "ACTIVE",
          contractStatus: "SIGNED",
          displayName: displayName ?? null,
          nickname: nickname ?? null,
          contactPhone: contactPhone ?? null,
          contactEmail: contactEmail ?? null,
          bankName: bankName ?? null,
          bankAccount: bankAccount ?? null,
          bankAccountHolder: bankAccountHolder ?? null,
          withholdingRate,
          agentCommissionRate: agentCommissionRate ?? null,
          guarantorName: guarantorName ?? null,
          guarantorId: guarantorId ?? null,
          landingSlug: landingSlug?.trim() || null,
          contractSignedAt: contractSignedAt ? new Date(contractSignedAt) : null,
          contractSignature: contractSignature ?? null,
          contractIp: contractSignedAt ? ip : null,
          contractVersion: contractVersion ?? null,
          contractUserAgent: contractSignedAt ? userAgent : null,
          metadata: { source: "CRM" },
          published: true,
        },
      });

      // 3. GmAffiliateRelation 생성 (조건부)
      let relationId: number | undefined;
      if (needsRelation && managerProfileId) {
        const relation = await tx.gmAffiliateRelation.create({
          data: {
            managerId: managerProfileId,
            agentId: profile.id,
            status: "ACTIVE",
            connectedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        relationId = relation.id;
      }

      // 4. PasswordEvent 기록
      await tx.passwordEvent.create({
        data: {
          userId: user.id,
          from: "",
          to: hashedPassword,
          reason: "affiliate_issuance",
        },
      });

      result = {
        userId: user.id,
        mallUserId,
        profileId: profile.id,
        affiliateCode,
        relationId,
      };
    });

    // ── 트랜잭션 결과 guard ───────────────────────────────────────
    if (!result) {
      return NextResponse.json({ ok: false, error: "발급 실패" }, { status: 500 });
    }

    // ── provision API 호출 (부수효과, 실패 허용) ──────────────────
    const provisionUrl = process.env.INTERNAL_PROVISION_URL;
    const provisionSecret = process.env.INTERNAL_PROVISION_SECRET;

    if (provisionUrl && provisionSecret) {
      try {
        const provisionRes = await fetch(
          `${provisionUrl}/api/internal/affiliate/provision`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provisionSecret}`,
            },
            body: JSON.stringify({
              userId: result.userId,
              type,
              managerProfileId: needsRelation ? managerProfileId : undefined,
            }),
          }
        );
        if (!provisionRes.ok) {
          logger.warn(
            `affiliate-issuance: provision API 응답 오류 status=${provisionRes.status} userId=${result.userId}`
          );
        }
      } catch (provErr) {
        logger.error(
          `affiliate-issuance: provision API 호출 실패 userId=${result.userId}`,
          provErr
        );
      }
    } else {
      logger.warn("affiliate-issuance: INTERNAL_PROVISION_URL 또는 INTERNAL_PROVISION_SECRET 미설정 — provision 스킵");
    }

    // ── 성공 응답 ─────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      mallUserId: result.mallUserId,
      profileId: result.profileId,
      affiliateCode: result.affiliateCode,
      userId: result.userId,
      relationId: result.relationId,
    });
  } catch (err) {
    logger.error("affiliate-issuance POST 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
