import { NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/csrf';

export async function GET() {
  try {
    const token = generateCsrfToken();

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
