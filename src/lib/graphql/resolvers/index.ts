/**
 * GraphQL Resolvers
 * Implementation of Query, Mutation, Subscription resolvers
 *
 * Structure:
 * - Query resolvers: contact, contacts, campaigns, segments, forecasts, analytics
 * - Mutation resolvers: create/update/delete campaigns and contacts
 * - Field resolvers: nested data (contact.campaigns, campaign.metrics)
 *
 * Error handling:
 * - Authentication checks in each resolver
 * - Field-level PII masking for unauthorized users
 * - Comprehensive logging
 */

import { GraphQLError } from "graphql";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { maskPII } from "@/lib/graphql/utils/pii-masking";
import { getContactLens } from "@/lib/contact/lens-detector";
import { calculateRiskScore } from "@/lib/contact/risk-scorer";
import { CampaignMetricsCalculator } from "@/lib/graphql/utils/metrics-calculator";
import { ForecastEngine } from "@/lib/graphql/utils/forecast-engine";
import DataLoader from "dataloader";

// ═════════════════════════════════════════════════════════════
// DATA LOADERS (N+1 prevention)
// ═════════════════════════════════════════════════════════════

// Create new DataLoaders for each request to avoid cross-request caching
const createDataLoaders = () => ({
  contactLoader: new DataLoader(async (contactIds: readonly string[]) => {
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds as string[] } },
    });
    return contactIds.map(
      (id) => contacts.find((c) => c.id === id) || null
    );
  }),

  campaignLoader: new DataLoader(async (campaignIds: readonly string[]) => {
    const campaigns = await prisma.crmMarketingCampaign.findMany({
      where: { id: { in: campaignIds as string[] } },
      include: {
        messages: true,
        abTestVariants: true,
      },
    });
    return campaignIds.map(
      (id) => campaigns.find((c) => c.id === id) || null
    );
  }),

  segmentLoader: new DataLoader(async (segmentIds: readonly string[]) => {
    // NOTE: customerSegment table does not exist. Using contactGroup as alternative
    const segments = await prisma.contactGroup.findMany({
      where: { id: { in: segmentIds as string[] } },
    });
    return segmentIds.map(
      (id) => segments.find((s) => s.id === id) || null
    );
  }),
});

// ═════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═════════════════════════════════════════════════════════════

interface GraphQLContext {
  userId?: string;
  organizationId?: string;
  role?: string;
  isAuthorized: boolean;
  loaders?: ReturnType<typeof createDataLoaders>;
}

// ═════════════════════════════════════════════════════════════
// QUERY RESOLVERS
// ═════════════════════════════════════════════════════════════

const queryResolvers = {
  // ─────────────── Contact Queries ───────────────

  async contact(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const contact = await prisma.contact.findUnique({
        where: { id },
        include: {
          contactLensClassifications: true,
          groups: true,
        },
      });

      if (!contact || contact.organizationId !== context.organizationId) {
        throw new GraphQLError("Contact not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return formatContact(contact, context);
    } catch (error) {
      logger.error("[GraphQL Query.contact]", {
        contactId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async contacts(
    _: unknown,
    {
      filter,
      limit = 50,
      offset = 0,
      orderBy = "createdAt",
      orderDirection = "DESC",
    }: {
      filter?: any;
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: string;
    },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // Validate pagination
    if (limit < 1 || limit > 1000) {
      throw new GraphQLError("Limit must be between 1 and 1000", {
        extensions: { code: "BAD_REQUEST" },
      });
    }

    try {
      // Build where clause from filter
      const where: any = { organizationId: context.organizationId };

      if (filter) {
        if (filter.phone) where.phone = { contains: filter.phone };
        if (filter.email) where.email = { contains: filter.email };
        if (filter.assignedUserId) where.assignedUserId = filter.assignedUserId;
        if (filter.leadScoreMin) where.leadScore = { gte: filter.leadScoreMin };
        if (filter.leadScoreMax) {
          where.leadScore = { ...where.leadScore, lte: filter.leadScoreMax };
        }
        if (filter.createdAfter) where.createdAt = { gte: filter.createdAfter };
        if (filter.createdBefore) {
          where.createdAt = { ...where.createdAt, lte: filter.createdBefore };
        }
        if (filter.search) {
          where.OR = [
            { name: { contains: filter.search, mode: "insensitive" } },
            { email: { contains: filter.search, mode: "insensitive" } },
            { phone: { contains: filter.search, mode: "insensitive" } },
          ];
        }
      }

      // Fetch total count
      const totalCount = await prisma.contact.count({ where });

      // Fetch paginated contacts
      const contacts = await prisma.contact.findMany({
        where,
        include: {
          contactLensClassifications: true,
          groups: true,
        },
        orderBy: { [orderBy]: orderDirection.toUpperCase() },
        take: limit,
        skip: offset,
      });

      const edges = contacts.map((contact, index) => ({
        node: formatContact(contact, context),
        cursor: Buffer.from(`offset:${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };
    } catch (error) {
      logger.error("[GraphQL Query.contacts]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async atRiskContacts(
    _: unknown,
    { riskLevel = "HIGH", limit = 50 }: { riskLevel?: string; limit?: number },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const contacts = await prisma.contact.findMany({
        where: {
          organizationId: context.organizationId,
        },
        take: limit,
        orderBy: { leadScore: "asc" },
      });

      // Filter by risk level based on lead score
      return contacts
        .filter((contact) => {
          const risk = calculateRiskScore(contact);
          if (riskLevel === "CRITICAL") return risk >= 80;
          if (riskLevel === "HIGH") return risk >= 60 && risk < 80;
          return risk >= 40;
        })
        .map((contact) => formatContact(contact, context));
    } catch (error) {
      logger.error("[GraphQL Query.atRiskContacts]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ─────────────── Campaign Queries ───────────────

  async campaign(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const campaign = await prisma.crmMarketingCampaign.findUnique({
        where: { id },
        include: {
          messages: true,
          abTestVariants: true,
        },
      });

      if (
        !campaign ||
        campaign.organizationId !== context.organizationId
      ) {
        throw new GraphQLError("Campaign not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return formatCampaign(campaign, context);
    } catch (error) {
      logger.error("[GraphQL Query.campaign]", {
        campaignId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async campaigns(
    _: unknown,
    { filter, limit = 50, offset = 0 }: { filter?: any; limit?: number; offset?: number },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const where: any = { organizationId: context.organizationId };

      if (filter?.status) where.status = filter.status;
      if (filter?.createdAfter) where.createdAt = { gte: filter.createdAfter };
      if (filter?.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: filter.createdBefore };
      }

      const totalCount = await prisma.crmMarketingCampaign.count({ where });

      const campaigns = await prisma.crmMarketingCampaign.findMany({
        where,
        include: {
          messages: true,
          abTestVariants: true,
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "DESC" },
      });

      return {
        edges: campaigns.map((campaign, index) => ({
          node: formatCampaign(campaign, context),
          cursor: Buffer.from(`offset:${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
        },
        totalCount,
      };
    } catch (error) {
      logger.error("[GraphQL Query.campaigns]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ─────────────── Segment Queries ───────────────

  async segments(_: unknown, __: unknown, context: GraphQLContext) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      // NOTE: customerSegment table does not exist. Using contactGroup as alternative
      const segments = await prisma.contactGroup.findMany({
        where: { organizationId: context.organizationId },
      });

      return segments.map((segment) => formatSegment(segment, context));
    } catch (error) {
      logger.error("[GraphQL Query.segments]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async segment(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      // NOTE: customerSegment table does not exist. Using contactGroup as alternative
      const segment = await prisma.contactGroup.findUnique({
        where: { id },
      });

      if (!segment || segment.organizationId !== context.organizationId) {
        throw new GraphQLError("Segment not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return formatSegment(segment, context);
    } catch (error) {
      logger.error("[GraphQL Query.segment]", {
        segmentId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ─────────────── Forecast Queries ───────────────

  async revenueForecasts(
    _: unknown,
    { days = 30, limit = 10 }: { days?: number; limit?: number },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const engine = new ForecastEngine(context.organizationId);
      const forecasts = await engine.forecast("REVENUE", days, limit);
      return forecasts.map((f) => formatForecast(f, context));
    } catch (error) {
      logger.error("[GraphQL Query.revenueForecasts]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async conversionForecasts(
    _: unknown,
    { days = 30 }: { days?: number },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const engine = new ForecastEngine(context.organizationId);
      const forecasts = await engine.forecast("CONVERSION_RATE", days);
      return forecasts.map((f) => formatForecast(f, context));
    } catch (error) {
      logger.error("[GraphQL Query.conversionForecasts]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ─────────────── Partner Queries ───────────────

  async partners(
    _: unknown,
    { limit = 50 }: { limit?: number },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const partners = await prisma.partner.findMany({
        where: { organizationId: context.organizationId },
        take: limit,
        orderBy: { createdAt: "DESC" },
      });

      return partners.map((partner) => formatPartner(partner, context));
    } catch (error) {
      logger.error("[GraphQL Query.partners]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ─────────────── Analytics Queries ───────────────

  async analytics(
    _: unknown,
    { period = "MONTH" }: { period?: string },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const analytics = await buildAnalytics(
        context.organizationId,
        period
      );
      return analytics;
    } catch (error) {
      logger.error("[GraphQL Query.analytics]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async health() {
    return "OK";
  },
};

// ═════════════════════════════════════════════════════════════
// MUTATION RESOLVERS
// ═════════════════════════════════════════════════════════════

const mutationResolvers = {
  async createCampaign(
    _: unknown,
    { input }: { input: any },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const campaign = await prisma.crmMarketingCampaign.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          description: input.description,
          status: "DRAFT",
          messageTemplate: input.messageTemplate,
          scheduledAt: input.scheduledAt,
        },
        include: {
          messages: true,
          abTestVariants: true,
        },
      });

      logger.info("[GraphQL Mutation.createCampaign]", {
        campaignId: campaign.id,
        organizationId: context.organizationId,
      });

      return formatCampaign(campaign, context);
    } catch (error) {
      logger.error("[GraphQL Mutation.createCampaign]", {
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async updateCampaign(
    _: unknown,
    { id, name, status, messageTemplate }: any,
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      // Verify ownership
      const campaign = await prisma.crmMarketingCampaign.findUnique({
        where: { id },
      });

      if (
        !campaign ||
        campaign.organizationId !== context.organizationId
      ) {
        throw new GraphQLError("Campaign not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const updated = await prisma.crmMarketingCampaign.update({
        where: { id },
        data: {
          title: name || campaign.title,
          status: status || campaign.status,
          smsBody: messageTemplate || campaign.smsBody,
        },
        include: {
          variants: true,
          executionLogs: true,
        },
      });

      return formatCampaign(updated, context);
    } catch (error) {
      logger.error("[GraphQL Mutation.updateCampaign]", {
        campaignId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async deleteCampaign(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      const campaign = await prisma.crmMarketingCampaign.findUnique({
        where: { id },
      });

      if (
        !campaign ||
        campaign.organizationId !== context.organizationId
      ) {
        throw new GraphQLError("Campaign not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      if (campaign.status !== "DRAFT") {
        throw new GraphQLError("Can only delete DRAFT campaigns", {
          extensions: { code: "INVALID_STATE" },
        });
      }

      await prisma.crmMarketingCampaign.delete({ where: { id } });
      return true;
    } catch (error) {
      logger.error("[GraphQL Mutation.deleteCampaign]", {
        campaignId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async triggerWorkflow(
    _: unknown,
    { input }: { input: any },
    context: GraphQLContext
  ) {
    if (!context.isAuthorized || !context.organizationId) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    try {
      // Stub implementation - connect to workflow engine
      const execution = {
        id: `exec-${Date.now()}`,
        contactId: input.contactId,
        workflowId: input.workflowId,
        status: "PENDING",
        startedAt: new Date(),
        completedAt: null,
        logs: ["Workflow triggered"],
      };

      logger.info("[GraphQL Mutation.triggerWorkflow]", {
        contactId: input.contactId,
        workflowId: input.workflowId,
        organizationId: context.organizationId,
      });

      return execution;
    } catch (error) {
      logger.error("[GraphQL Mutation.triggerWorkflow]", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

// ═════════════════════════════════════════════════════════════
// FIELD RESOLVERS
// ═════════════════════════════════════════════════════════════

const contactResolvers = {
  async segment(parent: any, _: unknown, context: GraphQLContext) {
    if (!parent.segmentId) return null;
    // NOTE: customerSegment table does not exist. Using contactGroup as alternative
    return await prisma.contactGroup.findUnique({
      where: { id: parent.segmentId },
    });
  },

  async campaigns(parent: any, _: unknown, context: GraphQLContext) {
    // Find campaigns targeting this contact's segment
    return await prisma.crmMarketingCampaign.findMany({
      where: { organizationId: parent.organizationId },
      take: 10,
    });
  },

  async interactions(parent: any, _: unknown, context: GraphQLContext) {
    // Find all SMS/email interactions for this contact
    return [];
  },
};

const campaignResolvers = {
  async metrics(parent: any, _: unknown, context: GraphQLContext) {
    const calculator = new CampaignMetricsCalculator(parent.id);
    return await calculator.calculate();
  },

  async contacts(parent: any, _: unknown, context: GraphQLContext) {
    // Find contacts targeted by this campaign
    return [];
  },
};

// ═════════════════════════════════════════════════════════════
// FORMATTER FUNCTIONS
// ═════════════════════════════════════════════════════════════

function formatContact(contact: any, context: GraphQLContext) {
  const riskScore = calculateRiskScore(contact);
  const lens = getContactLens(contact);

  // Mask PII for unauthorized users
  const email = context.role === "AGENT"
    ? maskPII(contact.email || "")
    : contact.email;
  const phone = context.role === "AGENT"
    ? maskPII(contact.phone || "")
    : contact.phone;

  return {
    ...contact,
    email,
    phone,
    riskScore,
    riskLevel: riskScore >= 80 ? "CRITICAL" : riskScore >= 60 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW",
    lens,
  };
}

function formatCampaign(campaign: any, context: GraphQLContext) {
  return {
    ...campaign,
    channels: campaign.channels || [],
    targetSegments: campaign.targetSegments || [],
    targetLenses: campaign.targetLenses || [],
  };
}

function formatSegment(segment: any, context: GraphQLContext) {
  return {
    ...segment,
    profile: segment.profile || {},
  };
}

function formatForecast(forecast: any, context: GraphQLContext) {
  return {
    ...forecast,
    drivers: forecast.drivers || [],
  };
}

function formatPartner(partner: any, context: GraphQLContext) {
  return {
    ...partner,
    riskScore: calculatePartnerRiskScore(partner),
  };
}

async function buildAnalytics(organizationId: string, period: string) {
  const contacts = await prisma.contact.findMany({
    where: { organizationId },
  });

  return {
    organizationId,
    period,
    totalContacts: contacts.length,
    newContactsAdded: contacts.filter(
      (c) => new Date(c.createdAt) > getPeriodStart(period)
    ).length,
    activeContacts: contacts.filter((c) => !c.optOutAt).length,
    churnedContacts: contacts.filter((c) => c.optOutAt).length,
    campaignsRunning: 0,
    averageConversionRate: 0,
    averageCPA: 0,
    segmentDistribution: [],
    highRiskContacts: 0,
    criticalRiskContacts: 0,
    topPartners: [],
    partnerRetention: 0,
    generatedAt: new Date(),
  };
}

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "TODAY":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "WEEK":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "MONTH":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "QUARTER":
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case "YEAR":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function calculatePartnerRiskScore(partner: any): number {
  // Simple risk calculation: high if inactive or low sales
  let score = 0;
  if (!partner.lastActivityAt) score += 40;
  if (partner.salesThisMonth < 1000) score += 30;
  if (partner.status === "SUSPENDED") score += 50;
  return Math.min(score, 100);
}

// ═════════════════════════════════════════════════════════════
// EXPORT RESOLVERS
// ═════════════════════════════════════════════════════════════

export const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  Contact: contactResolvers,
  Campaign: campaignResolvers,
};
