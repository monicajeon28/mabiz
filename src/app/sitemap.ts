/**
 * Sitemap 자동 생성 (SEO 최적화)
 *
 * 목적: Google/Naver 검색 봇에 크롤링할 페이지 목록 제공
 * 참고: https://nextjs.org/docs/app/api-reference/file-conventions/sitemap
 *
 * 접근: https://mabizcruisedot.com/sitemap.xml
 */

export const dynamic = 'force-dynamic';

import type { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';

  // 정적 페이지 (static pages)
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/landing`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/join`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/b2b`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/passport`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contract`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/pnr`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
  ];

  // 동적 페이지 (제품/랜딩 페이지)
  const dynamicPages = await prisma.crmLandingPage.findMany({
    where: { isActive: true, isPublic: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  const dynamicPageSitemap = dynamicPages.map((page) => ({
    url: `${baseUrl}/p/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // 동적 숏링크 페이지
  const shortLinks = await prisma.shortLink.findMany({
    where: { isActive: true },
    select: { code: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const shortLinkSitemap = shortLinks.map((link) => ({
    url: `${baseUrl}/l/${link.code}`,
    lastModified: link.createdAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...dynamicPageSitemap, ...shortLinkSitemap];
}
