# 마비즈 CRM 이미지 자산 사양서 (IMAGE_OPTIMIZATION_DESIGN.md 추출)

**생성일**: 2026-06-09  
**기준**: IMAGE_OPTIMIZATION_DESIGN.md (섹션 4.1-4.2)  
**상태**: 구현 대기

---

## 📁 이미지 저장소 구조

```
D:\mabiz-crm\
└── public\
    └── landing\
        └── assets\
            ├── cruise-hero-600x400.webp        ← Phase 1 (P1 긴급)
            ├── cruise-hero@2x-1200x800.webp    ← Phase 1 (고해상도)
            ├── cruise-hero-mobile-400x300.webp ← Phase 1 (모바일)
            ├── cta-background.webp             ← Phase 2 (P2 선택)
            ├── offer-proof-customer1.webp      ← Phase 3 (P3 선택)
            └── offer-proof-customer2.webp      ← Phase 3 (P3 선택)
```

**총 파일 크기**: ~330KB (모두 합쳐서)

---

## 🎯 이미지 사양 (상세)

### 1. cruise-hero-600x400.webp (HeroSection 메인)

| 속성 | 값 | 비고 |
|------|-----|------|
| **경로** | `/public/landing/assets/cruise-hero-600x400.webp` | Git 저장 |
| **해상도** | 600 × 400px | 데스크톱 기준 |
| **비율** | 3:2 (15:10) | 16:9 수정 가능 |
| **포맷** | WebP | JPG→WebP 변환 |
| **파일크기** | ≤ 50KB | 압축 필수 |
| **품질** | quality=85 | ImageMagick 기준 |
| **콘텐츠** | 크루즈선 중앙 | 왼쪽 40%, 우측 텍스트 공간 |
| **배경색** | 파란색 계열 | 다크모드 고려 |
| **용도** | HeroSection 메인 배경 | `priority={true}` 설정 |
| **LCP 영향** | 메인 이미지 (LCP 대상) | 로드 시간 < 1s 목표 |

**변환 커맨드**:
```powershell
# ImageMagick (Windows)
magick convert cruise-hero.jpg -quality 85 -resize 600x400 "D:\mabiz-crm\public\landing\assets\cruise-hero-600x400.webp"

# 또는 CWebP
cwebp -q 85 cruise-hero.jpg -o "D:\mabiz-crm\public\landing\assets\cruise-hero-600x400.webp"
```

---

### 2. cruise-hero@2x-1200x800.webp (고해상도 Retina)

| 속성 | 값 | 비고 |
|------|-----|------|
| **경로** | `/public/landing/assets/cruise-hero@2x-1200x800.webp` | srcset 용 (2x) |
| **해상도** | 1200 × 800px | 2배 해상도 |
| **비율** | 3:2 | 기본과 동일 |
| **포맷** | WebP | - |
| **파일크기** | ≤ 85KB | 기본대비 1.7배 |
| **품질** | quality=85 | - |
| **용도** | Retina 디스플레이 | 2x srcset |
| **필수여부** | 선택 | Next.js 자동 생성 가능 |

**변환 커맨드**:
```powershell
magick convert cruise-hero.jpg -quality 85 -resize 1200x800 "D:\mabiz-crm\public\landing\assets\cruise-hero@2x-1200x800.webp"
```

---

### 3. cruise-hero-mobile-400x300.webp (모바일용)

| 속성 | 값 | 비고 |
|------|-----|------|
| **경로** | `/public/landing/assets/cruise-hero-mobile-400x300.webp` | 모바일 기준 |
| **해상도** | 400 × 300px | 모바일 뷰포트 |
| **비율** | 4:3 | 기본과 약간 다름 |
| **포맷** | WebP | - |
| **파일크기** | ≤ 30KB | 최소 용량 |
| **품질** | quality=80 | 모바일은 낮춤 |
| **용도** | 모바일 최적화 | `sizes` 속성으로 자동 선택 |
| **필수여부** | 선택 | Next.js Image sizes로 대체 가능 |

**변환 커맨드**:
```powershell
magick convert cruise-hero.jpg -quality 80 -resize 400x300 "D:\mabiz-crm\public\landing\assets\cruise-hero-mobile-400x300.webp"
```

---

### 4. cta-background.webp (CTASection 배경)

| 속성 | 값 | 비고 |
|------|-----|------|
| **경로** | `/public/landing/assets/cta-background.webp` | CTASection 배경 |
| **해상도** | 1920 × 1080px | 풀스크린 데스크톱 |
| **비율** | 16:9 | 와이드스크린 |
| **포맷** | WebP | - |
| **파일크기** | ≤ 100KB | 배경이므로 조금 더 큼 |
| **품질** | quality=75 | 배경은 낮은 품질 OK |
| **콘텐츠** | 추상적 배경 (선택적) | 텍스트 가독성 방해 금지 |
| **오버레이** | opacity-20 | CSS로 투명도 처리 |
| **용도** | CTASection 배경 + gradient | `fill={true}` 사용 |
| **필수여부** | 선택 (P2) | 기본 gradient만으로도 충분 |

**변환 커맨드**:
```powershell
magick convert cta-bg.jpg -quality 75 -resize 1920x1080 "D:\mabiz-crm\public\landing\assets\cta-background.webp"
```

---

### 5. offer-proof-customer1.webp (고객 증명1)

| 속성 | 값 | 비고 |
|------|-----|------|
| **경로** | `/public/landing/assets/offer-proof-customer1.webp` | OfferSection 첫 번째 |
| **해상도** | 400 × 300px | 카드 사이즈 |
| **비율** | 4:3 | 인물 사진 표준 |
| **포맷** | WebP | - |
| **파일크기** | ≤ 35KB | 소형 이미지 |
| **품질** | quality=80 | - |
| **콘텐츠** | 고객 만족 표정 | 실제 고객 또는 대체 이미지 |
| **메타데이터** | alt="크루즈 여행을 떠난 김민영 고객" | SEO + 접근성 |
| **오버레이** | gradient-to-t (하단 검정) | 텍스트 배경용 |
| **로딩** | loading="lazy" | 하단이므로 지연로드 |
| **필수여부** | 선택 (P3) | 현재 없어도 동작 |

**변환 커맨드**:
```powershell
magick convert customer1.jpg -quality 80 -resize 400x300 "D:\mabiz-crm\public\landing\assets\offer-proof-customer1.webp"
```

---

### 6. offer-proof-customer2.webp (고객 증명2)

| 속성 | 값 | 비고 |
|------|-----|------|
| **경로** | `/public/landing/assets/offer-proof-customer2.webp` | OfferSection 두 번째 |
| **해상도** | 400 × 300px | 카드 사이즈 |
| **비율** | 4:3 | 인물 사진 표준 |
| **포맷** | WebP | - |
| **파일크기** | ≤ 35KB | 소형 이미지 |
| **품질** | quality=80 | - |
| **콘텐츠** | 고객 + 인솔자 | 신뢰도 증명 |
| **메타데이터** | alt="인솔자와 함께한 이준호 고객" | SEO + 접근성 |
| **필수여부** | 선택 (P3) | 현재 없어도 동작 |

---

## 🚀 구현 우선순위

| Phase | 파일 | 상태 | 예상시간 | P등급 |
|-------|-----|------|---------|--------|
| **Phase 1** | cruise-hero-600x400.webp | 🔴 TODO | 30분 | **P1 긴급** |
| | cruise-hero@2x-1200x800.webp | 🔴 TODO | 10분 | P1 |
| | cruise-hero-mobile-400x300.webp | 🔴 TODO | 10분 | P1 |
| **Phase 2** | cta-background.webp | 🟡 선택 | 20분 | P2 |
| **Phase 3** | offer-proof-customer1.webp | 🟡 선택 | 10분 | P3 |
| | offer-proof-customer2.webp | 🟡 선택 | 10분 | P3 |

**총 예상**: Phase 1 (50분) + Phase 2-3 (40분) = **90분**

---

## 📝 코드 내 사용 예시

### HeroSection.tsx (Phase 1)
```typescript
import Image from 'next/image';

<Image
  src="/landing/assets/cruise-hero-600x400.webp"
  alt="베테랑 인솔자와 함께하는 일본 크루즈 여행 - 자유와 안전의 완벽한 조화"
  width={600}
  height={400}
  priority
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 50vw"
  className="object-cover w-full h-full"
  placeholder="blur"
  blurDataURL="data:image/svg+xml;..."
/>
```

### CTASection.tsx (Phase 2)
```typescript
<Image
  src="/landing/assets/cta-background.webp"
  alt=""
  fill
  className="object-cover"
  quality={75}
  priority={false}
/>
```

### OfferSection.tsx (Phase 3)
```typescript
<Image
  src="/landing/assets/offer-proof-customer1.webp"
  alt="크루즈 여행을 떠난 김민영 고객"
  width={400}
  height={300}
  className="object-cover w-full h-80"
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="lazy"
/>
```

---

## ⚠️ 품질 검증 체크리스트

- [ ] 파일 크기: 최대값 이하 확인 (50KB, 85KB, 30KB 등)
- [ ] 포맷: WebP 확인 (JPG 절대 금지)
- [ ] 해상도: 정확한 픽셀 확인 (600x400, 1200x800 등)
- [ ] 색상 프로파일: sRGB 표준 사용
- [ ] 메타데이터: EXIF 데이터 제거 (용량 감소)
- [ ] 손상 여부: 이미지 뷰어에서 육안 확인
- [ ] 네이밍: 정확한 파일명 사용 (오타 금지)

---

## 📊 성능 목표

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| **LCP** | 4.2s | 2.1s | ↓50% |
| **CLS** | 0.15 | 0.05 | ↓67% |
| **이미지 로딩** | - | < 1s | ✅ |
| **Lighthouse** | 62점 | 85점+ | ↑23점 |

---

**참고**: IMAGE_OPTIMIZATION_DESIGN.md 섹션 4.1-4.2에서 추출
