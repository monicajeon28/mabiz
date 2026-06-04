export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

const DOCUMENTS_FOLDER_ID = process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID!;

/**
 * POST: 문서 업로드
 * multipart/form-data로 파일과 메타데이터 받음
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const description = formData.get('description') as string;
    const contactId = formData.get('contactId') as string | null;

    if (!file || !title) {
      return NextResponse.json(
        { ok: false, message: '파일과 제목은 필수입니다' },
        { status: 400 }
      );
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      return NextResponse.json(
        { ok: false, message: '파일 크기는 10MB 이하여야 합니다' },
        { status: 400 }
      );
    }

    // 조직별 폴더 확인
    if (!DOCUMENTS_FOLDER_ID) {
      return NextResponse.json(
        { ok: false, message: 'Google Drive 폴더 ID 설정 안됨' },
        { status: 500 }
      );
    }
    const orgFolder = await findOrCreateFolder(orgId, DOCUMENTS_FOLDER_ID);

    // Google Drive에 파일 업로드
    const drive = getDriveClient();
    const buffer = await file.arrayBuffer();
    const uploadedFile = await drive.files.create({
      requestBody: {
        name: `${title}_${Date.now()}_${file.name}`,
        parents: [orgFolder],
      },
      media: {
        mimeType: file.type,
        body: Readable.from(Buffer.from(buffer)),
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    const driveFileId = uploadedFile.data.id!;

    // DB에 Document 생성 — 실패 시 Drive 파일 정리
    let document: Awaited<ReturnType<typeof prisma.document.create>>;
    try {
      document = await prisma.document.create({
        data: {
          organizationId: orgId,
          contactId: contactId || null,
          title,
          category: category || null,
          description: description || null,
          driveFileId,
          fileSize: file.size,
          mimeType: file.type,
          createdBy: ctx.userId,
          status: 'DRAFT',
        },
      });
    } catch (dbErr) {
      await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true }).catch(() => {});
      throw dbErr;
    }

    // DocumentVersion 생성 (v1) — 실패 시 Drive 파일 정리
    try {
      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          driveFileId,
          uploadedBy: ctx.userId,
        },
      });
    } catch (dbErr) {
      await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true }).catch(() => {});
      throw dbErr;
    }

    return NextResponse.json(
      {
        ok: true,
        data: document,
        message: '문서가 업로드되었습니다',
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/documents/upload]', { err });
    return NextResponse.json(
      { ok: false, message: String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET: 문서 목록 (조직별)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');

    const where: Prisma.DocumentWhereInput = { organizationId: orgId };
    if (status) where.status = status as Prisma.DocumentWhereInput['status'];
    if (category) where.category = category;

    const documents = await prisma.document.findMany({
      where,
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        approvals: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, data: documents });
  } catch (err) {
    logger.error('[GET /api/documents/upload]', { err });
    return NextResponse.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
