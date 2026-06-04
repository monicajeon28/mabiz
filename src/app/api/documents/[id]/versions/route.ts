import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { getDriveClient } from '@/lib/drive-client';

const DOCUMENTS_FOLDER_ID = process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID!;

/**
 * 폴더 찾기
 */
async function findFolder(name: string, parentId: string): Promise<string | null> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

/**
 * GET: 문서 버전 목록
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, message: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    if (doc.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { versionNumber: 'desc' },
    });

    return NextResponse.json({ ok: true, data: versions });
  } catch (err) {
    logger.error('[GET /api/documents/versions]', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, message: String(err) }, { status: 500 });
  }
}

/**
 * POST: 새 버전 업로드
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = ctx.organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, message: '조직 정보 없음' }, { status: 400 });
    }

    const { id } = await params;

    const doc = await prisma.document.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, message: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    if (doc.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    if (doc.status !== 'DRAFT') {
      return NextResponse.json(
        { ok: false, message: '초안 상태만 버전 업로드 가능합니다' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json({ ok: false, message: '파일 필수' }, { status: 400 });
    }

    // 최신 버전 번호 조회
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId: id },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    // Google Drive 업로드
    const drive = getDriveClient();
    const orgFolder = await findFolder(orgId, DOCUMENTS_FOLDER_ID);
    if (!orgFolder) {
      return NextResponse.json(
        { ok: false, message: '조직 폴더를 찾을 수 없습니다' },
        { status: 500 }
      );
    }

    const buffer = await file.arrayBuffer();
    const uploadedFile = await drive.files.create({
      requestBody: {
        name: `${doc.title}_v${newVersionNumber}_${Date.now()}_${file.name}`,
        parents: [orgFolder],
      },
      media: {
        mimeType: file.type,
        body: Buffer.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    const driveFileId = uploadedFile.data.id!;

    // DocumentVersion 생성 + document 업데이트 — DB 실패 시 Drive 파일 정리
    let version: Awaited<ReturnType<typeof prisma.documentVersion.create>>;
    try {
      version = await prisma.documentVersion.create({
        data: {
          documentId: id,
          versionNumber: newVersionNumber,
          driveFileId,
          description: description || null,
          uploadedBy: ctx.userId,
        },
      });

      // 최신 드라이브 파일 ID 업데이트
      await prisma.document.update({
        where: { id },
        data: {
          driveFileId,
          fileSize: file.size,
          mimeType: file.type,
          updatedBy: ctx.userId,
        },
      });
    } catch (dbErr) {
      await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true }).catch(() => {});
      throw dbErr;
    }

    return NextResponse.json(
      { ok: true, data: version, message: '새 버전이 업로드되었습니다' },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/documents/versions]', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
