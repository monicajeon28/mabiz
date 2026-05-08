export const dynamic = 'force-dynamic';

/**
 * 관리자 - 크루즈닷몰 핵심 지표 개요 API
 * GET /api/admin/mall-overview
 *
 * 5개 지표를 Promise.all 병렬 조회 후 단일 응답 반환
 * Redis 캐시 60초 적용
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { getCache, setCache } from '@/lib/redis';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

interface PurchaseItem {
  id: number;
  buyerName: string;
  buyerTel: string;
  productName: string | null;
  amount: number;
  status: string;
  createdAt: Date;
}

interface InquiryItem {
  id: number;
  name: string;
  phone: string;
  productCode: string;
  message: string | null;
  createdAt: Date;
}

interface OverviewData {
  todayPurchases: { count: number; list: PurchaseItem[] };
  todayInquiries: { count: number; list: InquiryItem[] };
  apisCompleted: { count: number };
  passport: { completed: number; pending: number };
  topKeywords: { keyword: string; count: number }[];
}

interface CachedPayload {
  data: OverviewData;
  cachedAt: string;
}

// ─── 관리자 권한 확인 ─────────────────────────────────────────────────────────

async function verifyAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true },
  });

  if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
    return null;
  }

  return user;
}

// ─── 마스킹 유틸 ──────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  return phone.substring(0, 4) + '***';
}

// ─── GET 핸들러 ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    // ── Redis 캐시 확인 ──
    const CACHE_KEY = 'mall-overview:v1';
    const cached = await getCache<CachedPayload>(CACHE_KEY);
    if (cached) {
      logger.debug('[mall-overview] 캐시 히트', { cachedAt: cached.cachedAt });
      return NextResponse.json({ ok: true, ...cached });
    }

    // ── 오늘 날짜 범위 (KST 기준, UTC+9) ──
    // KST 00:00 = UTC 전날 15:00, KST 23:59:59.999 = UTC 당일 14:59:59.999
    const kstOffset = 9 * 60 * 60 * 1000; // 9시간(ms)
    const kstNow = new Date(Date.now() + kstOffset);
    const year = kstNow.getUTCFullYear();
    const month = kstNow.getUTCMonth();
    const day = kstNow.getUTCDate();
    const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - kstOffset);
    const todayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - kstOffset);

    // ── 5개 지표 병렬 조회 ──
    const [
      purchasesResult,
      inquiriesResult,
      apisResult,
      passportResult,
      keywordsResult,
    ] = await Promise.all([
      // 1. 오늘 구매 (입금확인 중 포함)
      (async () => {
        try {
          return await prisma.payment.findMany({
            where: {
              createdAt: { gte: todayStart, lte: todayEnd },
              status: { in: ['completed', 'pending', 'paid'] },
            },
            select: {
              id: true,
              buyerName: true,
              buyerTel: true,
              productName: true,
              amount: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
        } catch (err) {
          logger.warn('[mall-overview] 오늘 구매 조회 실패', { error: err instanceof Error ? err.message : String(err) });
          return [];
        }
      })(),

      // 2. 오늘 문의
      (async () => {
        try {
          return await prisma.productInquiry.findMany({
            where: {
              createdAt: { gte: todayStart, lte: todayEnd },
            },
            select: {
              id: true,
              name: true,
              phone: true,
              productCode: true,
              message: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
        } catch (err) {
          logger.warn('[mall-overview] 오늘 문의 조회 실패', { error: err instanceof Error ? err.message : String(err) });
          return [];
        }
      })(),

      // 3. APIS 완성 고객 (전체 누적) — count로 직접 집계
      (async () => {
        try {
          return await prisma.reservation.count({
            where: {
              pnrStatus: 'COMPLETED',
              passportStatus: 'COMPLETED',
            },
          });
        } catch (err) {
          logger.warn('[mall-overview] APIS 완성 고객 조회 실패', { error: err instanceof Error ? err.message : String(err) });
          return 0;
        }
      })(),

      // 4. 여권 완료/미완료 현황 — Reservation.passportStatus 기준
      (async (): Promise<[number, number]> => {
        try {
          const [completed, pending] = await Promise.all([
            prisma.reservation.count({ where: { passportStatus: 'COMPLETED' } }),
            prisma.reservation.count({ where: { passportStatus: { not: 'COMPLETED' } } }),
          ]);
          return [completed, pending];
        } catch (err) {
          logger.warn('[mall-overview] 여권 현황 조회 실패', { error: err instanceof Error ? err.message : String(err) });
          return [0, 0];
        }
      })(),

      // 5. 검색어 유입 TOP 5 (최근 30일, utmTerm 기준)
      (async () => {
        try {
          return await prisma.affiliateLink.groupBy({
            by: ['utmTerm'],
            where: {
              utmTerm: { not: null },
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
            _count: { utmTerm: true },
            orderBy: { _count: { utmTerm: 'desc' } },
            take: 5,
          });
        } catch (err) {
          logger.warn('[mall-overview] 검색어 유입 조회 실패', { error: err instanceof Error ? err.message : String(err) });
          return [];
        }
      })(),
    ]);

    // ── 데이터 가공 ──
    const maskedPurchases: PurchaseItem[] = purchasesResult.map((p) => ({
      id: p.id,
      buyerName: p.buyerName,
      buyerTel: maskPhone(p.buyerTel),
      productName: p.productName,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt,
    }));

    const maskedInquiries: InquiryItem[] = inquiriesResult.map((q) => ({
      ...q,
      phone: maskPhone(q.phone),
    }));

    const [passportCompleted, passportPending] = passportResult;

    const topKeywords = keywordsResult
      .filter((k): k is typeof k & { utmTerm: string } => k.utmTerm !== null)
      .map((k) => ({
        keyword: k.utmTerm,
        count: k._count.utmTerm,
      }));

    const data: OverviewData = {
      todayPurchases: {
        count: maskedPurchases.length,
        list: maskedPurchases,
      },
      todayInquiries: {
        count: maskedInquiries.length,
        list: maskedInquiries,
      },
      apisCompleted: {
        count: apisResult,
      },
      passport: {
        completed: passportCompleted,
        pending: passportPending,
      },
      topKeywords,
    };

    const cachedAt = new Date().toISOString();
    const payload: CachedPayload = { data, cachedAt };

    // ── Redis 캐시 저장 (60초) ──
    await setCache(CACHE_KEY, payload, 60);

    logger.debug('[mall-overview] 조회 완료', {
      todayPurchases: data.todayPurchases.count,
      todayInquiries: data.todayInquiries.count,
      apisCompleted: data.apisCompleted.count,
      passportCompleted: data.passport.completed,
      passportPending: data.passport.pending,
      topKeywordsCount: data.topKeywords.length,
    });

    return NextResponse.json({ ok: true, data, cachedAt });
  } catch (err) {
    logger.warn('[mall-overview] 처리 중 오류', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
