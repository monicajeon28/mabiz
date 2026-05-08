import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import PayslipsClient from './PayslipsClient';

export default async function PayslipsPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/partner');
  }

  return <PayslipsClient partnerId={partnerId} />;
}



















