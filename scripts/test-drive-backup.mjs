/**
 * 서비스 계정 Drive 백업 테스트
 * node scripts/test-drive-backup.mjs
 */
import { google } from 'googleapis';
import { readFileSync } from 'fs';

// .env.mabiz에서 직접 읽기
const envContent = readFileSync('.env.mabiz', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)="?([^"]*)"?\s*$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const FOLDER_ID = env.GOOGLE_DRIVE_CALL_LOG_FOLDER_ID;
const EMAIL     = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const KEY       = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');

console.log('📁 콜기록 폴더:', FOLDER_ID);
console.log('📧 서비스 계정:', EMAIL);

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: EMAIL, private_key: KEY },
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

async function run() {
  // 1. 테스트 관리자 폴더 생성
  console.log('\n1️⃣  테스트 폴더 생성 중...');
  const folder = await drive.files.create({
    requestBody: {
      name: 'test_관리자테스트',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [FOLDER_ID],
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });
  console.log('✅ 폴더 생성:', folder.data.name, folder.data.webViewLink);

  // 2. 테스트 txt 파일 생성
  console.log('\n2️⃣  테스트 txt 파일 생성 중...');
  const file = await drive.files.create({
    requestBody: {
      name: '테스트고객.txt',
      parents: [folder.data.id],
    },
    media: {
      mimeType: 'text/plain; charset=utf-8',
      body: '고객명: 테스트고객\n콜기록: 서비스 계정 백업 테스트 성공!\n',
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });
  console.log('✅ 파일 생성:', file.data.name, file.data.webViewLink);
  console.log('\n🎉 테스트 완료! Drive에서 확인하세요.');
}

run().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
