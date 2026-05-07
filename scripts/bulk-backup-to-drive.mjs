/**
 * 기존 콜 기록 전체 Drive 백업
 * node scripts/bulk-backup-to-drive.mjs
 *
 * - DB에서 콜 기록 있는 고객 전체 조회
 * - 각 고객별 txt 파일 Drive에 업로드
 * - 폴더명: {userId}_{displayName} (기본: admin_전혜선)
 */
import { readFileSync } from 'fs';
import { google } from 'googleapis';
import pg from 'pg';

// ── 환경변수 로드 ──────────────────────────────────────────
const envContent = readFileSync('.env.mabiz', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0 && !line.startsWith('#')) {
    const key = line.substring(0, eqIdx).trim();
    const val = line.substring(eqIdx + 1).trim().replace(/^"|"$/g, '');
    env[key] = val;
  }
}

const FOLDER_ID = env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID;
const EMAIL     = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const KEY       = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
const DB_URL    = env.DATABASE_URL.replace(/\\n/g, '').trim();

// ── Drive 클라이언트 ───────────────────────────────────────
const auth = new google.auth.GoogleAuth({
  credentials: { client_email: EMAIL, private_key: KEY },
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// ── 폴더 찾기/생성 ─────────────────────────────────────────
async function findOrCreateFolder(name, parentId) {
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  if (res.data.files?.length > 0) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id;
}

// ── 파일 찾기 ──────────────────────────────────────────────
async function findFile(name, parentId) {
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

// ── txt 내용 생성 ──────────────────────────────────────────
const RESULT_KO = {
  INTERESTED: '관심있음', PENDING: '보류', REJECTED: '거절', RESCHEDULED: '재콜예약',
};
function buildContent(contact, logs) {
  const lines = [
    `고객명: ${contact.name}`,
    `전화번호: ${contact.phone ?? ''}`,
    `백업일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    `총 ${logs.length}건`,
    '='.repeat(50),
    '',
  ];
  logs.forEach((log, i) => {
    const dt = new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const result = log.result ? (RESULT_KO[log.result] ?? log.result) : '';
    const score  = log.conviction_score ? ` | 확신도 ${log.conviction_score}점` : '';
    lines.push(`[${i + 1}] ${dt}${result ? ' | ' + result : ''}${score}`);
    if (log.content)     lines.push(`내용: ${log.content}`);
    if (log.next_action) lines.push(`다음액션: ${log.next_action}`);
    lines.push('');
  });
  return lines.join('\n');
}

// ── 메인 ───────────────────────────────────────────────────
async function run() {
  // 1. DB 연결
  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ DB 연결 완료\n');

  // 2. 콜 기록이 있는 고객 목록
  const { rows: contacts } = await client.query(`
    SELECT DISTINCT
      c.id,
      c.name,
      c.phone,
      CASE WHEN ga.id IS NOT NULL THEN 'admin' ELSE om.id END AS user_id,
      COALESCE(ga."displayName", om."displayName", cl."userId") AS display_name
    FROM "Contact" c
    JOIN "CallLog" cl ON cl."contactId" = c.id
    LEFT JOIN "GlobalAdmin" ga ON ga.id = cl."userId"
    LEFT JOIN "OrganizationMember" om ON om.id = cl."userId"
    ORDER BY c.name
  `);
  console.log(`📋 콜 기록 있는 고객: ${contacts.length}명\n`);

  // 3. 관리자 폴더 캐시 (userId_displayName → folderId)
  const folderCache = {};

  let success = 0, failed = 0;

  for (const contact of contacts) {
    try {
      // 각 고객의 콜 기록
      const { rows: logs } = await client.query(`
        SELECT "createdAt" AS created_at, result, "convictionScore" AS conviction_score,
               content, "nextAction" AS next_action
        FROM "CallLog"
        WHERE "contactId" = $1
        ORDER BY "createdAt" DESC
      `, [contact.id]);

      const folderName = `${contact.user_id}_${contact.display_name}`;

      // 관리자 폴더
      if (!folderCache[folderName]) {
        folderCache[folderName] = await findOrCreateFolder(folderName, FOLDER_ID);
        console.log(`📁 폴더: ${folderName} (${folderCache[folderName]})`);
      }
      const managerFolderId = folderCache[folderName];

      // txt 파일
      const safeName = `${contact.name.replace(/[/\\?%*:|"<>]/g, '_')}.txt`;
      const content  = buildContent(contact, logs);
      const existingId = await findFile(safeName, managerFolderId);

      if (existingId) {
        await drive.files.update({
          fileId: existingId,
          media: { mimeType: 'text/plain; charset=utf-8', body: content },
          supportsAllDrives: true,
        });
        console.log(`  ♻️  업데이트: ${safeName} (${logs.length}건)`);
      } else {
        await drive.files.create({
          requestBody: { name: safeName, parents: [managerFolderId] },
          media: { mimeType: 'text/plain; charset=utf-8', body: content },
          supportsAllDrives: true,
        });
        console.log(`  ✅ 생성: ${safeName} (${logs.length}건)`);
      }
      success++;
    } catch (e) {
      console.error(`  ❌ 실패: ${contact.name} — ${e.message}`);
      failed++;
    }
  }

  await client.end();
  console.log(`\n🎉 완료! 성공 ${success}건 / 실패 ${failed}건`);
}

run().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
