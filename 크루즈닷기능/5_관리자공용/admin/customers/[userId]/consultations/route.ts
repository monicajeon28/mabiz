export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';

// 상담기록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: customerId } = await params;
    const auth = await checkAdminAuth();

    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const consultations = await prisma.customerNote.findMany({
      where: {
        customerId: parseInt(customerId),
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedConsultations = consultations.map((note) => {
      let createdByLabel = '본사';
      let createdByName = note.createdByName || '관리자';

      // createdByType으로 라벨 결정
      if (note.createdByType === 'BRANCH_MANAGER') {
        createdByLabel = '대리점장';
      } else if (note.createdByType === 'SALES_AGENT') {
        createdByLabel = '판매원';
      } else if (note.createdByType === 'admin') {
        createdByLabel = '본사';
      }

      return {
        id: note.id,
        content: note.content,
        consultedAt: note.consultedAt?.toISOString() || note.createdAt.toISOString(),
        nextActionDate: note.nextActionDate?.toISOString() || null,
        nextActionNote: note.nextActionNote,
        statusAfter: note.statusAfter,
        audioFileUrl: note.audioFileUrl,
        createdByLabel,
        createdByName,
        createdAt: note.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, consultations: formattedConsultations });
  } catch (error: any) {
    console.error('[Consultations GET Error]', error);
    return NextResponse.json({ ok: false, error: error.message || '조회 실패' }, { status: 500 });
  }
}

// 상담기록 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: customerId } = await params;
    const auth = await checkAdminAuth();

    if (!auth.isAdmin || !auth.user) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      content,
      consultedAt,
      nextActionDate,
      nextActionNote,
      statusAfter,
      audioFileUrl,
    } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ ok: false, error: '상담 내용을 입력해주세요.' }, { status: 400 });
    }

    // 관리자 정보 가져오기
    const createdByType = 'admin';
    const createdByName = auth.user.name || '관리자';
    const createdBy = auth.user.id;

    // 상담기록 저장
    const note = await prisma.customerNote.create({
      data: {
        customerId: parseInt(customerId),
        createdBy: createdBy,
        createdByType: createdByType,
        createdByName: createdByName,
        content: content.trim(),
        consultedAt: consultedAt ? new Date(consultedAt) : new Date(),
        nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
        nextActionNote: nextActionNote || null,
        statusAfter: statusAfter || null,
        audioFileUrl: audioFileUrl || null,
        isInternal: false,
        updatedAt: new Date(),
      },
    });

    // 상담 후 상태 변경이 있으면 고객 상태도 업데이트
    if (statusAfter) {
      await prisma.user.update({
        where: { id: parseInt(customerId) },
        data: { customerStatus: statusAfter },
      });
    }

    // 다음 조치 날짜가 있으면 고객의 다음 조치 알람도 업데이트
    if (nextActionDate) {
      await prisma.user.update({
        where: { id: parseInt(customerId) },
        data: {
          nextActionDate: new Date(nextActionDate),
          nextActionNote: nextActionNote || null,
        },
      });
    }

    // Google 스프레드시트 자동 백업 (비동기, 에러 무시)
    import('@/lib/google/customer-backup').then(({ backupCustomerToSheet }) => {
      backupCustomerToSheet(parseInt(customerId)).catch((err: any) => {
        console.error('[Google Backup Error]', err);
      });
    });

    return NextResponse.json({
      ok: true,
      consultation: {
        id: note.id,
        content: note.content,
        consultedAt: note.consultedAt?.toISOString(),
        createdAt: note.createdAt.toISOString(),
      },
      message: '상담기록이 저장되었습니다.',
    });
  } catch (error: any) {
    console.error('[Consultations POST Error]', error);
    return NextResponse.json({ ok: false, error: error.message || '저장 실패' }, { status: 500 });
  }
}

/**
 * 관리자용 상담기록 삭제 API
 * DELETE /api/admin/customers/[userId]/consultations?noteId=123
 *
 * 관리자는 모든 상담기록 삭제 가능
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: customerId } = await params;
    const auth = await checkAdminAuth();

    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // URL 파라미터에서 삭제할 상담기록 ID 추출
    const url = new URL(request.url);
    const noteId = url.searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ ok: false, error: '삭제할 상담기록 ID가 필요합니다.' }, { status: 400 });
    }

    const numericNoteId = parseInt(noteId);
    if (isNaN(numericNoteId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 상담기록 ID입니다.' }, { status: 400 });
    }

    // 상담기록 확인
    const note = await prisma.customerNote.findUnique({
      where: { id: numericNoteId },
      select: { id: true, customerId: true },
    });

    if (!note) {
      return NextResponse.json({ ok: false, error: '상담기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 해당 고객의 상담기록인지 확인
    if (note.customerId !== parseInt(customerId)) {
      return NextResponse.json({ ok: false, error: '해당 고객의 상담기록이 아닙니다.' }, { status: 400 });
    }

    // 상담기록 삭제
    await prisma.customerNote.delete({
      where: { id: numericNoteId },
    });

    return NextResponse.json({
      ok: true,
      message: '상담기록이 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('[Consultations DELETE Error]', error);
    return NextResponse.json({ ok: false, error: error.message || '삭제 실패' }, { status: 500 });
  }
}
