export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';
import { getAffiliateOwnershipForUsers } from '@/lib/affiliate/customer-ownership';

async function checkAdminAuth(sid: string | undefined): Promise<{ isAdmin: boolean; userId: number | null; userType: string | null }> {
  try {
    if (!sid) return { isAdmin: false, userId: null, userType: null };

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { 
        User: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!session || !session.User) {
      return { isAdmin: false, userId: null, userType: null };
    }

    const user = session.User;
    const isAdmin = user.role === 'admin';
    let userType: string | null = null;

    if (user.AffiliateProfile) {
      userType = user.AffiliateProfile.type; // 'BRANCH_MANAGER' | 'SALES_AGENT'
    } else if (isAdmin) {
      userType = 'admin';
    }

    return { isAdmin: isAdmin || !!user.AffiliateProfile, userId: user.id, userType };
  } catch (error) {
    console.error('[Customer Notes API] Auth check error:', error);
    return { isAdmin: false, userId: null, userType: null };
  }
}

// GET: 고객 기록 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const auth = await checkAdminAuth(sid);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    const { userId: userIdStr } = await params;
    const customerId = parseInt(userIdStr);
    if (isNaN(customerId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 고객 ID입니다.' },
        { status: 400 }
      );
    }

    // 고객 기록 조회
    const notes = await prisma.customerNote.findMany({
      where: { customerId },
      include: {
        CreatedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            AffiliateProfile: {
              select: {
                type: true,
                displayName: true,
                nickname: true,
                affiliateCode: true,
                branchLabel: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 작성자 정보 포맷팅
    const formattedNotes = notes.map(note => {
      const createdBy = note.CreatedByUser;
      let createdByName = note.createdByName;
      let createdByLabel = '본사';

      if (createdBy.AffiliateProfile) {
        const profile = createdBy.AffiliateProfile;
        if (profile.type === 'BRANCH_MANAGER') {
          createdByLabel = '대리점장';
          createdByName = profile.nickname || profile.displayName || createdByName || '미지정';
        } else if (profile.type === 'SALES_AGENT') {
          createdByLabel = '판매원';
          createdByName = profile.nickname || profile.displayName || createdByName || '미지정';
        }
      } else if (createdBy.role === 'admin') {
        createdByLabel = '본사';
        createdByName = createdBy.name || '관리자';
      }

      return {
        id: note.id,
        content: note.content,
        isInternal: note.isInternal,
        notifyTargets: note.notifyTargets,
        createdByLabel,
        createdByName,
        createdByType: note.createdByType,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      ok: true,
      notes: formattedNotes,
    });
  } catch (error: any) {
    console.error('[Customer Notes API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '고객 기록을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

// POST: 고객 기록 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const auth = await checkAdminAuth(sid);
    
    if (!auth.isAdmin || !auth.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    const { userId: userIdStr } = await params;
    const customerId = parseInt(userIdStr);
    if (isNaN(customerId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 고객 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { content, isInternal, notifyTargets } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: '기록 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 작성자 정보 조회
    const createdByUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        AffiliateProfile: {
          select: {
            type: true,
            displayName: true,
            nickname: true,
          },
        },
      },
    });

    if (!createdByUser) {
      return NextResponse.json(
        { ok: false, error: '작성자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let createdByType = 'admin';
    let createdByName = createdByUser.name || '관리자';

    if (createdByUser.AffiliateProfile) {
      createdByType = createdByUser.AffiliateProfile.type;
      createdByName = createdByUser.AffiliateProfile.nickname || 
                     createdByUser.AffiliateProfile.displayName || 
                     createdByName;
    }

    // 고객 기록 생성
    const note = await prisma.customerNote.create({
      data: {
        customerId,
        createdBy: auth.userId,
        createdByType,
        createdByName,
        content: content.trim(),
        isInternal: isInternal || false,
        notifyTargets: notifyTargets || null,
      },
    });

    // 알림 생성 (고객 소유권 확인 후 담당자들에게 알림)
    try {
      const customerForNotification = await prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, phone: true },
      });

      if (customerForNotification) {
        const ownershipMap = await getAffiliateOwnershipForUsers([
          { id: customerForNotification.id, phone: customerForNotification.phone },
        ]);
        const ownership = ownershipMap.get(customerForNotification.id);

        // 알림 대상 결정
        const notificationTargets: number[] = [];
        
        // 본사는 항상 알림 받음
        const adminUsers = await prisma.user.findMany({
          where: { role: 'admin' },
          select: { id: true },
        });
        notificationTargets.push(...adminUsers.map(u => u.id));

        // 고객 소유권이 있으면 담당자에게도 알림
        if (ownership) {
          if (ownership.ownerType === 'BRANCH_MANAGER' && ownership.ownerProfileId) {
            // 대리점장의 User ID 찾기
            const managerProfile = await prisma.affiliateProfile.findUnique({
              where: { id: ownership.ownerProfileId },
              select: { userId: true },
            });
            if (managerProfile) {
              notificationTargets.push(managerProfile.userId);
            }

            // 판매원이 있으면 판매원도 알림
            if (ownership.managerProfile && ownership.managerProfile.id) {
              const agentProfile = await prisma.affiliateProfile.findUnique({
                where: { id: ownership.managerProfile.id },
                select: { userId: true },
              });
              if (agentProfile) {
                notificationTargets.push(agentProfile.userId);
              }
            }
          } else if (ownership.ownerType === 'SALES_AGENT' && ownership.ownerProfileId) {
            // 판매원의 User ID 찾기
            const agentProfile = await prisma.affiliateProfile.findUnique({
              where: { id: ownership.ownerProfileId },
              select: { userId: true },
            });
            if (agentProfile) {
              notificationTargets.push(agentProfile.userId);
            }

            // 담당 대리점장도 알림
            if (ownership.managerProfile && ownership.managerProfile.id) {
              const managerProfile = await prisma.affiliateProfile.findUnique({
                where: { id: ownership.managerProfile.id },
                select: { userId: true },
              });
              if (managerProfile) {
                notificationTargets.push(managerProfile.userId);
              }
            }
          }
        }

        // 중복 제거
        const uniqueTargets = Array.from(new Set(notificationTargets));

        // 알림 생성 (중복 제거된 대상자에게만)
        if (uniqueTargets.length > 0) {
          await prisma.adminNotification.createMany({
            data: uniqueTargets.map(userId => ({
              userId,
              notificationType: 'customer_note',
              title: `고객 기록 업데이트: ${createdByUser.name || '관리자'}`,
              content: `고객 "${customerForNotification.name || `ID:${customerId}`}"에 대한 새로운 기록이 작성되었습니다.`,
              relatedCustomerId: customerId,
              relatedNoteId: note.id,
              priority: 'normal',
            })),
          });
        }
      }
    } catch (notificationError) {
      console.error('[Customer Notes API] Failed to create notifications:', notificationError);
      // 알림 생성 실패해도 기록은 성공으로 처리
    }

    // Google 스프레드시트에 상세기록 업데이트 (서버에서 직접 전송)
    try {
      const customer = await prisma.user.findUnique({
        where: { id: customerId },
        select: { name: true, phone: true },
      });

      if (customer?.phone) {
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVYYHKLyNfXwO3fSX19jmb7hF3Bh2oyay7lrlw3mJx42eL9kQANxhwxLrQyzbEj29x/exec';
        const timestamp = new Date().toLocaleString('ko-KR');

        const formData = new URLSearchParams();
        formData.append('action', 'updateNote');
        formData.append('timestamp', timestamp);
        formData.append('name', customer.name || '');
        formData.append('phone', customer.phone || '');
        formData.append('note', content.trim());

        console.log('[Customer Notes API] Google 스프레드시트 전송 시작:', {
          name: customer.name,
          phone: customer.phone,
          note: content.trim().substring(0, 50) + '...',
        });

        const googleResponse = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        const googleResult = await googleResponse.text();
        console.log('[Customer Notes API] Google 스프레드시트 응답:', googleResult);
      } else {
        console.log('[Customer Notes API] 고객 연락처 없음, 스프레드시트 업데이트 생략');
      }
    } catch (googleError) {
      console.error('[Customer Notes API] Google 스프레드시트 전송 실패:', googleError);
      // 스프레드시트 전송 실패해도 기록은 성공으로 처리
    }

    return NextResponse.json({
      ok: true,
      note: {
        id: note.id,
        content: note.content,
        createdByLabel: createdByType === 'BRANCH_MANAGER' ? '대리점장' :
                       createdByType === 'SALES_AGENT' ? '판매원' : '본사',
        createdByName,
        createdAt: note.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Customer Notes API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '고객 기록 작성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
