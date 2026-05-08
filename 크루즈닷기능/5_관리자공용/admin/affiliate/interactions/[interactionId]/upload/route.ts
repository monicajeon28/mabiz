export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { uploadFileToDrive } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';

/**
 * POST /api/admin/affiliate/interactions/[interactionId]/upload
 * 상담 기록에 파일(녹음 파일 등) 업로드 - Google Drive에 백업
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interactionId: string }> | { interactionId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const interactionId = parseInt(resolvedParams.interactionId, 10);
    if (isNaN(interactionId)) {
      return NextResponse.json({ ok: false, error: 'Invalid interaction ID' }, { status: 400 });
    }

    // 상담 기록 확인
    const interaction = await prisma.affiliateInteraction.findUnique({
      where: { id: interactionId },
      include: {
        AffiliateLead: {
          select: {
            id: true,
            customerName: true,
            customerPhone: true,
            source: true,
          },
        },
      },
    });

    if (!interaction) {
      return NextResponse.json({ ok: false, error: 'Interaction not found' }, { status: 404 });
    }

    // FormData에서 파일 추출
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    // 파일 정보
    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type || 'application/octet-stream';
    const buffer = Buffer.from(await file.arrayBuffer());

    // 파일명 생성: interaction_[ID]_[고객이름]_[날짜]_[원본파일명]
    const customerName = interaction.AffiliateLead?.customerName || 'unknown';
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const safeCustomerName = customerName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const safeFileName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const driveFileName = `interaction_${interactionId}_${safeCustomerName}_${dateStr}_${safeFileName}`;

    // Google Drive에 업로드 (일반 상담 기록 오디오 폴더)
    const folderId = await getDriveFolderId('UPLOADS_AUDIO');

    logger.log('[Interaction Upload] Uploading to Google Drive:', {
      interactionId,
      fileName: driveFileName,
      fileSize,
      mimeType,
      folderId,
    });

    const uploadResult = await uploadFileToDrive({
      folderId,
      fileName: driveFileName,
      mimeType,
      buffer,
      makePublic: false, // 보안을 위해 비공개
    });

    if (!uploadResult.ok || !uploadResult.fileId) {
      console.error('[Interaction Upload] Google Drive upload failed:', uploadResult.error);
      return NextResponse.json(
        { ok: false, error: uploadResult.error || 'Failed to upload file to Google Drive' },
        { status: 500 }
      );
    }

    logger.log('[Interaction Upload] Google Drive upload success:', {
      fileId: uploadResult.fileId,
      url: uploadResult.url,
    });

    // AffiliateMedia 레코드 생성 (DB에 기록)
    const media = await prisma.affiliateMedia.create({
      data: {
        interactionId,
        storagePath: uploadResult.url || `https://drive.google.com/file/d/${uploadResult.fileId}/view`,
        fileName,
        fileSize,
        mimeType,
        visibility: 'INTERNAL',
        uploadedById: user.id,
        metadata: {
          googleDriveFileId: uploadResult.fileId,
          originalFileName: fileName,
          uploadedAt: new Date().toISOString(),
          customerName: interaction.AffiliateLead?.customerName,
          customerPhone: interaction.AffiliateLead?.customerPhone,
        },
      },
    });

    // 스프레드시트에 오디오 URL 전송 (source에 따라 해당 스프레드시트로)
    try {
      const customerPhone = interaction.AffiliateLead?.customerPhone;
      const customerName = interaction.AffiliateLead?.customerName;
      const source = interaction.AffiliateLead?.source || '';

      if (customerPhone) {
        const audioUrl = uploadResult.url || `https://drive.google.com/file/d/${uploadResult.fileId}/view`;
        const timestamp = new Date().toLocaleString('ko-KR');

        // source에 따라 스프레드시트 URL 결정
        const SCRIPT_URLS = {
          PHONE_CONSULT: 'https://script.google.com/macros/s/AKfycbwVYYHKLyNfXwO3fSX19jmb7hF3Bh2oyay7lrlw3mJx42eL9kQANxhwxLrQyzbEj29x/exec',
          GROUP: 'https://script.google.com/macros/s/AKfycbyI7MEAS-fodkb7f8Y_PRUT8SBzDh-fvognlulXe3YeUDHmv0cuHRsNj3ub9YNoMxi9gg/exec',
          MANAGEMENT: 'https://script.google.com/macros/s/AKfycbyZYKPmjQ_IWlAn0onXeUTnyj1DxLqtRJLuD2Lh70QEk_1IR4DkAZW0eM8aLyFJJGid/exec',
          PURCHASED: 'https://script.google.com/macros/s/AKfycbwgZNwZnQwro13ZFfG8LQzqAhIBRV-xA8l_1TpK47vDip2gYKBV7W-aicGpbpwLSUXB/exec',
        };

        // source에 따라 대상 스프레드시트 선택
        let targetUrl = SCRIPT_URLS.MANAGEMENT; // 기본값: 나의고객추가
        let targetName = '나의고객추가';

        if (source.includes('phone-consultation') || source.includes('product-inquiry') || source.startsWith('mall')) {
          targetUrl = SCRIPT_URLS.PHONE_CONSULT;
          targetName = '전화상담고객';
        } else if (source.includes('landing') || source.includes('partner-landing')) {
          targetUrl = SCRIPT_URLS.GROUP;
          targetName = '나의그룹고객';
        } else if (source.includes('purchase') || source.includes('payment')) {
          targetUrl = SCRIPT_URLS.PURCHASED;
          targetName = '구매고객관리';
        }
        // partner-manual, trial, assigned, received 등은 기본값 MANAGEMENT 사용

        const formData = new URLSearchParams();
        formData.append('action', 'updateAudioUrl');
        formData.append('timestamp', timestamp);
        formData.append('name', customerName || '');
        formData.append('phone', customerPhone);
        formData.append('audioUrl', audioUrl);
        formData.append('fileName', fileName);

        logger.log('[Interaction Upload] 스프레드시트에 오디오 URL 전송:', {
          name: customerName,
          phone: customerPhone,
          source,
          targetSheet: targetName,
          audioUrl,
        });

        const googleResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        const googleResult = await googleResponse.text();
        logger.log(`[Interaction Upload] ${targetName} 스프레드시트 응답:`, googleResult);
      }
    } catch (googleError) {
      console.error('[Interaction Upload] 스프레드시트 전송 실패:', googleError);
      // 스프레드시트 전송 실패해도 업로드는 성공으로 처리
    }

    return NextResponse.json({
      ok: true,
      message: 'File uploaded successfully',
      media: {
        id: media.id,
        fileName: media.fileName,
        fileSize: media.fileSize,
        mimeType: media.mimeType,
        storagePath: media.storagePath,
        googleDriveFileId: uploadResult.fileId,
      },
    });
  } catch (error: any) {
    console.error('[Interaction Upload] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/affiliate/interactions/[interactionId]/upload
 * 상담 기록에 첨부된 파일 목록 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interactionId: string }> | { interactionId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const interactionId = parseInt(resolvedParams.interactionId, 10);
    if (isNaN(interactionId)) {
      return NextResponse.json({ ok: false, error: 'Invalid interaction ID' }, { status: 400 });
    }

    // 해당 상담 기록의 미디어 파일 조회
    const mediaFiles = await prisma.affiliateMedia.findMany({
      where: { interactionId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        storagePath: true,
        createdAt: true,
        metadata: true,
      },
    });

    return NextResponse.json({
      ok: true,
      files: mediaFiles.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        url: file.storagePath,
        createdAt: file.createdAt.toISOString(),
        googleDriveFileId: (file.metadata as any)?.googleDriveFileId || null,
        isBackedUp: !!(file.metadata as any)?.googleDriveFileId,
      })),
    });
  } catch (error: any) {
    console.error('[Interaction Upload GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
