import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import ImageLibrary from '@/components/admin/ImageLibrary';

export const dynamic = 'force-dynamic';

export default async function PartnerImagesPage({ params }: { params: Promise<{ partnerId: string }> }) {
    const { partnerId } = await params;
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
        redirect('/partner');
    }

    // Fetch user and profile to check role
    const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        include: {
            AffiliateProfile: true,
        },
    });

    if (!user) {
        redirect('/partner');
    }

    // Check if super admin
    const normalizedPhone = user.phone?.replace(/[-\s]/g, '') || '';
    const isSuperAdmin = user.role === 'admin' || normalizedPhone === '01024958013' || normalizedPhone === '01038609161';

    // Check if branch manager
    const isBranchManager = user.AffiliateProfile?.type === 'BRANCH_MANAGER';

    // Sales Agents have restricted access (can only upload/view)
    // Admin and Branch Managers have full access (create folder, delete, move)
    const canManageFolders = isSuperAdmin || isBranchManager;
    const canDelete = isSuperAdmin || isBranchManager;

    return <ImageLibrary canDelete={canDelete} canManageFolders={canManageFolders} backUrl={`/partner/${partnerId}/dashboard`} />;
}
