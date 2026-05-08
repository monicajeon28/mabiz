export const dynamic = 'force-dynamic';

// app/api/admin/mall/page-config/route.ts
// 메인페이지 전체 설정 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (session && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    logger.error('[Admin Auth] Error:', error);
  }

  return null;
}

/**
 * GET: 페이지 설정 조회
 */
export async function GET(req: NextRequest) {
  try {
    const content = await prisma.mallContent.findUnique({
      where: {
        section_key: {
          section: 'main-page-config',
          key: 'config',
        },
      },
    });

    if (content) {
      return NextResponse.json({
        ok: true,
        config: content.content as any,
      });
    }

    // 기본값 반환
    return NextResponse.json({
      ok: true,
      config: {
        hero: {
          videoUrl: '/videos/hero-video.mp4',
          logoUrl: '/images/ai-cruise-logo.png',
          title: '크루즈닷AI',
          subtitle: '여행 준비부터 여행 중까지\nAI가 함께하는 특별한 크루즈 여행',
          buttons: [
            { text: '지금 시작하기', link: '/login?next=/chat', backgroundColor: '#ffffff', textColor: '#1e40af' },
            { text: '라이브방송참여', link: '#live-broadcast', backgroundColor: '#ffffff', textColor: '#1e40af' },
            { text: '상품 둘러보기', link: '#products', backgroundColor: '#ffffff', textColor: '#1e40af' },
          ],
        },
        socialButtons: {
          enabled: true,
          layout: 'horizontal',
          buttons: [
            { enabled: true, type: 'kakao', text: '카카오톡 상담', link: '', size: 'medium' },
            { enabled: true, type: 'youtube', text: '유튜브 구독하기', link: 'https://www.youtube.com/@cruisedoAI', size: 'medium' },
          ],
        },
        videoBanner: {
          enabled: true,
          videoUrl: '/videos/cruise-showcase-video.mp4',
          title: '크루즈 여행의 모든 순간',
          link: '/products',
        },
        companyStats: {
          enabled: true,
          title: '크루즈닷의 경험과 신뢰',
          subtitle: '직접 여행해보고 꼼꼼히 따져보는 크루즈 전문',
          satisfactionScore: 4.8,
          topRowCards: [
            { icon: '👨‍💼', value: '총 67회', description: '상담 매니저 크루즈 경험' },
            { icon: '✈️', value: '11년~', description: '패키지 크루즈 인솔자 경력' },
            { icon: '🏢', value: '11년~', description: '크루즈 서비스만 연구한시간' },
          ],
          bottomRowCards: [
            { icon: '📊', value: '210명', description: '다음 크루즈 준비', bgColor: 'blue', autoIncrement: true, incrementInterval: 3, incrementAmount: 3 },
            { icon: '💬', value: '13410', description: '지금 크루즈 문의', bgColor: 'yellow', autoIncrement: true, incrementInterval: 5, incrementAmount: 9 },
            { icon: '🎉', value: '3217명', description: '크루즈닷 회원', bgColor: 'green' },
          ],
        },
        cruiseSearch: {
          enabled: true,
          title: '크루즈 상품 검색',
        },
        reviewSection: {
          enabled: true,
          title: '⭐ 크루즈 후기',
          description: '실제 고객들이 남긴 생생한 크루즈 여행 후기를 만나보세요',
          linkText: '더 많은 후기 보기 →',
          linkUrl: '/community',
        },
        communitySection: {
          enabled: true,
          title: '💬 우리끼리 크루즈닷 커뮤니티',
          description: '크루즈 여행자들과 정보를 공유하고 소통해보세요',
          linkText: '커뮤니티 전체 보기',
          linkUrl: '/community',
        },
        youtubeShorts: {
          enabled: true,
          title: '🎬 크루즈닷AI TV - Shorts',
          description: '크루즈 여행의 모든 순간을 Shorts로 만나보세요',
        },
        youtubeVideos: {
          enabled: true,
          title: '📺 크루즈닷AI TV - 영상',
          description: '크루즈 여행의 특별한 영상을 만나보세요',
        },
        youtubeLive: {
          enabled: true,
          title: '📡 라이브 방송',
          description: '지금 이 순간, 크루즈닷AI와 함께하세요',
        },
        productList: {
          enabled: true,
        },
        productSections: [],
        themeSections: [],
        categoryMenu: {
          enabled: true,
          categories: [
            { id: '1', enabled: true, icon: '🎯', text: '액티비티', pageName: 'ActivityPage', urlSlug: '/category/activity', order: 1 },
            { id: '2', enabled: true, icon: '📚', text: '클래스', pageName: 'ClassPage', urlSlug: '/category/class', order: 2 },
            { id: '3', enabled: true, icon: '🎫', text: '입장권', pageName: 'TicketPage', urlSlug: '/category/ticket', order: 3 },
          ],
        },
        topMenu: {
          enabled: true,
          logoUrl: '/images/ai-cruise-logo.png',
          logoLink: '/',
          welcomeMessage: {
            enabled: true,
            text: '{name}님 환영합니다!',
            nameColor: '#3b82f6',
            textColor: '#1f2937',
          },
          menuItems: [
            { id: '1', enabled: true, text: '우리끼리크루즈닷', urlSlug: '/community', order: 1, isButton: true, buttonColor: 'red-600' },
            { id: '2', enabled: true, text: '나의정보', urlSlug: '/community/my-info', order: 2, isButton: true, buttonColor: 'blue-600' },
            { id: '3', enabled: true, text: '로그인', urlSlug: '/community/login', order: 3, isButton: true, buttonColor: 'blue-600' },
            { id: '4', enabled: true, text: '회원가입', urlSlug: '/signup', order: 4, isButton: false },
          ],
        },
        footer: {
          enabled: true,
          companyName: '크루즈닷',
          companyInfo: '상호: 크루즈닷 | 대표: 배연성 | 주소: 경기 화성시 효행로 1068 (리더스프라자) 603-A60호 | 사업자등록번호: 714-57-00419 | 통신판매업신고번호: 제 2025-화성동부-0320 호 | 관광사업자 등록번호: 2025-000004호 | 개인정보보호 책임자: 전혜선',
          copyright: 'Copyright © 크루즈닷 All Rights Reserved.',
          menuItems: [
            { id: '1', enabled: true, text: '공지사항', urlSlug: '/support/notice', order: 1 },
            { id: '2', enabled: true, text: '이용약관', urlSlug: '/terms/0', order: 2 },
            { id: '3', enabled: true, text: '개인정보처리방침', urlSlug: '/terms/1', order: 3, isHighlight: true },
            { id: '4', enabled: true, text: '해외여행자보험', urlSlug: '/insurance', order: 4 },
          ],
          contactInfo: {
            phone: '010-3289-3800',
            email: 'jmonica@cruisedot.co.kr',
            kakaoLink: 'https://www.cruisedot.co.kr/i/6nx',
            businessHours: '오전 9시 ~ 오후 5시 (공휴일 휴무)',
          },
        },
        globalSettings: {
          banners: {
            heroBanner: '',
            promotionBanner: '',
            categoryBanner: '',
          },
          checkmarkIcon: '✓',
          buttonColors: {
            primary: '#1e40af',
            primaryText: '#ffffff',
            secondary: '#6b7280',
            secondaryText: '#ffffff',
          },
        },
        productMenuBar: {
          enabled: true,
          position: 'bottom',
          menuItems: [
            { id: '1', enabled: true, text: '홈', icon: '🏠', urlSlug: '/', order: 1 },
            { id: '2', enabled: true, text: '상품', icon: '🛳️', urlSlug: '/products', order: 2 },
            { id: '3', enabled: true, text: '커뮤니티', icon: '💬', urlSlug: '/community', order: 3 },
            { id: '4', enabled: true, text: '내 정보', icon: '👤', urlSlug: '/community/my-info', order: 4 },
          ],
        },
        landingPageMenuBar: {
          enabled: false,
          position: 'top',
          displayType: 'full',
          buttonPosition: 'right-top',
          menuItems: [
            { id: '1', enabled: true, text: '홈', urlSlug: '/', order: 1 },
            { id: '2', enabled: true, text: '상품', urlSlug: '/products', order: 2 },
            { id: '3', enabled: true, text: '커뮤니티', urlSlug: '/community', order: 3 },
          ],
        },
        promotionBanner: {
          enabled: true,
        },
        sectionOrder: [
          'top-menu',
          'hero',
          'social-buttons',
          'video-banner',
          'company-stats',
          'category-menu',
          'cruise-search',
          'review-section',
          'product-sections',
          'theme-sections',
          'youtube-shorts',
          'youtube-videos',
          'youtube-live',
          'product-list',
          'promotion-banner',
          'community-section',
          'product-menu-bar',
          'landing-page-menu-bar',
          'footer',
        ],
        sections: [],
        popup: {
          enabled: false,
          type: 'image',
          imageUrl: '',
          title: '',
          content: '',
          link: '',
          showCloseButton: true,
        },
      },
    });
  } catch (error: any) {
    logger.error('[Page Config API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '설정을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST: 페이지 설정 저장
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const config = body;

    // 기존 설정 확인
    const existing = await prisma.mallContent.findUnique({
      where: {
        section_key: {
          section: 'main-page-config',
          key: 'config',
        },
      },
    });

    if (existing) {
      // 업데이트
      await prisma.mallContent.update({
        where: { id: existing.id },
        data: {
          content: config,
        },
      });
    } else {
      // 생성
      await prisma.mallContent.create({
        data: {
          section: 'main-page-config',
          key: 'config',
          type: 'page-config',
          content: config,
          order: 0,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: '설정이 저장되었습니다.',
    });
  } catch (error: any) {
    logger.error('[Page Config API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
