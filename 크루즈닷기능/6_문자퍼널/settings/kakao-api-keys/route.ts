export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';

const SESSION_COOKIE = 'cg.sid.v2';
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'admin-settings.json');

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return null;

    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return null;

    return { id: session.userId, role: session.role };
  } catch (error) {
    console.error('[Kakao API Keys] Auth check error:', error);
    return null;
  }
}

// 설정 파일 읽기/쓰기
async function readSettingsFile(): Promise<any> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { kakaoApiKeys: [] };
  }
}

async function writeSettingsFile(data: any): Promise<void> {
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// POST: API Key 발급신청
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { identifier } = body;

    if (!identifier) {
      return NextResponse.json({ ok: false, error: 'Identifier를 입력해주세요.' }, { status: 400 });
    }

    const settings = await readSettingsFile();
    const apiKeys = settings.kakaoApiKeys || [];

    const newApiKey = {
      id: `apikey_${Date.now()}`,
      identifier,
      key: process.env.ALIGO_API_KEY || '', // 환경변수에서 로드
      registeredAt: new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    };

    apiKeys.push(newApiKey);
    await writeSettingsFile({ ...settings, kakaoApiKeys: apiKeys });

    return NextResponse.json({ ok: true, apiKey: newApiKey });
  } catch (error) {
    console.error('[Kakao API Keys POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'API Key 발급신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
