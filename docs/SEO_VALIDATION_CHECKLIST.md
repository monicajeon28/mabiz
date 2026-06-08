# SEO 검증 실행 체크리스트 (P2-3 SEO)

**작성일**: 2026-06-09  
**목표**: 메타 태그 추가로 인한 성능 저하 0%, Google 인덱싱 > 90%  
**예상 소요시간**: 45분

---

## ✅ Phase 1: 로컬 환경 검증 (15분)

### 1-1. 개발 서버 실행

```powershell
# Terminal 1: 개발 서버 시작
npm run dev

# 예상 출력:
# ▲ Next.js 15.x.x
# - Local: http://localhost:3000
```

**✅ 체크**: 서버가 http://localhost:3000 에서 실행 중?

### 1-2. TSC 컴파일 검증 (에러 0개 확인)

```powershell
# Terminal 2: 타입스크립트 검증
npx tsc --noEmit

# 예상 결과: (출력 없음 = 성공)
```

**✅ 체크**: TSC 에러 0개?

### 1-3. 메타 태그 크기 측정

```powershell
# Terminal 3: 랜딩 페이지 크기 측정
$response = Invoke-WebRequest -Uri "http://localhost:3000/landing" -UseBasicParsing
$htmlSize = $response.Content.Length
$headMatch = $response.Content | Select-String '<head[\s\S]*?</head>' -AllMatches
$headSize = if ($headMatch) { $headMatch.Matches[0].Value.Length } else { 0 }

Write-Host "📊 메타 태그 크기 측정:"
Write-Host "  └─ HTML 전체: $([math]::Round($htmlSize/1024, 2))KB"
Write-Host "  └─ Head 섹션: $([math]::Round($headSize/1024, 2))KB"

# 목표: Head 섹션 < 2.5KB (기존) + 512B = 3.0KB 이내
```

**✅ 체크**: Head 섹션이 3.0KB 이내?

---

## ✅ Phase 2: 메타 태그 검증 (10분)

### 2-1. 페이지 소스 확인

**방법 1: 브라우저**
```
1. http://localhost:3000/landing 접속
2. 우클릭 → "페이지 소스 보기"
3. Ctrl+F로 검색:
   - "<meta name="description"" → 찾음 ✅
   - "<meta property="og:title"" → 찾음 ✅
   - "<link rel="canonical"" → 찾음 ✅
```

**방법 2: curl (PowerShell)**
```powershell
$html = Invoke-WebRequest -Uri "http://localhost:3000/landing" -UseBasicParsing | Select-Object -ExpandProperty Content

# 메타 태그 개수 확인
[regex]::Matches($html, '<meta\s+').Count # 예상: 15+ 개

# OpenGraph 확인
$html -match '<meta property="og:' # 예상: True

# Canonical 확인
$html -match '<link rel="canonical"' # 예상: True
```

**✅ 체크**:
- [ ] description 메타 태그 있음
- [ ] OpenGraph 태그 3개 이상 (og:title, og:description, og:image)
- [ ] Canonical 링크 있음
- [ ] Viewport 설정 있음

### 2-2. 필수 메타 태그 목록

| 메타 태그 | 예상 값 | 확인 |
|----------|--------|------|
| `<title>` | "마비즈 크루즈닷파트너스 — 파트너 CRM" | ✅ |
| `<meta name="description">` | "크루즈닷 파트너 전용 CRM..." | ✅ |
| `<meta name="viewport">` | "width=device-width, initial-scale=1" | ✅ |
| `<meta property="og:title">` | "마비즈 크루즈닷파트너스 — 파트너 CRM" | ✅ |
| `<meta property="og:description">` | "크루즈닷 파트너 전용 CRM..." | ✅ |
| `<meta property="og:image">` | "/og-image.png" | ✅ |
| `<meta property="og:type">` | "website" | ✅ |
| `<meta property="og:url">` | "https://mabizcruisedot.com/landing" | ✅ |
| `<meta name="twitter:card">` | "summary_large_image" | ✅ |
| `<link rel="canonical">` | "https://mabizcruisedot.com/landing" | ✅ |

---

## ✅ Phase 3: JSON-LD 검증 (10분)

### 3-1. JSON-LD 추출 및 검증

**방법**: Google Rich Results Test

```
1. https://search.google.com/test/rich-results 접속
2. URL 입력 필드에 복사:
   http://localhost:3000/landing
3. "URL 검사" 또는 "코드 붙여넣기" 선택
4. 결과 확인:
```

**✅ 체크**:
- [ ] `Errors: 0` 표시
- [ ] `Warnings: 0-2개` (경고는 무시 가능)
- [ ] `Rich results detected: Organization` 또는 `WebSite` 표시

### 3-2. JSON-LD 구조 검증

**페이지 소스에서 직접 확인**:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "마비즈 크루즈닷파트너스",
  "url": "https://mabizcruisedot.com",
  "description": "...",
  "image": {
    "@type": "ImageObject",
    "url": "https://mabizcruisedot.com/og-image.png",
    "width": 1200,
    "height": 630
  }
}
</script>
```

**✅ 체크**:
- [ ] `@context`: "https://schema.org" 있음
- [ ] `@type`: "WebSite" 또는 "Organization" 있음
- [ ] `name`: 사이트명 있음
- [ ] `url`: 완전한 URL (http/https 포함)
- [ ] `description`: 페이지 설명 있음
- [ ] `image.url`: 완전한 이미지 URL (http/https 포함)

### 3-3. Schema.org 상세 검증

```
1. https://validator.schema.org/ 접속
2. 페이지 HTML 전체 복사
3. Validator에 붙여넣기
4. "Validate" 클릭
5. 결과 확인:
```

**✅ 체크**:
- [ ] `Errors: 0`
- [ ] `Required properties`: 모두 초록색 ✅
- [ ] `Optional properties`: 권장사항만 (무시 가능)

---

## ✅ Phase 4: Core Web Vitals (모니터링 - 1주일)

### 4-1. 로컬에서 빠른 측정

**방법: Chrome DevTools Lighthouse**

```
1. http://localhost:3000/landing 접속
2. Chrome DevTools 열기 (F12)
3. "Lighthouse" 탭 선택
4. "분석 페이지 로드" 클릭
5. 결과 기록:
```

| 측정항목 | 현재 값 | 목표 | 상태 |
|---------|--------|------|------|
| **LCP** | ___ ms | < 2500ms | ✅/❌ |
| **CLS** | ___ | < 0.1 | ✅/❌ |
| **INP** | ___ ms | < 100ms | ✅/❌ |
| **Performance Score** | ___/100 | 90+ | ✅/❌ |

### 4-2. 프로덕션 측정 (배포 후 1주일 기다린 후)

**Google PageSpeed Insights**

```
1. https://pagespeed.web.dev/ 접속
2. URL 입력: https://mabizcruisedot.com/landing
3. "분석" 클릭 (2-3분 대기)
4. 결과 확인:
```

**✅ 체크**:
- [ ] **모바일 성능**: 90점 이상 (A 등급)
- [ ] **데스크톱 성능**: 95점 이상 (A 등급)
- [ ] **LCP**: < 2.5s
- [ ] **CLS**: < 0.1
- [ ] **INP**: < 100ms

**결과 스크린샷 저장**:
```powershell
# 결과 저장 경로
docs/seo-validation-results/pagespeed-insights-2026-06-09.png
```

---

## ✅ Phase 5: robots.txt & sitemap.xml 검증 (5분)

### 5-1. robots.txt 확인

```
1. http://localhost:3000/robots.txt 접속
2. 내용 확인:
```

**✅ 체크 항목**:
- [ ] `User-agent: *` 있음
- [ ] `Allow: /p/` 또는 `Allow: /` 있음
- [ ] `Disallow: /(dashboard)/` 있음
- [ ] `Sitemap: https://mabizcruisedot.com/sitemap.xml` 있음

### 5-2. sitemap.xml 확인

```
1. http://localhost:3000/sitemap.xml 접속
2. XML 확인:
```

**✅ 체크 항목**:
- [ ] `<url>` 태그 10개 이상 있음
- [ ] 각 URL에 `<loc>` 있음 (예: `<loc>https://mabizcruisedot.com/</loc>`)
- [ ] `<lastModified>` 있음
- [ ] `<changeFrequency>` 있음 (weekly/monthly)
- [ ] `<priority>` 있음 (0.5-1.0)

---

## ✅ Phase 6: Google Search Console 인덱싱 (1주일 모니터링)

### 6-1. 초기 제출 (배포 후 즉시)

```
1. https://search.google.com/search-console 접속
2. "속성 추가" 또는 기존 속성 선택
3. "URL 검사" 입력: https://mabizcruisedot.com/landing
4. "색인 요청" 클릭
5. 결과 기록:
   ✅ 즉시 색인됨 또는
   ⏳ 색인 대기 중
```

### 6-2. Sitemap 제출

```
1. Search Console 좌측 "Sitemaps" 메뉴
2. "새 사이트맵 추가" 클릭
3. URL 입력: sitemap.xml
4. "제출" 클릭
5. 상태 확인:
   - 상태: 성공 ✅
   - URL 수: 15+ ✅
   - 발견된 URL: 15+/15+ ✅
```

### 6-3. 1주일 후 인덱싱 상태 확인

**일주일 후** (2026-06-16):
```
1. Search Console 접속
2. 좌측 "색인 생성" → "색인 상태" 확인
3. 기록:
```

| 항목 | 목표 | 현재 | 상태 |
|------|------|------|------|
| **색인됨** | > 90% | ___% | ✅/❌ |
| **색인 안됨** | < 10% | ___% | ✅/❌ |
| **검사 오류** | = 0 | ___ | ✅/❌ |

---

## ✅ Phase 7: 소셜 미리보기 검증 (5분)

### 7-1. Facebook 미리보기

```
1. https://developers.facebook.com/tools/debug 접속
2. URL 입력: https://mabizcruisedot.com/landing
3. "디버그" 클릭
4. 확인:
   ✅ 제목 (og:title) 표시됨
   ✅ 설명 (og:description) 표시됨
   ✅ 이미지 (og:image) 표시됨
   ✅ URL 정확함
```

**✅ 체크**:
- [ ] 미리보기 이미지 정상 표시 (1200x630)
- [ ] 텍스트 자르임 없음
- [ ] 에러 메시지 없음

### 7-2. Twitter 미리보기

```
1. https://cards-dev.twitter.com/validator 접속
2. URL 입력: https://mabizcruisedot.com/landing
3. "검사" 또는 "Preview" 클릭
4. 확인:
   ✅ Card Type: Summary Large Image
   ✅ 제목 표시됨
   ✅ 설명 표시됨
   ✅ 이미지 표시됨
```

### 7-3. 링크드인 미리보기

```
1. https://www.linkedin.com/feed/ 접속
2. 게시물 작성 → URL 입력
3. 미리보기 확인:
   ✅ 제목 표시됨
   ✅ 설명 표시됨
   ✅ 이미지 표시됨
```

---

## 📋 최종 검증 보고서

### 보고서 작성

```markdown
# P2-3 SEO 검증 보고서

**검증 날짜**: 2026-06-09  
**검증자**: [이름]  
**결과**: ✅ PASS / ❌ FAIL

## 1. 메타 태그 크기
- HTML 크기: 3.0KB (증가: +500B)
- Head 크기: 1.2KB
- 상태: ✅ PASS (< 512B 증가 조건 충족)

## 2. JSON-LD 검증
- 페이지당 JSON-LD 개수: 1-2개
- Google Rich Results Test: ✅ PASS (Errors: 0, Warnings: < 2)
- Schema.org Validator: ✅ PASS
- 상태: ✅ PASS

## 3. Core Web Vitals
- LCP: 2.2s (목표: < 2.5s) ✅
- CLS: 0.05 (목표: < 0.1) ✅
- INP: 80ms (목표: < 100ms) ✅
- 성능 점수: 94/100 (목표: 90+) ✅
- 상태: ✅ PASS

## 4. robots.txt & sitemap.xml
- robots.txt: ✅ PASS (Sitemap 참조 있음)
- sitemap.xml: ✅ PASS (URL 15+ 개)
- 상태: ✅ PASS

## 5. Google 인덱싱 (1주일 후)
- 색인됨: 92% (목표: > 90%) ✅
- 색인 안됨: 8% (목표: < 10%) ✅
- 검사 오류: 0 (목표: = 0) ✅
- 상태: ✅ PASS

## 최종 결과: ✅ PASS
```

---

## 🚨 문제 해결

### Q1. JSON-LD에 경고가 나타남 (Warnings: 2-3개)
**A**: 경고는 무시해도 됩니다. 필수 필드만 있으면 OK.

### Q2. Core Web Vitals 점수가 낮음 (< 90)
**A**: 메타 태그는 영향 없습니다. 확인할 사항:
- 폰트 로딩 시간 (LCP)
- 이미지 크기 최적화 (LCP)
- 서드파티 스크립트 (INP)
- 이미지 로딩으로 인한 레이아웃 이동 (CLS)

### Q3. sitemap.xml에 URL이 안 보임
**A**: 동적 페이지는 데이터베이스 쿼리 필요. 확인:
```
- CrmLandingPage 테이블에 isActive=true, isPublic=true 데이터 있는지
- ShortLink 테이블에 isActive=true 데이터 있는지
```

### Q4. robots.txt가 작동 안 함
**A**: 캐시 문제일 수 있음. 확인:
```
- Google Search Console → "URL 검사" → "색인 생성 시뮬레이션"
- "차단된 리소스 없음" 확인
```

---

## 📝 체크리스트 다운로드

```powershell
# 체크리스트 인쇄 버전 생성
Write-Output "# SEO 검증 체크리스트" > seo-checklist-print.md
# (문서 내용 추가)
```

---

**문서 버전**: 1.0  
**마지막 업데이트**: 2026-06-09  
**소요시간**: 45분 (로컬 검증) + 1주일 (Google 인덱싱 모니터링)
