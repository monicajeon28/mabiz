export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';

const SESSION_COOKIE = 'cg.sid.v2';
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'affiliate-payment-pages.json');

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

    return session?.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Payment Pages] Auth check error:', error);
    return false;
  }
}

// 설정 파일 읽기
async function readSettingsFile(): Promise<any> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // 파일이 없으면 기본값 반환
    return { configs: [] };
  }
}

// 설정 파일 쓰기
async function writeSettingsFile(data: any): Promise<void> {
  // 디렉토리가 없으면 생성
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * GET /api/admin/affiliate/payment-pages
 * 결제 페이지 설정 조회
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    // 설정 파일에서 읽기
    const settings = await readSettingsFile();
    const configs = settings.configs || [];

    return NextResponse.json({ ok: true, configs });
  } catch (error: any) {
    console.error('[Admin Payment Pages] GET error:', error);
    return NextResponse.json(
      { ok: false, message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/affiliate/payment-pages
 * 결제 페이지 설정 저장
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const { configs } = await req.json();

    if (!Array.isArray(configs)) {
      return NextResponse.json({ ok: false, message: 'Invalid configs format' }, { status: 400 });
    }

    // 설정 파일에 저장
    await writeSettingsFile({ configs });

    return NextResponse.json({ ok: true, message: '설정이 저장되었습니다.' });
  } catch (error: any) {
    console.error('[Admin Payment Pages] POST error:', error);
    return NextResponse.json(
      { ok: false, message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
