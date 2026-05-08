export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { generateEmbedding, normalizeVector } from '@/lib/ai/embeddingUtils';
import { logger } from '@/lib/logger';

/**
 * 코사인 유사도 계산
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * POST: 벡터 검색 (RAG)
 * 쿼리를 임베딩으로 변환하고, KnowledgeBase의 임베딩과 유사도 비교
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const user = (session as any).user;
    if (!user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { query, limit = 5, minSimilarity = 0.5, category } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: '검색 쿼리가 필요합니다' },
        { status: 400 }
      );
    }

    // 검색 쿼리를 임베딩으로 변환
    let queryEmbedding: number[];
    try {
      const embedding = await generateEmbedding(query.trim());
      queryEmbedding = normalizeVector(embedding);
      logger.debug('[Knowledge Search] Query embedding generated:', {
        queryLength: query.length,
        embeddingLength: queryEmbedding.length
      });
    } catch (error: any) {
      logger.error('[Knowledge Search] Failed to generate query embedding:', error);
      return NextResponse.json(
        { error: '검색 쿼리 임베딩 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    // KnowledgeBase에서 활성화된 문서만 조회
    const whereClause: any = {
      isActive: true,
      embedding: { not: null }, // 임베딩이 있는 문서만
    };

    if (category) {
      whereClause.category = category;
    }

    const knowledgeItems = await prisma.knowledgeBase.findMany({
      where: whereClause,
      select: {
        id: true,
        category: true,
        title: true,
        content: true,
        keywords: true,
        url: true,
        embedding: true,
        priority: true,
      },
    });

    logger.debug('[Knowledge Search] Found knowledge items:', knowledgeItems.length);

    // 각 문서와의 유사도 계산
    const results = knowledgeItems
      .map((item) => {
        const itemEmbedding = item.embedding as number[] | null;
        if (!itemEmbedding || !Array.isArray(itemEmbedding)) {
          return null;
        }

        // 정규화된 임베딩과 비교
        const normalizedItemEmbedding = normalizeVector(itemEmbedding);
        const similarity = cosineSimilarity(queryEmbedding, normalizedItemEmbedding);

        return {
          id: item.id,
          category: item.category,
          title: item.title,
          content: item.content,
          keywords: item.keywords,
          url: item.url,
          similarity,
          priority: item.priority,
        };
      })
      .filter((item): item is NonNullable<typeof item> =>
        item !== null && item.similarity >= minSimilarity
      )
      .sort((a, b) => {
        // 우선순위가 높은 것 먼저, 그 다음 유사도 순
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.similarity - a.similarity;
      })
      .slice(0, limit);

    logger.debug('[Knowledge Search] Search results:', {
      query,
      totalItems: knowledgeItems.length,
      resultsCount: results.length,
      topSimilarity: results[0]?.similarity,
    });

    return NextResponse.json(
      {
        success: true,
        query,
        results,
        totalFound: results.length,
        topSimilarity: results[0]?.similarity || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 지식 베이스 벡터 검색 오류:', error);
    return NextResponse.json(
      { error: '벡터 검색 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}


