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
    console.error('[Server IPs] Auth check error:', error);
    return null;
  }
}

// 설정 파일 읽기/쓰기
async function readSettingsFile(): Promise<any> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { serverIps: [] };
  }
}

async function writeSettingsFile(data: any): Promise<void> {
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// DELETE: 서버 IP 삭제
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const params = await context.params;
    const settings = await readSettingsFile();
    const serverIps = (settings.serverIps || []).filter((ip: any) => ip.id !== params.id);
    
    await writeSettingsFile({ ...settings, serverIps });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Server IPs DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'IP 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
