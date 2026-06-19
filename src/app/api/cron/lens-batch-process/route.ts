import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { detectCustomerLensesBatch } from '@/lib/customers/lens-detector';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_SIZE = 50;
const STALE_DAYS = 7;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const tokenBuf = Buffer.from(token, 'utf8');
  const secretBuf = Buffer.from(cronSecret, 'utf8');
  if (
    tokenBuf.byteLength !== secretBuf.byteLength ||
    !timingSafeEqual(tokenBuf, secretBuf)
  ) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  let totalProcessed = 0;
  let totalUpserted = 0;
  let totalErrors = 0;

  try {
    // Find contacts with no recent lens classification
    const staleContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { contactLensClassifications: { none: {} } },
          {
            contactLensClassifications: {
              every: { lastUpdated: { lt: staleThreshold } },
            },
          },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        lastContactedAt: true,
        tags: true,
        optOutAt: true,
        lensMetadata: true,
      },
      take: BATCH_SIZE * 10, // process up to 500 contacts per run
    });

    logger.log('[lens-batch-process] contacts to process', { count: staleContacts.length });

    // Group by org
    const byOrg = new Map<string, typeof staleContacts>();
    for (const c of staleContacts) {
      const list = byOrg.get(c.organizationId) ?? [];
      list.push(c);
      byOrg.set(c.organizationId, list);
    }

    for (const [orgId, contacts] of byOrg) {
      // Process in batches of BATCH_SIZE
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE) as any[];
        try {
          const results = await detectCustomerLensesBatch(batch, orgId);

          for (const contact of batch) {
            const lenses = results[contact.id] ?? [];
            if (lenses.length === 0) continue;

            // Upsert top lens classification
            const topLens = lenses[0];
            await prisma.contactLensClassification.upsert({
              where: {
                organizationId_contactId_lensType: {
                  organizationId: orgId,
                  contactId: contact.id,
                  lensType: topLens.lensType,
                },
              },
              update: {
                confidenceScore: topLens.confidenceScore,
                readinessScore: topLens.readinessScore,
                lensLabel: topLens.label,
                identificationMethod: topLens.detectionMethod,
                status: 'ACTIVE',
              },
              create: {
                organizationId: orgId,
                contactId: contact.id,
                lensType: topLens.lensType,
                lensLabel: topLens.label,
                confidenceScore: topLens.confidenceScore,
                readinessScore: topLens.readinessScore,
                identificationMethod: topLens.detectionMethod,
                status: 'ACTIVE',
              },
            });
            totalUpserted++;
          }
          totalProcessed += batch.length;
        } catch (batchErr) {
          logger.error('[lens-batch-process] batch error', {
            orgId,
            error: batchErr instanceof Error ? batchErr.message : String(batchErr),
          });
          totalErrors++;
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.log('[lens-batch-process] done', { totalProcessed, totalUpserted, totalErrors, duration });

    return NextResponse.json({
      ok: true,
      totalProcessed,
      totalUpserted,
      totalErrors,
      durationMs: duration,
    });
  } catch (err) {
    logger.error('[lens-batch-process] fatal error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
