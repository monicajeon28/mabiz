'use server';

import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';

interface Props {
  params: Promise<{ shortlink: string }>;
}

export default async function PublicLandingPage({ params }: Props) {
  const { shortlink } = await params;

  const page = await prisma.crmLandingPage.findFirst({
    where: {
      shortlink,
      isPublic: true,
      isActive: true,
    },
    select: {
      id: true,
      htmlContent: true,
      headerScript: true,
      title: true,
      exposureTitle: true,
    },
  });

  if (!page) {
    notFound();
  }

  return (
    <html>
      <head>
        <title>{page.exposureTitle || page.title}</title>
        {page.headerScript && (
          <script dangerouslySetInnerHTML={{ __html: page.headerScript }} />
        )}
      </head>
      <body>
        <div
          dangerouslySetInnerHTML={{
            __html: page.htmlContent || '',
          }}
        />
      </body>
    </html>
  );
}

export async function generateMetadata({ params }: Props) {
  const { shortlink } = await params;

  const page = await prisma.crmLandingPage.findFirst({
    where: { shortlink, isPublic: true },
    select: { title: true, exposureTitle: true, exposureImage: true, description: true },
  });

  if (!page) return { title: 'Page Not Found' };

  return {
    title: page.exposureTitle || page.title,
    description: page.description,
    openGraph: {
      title: page.exposureTitle || page.title,
      description: page.description,
      images: page.exposureImage ? [{ url: page.exposureImage }] : [],
    },
  };
}
