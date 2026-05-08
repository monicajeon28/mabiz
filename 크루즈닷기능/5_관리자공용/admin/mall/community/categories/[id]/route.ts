export const dynamic = 'force-dynamic';

// app/api/admin/mall/community/categories/[id]/route.ts
// 커뮤니티 카테고리 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

const CATEGORIES_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'community_categories.json');

// 기본 카테고리
const DEFAULT_CATEGORIES = [
  { id: 'travel-tip', label: '여행팁', value: 'travel-tip' },
  { id: 'destination', label: '관광지추천', value: 'destination' },
  { id: 'qna', label: '질문 답변', value: 'qna' },
  { id: 'general', label: '일반', value: 'general' },
];

// 카테고리 파일 읽기
async function loadCategories() {
  try {
    const data = await fs.readFile(CATEGORIES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return DEFAULT_CATEGORIES;
  }
}

// 카테고리 파일 저장
async function saveCategories(categories: any[]) {
  try {
    const dir = path.dirname(CATEGORIES_FILE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(CATEGORIES_FILE_PATH, JSON.stringify(categories, null, 2), 'utf-8');
  } catch (error) {
    logger.error('[CATEGORIES] Error saving categories', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// 관리자 권한 확인
async function checkAdminAuth() {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, phone: true },
  });

  const isAdminUser = dbUser?.role === 'admin' && dbUser.phone && /^user(1[0]|[1-9])$/.test(dbUser.phone);
  const isSuperAdmin = dbUser?.role === 'admin' && dbUser.phone === '01024958013';

  return isAdminUser || isSuperAdmin ? user : null;
}

// DELETE: 카테고리 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const categoryId = params.id;

    if (!categoryId) {
      return NextResponse.json(
        { ok: false, error: '카테고리 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 'general' 카테고리는 삭제 불가
    if (categoryId === 'general') {
      return NextResponse.json(
        { ok: false, error: '기본 카테고리는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const categories = await loadCategories();
    const categoryToDelete = categories.find((c: any) => c.id === categoryId || c.value === categoryId);

    if (!categoryToDelete) {
      return NextResponse.json(
        { ok: false, error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 해당 카테고리의 게시글을 'general'로 변경
    const categoryValue = categoryToDelete.value;
    await prisma.communityPost.updateMany({
      where: {
        category: categoryValue,
        isDeleted: false,
      },
      data: {
        category: 'general',
      },
    });

    // 카테고리 삭제
    const updatedCategories = categories.filter((c: any) => c.id !== categoryId && c.value !== categoryId);
    await saveCategories(updatedCategories);

    return NextResponse.json({
      ok: true,
      message: '카테고리가 삭제되었습니다. 해당 카테고리의 게시글은 "일반" 카테고리로 이동되었습니다.',
    });
  } catch (error: any) {
    logger.error('[CATEGORIES DELETE] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '카테고리 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
