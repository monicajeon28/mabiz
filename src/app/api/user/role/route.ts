/**
 * GET /api/user/role
 * 현재 로그인한 사용자의 역할을 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ok: true, role: session.role },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[GET /api/user/role]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
