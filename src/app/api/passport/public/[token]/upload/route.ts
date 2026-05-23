export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const token = (await params).token;
    if (!token || token.length < 10) {
      return NextResponse.json({ ok: false, error: '잘못된 토큰입니다.' }, { status: 400 });
    }

    const submission = await prisma.gmPassportSubmission.findFirst({
      where: { token },
      select: {
        id: true,
        tokenExpiresAt: true,
        extraData: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ ok: false, error: '토큰이 유효하지 않습니다.' }, { status: 404 });
    }

    if (submission.tokenExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: '업로드 가능한 시간이 만료되었습니다.' }, { status: 410 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: '업로드할 파일이 필요합니다.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    // 통일된 여권 백업 폴더에 업로드
    const passportFolderId = process.env.PASSPORT_DRIVE_FOLDER_ID || '';
    if (!passportFolderId) {
      return NextResponse.json(
        { ok: false, error: 'PASSPORT_DRIVE_FOLDER_ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Submission별 하위 폴더 생성
    const submissionFolderName = `passport_submission_${submission.id}`;
    let submissionFolderId: string;
    try {
      submissionFolderId = await findOrCreateFolder(submissionFolderName, passportFolderId);
    } catch (folderError) {
      return NextResponse.json(
        { ok: false, error: `폴더 생성 실패: ${(folderError as Error).message}` },
        { status: 500 }
      );
    }

    // 구글 드라이브에 업로드
    const drive = getDriveClient();
    const { Readable } = await import('stream');
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    const driveResponse = await drive.files.create({
      requestBody: {
        name: safeFileName,
        parents: [submissionFolderId],
        mimeType: file.type,
      },
      media: {
        mimeType: file.type,
        body: readable,
      },
      fields: 'id,webViewLink',
    });

    const uploadedFileId = driveResponse.data.id;
    const uploadedUrl = driveResponse.data.webViewLink || `https://drive.google.com/file/d/${uploadedFileId}/view`;

    if (!uploadedFileId) {
      return NextResponse.json(
        { ok: false, error: '업로드 실패: 파일 ID를 받지 못했습니다.' },
        { status: 500 }
      );
    }

    const existingExtra =
      submission.extraData && typeof submission.extraData === 'object'
        ? (submission.extraData as Record<string, unknown>)
        : {};
    const passportFiles = Array.isArray(existingExtra.passportFiles)
      ? existingExtra.passportFiles
      : [];
    passportFiles.push({
      fileName: safeFileName,
      url: uploadedUrl,
      fileId: uploadedFileId,
      uploadedAt: new Date().toISOString(),
    });

    await prisma.gmPassportSubmission.update({
      where: { id: submission.id },
      data: {
        driveFolderUrl: uploadedUrl,
        extraData: {
          ...(existingExtra ?? {}),
          passportFiles,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      file: {
        fileName: safeFileName,
        url: uploadedUrl,
      },
      files: passportFiles,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Passport] POST /passport/:token/upload error:', { err });
    return NextResponse.json(
      { ok: false, error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
