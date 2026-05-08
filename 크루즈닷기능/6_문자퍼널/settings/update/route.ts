export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { updateVercelEnvVariables } from '@/lib/vercel-api';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Admin Settings Update] Auth check error:', error);
    return null;
  }
}

// .env.local 파일 읽기
async function readEnvFile(): Promise<string> {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    return await fs.readFile(envPath, 'utf-8');
  } catch (error) {
    // 파일이 없으면 빈 문자열 반환
    return '';
  }
}

// .env.local 파일 쓰기
async function writeEnvFile(content: string): Promise<void> {
  const envPath = path.join(process.cwd(), '.env.local');
  await fs.writeFile(envPath, content, 'utf-8');
}

// 환경 변수 업데이트
async function updateEnvVariable(key: string, value: string): Promise<void> {
  const envContent = await readEnvFile();
  const lines = envContent.split('\n');
  
  // 기존 변수 찾기
  let found = false;
  const updatedLines = lines.map(line => {
    // 주석이나 빈 줄은 그대로 유지
    if (line.trim().startsWith('#') || line.trim() === '') {
      return line;
    }
    
    // KEY=value 형식 찾기
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const envKey = match[1].trim();
      if (envKey === key) {
        found = true;
        return `${key}=${value}`;
      }
    }
    
    return line;
  });
  
  // 변수가 없으면 추가
  if (!found) {
    updatedLines.push(`${key}=${value}`);
  }
  
  await writeEnvFile(updatedLines.join('\n'));
}

// POST: 환경 변수 업데이트
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const updates = body.updates as Record<string, string>;

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { ok: false, error: '업데이트할 데이터가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 각 환경 변수 업데이트 (로컬 .env.local)
    const updatedKeys: string[] = [];
    const errors: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      try {
        // 빈 값은 건너뛰기 (삭제하지 않음)
        if (value === null || value === undefined || value === '') {
          continue;
        }

        await updateEnvVariable(key, String(value));
        updatedKeys.push(key);
        console.log(`[Admin Settings Update] Updated ${key} in .env.local`);
      } catch (error) {
        const errorMsg = `환경 변수 ${key} 업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        errors.push(errorMsg);
        console.error(`[Admin Settings Update] ${errorMsg}`, error);
      }
    }

    // Vercel 환경변수도 자동 업데이트 시도
    let vercelResult: { ok: boolean; updated: string[]; errors: string[] } | null = null;
    const hasVercelConfig = !!(process.env.VERCEL_API_TOKEN && (process.env.VERCEL_PROJECT_ID || process.env.NEXT_PUBLIC_VERCEL_PROJECT_ID));
    
    if (hasVercelConfig && updatedKeys.length > 0) {
      try {
        console.log('[Admin Settings Update] Updating Vercel environment variables...');
        vercelResult = await updateVercelEnvVariables(
          Object.fromEntries(
            Object.entries(updates).filter(([key]) => updatedKeys.includes(key))
          )
        );
        
        if (vercelResult.ok) {
          console.log(`[Admin Settings Update] Vercel: ${vercelResult.updated.length}개 환경변수 업데이트 완료`);
        } else {
          console.warn(`[Admin Settings Update] Vercel 업데이트 일부 실패:`, vercelResult.errors);
        }
      } catch (error) {
        console.error('[Admin Settings Update] Vercel 업데이트 중 오류:', error);
        vercelResult = {
          ok: false,
          updated: [],
          errors: [`Vercel 업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
        };
      }
    }

    if (errors.length > 0 && updatedKeys.length === 0) {
      return NextResponse.json(
        { ok: false, error: '모든 환경 변수 업데이트에 실패했습니다.', errors },
        { status: 500 }
      );
    }

    // 메시지 구성
    let message = `${updatedKeys.length}개의 환경 변수가 로컬(.env.local)에 업데이트되었습니다.`;
    let warning = '변경사항을 적용하려면 서버를 재시작해야 합니다.';
    
    if (vercelResult) {
      if (vercelResult.updated.length > 0) {
        message += `\nVercel: ${vercelResult.updated.length}개 환경변수 업데이트 완료.`;
        warning = 'Vercel 환경변수는 자동으로 반영되며, 새 배포가 필요할 수 있습니다.';
      }
      if (vercelResult.errors.length > 0) {
        message += `\nVercel 업데이트 경고: ${vercelResult.errors.length}개 실패`;
      }
    } else if (!hasVercelConfig) {
      message += '\n⚠️ Vercel 자동 업데이트를 사용하려면 VERCEL_API_TOKEN과 VERCEL_PROJECT_ID를 설정하세요.';
    }

    return NextResponse.json({
      ok: true,
      updatedKeys,
      vercelUpdated: vercelResult?.updated || [],
      vercelErrors: vercelResult?.errors || [],
      errors: errors.length > 0 ? errors : undefined,
      message,
      warning,
    });
  } catch (error) {
    console.error('[Admin Settings Update] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '환경 변수 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
