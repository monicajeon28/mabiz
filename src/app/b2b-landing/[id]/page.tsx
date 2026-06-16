import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { B2BLandingClient } from '@/app/b2b/p/[partnerId]/B2BLandingClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function B2BLandingPublicPage({ params }: Props) {
  const { id } = await params;

  const page = await prisma.b2BLandingPage.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      htmlContent: true,
      editorMode: true,
      formConfig: true,
      buttonTitle: true,
      paymentEnabled: true,
      paymentType: true,
      productName: true,
      productPrice: true,
      cycleDay: true,
      expireDate: true,
      commentEnabled: true,
      completionPageUrl: true,
      footerText: true,
      headerScript: true,
      partnerId: true,
      organizationId: true,
    },
  });

  if (!page) notFound();

  // viewCount 증가 (fire-and-forget)
  prisma.b2BLandingPage.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  // 조직 정보로 partnerId 결정 (API 호환을 위해)
  const org = await prisma.organization.findUnique({
    where: { id: page.organizationId },
    select: { slug: true, externalAffiliateProfileId: true },
  });

  const resolvedPartnerId =
    page.partnerId ??
    org?.slug ??
    (org?.externalAffiliateProfileId ? String(org.externalAffiliateProfileId) : null) ??
    page.organizationId;

  // 초기 댓글 조회
  const rawComments = page.commentEnabled
    ? await prisma.b2BLandingComment.findMany({
        where: { landingPageId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, authorName: true, content: true, createdAt: true },
      })
    : [];

  const comments = rawComments.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  const payment =
    page.paymentEnabled && page.paymentType && page.productName && page.productPrice != null
      ? {
          type: page.paymentType as 'onetime' | 'subscription',
          productName: page.productName,
          productPrice: page.productPrice,
          cycleDay: page.cycleDay ?? 30,
          expireDate: page.expireDate?.toISOString().split('T')[0] ?? '',
        }
      : undefined;

  return (
    <>
      {page.headerScript && (
        <div dangerouslySetInnerHTML={{ __html: page.headerScript }} />
      )}
      <B2BLandingClient
        pageId={page.id}
        partnerId={resolvedPartnerId}
        htmlContent={page.htmlContent ?? ''}
        editorMode={page.editorMode ?? 'html'}
        commentEnabled={page.commentEnabled}
        payment={payment}
        buttonTitle={page.buttonTitle ?? undefined}
        completionPageUrl={page.completionPageUrl ?? undefined}
        footerText={page.footerText ?? undefined}
        formConfig={page.formConfig as Record<string, unknown> | null}
        comments={comments}
      />
    </>
  );
}
