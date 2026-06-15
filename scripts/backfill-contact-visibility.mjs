#!/usr/bin/env node
/**
 * Backfill Contact visibility/createdBy/managerId fields
 *
 * Purpose:
 *   - Set visibility = 'SHARED' for all existing contacts (default)
 *   - Set createdBy = assignedUserId where available
 *   - Set managerId = NULL (manual assignment later)
 *
 * Usage:
 *   node scripts/backfill-contact-visibility.mjs
 *
 * Prerequisites:
 *   - Database must have visibility/createdBy/managerId columns (from migration)
 *   - POSTGRESQL_URL or DATABASE_URL env var must be set
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

async function backfillContactVisibility() {
  console.log('[Backfill] Starting Contact visibility backfill...');

  try {
    // Step 1: Count total contacts
    const totalContacts = await prisma.contact.count();
    console.log(`[Backfill] Total contacts to process: ${totalContacts}`);

    // Step 2: Batch process contacts
    let processed = 0;
    let batches = Math.ceil(totalContacts / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const skip = i * BATCH_SIZE;

      // Fetch batch
      const contactBatch = await prisma.contact.findMany({
        skip,
        take: BATCH_SIZE,
        select: {
          id: true,
          organizationId: true,
          assignedUserId: true,
          visibility: true,
          createdBy: true,
          managerId: true,
        },
      });

      // Build bulk update payload
      const updates = contactBatch
        .filter(c => c.createdBy === null || c.visibility === null)
        .map(c => ({
          where: { id: c.id },
          data: {
            visibility: c.visibility || 'SHARED',
            createdBy: c.createdBy || c.assignedUserId || null,
            managerId: c.managerId || null,
          },
        }));

      // Execute batch updates
      if (updates.length > 0) {
        for (const update of updates) {
          await prisma.contact.update(update);
        }
        processed += updates.length;
        console.log(`[Backfill] Processed ${processed}/${totalContacts} contacts (${Math.round((processed/totalContacts)*100)}%)`);
      }
    }

    // Step 3: Verify results
    const nullVisibilityCount = await prisma.contact.count({
      where: { visibility: null },
    });

    const nullCreatedByCount = await prisma.contact.count({
      where: {
        createdBy: null,
        assignedUserId: { not: null },
      },
    });

    console.log(`\n[Backfill] Verification:
  - Contacts with null visibility: ${nullVisibilityCount}
  - Contacts with null createdBy (but have assignedUserId): ${nullCreatedByCount}
  - Total updated: ${processed}`);

    if (nullVisibilityCount === 0) {
      console.log('[Backfill] ✅ All contacts have visibility set');
    } else {
      console.warn(`[Backfill] ⚠️ ${nullVisibilityCount} contacts still have null visibility`);
    }

    console.log('[Backfill] Backfill completed successfully');

  } catch (error) {
    console.error('[Backfill] Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run backfill
backfillContactVisibility().catch(err => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
