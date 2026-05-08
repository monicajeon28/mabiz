export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import { sendSms } from '@/lib/aligo/client';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const { prisma } = await import('@/lib/prisma');
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Marketing Customers Send SMS] Auth check error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { phones, title, content } = body;

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '전화번호 목록이 필요합니다.',
      }, { status: 400 });
    }

    if (!title || !content) {
      return NextResponse.json({
        ok: false,
        error: '제목과 내용을 입력해주세요.',
      }, { status: 400 });
    }

    // 전화번호 정규화 (하이픈 제거)
    const normalizedPhones = phones.map((phone: string) => phone.replace(/\D/g, ''));

    // 알리고 SMS 발송
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 알리고는 한 번에 최대 1000건까지 발송 가능하므로 배치로 나눔
    const batchSize = 1000;
    for (let i = 0; i < normalizedPhones.length; i += batchSize) {
      const batch = normalizedPhones.slice(i, i + batchSize);
      
      try {
        // 알리고 API는 여러 수신자에게 동일한 메시지를 보낼 때 receiver와 msg를 사용
        const receivers = batch.join(',');
        const message = `${title}\n${content}`;

        const result = await sendSms({
          receiver: receivers,
          msg: message,
          msgType: message.length > 90 ? 'LMS' : 'SMS', // 90자 초과시 LMS
        });

        if (result.result_code === '1') {
          sentCount += batch.length;
        } else {
          failedCount += batch.length;
          errors.push(result.message || `배치 ${i / batchSize + 1} 발송 실패`);
        }
      } catch (error: any) {
        failedCount += batch.length;
        errors.push(error.message || `배치 ${i / batchSize + 1} 발송 중 오류 발생`);
        console.error(`[Marketing Customers Send SMS] Batch ${i / batchSize + 1} error:`, error);
      }
    }

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount,
      totalCount: normalizedPhones.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Marketing Customers Send SMS] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'SMS 발송에 실패했습니다.',
    }, { status: 500 });
  }
}
