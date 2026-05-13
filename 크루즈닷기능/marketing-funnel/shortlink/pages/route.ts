// app/p/[code]/route.ts
// mabizschool.com/p/[code] 숏링크 리다이렉트

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SHORTLINKS_FILE = path.join(process.cwd(), 'data', 'shortlinks.json');

// 숏링크 파일 읽기
async function readShortLinks(): Promise<any> {
  try {
    const content = await fs.readFile(SHORTLINKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { links: [] };
  }
}

// 클릭 카운트 증가
async function incrementClickCount(code: string): Promise<void> {
  try {
    const data = await readShortLinks();
    const links = data.links || [];
    const link = links.find((l: any) => l.code === code);
    if (link) {
      link.clickCount = (link.clickCount || 0) + 1;
      link.lastClickedAt = new Date().toISOString();
      await fs.writeFile(SHORTLINKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('[ShortLink] Click count increment error:', error);
  }
}

/**
 * GET /p/[code]
 * 숏링크 리다이렉트
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    if (!code) {
      const fallbackUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://www.cruisedot.co.kr';
      return NextResponse.redirect(fallbackUrl, 302);
    }

    const data = await readShortLinks();
    const links = data.links || [];
    const link = links.find((l: any) => l.code === code);

    if (!link || !link.url) {
      // 숏링크를 찾을 수 없으면 메인 페이지로 리다이렉트
      const fallbackUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://www.cruisedot.co.kr';
      return NextResponse.redirect(fallbackUrl, 302);
    }

    // 클릭 카운트 증가 (비동기로 처리)
    incrementClickCount(code).catch(console.error);

    // 원본 URL로 리다이렉트
    return NextResponse.redirect(link.url, 302);
  } catch (error: any) {
    console.error('[ShortLink] Redirect error:', error);
    const fallbackUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://www.cruisedot.co.kr';
    return NextResponse.redirect(fallbackUrl, 302);
  }
}

