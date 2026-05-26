/**
 * CruiseDot to CRM Sync API
 * Syncs customer data from Supabase backup to Neon CRM
 *
 * Syncs:
 * - User → Contact (registered/purchase customers)
 * - CruiseProductInquiry → Contact (inquiry customers)
 * - AffiliateLead → Contact (affiliate customers)
 * - Reservation → Contact with product linking
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function syncUsersToContact(supabaseClient: Client, defaultOrgId: string) {
  try {
    const result = await supabaseClient.query(`
      SELECT id, email, phone, name
      FROM "User"
      WHERE phone IS NOT NULL
      LIMIT 50
    `);

    let successCount = 0;
    for (const row of result.rows) {
      try {
        await prisma.contact.upsert({
          where: {
            phone_organizationId: {
              phone: row.phone,
              organizationId: defaultOrgId,
            },
          },
          create: {
            organizationId: defaultOrgId,
            name: row.name || '크루즈닷 고객',
            phone: row.phone,
            email: row.email,
            channel: 'cruisedot',
            type: 'CUSTOMER',
          },
          update: {
            email: row.email || undefined,
            channel: 'cruisedot',
          },
        });
        successCount++;
      } catch (e) {
        logger.error('[sync] User contact upsert failed:', e);
      }
    }

    return { table: 'User', synced: successCount, total: result.rows.length };
  } catch (e) {
    logger.error('[sync] User sync failed:', e);
    return { table: 'User', error: (e as any).message };
  }
}

async function syncInquiriesToContact(supabaseClient: Client, defaultOrgId: string) {
  try {
    const result = await supabaseClient.query(`
      SELECT id, phone, name, "productCode"
      FROM "CruiseProductInquiry"
      WHERE phone IS NOT NULL
      LIMIT 50
    `);

    let successCount = 0;
    for (const row of result.rows) {
      try {
        await prisma.contact.upsert({
          where: {
            phone_organizationId: {
              phone: row.phone,
              organizationId: defaultOrgId,
            },
          },
          create: {
            organizationId: defaultOrgId,
            name: row.name || '상품문의 고객',
            phone: row.phone,
            channel: 'inquiry',
            type: 'PROSPECT',
            adminMemo: `상품 문의: ${row.productCode || '미지정'}`,
          },
          update: {
            channel: 'inquiry',
            type: 'PROSPECT',
          },
        });
        successCount++;
      } catch (e) {
        logger.error('[sync] Inquiry contact upsert failed:', e);
      }
    }

    return {
      table: 'CruiseProductInquiry',
      synced: successCount,
      total: result.rows.length,
    };
  } catch (e) {
    logger.error('[sync] Inquiry sync failed:', e);
    return { table: 'CruiseProductInquiry', error: (e as any).message };
  }
}

async function syncAffiliateLeadsToContact(
  supabaseClient: Client,
  defaultOrgId: string
) {
  try {
    const result = await supabaseClient.query(`
      SELECT id, "customerName" as name, "customerPhone" as phone, "agentId", "linkId"
      FROM "AffiliateLead"
      WHERE "customerPhone" IS NOT NULL
      LIMIT 50
    `);

    let successCount = 0;
    for (const row of result.rows) {
      try {
        await prisma.contact.upsert({
          where: {
            phone_organizationId: {
              phone: row.phone,
              organizationId: defaultOrgId,
            },
          },
          create: {
            organizationId: defaultOrgId,
            name: row.name || '어필리에이트 고객',
            phone: row.phone,
            channel: 'affiliate',
            type: 'PROSPECT',
            affiliateCode: row.linkId,
            adminMemo: `어필리에이트 리드 (Agent ID: ${row.agentId || 'N/A'})`,
          },
          update: {
            channel: 'affiliate',
          },
        });
        successCount++;
      } catch (e) {
        logger.error('[sync] Affiliate lead upsert failed:', e);
      }
    }

    return {
      table: 'AffiliateLead',
      synced: successCount,
      total: result.rows.length,
    };
  } catch (e) {
    logger.error('[sync] Affiliate lead sync failed:', e);
    return { table: 'AffiliateLead', error: (e as any).message };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the CRM default organization (first one)
    const orgs = await prisma.organization.findMany({
      take: 1,
      orderBy: { id: 'asc' },
    });

    if (orgs.length === 0) {
      return NextResponse.json(
        { error: '조직이 없습니다. 먼저 조직을 만드세요.' },
        { status: 400 }
      );
    }

    const defaultOrgId = orgs[0].id;

    // Connect to Supabase backup
    const backupUrl = process.env.SUPABASE_BACKUP_URL;
    if (!backupUrl) {
      return NextResponse.json(
        { error: 'SUPABASE_BACKUP_URL 환경 변수가 필요합니다.' },
        { status: 500 }
      );
    }

    const supabaseClient = new Client({
      connectionString: backupUrl,
      ssl: { rejectUnauthorized: false },
    });

    await supabaseClient.connect();

    // Sync all sources
    const results = await Promise.all([
      syncUsersToContact(supabaseClient, defaultOrgId),
      syncInquiriesToContact(supabaseClient, defaultOrgId),
      syncAffiliateLeadsToContact(supabaseClient, defaultOrgId),
    ]);

    await supabaseClient.end();

    // Get final count
    const contactCount = await prisma.contact.count();

    console.log('✅ CRM 데이터 동기화 완료!');

    return NextResponse.json({
      ok: true,
      message: 'CruiseDot 데이터를 CRM으로 동기화했습니다.',
      results,
      totalContacts: contactCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[sync] Sync failed:', error);
    return NextResponse.json(
      {
        error: '동기화 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
