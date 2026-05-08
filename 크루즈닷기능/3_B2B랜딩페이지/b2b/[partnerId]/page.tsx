import B2BLandingClient from './B2BLandingClient';
import { DEFAULT_B2B_LANDING_TEMPLATE } from '../../../lib/constants/b2b-landing-template';
import prisma from '@/lib/prisma';

export default async function PartnerB2BLandingPage({ params }: { params: { partnerId: string } }) {
    // 항상 최신 파일 템플릿 사용 (미니 클래스, 이미지 그리드 등 포함)
    // 모든 대리점장이 동일한 최신 템플릿을 사용하도록 함
    const template = DEFAULT_B2B_LANDING_TEMPLATE;
    const { partnerId } = params;

    // partnerId → AffiliateProfile 조회 (affiliateCode 추출 목적)
    // 어필리에이트 추적: B2B 랜딩 → 쿠키 → 결제 시 AffiliateSale 연결
    let affiliateCode: string | null = null;
    let resolvedMallUserId: string | null = null;
    try {
        const partnerIdNum = Number(partnerId);
        const whereClause: any = { status: 'ACTIVE' };
        if (!isNaN(partnerIdNum)) {
            whereClause.id = partnerIdNum;
        } else {
            whereClause.OR = [
                { affiliateCode: partnerId },
                { landingSlug: partnerId },
                { User: { phone: partnerId } },
                { User: { mallUserId: partnerId } },
            ];
        }
        const profile = await prisma.affiliateProfile.findFirst({
            where: whereClause,
            select: {
                affiliateCode: true,
                User: { select: { mallUserId: true } },
            },
        });
        if (profile) {
            affiliateCode = profile.affiliateCode || null;
            resolvedMallUserId = profile.User?.mallUserId || partnerId;
        } else {
            // 매칭 안 될 경우 partnerId를 mallUserId로 fallback
            resolvedMallUserId = partnerId;
        }
    } catch {
        resolvedMallUserId = partnerId;
    }

    return (
        <B2BLandingClient
            partnerId={partnerId}
            initialTemplate={template}
            affiliateCode={affiliateCode}
            mallUserId={resolvedMallUserId}
        />
    );
}
