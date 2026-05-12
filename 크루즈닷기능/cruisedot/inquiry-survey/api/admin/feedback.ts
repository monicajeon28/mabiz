export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    return false;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session || !session.User) {
      return false;
    }

    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Feedback] Auth check error:', error);
    return false;
  }
}

/**
 * GET: 모든 후기 조회 (관리자 전용) - CruiseReview 모델 사용
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { error: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 필터 파라미터
    const filterParam = req.nextUrl.searchParams.get('filter');
    const filter = (filterParam || 'all') as 'all' | 'pending' | 'approved';

    // 후기 조회 (CruiseReview 모델 사용)
    const whereClause: any = {
      isDeleted: false, // 삭제되지 않은 후기만
    };

    if (filter === 'pending') {
      whereClause.isApproved = false;
    } else if (filter === 'approved') {
      whereClause.isApproved = true;
    }

    let reviews = await prisma.cruiseReview.findMany({
      where: whereClause,
      include: {
        User: {
          select: { name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 이미지가 있는 후기만 필터링 (관리자 후기관리용)
    reviews = reviews.filter(review => {
      if (!review.images) return false;
      try {
        const images = Array.isArray(review.images) 
          ? review.images 
          : (typeof review.images === 'string' ? JSON.parse(review.images) : []);
        return Array.isArray(images) && images.length > 0 && images.some((img: any) => img && img.trim());
      } catch {
        return false;
      }
    });

    // 응답 포맷 변환
    const formattedReviews = reviews.map((review) => {
      // images가 JSON인 경우 파싱
      let photos: string[] = [];
      if (review.images) {
        try {
          if (typeof review.images === 'string') {
            photos = JSON.parse(review.images);
          } else if (Array.isArray(review.images)) {
            photos = review.images;
          }
        } catch (e) {
          console.error('[Feedback API] Image parsing error:', e);
        }
      }

      // 크루즈명 조합 (크루즈 라인 + 선박명)
      const cruiseName = review.cruiseLine && review.shipName
        ? `${review.cruiseLine} ${review.shipName}`
        : review.cruiseLine || review.shipName || '크루즈 정보 없음';

      return {
        id: review.id,
        customerName: review.authorName || review.User?.name || '익명',
        customerPhone: review.User?.phone || '',
        cruiseName: cruiseName,
        destination: '', // CruiseReview에는 destination 필드가 없음
        reviewText: review.content || '',
        photos: photos,
        rating: review.rating,
        isApproved: review.isApproved,
        createdAt: review.createdAt.toISOString().split('T')[0],
        adminNotes: '', // CruiseReview에는 adminNotes 필드가 없음
      };
    });

    return NextResponse.json(
      { reviews: formattedReviews },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 후기 조회 오류:', error);
    return NextResponse.json(
      { error: '후기 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: 후기 승인/거부 (관리자 전용) - CruiseReview 모델 사용
 */
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { error: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id, isApproved, content } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 업데이트할 데이터 구성
    const updateData: { isApproved?: boolean; content?: string } = {};

    if (isApproved !== undefined) {
      updateData.isApproved = isApproved;
    }

    if (content !== undefined) {
      updateData.content = content;
    }

    // 후기 업데이트 (CruiseReview 모델)
    const updated = await prisma.cruiseReview.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { message: '후기가 업데이트되었습니다', review: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 후기 업데이트 오류:', error);
    return NextResponse.json(
      { error: '후기 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 후기 삭제 (관리자 전용) - CruiseReview 모델 사용 (soft delete)
 */
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { error: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '후기 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { error: '유효하지 않은 후기 ID입니다' },
        { status: 400 }
      );
    }

    // 후기가 존재하는지 확인
    const review = await prisma.cruiseReview.findUnique({
      where: { id: reviewId },
      select: { id: true, isDeleted: true },
    });

    if (!review) {
      return NextResponse.json(
        { error: '후기를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (review.isDeleted) {
      return NextResponse.json(
        { error: '이미 삭제된 후기입니다' },
        { status: 400 }
      );
    }

    // Soft delete: isDeleted를 true로 설정
    await prisma.cruiseReview.update({
      where: { id: reviewId },
      data: { isDeleted: true },
    });

    return NextResponse.json(
      { message: '후기가 삭제되었습니다' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] 후기 삭제 오류:', error);
    return NextResponse.json(
      { error: '후기 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
