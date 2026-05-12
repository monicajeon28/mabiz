import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

export function GET(req: NextRequest) {
  const qs = req.nextUrl.search; // ?ref=xxx 등 쿼리 유지
  redirect(`/landing/index.html${qs}`);
}
