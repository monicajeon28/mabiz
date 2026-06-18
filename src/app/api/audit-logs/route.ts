/**
 * GET /api/audit-logs
 * POST /api/audit-logs/export
 *
 * 감사 로그 조회 및 내보내기 (관리자만)
 * - 액션, 리소스, 상태, 사용자 기준 필터링
 * - 페이지네이션 지원
 * - CSV 내보내기 지원
 */

import { NextResponse } from 'next/server';
import { getAuditLogs, getAuditStats, getResourceAuditTrail } from '@/lib/audit-logger';
import { getAuthContext } from '@/lib/rbac';

export async function GET(request: Request) {
  try {
    // 인증 확인
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 더미 user 객체 (하위 코드 호환)
    const user = { id: ctx.userId, role: ctx.role, organizationId: ctx.organizationId };

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') as any;
    const resource = searchParams.get('resource') as any;
    const status = searchParams.get('status') as any;
    const userId = searchParams.get('userId') ?? undefined;
    const resourceId = searchParams.get('resourceId') ?? undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // 날짜 파싱
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // 조회
    const result = await getAuditLogs({
      organizationId: user.organizationId || '',
      action,
      resource,
      status,
      userId: userId,
      resourceId: resourceId,
      startDate,
      endDate,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[AuditLog API] 오류:', error);
    return NextResponse.json(
      { error: '감사 로그 조회 실패' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit-logs/export
 * CSV 내보내기
 */
export async function POST(request: Request) {
  try {
    // 인증 확인
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const user = { id: ctx.userId, role: ctx.role, organizationId: ctx.organizationId };

    const body = await request.json();
    const { action, resource, status, startDate, endDate } = body;

    // 전체 로그 조회 (페이지네이션 없음)
    const result = await getAuditLogs({
      organizationId: user.organizationId || '',
      action,
      resource,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: 1,
      limit: 10000, // 최대 10,000개
    });

    // CSV 생성
    const headers = ['ID', '사용자ID', '액션', '리소스유형', '상태', '소요시간(ms)', '생성일시'];
    const rows = result.logs.map(log => [
      log.id.toString(),
      log.userId ?? '-',
      log.action,
      log.resourceType,
      log.status,
      log.durationMs?.toString() || '-',
      new Date(log.createdAt).toLocaleString('ko-KR'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // UTF-8 BOM 추가 (Excel 한글 호환)
    const bom = '﻿';
    const csvWithBom = bom + csv;

    return new Response(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('[AuditLog Export] 오류:', error);
    return NextResponse.json(
      { error: 'CSV 내보내기 실패' },
      { status: 500 }
    );
  }
}
