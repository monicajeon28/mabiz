# Next.js SEO Quick Reference (한 페이지)

**마비즈 현재 상태**: ✅ robots.ts + sitemap.ts 완성 | ⏳ JSON-LD 추가 필요

---

## 🔥 3가지 필수 파일

### 1. robots.ts (이미 완료 ✅)

```typescript
// src/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/p/', disallow: '/' }],
    sitemap: 'https://mabizcruisedot.com/sitemap.xml',
  };
}
```

**검증**: `curl https://mabizcruisedot.com/robots.txt`

---

### 2. sitemap.ts (이미 완료 ✅)

```typescript
// src/app/sitemap.ts
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

import type { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://mabizcruisedot.com';

  const pages = await prisma.crmLandingPage.findMany({
    where: { isActive: true, isPublic: true },
    select: { slug: true, updatedAt: true },
    take: 500,
  });

  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    ...pages.map(p => ({
      url: `${baseUrl}/p/${p.slug}`,
      lastModified: p.updatedAt,
      priority: 0.8,
    })),
  ];
}
```

**검증**: `curl https://mabizcruisedot.com/sitemap.xml | head -20`

---

### 3. JSON-LD (추가 필요 ⏳)

#### A. Organization (layout.tsx)

```typescript
// src/app/layout.tsx JSX 부분
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '마비즈 크루즈닷파트너스',
  url: 'https://mabizcruisedot.com',
  logo: 'https://mabizcruisedot.com/logo.png',
};

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
/>
```

#### B. Product (p/[slug]/page.tsx)

```typescript
const productSchema = {
  '@context': 'https://schema.org/',
  '@type': 'Product',
  name: page.title,
  image: page.imageUrl,
  description: page.description,
};

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
/>
```

---

## ✅ 검증 도구 (Day 0-7)

| 순서 | 도구 | 성공 기준 | 링크 |
|------|------|---------|------|
| 1 | robots.txt | 존재 | https://mabizcruisedot.com/robots.txt |
| 2 | sitemap.xml | >50 URL | https://mabizcruisedot.com/sitemap.xml |
| 3 | Rich Results | 0 에러 | [Test](https://search.google.com/test/rich-results) |
| 4 | PageSpeed | 90+ | [Test](https://pagespeed.web.dev) |
| 5 | Google Console | 제출됨 | [Console](https://search.google.com/search-console) |

---

## 🚀 3단계 배포 (30분)

### Phase 1: 로컬 테스트 (5분)
```bash
npm run dev
curl http://localhost:3000/robots.txt
curl http://localhost:3000/sitemap.xml
```

### Phase 2: 배포 (5분)
```bash
git add .
git commit -m "feat: Add JSON-LD structured data for SEO"
git push
# Vercel 자동 배포
```

### Phase 3: 검증 (20분)
1. robots.txt 확인
2. sitemap.xml 확인  
3. Google Rich Results 테스트
4. PageSpeed Insights 검사
5. Google Search Console 제출

---

## 📊 예상 성과

| 메트릭 | 현재 | 목표 | 시점 |
|--------|------|------|------|
| 검색 인덱싱 | ? | >80% | Day 7 |
| PageSpeed | ? | 90+ | Day 1 |
| Rich Results | 0 | 0 에러 | Day 1 |
| Sitemap URL | ~100 | 100+ | Day 1 |

---

## 🎯 자주 묻는 질문

**Q1: robots.txt와 sitemap.xml 차이?**
- robots.ts: 크롤러가 **어디를 방문할지** 지시
- sitemap.ts: 크롤러가 **모든 페이지 목록** 제공

**Q2: JSON-LD는 필수인가?**
- 아니오. 하지만 +20-30% 검색 노출 증가 가능

**Q3: 몇 일 후 Google에 나타나나?**
- 1-7일 (평균 3-4일)

**Q4: 메타 태그보다 중요한가?**
- 거의 동등함. 메타 태그 + robots + sitemap + JSON-LD 모두 필요

---

## 📚 참고 링크

| 리소스 | URL |
|--------|-----|
| Next.js robots | https://nextjs.org/docs/app/api-reference/file-conventions/robots |
| Next.js sitemap | https://nextjs.org/docs/app/api-reference/file-conventions/sitemap |
| Schema.org | https://schema.org |
| Rich Results Test | https://search.google.com/test/rich-results |
| PageSpeed Insights | https://pagespeed.web.dev |

---

**마지막 업데이트**: 2026-06-09  
**버전**: 1.0  
**상태**: ✅ robots + sitemap / ⏳ JSON-LD 추가 필요
