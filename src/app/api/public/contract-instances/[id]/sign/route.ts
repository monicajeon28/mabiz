import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logContractAction } from '@/lib/contract-audit-log';
import { checkRateLimitAsync } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    // Rate limit: IP당 5회/분 (Redis-backed, serverless-safe)
    // strictMode: Redis 불가 시 fail-closed — 민감한 공개 서명 엔드포인트
    const rl = await checkRateLimitAsync(`sign:${ip}`, 5, 60_000, { strictMode: true });
    if (!rl.allowed) {
      return NextResponse.json({ error: '잠시 후 다시 시도해 주세요' }, { status: 429 });
    }

    const body = (await req.json()) as {
      signerName?: string;
      signatureImage: string; // base64 PNG
      inputFields?: Array<{ key: string; value: string | boolean }>;
    };

    if (!body.signatureImage) {
      return NextResponse.json(
        { ok: false, message: '서명 이미지 필수' },
        { status: 400 }
      );
    }

    // inputFields 기본값 설정
    const inputFields = body.inputFields ?? [];

    // 크기 검증 (500KB 이하)
    const sizeInBytes = Buffer.byteLength(body.signatureImage, 'utf8');
    if (sizeInBytes > 500 * 1024) {
      return NextResponse.json(
        { ok: false, message: '이미지가 너무 큽니다 (500KB 이하)' },
        { status: 400 }
      );
    }

    // MIME 타입 검증 (Base64 헤더 확인)
    const mimeMatch = body.signatureImage.match(/^data:image\/(\w+);base64,/);
    if (!mimeMatch) {
      return NextResponse.json(
        { ok: false, message: '잘못된 이미지 형식' },
        { status: 400 }
      );
    }

    const mimeType = mimeMatch[1].toLowerCase();
    if (!['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(mimeType)) {
      return NextResponse.json(
        { ok: false, message: 'PNG, JPG, GIF, WebP만 지원합니다' },
        { status: 400 }
      );
    }

    // Base64 디코드 검증 (실제 이미지 확인)
    try {
      const base64Content = body.signatureImage.split(',')[1];
      if (!base64Content) {
        return NextResponse.json(
          { ok: false, message: '잘못된 Base64 형식' },
          { status: 400 }
        );
      }
      Buffer.from(base64Content, 'base64');
    } catch (e) {
      return NextResponse.json(
        { ok: false, message: 'Base64 디코딩 실패' },
        { status: 400 }
      );
    }

    // 만료 여부만 먼저 확인 (expiresAt 체크)
    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      select: { expiresAt: true, boundData: true, organizationId: true },
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
          inputFields, // 입력 필드 데이터 포함
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

    // 감사 로그 기록 (non-blocking)
    await logContractAction({
      contractId: id,
      organizationId: instance.organizationId,
      action: 'signed',
      userId: undefined,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
      details: `${body.signerName ?? '비회원'}이 계약서에 서명`,
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
