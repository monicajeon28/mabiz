export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { generateEmbedding, normalizeVector } from '@/lib/ai/embeddingUtils';
import { logger } from '@/lib/logger';

interface KnowledgeItem {
  id?: number;
  category: string;
  title: string;
  keywords: string[];
  content: string;
  url?: string;
}

/**
 * GET: 모든 지식 기사 조회
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인 (선택사항 - 공개 지식 베이스라면 제거 가능)
    const categoryParam = req.nextUrl.searchParams.get('category');

    let whereClause: any = {};
    if (categoryParam) {
      whereClause.category = categoryParam;
    }

    const knowledge = await prisma.knowledgeBase.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      { data: knowledge },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 지식 베이스 조회 오류:', error);
    return NextResponse.json(
      { error: '지식 베이스 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST: 새로운 지식 기사 생성 (관리자 전용)
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const user = await prisma.user.findFirst({
      where: { id: sessionUser.id, role: 'admin' },
    });

    if (!user) {
      return NextResponse.json(
        { error: '관리자 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { category, title, keywords, content, url } = await req.json();

    if (!category || !title || !content) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다' },
        { status: 400 }
      );
    }

    // keywords를 문자열로 변환 (배열이면 쉼표로 구분)
    const keywordsString = Array.isArray(keywords) 
      ? keywords.join(',') 
      : (keywords || '');

    // 임베딩 생성 (성능 최적화: 검색 시 API 호출 없이 DB에서 조회)
    let embedding: number[] | null = null;
    try {
      const contentText = `${title} ${content} ${keywordsString}`;
      embedding = await generateEmbedding(contentText);
      const normalizedEmbedding = normalizeVector(embedding);
      embedding = normalizedEmbedding; // 정규화된 임베딩 저장
      logger.debug('[Knowledge API] 임베딩 생성 완료:', { title, embeddingLength: embedding.length });
    } catch (error: any) {
      logger.warn('[Knowledge API] 임베딩 생성 실패 (문서는 저장됨):', error.message);
      // 임베딩 생성 실패해도 문서는 저장 (키워드 검색으로 폴백 가능)
    }

    const knowledge = await prisma.knowledgeBase.create({
      data: {
        category,
        title,
        keywords: keywordsString,
        content,
        url: url || '',
        embedding: embedding ? (embedding as any) : null, // JSON 타입으로 저장
        embeddingUpdatedAt: embedding ? new Date() : null,
      },
    });

    return NextResponse.json(
      { data: knowledge },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[API] 지식 베이스 생성 오류:', error);
    return NextResponse.json(
      { error: '지식 베이스 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 지식 기사 수정 (관리자 전용)
 */
export async function PUT(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const user = await prisma.user.findFirst({
      where: { id: sessionUser.id, role: 'admin' },
    });

    if (!user) {
      return NextResponse.json(
        { error: '관리자 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id, category, title, keywords, content, url } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 기존 문서 조회 (임베딩 재생성 여부 확인)
    const existing = await prisma.knowledgeBase.findUnique({
      where: { id },
      select: { title: true, content: true, keywords: true },
    });

    // keywords를 문자열로 변환
    const keywordsString = Array.isArray(keywords) 
      ? keywords.join(',') 
      : (keywords !== undefined ? keywords : existing?.keywords || '');

    // 내용이 변경되었으면 임베딩 재생성
    const contentChanged = 
      (title && title !== existing?.title) ||
      (content && content !== existing?.content) ||
      (keywordsString !== existing?.keywords);

    let embedding: number[] | null = null;
    let embeddingUpdatedAt: Date | null = null;

    if (contentChanged) {
      try {
        const finalTitle = title || existing?.title || '';
        const finalContent = content || existing?.content || '';
        const contentText = `${finalTitle} ${finalContent} ${keywordsString}`;
        embedding = await generateEmbedding(contentText);
        const normalizedEmbedding = normalizeVector(embedding);
        embedding = normalizedEmbedding;
        embeddingUpdatedAt = new Date();
        logger.debug('[Knowledge API] 임베딩 재생성 완료:', { id, embeddingLength: embedding.length });
      } catch (error: any) {
        logger.warn('[Knowledge API] 임베딩 재생성 실패 (문서는 업데이트됨):', error.message);
      }
    }

    const updateData: any = {
      ...(category && { category }),
      ...(title && { title }),
      ...(keywordsString !== undefined && { keywords: keywordsString }),
      ...(content && { content }),
      ...(url !== undefined && { url }),
    };

    // 임베딩이 재생성되었으면 업데이트
    if (embedding) {
      updateData.embedding = embedding as any;
      updateData.embeddingUpdatedAt = embeddingUpdatedAt;
    }

    const updated = await prisma.knowledgeBase.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { data: updated },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 지식 베이스 수정 오류:', error);
    return NextResponse.json(
      { error: '지식 베이스 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 지식 기사 삭제 (관리자 전용)
 */
export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const user = await prisma.user.findFirst({
      where: { id: sessionUser.id, role: 'admin' },
    });

    if (!user) {
      return NextResponse.json(
        { error: '관리자 권한이 없습니다' },
        { status: 403 }
      );
    }

    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    await prisma.knowledgeBase.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: '지식 기사가 삭제되었습니다' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 지식 베이스 삭제 오류:', error);
    return NextResponse.json(
      { error: '지식 베이스 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
