export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

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
    console.error('[Prospects Bulk] Auth check error:', error);
    return null;
  }
}

// POST: 잠재고객 일괄 추가 (엑셀 업로드용)
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { prospects } = body;

    if (!Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json(
        { ok: false, error: '잠재고객 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    let created = 0;
    let duplicates = 0;

    for (const prospectData of prospects) {
      const { name, email, phone, source, notes, tags } = prospectData;

      if (!name || (!email && !phone)) {
        continue; // 이름과 연락처(이메일 또는 전화번호)가 없으면 스킵
      }

      try {
        // 중복 확인 (이메일 또는 전화번호로)
        let existing = null;
        if (email) {
          existing = await prisma.prospect.findFirst({
            where: { email },
          });
        } else if (phone) {
          // 전화번호로 중복 확인 (이메일이 없는 경우)
          existing = await prisma.prospect.findFirst({
            where: { phone, email: null },
          });
        }

        if (existing) {
          duplicates++;
          continue;
        }

        await prisma.prospect.create({
          data: {
            name: name || null,
            email: email || null, // 이메일이 없을 수 있음
            phone: phone || null,
            source: source || '엑셀 업로드',
            notes: notes || null,
            tags: tags && tags.length > 0 ? tags : null,
          },
        });

        created++;
      } catch (error) {
        console.error(`[Prospects Bulk] Failed to create prospect ${name}:`, error);
        // 개별 실패해도 계속 진행
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      duplicates,
      total: prospects.length,
    });
  } catch (error) {
    console.error('[Prospects Bulk] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to bulk create prospects' },
      { status: 500 }
    );
  }
}
