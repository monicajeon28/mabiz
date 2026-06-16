export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { listSubFolders, listMdFilesInFolder, readDriveFileContent } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

// 페르소나 자동 감지
function detectPersona(content: string): string {
  if (/부모님|어머님|아버님|효도|어머니|아버지/.test(content)) return 'FILIAL_DUTY';
  if (/신혼|허니문|결혼|기념일/.test(content)) return 'NEWLYWEDS';
  if (/가격|비싸|할인|저렴/.test(content)) return 'PRICE_SENSITIVE';
  if (/혼자|1인|친구들/.test(content)) return 'SINGLE_ADVENTURE';
  if (/재구매|또|다시|이번에도/.test(content)) return 'REPURCHASE';
  return 'FILIAL_DUTY';
}

// 성 추출 (첫 글자)
function extractLastName(name: string): string {
  const korean = name.match(/[가-힣]/);
  return korean ? korean[0] : '익';
}

// 전화번호 마스킹
function maskPhone(text: string): string {
  return text.replace(/01[0-9]-?\d{3,4}-?\d{4}/g, '010-****-****');
}

export async function GET(req: Request) {
  // Vercel Cron 인증
  const authHeader = (await headers()).get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_CALL_UPLOAD_FOLDER_ID;
  if (!rootFolderId) {
    return NextResponse.json({ ok: false, message: 'GOOGLE_DRIVE_CALL_UPLOAD_FOLDER_ID 미설정' });
  }

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // 조직 폴더 목록 (대리점별)
    const orgFolders = await listSubFolders(rootFolderId);
    logger.log('[sync-drive-calls] 대리점 폴더 수:', { count: orgFolders.length });

    for (const orgFolder of orgFolders) {
      // 해당 대리점 조직 찾기
      const org = await prisma.organization.findFirst({
        where: { name: { contains: orgFolder.name } },
        select: { id: true },
      });
      const orgId = org?.id ?? null;

      // 판매원 폴더 목록
      const agentFolders = await listSubFolders(orgFolder.id);

      for (const agentFolder of agentFolders) {
        const agentLastName = extractLastName(agentFolder.name);

        // MD 파일 목록 (최근 30일 이내)
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const files = await listMdFilesInFolder(agentFolder.id, since);

        for (const file of files) {
          try {
            // 이미 DB에 있는지 확인 (driveFileId 기준)
            const existing = await prisma.aiCallLog.findFirst({
              where: { driveFileId: file.id },
            });
            if (existing) { skipped++; continue; }

            // 파일 내용 읽기
            const content = await readDriveFileContent(file.id);
            if (!content || content.length < 50) { skipped++; continue; }

            const masked = maskPhone(content).slice(0, 10000);
            const personaType = detectPersona(content);

            // DB 저장
            await prisma.$transaction(async (tx) => {
              const callLog = await tx.aiCallLog.create({
                data: {
                  organizationId: orgId ?? 'unknown',
                  agentUserId: `drive-sync:${agentFolder.name}`,
                  agentLastName,
                  productType: 'GENERAL',
                  personaType,
                  rawTextMasked: masked,
                  converted: false,
                  analysisStatus: 'DONE',
                  driveFileId: file.id,
                },
              });
              await tx.aiCallAnalysis.create({
                data: {
                  callLogId: callLog.id,
                  personaDetected: personaType,
                  personaConfidence: 0.6,
                  scores: {},
                  keyPhrases: [],
                  strengths: [],
                  weaknesses: [],
                  objectionTypes: [],
                },
              });
            });
            synced++;
          } catch (e) {
            errors++;
            logger.error('[sync-drive-calls] 파일 처리 오류', { file: file.name, err: e });
          }
        }
      }
    }

    logger.log('[sync-drive-calls] 완료', { synced, skipped, errors });
    return NextResponse.json({ ok: true, synced, skipped, errors });

  } catch (e) {
    logger.error('[sync-drive-calls] 오류', { err: e });
    return NextResponse.json({ ok: false, message: '동기화 오류' }, { status: 500 });
  }
}
