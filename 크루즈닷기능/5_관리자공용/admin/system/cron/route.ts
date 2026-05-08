// app/api/admin/system/cron/route.ts
// Cron 작업 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';
import { logger } from '@/lib/logger';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });
    return session?.User?.role === 'admin' || false;
  } catch {
    return false;
  }
}

// GET: Cron 작업 상태 확인
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!(await checkAdminAuth(sid))) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    try {
      // 현재 등록된 Cron 작업 확인
      const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
      const cronJobs = stdout.split('\n').filter(line => 
        line.trim() && 
        !line.startsWith('#') && 
        line.includes('update:dashboard-stats')
      );

      const isRegistered = cronJobs.length > 0;
      const cronJob = cronJobs[0] || '';

      // 로그 파일 확인
      const logPath = join(process.cwd(), 'logs', 'dashboard-stats.log');
      let lastRun: string | null = null;
      let logExists = false;

      if (existsSync(logPath)) {
        logExists = true;
        try {
          const logContent = await readFile(logPath, 'utf-8');
          const lines = logContent.split('\n').filter(l => l.trim());
          if (lines.length > 0) {
            // 마지막 로그 라인에서 시간 추출 시도
            const lastLine = lines[lines.length - 1];
            // 간단한 시간 추출 (실제 로그 형식에 맞게 수정 필요)
            lastRun = lastLine.substring(0, 50); // 처음 50자만
          }
        } catch (logError) {
          logger.error('[Cron API] Log read error:', logError);
        }
      }

      return NextResponse.json({
        ok: true,
        registered: isRegistered,
        cronJob: cronJob || null,
        logExists,
        lastRun,
        message: isRegistered 
          ? 'Cron 작업이 등록되어 있습니다.' 
          : 'Cron 작업이 등록되지 않았습니다.',
      });
    } catch (error: any) {
      // crontab이 없는 경우도 처리
      return NextResponse.json({
        ok: true,
        registered: false,
        cronJob: null,
        logExists: false,
        lastRun: null,
        message: 'Cron 작업을 확인할 수 없습니다. (crontab 명령어 사용 불가)',
        error: error.message,
      });
    }
  } catch (error: any) {
    logger.error('[Cron API] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// POST: Cron 작업 등록/삭제
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!(await checkAdminAuth(sid))) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { action } = await req.json();

    if (action === 'register') {
      // Cron 작업 등록
      const PROJECT_DIR = process.cwd();
      const CRON_JOB = `0 * * * * cd ${PROJECT_DIR} && npm run update:dashboard-stats >> ${PROJECT_DIR}/logs/dashboard-stats.log 2>&1`;

      try {
        // 로그 디렉토리 생성
        const logsDir = join(PROJECT_DIR, 'logs');
        if (!existsSync(logsDir)) {
          await mkdir(logsDir, { recursive: true });
        }

        // 기존 crontab 가져오기
        let existingCron = '';
        try {
          const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
          existingCron = stdout;
        } catch {
          // crontab이 없는 경우 무시
        }

        // dashboard-stats 관련 기존 작업 제거
        const filteredCron = existingCron
          .split('\n')
          .filter(line => !line.includes('update:dashboard-stats'))
          .join('\n')
          .trim();

        // 새 작업 추가
        const newCron = filteredCron 
          ? `${filteredCron}\n${CRON_JOB}\n`
          : `${CRON_JOB}\n`;

        // 임시 파일에 저장
        const tempFile = join(PROJECT_DIR, '.crontab.tmp');
        await writeFile(tempFile, newCron, 'utf-8');

        // crontab에 적용
        await execAsync(`crontab ${tempFile}`);
        
        // 임시 파일 삭제
        await execAsync(`rm -f ${tempFile}`);

        logger.log('[Cron API] Cron 작업 등록 완료');

        return NextResponse.json({
          ok: true,
          message: 'Cron 작업이 성공적으로 등록되었습니다.',
          cronJob: CRON_JOB,
        });
      } catch (error: any) {
        logger.error('[Cron API] 등록 오류:', error);
        return NextResponse.json({
          ok: false,
          error: `Cron 작업 등록 실패: ${error.message}`,
        }, { status: 500 });
      }
    } else if (action === 'unregister') {
      // Cron 작업 삭제
      try {
        const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
        const filteredCron = stdout
          .split('\n')
          .filter(line => !line.includes('update:dashboard-stats'))
          .join('\n')
          .trim();

        if (filteredCron) {
          const tempFile = join(process.cwd(), '.crontab.tmp');
          await writeFile(tempFile, filteredCron + '\n', 'utf-8');
          await execAsync(`crontab ${tempFile}`);
          await execAsync(`rm -f ${tempFile}`);
        } else {
          // 모든 작업 삭제
          await execAsync('crontab -r 2>/dev/null || true');
        }

        logger.log('[Cron API] Cron 작업 삭제 완료');

        return NextResponse.json({
          ok: true,
          message: 'Cron 작업이 삭제되었습니다.',
        });
      } catch (error: any) {
        logger.error('[Cron API] 삭제 오류:', error);
        return NextResponse.json({
          ok: false,
          error: `Cron 작업 삭제 실패: ${error.message}`,
        }, { status: 500 });
      }
    } else if (action === 'test') {
      // 테스트 실행
      try {
        const { stdout, stderr } = await execAsync('npm run update:dashboard-stats', {
          cwd: process.cwd(),
          timeout: 60000, // 60초 타임아웃
        });

        return NextResponse.json({
          ok: true,
          message: '통계 업데이트가 성공적으로 실행되었습니다.',
          output: stdout,
          error: stderr || null,
        });
      } catch (error: any) {
        logger.error('[Cron API] 테스트 실행 오류:', error);
        return NextResponse.json({
          ok: false,
          error: `실행 실패: ${error.message}`,
          output: error.stdout || '',
          stderr: error.stderr || '',
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        ok: false,
        error: '잘못된 action입니다. (register, unregister, test)',
      }, { status: 400 });
    }
  } catch (error: any) {
    logger.error('[Cron API] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}


