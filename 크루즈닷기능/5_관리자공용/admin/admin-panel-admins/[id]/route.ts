export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

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
  } catch (error) {
    return false;
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const { id } = await params;
    const adminId = parseInt(id);
    if (isNaN(adminId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 관리자 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, phone, email, password } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, error: '이름과 연락처는 필수입니다.' },
        { status: 400 }
      );
    }

    // 관리자 존재 확인 (크루즈몰 관리자 제외)
    const existingAdmin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, role: true, customerSource: true, password: true, phone: true },
    });

    if (!existingAdmin || existingAdmin.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 크루즈몰 관리자(user1~user10)는 수정 불가
    if (existingAdmin.customerSource === 'mall-admin' || 
        (existingAdmin.phone && ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'].includes(existingAdmin.phone))) {
      return NextResponse.json(
        { ok: false, error: '크루즈몰 관리자는 관리자 패널 관리에서 수정할 수 없습니다. 크루즈몰 관리자 관리 페이지를 이용해주세요.' },
        { status: 403 }
      );
    }

    // 업데이트 데이터 준비
    const updateData: any = {
      name,
      phone,
      email: email || null,
    };

    // 비밀번호 변경이 있는 경우
    if (password && password.trim() !== '') {
      updateData.password = password; // 평문 비밀번호 저장
      
      // PasswordEvent 생성 (비밀번호 변경 이력 기록)
      await prisma.passwordEvent.create({
        data: {
          userId: adminId,
          from: existingAdmin.password || '',
          to: password, // 평문 비밀번호 저장
          reason: '관리자 정보 수정',
        },
      });
    }

    // 관리자 정보 업데이트
    const updatedAdmin = await prisma.user.update({
      where: { id: adminId },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        loginCount: true,
      },
    });

    return NextResponse.json({
      ok: true,
      admin: {
        ...updatedAdmin,
        createdAt: updatedAdmin.createdAt.toISOString(),
        lastActiveAt: updatedAdmin.lastActiveAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[Admin Panel Admins API] Update error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid || !(await checkAdminAuth(sid))) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const { id } = await params;
    const adminId = parseInt(id);
    if (isNaN(adminId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 관리자 ID입니다.' },
        { status: 400 }
      );
    }

    // 관리자 존재 확인 (크루즈몰 관리자 제외)
    const existingAdmin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, role: true, customerSource: true, phone: true },
    });

    if (!existingAdmin || existingAdmin.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 크루즈몰 관리자(user1~user10)는 삭제 불가
    if (existingAdmin.customerSource === 'mall-admin' || 
        (existingAdmin.phone && ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'].includes(existingAdmin.phone))) {
      return NextResponse.json(
        { ok: false, error: '크루즈몰 관리자는 관리자 패널 관리에서 삭제할 수 없습니다. 크루즈몰 관리자 관리 페이지를 이용해주세요.' },
        { status: 403 }
      );
    }

    // 관리자 계정 삭제
    await prisma.user.delete({
      where: { id: adminId },
    });

    return NextResponse.json({ ok: true, message: '관리자 계정이 삭제되었습니다.' });
  } catch (error) {
    console.error('[Admin Panel Admins API] Delete error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
