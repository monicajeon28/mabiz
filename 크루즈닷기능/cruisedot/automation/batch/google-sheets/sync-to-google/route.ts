export const dynamic = 'force-dynamic';

// app/api/batch/sync-to-google/route.ts
// 1시간마다 실행되는 배치 작업: 최근 1시간 동안 작성된 데이터를 Google Sheets/Drive에 저장

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  savePostToSheets,
  saveCommentToSheets,
} from '@/lib/google-sheets';

// 배치 작업 실행 (1시간마다 호출)
export async function POST(req: Request) {
  try {
    // 보안: API 키 또는 환경 변수로 인증 (선택사항)
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.BATCH_SYNC_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[BATCH SYNC] 시작: 최근 1시간 데이터 동기화');

    // 1시간 전 시간 계산
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 최근 1시간 동안 작성된 게시글 조회
    const recentPosts = await prisma.communityPost.findMany({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
        isDeleted: false,
      },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        authorName: true,
        createdAt: true,
      },
    });

    // 최근 1시간 동안 작성된 댓글 조회
    const recentComments = await prisma.communityComment.findMany({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
      select: {
        id: true,
        postId: true,
        content: true,
        authorName: true,
        createdAt: true,
      },
    });

    console.log('[BATCH SYNC] 조회 완료:', {
      posts: recentPosts.length,
      comments: recentComments.length,
    });

    // 환경 변수 확인
    if (!process.env.COMMUNITY_BACKUP_SPREADSHEET_ID) {
      console.warn('[BATCH SYNC] COMMUNITY_BACKUP_SPREADSHEET_ID 환경변수가 설정되지 않았습니다. 백업을 건너뜁니다.');
      return NextResponse.json({
        ok: true,
        message: 'Backup skipped - COMMUNITY_BACKUP_SPREADSHEET_ID not set',
        stats: {
          postsFound: recentPosts.length,
          commentsFound: recentComments.length,
          postsSaved: 0,
          commentsSaved: 0,
        },
      });
    }

    // 게시글 저장
    let postsSaved = 0;
    let postsErrors = 0;
    for (const post of recentPosts) {
      try {
        const result = await savePostToSheets({
          id: post.id,
          title: post.title,
          content: post.content,
          category: post.category,
          authorName: post.authorName,
          createdAt: post.createdAt,
        });

        if (result.ok) {
          postsSaved++;
        } else {
          postsErrors++;
          console.error('[BATCH SYNC] 게시글 저장 실패:', post.id, result.error);
        }
      } catch (error: any) {
        postsErrors++;
        console.error('[BATCH SYNC] 게시글 저장 오류:', post.id, error);
      }
    }

    // 댓글 저장
    let commentsSaved = 0;
    let commentsErrors = 0;
    for (const comment of recentComments) {
      try {
        const result = await saveCommentToSheets({
          id: comment.id,
          postId: comment.postId,
          content: comment.content,
          authorName: comment.authorName,
          createdAt: comment.createdAt,
        });

        if (result.ok) {
          commentsSaved++;
        } else {
          commentsErrors++;
          console.error('[BATCH SYNC] 댓글 저장 실패:', comment.id, result.error);
        }
      } catch (error: any) {
        commentsErrors++;
        console.error('[BATCH SYNC] 댓글 저장 오류:', comment.id, error);
      }
    }

    console.log('[BATCH SYNC] 완료:', {
      postsSaved,
      postsErrors,
      commentsSaved,
      commentsErrors,
    });

    return NextResponse.json({
      ok: true,
      message: 'Batch sync completed',
      stats: {
        postsFound: recentPosts.length,
        commentsFound: recentComments.length,
        postsSaved,
        postsErrors,
        commentsSaved,
        commentsErrors,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[BATCH SYNC] Fatal error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Batch sync failed',
        details: error?.message
      },
      { status: 500 }
    );
  }
}

// GET: 배치 작업 상태 확인
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Batch sync endpoint is active',
    instructions: 'POST to this endpoint to sync recent data to Google Sheets/Drive',
    schedule: 'Should be called every hour (e.g., via cron job)',
    auth: process.env.BATCH_SYNC_TOKEN ? 'Required (set in environment)' : 'Not required (no token set)',
  });
}
