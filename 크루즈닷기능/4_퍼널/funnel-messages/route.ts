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
  } catch (error: any) {
    console.error('[Funnel Messages] Auth check error:', error);
    console.error('[Funnel Messages] Auth check error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return null;
  }
}

// GET: 퍼널 메시지 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'sms', 'email', 'kakao'
    const owner = searchParams.get('owner'); // 'HQ', 'all', or affiliateProfileId

    // 기본 조건: 관리자가 생성한 퍼널 또는 대리점장/판매원이 생성한 퍼널
    let where: any = {};

    if (owner === 'HQ') {
      // 본사 퍼널만 (affiliateProfileId가 없는 그룹에 연결된 퍼널)
      where = {
        adminId: admin.id,
        OR: [
          { groupId: null },
          {
            CustomerGroup: {
              affiliateProfileId: null,
            },
          },
        ],
      };
    } else if (owner === 'all' || !owner) {
      // 전체 (관리자 + 대리점장/판매원 그룹 퍼널)
      where = {
        OR: [
          { adminId: admin.id },
          {
            CustomerGroup: {
              affiliateProfileId: { not: null },
            },
          },
        ],
      };
    } else {
      // 특정 대리점장/판매원의 퍼널
      const affiliateProfileId = parseInt(owner, 10);
      if (!isNaN(affiliateProfileId)) {
        where = {
          CustomerGroup: {
            affiliateProfileId: affiliateProfileId,
          },
        };
      } else {
        where = { adminId: admin.id };
      }
    }

    // messageType 필터 추가 (기존 조건에 AND로 추가)
    if (type) {
      where = {
        AND: [
          where,
          { messageType: type },
        ],
      };
    }

    try {
      const messages = await prisma.funnelMessage.findMany({
        where,
        include: {
          FunnelMessageStage: {
            orderBy: { order: 'asc' },
          },
          CustomerGroup: {
            select: {
              id: true,
              name: true,
              affiliateProfileId: true,
              AffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                  branchLabel: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        ok: true,
        messages: messages.map(msg => ({
          id: msg.id,
          adminId: msg.adminId,
          groupId: msg.groupId,
          messageType: msg.messageType,
          title: msg.title,
          category: msg.category,
          groupName: msg.groupName,
          description: msg.description,
          senderPhone: msg.senderPhone,
          senderEmail: msg.senderEmail,
          sendTime: msg.sendTime,
          optOutNumber: msg.optOutNumber,
          autoAddOptOut: msg.autoAddOptOut,
          isActive: msg.isActive,
          createdAt: msg.createdAt.toISOString(),
          updatedAt: msg.updatedAt.toISOString(),
          stages: msg.FunnelMessageStage.map(stage => ({
            id: stage.id,
            stageNumber: stage.stageNumber,
            daysAfter: stage.daysAfter,
            sendTime: stage.sendTime,
            content: stage.content,
            imageUrl: stage.imageUrl,
            order: stage.order,
            createdAt: stage.createdAt.toISOString(),
            updatedAt: stage.updatedAt.toISOString(),
          })),
          customerGroup: msg.CustomerGroup ? {
            id: msg.CustomerGroup.id,
            name: msg.CustomerGroup.name,
            affiliateProfileId: msg.CustomerGroup.affiliateProfileId,
            affiliateProfile: msg.CustomerGroup.AffiliateProfile ? {
              id: msg.CustomerGroup.AffiliateProfile.id,
              displayName: msg.CustomerGroup.AffiliateProfile.displayName,
              branchLabel: msg.CustomerGroup.AffiliateProfile.branchLabel,
              type: msg.CustomerGroup.AffiliateProfile.type,
            } : null,
          } : null,
          // 소유자 정보 (본사 또는 대리점장/판매원)
          owner: msg.CustomerGroup?.AffiliateProfile
            ? {
                type: msg.CustomerGroup.AffiliateProfile.type || 'manager',
                name: msg.CustomerGroup.AffiliateProfile.displayName || msg.CustomerGroup.AffiliateProfile.branchLabel,
              }
            : { type: 'admin', name: '본사' },
        }))
      });
    } catch (dbError: any) {
      console.error('[Funnel Messages GET] Database error:', dbError);
      console.error('[Funnel Messages GET] Error code:', dbError?.code);
      console.error('[Funnel Messages GET] Error meta:', dbError?.meta);
      throw dbError;
    }
  } catch (error: any) {
    console.error('[Funnel Messages GET] Error:', error);
    console.error('[Funnel Messages GET] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: '퍼널 메시지를 불러오는데 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

// POST: 퍼널 메시지 생성
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      messageType,
      title,
      category,
      groupName,
      description,
      senderPhone,
      senderEmail,
      sendTime,
      optOutNumber,
      autoAddOptOut,
      groupId,
      stages,
    } = body;

    if (!messageType || !title) {
      return NextResponse.json({ ok: false, error: '메시지 타입과 제목은 필수입니다.' }, { status: 400 });
    }

    if (!stages || !Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ ok: false, error: '최소 1개의 메시지 단계가 필요합니다.' }, { status: 400 });
    }

    // 퍼널 메시지 생성
    let message;
    try {
      message = await prisma.funnelMessage.create({
        data: {
          adminId: admin.id,
          groupId: groupId || null,
          messageType,
          title,
          category: category || null,
          groupName: groupName || null,
          description: description || null,
          senderPhone: senderPhone || null,
          senderEmail: senderEmail || null,
          sendTime: sendTime || null,
          optOutNumber: optOutNumber || null,
          autoAddOptOut: autoAddOptOut !== false,
          FunnelMessageStage: {
            create: stages.map((stage: any, index: number) => ({
              stageNumber: index + 1,
              daysAfter: stage.daysAfter || 0,
              sendTime: stage.sendTime || null,
              content: stage.content,
              imageUrl: stage.imageUrl || null,
              order: index,
            })),
          },
        },
        include: {
          FunnelMessageStage: {
            orderBy: { order: 'asc' },
          },
        },
      });
    } catch (createError: any) {
      console.error('[Funnel Messages POST] Create database error:', createError);
      console.error('[Funnel Messages POST] Error details:', {
        message: createError?.message,
        code: createError?.code,
        meta: createError?.meta,
        stack: createError?.stack,
      });
      return NextResponse.json(
        { 
          ok: false, 
          error: '퍼널 메시지 생성에 실패했습니다.',
          details: process.env.NODE_ENV === 'development' ? createError?.message : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message });
  } catch (error: any) {
    console.error('[Funnel Messages POST] Error:', error);
    console.error('[Funnel Messages POST] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: '퍼널 메시지 생성에 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
