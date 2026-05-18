/**
 * Unit tests for campaign-variant.ts
 * Menu #38 Phase 3 Wave 2: A/B Variant selection logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { selectVariant, getVariantContent } from "@/lib/campaign-variant";
import db from "@/lib/prisma";

// Prisma를 mocking
vi.mock("@/lib/prisma", () => {
  const mockDb = {
    campaignVariant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    crmMarketingCampaign: {
      findUnique: vi.fn(),
    },
  };
  return {
    default: mockDb,
  };
});

describe("selectVariant()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null for campaign without variants", async () => {
    const mockDb = db as any;
    mockDb.campaignVariant.findMany.mockResolvedValue([]);

    const result = await selectVariant("cmp_no_variant");

    expect(result).toBeNull();
  });

  it("should return A or B for campaign with variants", async () => {
    const mockDb = db as any;
    mockPrisma.campaignVariant.findMany.mockResolvedValue([
      { variantKey: "A", trafficSplit: 0.5 },
      { variantKey: "B", trafficSplit: 0.5 },
    ]);

    const result = await selectVariant("cmp_with_variants");

    expect(["A", "B", null]).toContain(result);
  });

  it("should return A when random < trafficSplit", async () => {
    const mockDb = db as any;
    mockPrisma.campaignVariant.findMany.mockResolvedValue([
      { variantKey: "A", trafficSplit: 0.9 }, // 90% A
      { variantKey: "B", trafficSplit: 0.1 },
    ]);

    // Math.random()을 mocking하여 항상 작은 값 반환
    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0.5); // < 0.9, so should select A

    const result = await selectVariant("cmp_90_10");

    expect(result).toBe("A");
    Math.random = originalRandom;
  });

  it("should return B when random >= trafficSplit", async () => {
    const mockDb = db as any;
    mockPrisma.campaignVariant.findMany.mockResolvedValue([
      { variantKey: "A", trafficSplit: 0.1 }, // 10% A
      { variantKey: "B", trafficSplit: 0.9 },
    ]);

    // Math.random()을 mocking하여 항상 큰 값 반환
    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0.5); // >= 0.1, so should select B

    const result = await selectVariant("cmp_10_90");

    expect(result).toBe("B");
    Math.random = originalRandom;
  });

  it("should handle campaign with unexpected variant count", async () => {
    const mockDb = db as any;
    // 3개의 variant (예상: 2개)
    mockPrisma.campaignVariant.findMany.mockResolvedValue([
      { variantKey: "A", trafficSplit: 0.5 },
      { variantKey: "B", trafficSplit: 0.3 },
      { variantKey: "C", trafficSplit: 0.2 },
    ]);

    const result = await selectVariant("cmp_invalid");

    // 첫 번째 variant (A)를 반환하거나 null 반환
    expect(result === "A" || result === null).toBe(true);
  });

  it("should return null when missing A or B variant", async () => {
    const mockDb = db as any;
    // A나 B 중 하나만 존재
    mockPrisma.campaignVariant.findMany.mockResolvedValue([
      { variantKey: "A", trafficSplit: 0.5 },
    ]);

    const result = await selectVariant("cmp_missing_variant");

    expect(result).toBeNull();
  });
});

describe("getVariantContent()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return campaign content for null variantKey", async () => {
    const mockDb = db as any;
    const expectedContent = {
      smsBody: "Test SMS",
      emailSubject: "Test Subject",
      emailBody: "Test Email Body",
    };

    mockDb.crmMarketingCampaign.findUnique.mockResolvedValue(
      expectedContent
    );

    const result = await getVariantContent("cmp_123", null);

    expect(result).toEqual(expectedContent);
    expect(mockDb.crmMarketingCampaign.findUnique).toHaveBeenCalledWith({
      where: { id: "cmp_123" },
      select: {
        smsBody: true,
        emailSubject: true,
        emailBody: true,
      },
    });
  });

  it("should return variant content for A", async () => {
    const mockDb = db as any;
    const expectedVariant = {
      smsBody: "Variant A SMS",
      emailSubject: "Variant A Subject",
      emailBody: "Variant A Body",
    };

    mockPrisma.campaignVariant.findUnique.mockResolvedValue(expectedVariant);

    const result = await getVariantContent("cmp_123", "A");

    expect(result).toEqual(expectedVariant);
    expect(mockDb.campaignVariant.findUnique).toHaveBeenCalledWith({
      where: {
        campaignId_variantKey: { campaignId: "cmp_123", variantKey: "A" },
      },
      select: {
        smsBody: true,
        emailSubject: true,
        emailBody: true,
      },
    });
  });

  it("should return variant content for B", async () => {
    const mockDb = db as any;
    const expectedVariant = {
      smsBody: "Variant B SMS",
      emailSubject: "Variant B Subject",
      emailBody: "Variant B Body",
    };

    mockPrisma.campaignVariant.findUnique.mockResolvedValue(expectedVariant);

    const result = await getVariantContent("cmp_123", "B");

    expect(result).toEqual(expectedVariant);
  });

  it("should return null when variant not found", async () => {
    const mockDb = db as any;
    mockDb.campaignVariant.findUnique.mockResolvedValue(null);

    const result = await getVariantContent("cmp_123", "A");

    expect(result).toBeNull();
  });

  it("should handle errors gracefully", async () => {
    const mockDb = db as any;
    mockDb.campaignVariant.findUnique.mockRejectedValue(
      new Error("DB Error")
    );

    const result = await getVariantContent("cmp_123", "A");

    expect(result).toBeNull();
  });
});

describe("traffic split distribution (probabilistic)", () => {
  it("should approximately respect 50:50 traffic split", async () => {
    const mockDb = db as any;
    mockPrisma.campaignVariant.findMany.mockResolvedValue([
      { variantKey: "A", trafficSplit: 0.5 },
      { variantKey: "B", trafficSplit: 0.5 },
    ]);

    const results: (string | null)[] = [];
    const iterations = 1000;

    // 1000번 selectVariant 호출하여 분포 확인
    for (let i = 0; i < iterations; i++) {
      const result = await selectVariant("cmp_50_50");
      results.push(result);
    }

    const countA = results.filter((r) => r === "A").length;
    const ratio = countA / iterations;

    // 50 ± 10% 범위 (0.4 ~ 0.6)
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it("should respect 30:70 traffic split", async () => {
    const mockDb = db as any;
    mockPrisma.campaignVariant.findMany.mockResolvedValue([
      { variantKey: "A", trafficSplit: 0.3 }, // 30% A
      { variantKey: "B", trafficSplit: 0.7 },
    ]);

    const results: (string | null)[] = [];
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const result = await selectVariant("cmp_30_70");
      results.push(result);
    }

    const countA = results.filter((r) => r === "A").length;
    const ratio = countA / iterations;

    // 30 ± 10% 범위 (0.2 ~ 0.4)
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.4);
  });
});
