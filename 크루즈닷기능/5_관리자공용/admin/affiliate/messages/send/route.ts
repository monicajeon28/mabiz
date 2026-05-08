export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

// 판매원/대리점장 인증 확인 및 프로필 정보 반환
async function checkAffiliateAuth(sid: string | undefined): Promise<{
  userId: number;
  role: string;
  profile: { id: number; type: string } | null;
} | null> {
  if (!sid) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
          include: {
            AffiliateProfile: {
              select: { id: true, type: true },
            },
          },
        },
      },
    });

    if (!session || !session.User) return null;
    if (!['agent', 'manager'].includes(session.User.role)) return null;

    return {
      userId: session.User.id,
      role: session.User.role,
      profile: session.User.AffiliateProfile,
    };
  } catch (error) {
    console.error('[Affiliate Message Send] Auth check error:', error);
    return null;
  }
}

// 판매원이 대리점장에게 메시지를 보낼 수 있는지 확인
async function canAgentSendToManager(agentUserId: number, managerUserId: number): Promise<boolean> {
  try {
    const agentProfile = await prisma.affiliateProfile.findUnique({
      where: { userId: agentUserId },
      select: { id: true },
    });

    if (!agentProfile) return false;

    const managerProfile = await prisma.affiliateProfile.findUnique({
      where: { userId: managerUserId },
      select: { id: true, type: true },
    });

    if (!managerProfile || managerProfile.type !== 'BRANCH_MANAGER') return false;

    // 판매원과 대리점장의 관계 확인
    const relation = await prisma.affiliateRelation.findFirst({
      where: {
        agentId: agentProfile.id,
        managerId: managerProfile.id,
        status: 'ACTIVE',
      },
    });

    return !!relation;
  } catch (error) {
    console.error('[canAgentSendToManager] Error:', error);
    return false;
  }
}

// 대리점장이 판매원에게 메시지를 보낼 수 있는지 확인
async function canManagerSendToAgent(managerUserId: number, agentUserId: number): Promise<boolean> {
  try {
    const managerProfile = await prisma.affiliateProfile.findUnique({
      where: { userId: managerUserId },
      select: { id: true, type: true },
    });

    if (!managerProfile || managerProfile.type !== 'BRANCH_MANAGER') return false;

    const agentProfile = await prisma.affiliateProfile.findUnique({
      where: { userId: agentUserId },
      select: { id: true },
    });

    if (!agentProfile) return false;

    // 대리점장과 판매원의 관계 확인
    const relation = await prisma.affiliateRelation.findFirst({
      where: {
        agentId: agentProfile.id,
        managerId: managerProfile.id,
        status: 'ACTIVE',
      },
    });

    return !!relation;
  } catch (error) {
    console.error('[canManagerSendToAgent] Error:', error);
    return false;
  }
}

// 대리점장끼리 메시지를 보낼 수 있는지 확인 (항상 가능)
async function canManagerSendToManager(managerUserId: number, targetManagerUserId: number): Promise<boolean> {
  try {
    const managerProfile = await prisma.affiliateProfile.findUnique({
      where: { userId: managerUserId },
      select: { id: true, type: true },
    });

    if (!managerProfile || managerProfile.type !== 'BRANCH_MANAGER') return false;

    const targetManagerProfile = await prisma.affiliateProfile.findUnique({
      where: { userId: targetManagerUserId },
      select: { id: true, type: true },
    });

    return !!targetManagerProfile && targetManagerProfile.type === 'BRANCH_MANAGER';
  } catch (error) {
    console.error('[canManagerSendToManager] Error:', error);
    return false;
  }
}

// 관리자에게 메시지를 보낼 수 있는지 확인
async function canSendToAdmin(targetUserId: number): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });

    return user?.role === 'admin';
  } catch (error) {
    console.error('[canSendToAdmin] Error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const sender = await checkAffiliateAuth(sid);
    if (!sender) {
      return NextResponse.json({ ok: false, error: '판매원 또는 대리점장 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { recipientUserId, title, content } = body;

    if (!recipientUserId || !title || !content) {
      return NextResponse.json({
        ok: false,
        error: '수신자, 제목, 내용을 모두 입력해주세요.',
      }, { status: 400 });
    }

    const recipientId = parseInt(recipientUserId.toString());

    // 본인에게 메시지를 보낼 수 없음
    if (recipientId === sender.userId) {
      return NextResponse.json({
        ok: false,
        error: '본인에게는 메시지를 보낼 수 없습니다.',
      }, { status: 400 });
    }

    // 수신자가 존재하는지 확인
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, role: true },
    });

    if (!recipient) {
      return NextResponse.json({
        ok: false,
        error: '수신자를 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // 메시지 타입 결정 및 권한 확인
    let messageType = '';
    let canSend = false;
    let errorMessage = '이 사용자에게 메시지를 보낼 권한이 없습니다.';

    if (sender.role === 'agent') {
      // 판매원이 보내는 경우
      if (recipient.role === 'manager') {
        // 판매원 -> 대리점장
        canSend = await canAgentSendToManager(sender.userId, recipientId);
        messageType = 'agent-manager';
        if (!canSend) {
          errorMessage = '담당 대리점장에게만 메시지를 보낼 수 있습니다.';
        }
      } else if (recipient.role === 'admin') {
        // 판매원 -> 관리자
        canSend = await canSendToAdmin(recipientId);
        messageType = 'agent-admin';
      } else if (recipient.role === 'agent') {
        // 판매원 -> 판매원 (불가능)
        return NextResponse.json({
          ok: false,
          error: '판매원끼리는 메시지를 주고받을 수 없습니다.',
        }, { status: 403 });
      } else {
        return NextResponse.json({
          ok: false,
          error: '이 사용자에게 메시지를 보낼 수 없습니다.',
        }, { status: 403 });
      }
    } else if (sender.role === 'manager') {
      // 대리점장이 보내는 경우
      if (recipient.role === 'agent') {
        // 대리점장 -> 판매원
        canSend = await canManagerSendToAgent(sender.userId, recipientId);
        messageType = 'manager-agent';
        if (!canSend) {
          errorMessage = '소속 판매원에게만 메시지를 보낼 수 있습니다.';
        }
      } else if (recipient.role === 'manager') {
        // 대리점장 -> 대리점장
        canSend = await canManagerSendToManager(sender.userId, recipientId);
        messageType = 'manager-manager';
      } else if (recipient.role === 'admin') {
        // 대리점장 -> 관리자
        canSend = await canSendToAdmin(recipientId);
        messageType = 'manager-admin';
      } else {
        return NextResponse.json({
          ok: false,
          error: '이 사용자에게 메시지를 보낼 수 없습니다.',
        }, { status: 403 });
      }
    }

    if (!canSend || !messageType) {
      return NextResponse.json({
        ok: false,
        error: errorMessage,
      }, { status: 403 });
    }

    // 메시지 생성
    const message = await prisma.adminMessage.create({
      data: {
        adminId: sender.userId, // 발신자
        userId: recipientId, // 수신자
        title,
        content,
        messageType,
        isActive: true,
        totalSent: 1,
        metadata: {
          type: messageType,
          sentAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: '메시지가 전송되었습니다.',
      messageId: message.id,
    });
  } catch (error) {
    console.error('[Affiliate Message Send] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '메시지 전송에 실패했습니다.',
    }, { status: 500 });
  }
}

