export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * 파트너 기능 검증 API (테스트용)
 * GET /api/partner/test - Partner 테이블 존재 여부 및 기본 검증
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 1. Partner 테이블이 존재하는지 확인
    const tableExists = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT EXISTS(
          SELECT FROM information_schema.tables
          WHERE table_name = 'Partner'
        ) as exists
      `
    );

    // 2. PartnerMetrics 테이블 확인
    const metricsTableExists = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT EXISTS(
          SELECT FROM information_schema.tables
          WHERE table_name = 'PartnerMetrics'
        ) as exists
      `
    );

    // 3. Contact 테이블의 partnerId 컬럼 확인
    const partnerIdColumnExists = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT EXISTS(
          SELECT FROM information_schema.columns
          WHERE table_name = 'Contact' AND column_name = 'partnerId'
        ) as exists
      `
    );

    // 4. Partner 인덱스 확인
    const partnerIndexes = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'Partner'
      `
    );

    // 5. 기본 데이터 생성 테스트 (선택사항)
    let testPartner = null;
    try {
      testPartner = await prisma.partner.create({
        data: {
          organizationId: orgId,
          name: '테스트파트너_' + Date.now(),
          email: 'test@example.com',
          phone: '01012345678',
          commissionRate: new Prisma.Decimal('10.50'),
        },
      });
    } catch (err) {
      // 중복 방지 또는 다른 오류 무시
    }

    return NextResponse.json({
      ok: true,
      validation: {
        partner_table_exists: tableExists[0]?.exists || false,
        partner_metrics_table_exists: metricsTableExists[0]?.exists || false,
        contact_partnerId_column_exists: partnerIdColumnExists[0]?.exists || false,
        partner_indexes: partnerIndexes?.map((idx: any) => idx.indexname) || [],
        test_partner_created: testPartner ? {
          id: testPartner.id,
          name: testPartner.name,
          message: '테스트 파트너 생성 성공',
        } : null,
      },
      message: '파트너 기능 검증 완료',
    });
  } catch (err) {
    logger.error('[GET /api/partner/test]', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
