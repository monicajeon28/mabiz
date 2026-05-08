// app/partner/[partnerId]/links/page.tsx
// 파트너 링크 관리 페이지

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { PartnerApiError, requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import PartnerLinksClient from './PartnerLinksClient';

export default async function PartnerLinksPage({ params }: { params: Promise<{ partnerId: string }> }) {
  try {
    const { partnerId } = await params;
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      redirect('/partner');
    }

    // Check if admin
    const isAdmin = sessionUser.role === 'admin';

    // For non-admin users, require partner context
    if (!isAdmin) {
      const context = await requirePartnerContext();
      const profile = context.profile;

      // If not viewing own links page, redirect to own links page
      if (profile.User?.mallUserId !== partnerId) {
        redirect(`/partner/${profile.User?.mallUserId ?? ''}/links`);
      }
    }

    return <PartnerLinksClient partnerId={partnerId} />;
  } catch (error) {
    if (error instanceof PartnerApiError && error.status === 401) {
      redirect('/partner');
    }
    redirect('/partner');
  }
}






