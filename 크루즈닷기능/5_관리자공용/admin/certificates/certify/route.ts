export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { recordCustomerJourney } from '@/lib/customer-journey';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  try {
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: true },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Certify] Auth check error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    body = await req.json();
    const { customerId, type, customerName, birthDate, refundAmount, refundDate } = body;

    if (!customerId || !type || !customerName || !birthDate) {
      return NextResponse.json(
        { ok: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 환불인증완료인 경우 환불금액과 환불일자 검증
    if (type === 'refund') {
      if (!refundAmount || (typeof refundAmount === 'number' && refundAmount <= 0)) {
        return NextResponse.json(
          { ok: false, error: '환불금액을 입력해주세요.' },
          { status: 400 }
        );
      }
      if (!refundDate || (typeof refundDate === 'string' && refundDate.trim() === '')) {
        return NextResponse.json(
          { ok: false, error: '환불일자를 선택해주세요.' },
          { status: 400 }
        );
      }
    }

    // 고객 정보 조회
    const customer = await prisma.user.findUnique({
      where: { id: parseInt(customerId) },
      include: {
        UserTrip: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { ok: false, error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (type === 'purchase') {
      // 관리자 ID 조회 (고객 그룹 생성용)
      const adminUser = await prisma.user.findFirst({
        where: { role: 'admin' },
        select: { id: true },
      });

      if (!adminUser) {
        return NextResponse.json(
          { ok: false, error: '관리자 계정을 찾을 수 없습니다.' },
          { status: 500 }
        );
      }

      // 구매확인인증 처리
      await prisma.user.update({
        where: { id: customer.id },
        data: {
          customerStatus: 'purchase_confirmed', // 구매확인서발동 상태
        },
      });

      // 고객 여정 기록: 구매고객으로 전환
      await recordCustomerJourney(
        customer.id,
        'purchase',
        'certificate_issued',
        {
          triggerDescription: '구매확인인증서 발급',
          metadata: { customerName, birthDate },
        }
      );

      // 구매고객 그룹 찾기 또는 생성
      let purchaseGroup = await prisma.customerGroup.findFirst({
        where: {
          adminId: adminUser.id,
          name: '구매고객',
        },
      });

      if (!purchaseGroup) {
        // 구매고객 그룹이 없으면 생성
        purchaseGroup = await prisma.customerGroup.create({
          data: {
            adminId: adminUser.id,
            name: '구매고객',
            description: '구매확인인증 처리된 고객 그룹',
            color: '#10B981', // 초록색
            updatedAt: new Date(),
          },
        });
      }

      // 고객을 구매고객 그룹에 추가 (이미 있으면 무시)
      try {
        await prisma.customerGroupMember.upsert({
          where: {
            groupId_userId: {
              groupId: purchaseGroup.id,
              userId: customer.id,
            },
          },
          create: {
            groupId: purchaseGroup.id,
            userId: customer.id,
            addedBy: adminUser.id,
          },
          update: {
            // 이미 있으면 업데이트하지 않음
          },
        });
      } catch (error: any) {
        // 이미 그룹에 있으면 무시
        if (error.code !== 'P2002') {
          console.error('[Certify] Failed to add customer to purchase group:', error);
        }
      }

      return NextResponse.json({
        ok: true,
        message: '구매확인인증이 완료되었습니다.',
        customerStatus: 'purchase_confirmed',
      });
    } else if (type === 'refund') {
      // 환불인증완료 처리
      // 1. 고객 상태 변경: 구매한 여행 해지
      // 2. 크루즈가이드 지니: 활성 → 이용정지 (비밀번호 8300으로 변경)
      // 3. APIS(여권정보): 그대로 유지
      // 4. 환불 횟수 누적 (metadata에 저장)
      // 5. 구매고객 → 일반고객 (customerStatus로 관리)

      // 비밀번호 해시 생성
      const hashedPassword = await bcrypt.hash('8300', 10);

      // 환불 횟수 조회 및 증가 (metadata에서 관리)
      // User 모델에 metadata 필드가 없을 수 있으므로, 일단 기본값 사용
      let metadata: any = {};
      try {
        // customer 객체에서 metadata 확인 (Prisma가 자동으로 파싱)
        if ((customer as any).metadata) {
          metadata = typeof (customer as any).metadata === 'string' 
            ? JSON.parse((customer as any).metadata) 
            : (customer as any).metadata;
        }
      } catch (e) {
        console.warn('[Certify] Failed to parse metadata, using empty object');
        metadata = {};
      }
      
      const refundCount = ((metadata.refundCount as number) || 0) + 1;
      const updatedMetadata = {
        ...metadata,
        refundCount: refundCount,
        refundHistory: [
          ...(metadata.refundHistory || []),
          {
            date: refundDate || new Date().toISOString(),
            amount: refundAmount || 0,
          },
        ],
      };

      // 관리자 ID 조회 (고객 그룹 생성용)
      const adminUser = await prisma.user.findFirst({
        where: { role: 'admin' },
        select: { id: true },
      });

      if (!adminUser) {
        return NextResponse.json(
          { ok: false, error: '관리자 계정을 찾을 수 없습니다.' },
          { status: 500 }
        );
      }

      // User 업데이트 (metadata 필드가 없을 수 있으므로 선택적으로 업데이트)
      const updateData: any = {
        customerStatus: 'refunded', // 환불 완료 상태
        password: hashedPassword,
      };
      
      // metadata 필드가 있으면 업데이트 (Prisma 스키마에 필드가 있는 경우)
      // 일단 주석 처리하고, 나중에 스키마 업데이트 후 활성화
      // updateData.metadata = updatedMetadata;
      
      await prisma.user.update({
        where: { id: customer.id },
        data: updateData,
      });

      // 비밀번호 변경 이력 기록
      await prisma.passwordEvent.create({
        data: {
          userId: customer.id,
          from: customer.password || '',
          to: hashedPassword,
          reason: '환불인증완료 - 크루즈가이드 지니 이용정지',
        },
      });

      // 고객 여정 기록: 환불고객으로 전환 (에러 발생 시 무시)
      try {
        await recordCustomerJourney(
          customer.id,
          'refund',
          'refund_processed',
          {
            triggerDescription: '환불인증완료 처리',
            metadata: { refundCount, refundAmount: refundAmount || 0, refundDate },
          }
        );
      } catch (journeyError: any) {
        console.warn('[Certify] Failed to record customer journey:', journeyError);
        // 고객 여정 기록 실패해도 계속 진행
      }

      // 여행 해지 처리 (가장 최근 여행)
      if (customer.UserTrip && customer.UserTrip.length > 0) {
        const latestTrip = customer.UserTrip[0];
        await prisma.userTrip.update({
          where: { id: latestTrip.id },
          data: {
            status: 'cancelled',
          },
        });
      }

      // 환불고객 그룹 찾기 또는 생성
      let refundGroup = await prisma.customerGroup.findFirst({
        where: {
          adminId: adminUser.id,
          name: '환불고객',
        },
      });

      if (!refundGroup) {
        // 환불고객 그룹이 없으면 생성
        refundGroup = await prisma.customerGroup.create({
          data: {
            adminId: adminUser.id,
            name: '환불고객',
            description: '환불인증완료 처리된 고객 그룹',
            color: '#EF4444', // 빨간색
            updatedAt: new Date(),
          },
        });
      }

      // 고객을 환불고객 그룹에 추가 (이미 있으면 무시)
      try {
        await prisma.customerGroupMember.upsert({
          where: {
            groupId_userId: {
              groupId: refundGroup.id,
              userId: customer.id,
            },
          },
          create: {
            groupId: refundGroup.id,
            userId: customer.id,
            addedBy: adminUser.id,
          },
          update: {
            // 이미 있으면 업데이트하지 않음
          },
        });
      } catch (error: any) {
        // 이미 그룹에 있으면 무시
        if (error.code !== 'P2002') {
          console.error('[Certify] Failed to add customer to refund group:', error);
        }
      }

      return NextResponse.json({
        ok: true,
        message: '환불인증완료가 처리되었습니다.',
        customerStatus: 'refunded',
        refundCount: refundCount,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: '잘못된 인증서 타입입니다.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[Certify] Error:', error);
    console.error('[Certify] Error stack:', error?.stack);
    console.error('[Certify] Error message:', error?.message);
    if (body) {
      try {
        console.error('[Certify] Request body:', JSON.stringify(body, null, 2));
      } catch (e) {
        console.error('[Certify] Failed to stringify request body');
      }
    }
    
    // 더 자세한 에러 메시지 반환
    const errorMessage = error?.message || '인증 처리 중 오류가 발생했습니다.';
    return NextResponse.json(
      { 
        ok: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
