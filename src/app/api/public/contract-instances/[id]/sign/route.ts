import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const RATE_LIMIT_MAP = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
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

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      select: { status: true, expiresAt: true, signedAt: true, boundData: true },
    });

    if (!instance) {
      return NextResponse.json({ ok: false, message: '계약서 없음' }, { status: 404 });
    }

    // 이미 서명됨
    if (instance.status === 'SIGNED' || instance.status === 'COMPLETED') {
      return NextResponse.json(
        {
          ok: true,
          message: '이미 서명 완료된 계약서입니다',
          alreadySigned: true,
        },
        { status: 200 }
      );
    }

    // 만료 확인
    if (instance.expiresAt && new Date() > instance.expiresAt) {
      return NextResponse.json({ ok: false, message: '서명 기한 만료' }, { status: 410 });
    }

    // 서명 저장 (원자적 처리)
    const signedAt = new Date();
    await prisma.contractInstance.update({
      where: { id },
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
