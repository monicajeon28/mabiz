export const dynamic = 'force-dynamic';

// app/api/admin/pages/html/route.ts
// 페이지 HTML 콘텐츠 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return false;

    const session = await (prisma as any).session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User?.role === 'admin';
  } catch (error) {
    console.error('[Admin Pages HTML] Auth check error:', error);
    return false;
  }
}

// GET: 페이지 HTML 조회
export async function GET(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pagePath = searchParams.get('pagePath');

    if (!pagePath) {
      return NextResponse.json(
        { ok: false, error: 'Missing pagePath' },
        { status: 400 }
      );
    }

    // 저장된 HTML 파일 경로
    const htmlDir = join(process.cwd(), 'public', 'pages-html');
    const fileName = pagePath.replace(/\//g, '_').replace(/^_/, '') + '.html';
    const filePath = join(htmlDir, fileName);

    let html = '';
    if (existsSync(filePath)) {
      html = await readFile(filePath, 'utf-8');
    } else {
      // 기본 페이지 HTML 로드 시도
      try {
        const response = await fetch(`http://localhost:3000${pagePath}`);
        html = await response.text();
      } catch (e) {
        html = '<div>페이지를 불러올 수 없습니다.</div>';
      }
    }

    return NextResponse.json({ ok: true, html });
  } catch (error: any) {
    console.error('[API] Error fetching HTML:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch HTML' },
      { status: 500 }
    );
  }
}

// POST: 페이지 HTML 저장
export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { pagePath, html } = body;

    if (!pagePath || !html) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // HTML 파일 저장
    const htmlDir = join(process.cwd(), 'public', 'pages-html');
    if (!existsSync(htmlDir)) {
      await mkdir(htmlDir, { recursive: true });
    }

    const fileName = pagePath.replace(/\//g, '_').replace(/^_/, '') + '.html';
    const filePath = join(htmlDir, fileName);

    await writeFile(filePath, html, 'utf-8');

    return NextResponse.json({ ok: true, message: 'HTML saved' });
  } catch (error: any) {
    console.error('[API] Error saving HTML:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to save HTML' },
      { status: 500 }
    );
  }
}
