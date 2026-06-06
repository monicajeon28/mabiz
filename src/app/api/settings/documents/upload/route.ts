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
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

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

    const userName = ctx.mallUser?.name ?? ctx.member?.displayName ?? ctx.userId;
    const typeLabel = type === 'idCard' ? '신분증' : '통장사본';

    // KST 타임스탬프
    const nowKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const stamp = `${nowKst.getUTCFullYear()}${String(nowKst.getUTCMonth()+1).padStart(2,'0')}${String(nowKst.getUTCDate()).padStart(2,'0')}_${String(nowKst.getUTCHours()).padStart(2,'0')}${String(nowKst.getUTCMinutes()).padStart(2,'0')}`;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const fileName = `${typeLabel}_${stamp}.${ext}`;

    // Drive 업로드
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

    // DB 저장: GMcruise 연동 → GmAffiliateContract, 미연동 → MemberDocument
    if (ctx.mallUser?.id) {
      const gmUserId = ctx.mallUser.id;
      const contract = await prisma.gmAffiliateContract.findFirst({
        where: { userId: gmUserId },
        select: { id: true },
      });
      const docData = type === 'idCard'
        ? { idCardPath: viewUrl, idCardOriginalName: file.name }
        : { bankbookPath: viewUrl, bankbookOriginalName: file.name };

      if (contract) {
        await prisma.gmAffiliateContract.updateMany({ where: { id: contract.id, userId: gmUserId }, data: docData });
      } else {
        await prisma.gmAffiliateContract.create({
          data: { userId: gmUserId, name: userName, phone: '', ...docData },
        });
      }
    } else if (ctx.organizationId) {
      // MemberDocument에 upsert (docType = 'idCard' | 'bankbook')
      const existing = await prisma.memberDocument.findFirst({
        where: { userId: ctx.userId, organizationId: ctx.organizationId, docType: type },
        select: { id: true },
      });
      if (existing) {
        await prisma.memberDocument.updateMany({
          where: { id: existing.id, userId: ctx.userId, organizationId: ctx.organizationId },
          data: { fileUrl: viewUrl, fileName, storagePath: viewUrl, fileSize: file.size, uploadedAt: new Date() },
        });
      } else {
        await prisma.memberDocument.create({
          data: {
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            docType: type,
            fileName,
            fileUrl: viewUrl,
            storagePath: viewUrl,
            fileSize: file.size,
          },
        });
      }
    }

    logger.log('[settings/documents/upload] 서류 업로드 완료', { type, userName, fileName });
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

    // GMcruise 연동: GmAffiliateContract 조회
    if (ctx.mallUser?.id) {
      const contract = await prisma.gmAffiliateContract.findFirst({
        where: { userId: ctx.mallUser.id },
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
    }

    // GMcruise 미연동: MemberDocument 조회
    if (ctx.organizationId) {
      const docs = await prisma.memberDocument.findMany({
        where: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          docType: { in: ['idCard', 'bankbook'] },
        },
        select: { docType: true, fileUrl: true, fileName: true },
      });
      const idDoc      = docs.find(d => d.docType === 'idCard');
      const bankDoc    = docs.find(d => d.docType === 'bankbook');
      return NextResponse.json({
        ok: true,
        hasIdCard:    !!idDoc,
        hasBankBook:  !!bankDoc,
        idCardUrl:    idDoc?.fileUrl    ?? null,
        bankbookUrl:  bankDoc?.fileUrl  ?? null,
        idCardName:   idDoc?.fileName   ?? null,
        bankbookName: bankDoc?.fileName ?? null,
      });
    }

    // organizationId도 없는 경우(GLOBAL_ADMIN 비조직): 빈 상태
    return NextResponse.json({
      ok: true, hasIdCard: false, hasBankBook: false,
      idCardUrl: null, bankbookUrl: null, idCardName: null, bankbookName: null,
    });
  } catch (err) {
    logger.error('[settings/documents/upload GET] 오류', { err });
    return NextResponse.json({ ok: false, message: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
