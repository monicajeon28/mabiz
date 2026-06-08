# 🗺️ 이미지 구현 로드맵 및 상세 가이드

**버전**: 1.0  
**작성일**: 2026-06-09  
**상태**: 🟡 부분 구현 중 (2/6 완료)

---

## 📊 전체 진행 상황

```
Phase 1: Hero Section (우선순위 1️⃣)
├── cruise-hero-600x400.webp      [⏳ 계획 중]
├── cruise-hero@2x-1200x800.webp  [⏳ 계획 중]
└── cruise-hero-mobile-400x300.webp [⏳ 계획 중]

Phase 2: CTA Section (우선순위 2️⃣)
└── cta-background.webp           [⏳ 계획 중]

Phase 3: Offer Section (✅ 완료)
├── revenue_proof_1.webp          [✅ 완료]
└── revenue_proof_2.webp          [✅ 완료]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
진행률: 2/6 (33.3%)
크기: 45.30 KB / 310.30 KB (14.6%)
```

---

## 🎯 Phase 1: Hero Section (우선순위 1 - 고객 첫 인상)

### 목표
- HeroSection에 반응형 크루즈 이미지 적용
- 모바일/태블릿/데스크톱 3단계 최적화
- Lighthouse LCP < 2.5s 달성

### 필요 이미지

| 파일명 | 해상도 | 용도 | 품질 | 목표크기 |
|--------|--------|------|------|---------|
| **cruise-hero-600x400.webp** | 600×400 | 태블릿 (iPad) | 85% | ≤50KB |
| **cruise-hero@2x-1200x800.webp** | 1200×800 | 레티나/데스크톱 2x | 85% | ≤85KB |
| **cruise-hero-mobile-400x300.webp** | 400×300 | 모바일 (≤640px) | 80% | ≤30KB |

### 구현 단계

#### Step 1: 원본 이미지 준비
```powershell
# 1. 크루즈 선박 이미지 준비 (원본: cruise-hero.jpg)
# 요구사항:
#   - 가로:세로 비율 = 600:400 또는 1200:800
#   - 최소 1200px 너비 (확대 가능)
#   - 밝은 톤 (밤바다 X, 해일 X)
#   - 고급스러운 감 (럭셀리한 크루즈 선박)
# 
# 예: D:\images\cruise-hero.jpg

# 2. 파일 확인
Get-ChildItem "D:\images\cruise-hero.jpg" | Select-Object Name, @{Name='SizeKB';Expression={[math]::Round($_.Length/1KB,2)}}
```

#### Step 2: WebP 변환 스크립트
```powershell
# D:\mabiz-crm\scripts\convert-hero-images.ps1
# ImageMagick 필수 설치: choco install imagemagick

$imageSource = "D:\images\cruise-hero.jpg"
$outputDir = "D:\mabiz-crm\public\landing\assets"

# 600×400 (태블릿용)
Write-Host "변환 중: 600×400..."
magick convert "$imageSource" -quality 85 -resize 600x400 "$outputDir\cruise-hero-600x400.webp"
Write-Host "✅ 완료"

# 1200×800 (레티나/데스크톱)
Write-Host "변환 중: 1200×800..."
magick convert "$imageSource" -quality 85 -resize 1200x800 "$outputDir\cruise-hero@2x-1200x800.webp"
Write-Host "✅ 완료"

# 400×300 (모바일)
Write-Host "변환 중: 400×300..."
magick convert "$imageSource" -quality 80 -resize 400x300 "$outputDir\cruise-hero-mobile-400x300.webp"
Write-Host "✅ 완료"

# 검증
Write-Host ""
Write-Host "=== 변환 검증 ==="
Get-ChildItem "$outputDir\cruise-hero*.webp" | ForEach-Object {
  Write-Host "✓ $($_.Name) - $('{0:F2}' -f ($_.Length/1KB)) KB"
}
```

#### Step 3: HeroSection 컴포넌트 수정
```typescript
// src/app/(dashboard)/landing/components/HeroSection.tsx

import Image from 'next/image';

export function HeroSection() {
  return (
    <section className="relative w-full h-screen bg-gradient-to-b from-blue-900 to-blue-800 overflow-hidden">
      {/* 배경 이미지 (반응형) */}
      <picture className="absolute inset-0 w-full h-full">
        {/* 모바일: 400×300 (≤640px) */}
        <source
          media="(max-width: 640px)"
          srcSet="/landing/assets/cruise-hero-mobile-400x300.webp"
          type="image/webp"
        />
        
        {/* 태블릿: 600×400 (641-1024px) + 2x Retina */}
        <source
          media="(max-width: 1024px)"
          srcSet="/landing/assets/cruise-hero-600x400.webp, /landing/assets/cruise-hero@2x-1200x800.webp 2x"
          type="image/webp"
        />
        
        {/* 데스크톱: 1200×800 2x srcset */}
        <source
          srcSet="/landing/assets/cruise-hero-600x400.webp, /landing/assets/cruise-hero@2x-1200x800.webp 2x"
          type="image/webp"
        />
        
        {/* 폴백 JPG (WebP 미지원 브라우저) */}
        <img
          src="/landing/assets/cruise-hero-600x400.webp"
          alt="럭셀리한 크루즈 선박 - 드림 여행의 시작"
          className="w-full h-full object-cover"
          width={600}
          height={400}
          loading="eager"
          decoding="async"
        />
      </picture>

      {/* 그라데이션 오버레이 */}
      <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />

      {/* 콘텐츠 */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
          꿈의 크루즈 여행을 현실로
        </h1>
        <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl drop-shadow-md">
          세계 최고급 크루즈 상품을 한 곳에서 만나보세요
        </p>
        <button className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-8 rounded-lg transition-colors drop-shadow-lg">
          지금 예약하기
        </button>
      </div>
    </section>
  );
}
```

#### Step 4: 성능 검증
```bash
# 1. TypeScript 검증
npx tsc --noEmit

# 2. 이미지 파일 검증
file D:\mabiz-crm\public\landing\assets\cruise-hero*.webp

# 3. Lighthouse 성능 검증
# dev 서버 실행 후:
npx lighthouse http://localhost:3000/landing \
  --output=json \
  --only-categories=performance \
  --output-path=./lighthouse-phase1.json

# 목표: LCP < 2.5s, CLS < 0.1
```

#### Step 5: Git Commit
```bash
git add src/app/(dashboard)/landing/components/HeroSection.tsx
git add public/landing/assets/cruise-hero-*.webp
git commit -m "feat(landing): Hero Section 반응형 이미지 최적화 추가

- 600×400 / 1200×800 / 400×300 3단계 해상도
- picture 요소 + srcset로 반응형 구현
- WebP 형식으로 30-40% 크기 절감
- Lighthouse LCP < 2.5s 달성 목표
- 모바일/태블릿/데스크톱 최적화 완료"
```

---

## 🎨 Phase 2: CTA Section (우선순위 2 - 전환 유도)

### 목표
- CTASection 배경이미지 추가
- 호출 행동 강조 (Call-to-Action)
- 심리학 기반 긴급성 표현

### 필요 이미지

| 파일명 | 해상도 | 용도 | 품질 | 목표크기 |
|--------|--------|------|------|---------|
| **cta-background.webp** | 1920×1080 | CTA 배경 | 75% | ≤100KB |

### 구현 단계

#### Step 1: 원본 이미지 준비
```powershell
# 배경 이미지 요구사항:
#   - 1920×1080 해상도 (또는 비율 16:9)
#   - 크루즈/여행 테마 (선택사항)
#   - 밝은 배경 (텍스트 가독성 위해)
#   - 약간의 보케 효과 (텍스트 포커스)
# 
# 예: D:\images\cta-bg.jpg

Get-ChildItem "D:\images\cta-bg.jpg" | Select-Object Name, @{Name='SizeKB';Expression={[math]::Round($_.Length/1KB,2)}}
```

#### Step 2: WebP 변환
```powershell
$imageSource = "D:\images\cta-bg.jpg"
$outputDir = "D:\mabiz-crm\public\landing\assets"

Write-Host "변환 중: CTA 배경 1920×1080..."
magick convert "$imageSource" -quality 75 -resize 1920x1080 "$outputDir\cta-background.webp"
Write-Host "✅ 완료"

# 검증
Get-ChildItem "$outputDir\cta-background.webp" | ForEach-Object {
  Write-Host "✓ $($_.Name) - $('{0:F2}' -f ($_.Length/1KB)) KB"
}
```

#### Step 3: CTASection 컴포넌트 수정
```typescript
// src/app/(dashboard)/landing/components/CTASection.tsx

export function CTASection() {
  return (
    <section
      className="relative py-20 md:py-32 bg-cover bg-center"
      style={{
        backgroundImage: 'url(/landing/assets/cta-background.webp)',
      }}
    >
      {/* 어두운 오버레이 (텍스트 가독성) */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 콘텐츠 */}
      <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          지금 바로 시작하세요!
        </h2>
        <p className="text-lg md:text-xl text-gray-100 mb-8">
          오늘 예약하시면 특별 할인 20% 즉시 적용
        </p>
        
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 px-8 rounded-lg transition-colors">
            예약 시작하기
          </button>
          <button className="bg-white hover:bg-gray-100 text-black font-bold py-4 px-8 rounded-lg transition-colors">
            상담받기
          </button>
        </div>

        {/* 긴급성 배지 (심리학: 희소성) */}
        <div className="mt-8 inline-block bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold">
          🔥 오늘 만료: 20% 할인 마감
        </div>
      </div>
    </section>
  );
}
```

#### Step 4: 성능 검증
```bash
# 1. 이미지 경로 검증
file D:\mabiz-crm\public\landing\assets\cta-background.webp

# 2. 페이지 검증 및 Lighthouse
npx lighthouse http://localhost:3000/landing \
  --output=json \
  --output-path=./lighthouse-phase2.json
```

#### Step 5: Git Commit
```bash
git add src/app/(dashboard)/landing/components/CTASection.tsx
git add public/landing/assets/cta-background.webp
git commit -m "feat(landing): CTA Section 배경 이미지 추가

- 1920×1080 배경 이미지 (WebP 최적화)
- 검정/반투명 오버레이로 텍스트 가독성 강화
- 심리학 기반 긴급성 배지 추가 (희소성/FOMO)
- 반응형 레이아웃 유지"
```

---

## 📈 Phase 3: 성능 최적화 및 검증

### Lighthouse 성능 목표

```
Phase 1 + Phase 2 완료 후:
┌─────────────────────┬─────────┬─────────┐
│ 메트릭              │ 목표    │ 상태    │
├─────────────────────┼─────────┼─────────┤
│ Performance         │ 85+     │ ⏳ 검증 │
│ LCP (최대 콘텐츠)   │ < 2.5s  │ ⏳ 검증 │
│ CLS (누적 이동)     │ < 0.1   │ ⏳ 검증 │
│ INP (인터랙션)      │ < 100ms │ ⏳ 검증 │
└─────────────────────┴─────────┴─────────┘
```

### 최적화 체크리스트

```powershell
# 1. 이미지 전체 파일 크기 확인
$totalSize = (Get-ChildItem "D:\mabiz-crm\public\landing\assets\*.webp" | Measure-Object -Property Length -Sum).Sum
Write-Host "총 이미지 크기: $('{0:F2}' -f ($totalSize/1KB)) KB"
# 목표: < 330 KB

# 2. 캐싱 헤더 검증 (next.config.js)
cat next.config.js | Select-String -Pattern "cache|revalidate"

# 3. 이미지 로딩 속성 검증
# 모든 img 태그에 width/height 속성 확인
# lazy loading 이미지에 loading="lazy" 확인
# hero 이미지는 loading="eager" 사용

# 4. Lighthouse 실행
npm run dev  # dev 서버 실행
npx lighthouse http://localhost:3000/landing \
  --output=html \
  --output=json \
  --save-assets \
  --emulated-form-factor=mobile \
  --output-path=./lighthouse-mobile.html

# 목표: 85점 이상
```

---

## 🔄 통합 실행 계획

### Week 1: Phase 1 구현
```
Day 1: 원본 이미지 준비
Day 2-3: WebP 변환 + HeroSection 수정
Day 4: 성능 검증 + 커밋
```

### Week 2: Phase 2 구현
```
Day 1: 원본 이미지 준비
Day 2-3: WebP 변환 + CTASection 수정
Day 4: 성능 검증 + 커밋
```

### Week 3: 최종 검증
```
Day 1-2: 전체 Lighthouse 검증
Day 3: 최적화 조정 (필요 시)
Day 4: 최종 커밋 + 배포 준비
```

---

## ⚠️ 주의사항

1. **ImageMagick 설치**: `choco install imagemagick` (한 번만)
2. **파일 위치**: 항상 `/public/landing/assets/` 사용
3. **파일명**: 소문자+하이픈 규칙 준수
4. **WebP 검증**: `file` 명령으로 형식 확인
5. **Lighthouse**: 85점 미만 시 quality 파라미터 조정

---

## 📋 진행 상황 업데이트 템플릿

```markdown
## 진행 현황 (2026-06-XX)

### Phase 1: Hero Section
- [x] 원본 이미지 준비
- [x] WebP 변환
- [x] 컴포넌트 수정
- [x] 검증 완료
- [x] 커밋 완료

### Phase 2: CTA Section
- [ ] 원본 이미지 준비
- [ ] WebP 변환
- [ ] 컴포넌트 수정
- [ ] 검증 완료
- [ ] 커밋 완료

### 최종 검증
- [ ] Lighthouse 85+ 달성
- [ ] 모든 이미지 파일 확인
- [ ] 배포 준비 완료

**커밋 히스토리**:
- ✅ [커밋 해시] Hero Section 이미지 추가
- ⏳ CTA Section 이미지 추가 (예정)
```

---

**마지막 업데이트**: 2026-06-09  
**다음 단계**: Phase 1 원본 이미지 준비 → WebP 변환 시작
