export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 판매원/대리점장 인증 확인
async function checkAffiliateAuth(sid: string | undefined): Promise<{
  userId: number;
  role: string;
} | null> {
  if (!sid) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session || !session.User) return null;
    if (!['agent', 'manager'].includes(session.User.role)) return null;

    return {
      userId: session.User.id,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Affiliate Message Delete] Auth check error:', error);
    return null;
  }
}

// DELETE: 판매원/대리점장이 본인이 보낸 메시지 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const user = await checkAffiliateAuth(sid);
    if (!user) {
      return NextResponse.json({ ok: false, error: '판매원 또는 대리점장 권한이 필요합니다.' }, { status: 403 });
    }

    const messageId = parseInt(params.id);

    // 메시지가 존재하는지 확인
    const message = await prisma.adminMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        adminId: true,
        messageType: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { ok: false, error: '메시지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 본인이 보낸 메시지인지 확인
    if (message.adminId !== user.userId) {
      return NextResponse.json(
        { ok: false, error: '본인이 보낸 메시지만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 판매원/대리점장 메시지 타입인지 확인
    const affiliateMessageTypes = ['agent-manager', 'manager-agent', 'manager-manager', 'agent-admin', 'manager-admin'];
    if (!affiliateMessageTypes.includes(message.messageType)) {
      return NextResponse.json(
        { ok: false, error: '이 메시지는 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 관련된 UserMessageRead 레코드 삭제
    await prisma.userMessageRead.deleteMany({
      where: { messageId },
    });

    // 메시지 삭제 (실제 삭제 또는 isActive = false)
    await prisma.adminMessage.update({
      where: { id: messageId },
      data: { isActive: false },
    });

    return NextResponse.json({
      ok: true,
      message: '메시지가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[Affiliate Message Delete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '메시지 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

