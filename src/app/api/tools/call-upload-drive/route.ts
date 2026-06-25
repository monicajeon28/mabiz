export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

function sanitizeName(raw: string): string {
  return raw.replace(/[/\\:*?"<>|]/g, '_').replace(/\.\./g, '_').trim().slice(0, 50);
}

// POST /api/tools/call-upload-drive
// 통화 내용을 Google Drive에 MD 파일로 업로드
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json() as { callText?: string; converted?: boolean; productType?: string };
    const callText = body.callText?.trim() ?? '';

    if (!callText) {
      return NextResponse.json({ ok: false, message: '업로드할 통화 내용이 없습니다.' }, { status: 400 });
    }
    if (callText.length > 20000) {
      return NextResponse.json({ ok: false, message: '통화 내용이 20,000자를 초과합니다.' }, { status: 400 });
    }

    if (Buffer.byteLength(callText, 'utf8') > 150000) {
      return NextResponse.json({ ok: false, message: '파일 크기가 너무 큽니다.' }, { status: 400 });
    }

    const agentName = ctx.member?.displayName ?? null;
    if (!agentName) {
      return NextResponse.json({ ok: false, message: '대리점장 이름을 찾을 수 없습니다.' }, { status: 400 });
    }

    // GLOBAL_ADMIN은 organizationId가 null일 수 있으므로 '본사'로 고정
    let orgName: string;
    if (!ctx.organizationId) {
      orgName = '본사';
    } else {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });
      orgName = org?.name ?? ctx.organizationId;
    }

    // KST 타임스탬프
    const nowKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const yyyy = nowKst.getUTCFullYear();
    const MM   = String(nowKst.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(nowKst.getUTCDate()).padStart(2, '0');
    const hh   = String(nowKst.getUTCHours()).padStart(2, '0');
    const min  = String(nowKst.getUTCMinutes()).padStart(2, '0');
    const ss   = String(nowKst.getUTCSeconds()).padStart(2, '0');

    const safeOrgName   = sanitizeName(orgName);
    const safeAgentName = sanitizeName(agentName);
    const fileName      = `통화_${yyyy}${MM}${dd}_${hh}${min}${ss}.md`;

    const mdContent = [
      '---',
      `date: ${yyyy}-${MM}-${dd}`,
      `time: ${hh}:${min}:${ss} KST`,
      `agent: ${agentName}`,
      `organization: ${orgName}`,
      `productType: ${body.productType ?? 'UNKNOWN'}`,
      `converted: ${body.converted ?? false}`,
      '---',
      '',
      '## 통화내용',
      '',
      callText.replace(/`/g, "'"),
    ].join('\n');

    const rootFolderId = process.env.GOOGLE_DRIVE_CALL_UPLOAD_FOLDER_ID;
    if (!rootFolderId) {
      logger.error('[call-upload-drive] GOOGLE_DRIVE_CALL_UPLOAD_FOLDER_ID 미설정');
      return NextResponse.json({ ok: false, message: 'Drive 폴더 설정 오류' }, { status: 500 });
    }

    const orgFolderId   = await findOrCreateFolder(safeOrgName, rootFolderId);
    const agentFolderId = await findOrCreateFolder(safeAgentName, orgFolderId);

    const drive = getDriveClient();
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [agentFolderId],
      },
      media: {
        mimeType: 'text/markdown',
        body: Readable.from(Buffer.from(mdContent, 'utf8')),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const viewUrl = created.data.webViewLink
      ?? `https://drive.google.com/file/d/${created.data.id}/view`;

    logger.log('[call-upload-drive] MD 업로드 완료', { agent: agentName, org: orgName, fileName });

    // AiCallLog에 driveFileId 연결 (가장 최근 같은 대리점장의 driveFileId 없는 로그)
    try {
      const recentLog = await prisma.aiCallLog.findFirst({
        where: {
          ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
          agentUserId: ctx.userId,
          driveFileId: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      if (recentLog) {
        const agentLastName = agentName.trim().charAt(0);
        await prisma.aiCallLog.update({
          where: { id: recentLog.id },
          data: {
            driveFileId: created.data.id ?? null,
            agentLastName,
          },
        });
      }
    } catch {
      // driveFileId 저장 실패해도 업로드 자체는 성공으로 처리
    }

    return NextResponse.json({ ok: true, viewUrl });
  } catch (err) {
    logger.error('[call-upload-drive] 오류', { err });
    return NextResponse.json({ ok: false, message: '업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
