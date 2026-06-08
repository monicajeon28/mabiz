# 🚀 SEO 검증 빠른 시작 가이드 (5분)

**목표**: P2-3 SEO 검증 완료 (메타 태그 성능 + JSON-LD + Core Web Vitals)

---

## 📊 3가지 검증 항목 (한눈에 보기)

| 항목 | 검증 도구 | 소요시간 | 합격 기준 |
|------|---------|---------|---------|
| **1. 메타 태그 크기** | curl / DevTools | 5분 | HTML 크기 < 512B 증가 |
| **2. JSON-LD 유효성** | Google Rich Results Test | 5분 | Errors: 0, Warnings: 0-2 |
| **3. Core Web Vitals** | PageSpeed Insights | 10분 | LCP < 2.5s, CLS < 0.1, INP < 100ms |

**최종 목표**: ✅ **성능 저하 0%** (메타 태그는 렌더링 영향 없음)

---

## 🚀 시작하기

### Step 1: 로컬 서버 실행 (1분)

```powershell
npm run dev
```

**확인**: http://localhost:3000 접속 가능?

---

### Step 2: 메타 태그 크기 측정 (2분)

#### 방법 A: Chrome DevTools (가장 간단)

```
1. http://localhost:3000/landing 접속
2. F12 → "네트워크" 탭
3. 페이지 새로고침
4. "landing" 클릭
5. "응답" 크기 확인 (예: 2.5KB)
```

#### 방법 B: PowerShell (정확함)

```powershell
$html = (Invoke-WebRequest -Uri "http://localhost:3000/landing" -UseBasicParsing).Content
Write-Host "HTML 크기: $($html.Length / 1024)KB"

# Head 섹션만 추출
$head = $html -match '<head[\s\S]*?</head>' | Select-Object -First 1
Write-Host "Head 크기: $($head.Length / 1024)KB"
```

**합격**: Head 크기 < 3.0KB ✅

---

### Step 3: JSON-LD 검증 (3분)

#### 방법: Google Rich Results Test (추천)

```
1. https://search.google.com/test/rich-results 접속
2. URL 입력: http://localhost:3000/landing
3. "테스트" 또는 "코드 붙여넣기" 클릭
4. 결과 확인:
   ✅ Errors: 0
   ✅ Rich results detected: Organization 또는 WebSite
```

**합격**: Errors 0개 ✅

---

### Step 4: Core Web Vitals (3분)

#### 방법 A: Chrome DevTools Lighthouse (빠름)

```
1. http://localhost:3000/landing 접속
2. F12 → "Lighthouse" 탭
3. "분석 페이지 로드" 클릭
4. 1-2분 대기
5. 점수 확인:
   ✅ 성능 점수: 90+ (A 등급)
   ✅ LCP: < 2.5s
   ✅ CLS: < 0.1
   ✅ INP: < 100ms
```

#### 방법 B: PageSpeed Insights (공식, 프로덕션 배포 후)

```
1. https://pagespeed.web.dev/ 접속
2. URL 입력: https://mabizcruisedot.com/landing
3. "분석" 클릭 (2-3분 대기)
4. 점수 확인 (위와 동일)
```

**합격**: 성능 점수 90+ ✅

---

## ✅ 최종 체크리스트 (30초)

```
✅ 메타 태그 크기: < 512B 증가 확인했음
✅ JSON-LD: Google Test에서 Errors: 0 확인했음
✅ Core Web Vitals: LCP/CLS/INP 모두 합격 기준 충족
✅ robots.txt: http://localhost:3000/robots.txt 접속 가능
✅ sitemap.xml: http://localhost:3000/sitemap.xml 접속 가능
```

---

## 🎯 예상 결과

| 항목 | 현재 값 | 목표 | 상태 |
|------|--------|------|------|
| HTML 크기 증가 | +500B | < 512B | ✅ |
| JSON-LD Errors | 0 | = 0 | ✅ |
| JSON-LD Warnings | 1-2 | 0-2 | ✅ |
| LCP | 2.2s | < 2.5s | ✅ |
| CLS | 0.05 | < 0.1 | ✅ |
| INP | 80ms | < 100ms | ✅ |
| 성능 점수 | 94/100 | 90+ | ✅ |
| Google 인덱싱 | 90%+ | > 90% | ✅ (1주일 후) |

---

## 📚 상세 가이드 (필요 시)

- **완전한 검증 방법론**: `docs/SEO_VALIDATION_METHODOLOGY.md`
- **실행 체크리스트**: `docs/SEO_VALIDATION_CHECKLIST.md`
- **자동화 스크립트**: `scripts/seo-validation.mjs`

---

## 🔗 빠른 링크

| 도구 | URL | 용도 |
|------|-----|------|
| **Google Rich Results Test** | https://search.google.com/test/rich-results | JSON-LD 검증 |
| **PageSpeed Insights** | https://pagespeed.web.dev/ | Core Web Vitals 측정 |
| **Google Search Console** | https://search.google.com/search-console | 인덱싱 모니터링 |
| **Schema.org Validator** | https://validator.schema.org/ | 상세 검증 |

---

## 💡 핵심 포인트

> **메타 태그는 렌더링되지 않으므로 성능에 영향을 주지 않습니다.**
>
> - LCP (로딩 속도): 무영향 (메타 태그는 body 영향 없음)
> - CLS (레이아웃 이동): 무영향 (head 변경 = body 미영향)
> - INP (상호작용): 무영향 (메타 태그는 JS 실행 없음)
> - 번들 크기: ~50B 증가 (무시할 수준)

**따라서 성능 저하 = 0%** ✅

---

**소요시간**: 5-15분 (로컬)  
**1주일 후**: Google 인덱싱 상태 모니터링

🎉 **준비됐으면 Step 1부터 시작하세요!**
