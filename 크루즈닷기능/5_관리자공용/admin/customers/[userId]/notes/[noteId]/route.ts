export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

async function checkAdminAuth(sid: string | undefined): Promise<{ isAdmin: boolean; userId: number | null }> {
  try {
    if (!sid) return { isAdmin: false, userId: null };

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { 
        User: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!session || !session.User) {
      return { isAdmin: false, userId: null };
    }

    const user = session.User;
    const isAdmin = user.role === 'admin' || !!user.AffiliateProfile;

    return { isAdmin, userId: user.id };
  } catch (error) {
    console.error('[Customer Note API] Auth check error:', error);
    return { isAdmin: false, userId: null };
  }
}

// PATCH: 고객 기록 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const auth = await checkAdminAuth(sid);

    if (!auth.isAdmin || !auth.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    const { userId: userIdStr, noteId: noteIdStr } = await params;
    const customerId = parseInt(userIdStr);
    const noteId = parseInt(noteIdStr);

    if (isNaN(customerId) || isNaN(noteId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: '기록 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 기록 존재 확인 및 작성자 확인
    const note = await prisma.customerNote.findUnique({
      where: { id: noteId },
      select: { id: true, customerId: true, createdBy: true },
    });

    if (!note) {
      return NextResponse.json(
        { ok: false, error: '기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (note.customerId !== customerId) {
      return NextResponse.json(
        { ok: false, error: '고객 ID가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // 작성자만 수정 가능 (또는 관리자)
    if (note.createdBy !== auth.userId) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { role: true },
      });
      
      if (user?.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: '본인이 작성한 기록만 수정할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // 기록 수정
    const updatedNote = await prisma.customerNote.update({
      where: { id: noteId },
      data: {
        content: content.trim(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      note: {
        id: updatedNote.id,
        content: updatedNote.content,
        updatedAt: updatedNote.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Customer Note API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '기록 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 고객 기록 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const auth = await checkAdminAuth(sid);
    
    if (!auth.isAdmin || !auth.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    const { userId: userIdStr, noteId: noteIdStr } = await params;
    const customerId = parseInt(userIdStr);
    const noteId = parseInt(noteIdStr);

    if (isNaN(customerId) || isNaN(noteId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    // 기록 존재 확인 및 작성자 확인
    const note = await prisma.customerNote.findUnique({
      where: { id: noteId },
      select: { id: true, customerId: true, createdBy: true },
    });

    if (!note) {
      return NextResponse.json(
        { ok: false, error: '기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (note.customerId !== customerId) {
      return NextResponse.json(
        { ok: false, error: '고객 ID가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // 작성자만 삭제 가능 (또는 관리자)
    if (note.createdBy !== auth.userId) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { role: true },
      });
      
      if (user?.role !== 'admin') {
        return NextResponse.json(
          { ok: false, error: '본인이 작성한 기록만 삭제할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // 기록 삭제
    await prisma.customerNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({
      ok: true,
      message: '기록이 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Customer Note API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '기록 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
