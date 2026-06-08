import { google } from 'googleapis';
import { parseServiceAccount } from '../src/lib/parse-service-account';

const LANDING_FOLDER = process.env.LANDING_PAGES_DRIVE_FOLDER_ID ?? '1PpZbApjr5rZRlyP5onwkRUxz6X9gFPZz';

async function main() {
  console.log('1. 서비스계정 키 파싱...');
  let creds;
  try {
    creds = parseServiceAccount(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY);
    console.log('   ✅ 파싱 성공:', creds.client_email ?? '(이메일 없음)');
  } catch (e) {
    console.log('   ❌ 파싱 실패:', (e as Error).message);
    return;
  }

  console.log('2. Drive 토큰 발급...');
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  let token;
  try {
    const client = await auth.getClient() as { getAccessToken(): Promise<{ token?: string | null }> };
    const t = await client.getAccessToken();
    token = t?.token;
    console.log('   ✅ 토큰 발급:', token ? '성공' : '실패(빈토큰)');
  } catch (e) {
    console.log('   ❌ 토큰 실패:', (e as Error).message);
    return;
  }

  console.log('3. 랜딩 폴더 접근 테스트 (Resumable 세션 생성)...');
  try {
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'image/gif',
        },
        body: JSON.stringify({ name: 'test.gif', parents: [LANDING_FOLDER] }),
      }
    );
    if (res.ok) {
      console.log('   ✅ Resumable 세션 생성 성공! Location:', res.headers.get('location')?.slice(0, 60));
    } else {
      const err = await res.text();
      console.log(`   ❌ Drive API ${res.status}:`, err.slice(0, 300));
    }
  } catch (e) {
    console.log('   ❌ 요청 실패:', (e as Error).message);
  }

  console.log('4. 폴더 메타데이터 조회...');
  try {
    const drive = google.drive({ version: 'v3', auth });
    const meta = await drive.files.get({ fileId: LANDING_FOLDER, fields: 'id,name,mimeType', supportsAllDrives: true });
    console.log('   ✅ 폴더:', meta.data.name, meta.data.mimeType);
  } catch (e) {
    console.log('   ❌ 폴더 조회 실패:', (e as Error).message);
  }
}
main().catch(e => console.error('전체 에러:', e.message));
