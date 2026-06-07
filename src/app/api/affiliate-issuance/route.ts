import "server-only";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

    const where: Record<string, unknown> = {
      ...(typeFilter ? { type: typeFilter } : {}),
      status: statusFilter,
    };

    // q 검색: DB 레벨 필터링 (메모리 필터 제거)
    if (q) {
      // 1단계: GmUser 테이블에서 name/mallUserId ILIKE 검색
      const matchedUsers = await prisma.gmUser.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { mallUserId: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      const matchedUserIds = matchedUsers.map((u) => u.id);

      // 2단계: OR [ displayName contains q | userId in matchedUserIds ]
      // matchedUserIds가 비어있어도 displayName 조건만으로 검색 가능
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        ...(matchedUserIds.length > 0
          ? [{ userId: { in: matchedUserIds } }]
          : []),
      ];
    }

    // 전체 개수와 페이지 데이터 병렬 조회 (동일한 확장 where 조건 사용)
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

    // userId 목록으로 GmUser 일괄 조회 (표시용)
    const userIds = profiles.map((p) => p.userId);
    const users = await prisma.gmUser.findMany({
      where: { id: { in: userIds } },
      select: { id: true, mallUserId: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 메모리 필터 제거 — 모든 필터링은 DB에서 완료됨
    const result = profiles.map((p) => {
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
          externalId: randomUUID(),   // CRM 발급 멱등키 — 크루즈닷 upsert API가 이 값으로 upsert
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
        externalId: user.externalId as string,
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

    // ── 크루즈닷몰 upsert 호출 (부수효과, 실패 허용) ────────────
    // 스펙: POST /api/integration/affiliate/upsert (cruisedot 제공)
    const provisionUrl = process.env.INTERNAL_PROVISION_URL;   // https://www.cruisedot.co.kr
    const provisionSecret = process.env.INTERNAL_PROVISION_SECRET;

    if (provisionUrl && provisionSecret) {
      try {
        // 소속 대리점장의 externalId 조회 (크루즈닷 upsert API 멱등키)
        let managerExternalId: string | undefined;
        if (needsRelation && managerProfileId) {
          const managerProfile = await prisma.gmAffiliateProfile.findUnique({
            where: { id: managerProfileId },
            select: { userId: true },
          });
          if (managerProfile) {
            const managerUser = await prisma.gmUser.findUnique({
              where: { id: managerProfile.userId },
              select: { id: true, externalId: true },
            });
            // externalId 있으면 사용, 없으면 Int id를 문자열로 (구버전 호환)
            managerExternalId = managerUser?.externalId ?? (managerUser ? String(managerUser.id) : undefined);
          }
        }

        const upsertBody = {
          externalId:          result.externalId,
          mallUserId:          result.mallUserId,
          password:            initialPassword,          // 크루즈닷이 bcrypt 해시
          name,
          phone:               contactPhone ?? undefined,
          role:                type,
          affiliateCode:       result.affiliateCode,
          managerExternalId,
          bankName:            bankName ?? undefined,
          bankAccount:         bankAccount ?? undefined,
          bankAccountHolder:   bankAccountHolder ?? undefined,
          withholdingRate,
          status:              "ACTIVE",
        };

        const upsertRes = await fetch(
          `${provisionUrl}/api/integration/affiliate/upsert`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provisionSecret}`,
            },
            body: JSON.stringify(upsertBody),
          }
        );
        if (!upsertRes.ok) {
          logger.warn(
            `affiliate-issuance: upsert API 응답 오류 status=${upsertRes.status} userId=${result.userId}`
          );
        } else {
          const upsertData = await upsertRes.json().catch(() => ({}));
          logger.log(
            `affiliate-issuance: upsert 완료 mallUserId=${result.mallUserId}`,
            { shopUrl: upsertData?.shopUrl }
          );
        }
      } catch (provErr) {
        logger.error(
          `affiliate-issuance: upsert API 호출 실패 userId=${result.userId}`,
          provErr
        );
      }
    } else {
      logger.warn("affiliate-issuance: INTERNAL_PROVISION_URL 또는 INTERNAL_PROVISION_SECRET 미설정 — upsert 스킵");
    }

    // ── 성공 응답 ─────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      mallUserId: result.mallUserId,
      profileId: String(result.profileId),
      affiliateCode: result.affiliateCode,
      displayName: displayName ?? name ?? "",
      userId: result.userId,
      relationId: result.relationId,
    });
  } catch (err) {
    logger.error("affiliate-issuance POST 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
