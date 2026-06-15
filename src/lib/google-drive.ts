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

/**
 * Contact 백업: Google Sheets에 CSV 형식으로 저장
 *
 * 폴더 구조:
 *   {BACKUP_FOLDER_ID}/
 *     └─ {organizationId}_contacts_backup_{date}.csv
 */
export async function backupContactsToDrive(
  organizationId: string,
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    sourceId?: string | null;
    visibility?: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
  accessToken: string
): Promise<{ sheetId: string; count: number; backupAt: Date }> {
  const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID ?? '1mHxV8rQ9pL4kN2jZ5wB8cY6dE9fG3hI7';

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. 백업 폴더 찾기 (없으면 생성)
    const backupFolderId = await findOrCreateFolder(
      `Backup_${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      BACKUP_FOLDER_ID
    );

    // 2. CSV 콘텐츠 생성
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Source ID', 'Visibility', 'Created At', 'Updated At'];
    const rows = [
      headers,
      ...contacts.map(c => [
        c.id,
        c.name,
        c.phone,
        c.email || '',
        c.sourceId || '',
        c.visibility || 'SHARED',
        new Date(c.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        new Date(c.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ]),
    ];

    const csvContent = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // 3. Google Sheets 생성
    const fileName = `${organizationId}_contacts_${new Date().getTime()}`;
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: fileName,
          locale: 'ko_KR',
        },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'Contacts',
            },
            data: [
              {
                rowData: rows.map(row => ({
                  values: row.map(cell => ({
                    userEnteredValue: {
                      stringValue: String(cell),
                    },
                  })),
                })),
              },
            ],
          },
        ],
      },
    });

    const sheetId = spreadsheet.data.spreadsheetId!;

    // 4. Backup 폴더로 이동
    const updateResult = await drive.files.update({
      fileId: sheetId,
      addParents: backupFolderId,
      fields: 'id, parents',
      supportsAllDrives: true,
    });

    logger.info('[GoogleDrive] Contact 백업 완료', {
      organizationId,
      sheetId,
      contactCount: contacts.length,
    });

    return {
      sheetId,
      count: contacts.length,
      backupAt: new Date(),
    };
  } catch (err) {
    logger.error('[GoogleDrive] Contact 백업 실패', err);
    throw err;
  }
}

/**
 * 파트너 어필리에이트 계약서 PDF + 서명 이미지를 Google Drive에 저장
 *
 * 폴더 구조:
 *   {PARTNER_CONTRACTS_FOLDER_ID}/
 *     └─ contracts_{partnerId}_{partnerName}/
 *       ├─ contract.pdf
 *       └─ signature.png (선택)
 */
export async function backupPartnerContractToGoogleDrive(
  partnerId: string,
  partnerName: string,
  pdfBuffer: Buffer,
  signatureImageBuffer?: Buffer
): Promise<{ contractFileId: string; signatureFileId?: string; folderPath: string }> {
  const PARTNER_CONTRACTS_FOLDER_ID =
    process.env.PARTNER_CONTRACTS_FOLDER_ID ?? '1pWt8VN9WD_79eJcp4_SmFfbekMOcykTT';

  const drive = getDriveClient();

  // 1. 파트너별 폴더 생성/조회
  const folderName = `contracts_${partnerId}_${partnerName.replace(/\s+/g, '_')}`;
  const partnerFolderId = await findOrCreateFolder(folderName, PARTNER_CONTRACTS_FOLDER_ID);

  // 2. 계약서 PDF 업로드
  const pdfFileName = `contract_${partnerId}.pdf`;
  const pdfResponse = await drive.files.create({
    requestBody: {
      name: pdfFileName,
      mimeType: 'application/pdf',
      parents: [partnerFolderId],
      description: `Partner: ${partnerName}, Created: ${new Date().toISOString()}`,
    },
    media: {
      mimeType: 'application/pdf',
      body: Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const contractFileId = pdfResponse.data.id!;

  // 3. 서명 이미지 업로드 (선택)
  let signatureFileId: string | undefined;
  if (signatureImageBuffer) {
    const sigFileName = `signature_${partnerId}.png`;
    const sigResponse = await drive.files.create({
      requestBody: {
        name: sigFileName,
        mimeType: 'image/png',
        parents: [partnerFolderId],
        description: `Signature for Partner: ${partnerName}`,
      },
      media: {
        mimeType: 'image/png',
        body: Buffer.isBuffer(signatureImageBuffer)
          ? signatureImageBuffer
          : Buffer.from(signatureImageBuffer),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    signatureFileId = sigResponse.data.id!;
  }

  logger.log('[GoogleDrive] Partner 계약서 저장 완료', {
    partnerId,
    partnerName,
    folderPath: `${PARTNER_CONTRACTS_FOLDER_ID}/${partnerFolderId}`,
    contractFileId,
    signatureFileId: signatureFileId || 'N/A',
  });

  return {
    contractFileId,
    signatureFileId,
    folderPath: `${PARTNER_CONTRACTS_FOLDER_ID}/${partnerFolderId}`,
  };
}
