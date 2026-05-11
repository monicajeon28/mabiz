import type { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://crm.cruisedot.co.kr';

  const pages = await prisma.crmLandingPage.findMany({
    where: { isActive: true, isPublic: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  return pages.map((page) => ({
    url: `${baseUrl}/p/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
}
