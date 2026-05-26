/**
 * Simplified Lens Detection Batch Migration
 * Contact 10K+ auto-classification (parallel processing)
 *
 * Run: npx ts-node scripts/migrate-lens-simple.ts
 *
 * @date 2026-05-27
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const STATUS_FILE = path.join(process.cwd(), ".lens-migration-status.json");
const BATCH_SIZE = 100;
const PARALLEL_LIMIT = 5;

interface MigrationStatus {
  lastProcessedId: string | null;
  totalProcessed: number;
  totalErrors: number;
  startTime: string;
  lastUpdateTime: string;
  lensDistribution: Record<string, number>;
  isRunning: boolean;
}

const DEFAULT_STATUS: MigrationStatus = {
  lastProcessedId: null,
  totalProcessed: 0,
  totalErrors: 0,
  startTime: new Date().toISOString(),
  lastUpdateTime: new Date().toISOString(),
  lensDistribution: {
    L0: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, L7: 0, L8: 0, L9: 0, L10: 0,
  },
  isRunning: false,
};

class SimpleRulesLensDetection {
  /**
   * Simple lens detection based on Contact data
   */
  static detect(contact: any): { primaryLens: string; confidence: number } {
    let score: Record<string, number> = {};
    "L0 L1 L2 L3 L4 L5 L6 L7 L8 L9 L10".split(" ").forEach(l => score[l] = 0);

    // L0: Inactive (부재중)
    if (contact.lastContactDate) {
      const daysSinceContact = Math.floor((Date.now() - new Date(contact.lastContactDate).getTime()) / (24*60*60*1000));
      if (daysSinceContact > 365) score["L0"] += 3;
      else if (daysSinceContact > 180) score["L0"] += 2;
      else if (daysSinceContact > 90) score["L0"] += 1;
    }

    // L1: Price objection
    if (contact.notes && contact.notes.toLowerCase().includes("price")) score["L1"] += 3;
    if (contact.notes && contact.notes.toLowerCase().includes("비용")) score["L1"] += 3;

    // L2: Anxiety / preparation
    if (contact.notes && (contact.notes.toLowerCase().includes("complicated") || contact.notes.toLowerCase().includes("복잡"))) {
      score["L2"] += 2;
    }

    // L3: Differentiation / competitive
    if (contact.notes && contact.notes.toLowerCase().includes("competitor")) score["L3"] += 2;

    // L5: Self-projection / medical
    if (contact.source === "MEDICAL" || contact.tags?.includes("medical")) score["L5"] += 2;

    // L6: Loss aversion / timing
    if (contact.source === "PROMO" || contact.source === "LIMITED") score["L6"] += 2;

    // L7: Companion / family
    if (contact.groupId) score["L7"] += 1;

    // L8: Repurchase
    if (contact.totalPurchases && contact.totalPurchases > 1) score["L8"] += 2;

    // L10: Immediate purchase
    if (contact.source === "HOTLEAD" || contact.tags?.includes("high_intent")) score["L10"] += 3;

    // Find primary lens
    const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const primaryLens = sorted[0][0];
    const confidence = Math.min(100, Math.round((sorted[0][1] / 3) * 20)); // 0-100 score

    return { primaryLens, confidence };
  }
}

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  let status: MigrationStatus = DEFAULT_STATUS;

  try {
    // Load existing status
    if (fs.existsSync(STATUS_FILE)) {
      const data = fs.readFileSync(STATUS_FILE, "utf-8");
      status = JSON.parse(data);
      console.log(`Resuming from: ${status.lastProcessedId || "start"} (${status.totalProcessed} processed)`);
    }

    status.isRunning = true;
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));

    // Get total count
    const totalContacts = await prisma.contact.count();
    console.log(`Total contacts to process: ${totalContacts}`);

    let processed = 0;
    let lastId = status.lastProcessedId;

    // Process in batches
    while (processed < totalContacts) {
      const contacts = await prisma.contact.findMany({
        where: lastId ? { id: { gt: lastId } } : {},
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
      });

      if (!contacts.length) break;

      // Process contacts in parallel batches
      for (let i = 0; i < contacts.length; i += PARALLEL_LIMIT) {
        const batch = contacts.slice(i, i + PARALLEL_LIMIT);

        await Promise.all(batch.map(async (contact) => {
          try {
            const { primaryLens, confidence } = SimpleRulesLensDetection.detect(contact);

            // Create or update classification
            await prisma.contactLensClassification.upsert({
              where: {
                organizationId_contactId_lensType: {
                  organizationId: contact.organizationId,
                  contactId: contact.id,
                  lensType: primaryLens,
                }
              },
              create: {
                organizationId: contact.organizationId,
                contactId: contact.id,
                lensType: primaryLens,
                lensLabel: `Lens ${primaryLens}`,
                confidenceScore: confidence,
                identificationMethod: "BATCH_MIGRATION",
                status: "ACTIVE",
              },
              update: {
                confidenceScore: confidence,
                lastUpdated: new Date(),
              }
            });

            status.lensDistribution[primaryLens] = (status.lensDistribution[primaryLens] || 0) + 1;
            status.totalProcessed++;
            lastId = contact.id;

            if (status.totalProcessed % 100 === 0) {
              console.log(`Progress: ${status.totalProcessed}/${totalContacts} (${primaryLens})`);
              fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
            }
          } catch (err) {
            status.totalErrors++;
            console.error(`Error processing contact ${contact.id}: ${err}`);
          }
        }));
      }
    }

    status.isRunning = false;
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));

    console.log("\n========== MIGRATION COMPLETE ==========");
    console.log(`Total processed: ${status.totalProcessed}`);
    console.log(`Total errors: ${status.totalErrors}`);
    console.log(`Success rate: ${((status.totalProcessed - status.totalErrors) / status.totalProcessed * 100).toFixed(2)}%`);
    console.log("\nLens distribution:");
    Object.entries(status.lensDistribution).forEach(([lens, count]) => {
      console.log(`  ${lens}: ${count}`);
    });

  } finally {
    await prisma.$disconnect();
  }
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
