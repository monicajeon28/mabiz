'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthSession } from '@/types/auth';

export interface ProtectedLayoutProps {
  session: AuthSession | null;
  requiredRoles: string[];
  fallbackUrl: string;
  children: React.ReactNode;
  toastMessage?: string;
}

/**
 * Protected Layout Wrapper
 *
 * - Validates session against required roles
 * - Redirects with optional toast message on unauthorized access
 * - Shows loading state during validation
 * - Prevents layout shift during auth check
 *
 * Usage:
 * ```tsx
 * <ProtectedLayout
 *   session={session}
 *   requiredRoles={['GLOBAL_ADMIN']}
 *   fallbackUrl="/dashboard"
 *   toastMessage="관리자 권한이 필요합니다."
 * >
 *   {children}
 * </ProtectedLayout>
 * ```
 */
export function ProtectedLayout({
  session,
  requiredRoles,
  fallbackUrl,
  children,
  toastMessage,
}: ProtectedLayoutProps) {
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      router.push('/sign-in');
      return;
    }

    const userRole = session.role;
    const hasAccess = requiredRoles.includes(userRole);

    if (!hasAccess) {
      // Toast 메시지 설정 (sessionStorage에 저장 후 리다이렉트)
      if (toastMessage) {
        sessionStorage.setItem('toast.message', toastMessage);
        sessionStorage.setItem('toast.type', 'error');
      }

      router.push(fallbackUrl);
      router.refresh();
    }
  }, [session, requiredRoles, fallbackUrl, router, toastMessage]);

  // 세션 검증 대기 중 로딩 상태 표시
  if (!session) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[#F7F8FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-600">검증 중...</p>
        </div>
      </div>
    );
  }

  const hasAccess = requiredRoles.includes(session.role);

  if (!hasAccess) {
    // 리다이렉트 진행 중 - 실제 리다이렉트는 useEffect에서 처리됨
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[#F7F8FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-600">접근 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return children;
}
