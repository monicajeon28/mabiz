import { NextResponse } from 'next/server';
import { generateCsrfToken, storeToken } from '@/lib/csrf';
import { getAuthContext } from '@/lib/rbac';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    const token = generateCsrfToken();

    // 생성된 토큰을 사용자 세션에 저장 (Redis 우선, 실패 시 메모리 폴백)
    await storeToken(ctx.userId, token);

    return NextResponse.json(
      {
        ok: true,
        token,
        expiresIn: 3600, // 1시간
      },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
