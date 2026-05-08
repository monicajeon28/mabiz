export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { getSessionUser } from '@/lib/auth';
import PartnerInquiriesClient from './PartnerInquiriesClient';

export default async function PartnerInquiriesPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/partner');

  const isAdmin = sessionUser.role === 'admin';
  if (!isAdmin) {
    const { profile } = await requirePartnerContext();
    if (profile.User?.mallUserId !== partnerId) {
      redirect(`/partner/${profile.User?.mallUserId}/inquiries`);
    }
  }

  return <PartnerInquiriesClient partnerId={partnerId} />;
}
