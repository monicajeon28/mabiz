import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/response";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere, maskContactInfo } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { detectSegment } from "@/lib/segment-detector";
import { detectLenses, sortLensesByPriority } from "@/lib/lens-detector";
import { recommendProducts } from "@/lib/product-recommender";
import { sendSms, resolveUserSmsConfig } from "@/lib/aligo";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_CONFIG, createRateLimitHeaders } from "@/lib/rate-limit-config";

// 고객 타입 정규화: PURCHASED (구매완료) | INQUIRY (문의) | GOLD (금회원)
function normalizeCustomerType(type: string | undefined): 'PURCHASED' | 'INQUIRY' | 'GOLD' | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  // PURCHASED: "CUSTOMER", "구매완료", "PURCHASED" 모두 동일
  if (lower === 'customer' || type === '구매완료' || lower === 'purchased') return 'PURCHASED';
  // INQUIRY: "LEAD", "INQUIRY" 동일
  if (lower === 'lead' || lower === 'inquiry') return 'INQUIRY';
  // GOLD: 금회원
  if (lower === 'gold') return 'GOLD';
  return undefined;
}

// GET /api/contacts — 고객 목록 (역할 기반 + P0-6 출처 기반 + Team-B 탭 카테고리)
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);

    const rawType  = searchParams.get("type");
    const customerOnly = searchParams.get("customerOnly") === "true";
    // customerOnly=true: "CUSTOMER"(영문) + "구매완료"(한글) 모두 포함
    const type = customerOnly ? undefined : rawType;
    const channel = searchParams.get("channel"); // b2c, b2b, direct
    const sourceType = searchParams.get("sourceType"); // P0-6: user, inquiry, affiliate, landing_page, education, gold_member
    const visibility = searchParams.get("visibility"); // Team-B: SHARED | ADMIN_ONLY
    const q       = searchParams.get("q");
    const groupId = searchParams.get("groupId");
    const tagParam = searchParams.get("tags");                      // 쉼표 구분 태그 필터
    const tags    = tagParam ? tagParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const assignedTo = searchParams.get("assignedTo");             // 담당자 필터 (userId 또는 "unassigned")
    const sortBy  = searchParams.get("sortBy");                     // 정렬: purchasedAt_desc | purchasedAt_asc
    const cursor  = searchParams.get("cursor");                     // cursor 기반 페이지네이션
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page    = Number.isNaN(rawPage) ? 1 : Math.min(Math.max(1, rawPage), 10000);
    const safeLimit = Math.min(Number(searchParams.get("limit")) || 30, 200); // limit 상한 강제 (200건)

    // visibility 필터: SHARED 탭과 ADMIN_ONLY 탭 분리
    let baseWhere: Prisma.ContactWhereInput;

    if (visibility === 'ADMIN_ONLY') {
      // 관리자전용 탭: GLOBAL_ADMIN만 접근, visibility='ADMIN_ONLY' Contact만
      if (ctx.role !== 'GLOBAL_ADMIN') {
        return NextResponse.json({ ok: true, contacts: [], total: 0, page, limit: safeLimit });
      }
      baseWhere = { visibility: 'ADMIN_ONLY' as const, deletedAt: null };
    } else if (visibility === 'SHARED') {
      // 공유 탭: visibility='SHARED' + 역할별 필터 + sharedWith 조인
      if (ctx.role === 'GLOBAL_ADMIN') {
        // GLOBAL_ADMIN: 공유된 Contact 전체 조회
        baseWhere = {
          visibility: 'SHARED' as const,
          deletedAt: null,
        };
      } else if (ctx.role === 'OWNER') {
        // OWNER(대리점장): 자신의 고객 + 공유받음 Contact
        baseWhere = {
          visibility: 'SHARED' as const,
          organizationId: ctx.organizationId!,
          OR: [
            { assignedUserId: ctx.userId }, // 자신의 고객
            { createdBy: ctx.userId }, // 작성한 고객
            { sharedWith: { some: { sharedTo: ctx.userId } } }, // 공유받은 Contact
          ],
          deletedAt: null,
        };
      } else {
        // AGENT/SALES_AGENT: 자신 작성/할당 + 공유받음 Contact
        baseWhere = {
          visibility: 'SHARED' as const,
          organizationId: ctx.organizationId!,
          OR: [
            { assignedUserId: ctx.userId },
            { createdBy: ctx.userId },
            { sharedWith: { some: { sharedTo: ctx.userId } } },
          ],
          deletedAt: null,
        };
      }
    } else {
      // 기본 필터 (모든 탭): buildContactWhere 사용
      baseWhere = buildContactWhere(ctx, {});
    }

    // 추가 필터: customerOnly, type, channel 등
    const additionalWhere = {
      ...(customerOnly
        ? {
            type: { in: ["CUSTOMER", "구매완료", "PURCHASED"] },
            purchasedAt: { not: null }
          }
        : type
          ? (() => {
              const normalized = normalizeCustomerType(type);
              if (normalized === 'PURCHASED') {
                // 구매완료: type이 CUSTOMER/구매완료/PURCHASED이고 purchasedAt NOT NULL
                return {
                  type: { in: ["CUSTOMER", "구매완료", "PURCHASED"] },
                  purchasedAt: { not: null }
                };
              } else if (normalized === 'INQUIRY') {
                // 문의: type이 LEAD/INQUIRY/잠재고객 (엑셀 가져오기는 LEAD, UI 입력은 잠재고객)
                return { type: { in: ["LEAD", "INQUIRY", "잠재고객"] } };
              } else if (normalized === 'GOLD') {
                // 금회원: type이 GOLD 또는 vipStatus가 GOLD
                return {
                  OR: [
                    { type: 'GOLD' },
                    { vipStatus: 'GOLD' }
                  ]
                };
              }
              return { type };
            })()
          : {}),
      ...(channel ? { channel } : {}),
      ...(sourceType ? { sourceType } : {}), // P0-6: 출처 필터링
      ...(q
        ? { OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ]}
        : {}),
      ...(groupId ? { groups: { some: { groupId } } } : {}),
      // 태그 필터: AND 조건 (모든 태그를 포함한 고객)
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
      ...(assignedTo === "unassigned" ? { assignedUserId: null }
        : assignedTo ? { assignedUserId: assignedTo }
        : {}),
    };

    // 최종 where 조합: baseWhere + additionalWhere를 AND로 병합
    const finalWhere: Prisma.ContactWhereInput = {
      AND: [baseWhere, additionalWhere],
    };

    // cursor 기반 페이지네이션 또는 offset 기반 페이지네이션
    let where: Prisma.ContactWhereInput = finalWhere;
    let skip = 0;
    let take = safeLimit + 1;  // hasMore 판단용 +1

    if (cursor) {
      // id: { gt: cursor } 는 cursor 자체를 이미 제외하므로 skip = 0
      where = { ...finalWhere, id: { gt: cursor } };
    } else {
      take = safeLimit;  // offset 방식일 때는 +1 안 함
      skip = (page - 1) * safeLimit;
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: cursor ? where : finalWhere,
        orderBy: sortBy === "purchasedAt_desc" ? { purchasedAt: "desc" as const }
               : sortBy === "purchasedAt_asc"  ? { purchasedAt: "asc"  as const }
               : { id: "asc" as const },
        skip: skip,
        take: cursor ? take : safeLimit,
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          type: true,
          cruiseInterest: true,
          leadScore: true,
          tags: true,
          lastContactedAt: true,
          purchasedAt: true,
          departureDate: true,
          createdAt: true,
          sourceType: true,
          sourceId: true,
          signupMethod: true,
          affiliateLinkId: true,
          affiliateManagerId: true,
          affiliateAgentId: true,
          inquiryProductCode: true,
          surveyData: true,
          visibility: true,
          groups: { select: { id: true, groupId: true, addedAt: true, group: { select: { id: true, name: true, color: true } } } },
          sharedWith: {
            where: { sharedTo: ctx.userId },
            select: {
              sharedBy: true,
              createdAt: true,
            },
            take: 1,
          },
          _count: { select: { callLogs: true } },
        },
      }),
      prisma.contact.count({ where: finalWhere }),
    ]);

    // cursor 기반일 때 +1 제거
    let returnedContacts = contacts;
    let nextCursor: string | null = null;
    let hasMore = false;

    if (cursor) {
      if (contacts.length > safeLimit) {
        hasMore = true;
        nextCursor = contacts[safeLimit]?.id || null;
        returnedContacts = contacts.slice(0, safeLimit);
      }
    }

    // AGENT 역할이면 개인정보 마스킹
    const masked = returnedContacts.map((c) => maskContactInfo(c, ctx));

    // ── 전달 이력 배치 조회 (N+1 없이) ──────────────────────────
    const contactIds = returnedContacts.map((c) => c.id);
    const rawLogs = contactIds.length > 0
      ? await prisma.contactTransferLog.findMany({
          where:   { contactId: { in: contactIds } },
          orderBy: [{ contactId: 'asc' }, { createdAt: "desc" }],
          take: contactIds.length,
          select:  { id: true, contactId: true, toUserId: true, transferType: true, newContactId: true, transferredBy: true },
        })
      : [];

    // contactId → 최신 로그 1건
    const latestLog = new Map<string, typeof rawLogs[0]>();
    for (const l of rawLogs) if (!latestLog.has(l.contactId)) latestLog.set(l.contactId, l);

    // toUserId 배치 이름 조회
    const toUserIds = [...new Set([...latestLog.values()].map((l) => l.toUserId).filter((x): x is string => !!x))];
    const [orgMembers, globalAdmins] = toUserIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.organizationMember.findMany({
            where:  { id: { in: toUserIds } },
            select: { id: true, displayName: true, organization: { select: { name: true } } },
          }),
          prisma.globalAdmin.findMany({
            where:  { id: { in: toUserIds } },
            select: { id: true, displayName: true },
          }),
        ]);

    const nameMap = new Map<string, { name: string; orgName: string }>();
    orgMembers.forEach((m) => nameMap.set(m.id, { name: m.displayName ?? m.id, orgName: m.organization.name }));
    globalAdmins.forEach((a) => nameMap.set(a.id, { name: a.displayName ?? "본사", orgName: "본사" }));

    // ── 제휴 담당자 정보 배치 조회 (본사/판매원) ──────────────────────────
    const affiliateManagerIds = [...new Set(masked.map((c) => c.affiliateManagerId).filter((x): x is string => !!x))];
    const affiliateAgentIds = [...new Set(masked.map((c) => c.affiliateAgentId).filter((x): x is string => !!x))];
    const allAffiliateUserIds = [...new Set([...affiliateManagerIds, ...affiliateAgentIds])] as string[];

    const affiliateMembers = allAffiliateUserIds.length > 0
      ? await prisma.organizationMember.findMany({
          where: { id: { in: allAffiliateUserIds }, isActive: true },
          select: { id: true, displayName: true },
        })
      : [];

    const affiliateNameMap = new Map<string, string>();
    affiliateMembers.forEach((m) => affiliateNameMap.set(m.id, m.displayName ?? m.id));

    // ── 공유 정보 배치 조회 (공유한 사용자 이름) ──────────────────────────
    const sharedByIds = [...new Set(
      masked
        .flatMap((c) => (c.sharedWith ?? []).map((s) => s.sharedBy))
        .filter((x): x is string => !!x)
    )];

    const sharedByMembers = sharedByIds.length > 0
      ? await prisma.organizationMember.findMany({
          where: { id: { in: sharedByIds }, isActive: true },
          select: { id: true, displayName: true },
        })
      : [];

    const sharedByNameMap = new Map<string, string>();
    sharedByMembers.forEach((m) => sharedByNameMap.set(m.id, m.displayName ?? m.id));

    const contactsWithTransfer = masked.map((c) => {
      const log = latestLog.get(c.id);
      const transferInfo = !log ? null : log.toUserId ? nameMap.get(log.toUserId) : null;
      const sharedInfo = (c.sharedWith ?? [])[0];
      const sharedByName = sharedInfo ? sharedByNameMap.get(sharedInfo.sharedBy) : undefined;

      return {
        ...c,
        lastTransferredTo: transferInfo
          ? { name: transferInfo.name, orgName: transferInfo.orgName, logId: log!.id, transferType: log!.transferType, canRecall: log!.transferredBy === ctx.userId || ctx.role === "GLOBAL_ADMIN" }
          : null,
        // P0-6/7: 제휴 담당자 실제 이름
        affiliateManagerName: c.affiliateManagerId ? affiliateNameMap.get(c.affiliateManagerId) : undefined,
        affiliateAgentName: c.affiliateAgentId ? affiliateNameMap.get(c.affiliateAgentId) : undefined,
        // Team-A: 공유 출처
        sharedByName,
      };
    });

    // 관리자전용 탭: 출처별 통계 (limit=1일 때 = 통계 요청)
    let sourceStats = null;
    if (visibility === 'ADMIN_ONLY' && safeLimit === 1) {
      const allAdminContacts = await prisma.contact.findMany({
        where: { visibility: 'ADMIN_ONLY' as const, deletedAt: null },
        select: { sourceType: true },
      });
      sourceStats = {
        b2c: allAdminContacts.filter((c) => c.sourceType === 'user').length,
        b2b: allAdminContacts.filter((c) => c.sourceType === 'inquiry').length,
        admin: allAdminContacts.filter((c) => !c.sourceType || c.sourceType === 'UNKNOWN').length,
      };
    }

    // cursor 기반이면 cursor 응답, 아니면 offset 응답
    if (cursor) {
      return NextResponse.json({ ok: true, data: contactsWithTransfer, nextCursor, hasMore, limit: safeLimit, sourceStats });
    }

    return NextResponse.json({ ok: true, contacts: contactsWithTransfer, total, page, limit: safeLimit, sourceStats });
  } catch (err) {
    logger.error("[GET /api/contacts]", { err });
    return handleApiError(err);
  }
}

// POST /api/contacts — 고객 생성 (OWNER / GLOBAL_ADMIN만)
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // P0 Security Fix: Rate limiting (user-based + IP-based)
    const identifier = `contacts:${ctx.userId}`;
    const config = RATE_LIMIT_CONFIG.contacts;
    const rateLimitResult = await checkRateLimitAsync(identifier, config.perUser, config.perUserWindow * 1000);

    if (!rateLimitResult.allowed) {
      const headers = createRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers }
      );
    }

    // GLOBAL_ADMIN은 organizationId가 null — 첫 번째 조직 사용
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: '조직이 없습니다.' }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false, error: '조직 정보가 없습니다.' }, { status: 403 });
    }

    const body  = await req.json();
    const { name, phone, email, type, cruiseInterest, budgetRange, adminMemo, groupIds, assignedUserId, age, maritalStatus, childrenCount } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, message: "이름과 전화번호는 필수입니다." },
        { status: 400 }
      );
    }
    if (typeof name === 'string' && name.length > 100) {
      return NextResponse.json({ ok: false, message: "이름은 100자 이하여야 합니다." }, { status: 400 });
    }
    if (typeof phone === 'string' && phone.length > 20) {
      return NextResponse.json({ ok: false, message: "전화번호는 20자 이하여야 합니다." }, { status: 400 });
    }

    // 세그먼트 자동 감지
    const segment = detectSegment({ age, maritalStatus, childrenCount });

    // 상품 추천
    const recommendations = recommendProducts(segment);
    const recommendedProduct = body.recommendedProduct ?? (recommendations.length > 0 ? recommendations[0].productCode : null);

    const contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        name,
        phone,
        email:          email          ?? null,
        type:           type           ?? "LEAD",
        cruiseInterest: cruiseInterest ?? null,
        budgetRange:    budgetRange    ?? null,
        adminMemo:      adminMemo      ?? null,
        assignedUserId: assignedUserId ?? null,
        age:            age            ?? null,
        maritalStatus:  maritalStatus  ?? null,
        childrenCount:  childrenCount  ?? 0,
        segment,
        recommendedProduct,
        ...(groupIds?.length
          ? { groups: { create: (groupIds as string[]).map((gid) => ({ groupId: gid })) } }
          : {}),
      },
    });

    logger.log("[POST /api/contacts] 고객 생성", { id: contact.id, segment });

    // Phase 4A: 렌즈 감지 (L0-L10 자동 분류)
    const detectedLenses = detectLenses({
      ...contact,
      callLogs: [],
      memos: [],
    } as Parameters<typeof detectLenses>[0]);
    const sortedLenses = sortLensesByPriority(detectedLenses);

    if (sortedLenses.length > 0) {
      const newTags = [...(contact.tags || []), ...sortedLenses];
      await prisma.contact.update({
        where: { id: contact.id },
        data: { tags: newTags },
      });
      logger.log("[POST /api/contacts] 렌즈 감지 완료", { id: contact.id, lenses: sortedLenses });
    }

    // C-1: 세그먼트별 SMS 템플릿 조회 및 발송 + 퍼널 상태 + 그룹 퍼널 (await로 완료 보장)
    await Promise.allSettled([
      // SMS 자동 발송
      (async () => {
        try {
          const template = await prisma.smsTemplate.findFirst({
            where: {
              segmentCode: segment,
              category: 'AUTO_RECOMMEND',
              isSystem: true,
            },
            orderBy: { createdAt: 'desc' as const },
          });

          if (template && contact.phone) {
            try {
              const message = template.content
                .replace('[이름]', contact.name || '고객')
                .replace('[링크]', process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.mabiz.dev');

              const smsConfig = await resolveUserSmsConfig(orgId, ctx.userId);
              if (!smsConfig) {
                logger.warn('[POST /api/contacts] SMS 설정 미완료 — 자동 발송 불가', { contactId: contact.id });
                return;
              }

              const result = await sendSms({
                config: smsConfig,
                receiver: contact.phone,
                msg: message,
                msgType: message.length > 90 ? 'LMS' : 'SMS',
                organizationId: orgId,
                contactId: contact.id,
                channel: 'GROUP',
              });

              logger.log('[POST /api/contacts] 세그먼트별 자동 SMS 발송', {
                contactId: contact.id,
                segment,
                status: Number(result.result_code) === 1 ? 'success' : 'failed',
                resultCode: result.result_code,
              });
            } catch (smsErr) {
              logger.error('[POST /api/contacts] SMS 발송 실패', {
                contactId: contact.id,
                segment,
                error: smsErr instanceof Error ? smsErr.message : String(smsErr),
              });
            }
          } else if (!template) {
            logger.log('[POST /api/contacts] 세그먼트 SMS 템플릿 없음 — 발송 스킵', { segment });
          }
        } catch (err) {
          logger.error('[POST /api/contacts] 자동 SMS 처리 중 오류', {
            contactId: contact.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })(),

      // 퍼널 상태 자동 생성
      prisma.contactFunnelState.upsert({
        where: {
          contactId: contact.id,
        },
        update: {},
        create: {
          organizationId: orgId,
          contactId: contact.id,
          status: 'PENDING',
        },
      }).catch((err) => {
        logger.error('[POST /api/contacts] 퍼널 상태 생성 실패', { err, contactId: contact.id });
      }),

      // 그룹 배정 시 퍼널 자동 시작
      ...(groupIds?.length && contact.id
        ? (groupIds as string[]).map((gid) =>
            triggerGroupFunnel({
              contactId: contact.id,
              groupId: gid,
              organizationId: orgId,
            }).catch((err) =>
              logger.error('[triggerGroupFunnel failed]', { err, contactId: contact.id, groupId: gid })
            )
          )
        : []),
    ]);

    return NextResponse.json({ ok: true, contact }, { status: 201 });
  } catch (err: unknown) {
    // P0-3 Security Fix: Duplicate phone UNIQUE constraint (enhanced error message)
    if ((err as { code?: string }).code === "P2002") {
      const message = (err as any)?.meta?.target?.includes("phone")
        ? "이미 등록된 전화번호입니다."
        : "중복된 정보입니다.";
      return NextResponse.json(
        { ok: false, error: message, code: "DUPLICATE_CONTACT" },
        { status: 409 }
      );
    }
    logger.error("[POST /api/contacts]", { err });
    return handleApiError(err);
  }
}
