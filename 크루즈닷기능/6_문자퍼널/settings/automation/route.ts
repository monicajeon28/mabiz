export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Admin Automation Settings] Auth check error:', error);
    return null;
  }
}

// GET: 자동화 설정 조회
export async function GET() {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const automationConfigs = await prisma.systemConfig.findMany({
      where: {
        configKey: {
          startsWith: 'automation_',
        },
      },
    });

    const settings: Record<string, boolean> = {};
    automationConfigs.forEach((config) => {
      const key = config.configKey.replace('automation_', '');
      settings[key] = config.configValue === 'true' || config.configValue === '1';
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error('[Admin Automation Settings GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '자동화 설정 조회 실패' },
      { status: 500 }
    );
  }
}

// POST: 자동화 설정 업데이트
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { settings } = body as { settings: Record<string, boolean> };

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { ok: false, error: '설정 데이터가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const updated: string[] = [];
    const errors: string[] = [];

    // 각 자동화 설정 업데이트
    for (const [key, value] of Object.entries(settings)) {
      try {
        const configKey = `automation_${key}`;
        const configValue = value ? 'true' : 'false';

        await prisma.systemConfig.upsert({
          where: { configKey },
          update: { configValue },
          create: {
            configKey,
            configValue,
            description: `자동화 설정: ${key}`,
          },
        });

        updated.push(key);
        console.log(`[Admin Automation Settings] Updated ${key} = ${value}`);
      } catch (error) {
        const errorMsg = `자동화 설정 ${key} 업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        errors.push(errorMsg);
        console.error(`[Admin Automation Settings] ${errorMsg}`, error);
      }
    }

    if (errors.length > 0 && updated.length === 0) {
      return NextResponse.json(
        { ok: false, error: '모든 자동화 설정 업데이트에 실패했습니다.', errors },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      message: `${updated.length}개의 자동화 설정이 업데이트되었습니다.`,
    });
  } catch (error) {
    console.error('[Admin Automation Settings POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '자동화 설정 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


