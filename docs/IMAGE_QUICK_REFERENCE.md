# ⚡ 이미지 자산 관리 빠른 참조

**버전**: 1.0  
**업데이트**: 2026-06-09  
**용도**: 빠른 lookup & 자동 명령어

---

## 📂 파일 위치 (절대 변경 금지)

```
D:\mabiz-crm\public\landing\assets\
├── revenue_proof_1.webp           ✅ 22.01 KB
├── revenue_proof_2.webp           ✅ 23.29 KB
├── cruise-hero-600x400.webp       ⏳ (Phase 1)
├── cruise-hero@2x-1200x800.webp   ⏳ (Phase 1)
├── cruise-hero-mobile-400x300.webp ⏳ (Phase 1)
└── cta-background.webp            ⏳ (Phase 2)
```

---

## 🚀 WebP 변환 명령어

### 한 줄 실행
```powershell
# 600×400 (태블릿)
magick convert .\cruise-hero.jpg -quality 85 -resize 600x400 "D:\mabiz-crm\public\landing\assets\cruise-hero-600x400.webp"

# 1200×800 (레티나 2x)
magick convert .\cruise-hero.jpg -quality 85 -resize 1200x800 "D:\mabiz-crm\public\landing\assets\cruise-hero@2x-1200x800.webp"

# 400×300 (모바일)
magick convert .\cruise-hero.jpg -quality 80 -resize 400x300 "D:\mabiz-crm\public\landing\assets\cruise-hero-mobile-400x300.webp"

# 1920×1080 (CTA 배경)
magick convert .\cta-bg.jpg -quality 75 -resize 1920x1080 "D:\mabiz-crm\public\landing\assets\cta-background.webp"
```

### 일괄 변환 스크립트 (모두 한 번에)
```powershell
# convert-all-images.ps1
$files = @(
  @{src="D:\images\cruise-hero.jpg"; dst="cruise-hero-600x400.webp"; res="600x400"; q=85},
  @{src="D:\images\cruise-hero.jpg"; dst="cruise-hero@2x-1200x800.webp"; res="1200x800"; q=85},
  @{src="D:\images\cruise-hero.jpg"; dst="cruise-hero-mobile-400x300.webp"; res="400x300"; q=80},
  @{src="D:\images\cta-bg.jpg"; dst="cta-background.webp"; res="1920x1080"; q=75}
)

$outDir = "D:\mabiz-crm\public\landing\assets"

foreach ($file in $files) {
  Write-Host "변환 중: $($file.dst)..."
  magick convert $file.src -quality $file.q -resize $file.res "$outDir\$($file.dst)"
  Write-Host "✅ 완료"
}

Write-Host "`n=== 검증 ===" 
Get-ChildItem "$outDir\*.webp" | ForEach-Object {
  Write-Host "✓ $($_.Name) - $('{0:F2}' -f ($_.Length/1KB)) KB"
}
```

---

## ✅ 파일 검증 명령어

### 파일 크기 확인
```powershell
# 전체 이미지 크기
Get-ChildItem "D:\mabiz-crm\public\landing\assets\*.webp" | 
  Measure-Object -Property Length -Sum | 
  Select-Object @{Name='TotalKB';Expression={[math]::Round($_.Sum/1KB,2)}}

# 개별 파일
Get-ChildItem "D:\mabiz-crm\public\landing\assets\*.webp" | 
  Select-Object Name, @{Name='SizeKB';Expression={[math]::Round($_.Length/1KB,2)}}
```

### 파일 형식 검증
```bash
# WebP 형식 확인
file D:\mabiz-crm\public\landing\assets\*.webp

# 모두 WebP인지 확인
Get-ChildItem "D:\mabiz-crm\public\landing\assets\*.webp" | ForEach-Object {
  $header = [System.IO.File]::ReadAllBytes($_.FullName)[0..4] -join ' '
  Write-Host "$($_.Name): $header"
}
# WebP 매직 넘버: 52 49 46 46 (RIFF)
```

### 타입스크립트 검증
```bash
npx tsc --noEmit
```

---

## 📏 해상도 및 크기 목표표

| 파일명 | 해상도 | 품질 | 목표크기 | 체크 |
|--------|--------|------|---------|------|
| cruise-hero-600x400.webp | 600×400 | 85% | ≤50 KB | ≤50 |
| cruise-hero@2x-1200x800.webp | 1200×800 | 85% | ≤85 KB | ≤85 |
| cruise-hero-mobile-400x300.webp | 400×300 | 80% | ≤30 KB | ≤30 |
| cta-background.webp | 1920×1080 | 75% | ≤100 KB | ≤100 |
| **합계** | - | - | **≤265 KB** | **≤265** |

---

## 🔗 HTML 코드 스니펫

### Hero Section (반응형)
```html
<picture>
  <source media="(max-width: 640px)" srcSet="/landing/assets/cruise-hero-mobile-400x300.webp" type="image/webp" />
  <source media="(max-width: 1024px)" srcSet="/landing/assets/cruise-hero-600x400.webp, /landing/assets/cruise-hero@2x-1200x800.webp 2x" type="image/webp" />
  <source srcSet="/landing/assets/cruise-hero-600x400.webp, /landing/assets/cruise-hero@2x-1200x800.webp 2x" type="image/webp" />
  <img src="/landing/assets/cruise-hero-600x400.webp" alt="크루즈 여행" width="600" height="400" loading="eager" />
</picture>
```

### CTA Section (배경)
```html
<section style="background-image: url(/landing/assets/cta-background.webp); background-size: cover; background-position: center;">
  <!-- 콘텐츠 -->
</section>
```

### Offer Section (증명 이미지)
```html
<picture>
  <source srcSet="/landing/assets/revenue_proof_1.webp" type="image/webp" />
  <img src="/landing/assets/revenue_proof_1.webp" alt="고객 증명" width="400" height="300" loading="lazy" />
</picture>
```

---

## 🎯 Lighthouse 성능 체크

```bash
# 1. dev 서버 실행
npm run dev

# 2. Lighthouse 실행 (모바일 기준)
npx lighthouse http://localhost:3000/landing \
  --output=html \
  --emulated-form-factor=mobile \
  --output-path=./lighthouse-mobile.html

# 3. 점수 확인
# 목표: 85점 이상
# LCP < 2.5s
# CLS < 0.1
# INP < 100ms
```

---

## 🐛 문제 해결

### Q1: 이미지가 너무 크다 (50KB 초과)
```powershell
# Quality 파라미터를 감소시키기
# 75% → 70% → 65% (대략 5-10% 크기 감소)
magick convert input.jpg -quality 75 -resize 600x400 output.webp
```

### Q2: 이미지가 너무 흐릿해 보인다
```powershell
# Quality 파라미터를 증가시키기
# 80% → 85% → 90% (대략 5-10% 크기 증가)
magick convert input.jpg -quality 90 -resize 600x400 output.webp
```

### Q3: 잘못된 해상도로 변환함
```powershell
# 새로 변환하기 (동일한 파일명 덮어쓰기)
magick convert input.jpg -quality 85 -resize 600x400 output.webp
```

### Q4: WebP 형식이 아니다
```powershell
# 파일 확장자 다시 확인 (반드시 .webp로 끝나야 함)
# 올바른 형식 변환:
magick convert input.jpg output.webp  # ← .webp 확장자 필수
```

### Q5: 타입스크립트 오류 발생
```bash
# TSC 재실행
npx tsc --noEmit
# 모두 0 에러 확인

# 필요시 cache 삭제
rm -r .next
npm run build
```

---

## 📋 Git 커밋 템플릿

```bash
# Phase 1 완료 시
git add public/landing/assets/cruise-hero-*.webp
git add src/app/(dashboard)/landing/components/HeroSection.tsx
git commit -m "feat(landing): Hero Section 반응형 이미지 최적화

- 600×400 / 1200×800 / 400×300 3단계 해상도 추가
- picture 요소 + srcset으로 반응형 구현
- WebP 형식 (30% 크기 절감)
- Lighthouse LCP < 2.5s 달성"

# Phase 2 완료 시
git add public/landing/assets/cta-background.webp
git add src/app/(dashboard)/landing/components/CTASection.tsx
git commit -m "feat(landing): CTA Section 배경 이미지 추가

- 1920×1080 배경 이미지 WebP 최적화
- 검정 오버레이로 텍스트 가독성 강화
- 심리학 기반 긴급성 배지 (희소성/FOMO)"
```

---

## 🗂️ 폴더 구조 (참고용)

```
D:\mabiz-crm\
├── public\
│   └── landing\
│       ├── index.html
│       └── assets\                    ← 이미지 저장소
│           ├── revenue_proof_1.webp   ✅
│           ├── revenue_proof_2.webp   ✅
│           ├── cruise-hero-600x400.webp
│           ├── cruise-hero@2x-1200x800.webp
│           ├── cruise-hero-mobile-400x300.webp
│           └── cta-background.webp
│
├── src\app\(dashboard)\landing\components\
│   ├── HeroSection.tsx               (수정 필요)
│   ├── CTASection.tsx                (수정 필요)
│   └── OfferSection.tsx              (이미 구현)
│
└── docs\
    ├── IMAGE_ASSETS_VERIFICATION_REPORT.md    ← 현황
    ├── IMAGE_IMPLEMENTATION_ROADMAP.md        ← 상세 가이드
    └── IMAGE_QUICK_REFERENCE.md               ← 이 파일
```

---

## 📞 자주 묻는 질문 (FAQ)

**Q: 이미지를 새로 추가하려면?**
A: 
1. `/public/landing/assets/` 폴더에 `.webp` 파일 저장
2. `width="XXX" height="YYY"` 속성 포함한 HTML 작성
3. `npx tsc --noEmit` 검증
4. Git commit

**Q: 이미지 크기 줄이려면?**
A: ImageMagick quality 파라미터 감소 (85% → 75%)

**Q: 레티나 디스플레이 지원?**
A: `srcset="/landing/assets/image-600x400.webp, /landing/assets/image-1200x800.webp 2x"` 사용

**Q: 모바일 최적화?**
A: `<picture>` 요소의 `media="(max-width: 640px)"` 사용

**Q: 배포 시 이미지 캐싱?**
A: `/public/` 파일은 자동으로 Vercel CDN 캐싱됨 (1년)

---

## ✅ 체크리스트

이미지 추가 전 확인 사항:

- [ ] ImageMagick 설치되어 있나? (`magick --version`)
- [ ] 원본 이미지 준비되어 있나?
- [ ] WebP로 변환했나?
- [ ] 파일 크기가 목표 범위 내인가?
- [ ] HTML 코드에 width/height 속성이 있나?
- [ ] `npx tsc --noEmit` 0 에러인가?
- [ ] Lighthouse 85점 이상인가?
- [ ] Git commit 완료했나?

---

**마지막 업데이트**: 2026-06-09  
**다음 확인**: Phase 1 또는 Phase 2 완료 후 이 문서 업데이트
