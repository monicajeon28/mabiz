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
    console.error('[Kakao Managers] Auth check error:', error);
    return null;
  }
}

// 설정 파일 읽기/쓰기
async function readSettingsFile(): Promise<any> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { kakaoApiManagers: [] };
  }
}

async function writeSettingsFile(data: any): Promise<void> {
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// POST: 담당자 추가
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, notifyEnabled } = body;

    if (!name || !phone) {
      return NextResponse.json({ ok: false, error: '성명과 전화번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const settings = await readSettingsFile();
    const managers = settings.kakaoApiManagers || [];

    const newManager = {
      id: `manager_${Date.now()}`,
      name,
      phone,
      notifyEnabled: notifyEnabled !== false,
      registeredAt: new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    };

    managers.push(newManager);
    await writeSettingsFile({ ...settings, kakaoApiManagers: managers });

    return NextResponse.json({ ok: true, manager: newManager });
  } catch (error) {
    console.error('[Kakao Managers POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '담당자 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
