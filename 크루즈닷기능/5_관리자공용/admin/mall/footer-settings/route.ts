export const dynamic = 'force-dynamic';

// app/api/admin/mall/footer-settings/route.ts
// Footer 버튼 설정 관리 API (관리자 전용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { logger } from '@/lib/logger';

/**
 * 관리자 권한 확인
 */
async function checkAdminAuth() {
  const session = await getSession();
  if (!session?.userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.userId) },
    select: { role: true }
  });

  if (user?.role !== 'admin') {
    return null;
  }

  return user;
}

/**
 * GET: Footer 설정 조회
 */
export async function GET() {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const settings = await prisma.mallContent.findMany({
      where: {
        section: 'footer'
      },
      orderBy: { order: 'asc' }
    });

    const consultButton = settings.find(s => s.key === 'consult-button');
    const faqTabs = settings.find(s => s.key === 'faq-tabs');

    return NextResponse.json({
      ok: true,
      settings: {
        consultButtonEnabled: consultButton 
          ? (consultButton.content as any)?.enabled !== false 
          : true,
        faqTabsEnabled: faqTabs 
          ? (faqTabs.content as any)?.enabled !== false 
          : true,
      },
      rawSettings: settings
    });
  } catch (error: any) {
    logger.error('[Admin Footer Settings API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Footer 설정 업데이트
 */
export async function PUT(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { consultButtonEnabled, faqTabsEnabled } = body;

    // 상담하기 버튼 설정
    if (consultButtonEnabled !== undefined) {
      await prisma.mallContent.upsert({
        where: {
          section_key: {
            section: 'footer',
            key: 'consult-button'
          }
        },
        update: {
          content: { enabled: consultButtonEnabled },
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          section: 'footer',
          key: 'consult-button',
          type: 'button',
          content: { enabled: consultButtonEnabled },
          order: 1,
          isActive: true
        }
      });
    }

    // FAQ 탭 설정
    if (faqTabsEnabled !== undefined) {
      await prisma.mallContent.upsert({
        where: {
          section_key: {
            section: 'footer',
            key: 'faq-tabs'
          }
        },
        update: {
          content: { enabled: faqTabsEnabled },
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          section: 'footer',
          key: 'faq-tabs',
          type: 'button',
          content: { enabled: faqTabsEnabled },
          order: 2,
          isActive: true
        }
      });
    }

    return NextResponse.json({
      ok: true,
      message: '설정이 저장되었습니다.'
    });
  } catch (error: any) {
    logger.error('[Admin Footer Settings API] PUT error:', error);
    return NextResponse.json(
      { ok: false, error: '설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
