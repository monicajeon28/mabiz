/**
 * GET /api/links/ab-tests
 * 사용자의 모든 A/B 테스트 목록 조회
 *
 * POST /api/links/ab-tests
 * 새로운 A/B 테스트 생성
 * Request body:
 * {
 *   "testName": "테스트명",
 *   "variantA_id": "link-id-1",
 *   "variantB_id": "link-id-2"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId || !ctx?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 사용자의 모든 A/B 테스트 조회
    const tests = await prisma.shortLinkABTest.findMany({
      where: {
        createdBy: ctx.userId,
        organizationId: ctx.organizationId,
      },
      include: {
        variantA: { select: { id: true, code: true, title: true } },
        variantB: { select: { id: true, code: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tests);
  } catch (error) {
    logger.error('[ab-tests GET] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId || !ctx?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { testName, variantA_id, variantB_id } = body;

    // 검증
    if (!testName || !variantA_id || !variantB_id) {
      return NextResponse.json(
        { error: 'Missing required fields: testName, variantA_id, variantB_id' },
        { status: 400 }
      );
    }

    if (variantA_id === variantB_id) {
      return NextResponse.json(
        { error: 'variantA_id and variantB_id must be different' },
        { status: 400 }
      );
    }

    // Step 1: 링크 존재 및 권한 확인
    const [variantA, variantB] = await Promise.all([
      prisma.shortLink.findUnique({
        where: { id: variantA_id },
        select: { id: true, organizationId: true }
      }),
      prisma.shortLink.findUnique({
        where: { id: variantB_id },
        select: { id: true, organizationId: true }
      })
    ]);

    if (!variantA || !variantB) {
      return NextResponse.json(
        { error: 'One or both links not found' },
        { status: 404 }
      );
    }

    // 권한 확인
    if (variantA.organizationId !== ctx.organizationId || variantB.organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Step 2: A/B 테스트 생성
    const test = await prisma.shortLinkABTest.create({
      data: {
        testName,
        variantA_id,
        variantB_id,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        status: 'ACTIVE',
      },
      include: {
        variantA: { select: { id: true, code: true, title: true } },
        variantB: { select: { id: true, code: true, title: true } },
      }
    });

    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    logger.error('[ab-tests POST] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
