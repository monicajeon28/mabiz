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
      console.log('[Scheduled Messages] No session cookie found');
      console.log('[Scheduled Messages] Available cookies:', cookieStore.getAll().map(c => c.name));
      return null;
    }
    
    console.log('[Scheduled Messages] Session ID found:', sid.substring(0, 10) + '...');

    let session;
    try {
      session = await prisma.session.findUnique({
        where: { id: sid },
        select: {
          id: true,
          userId: true,
          User: {
            select: {
              id: true,
              role: true,
              name: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      console.error('[Scheduled Messages] Database error in checkAdminAuth:', dbError);
      console.error('[Scheduled Messages] Error message:', dbError?.message);
      console.error('[Scheduled Messages] Error code:', dbError?.code);
      throw dbError; // 재던지기하여 상위에서 처리
    }

    if (!session) {
      console.log('[Scheduled Messages] Session not found:', sid);
      return null;
    }

    if (!session.User) {
      console.log('[Scheduled Messages] User not found in session');
      return null;
    }

    if (session.User.role !== 'admin') {
      console.log('[Scheduled Messages] User is not admin:', session.User.role);
      return null;
    }

    console.log('[Scheduled Messages] Admin authenticated:', session.User.id);
    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Scheduled Messages] Auth check error:', error);
    console.error('[Scheduled Messages] Error type:', error?.constructor?.name);
    console.error('[Scheduled Messages] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error; // 재던지기하여 상위에서 처리
  }
}

// GET: 예약 메시지 목록 조회
export async function GET(req: NextRequest) {
  try {
    let admin;
    try {
      admin = await checkAdminAuth();
    } catch (authError: any) {
      console.error('[Scheduled Messages GET] 인증 체크 중 오류:', authError);
      return NextResponse.json({ 
        ok: false, 
        error: '인증 확인 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? authError?.message : undefined
      }, { status: 500 });
    }
    
    if (!admin) {
      console.log('[Scheduled Messages GET] 인증 실패 - 403 반환');
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.',
        debug: process.env.NODE_ENV === 'development' ? '세션 쿠키를 확인해주세요.' : undefined
      }, { status: 403 });
    }
    
    console.log('[Scheduled Messages GET] 인증 성공, 메시지 목록 조회 시작');

    const messages = await prisma.scheduledMessage.findMany({
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
        CustomerGroup: {
          select: {
            id: true,
            name: true,
            _count: { select: { CustomerGroupMember: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform ScheduledMessageStage to stages for frontend
    const formattedMessages = messages.map(msg => ({
      ...msg,
      stages: msg.ScheduledMessageStage || [],
      targetGroup: msg.CustomerGroup ? {
        id: msg.CustomerGroup.id,
        name: msg.CustomerGroup.name,
        _count: {
          members: msg.CustomerGroup._count.CustomerGroupMember,
        },
      } : null,
    }));

    return NextResponse.json({ ok: true, messages: formattedMessages });
  } catch (error) {
    console.error('[Scheduled Messages GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch scheduled messages' },
      { status: 500 }
    );
  }
}

// POST: 예약 메시지 생성
export async function POST(req: NextRequest) {
  try {
    let admin;
    try {
      admin = await checkAdminAuth();
    } catch (authError: any) {
      console.error('[Scheduled Messages POST] 인증 체크 중 오류:', authError);
      return NextResponse.json({ 
        ok: false, 
        error: '인증 확인 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? authError?.message : undefined
      }, { status: 500 });
    }
    
    if (!admin) {
      console.log('[Scheduled Messages POST] 인증 실패 - 403 반환');
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      console.log('[Scheduled Messages POST] Available cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value })));
      console.log('[Scheduled Messages POST] Session cookie value:', cookieStore.get(SESSION_COOKIE)?.value ? 'exists' : 'missing');

      return NextResponse.json({
        ok: false,
        error: '인증이 필요합니다. 관리자로 다시 로그인해주세요.',
        debug: process.env.NODE_ENV === 'development' ? {
          message: '세션 쿠키를 확인해주세요. 다시 로그인해주세요.',
          cookieNames: allCookies.map(c => c.name),
          sessionCookieExists: !!cookieStore.get(SESSION_COOKIE)?.value,
        } : undefined
      }, { status: 403 });
    }
    
    console.log('[Scheduled Messages POST] 인증 성공, 메시지 생성 시작');

    const body = await req.json();
    console.log('[Scheduled Messages POST] 받은 데이터:', JSON.stringify(body, null, 2));
    
    const {
      title,
      category,
      groupName,
      description,
      sendMethod,
      senderName,
      senderPhone,
      senderEmail,
      optOutNumber,
      isAdMessage,
      autoAddAdTag,
      autoAddOptOut,
      startDate,
      startTime,
      maxDays,
      repeatInterval,
      targetGroupId,
      stages,
    } = body;

    console.log('[Scheduled Messages POST] 파싱된 데이터:', {
      title,
      sendMethod,
      targetGroupId,
      stagesCount: stages?.length,
      stages: stages?.map((s: any) => ({ stageNumber: s.stageNumber, daysAfter: s.daysAfter, hasTitle: !!s.title, hasContent: !!s.content })),
    });

    if (!title || !sendMethod) {
      return NextResponse.json(
        { ok: false, error: '제목과 발송 방식은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!stages || stages.length === 0) {
      return NextResponse.json(
        { ok: false, error: '최소 1개의 메시지 단계가 필요합니다.' },
        { status: 400 }
      );
    }

    // stages 유효성 검사
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      if (!stage || typeof stage !== 'object') {
        return NextResponse.json(
          { ok: false, error: `${i + 1}회차 메시지 데이터가 올바르지 않습니다.` },
          { status: 400 }
        );
      }
      if (!stage.title || !stage.title.trim()) {
        return NextResponse.json(
          { ok: false, error: `${i + 1}회차 메시지의 제목을 입력해주세요.` },
          { status: 400 }
        );
      }
      if (!stage.content || !stage.content.trim()) {
        return NextResponse.json(
          { ok: false, error: `${i + 1}회차 메시지의 내용을 입력해주세요.` },
          { status: 400 }
        );
      }
    }

    // targetGroupId가 제공된 경우 숫자로 변환하고 그룹 존재 확인
    let targetGroupIdNum: number | null = null;
    if (targetGroupId) {
      targetGroupIdNum = typeof targetGroupId === 'string' ? parseInt(targetGroupId) : targetGroupId;
      if (isNaN(targetGroupIdNum)) {
        return NextResponse.json(
          { ok: false, error: '유효하지 않은 고객 그룹 ID입니다.' },
          { status: 400 }
        );
      }
      
      const groupExists = await prisma.customerGroup.findFirst({
        where: { id: targetGroupIdNum },
      });
      if (!groupExists) {
        return NextResponse.json(
          { ok: false, error: '선택한 고객 그룹을 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // 예약 메시지 생성
    const scheduledMessage = await prisma.scheduledMessage.create({
      data: {
        adminId: admin.id,
        title,
        category: category || '예약메시지',
        groupName: groupName || null,
        description: description || null,
        sendMethod,
        senderName: senderName || null,
        senderPhone: senderPhone || null,
        senderEmail: senderEmail || null,
        optOutNumber: optOutNumber || null,
        isAdMessage: isAdMessage || false,
        autoAddAdTag: autoAddAdTag !== false,
        autoAddOptOut: autoAddOptOut !== false,
        startDate: startDate ? (() => {
          try {
            const date = new Date(startDate);
            return isNaN(date.getTime()) ? null : date;
          } catch {
            return null;
          }
        })() : null,
        startTime: startTime && startTime.trim() ? startTime.trim() : null,
        maxDays: maxDays ? (typeof maxDays === 'string' ? parseInt(maxDays) : maxDays) : (sendMethod === 'sms' ? 999999 : 99999),
        repeatInterval: repeatInterval ? (typeof repeatInterval === 'string' ? parseInt(repeatInterval) : repeatInterval) : null,
        targetGroupId: targetGroupIdNum,
        isActive: true,
        ScheduledMessageStage: {
          create: stages.map((stage: any, index: number) => {
            // daysAfter를 숫자로 변환
            let daysAfter = 0;
            if (stage.daysAfter !== undefined && stage.daysAfter !== null) {
              const parsed = typeof stage.daysAfter === 'string' ? parseInt(stage.daysAfter) : stage.daysAfter;
              daysAfter = isNaN(parsed) ? 0 : parsed;
            }
            
            // sendTime이 빈 문자열이면 null로 변환
            const sendTime = stage.sendTime && stage.sendTime.trim() ? stage.sendTime.trim() : null;
            
            return {
              stageNumber: stage.stageNumber || index + 1,
              daysAfter: daysAfter,
              sendTime: sendTime,
              title: stage.title.trim(),
              content: stage.content.trim(),
              order: index,
            };
          }),
        },
      },
      include: {
        ScheduledMessageStage: {
          orderBy: { order: 'asc' },
        },
      },
    });

    console.log('[Scheduled Messages POST] 생성 성공:', scheduledMessage.id);

    // Transform ScheduledMessageStage to stages for frontend
    const formattedMessage = {
      ...scheduledMessage,
      stages: scheduledMessage.ScheduledMessageStage || [],
    };

    return NextResponse.json({ ok: true, message: formattedMessage });
  } catch (error: any) {
    console.error('[Scheduled Messages POST] Error:', error);
    console.error('[Scheduled Messages POST] Error details:', {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      meta: error?.meta,
    });
    
    // Prisma 에러 처리
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { ok: false, error: '이미 같은 예약 메시지가 존재합니다.' },
        { status: 409 }
      );
    }
    
    // 필수 필드 누락 에러
    if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
      return NextResponse.json(
        { ok: false, error: '연결된 데이터를 찾을 수 없습니다. 고객 그룹을 확인해주세요.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Failed to create scheduled message',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
