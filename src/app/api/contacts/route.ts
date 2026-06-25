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
import { isStaffPhone } from "@/lib/contact-guard";

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

    // T-013: GET rate limiting — 고객 목록 스크래핑 방지 (분당 60회)
    const rlGet = await checkRateLimitAsync(
      `contacts:get:${ctx.userId}`,
      RATE_LIMIT_CONFIG.contacts.perUserGet,
      60_000
    );
    if (!rlGet.allowed) {
      return NextResponse.json(
        { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const rawType  = searchParams.get("type");
    const customerOnly = searchParams.get("customerOnly") === "true";

    // P0-6: 구매관리 권한 검사
    // customerOnly=true (구매 고객 탭) 또는 type=CUSTOMER일 때: FREE_SALES 제외
    const isPurchaseQuery = customerOnly ||
                           (rawType && (rawType.toLowerCase() === 'customer' || rawType === '구매완료'));

    if (isPurchaseQuery && ctx.role === 'FREE_SALES') {
      // NOTE: API layer에서 FREE_SALES early return({ ok: true, contacts: [] })으로
      // buildContactWhere의 FREE_SALES_NO_ACCESS throw는 실제 도달하지 않는 dead path.
      // 이중 방어 패턴이므로 안전하지만 rbac.ts FREE_SALES 경로는 문서화 목적으로 유지.
      return NextResponse.json({ ok: true, contacts: [], total: 0, page: 1, limit: 20 });
    }

    // customerOnly=true: "CUSTOMER"(영문) + "구매완료"(한글) 모두 포함
    const type = customerOnly ? undefined : rawType;
    const visibility = searchParams.get("visibility"); // Team-B: SHARED | ADMIN_ONLY
    const rawQ = searchParams.get("q") ?? '';
    const q = rawQ.slice(0, 200) || null;

    // T-030: sourceType/channel enum 허용 목록 검증, assignedTo UUID 형식 검증
    const ALLOWED_SOURCE_TYPES = ['user', 'inquiry', 'affiliate', 'landing_page', 'education', 'gold_member', 'UNKNOWN'];
    const ALLOWED_CHANNELS = ['b2c', 'b2b', 'direct', 'landing', 'education'];
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // T-007: groupId UUID 형식 검증 (미검증 시 DB에 임의 문자열 전달 → DoS 가능)
    const groupId = (() => {
      const v = searchParams.get('groupId');
      return v && UUID_REGEX.test(v) ? v : undefined;
    })();
    // T-007: tags 개수(10개) + 각 길이(50자) 제한 (무제한 입력 시 DoS 가능)
    const tagParam = searchParams.get("tags");
    const tags = tagParam
      ? tagParam
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10)
          .map((t) => t.slice(0, 50))
      : [];

    const sourceType = (() => {
      const v = searchParams.get("sourceType");
      return v && ALLOWED_SOURCE_TYPES.includes(v) ? v : undefined;
    })();

    const channel = (() => {
      const v = searchParams.get("channel");
      return v && ALLOWED_CHANNELS.includes(v) ? v : undefined;
    })();

    const assignedTo = (() => {
      const v = searchParams.get("assignedTo");
      if (v === 'unassigned') return 'unassigned';
      if (v && UUID_REGEX.test(v)) return v;
      return undefined; // 잘못된 형식이면 무시
    })();
    const ALLOWED_SORT_VALUES = ['purchasedAt_desc', 'purchasedAt_asc'] as const;
    const rawSortBy = searchParams.get("sortBy");
    const sortBy = (rawSortBy && (ALLOWED_SORT_VALUES as readonly string[]).includes(rawSortBy))
      ? rawSortBy : undefined; // 정렬: purchasedAt_desc | purchasedAt_asc (허용 목록 외 값 무시)
    // T-007: cursor UUID 형식 검증 (임의 문자열 DB 전달 방지)
    const cursor = (() => {
      const v = searchParams.get('cursor');
      return v && UUID_REGEX.test(v) ? v : undefined;
    })();
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page    = Number.isNaN(rawPage) ? 1 : Math.min(Math.max(1, rawPage), 10000);
    const rawLimit = parseInt(searchParams.get("limit") ?? "30", 10);
    const safeLimit = Number.isNaN(rawLimit) ? 30 : Math.min(Math.max(1, rawLimit), 200); // limit 상한 강제 (200건)

    // T-015: OWNER/AGENT는 organizationId 필수 — 세션 손상 시 전체 레코드 반환 방지
    if ((ctx.role === 'OWNER' || ctx.role === 'AGENT') && !ctx.organizationId) {
      logger.error('[GET /api/contacts] OWNER/AGENT organizationId 없음', { userId: ctx.userId, role: ctx.role });
      return NextResponse.json(
        { ok: false, error: '조직 정보가 없습니다.' },
        { status: 403 }
      );
    }

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
        // OWNER(지사장): teamView=true면 팀 전체 고객, 아니면 자신의 고객 + 공유받음
        const teamView = searchParams.get('teamView') === 'true';
        if (teamView) {
          // 우리 팀 고객: 같은 조직의 모든 공유 고객
          baseWhere = {
            visibility: 'SHARED' as const,
            organizationId: ctx.organizationId!,
            deletedAt: null,
          };
        } else {
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
        }
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
          createdBy: true,        // maskContactInfo isOwned 판단용
          assignedUserId: true,   // maskContactInfo isOwned 판단용
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
    // T-015: DISTINCT ON으로 contactId당 최신 1건 보장 (findMany+take 조합 누락 방지)
    const contactIds = returnedContacts.map((c) => c.id);
    type RawLog = { id: string; contactId: string; toUserId: string | null; transferType: string; newContactId: string | null; transferredBy: string | null };
    const rawLogs: RawLog[] = contactIds.length > 0
      ? await prisma.$queryRaw<RawLog[]>`
          SELECT DISTINCT ON ("contactId") id, "contactId", "toUserId", "transferType", "newContactId", "transferredBy"
          FROM "ContactTransferLog"
          WHERE "contactId" = ANY(${contactIds})
          ORDER BY "contactId", "createdAt" DESC
        `
      : [];

    // contactId → 최신 로그 1건 (DISTINCT ON이 이미 보장)
    const latestLog = new Map<string, RawLog>();
    for (const l of rawLogs) latestLog.set(l.contactId, l);

    // toUserId 배치 이름 조회
    // NOTE: 전달 이력(ContactTransferLog)의 경우 비활성 멤버도 이름을 표시하는 것이 비즈니스상 올바름.
    // (누가 누구에게 전달했는지 이력 추적 목적 — isActive 필터 의도적 미적용)
    // affiliateMembers/sharedByMembers는 현재 활성 상태만 조회하므로 정책 불일치가 있음을 인지.
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

    // ── 제휴 담당자 정보 배치 조회 (본사/대리점장) ──────────────────────────
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

    // 관리자전용 탭: 출처별 통계 (includeStats=true 일 때만 집계 쿼리 실행)
    const includeStats = searchParams.get('includeStats') === 'true';
    let sourceStats = null;
    if (visibility === 'ADMIN_ONLY' && includeStats) {
      const orgFilter = ctx.organizationId ? { organizationId: ctx.organizationId } : {};
      const [b2cCount, b2bCount, adminCount] = await Promise.all([
        prisma.contact.count({ where: { visibility: 'ADMIN_ONLY' as const, deletedAt: null, sourceType: 'user', ...orgFilter } }),
        prisma.contact.count({ where: { visibility: 'ADMIN_ONLY' as const, deletedAt: null, sourceType: 'inquiry', ...orgFilter } }),
        prisma.contact.count({ where: { visibility: 'ADMIN_ONLY' as const, deletedAt: null, OR: [{ sourceType: null }, { sourceType: 'UNKNOWN' }], ...orgFilter } }),
      ]);
      sourceStats = { b2c: b2cCount, b2b: b2bCount, admin: adminCount };
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

    // GLOBAL_ADMIN은 organizationId가 null — BONSA_ORG_ID 환경변수 우선, 없으면 가장 오래된 조직 사용
    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const bonsaOrgId = process.env.BONSA_ORG_ID;
      const firstOrg = bonsaOrgId
        ? { id: bonsaOrgId }
        : await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: '조직이 없습니다.' }, { status: 503 });
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

    // T-008: type enum 허용 목록 검증 (임의 type 저장 시 역할 기반 필터링 우회 가능)
    const ALLOWED_CONTACT_TYPES = ['LEAD', 'INQUIRY', 'CUSTOMER', '구매완료', 'PURCHASED', 'GOLD', '잠재고객'];
    if (type && !ALLOWED_CONTACT_TYPES.includes(type)) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 고객 유형입니다: ${type}` },
        { status: 400 }
      );
    }
    // T-008: email 형식 검증
    if (email && typeof email === 'string' && email.length > 0) {
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!EMAIL_REGEX.test(email) || email.length > 254) {
        return NextResponse.json(
          { ok: false, message: '이메일 형식이 올바르지 않습니다' },
          { status: 400 }
        );
      }
    }

    // T-031: adminMemo 길이 제한 (2000자)
    if (adminMemo && typeof adminMemo === 'string' && adminMemo.length > 2000) {
      return NextResponse.json({ ok: false, message: '관리자 메모는 2000자 이하여야 합니다.' }, { status: 400 });
    }

    // 직원 번호 차단
    const isStaff = await isStaffPhone(phone, orgId);
    if (isStaff) {
      return NextResponse.json(
        { ok: false, message: '직원 번호는 고객으로 등록할 수 없습니다.' },
        { status: 409 }
      );
    }

    // T-003: assignedUserId 조직 소속 검증 (IDOR 방지)
    let safeAssignedUserId: string | null = assignedUserId ?? null;
    if (safeAssignedUserId) {
      const UUID_REGEX_LOCAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX_LOCAL.test(safeAssignedUserId)) {
        safeAssignedUserId = null;
      } else {
        const memberCheck = await prisma.organizationMember.findFirst({
          where: { id: safeAssignedUserId, organizationId: orgId, isActive: true },
          select: { id: true },
        });
        if (!memberCheck) {
          logger.warn('[POST /api/contacts] assignedUserId 조직 불일치 — null로 대체', { assignedUserId, orgId });
          safeAssignedUserId = null;
        }
      }
    }

    // T-004: groupIds 조직 소속 검증 (IDOR 방지)
    let safeGroupIds: string[] = [];
    if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
      const validGroups = await prisma.contactGroup.findMany({
        where: { id: { in: groupIds as string[] }, organizationId: orgId },
        select: { id: true },
      });
      safeGroupIds = validGroups.map((g: { id: string }) => g.id);
      if (safeGroupIds.length !== (groupIds as string[]).length) {
        logger.warn('[POST /api/contacts] 일부 groupId 조직 불일치 — 필터링됨', { requested: groupIds, allowed: safeGroupIds });
      }
    }

    // 세그먼트 자동 감지
    const segment = detectSegment({ age, maritalStatus, childrenCount });

    // 상품 추천
    const recommendations = recommendProducts(segment);
    const recommendedProduct = body.recommendedProduct ?? (recommendations.length > 0 ? recommendations[0].productCode : null);

    // T-025: contact.create + 렌즈 태그 update를 $transaction으로 원자화
    // (create 성공 후 update 실패 시 렌즈 없이 Contact 저장되는 문제 방지)
    const contact = await prisma.$transaction(async (tx) => {
      const newContact = await tx.contact.create({
        data: {
          organizationId: orgId,
          name,
          phone,
          email:          email          ?? null,
          type:           type           ?? "LEAD",
          cruiseInterest: cruiseInterest ?? null,
          budgetRange:    budgetRange    ?? null,
          adminMemo:      adminMemo      ?? null,
          assignedUserId: safeAssignedUserId,
          age:            age            ?? null,
          maritalStatus:  maritalStatus  ?? null,
          childrenCount:  childrenCount  ?? 0,
          segment,
          recommendedProduct,
          ...(safeGroupIds.length > 0
            ? { groups: { create: safeGroupIds.map((gid) => ({ groupId: gid })) } }
            : {}),
        },
      });

      // Phase 4A: 렌즈 감지 (L0-L10 자동 분류)
      const detectedLenses = detectLenses({
        ...newContact,
        callLogs: [],
        memos: [],
      } as Parameters<typeof detectLenses>[0]);
      const sortedLenses = sortLensesByPriority(detectedLenses);

      if (sortedLenses.length > 0) {
        const newTags = [...(newContact.tags || []), ...sortedLenses];
        await tx.contact.update({
          where: { id: newContact.id },
          data: { tags: newTags },
        });
        logger.log("[POST /api/contacts] 렌즈 감지 완료", { id: newContact.id, lenses: sortedLenses });
        return { ...newContact, tags: newTags };
      }

      return newContact;
    });

    logger.log("[POST /api/contacts] 고객 생성", { id: contact.id, segment });

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
              OR: [
                { organizationId: orgId },
                { organizationId: null }, // 전역 시스템 템플릿
              ],
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
      ...(safeGroupIds.length > 0 && contact.id
        ? safeGroupIds.map((gid) =>
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = err.meta?.target as string[] | undefined;
      const message = target?.includes('phone')
        ? '이미 등록된 전화번호입니다.'
        : '중복된 정보입니다.';
      return NextResponse.json(
        { ok: false, error: message, code: 'DUPLICATE_CONTACT' },
        { status: 409 }
      );
    }
    logger.error("[POST /api/contacts]", { err });
    return handleApiError(err);
  }
}
