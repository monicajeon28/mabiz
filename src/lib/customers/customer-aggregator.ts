/**
 * Customer Aggregator
 *
 * Unified interface for aggregating customer data from multiple sources:
 * - Contact (CRM contacts)
 * - GoldMember (membership/subscription customers)
 * - GmUser (platform users from cruisedot)
 * - ContactGroup (group memberships)
 *
 * Provides 360° customer view with:
 * - Basic demographics
 * - Interaction history (messages, calls, purchases)
 * - Lens classification (L0-L10 psychology)
 * - Risk scoring
 * - Linked data (groups, partner, affiliate info)
 */

import { prisma } from "@/lib/prisma";
import { Contact, GoldMember, Organization } from "@prisma/client";

export interface Customer360View {
  id: string;
  type: "contact" | "gold_member" | "platform_user" | "mixed";

  // Basic Info
  name: string;
  phone: string;
  email: string | null;

  // Source Info
  sourceType: string; // "contact" | "gold_member" | "user" | "inquiry"
  sourceId: string;
  organizationId: string;

  // Contact-specific
  contact?: ContactDetail;

  // GoldMember-specific
  goldMember?: GoldMemberDetail;

  // Platform User data (if linked)
  platformUser?: PlatformUserDetail;

  // Lens & Psychology
  primaryLens?: {
    lensType: string; // "L0", "L1", "L6", "L10"
    label: string;
    confidenceScore: number;
    readinessScore: number;
  };
  allLenses: LensClassification[];

  // Risk & Scoring
  riskScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskFlags: string[];

  // Journey & Interactions
  journey: CustomerJourneyEvent[];

  // Groups
  groupMemberships: GroupMembership[];

  // Partner & Affiliate
  partner?: PartnerInfo;
  affiliate?: AffiliateInfo;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastInteractionAt: Date | null;
}

export interface ContactDetail {
  id: string;
  type: string;
  status: string;
  channel: string;
  tags: string[];

  // Engagement
  leadScore: number;
  reEngageCount: number;

  // Purchase History
  purchasedAt: Date | null;
  lastPaymentStatus: string | null;
  lastPaymentAt: Date | null;

  // Cruise-specific
  cruiseCount: number;
  cruiseInterest: string | null;

  // Lens metadata
  lensMetadata: any;

  // Conversation history
  memoCount: number;
  lastMemoAt: Date | null;
  callCount: number;
  lastCallAt: Date | null;
}

export interface GoldMemberDetail {
  id: string;
  memberCode: string;
  courseType: string;
  status: string;
  tier: number;

  // Financial
  totalPayments: number;
  paidCount: number;
  maxPaymentCount: number | null;

  // Dates
  joinDate: Date;
  startDate: Date | null;

  // Related
  consultationCount: number;
}

export interface PlatformUserDetail {
  id: number;
  status: string;
  registeredAt: Date | null;
  lastLoginAt: Date | null;

  // Profile
  profileComplete: boolean;

  // Activity
  tripCount: number;
  reservationCount: number;
}

export interface LensClassification {
  lensType: string;
  label: string;
  confidenceScore: number;
  readinessScore: number;
  status: string;
  identifiedAt: Date;
}

export interface GroupMembership {
  groupId: string;
  groupName: string;
  color: string | null;
  joinedAt: Date;
}

export interface PartnerInfo {
  id: string;
  name: string;
  status: string;
}

export interface AffiliateInfo {
  code: string;
  userId: string | null;
  salesCount: number;
  totalRevenue: number;
}

export interface CustomerJourneyEvent {
  id: string;
  type: "call" | "sms" | "email" | "memo" | "payment" | "lens_update";
  timestamp: Date;
  details: Record<string, any>;
  channel?: string;
}

/**
 * Get 360° customer view for a given contact ID
 * Performance: <1s for typical queries
 */
export async function getCustomer360(
  contactId: string,
  organizationId: string
): Promise<Customer360View | null> {
  // Fetch contact first (needed for phone lookup in payments)
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      organization: true,
      partner: true,
      groups: { include: { group: true } },
    },
  });

  if (!contact) return null;

  // Fetch related data in parallel
  const [lenses, groups, memos, calls, payments] = await Promise.all([
    prisma.contactLensClassification.findMany({
      where: { contactId, organizationId },
      orderBy: { confidenceScore: "desc" },
    }),
    prisma.contactGroupMember.findMany({
      where: { contactId },
      include: { group: true },
    }),
    prisma.contactMemo.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.callLog.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.payAppPayment.findMany({
      where: {
        customerPhone: contact.phone,
        organizationId,
      },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
  ]);

  // Build lens classifications
  const allLenses: LensClassification[] = lenses.map((lens) => ({
    lensType: lens.lensType,
    label: lens.lensLabel || `Lens ${lens.lensType}`,
    confidenceScore: lens.confidenceScore,
    readinessScore: lens.readinessScore,
    status: lens.status,
    identifiedAt: lens.identifiedAt,
  }));

  // Primary lens = highest confidence
  const primaryLens = allLenses[0];

  // Build journey events
  const journeyEvents: CustomerJourneyEvent[] = [];

  // Add calls
  calls.forEach((call) => {
    journeyEvents.push({
      id: call.id,
      type: "call",
      timestamp: call.createdAt,
      details: {
        duration: call.duration,
        result: call.result,
        nextAction: call.nextAction,
        convictionScore: call.convictionScore,
      },
      channel: "phone",
    });
  });

  // Add memos
  memos.forEach((memo) => {
    journeyEvents.push({
      id: memo.id,
      type: "memo",
      timestamp: memo.createdAt,
      details: {
        content: memo.content.substring(0, 200), // Truncate for display
      },
    });
  });

  // Add payments
  payments?.forEach((payment) => {
    journeyEvents.push({
      id: payment.id,
      type: "payment",
      timestamp: payment.paidAt || payment.createdAt,
      details: {
        amount: payment.amount,
        status: payment.status,
        refundedAt: payment.refundedAt,
      },
      channel: "payment",
    });
  });

  // Sort journey by timestamp (most recent first)
  journeyEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Calculate risk score
  const riskScore = calculateRiskScore(contact, allLenses);

  // Get group memberships
  const groupMemberships: GroupMembership[] = groups.map((gm) => ({
    groupId: gm.group.id,
    groupName: gm.group.name,
    color: gm.group.color,
    joinedAt: gm.addedAt,
  }));

  // Get affiliate info if exists
  let affiliateInfo: AffiliateInfo | undefined;
  if (contact.affiliateCode) {
    const sales = await prisma.affiliateSale.findMany({
      where: {
        affiliateCode: contact.affiliateCode,
        organizationId,
      },
    });
    affiliateInfo = {
      code: contact.affiliateCode,
      userId: contact.affiliateManagerId || null,
      salesCount: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + s.saleAmount, 0),
    };
  }

  // Get most recent interaction
  const lastInteractionAt = journeyEvents[0]?.timestamp || null;

  return {
    id: contact.id,
    type: "contact",
    name: contact.name,
    phone: contact.phone,
    email: contact.email || null,
    sourceType: contact.sourceType || "contact",
    sourceId: contact.id,
    organizationId: contact.organizationId,

    contact: {
      id: contact.id,
      type: contact.type,
      status: contact.lastPaymentStatus || "unknown",
      channel: contact.channel,
      tags: contact.tags || [],
      leadScore: contact.leadScore,
      reEngageCount: contact.reEngageCount,
      purchasedAt: contact.purchasedAt,
      lastPaymentStatus: contact.lastPaymentStatus,
      lastPaymentAt: contact.lastPaymentAt,
      cruiseCount: contact.cruiseCount,
      cruiseInterest: contact.cruiseInterest,
      lensMetadata: contact.lensMetadata,
      memoCount: memos.length,
      lastMemoAt: memos[0]?.createdAt || null,
      callCount: calls.length,
      lastCallAt: calls[0]?.createdAt || null,
    },

    primaryLens: primaryLens
      ? {
          lensType: primaryLens.lensType,
          label: primaryLens.label,
          confidenceScore: primaryLens.confidenceScore,
          readinessScore: primaryLens.readinessScore,
        }
      : undefined,

    allLenses,
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    riskFlags: extractRiskFlags(contact, allLenses),
    journey: journeyEvents,
    groupMemberships,

    partner: contact.partnerId
      ? {
          id: contact.partner?.id || contact.partnerId,
          name: contact.partner?.name || "Unknown",
          status: contact.partner?.status || "UNKNOWN",
        }
      : undefined,

    affiliate: affiliateInfo,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    lastInteractionAt,
  };
}

/**
 * Calculate risk score (0-100) based on contact attributes and lens classifications
 */
function calculateRiskScore(contact: Contact, lenses: LensClassification[]): number {
  let score = 0;

  // Inactivity risk (L0)
  if (contact.lastContactedAt) {
    const daysSinceContact = Math.floor(
      (Date.now() - contact.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceContact > 180) score += 25;
    else if (daysSinceContact > 90) score += 15;
    else if (daysSinceContact > 30) score += 5;
  }

  // Price sensitivity risk (L1)
  if (contact.tags?.includes("price_sensitive")) {
    score += 20;
  }

  // Anxiety/preparation risk (L2)
  if (contact.anxietyScore && contact.anxietyScore > 60) {
    score += 15;
  }

  // Competitor mention risk (L3)
  if (contact.competitorMentioned) {
    score += 20;
  }

  // Health/medical risk (L5/L9)
  if (contact.personalHealthConcern || contact.spouseHealthConcern) {
    score += 10;
  }

  // Decision window closing (L6)
  if (contact.decisionWindowExpiresAt) {
    const hoursUntilExpire =
      (contact.decisionWindowExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilExpire < 24 && hoursUntilExpire > 0) {
      score += 25; // Urgent
    } else if (hoursUntilExpire <= 0) {
      score += 30; // Missed
    }
  }

  // Payment status risk
  if (contact.lastPaymentStatus === "FAILED" || contact.lastPaymentStatus === "PENDING") {
    score += 15;
  }

  // Opt-out risk
  if (contact.optOutAt) {
    score += 30;
  }

  // Apply lens modifiers (reduce score if lens indicates readiness)
  const readyLens = lenses.find((l) => l.readinessScore > 70);
  if (readyLens) {
    score = Math.max(0, score - 10); // Reduce if customer is ready
  }

  return Math.min(100, score);
}

function getRiskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

/**
 * Extract risk flags from contact attributes
 */
function extractRiskFlags(contact: Contact, lenses: LensClassification[]): string[] {
  const flags: string[] = [];

  // Inactivity flags
  if (contact.lastContactedAt) {
    const daysSinceContact = Math.floor(
      (Date.now() - contact.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceContact > 180) flags.push("inactive_6months");
    else if (daysSinceContact > 90) flags.push("inactive_3months");
  }

  // Engagement flags
  if (contact.reEngageCount > 5) flags.push("high_reengagement_attempts");
  if (contact.optOutAt) flags.push("opted_out");

  // Payment flags
  if (contact.lastPaymentStatus === "FAILED") flags.push("payment_failed");
  if (contact.lastPaymentStatus === "PENDING") flags.push("payment_pending");
  if (contact.lastRefundedAt) flags.push("refunded_recently");

  // Lens-related flags
  if (lenses.some((l) => l.lensType === "L1" && l.confidenceScore > 70)) {
    flags.push("price_objection");
  }
  if (lenses.some((l) => l.lensType === "L2" && l.confidenceScore > 70)) {
    flags.push("preparation_anxiety");
  }
  if (contact.competitorMentioned) {
    flags.push("competitor_mentioned");
  }

  // Decision window flags
  if (contact.decisionWindowExpiresAt) {
    const hoursUntilExpire =
      (contact.decisionWindowExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilExpire <= 0) {
      flags.push("decision_window_expired");
    } else if (hoursUntilExpire < 24) {
      flags.push("decision_window_urgent");
    }
  }

  // Health flags
  if (contact.personalHealthConcern || contact.spouseHealthConcern) {
    flags.push("health_concern");
  }

  return flags;
}

/**
 * Get multiple customers with cursor-based pagination
 */
export async function getCustomers360(
  organizationId: string,
  filters?: {
    riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    lensType?: string;
    groupId?: string;
    searchQuery?: string;
    limit?: number;
    /** Cursor-based pagination: ID of the last item from previous page */
    cursor?: string;
  }
): Promise<{ customers: Customer360View[]; total: number; nextCursor: string | null; hasNextPage: boolean }> {
  const limit = Math.min(filters?.limit || 50, 200);
  const cursor = filters?.cursor;

  // Build where clause
  const where: any = { organizationId, deletedAt: null };

  if (filters?.searchQuery) {
    where.OR = [
      { name: { contains: filters.searchQuery, mode: "insensitive" } },
      { phone: { contains: filters.searchQuery } },
      { email: { contains: filters.searchQuery } },
    ];
  }

  if (filters?.groupId) {
    where.groups = {
      some: { groupId: filters.groupId },
    };
  }

  // Fetch contacts with cursor pagination (take limit+1 to detect hasNextPage)
  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        groups: { include: { group: true } },
        partner: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }),
    prisma.contact.count({ where }),
  ]);

  // Detect hasNextPage
  const hasNextPage = contacts.length > limit;
  const pageContacts = hasNextPage ? contacts.slice(0, limit) : contacts;
  const nextCursor = hasNextPage ? (pageContacts[pageContacts.length - 1]?.id ?? null) : null;

  // Get 360 view for each contact and apply risk filter if needed
  const customers = await Promise.all(
    pageContacts.map((contact) => getCustomer360(contact.id, organizationId))
  );

  let filtered = customers.filter((c) => c !== null) as Customer360View[];

  if (filters?.riskLevel) {
    filtered = filtered.filter((c) => c.riskLevel === filters.riskLevel);
  }

  if (filters?.lensType) {
    filtered = filtered.filter((c) =>
      c.allLenses.some((l) => l.lensType === filters.lensType)
    );
  }

  return {
    customers: filtered,
    total,
    nextCursor,
    hasNextPage,
  };
}
