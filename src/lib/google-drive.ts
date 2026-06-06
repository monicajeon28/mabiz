/**
 * Google Drive 서비스 계정 유틸
 * - 콜기록 백업: Drive > 콜기록 > {userId}_{name}/ > {고객명}.txt
 */
import { google } from 'googleapis';
import { logger } from '@/lib/logger';
import { parseServiceAccount } from '@/lib/parse-service-account';

const CALL_LOG_FOLDER_ID =
  process.env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID ?? '1g8vNIeXEVHkavQnlBAXsBMkVZB_Y29Fk';

function getDriveClient() {
  if (!CALL_LOG_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_CALL_LOG_FOLDER_ID is not configured');
  }

  // 검증된 단일 인증(parse-service-account: GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 우선)
  // → 다른 Drive 백업(서류/이미지)과 동일 서비스계정으로 통일. 공유드라이브 접근 보장.
  const credentials = parseServiceAccount(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * 폴더 찾기 (없으면 생성)
 */
async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const drive = getDriveClient();
  // 기존 폴더 탐색 (Shared Drive 포함)
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }
  // 없으면 생성
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id!;
}

/**
 * txt 파일 찾기 (있으면 fileId 반환, 없으면 null)
 */
async function findFile(name: string, parentId: string): Promise<string | null> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

/**
 * 콜 스크립트 백업 (관리자용)
 * 경로: call-scripts / {segment} / {phase}.txt
 */
export async function backupCallScriptToGoogleDrive(params: {
  segment: string;
  phase: string;
  phaseName: string;
  content: string;
  psychologyPrinciples: string[];
  pasonaPhase: string;
  tips: string[];
}): Promise<{ fileId: string; viewUrl: string }> {
  const drive = getDriveClient();
  const { segment, phase, phaseName, content, psychologyPrinciples, pasonaPhase, tips } = params;

  // 1. call-scripts 폴더 찾기 / 생성
  const scriptsFolderId = await findOrCreateFolder('call-scripts', CALL_LOG_FOLDER_ID);

  // 2. 세그먼트별 폴더 찾기 / 생성
  const segmentFolderId = await findOrCreateFolder(segment, scriptsFolderId);

  // 3. txt 파일 내용 생성
  const lines = [
    `=== 콜 스크립트 ===`,
    `세그먼트: ${segment}`,
    `단계: Phase ${phase} - ${phaseName}`,
    `PASONA 단계: ${pasonaPhase}`,
    `백업일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    '',
    '--- 스크립트 ---',
    content,
    '',
    '--- 심리학 원리 ---',
    psychologyPrinciples.map((p) => `• ${p}`).join('\n'),
    '',
    '--- 팁 ---',
    tips.map((t) => `• ${t}`).join('\n'),
  ];
  const fileContent = lines.join('\n');

  // 4. 파일명
  const safeName = `phase_${phase}_${phaseName.replace(/[/\\?%*:|"<>]/g, '_')}.txt`;
  const existingId = await findFile(safeName, segmentFolderId);

  let fileId: string;
  if (existingId) {
    // 기존 파일 덮어쓰기
    const updated = await drive.files.update({
      fileId: existingId,
      media: { mimeType: 'text/plain; charset=utf-8', body: fileContent },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    fileId = updated.data.id!;
  } else {
    // 신규 파일 생성
    const created = await drive.files.create({
      requestBody: { name: safeName, parents: [segmentFolderId] },
      media: { mimeType: 'text/plain; charset=utf-8', body: fileContent },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    fileId = created.data.id!;
  }

  const meta = await drive.files.get({
    fileId,
    fields: 'webViewLink',
    supportsAllDrives: true,
  });

  return {
    fileId,
    viewUrl: meta.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}

/**
 * 콜 기록 백업
 * 경로: 콜기록 / {userId}_{displayName} / {customerName}.txt
 */
export async function backupCallLogsToGoogleDrive(params: {
  userId: string;
  displayName: string;
  customerName: string;
  customerPhone: string;
  callLogs: {
    createdAt: Date | string;
    result: string | null;
    convictionScore: number | null;
    content: string | null;
    nextAction: string | null;
  }[];
}): Promise<{ fileId: string; viewUrl: string }> {
  const drive = getDriveClient();
  const { userId, displayName, customerName, customerPhone, callLogs } = params;

  // 1. 관리자 폴더 찾기 / 생성
  const managerFolderName = `${userId}_${displayName}`;
  const managerFolderId = await findOrCreateFolder(managerFolderName, CALL_LOG_FOLDER_ID);

  // 2. txt 파일 내용 생성
  const RESULT_KO: Record<string, string> = {
    INTERESTED: '관심있음', PENDING: '보류', REJECTED: '거절', RESCHEDULED: '재콜예약',
  };
  const lines = [
    `고객명: ${customerName}`,
    `전화번호: ${customerPhone}`,
    `백업일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    `총 ${callLogs.length}건`,
    '='.repeat(50),
    '',
    ...callLogs.flatMap((log, i) => {
      const dt = new Date(log.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const result = log.result ? (RESULT_KO[log.result] ?? log.result) : '';
      const score = log.convictionScore ? ` | 확신도 ${log.convictionScore}점` : '';
      return [
        `[${i + 1}] ${dt}${result ? ' | ' + result : ''}${score}`,
        log.content ? `내용: ${log.content}` : '',
        log.nextAction ? `다음액션: ${log.nextAction}` : '',
        '',
      ].filter(Boolean);
    }),
  ];
  const content = lines.join('\n');

  // 3. 파일명 (고객명.txt, 특수문자 제거)
  const safeName = `${customerName.replace(/[/\\?%*:|"<>]/g, '_')}.txt`;
  const existingId = await findFile(safeName, managerFolderId);

  let fileId: string;
  if (existingId) {
    // 기존 파일 덮어쓰기
    const updated = await drive.files.update({
      fileId: existingId,
      media: { mimeType: 'text/plain; charset=utf-8', body: content },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    fileId = updated.data.id!;
  } else {
    // 신규 파일 생성
    const created = await drive.files.create({
      requestBody: { name: safeName, parents: [managerFolderId] },
      media: { mimeType: 'text/plain; charset=utf-8', body: content },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    fileId = created.data.id!;
  }

  const meta = await drive.files.get({
    fileId,
    fields: 'webViewLink',
    supportsAllDrives: true,
  });

  return {
    fileId,
    viewUrl: meta.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}
