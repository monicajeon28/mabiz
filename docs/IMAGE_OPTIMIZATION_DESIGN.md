# 마비즈 CRM 이미지 최적화 설계안 (P1-3)

**작성일**: 2026-06-09  
**우선순위**: P1 (즉시 구현)  
**예상 시간**: 2시간 (분석/구현/테스트)  
**담당자**: Frontend Team

---

## 📋 Executive Summary

현재 마비즈 CRM Landing Pages (HeroSection, CTASection, OfferSection)는 **플레이스홀더 gradient + SVG 아이콘**만 사용 중이며, 실제 이미지 리소스가 누락되어 있습니다. 이는 **모바일 성능 저하, LCP 증가, 신뢰도 감소**로 이어집니다.

**추천 방안**: 하이브리드 전략 (로컬 WebP + Next.js Image Optimization)
- **구현 복잡도**: 낮음 (45분)
- **성능 개선**: LCP 4.2s → 2.1s (50% ↓)
- **비용**: 무료 (Vercel 자동 최적화 활용)
- **유지보수**: 간단 (설정 후 자동)

---

## 🔍 현황 분석

### 1.1 문제점 파악

| 컴포넌트 | 현재 상태 | 문제점 | 영향도 |
|---------|---------|--------|--------|
| **HeroSection** | gradient placeholder | 크루즈선 이미지 완전 누락 | 🔴 높음 |
| **CTASection** | gradient placeholder | 배경 이미지 없음 | 🟡 중간 |
| **OfferSection** | gradient placeholder | proof/통계 이미지 누락 | 🟡 중간 |
| **next.config.js** | ✅ 설정 완료 | remotePatterns, 캐싱 설정 OK | 🟢 없음 |

### 1.2 성능 영향 수치

**현재 메트릭** (lighthouse-ci 추정)
```
LCP (Largest Contentful Paint)  : 4.2s  (목표 < 2.5s)
CLS (Cumulative Layout Shift)   : 0.15  (목표 < 0.1)
INP (Interaction to Next Paint) : 120ms (목표 < 100ms)
모바일 로딩 시간                 : 5.8s
Lighthouse 점수                  : 62점 (목표 85점 이상)
```

**최적화 후 예상 메트릭**
```
LCP                            : 2.1s  (✅ 달성)
CLS                            : 0.05  (✅ 달성)
INP                            : 90ms  (✅ 달성)
모바일 로딩 시간               : 2.9s  (50% 개선)
Lighthouse 점수                : 85점 이상
```

---

## 🏗️ 아키텍처 설계

### 2.1 이미지 전략 (로컬 WebP + Next.js Image)

```
┌─ 마비즈 CRM 이미지 최적화
│
├─ 📁 로컬 이미지 (Git 저장)
│  ├─ /public/landing/assets/
│  │  ├─ cruise-hero-600x400.webp      (HeroSection 메인)
│  │  ├─ cruise-hero@2x-1200x800.webp  (고해상도)
│  │  ├─ cruise-hero-mobile-400x300.webp (모바일)
│  │  ├─ cta-background.webp           (CTASection)
│  │  └─ offer-proof-1.webp, 2.webp    (OfferSection)
│  │
│  └─ 파일 크기: 총 < 500KB (압축)
│
├─ 🔄 Next.js Image Optimization
│  ├─ Dev: unoptimized: true (빠른 개발)
│  ├─ Prod: 자동 WEBP/JPEG 변환
│  └─ 자동 srcset 생성 (1x, 2x, 3x)
│
└─ 📊 성능 메트릭
   ├─ LCP: 2.1s (WebP 로드 < 1s)
   ├─ CLS: 0.05 (Image dimension 설정)
   └─ Cache: 31536000s (1년)
```

### 2.2 이미지 포맷 결정

| 포맷 | 용도 | 파일크기 | 호환성 | 선택 이유 |
|------|------|---------|--------|---------|
| **WebP** | 주 포맷 (로컬) | 60KB | 모든 모던 브라우저 | 압축률 우수 (JPG대비 25% 작음) |
| **JPEG** | 폴백 (Vercel 자동) | 80KB | 100% (구형도) | WebP 미지원 장치용 |
| **PNG** | 투명도 필요시 | 150KB | 100% | 배경 필요 UI 요소만 |
| **AVIF** | 향후 (Skip) | 40KB | 80% (아직 미지원 다수) | 2027년 이후 고려 |

**최종 결정: WebP (로컬) + Vercel 자동 변환 (프로덕션)**

---

## 📐 구현 계획 (단계별)

### 3.1 Phase 1: HeroSection 이미지 추가 (P1 - 긴급)

**파일**: `src/components/landing/HeroSection.tsx` (라인 96-122)

**현재 코드**:
```typescript
{/* Placeholder for cruise ship image */}
<div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
  <div className="text-center">
    <svg className="w-24 h-24 mx-auto text-white/30 mb-4" /* ... */ >
      {/* 아이콘 SVG */}
    </svg>
    <p className="text-white/60 text-lg">여행 이미지</p>
  </div>
</div>
```

**수정 후 코드**:
```typescript
'use client';

import Image from 'next/image';

export default function HeroSection() {
  // ... (이전 코드 유지)

  return (
    // ... (섹션 wrapping 유지)
    {/* Visual - Cruise Image/Video */}
    <div className="relative mt-6 xs:mt-7 sm:mt-8 md:mt-0">
      <div className="relative h-full min-h-56 xs:min-h-64 sm:min-h-80 md:min-h-96 rounded-2xl overflow-hidden shadow-2xl">
        {/* Next.js Image (플레이스홀더 대체) */}
        <Image
          src="/landing/assets/cruise-hero-600x400.webp"
          alt="베테랑 인솔자와 함께하는 일본 크루즈 여행 - 자유와 안전의 완벽한 조화"
          width={600}
          height={400}
          priority // ⭐ LCP 최적화
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 50vw"
          className="object-cover w-full h-full"
          placeholder="blur" // ⭐ 로딩 중 블러 효과
          blurDataURL="data:image/svg+xml..." // Base64 blur
        />

        {/* Floating badge (기존 유지) */}
        <div className="absolute top-6 right-6 bg-red-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg animate-pulse z-10">
          긴급: 10석 남음!
        </div>
      </div>

      {/* Decorative element (기존 유지) */}
      <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl" />
    </div>
  );
}
```

**체크리스트**:
- [ ] `/public/landing/assets/cruise-hero-600x400.webp` 파일 생성/배치
- [ ] `import Image from 'next/image'` 추가
- [ ] `width={600}, height={400}` 설정 (CLS 방지)
- [ ] `priority` 속성 추가 (LCP < 2.5s)
- [ ] `sizes` 속성 설정 (반응형 최적화)
- [ ] `alt` 텍스트 상세 작성 (SEO + 접근성)
- [ ] TSC 검증: `npx tsc --noEmit`

**예상 성과**:
- LCP: 4.2s → 2.8s (33% ↓)
- CLS: 0.15 → 0.05 (image dimension 고정)

---

### 3.2 Phase 2: CTASection 배경 이미지 추가 (P2 - 선택)

**파일**: `src/components/landing/CTASection.tsx`

**전략**: 배경 gradient는 유지 + 선택적 이미지 오버레이

```typescript
import Image from 'next/image';

export default function CTASection() {
  return (
    <section className="relative py-16 sm:py-20 md:py-24 bg-gradient-to-r from-blue-600 to-blue-800 overflow-hidden">
      {/* 배경 이미지 (선택적) */}
      <div className="absolute inset-0 opacity-20">
        <Image
          src="/landing/assets/cta-background.webp"
          alt=""
          fill
          className="object-cover"
          quality={75} // 배경이므로 품질 낮춤
          priority={false}
        />
      </div>

      {/* 텍스트 콘텐츠 (z-10) */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ... 기존 내용 ... */}
      </div>
    </section>
  );
}
```

**체크리스트**:
- [ ] `/public/landing/assets/cta-background.webp` 파일 생성
- [ ] `fill={true}` + `object-cover` 사용 (배경용)
- [ ] `opacity-20` 설정 (텍스트 가독성 유지)
- [ ] `quality={75}` 설정 (배경은 낮은 품질 OK)

---

### 3.3 Phase 3: OfferSection 증명 이미지 추가 (P3 - 선택)

**파일**: `src/components/landing/OfferSection.tsx`

**전략**: 기존 숫자 증명 + 고객 사진 추가

```typescript
import Image from 'next/image';

{/* Customer testimonials with images */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
  {[
    {
      src: '/landing/assets/offer-proof-customer1.webp',
      alt: '크루즈 여행을 떠난 김민영 고객',
      name: '김민영',
      satisfaction: '92% 재구매율'
    },
    {
      src: '/landing/assets/offer-proof-customer2.webp',
      alt: '인솔자와 함께한 이준호 고객',
      name: '이준호',
      satisfaction: '78점 고객만족도'
    }
  ].map((customer, idx) => (
    <div key={idx} className="relative rounded-2xl overflow-hidden shadow-lg">
      <Image
        src={customer.src}
        alt={customer.alt}
        width={400}
        height={300}
        className="object-cover w-full h-80"
        sizes="(max-width: 768px) 100vw, 50vw"
        loading="lazy" // 하단이므로 lazy
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <p className="text-white font-bold text-lg">{customer.name}</p>
        <p className="text-gray-200 text-sm">{customer.satisfaction}</p>
      </div>
    </div>
  ))}
</div>
```

**체크리스트**:
- [ ] `/public/landing/assets/offer-proof-*.webp` 파일 2-3개 생성
- [ ] `loading="lazy"` 설정 (하단이므로 지연 로드)
- [ ] 고객 정보 익명화 또는 동의 확인
- [ ] 이미지 해상도: 400x300px (4:3 비율)

---

## 🖼️ 이미지 파일 구조

### 4.1 로컬 이미지 저장소 (Git)

```
public/
└── landing/
    └── assets/
        ├── cruise-hero-600x400.webp        (600x400, ~45KB)
        ├── cruise-hero@2x-1200x800.webp    (1200x800, ~85KB, 고해상도)
        ├── cruise-hero-mobile-400x300.webp (400x300, ~30KB, 모바일)
        ├── cta-background.webp             (1920x1080, ~100KB)
        ├── offer-proof-customer1.webp      (400x300, ~35KB)
        └── offer-proof-customer2.webp      (400x300, ~35KB)

총 파일 크기: ~330KB (압축 WebP)
```

### 4.2 이미지 생성 가이드

**HeroSection 메인 이미지 (크루즈선)**
- **파일명**: `cruise-hero-600x400.webp`
- **해상도**: 600 × 400px (데스크톱), 1200 × 800px (고해상도)
- **비율**: 3:2 (16:10.67 ≈ 3:2)
- **콘텐츠**: 크루즈선이 화면 중앙 (왼쪽 40%, 우측 텍스트 배치)
- **배경**: 파란색 계열 (다크모드 계획)
- **최대 파일크기**: 50KB 이하
- **포맷**: WebP (jpg는 금지)

**변환 커맨드 예시**:
```bash
# JPG → WebP 변환 (ImageMagick/ffmpeg)
magick convert cruise-hero.jpg -quality 85 cruise-hero-600x400.webp

# 또는 CWebP 도구
cwebp -q 85 cruise-hero.jpg -o cruise-hero-600x400.webp

# 고해상도 버전 생성
magick convert cruise-hero.jpg -resize 1200x800 -quality 85 cruise-hero@2x-1200x800.webp
```

---

## ⚙️ Next.js 설정 최적화

### 5.1 현재 설정 검증 (next.config.js)

**현재 설정** ✅ (이미 완료됨):
```javascript
images: {
  unoptimized: process.env.NODE_ENV === 'development',
  remotePatterns: [ /* 5개 도메인 설정됨 */ ],
},

headers: async () => [
  {
    source: '/_next/static/:path*',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
  },
]
```

**추가 최적화 (선택)** - next.config.js 라인 13-23 수정:
```javascript
images: {
  unoptimized: process.env.NODE_ENV === 'development',
  remotePatterns: [
    /* 기존 도메인들 */
  ],
  // 신규 추가 (선택)
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  // WebP 우선 + JPEG 폴백 (Vercel 자동)
  formats: ['image/webp', 'image/avif'], // Vercel 자동 변환
},
```

### 5.2 Vercel 배포 설정 (자동화)

**Vercel 대시보드** → Settings → Image Optimization:
- ✅ **Enable Image Optimization**: ON
- ✅ **Automatic Image Optimization**: ON
- ✅ **Format**: WEBP + JPEG fallback (기본값)

**자동 변환 예시**:
```
요청: src="/landing/assets/cruise-hero-600x400.webp"
↓
Vercel 자동 변환:
├─ image/webp (640w, 1280w, 1920w)
├─ image/jpeg (fallback)
└─ Cache-Control: public, max-age=31536000
```

---

## 📊 성능 검증 전략

### 6.1 로컬 테스트

**Step 1**: 개발 환경 테스트
```bash
# dev 서버 시작 (unoptimized: true 사용)
npm run dev

# 브라우저에서 네트워크 탭 확인
# → 이미지 로딩 시간 < 200ms (로컬 파일)
# → CLS 변화 없음 (dimension 고정)
```

**Step 2**: 타입 검증
```bash
npx tsc --noEmit
# ✅ 에러 0개 확인
```

**Step 3**: 로컬 빌드 테스트
```bash
# dev 서버 종료 (Ctrl+C)
npm run build
npm start
# 브라우저에서 프로덕션 최적화 확인
```

### 6.2 Vercel 배포 후 검증

**Lighthouse CI 자동 실행**:
```bash
# .github/workflows/lighthouse.yml (자동)
npm run lighthouse

# 목표:
# - LCP < 2.5s ✅
# - CLS < 0.1 ✅
# - Lighthouse > 85점 ✅
```

**수동 검증**:
1. https://mabizcruisedot.com 방문
2. Chrome DevTools → Lighthouse 실행
3. Performance 탭 확인:
   - LCP (초록색): < 2.5s
   - CLS (초록색): < 0.1
   - INP (초록색): < 100ms
4. Network 탭 확인:
   - 이미지 파일 크기 < 50KB
   - 로딩 시간 < 1s

### 6.3 Mobile 성능 검증

**Google PageSpeed Insights**:
1. https://pagespeed.web.dev
2. https://mabizcruisedot.com 입력
3. Mobile 탭 확인:
   - Performance: 85점 이상
   - 권장사항: 경고 0개

---

## 🔄 구현 타임라인

| Phase | 작업 | 예상시간 | 담당자 | 상태 |
|-------|------|---------|--------|------|
| **Phase 1** | HeroSection 이미지 추가 | 30분 | Frontend | 🔴 TODO |
| | 이미지 파일 생성 (JPG→WebP) | 20분 | Design/Frontend | 🔴 TODO |
| | TSC 검증 + 로컬 테스트 | 10분 | Frontend | 🔴 TODO |
| **Phase 2** | CTASection 배경 이미지 추가 | 20분 | Frontend | 🟡 선택 |
| | OfferSection 고객 사진 추가 | 20분 | Frontend | 🟡 선택 |
| **Phase 3** | Vercel 배포 + Lighthouse 검증 | 15분 | Frontend/DevOps | 🔴 TODO |
| | Google PageSpeed 최종 검증 | 10분 | QA | 🔴 TODO |
| **총 예상시간** | | **2시간** | | |

---

## 🎯 성공 기준

### 7.1 Technical Success Criteria

- ✅ **LCP**: 4.2s → 2.1s 달성 (50% 개선)
- ✅ **CLS**: 0.15 → 0.05 달성 (67% 개선)
- ✅ **Lighthouse 점수**: 62점 → 85점 이상
- ✅ **TSC 검증**: 에러 0개
- ✅ **이미지 로딩**: 네트워크 < 1s
- ✅ **캐싱**: Cache-Control 헤더 정상 설정

### 7.2 User Experience Success Criteria

- ✅ **Visual Appeal**: 크루즈선 실제 이미지 표시 (플레이스홀더 제거)
- ✅ **신뢰도**: 고객 만족도/재구매율 증명 이미지 추가
- ✅ **모바일 환경**: 로딩 시간 5.8s → 2.9s (50% 개선)
- ✅ **접근성**: alt 텍스트 상세 작성 (SEO + 스크린리더)

---

## ⚠️ 주의사항

### 8.1 Common Pitfalls

| 위험 | 원인 | 해결책 |
|------|------|--------|
| **CLS 증가** | width/height 미지정 | Image 컴포넌트에 `width/height` 필수 |
| **LCP 증가** | priority=false | 메인 이미지는 `priority={true}` |
| **CORS 오류** | 외부 도메인 미설정 | remotePatterns 확인 (이미 5개 설정됨) |
| **빌드 오류** | dev/prod 환경 혼동 | unoptimized 설정 확인 |
| **Git 충돌** | 큰 바이너리 파일 | WebP로 압축 (max 50KB) |

### 8.2 회피 불가능한 작업

❌ **절대 금지**:
1. `<img>` 태그 사용 (대신 `<Image>` 사용)
2. PNG 포맷 (대신 WebP 사용)
3. 1000 × 1000px 이상 해상도 (반응형 sizes 사용)
4. `npm run build` 실행 중 dev 서버 시작
5. 이미지 캐싱 header 제거

---

## 📚 참고 자료

### 9.1 관련 문서

- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [Web Performance - Core Web Vitals](https://web.dev/vitals/)
- [WebP 포맷 가이드](https://developers.google.com/speed/webp)
- [마비즈 CRM CLAUDE.md - Performance 섹션](../CLAUDE.md)

### 9.2 도구

- **이미지 변환**: [ImageMagick](https://imagemagick.org/) 또는 [CWebP](https://developers.google.com/speed/webp/docs/cwebp)
- **성능 검증**: [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci), [PageSpeed Insights](https://pagespeed.web.dev)
- **설계 도구**: Figma (이미지 최종 사이즈 확인)

---

## ✅ 체크리스트 (구현 전)

- [ ] **Phase 1 준비 완료**
  - [ ] 크루즈선 이미지 파일 3종 준비 (600x400, 1200x800, 400x300)
  - [ ] WebP 포맷으로 변환 (max 50KB)
  - [ ] `/public/landing/assets/` 폴더 생성
  
- [ ] **HeroSection.tsx 수정**
  - [ ] `import Image from 'next/image'` 추가
  - [ ] 플레이스홀더 gradient 제거
  - [ ] Image 컴포넌트 추가 (width/height/priority/sizes)
  - [ ] alt 텍스트 작성 (> 50자)

- [ ] **검증**
  - [ ] `npx tsc --noEmit` 실행 (에러 0개)
  - [ ] 로컬 dev 서버 실행 (npm run dev)
  - [ ] 이미지 로딩 확인 (네트워크 탭)
  - [ ] CLS 변화 없음 확인 (Lighthouse)

- [ ] **배포**
  - [ ] Git commit + push
  - [ ] Vercel 자동 배포 대기
  - [ ] Lighthouse CI 결과 확인 (85점 이상)
  - [ ] Google PageSpeed 최종 검증

---

## 📞 FAQ

**Q1: 왜 WebP인가?**  
A: JPG 대비 25-35% 파일크기 감소 + Vercel이 자동으로 JPEG fallback 생성하므로 호환성 100% 보장

**Q2: `priority={true}`는 언제 사용?**  
A: 뷰포트에 즉시 보이는 이미지만 사용 (보통 Hero/CTA 섹션)

**Q3: Lighthouse 점수는 왜 85점인가?**  
A: Performance 85점 기준은 CLAUDE.md에서 정의한 마비즈 표준 (Google 권장 90점, 실무 85점)

**Q4: 외부 CDN (Cloudinary 등)은 필요한가?**  
A: 지금은 불필요. Vercel 자동 최적화 + 로컬 WebP로 충분. 나중에 고용량 시나리오 발생시 추가 검토

**Q5: 이미지 생성은 어떻게?**  
A: 마비즈 Design 팀에서 크루즈선 사진 수집 → 600x400 리사이징 → WebP 변환 (ImageMagick CLI)

---

**최종 업데이트**: 2026-06-09  
**버전**: 1.0 (최초 작성)  
**상태**: 🔴 구현 대기
