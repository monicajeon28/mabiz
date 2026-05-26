/**
 * Lens Detection Engine - Unit Tests
 */

import { LensDetectionEngine } from "@/lib/services/lens-detection-engine";

describe("LensDetectionEngine", () => {
  const mockPrisma = {
    contact: {
      findUnique: jest.fn(),
    },
    contactLensClassification: {
      upsert: jest.fn(),
    },
  };

  const engine = new LensDetectionEngine(mockPrisma as any);

  describe("L0 Detection", () => {
    it("should detect L0 for 1y+ inactive contact", async () => {
      const contact = {
        id: "c1", organizationId: "org1", createdAt: new Date(), updatedAt: new Date(),
        lastContactedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        purchasedAt: null, lastCruiseDate: null, cruiseCount: 1, vipStatus: "GOLD",
        tags: [], lensMetadata: {}, anxietyScore: 0, preparationStage: null,
        healthConcerns: null, competitorMentioned: false, competitorNames: [],
        selfProjectionScore: 0, selfProjectionType: null, familyComposition: null,
        decisionMaker: null, ltvTotal: 0, cruiseReturnInterestLevel: 0,
        timingUrgencyScore: 0, l10ClosingScore: 0,
      };

      mockPrisma.contact.findUnique.mockResolvedValueOnce(contact);
      const result = await engine.detectLens("c1", "org1");

      expect(result.primaryLens).toBe("L0");
      expect(result.confidenceScore).toBeGreaterThanOrEqual(15);
    });
  });

  describe("L1 Detection", () => {
    it("should detect L1 for price-sensitive contact", async () => {
      const contact = {
        id: "c2", organizationId: "org1", createdAt: new Date(), updatedAt: new Date(),
        lastContactedAt: new Date(), purchasedAt: null, lastCruiseDate: null,
        cruiseCount: 0, vipStatus: null, tags: ["비싸", "가격"],
        lensMetadata: { decisionLevel: 1 }, anxietyScore: 0, preparationStage: null,
        healthConcerns: null, competitorMentioned: false, competitorNames: [],
        selfProjectionScore: 0, selfProjectionType: null, familyComposition: null,
        decisionMaker: null, ltvTotal: 0, cruiseReturnInterestLevel: 0,
        timingUrgencyScore: 0, l10ClosingScore: 0,
      };

      mockPrisma.contact.findUnique.mockResolvedValueOnce(contact);
      const result = await engine.detectLens("c2", "org1");

      expect(result.allScores.L1).toBeGreaterThanOrEqual(10);
    });
  });

  describe("L10 Detection", () => {
    it("should detect L10 for high-decision ready contact", async () => {
      const contact = {
        id: "c4", organizationId: "org1", createdAt: new Date(), updatedAt: new Date(),
        lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        purchasedAt: null, lastCruiseDate: null, cruiseCount: 0, vipStatus: null,
        tags: [], lensMetadata: { decisionLevel: 9, readinessScore: 80 },
        anxietyScore: 0, preparationStage: null, healthConcerns: null,
        competitorMentioned: false, competitorNames: [], selfProjectionScore: 0,
        selfProjectionType: null, familyComposition: null, decisionMaker: null,
        ltvTotal: 0, cruiseReturnInterestLevel: 0, timingUrgencyScore: 0, l10ClosingScore: 0,
      };

      mockPrisma.contact.findUnique.mockResolvedValueOnce(contact);
      const result = await engine.detectLens("c4", "org1");

      expect(result.primaryLens).toBe("L10");
      expect(result.confidenceScore).toBeGreaterThanOrEqual(30);
    });
  });
});
