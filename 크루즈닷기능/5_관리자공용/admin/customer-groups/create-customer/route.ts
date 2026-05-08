export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { scheduleAdminFunnelMessages } from '@/lib/funnel-scheduler';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(sid: string | undefined): Promise<{ id: number } | null> {
  try {
    if (!sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return { id: session.User.id };
  } catch (error) {
    console.error('[Admin Customer Groups Create Customer] Auth check error:', error);
    return null;
  }
}

// POST: 고객 그룹 관리에서 고객 직접 생성
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const admin = await checkAdminAuth(sid);
    
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, email, memo, groupId } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, error: '이름과 연락처는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전화번호 정규화
    const normalizePhone = (phone: string): string => {
      return String(phone).replace(/\D/g, '');
    };

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 전화번호입니다.' },
        { status: 400 }
      );
    }

    // 기존 고객 확인
    const existingUser = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });

    let userId: number;

    if (existingUser) {
      // 기존 고객이면 customerSource를 'group'으로 업데이트
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          customerSource: 'group',
          adminMemo: memo || null,
          email: email || existingUser.email,
        },
      });
      userId = existingUser.id;
    } else {
      // 새 고객 생성
      const now = new Date();
      const newUser = await prisma.user.create({
        data: {
          name: name.trim(),
          phone: normalizedPhone,
          email: email?.trim() || null,
          password: '3800',
          role: 'user',
          customerStatus: 'active',
          customerSource: 'group',
          adminMemo: memo?.trim() || null,
          updatedAt: now, // updatedAt 필수 필드 추가
        },
      });
      userId = newUser.id;
    }

    // 그룹에 추가 (groupId가 제공된 경우)
    if (groupId) {
      const groupIdNum = parseInt(groupId);
      if (!isNaN(groupIdNum)) {
        try {
          await prisma.customerGroupMember.create({
            data: {
              groupId: groupIdNum,
              userId,
              addedBy: admin.id,
            },
          });

          // 퍼널 자동 발송: 새로 그룹에 추가된 고객에게 퍼널 메시지 예약
          scheduleAdminFunnelMessages({
            userId,
            groupId: groupIdNum,
            adminId: admin.id,
          }).catch(err => console.error('[Admin Create Customer] Funnel schedule error:', err));
        } catch (error: any) {
          // 이미 그룹에 속한 경우 무시
          if (error.code !== 'P2002') {
            throw error;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      customer: {
        id: userId,
        name,
        phone: normalizedPhone,
        email,
      },
    });
  } catch (error: any) {
    console.error('[Admin Customer Groups Create Customer] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '고객 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
