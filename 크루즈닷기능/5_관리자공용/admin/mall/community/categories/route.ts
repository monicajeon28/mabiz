export const dynamic = 'force-dynamic';

// app/api/admin/mall/community/categories/route.ts
// 커뮤니티 카테고리 관리 API

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
    // 파일이 없으면 기본 카테고리 반환 및 파일 생성
    await saveCategories(DEFAULT_CATEGORIES);
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

// GET: 카테고리 목록 조회
export async function GET(_req: NextRequest) {
  try {
    const categories = await loadCategories();
    return NextResponse.json({
      ok: true,
      categories,
    });
  } catch (error: any) {
    logger.error('[CATEGORIES GET] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '카테고리를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 카테고리 추가
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { value, label } = await req.json();

    if (!value || !label) {
      return NextResponse.json(
        { ok: false, error: '카테고리 값과 라벨을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const categories = await loadCategories();

    // 중복 확인
    if (categories.some((c: any) => c.value === value || c.label === label)) {
      return NextResponse.json(
        { ok: false, error: '이미 존재하는 카테고리입니다.' },
        { status: 400 }
      );
    }

    // 새 카테고리 추가
    const newCategory = {
      id: value,
      label,
      value,
    };

    categories.push(newCategory);
    await saveCategories(categories);

    return NextResponse.json({
      ok: true,
      category: newCategory,
      message: '카테고리가 추가되었습니다.',
    });
  } catch (error: any) {
    logger.error('[CATEGORIES POST] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '카테고리 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
