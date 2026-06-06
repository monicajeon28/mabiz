/**
 * 🔍 일일 컴플라이언스 상태 확인
 * Cron: 매일 10:00 AM
 *
 * 실시간 모니터링:
 * - 미충족된 컴플라이언스 체크항목
 * - DPA 만료일 확인
 * - 미처리 삭제 요청
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { complianceChecker } from '@/lib/compliance/compliance-checker';
import { auditLogger } from '@/lib/compliance/audit-logger';

export async function GET(req: NextRequest) {
  try {
    // Cron secret 검증
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 모든 활성 조직 조회
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
    });

    const alerts = [];

    for (const org of organizations) {
      try {
        // 컴플라이언스 체크
        const result = await complianceChecker.checkOrganizationCompliance(
          org.id
        );

        // AT_RISK 또는 NON_COMPLIANT 상태 감지
        if (result.status !== 'COMPLIANT') {
          const alert = {
            organizationId: org.id,
            organizationName: org.name,
            status: result.status,
            score: result.overall.complianceScore,
            issues: result.gdpr.issues.concat(
              result.ccpa.issues,
              result.korean.issues
            ),
            actions: result.overall.recommendedActions,
            timestamp: new Date().toISOString(),
          };

          alerts.push(alert);

          // 심각한 수준의 로그 기록
          logger.warn(`🚨 Compliance Issue Detected: ${result.status}`, {
            organizationId: org.id,
            organizationName: org.name,
            score: result.overall.complianceScore,
            issueCount: alert.issues.length,
          });

          // 감시 로그 기록
          await auditLogger.record({
            organizationId: org.id,
            action: 'READ',
            resourceType: 'Document',
            status: 'SUCCESS',
            purpose: 'Compliance',
            reasonDescription: `컴플라이언스 경고: ${result.status} (점수: ${result.overall.complianceScore}%)`,
          });

          // 관리자에게 알림 (향후 구현)
          // await notifyAdmins(org.id, alert);
        }

        // 미처리 삭제 요청 확인
        const pendingDeletions = await prisma.dataDeletionRequest.count({
          where: {
            organizationId: org.id,
            status: 'PENDING_DELETION',
          },
        });

        if (pendingDeletions > 0) {
          logger.info('📋 Pending Deletion Requests', {
            organizationId: org.id,
            count: pendingDeletions,
          });
        }

        // 과거 30일 동안의 PII 접근 이상 탐지
        const piiAccessCount = await prisma.auditLog.count({
          where: {
            organizationId: org.id,
            action: 'READ',
            piiFieldsAccessed: { isEmpty: false },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        });

        if (piiAccessCount > 1000) {
          logger.warn('🚨 High PII Access Volume Detected', {
            organizationId: org.id,
            accessCount: piiAccessCount,
            period: '30 days',
          });
        }
      } catch (error) {
        logger.error('❌ Compliance Check Failed', {
          organizationId: org.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('✅ Daily Compliance Status Check Complete', {
      totalOrganizations: organizations.length,
      alertsGenerated: alerts.length,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalOrganizations: organizations.length,
      alertCount: alerts.length,
      alerts: alerts.slice(0, 10), // 최대 10개 경고만 반환
    });
  } catch (error) {
    logger.error('❌ Daily Compliance Check Failed', {
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
