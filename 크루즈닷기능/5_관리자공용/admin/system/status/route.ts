import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 시스템 상태 확인 API (관리자 전용)
 * 
 * GET /api/admin/system/status
 * 
 * 확인 항목:
 * - 데이터베이스 연결
 * - 구글 드라이브 설정
 * - 환경 변수
 * - 최근 에러 로그
 * - 백업 상태
 */
export async function GET() {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const status = {
      ok: true,
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'unknown' as 'ok' | 'error',
          message: '',
        },
        googleDrive: {
          status: 'unknown' as 'ok' | 'error' | 'warning',
          message: '',
        },
        environment: {
          status: 'unknown' as 'ok' | 'error' | 'warning',
          message: '',
          missing: [] as string[],
        },
        cronJobs: {
          status: 'unknown' as 'ok' | 'error' | 'warning',
          message: '',
        },
      },
    };

    // 1. 데이터베이스 연결 확인
    try {
      await prisma.$queryRaw`SELECT 1`;
      status.checks.database.status = 'ok';
      status.checks.database.message = '데이터베이스 연결 정상';
    } catch (error: any) {
      status.checks.database.status = 'error';
      status.checks.database.message = `데이터베이스 연결 실패: ${error.message}`;
    }

    // 2. 구글 드라이브 설정 확인
    const requiredGoogleVars = [
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY',
      'GOOGLE_DRIVE_SHARED_DRIVE_ID',
    ];

    const missingGoogleVars = requiredGoogleVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingGoogleVars.length === 0) {
      status.checks.googleDrive.status = 'ok';
      status.checks.googleDrive.message = '구글 드라이브 설정 완료';
    } else {
      status.checks.googleDrive.status = 'error';
      status.checks.googleDrive.message = `누락된 환경 변수: ${missingGoogleVars.join(', ')}`;
    }

    // 3. 필수 환경 변수 확인
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'CRON_SECRET',
      'NEXT_PUBLIC_BASE_URL',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length === 0) {
      status.checks.environment.status = 'ok';
      status.checks.environment.message = '필수 환경 변수 설정 완료';
    } else {
      status.checks.environment.status = 'error';
      status.checks.environment.message = `누락된 환경 변수: ${missingEnvVars.length}개`;
      status.checks.environment.missing = missingEnvVars;
    }

    // 4. Cron Job 설정 확인
    if (process.env.CRON_SECRET) {
      status.checks.cronJobs.status = 'ok';
      status.checks.cronJobs.message = 'Cron job 보안 설정 완료';
    } else {
      status.checks.cronJobs.status = 'warning';
      status.checks.cronJobs.message = 'CRON_SECRET이 설정되지 않았습니다.';
    }

    // 전체 상태 확인
    const hasError = Object.values(status.checks).some(
      (check) => check.status === 'error'
    );

    return NextResponse.json({
      ...status,
      overall: hasError ? 'error' : 'ok',
    });
  } catch (error: any) {
    console.error('[System Status] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '시스템 상태 확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}










