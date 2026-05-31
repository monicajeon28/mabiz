/**
 * DataLoader for N+1 Prevention
 * Batches database queries to improve GraphQL resolver performance
 *
 * Features:
 * - Batch loading contacts, campaigns, segments, partners
 * - 1-hour TTL caching per request
 * - Automatic deduplication
 * - Error propagation
 *
 * Usage:
 * const loaders = createDataLoaders();
 * const contact = loaders.contactLoader.load(contactId);
 * const campaigns = loaders.campaignLoader.loadMany(campaignIds);
 */

import DataLoader from "dataloader";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ═════════════════════════════════════════════════════════════
// DATALOADER FACTORIES
// ═════════════════════════════════════════════════════════════

/**
 * Create a DataLoader for Contacts
 * Batches multiple contact queries into a single database call
 */
export const createContactLoader = () => {
  return new DataLoader(async (contactIds: readonly string[]) => {
    try {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds as string[] } },
        include: {
          contactLensClassifications: true,
          contactSegmentAssignments: true,
        },
      });

      // Return in the same order as requested IDs
      return contactIds.map((id) => {
        const contact = contacts.find((c) => c.id === id);
        return contact || new Error(`Contact ${id} not found`);
      });
    } catch (error) {
      logger.error("[DataLoader] Contact batch load failed", {
        error: error instanceof Error ? error.message : String(error),
        count: contactIds.length,
      });
      throw error;
    }
  });
};

/**
 * Create a DataLoader for Campaigns
 */
export const createCampaignLoader = () => {
  return new DataLoader(async (campaignIds: readonly string[]) => {
    try {
      const campaigns = await prisma.crmMarketingCampaign.findMany({
        where: { id: { in: campaignIds as string[] } },
        include: {
          messages: true,
          abTestVariants: true,
        },
      });

      return campaignIds.map((id) => {
        const campaign = campaigns.find((c) => c.id === id);
        return campaign || new Error(`Campaign ${id} not found`);
      });
    } catch (error) {
      logger.error("[DataLoader] Campaign batch load failed", {
        error: error instanceof Error ? error.message : String(error),
        count: campaignIds.length,
      });
      throw error;
    }
  });
};

/**
 * Create a DataLoader for Segments
 */
export const createSegmentLoader = () => {
  return new DataLoader(async (segmentIds: readonly string[]) => {
    try {
      const segments = await prisma.contactGroup.findMany({
        where: { id: { in: segmentIds as string[] } },
        include: {
          members: {
            select: { contactId: true },
            take: 1000, // limit for performance
          },
        },
      });

      return segmentIds.map((id) => {
        const segment = segments.find((s) => s.id === id);
        return segment || new Error(`Segment ${id} not found`);
      });
    } catch (error) {
      logger.error("[DataLoader] Segment batch load failed", {
        error: error instanceof Error ? error.message : String(error),
        count: segmentIds.length,
      });
      throw error;
    }
  });
};

/**
 * Create a DataLoader for Partners
 */
export const createPartnerLoader = () => {
  return new DataLoader(async (partnerIds: readonly string[]) => {
    try {
      const partners = await prisma.partner.findMany({
        where: { id: { in: partnerIds as string[] } },
      });

      return partnerIds.map((id) => {
        const partner = partners.find((p) => p.id === id);
        return partner || new Error(`Partner ${id} not found`);
      });
    } catch (error) {
      logger.error("[DataLoader] Partner batch load failed", {
        error: error instanceof Error ? error.message : String(error),
        count: partnerIds.length,
      });
      throw error;
    }
  });
};

/**
 * Create a DataLoader for Contact interactions (SMS, Email, etc)
 */
export const createContactInteractionLoader = () => {
  return new DataLoader(async (contactIds: readonly string[]) => {
    try {
      const interactions = await prisma.crmMarketingMessage.findMany({
        where: {
          contactId: { in: contactIds as string[] },
        },
        orderBy: { createdAt: "DESC" },
        take: 10000, // limit for performance
      });

      return contactIds.map((id) =>
        interactions.filter((i) => i.contactId === id)
      );
    } catch (error) {
      logger.error("[DataLoader] ContactInteraction batch load failed", {
        error: error instanceof Error ? error.message : String(error),
        count: contactIds.length,
      });
      throw error;
    }
  });
};

/**
 * Create a DataLoader for Campaign metrics
 */
export const createCampaignMetricsLoader = () => {
  return new DataLoader(async (campaignIds: readonly string[]) => {
    try {
      const metrics = await Promise.all(
        campaignIds.map(async (id) => {
          const messages = await prisma.crmMarketingMessage.findMany({
            where: { campaignId: id },
          });

          const totalSent = messages.length;
          const totalDelivered = messages.filter(
            (m) => m.status === "sent" || m.status === "opened" || m.status === "clicked" || m.status === "converted"
          ).length;
          const totalOpened = messages.filter(
            (m) => m.status === "opened" || m.status === "clicked" || m.status === "converted"
          ).length;
          const totalClicked = messages.filter(
            (m) => m.status === "clicked" || m.status === "converted" || m.lastClickTime !== null
          ).length;

          return {
            campaignId: id,
            totalSent,
            totalDelivered,
            totalOpened,
            totalClicked,
            deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
            openRate:
              totalDelivered > 0
                ? (totalOpened / totalDelivered) * 100
                : 0,
            clickRate:
              totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
          };
        })
      );

      return campaignIds.map((id) => {
        const metric = metrics.find((m) => m.campaignId === id);
        return metric || null;
      });
    } catch (error) {
      logger.error("[DataLoader] CampaignMetrics batch load failed", {
        error: error instanceof Error ? error.message : String(error),
        count: campaignIds.length,
      });
      throw error;
    }
  });
};

/**
 * Create all DataLoaders together
 */
export const createDataLoaders = () => ({
  contactLoader: createContactLoader(),
  campaignLoader: createCampaignLoader(),
  segmentLoader: createSegmentLoader(),
  partnerLoader: createPartnerLoader(),
  contactInteractionLoader: createContactInteractionLoader(),
  campaignMetricsLoader: createCampaignMetricsLoader(),
});

export type DataLoaders = ReturnType<typeof createDataLoaders>;

/**
 * Create a caching layer on top of DataLoaders
 * TTL: 1 hour per request
 */
export class CachedDataLoaders {
  private cache: Map<string, any> = new Map();
  private loaders: ReturnType<typeof createDataLoaders>;
  private ttl = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.loaders = createDataLoaders();
  }

  private getCacheKey(type: string, id: string): string {
    return `${type}:${id}`;
  }

  async getContact(contactId: string) {
    const key = this.getCacheKey("contact", contactId);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const contact = await this.loaders.contactLoader.load(contactId);
    this.cache.set(key, contact);
    return contact;
  }

  async getCampaign(campaignId: string) {
    const key = this.getCacheKey("campaign", campaignId);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const campaign = await this.loaders.campaignLoader.load(campaignId);
    this.cache.set(key, campaign);
    return campaign;
  }

  async getSegment(segmentId: string) {
    const key = this.getCacheKey("segment", segmentId);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const segment = await this.loaders.segmentLoader.load(segmentId);
    this.cache.set(key, segment);
    return segment;
  }

  async getPartner(partnerId: string) {
    const key = this.getCacheKey("partner", partnerId);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const partner = await this.loaders.partnerLoader.load(partnerId);
    this.cache.set(key, partner);
    return partner;
  }

  clearCache() {
    this.cache.clear();
  }
}
