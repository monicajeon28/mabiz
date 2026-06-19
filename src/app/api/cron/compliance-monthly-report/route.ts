/**
 * 📋 월간 컴플라이언스 리포트 생성
 * Cron: 매월 1일 9:00 AM
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { complianceChecker } from '@/lib/compliance/compliance-checker';
import { auditLogger } from '@/lib/compliance/audit-logger';

export async function GET(req: NextRequest) {
  try {
    // Cron secret 검증
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 모든 활성 조직 조회
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
    });

    const results = [];

    for (const org of organizations) {
      try {
        // 컴플라이언스 검사 실행
        const complianceResult = await complianceChecker.checkOrganizationCompliance(
          org.id
        );

        // 리포트 저장
        await complianceChecker.saveComplianceReport(org.id, complianceResult);

        // 감시 로그 기록
        await auditLogger.record({
          organizationId: org.id,
          action: 'READ',
          resourceType: 'Document',
          status: 'SUCCESS',
          purpose: 'Compliance',
          reasonDescription: `월간 컴플라이언스 리포트 생성: ${complianceResult.status}`,
        });

        results.push({
          organizationId: org.id,
          organizationName: org.name,
          status: complianceResult.status,
          score: complianceResult.overall.complianceScore,
          issueCount: complianceResult.gdpr.issues.length +
            complianceResult.ccpa.issues.length +
            complianceResult.korean.issues.length,
          recommendationCount: complianceResult.overall.recommendedActions.length,
        });

        logger.info('✅ Compliance Report Generated', {
          organizationId: org.id,
          organizationName: org.name,
          status: complianceResult.status,
          score: complianceResult.overall.complianceScore,
        });
      } catch (error) {
        logger.error('❌ Compliance Check Failed for Organization', {
          organizationId: org.id,
          organizationName: org.name,
          error: error instanceof Error ? error.message : String(error),
        });

        results.push({
          organizationId: org.id,
          organizationName: org.name,
          status: 'ERROR',
          error: '처리 중 오류 발생',
        });
      }
    }

    logger.info('✅ Monthly Compliance Report Process Complete', {
      totalOrganizations: organizations.length,
      successCount: results.filter(r => r.status !== 'ERROR').length,
      failureCount: results.filter(r => r.status === 'ERROR').length,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalOrganizations: organizations.length,
      results,
    });
  } catch (error) {
    logger.error('❌ Monthly Compliance Report Process Failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다.',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
