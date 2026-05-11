import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/p/',
        disallow: '/',
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://crm.cruisedot.co.kr'}/sitemap.xml`,
  };
}
