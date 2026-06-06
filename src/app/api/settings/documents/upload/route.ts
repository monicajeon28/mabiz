export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const DOC_FOLDER_ID = process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID ?? '';

// POST /api/settings/documents/upload
// 신분증 또는 통장사본을 Drive에 업로드하고 GmAffiliateContract에 경로 저장
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (!ctx.mallUser?.id) {
      return NextResponse.json({ ok: false, message: 'GMcruise 계정 연동이 필요합니다.' }, { status: 403 });
    }

    const formData = await req.formData();
    const type = formData.get('type') as string | null;       // 'idCard' | 'bankbook'
    const file = formData.get('file') as File | null;

    if (!type || !['idCard', 'bankbook'].includes(type)) {
      return NextResponse.json({ ok: false, message: '서류 유형이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ ok: false, message: '파일을 첨부해주세요.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, message: 'JPG, PNG, PDF 파일만 업로드 가능합니다.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, message: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 });
    }

    if (!DOC_FOLDER_ID) {
      logger.error('[settings/documents/upload] GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID 미설정');
      return NextResponse.json({ ok: false, message: 'Drive 폴더 설정 오류' }, { status: 500 });
    }

    const userId = ctx.mallUser.id;
    const userName = ctx.mallUser.name ?? `user_${userId}`;
    const typeLabel = type === 'idCard' ? '신분증' : '통장사본';

    // KST 타임스탬프
    const nowKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const stamp = `${nowKst.getUTCFullYear()}${String(nowKst.getUTCMonth()+1).padStart(2,'0')}${String(nowKst.getUTCDate()).padStart(2,'0')}_${String(nowKst.getUTCHours()).padStart(2,'0')}${String(nowKst.getUTCMinutes()).padStart(2,'0')}`;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const fileName = `${typeLabel}_${stamp}.${ext}`;

    // Drive 업로드: 루트폴더 / 사용자폴더 / 파일
    const safeName = userName.replace(/[/\\:*?"<>|]/g, '_').slice(0, 50);
    const userFolderId = await findOrCreateFolder(safeName, DOC_FOLDER_ID);

    const buf = Buffer.from(await file.arrayBuffer());
    const drive = getDriveClient();
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [userFolderId] },
      media: { mimeType: file.type, body: Readable.from(buf) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const viewUrl = created.data.webViewLink
      ?? `https://drive.google.com/file/d/${created.data.id}/view`;

    // GmAffiliateContract 업데이트 (userId 기준)
    const contract = await prisma.gmAffiliateContract.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (contract) {
      const updateData = type === 'idCard'
        ? { idCardPath: viewUrl, idCardOriginalName: file.name }
        : { bankbookPath: viewUrl, bankbookOriginalName: file.name };

      await prisma.gmAffiliateContract.update({
        where: { id: contract.id },
        data: updateData,
      });
    } else {
      // 계약서 없으면 신규 생성 (최소 필드만)
      const createData = type === 'idCard'
        ? { idCardPath: viewUrl, idCardOriginalName: file.name }
        : { bankbookPath: viewUrl, bankbookOriginalName: file.name };

      await prisma.gmAffiliateContract.create({
        data: {
          userId,
          name: userName,
          phone: '',
          ...createData,
        },
      });
    }

    logger.log('[settings/documents/upload] 서류 업로드 완료', { type, userId, fileName });

    return NextResponse.json({ ok: true, viewUrl, type });
  } catch (err) {
    logger.error('[settings/documents/upload] 오류', { err });
    return NextResponse.json({ ok: false, message: '업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// GET /api/settings/documents/upload — 현재 서류 제출 상태 조회
export async function GET() {
  try {
    const ctx = await getAuthContext();

    if (!ctx.mallUser?.id) {
      return NextResponse.json({ ok: false, message: 'GMcruise 계정 연동이 필요합니다.' }, { status: 403 });
    }

    const userId = ctx.mallUser.id;
    const contract = await prisma.gmAffiliateContract.findFirst({
      where: { userId },
      select: {
        idCardPath: true,
        idCardOriginalName: true,
        bankbookPath: true,
        bankbookOriginalName: true,
      },
    });

    return NextResponse.json({
      ok: true,
      hasIdCard: !!contract?.idCardPath,
      hasBankBook: !!contract?.bankbookPath,
      idCardUrl: contract?.idCardPath ?? null,
      bankbookUrl: contract?.bankbookPath ?? null,
      idCardName: contract?.idCardOriginalName ?? null,
      bankbookName: contract?.bankbookOriginalName ?? null,
    });
  } catch (err) {
    logger.error('[settings/documents/upload GET] 오류', { err });
    return NextResponse.json({ ok: false, message: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
