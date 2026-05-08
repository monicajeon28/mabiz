// app/partner/[partnerId]/payment/page.tsx
// 파트너 결제 페이지

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import SalesList from './components/SalesList';

export default async function PartnerPaymentPage({ params }: { params: Promise<{ partnerId: string }> }) {
  try {
    const { partnerId } = await params;
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect('/partner');
    }

    // Check if admin
    const isAdmin = sessionUser.role === 'admin';

    // For non-admin users, require partner context
    let profile;
    let targetUser;
    if (!isAdmin) {
      const context = await requirePartnerContext();
      profile = context.profile;

      // If not viewing own payment page, redirect to own payment page
      if (profile.User?.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/payment`);
      }

      targetUser = profile.User;
    } else {
      // Admin: fetch the target user's data
      targetUser = await prisma.user.findFirst({
        where: { mallUserId: partnerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          mallUserId: true,
          mallNickname: true,
        },
      });

      if (!targetUser?.mallUserId) {
        redirect('/partner');
      }

      const targetProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: targetUser.id },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              mallUserId: true,
              mallNickname: true,
            },
          },
        },
      });

      if (!targetProfile) {
        redirect('/partner');
      }

      profile = targetProfile;
    }

    const partnerBase = `/partner/${targetUser.mallUserId}`;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-10 md:px-6">
          {/* 헤더 */}
          <header className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl">
            <div className="relative z-10 flex flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Link
                    href={`/partner/${targetUser.mallUserId}/dashboard`}
                    className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    대시보드로 돌아가기
                  </Link>
                </div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/80">Payment & Settlement</p>
                <h1 className="text-3xl font-black leading-snug md:text-4xl">
                  결제 및 정산
                </h1>
                <p className="max-w-2xl text-sm text-white/80 md:text-base">
                  정산 명세서 확인 및 수당 조정 신청을 관리하세요.
                </p>
                {isAdmin && (
                  <div className="flex flex-wrap gap-3 text-xs md:text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-3 py-1 font-semibold text-yellow-100">
                      관리자 모드
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-semibold text-white/90">
                      파트너 ID {targetUser.mallUserId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* 파트너 정보 카드 */}
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-slate-900">파트너 정보</h2>
            <dl className="space-y-3 text-sm text-slate-600">
              <div>
                <dt className="font-semibold text-slate-500">파트너 아이디</dt>
                <dd className="font-mono">{targetUser.mallUserId}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">담당자</dt>
                <dd>{profile.displayName ?? targetUser.name ?? '정보 없음'}</dd>
              </div>
              {profile.branchLabel ? (
                <div>
                  <dt className="font-semibold text-slate-500">지점 / 팀</dt>
                  <dd>{profile.branchLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-slate-500">연락처</dt>
                <dd>{profile.contactPhone ?? targetUser.phone ?? '정보 없음'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">이메일</dt>
                <dd>{profile.contactEmail ?? targetUser.email ?? '정보 없음'}</dd>
              </div>
            </dl>
          </div>

          {/* 결제 기능 카드들 */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* 정산 명세서 */}
            <Link
              href={`${partnerBase}/statements`}
              className="group rounded-3xl bg-white p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-2xl bg-blue-100 p-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600">지급명세서</h3>
                  <p className="text-sm text-slate-500">정산 내역 및 지급 명세서를 확인하세요</p>
                </div>
                <svg className="h-6 w-6 text-slate-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

          </div>

          {/* 내 판매 목록 */}
          <SalesList />

          {/* 정산 안내 */}
          <div className="rounded-3xl bg-blue-50 border border-blue-200 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-blue-100 p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2">정산 안내</h3>
                <p className="text-sm text-blue-700">
                  위 판매 목록에서 &apos;확정 요청&apos; 버튼을 클릭하여 고객 상담 기록과 함께 승인을 요청하세요. 관리자 승인 후 정산이 진행됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}

