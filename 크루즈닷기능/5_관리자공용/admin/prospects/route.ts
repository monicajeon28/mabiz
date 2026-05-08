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
    console.error('[Prospects] Auth check error:', error);
    return null;
  }
}

// GET: 잠재고객 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const prospects = await prisma.prospect.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true, // 연락처 (이메일 또는 전화번호)
        source: true, // 유입 경로
      },
    });

    return NextResponse.json({
      ok: true,
      prospects: prospects.map(prospect => ({
        ...prospect,
        customerType: 'prospect',
        customerTypeLabel: prospect.source === 'excel' ? '엑셀' : '잠재고객',
      })),
    });
  } catch (error) {
    console.error('[Prospects GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch prospects' },
      { status: 500 }
    );
  }
}

// POST: 잠재고객 추가
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone, source, notes, tags } = body;

    // 모든 필드가 선택사항이므로 검증 제거

    // 중복 확인 (이메일 또는 전화번호로, 둘 다 있는 경우에만)
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
      return NextResponse.json(
        { ok: false, error: '이미 등록된 연락처입니다.' },
        { status: 400 }
      );
    }

    const prospect = await prisma.prospect.create({
      data: {
        name: name || null,
        email: email || null, // 이메일이 없을 수 있음
        phone: phone || null,
        source: source || null,
        notes: notes || null,
        tags: tags && tags.length > 0 ? tags : null,
      },
    });

    return NextResponse.json({ ok: true, prospect });
  } catch (error) {
    console.error('[Prospects POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create prospect' },
      { status: 500 }
    );
  }
}
