import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const RATE_LIMIT_MAP = new Map<string, RateLimitRecord>();
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL = 1 * 60 * 1000; // 1분마다 정리

function cleanupExpiredRecords(): void {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL) return;

  let removedCount = 0;
  for (const [ip, record] of RATE_LIMIT_MAP.entries()) {
    if (now > record.resetTime) {
      RATE_LIMIT_MAP.delete(ip);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.log('[RateLimit] 정리 완료', {
      removedCount,
      mapSize: RATE_LIMIT_MAP.size,
    });
  }

  lastCleanupTime = now;
}

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  cleanupExpiredRecords(); // ← 매 요청마다 체크

  const now = Date.now();
  const record = RATE_LIMIT_MAP.get(ip);

  if (!record || now > record.resetTime) {
    RATE_LIMIT_MAP.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

    // Rate limit: IP당 5회/분
    if (!checkRateLimit(ip, 5, 60000)) {
      return NextResponse.json({ ok: false, message: '요청 제한 초과' }, { status: 429 });
    }

    const body = (await req.json()) as {
      signerName?: string;
      signatureImage: string; // base64 PNG
    };

    if (!body.signatureImage) {
      return NextResponse.json(
        { ok: false, message: '서명 이미지 필수' },
        { status: 400 }
      );
    }

    // 크기 검증 (500KB 이하)
    const sizeInBytes = Buffer.byteLength(body.signatureImage, 'utf8');
    if (sizeInBytes > 500 * 1024) {
      return NextResponse.json(
        { ok: false, message: '이미지가 너무 큽니다 (500KB 이하)' },
        { status: 400 }
      );
    }

    // 만료 여부만 먼저 확인 (expiresAt 체크)
    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      select: { expiresAt: true, boundData: true },
    });

    if (!instance) {
      return NextResponse.json({ ok: false, message: '계약서 없음' }, { status: 404 });
    }

    // 만료 확인
    if (instance.expiresAt && new Date() > instance.expiresAt) {
      return NextResponse.json({ ok: false, message: '서명 기한 만료' }, { status: 410 });
    }

    // 서명 저장 (원자적 처리 - Race Condition 방지)
    // updateMany를 사용하여 WHERE 조건을 원자적으로 처리
    const signedAt = new Date();
    const updated = await prisma.contractInstance.updateMany({
      where: {
        id,
        status: { in: ['DRAFT', 'SENT'] }, // 서명 가능 상태만
      },
      data: {
        status: 'SIGNED',
        signedAt,
        signatureImage: body.signatureImage,
        boundData: {
          ...(instance.boundData as any),
          signerName: body.signerName ?? '',
          signedAt: signedAt.toISOString(),
        },
      },
    });

    // updateMany가 0개 업데이트한 경우 = 이미 서명됨 또는 상태 변경됨
    if (updated.count === 0) {
      return NextResponse.json(
        {
          ok: true,
          message: '이미 서명 완료된 계약서입니다',
          alreadySigned: true,
        },
        { status: 200 }
      );
    }

    logger.log('[PublicContractSign] 서명 완료', {
      id,
      signerName: body.signerName ?? '비회원',
      ip,
    });

    return NextResponse.json({
      ok: true,
      signedAt: signedAt.toISOString(),
      message: '서명이 완료되었습니다!',
    });
  } catch (e) {
    logger.log('[PublicContractSign] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
