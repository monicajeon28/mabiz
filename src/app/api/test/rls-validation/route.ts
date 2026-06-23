/**
 * RLS 정책 검증 API
 *
 * 엔드포인트: GET /api/test/rls-validation
 *
 * 사용:
 * curl "http://localhost:3000/api/test/rls-validation?table=Contact&role=AGENT"
 *
 * 반환 예시:
 * {
 *   "table": "Contact",
 *   "role": "AGENT",
 *   "status": "✅ 정책 적용됨",
 *   "selectAllowed": true,
 *   "selectDenied": false,
 *   "message": "AGENT는 소속 조직 데이터만 조회 가능"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSupabaseEnv, getSupabaseServerClientAsRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // 환경변수 검증 (선택적 - Production에서 필요 없음)
    if (process.env.NODE_ENV === 'development') {
      validateSupabaseEnv();
    }

    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table') || 'Contact';
    const role = (searchParams.get('role') || 'AGENT') as
      | 'GLOBAL_ADMIN'
      | 'AGENT'
      | 'BRANCH_MANAGER'
      | 'CUSTOMER';

    const results: any = {
      table,
      role,
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        total: 0,
      },
      timestamp: new Date().toISOString(),
    };

    // Test 1: SELECT 권한 확인
    try {
      const client = getSupabaseServerClientAsRole(role, 'test-user-123');
      const { data, error, status } = await (client as any)
        .from(table)
        .select('count', { count: 'exact', head: true });

      results.tests.push({
        name: `SELECT from ${table}`,
        role,
        status: error ? 'DENIED' : 'ALLOWED',
        code: status,
        message: error?.message || '조회 가능',
        allowed: !error,
      });

      results.summary.total++;
      if (!error) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    } catch (err: any) {
      results.tests.push({
        name: `SELECT from ${table}`,
        role,
        status: 'ERROR',
        message: err.message,
        allowed: false,
      });
      results.summary.total++;
      results.summary.failed++;
    }

    // Test 2: 역할별 기대값 검증
    const roleExpectations: Record<string, Record<string, boolean>> = {
      GLOBAL_ADMIN: { selectAllowed: true, insertAllowed: true },
      AGENT: { selectAllowed: true, insertAllowed: true },
      BRANCH_MANAGER: { selectAllowed: true, insertAllowed: true },
      CUSTOMER: { selectAllowed: false, insertAllowed: false },
    };

    const testResult = results.tests[0];
    const expected = roleExpectations[role];

    if (expected) {
      const isCorrect = testResult.allowed === expected.selectAllowed;
      results.validation = {
        role,
        expected: expected.selectAllowed,
        actual: testResult.allowed,
        correct: isCorrect,
        message: isCorrect
          ? `✅ ${role}의 권한이 올바르게 설정됨`
          : `❌ ${role}의 권한이 예상과 다름`,
      };
    }

    // 응답 포맷 (터미널 친화적)
    console.log(`\n[RLS Validation] ${table} - ${role}`);
    console.log(`Status: ${results.validation?.message}`);
    console.log(`Passed: ${results.summary.passed}/${results.summary.total}`);
    console.log(`Tests: ${JSON.stringify(results.tests, null, 2)}`);

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('[RLS Validation Error]', error);
    return NextResponse.json(
      {
        error: error.message,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * 전체 테이블 검증 (POST)
 *
 * 요청:
 * POST /api/test/rls-validation
 * {
 *   "tables": ["Contact", "Organization", "ContactGroup"],
 *   "roles": ["GLOBAL_ADMIN", "AGENT"]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    validateSupabaseEnv();

    const body = await request.json();
    const tables = body.tables || [
      'Contact',
      'Organization',
      'ContactGroup',
      'Document',
      'Partner',
    ];
    const roles = body.roles || [
      'GLOBAL_ADMIN',
      'AGENT',
      'BRANCH_MANAGER',
      'CUSTOMER',
    ];

    const results: any = {
      tables,
      roles,
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        total: 0,
      },
      timestamp: new Date().toISOString(),
    };

    // 모든 조합 테스트
    for (const table of tables) {
      for (const role of roles) {
        try {
          const client = getSupabaseServerClientAsRole(
            role as any,
            'test-user-123'
          );
          const { error, status } = await (client as any)
            .from(table)
            .select('count', { count: 'exact', head: true });

          const testCase = {
            table,
            role,
            status: error ? 'DENIED' : 'ALLOWED',
            code: status,
            message: error?.message || '정책 적용됨',
            passed: !error,
          };

          results.tests.push(testCase);
          results.summary.total++;

          if (!error) {
            results.summary.passed++;
          } else {
            results.summary.failed++;
          }
        } catch (err: any) {
          results.tests.push({
            table,
            role,
            status: 'ERROR',
            message: err.message,
            passed: false,
          });
          results.summary.total++;
          results.summary.failed++;
        }
      }
    }

    // 요약 출력
    console.log(`\n[RLS Validation Summary]`);
    console.log(`Total Tests: ${results.summary.total}`);
    console.log(`Passed: ${results.summary.passed}`);
    console.log(`Failed: ${results.summary.failed}`);
    console.log(`Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('[RLS Validation Error]', error);
    return NextResponse.json(
      {
        error: error.message,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
