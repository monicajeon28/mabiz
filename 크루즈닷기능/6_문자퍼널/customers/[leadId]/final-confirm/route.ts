import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadFileToDrive, findOrCreateFolder } from '@/lib/google-drive';
import { requirePartnerContext, getPartnerLead, PartnerApiError } from '@/app/api/partner/_utils';

/**
 * 파트너가 고객의 최종확인요청을 제출하는 API
 * - 콜녹음 파일을 구글 드라이브에 업로드
 * - Reservation의 finalConfirmStatus를 REQUESTED로 변경
 */

// POST: 최종확인 요청 제출
export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    // 파트너 인증 및 프로필 확인
    const { profile, sessionUser } = await requirePartnerContext();

    const leadId = parseInt(params.leadId, 10);
    if (isNaN(leadId)) {
      return NextResponse.json({ ok: false, error: '잘못된 고객 ID입니다.' }, { status: 400 });
    }

    // AffiliateLead 조회 (소유권 검증 포함)
    const baseLead = await getPartnerLead(profile.id, leadId, {}, profile.type);

    // 추가 정보 조회 (AffiliateSale, Reservation)
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      include: {
        AffiliateSale: {
          include: {
            Reservation: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 해당 고객의 예약 찾기
    const reservation = lead.AffiliateSale?.find(s => s.Reservation)?.Reservation;

    if (!reservation) {
      return NextResponse.json({ ok: false, error: '해당 고객의 예약 정보가 없습니다.' }, { status: 404 });
    }

    // 이미 요청 중이거나 승인된 경우
    if ((reservation as any).finalConfirmStatus === 'REQUESTED') {
      return NextResponse.json({ ok: false, error: '이미 최종확인 요청 중입니다.' }, { status: 400 });
    }
    if ((reservation as any).finalConfirmStatus === 'APPROVED') {
      return NextResponse.json({ ok: false, error: '이미 최종확인이 완료되었습니다.' }, { status: 400 });
    }

    // FormData에서 파일 추출
    const formData = await request.formData();
    const audioFile = formData.get('audioFile') as File | null;
    const note = formData.get('note') as string || '';

    let audioUrl: string | null = null;
    let audioDriveUrl: string | null = null;

    // 콜녹음 파일이 있으면 구글 드라이브에 업로드
    if (audioFile) {
      try {
        // 최종확인 녹음파일 폴더 생성/조회
        const folderResult = await findOrCreateFolder('최종확인_녹음파일');
        if (!folderResult.ok || !folderResult.folderId) {
          throw new Error('폴더 생성 실패');
        }

        // 파일명 생성
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const customerName = lead.customerName || 'unknown';
        const fileName = `최종확인_${customerName}_${timestamp}_${audioFile.name}`;

        // 파일 업로드
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        const uploadResult = await uploadFileToDrive({
          folderId: folderResult.folderId,
          fileName,
          mimeType: audioFile.type || 'audio/mpeg',
          buffer,
          makePublic: false,
        });

        if (uploadResult.ok && uploadResult.fileId) {
          audioUrl = (uploadResult as any).fileUrl || uploadResult.url || null;
          audioDriveUrl = `https://drive.google.com/file/d/${uploadResult.fileId}/view`;
        }
      } catch (uploadError) {
        console.error('[Final Confirm] Audio upload error:', uploadError);
        // 업로드 실패해도 요청은 진행
      }
    }

    // Reservation 업데이트
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        finalConfirmStatus: 'REQUESTED',
        finalConfirmRequestedAt: new Date(),
        finalConfirmRequestedById: profile.id,
        finalConfirmAudioUrl: audioUrl,
        finalConfirmAudioDriveUrl: audioDriveUrl,
      } as any,
    });

    // 상담 기록에도 추가
    await prisma.affiliateInteraction.create({
      data: {
        leadId: leadId,
        profileId: profile.id,
        userId: sessionUser.id,
        interactionType: '최종확인요청',
        occurredAt: new Date(),
        note: note || '최종확인 요청이 제출되었습니다.',
      },
    });

    return NextResponse.json({
      ok: true,
      message: '최종확인 요청이 제출되었습니다. 본사 승인을 기다려주세요.',
      audioUrl: audioDriveUrl,
    });

  } catch (error: any) {
    console.error('[Final Confirm] Error:', error);
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 최종확인 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    // 파트너 인증 및 프로필 확인
    const { profile } = await requirePartnerContext();

    const leadId = parseInt(params.leadId, 10);
    if (isNaN(leadId)) {
      return NextResponse.json({ ok: false, error: '잘못된 고객 ID입니다.' }, { status: 400 });
    }

    // 소유권 검증
    await getPartnerLead(profile.id, leadId, {}, profile.type);

    // AffiliateLead와 연결된 예약 조회
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      include: {
        AffiliateSale: {
          include: {
            Reservation: {
              select: {
                id: true,
                finalConfirmStatus: true,
                finalConfirmRequestedAt: true,
                finalConfirmApprovedAt: true,
                finalConfirmRejectedAt: true,
                finalConfirmRejectionReason: true,
                finalConfirmAudioUrl: true,
                finalConfirmAudioDriveUrl: true,
                passportStatus: true,
                pnrStatus: true,
              } as any,
            },
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    const reservation = lead.AffiliateSale?.find(s => s.Reservation)?.Reservation;

    return NextResponse.json({
      ok: true,
      hasReservation: !!reservation,
      finalConfirm: reservation ? {
        status: (reservation as any).finalConfirmStatus || 'PENDING',
        requestedAt: (reservation as any).finalConfirmRequestedAt,
        approvedAt: (reservation as any).finalConfirmApprovedAt,
        rejectedAt: (reservation as any).finalConfirmRejectedAt,
        rejectionReason: (reservation as any).finalConfirmRejectionReason,
        audioUrl: (reservation as any).finalConfirmAudioDriveUrl,
        passportStatus: reservation.passportStatus,
        pnrStatus: reservation.pnrStatus,
      } : null,
    });

  } catch (error: any) {
    console.error('[Final Confirm GET] Error:', error);
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
