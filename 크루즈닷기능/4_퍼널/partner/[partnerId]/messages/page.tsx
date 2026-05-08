import { redirect } from 'next/navigation';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import TeamMessagesClient from '@/components/partner/TeamMessagesClient';

export default async function TeamMessagesPage({ params }: { params: Promise<{ partnerId: string }> }) {
    try {
        const { partnerId } = await params;
        const context = await requirePartnerContext();
        const { profile } = context;

        // Verify access
        if (profile.User?.mallUserId !== partnerId) {
            redirect(`/partner/${profile.User?.mallUserId ?? ''}/messages`);
        }

        return <TeamMessagesClient partnerId={partnerId} profile={profile} />;
    } catch (error) {
        redirect('/partner');
    }
}
