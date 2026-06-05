export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { buildSearchIndex } from '@/constants/products';

interface UnifiedResult {
  id: string;
  source: 'qa' | 'script' | 'product';
  question: string;
  answer: string;
  category: string;
  score: number;
}

// ── Product 검색 인덱스 캐싱 (1시간 TTL) ──
let productIndexCache: ReturnType<typeof buildSearchIndex> | null = null;
let productIndexCachedAt = 0;
const PRODUCT_CACHE_TTL = 60 * 60 * 1000;
function getProductIndex() {
  const now = Date.now();
  if (!productIndexCache || now - productIndexCachedAt > PRODUCT_CACHE_TTL) {
    productIndexCache = buildSearchIndex();
    productIndexCachedAt = now;
  }
  return productIndexCache;
}

// ── Rate limit (IP당 1분 30회) ──
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || now >= e.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (e.count >= 30) return false;
  e.count++;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const ip =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    if (!checkRate(ip)) {
      return NextResponse.json({ ok: false, message: 'too many requests' }, { status: 429 });
    }

    const q = (req.nextUrl.searchParams.get('q')?.trim() ?? '').substring(0, 100);
    const limit = Math.min(
      Math.max(parseInt(req.nextUrl.searchParams.get('limit') ?? '8', 10) || 8, 1),
      20,
    );
    if (!q) {
      return NextResponse.json({
        ok: true,
        data: [],
        meta: { total: 0, sources: { qa: 0, script: 0, product: 0 } },
      });
    }

    const qLower = q.toLowerCase();
    const results: UnifiedResult[] = [];

    // ── 1. SalesPlaybook (콜스크립트, 가중치 +100) ──
    const playbooks = await prisma.salesPlaybook.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, type: true, title: true, content: true },
      take: 20,
    });
    for (const p of playbooks) {
      const exact = p.title.toLowerCase().includes(qLower) ? 50 : 0;
      results.push({
        id: `script-${p.id}`,
        source: 'script',
        question: p.title,
        answer: p.content,
        category: p.type,
        score: 100 + exact,
      });
    }

    // ── 2. Product Training (교육, 가중치 +50) ──
    const productIndex = getProductIndex();
    for (let i = 0; i < productIndex.length; i++) {
      const item = productIndex[i];
      const inContent = item.content.toLowerCase().includes(qLower);
      const inKeywords = Array.isArray(item.keywords)
        ? item.keywords.some((k) => k.toLowerCase().includes(qLower))
        : false;
      const inLabel = item.label.toLowerCase().includes(qLower);
      if (inContent || inKeywords || inLabel) {
        results.push({
          id: `product-${item.productCode}-${item.type}-${i}`,
          source: 'product',
          question: `${item.productName} · ${item.label}`,
          answer: item.content,
          category: item.productName,
          score: 50 + (inLabel ? 50 : 0),
        });
      }
    }

    // ── 3. BotGuideAnswer (Q&A, 가중치 +0) ──
    const qas = await prisma.botGuideAnswer.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: q, mode: 'insensitive' } },
          { answer: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, question: true, answer: true, category: true },
      take: 20,
    });
    for (const a of qas) {
      const exact = a.question.toLowerCase().includes(qLower) ? 50 : 0;
      results.push({
        id: `qa-${a.id}`,
        source: 'qa',
        question: a.question,
        answer: a.answer,
        category: a.category,
        score: 0 + exact,
      });
    }

    // 점수 내림차순 정렬 + limit
    results.sort((a, b) => b.score - a.score);
    const sliced = results.slice(0, limit);

    return NextResponse.json({
      ok: true,
      data: sliced,
      meta: {
        total: sliced.length,
        sources: {
          qa: sliced.filter((r) => r.source === 'qa').length,
          script: sliced.filter((r) => r.source === 'script').length,
          product: sliced.filter((r) => r.source === 'product').length,
        },
      },
    });
  } catch (err) {
    logger.error('[GET /api/tools/unified-search]', { err });
    return NextResponse.json({ ok: false, error: '검색 실패' }, { status: 500 });
  }
}
