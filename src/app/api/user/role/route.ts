/**
 * GET /api/user/role
 * 현재 로그인한 사용자의 역할을 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';

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
    console.error('[GET /api/user/role]', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
