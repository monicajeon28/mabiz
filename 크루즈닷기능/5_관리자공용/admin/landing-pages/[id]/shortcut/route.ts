export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function getSessionWithUser(sid: string | undefined) {
  try {
    if (!sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    return session ?? null;
  } catch (error) {
    console.error('[Admin Landing Pages] Session fetch error:', error);
    return null;
  }
}

// POST: 바로가기 URL 생성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const session = await getSessionWithUser(sid);

    if (!session || !session.User) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const pageId = parseInt(resolvedParams.id);

    const landingPage = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    const user = session.User;
    const isAdmin = user.role === 'admin';
    const isOwner = landingPage.adminId === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { ok: false, error: '이 랜딩페이지에 대한 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 바로가기 URL 생성 (짧은 고유 코드 - 4자로 단축)
    let shortCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      // 4자리 짧은 코드 생성 (숫자와 소문자만 사용)
      const bytes = randomBytes(3);
      shortCode = Array.from(bytes)
        .map(b => {
          // 0-9, a-z 범위로 매핑 (36진수)
          const num = b % 36;
          return num < 10 ? String(num) : String.fromCharCode(97 + (num - 10));
        })
        .join('')
        .substring(0, 4);
      
      // 중복 체크 (endsWith 사용으로 인덱스 효율성 향상)
      const existing = await prisma.landingPage.findFirst({
        where: { 
          shortcutUrl: { 
            endsWith: `/i/${shortCode}`, // 정확한 끝 부분 매칭 (인덱스 활용)
          },
        },
      });
      
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      // 최후의 수단: 타임스탬프 기반
      shortCode = Date.now().toString(36).substring(0, 4);
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (req.headers.get('origin') || 'http://localhost:3000');
    const shortcutUrl = `${baseUrl}/i/${shortCode}`;

    // 바로가기 URL 업데이트
    await prisma.landingPage.update({
      where: { id: pageId },
      data: {
        shortcutUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      shortcutUrl,
    });
  } catch (error: any) {
    console.error('[Admin Landing Pages] Shortcut generation error:', error);
    return NextResponse.json(
      { ok: false, error: '바로가기 URL 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
