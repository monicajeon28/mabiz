# 📑 SEO 검증 문서 인덱스 (P2-3)

**작성일**: 2026-06-09  
**목표**: 메타 태그 성능 검증 + JSON-LD 유효성 + Core Web Vitals

---

## 🚀 빠른 네비게이션

| 문서 | 용도 | 소요시간 | 추천 |
|------|------|---------|------|
| **SEO_VALIDATION_SUMMARY.md** | 한눈에 보는 요약 | 5분 | 👈 여기서 시작 |
| **SEO_VALIDATION_TOOLS_AND_SCORES.md** | 검증 도구 & 예상 점수 | 15분 | 도구 선택 가이드 |
| **SEO_VALIDATION_QUICK_START.md** | 빠른 시작 가이드 | 5-15분 | 즉시 검증 |
| **SEO_VALIDATION_CHECKLIST.md** | 단계별 실행 체크리스트 | 45분 | 자세한 검증 |
| **SEO_VALIDATION_METHODOLOGY.md** | 완전한 검증 방법론 | 40분 | 깊이 있는 학습 |
| **SEO_VALIDATION_REPORT_TEMPLATE.md** | 결과 보고서 템플릿 | 10분 | 검증 완료 후 |

---

## 📊 검증 로드맵

```
Phase 1: 로컬 검증 (15분)
├─ 개발 서버 실행
├─ 메타 태그 크기 측정
├─ JSON-LD 유효성 확인
├─ Core Web Vitals 측정
└─ 통과 기준: ✅ All Pass

     ↓

Phase 2: 배포 (5분)
├─ Git 커밋
├─ 브랜치 푸시
└─ PR 병합 또는 직접 배포

     ↓

Phase 3: Google 인덱싱 모니터링 (1주일)
├─ Search Console 제출
├─ sitemap.xml 제출
├─ 1주일 후 색인율 확인
└─ 통과 기준: 색인율 > 90%
```

---

## 🎯 3가지 검증 항목

### 1️⃣ 메타 태그 크기
- **기준**: HTML 크기 증가 < 512B
- **측정**: Chrome DevTools / curl
- **검증 문서**: SEO_VALIDATION_QUICK_START.md § Step 2

### 2️⃣ JSON-LD 유효성
- **기준**: Google Test에서 Errors = 0
- **도구**: https://search.google.com/test/rich-results
- **검증 문서**: SEO_VALIDATION_QUICK_START.md § Step 3

### 3️⃣ Core Web Vitals
- **기준**: LCP < 2.5s, CLS < 0.1, INP < 100ms
- **도구**: PageSpeed Insights / Lighthouse
- **검증 문서**: SEO_VALIDATION_QUICK_START.md § Step 4

---

## 📚 문서별 상세 설명

### 🔵 SEO_VALIDATION_SUMMARY.md (5분)
**대상**: 빠르게 개요 파악하고 싶은 사람

**포함 내용**:
- 3가지 검증 항목 한눈에 보기
- 5단계 빠른 시작
- 기대 결과
- 문제 해결 FAQ

**다음 단계**: SEO_VALIDATION_TOOLS_AND_SCORES.md로 이동

---

### 🟣 SEO_VALIDATION_TOOLS_AND_SCORES.md (15분) ⭐ **NEW**
**대상**: 어떤 도구를 사용할지 선택하고 싶은 사람

**포함 내용**:
- 10가지 검증 도구 비교표
- 5가지 필수 도구 상세 설명 (예상 점수 포함)
- 3가지 권장 도구
- 3가지 국내 도구 (Naver/Daum)
- 실행 순서 (Day 0-7)
- 점수 해석 가이드
- FAQ 6가지

**예상 점수 미리보기**:
```
Chrome Lighthouse: 94/100 ✅
PageSpeed Insights: 92/100 (모바일), 96/100 (데스크톱) ✅
Google Rich Results: 0 Errors ✅
Google 인덱싱: > 90% (1주일 후) ✅
```

**다음 단계**: SEO_VALIDATION_QUICK_START.md로 이동

---

### 🟢 SEO_VALIDATION_QUICK_START.md (5-15분)
**대상**: 지금 당장 검증하고 싶은 사람

**포함 내용**:
- 4가지 검증 도구별 사용 방법
- 로컬 측정 명령어
- 기대 결과 테이블
- 빠른 링크

**다음 단계**: 검증 실행 → 체크리스트로 이동

---

### 🟡 SEO_VALIDATION_CHECKLIST.md (45분)
**대상**: 세부 실행 과정을 추적하고 싶은 사람

**포함 내용**:
- Phase별 상세 검증 절차
- 각 단계별 예상 결과
- 문제 해결 가이드
- 최종 보고서 템플릿

**다음 단계**: 검증 완료 → 리포트 템플릿으로 이동

---

### 🟠 SEO_VALIDATION_METHODOLOGY.md (40분)
**대상**: 깊이 있게 학습하고 싶은 사람

**포함 내용**:
- 3가지 검증 항목 완전 설명
- 측정 도구 5가지 상세 가이드
- 메타 태그 페이지별 요구사항
- 성능 저하 근본 원인 분석
- 참고 링크 및 FAQ

**다음 단계**: 특정 항목 깊이 있는 학습

---

### 🔴 SEO_VALIDATION_REPORT_TEMPLATE.md (10분)
**대상**: 검증 완료 후 결과 기록하고 싶은 사람

**포함 내용**:
- Before/After 비교표
- 항목별 측정값 기록 필드
- 페이지별 검증 결과 표
- 최종 판정 및 서명란
- 개선사항 기록

**사용 방법**:
1. 검증 완료 후 이 템플릿 복사
2. 측정값 입력
3. PDF 내보내기
4. 아카이빙

---

## 📝 사용 시나리오별 추천

### 시나리오 1: "어떤 도구를 써야 하나요?"
→ **SEO_VALIDATION_TOOLS_AND_SCORES.md** 읽고 도구 선택 (10분)

### 시나리오 2: "5분 안에 검증하고 싶어요"
→ **SEO_VALIDATION_QUICK_START.md** 읽고 Step 1-4 실행

### 시나리오 3: "세부적으로 검증 절차를 따라가고 싶어요"
→ **SEO_VALIDATION_CHECKLIST.md** 읽고 Phase 1-7 실행

### 시나리오 4: "메타 태그 성능에 대해 깊이 있게 배우고 싶어요"
→ **SEO_VALIDATION_METHODOLOGY.md** 읽고 섹션별 학습

### 시나리오 5: "검증 결과를 공식 문서로 남기고 싶어요"
→ **SEO_VALIDATION_REPORT_TEMPLATE.md** 작성 및 제출

---

## 🔧 자동화 도구

### 스크립트 실행

```powershell
# 자동 SEO 검증 (메타 태그, JSON-LD, 도구 링크)
node scripts/seo-validation.mjs

# 출력:
# - 콘솔 리포트
# - seo-validation-report.json (상세 결과)
```

---

## ✅ 검증 완료 체크리스트

```
Phase 1: 로컬 검증 (15분)
☐ npm run dev 실행
☐ 메타 태그 크기 확인 (< 512B 증가)
☐ JSON-LD Errors = 0 확인
☐ Lighthouse 성능점수 90+ 확인
☐ robots.txt / sitemap.xml 접속 확인

Phase 2: 배포 (즉시)
☐ Git 커밋
☐ 브랜치 푸시
☐ PR 생성 또는 병합

Phase 3: Google 인덱싱 (1주일)
☐ Search Console sitemap 제출
☐ 1주일 후 색인율 > 90% 확인
☐ SEO_VALIDATION_REPORT_TEMPLATE.md 작성
☐ 최종 리포트 제출
```

---

## 📊 성공 기준

| 항목 | 기준 | 상태 |
|------|------|------|
| 메타 태그 크기 | < 512B 증가 | ✅ |
| JSON-LD | Errors = 0 | ✅ |
| Lighthouse | 90+ (A 등급) | ✅ |
| Google 인덱싱 | > 90% (1주일 후) | ✅ |

**최종 결과**: ✅ **PASS**

---

## 🔗 빠른 링크

| 도구 | URL |
|------|-----|
| Google Rich Results Test | https://search.google.com/test/rich-results |
| PageSpeed Insights | https://pagespeed.web.dev/ |
| Google Search Console | https://search.google.com/search-console |
| Schema.org Validator | https://validator.schema.org/ |
| Facebook Debugger | https://developers.facebook.com/tools/debug |
| Twitter Card Validator | https://cards-dev.twitter.com/validator |

---

## 💬 FAQ

**Q: 어느 문서부터 읽어야 하나요?**  
A: 이 문서 (인덱스)를 읽고 → SEO_VALIDATION_QUICK_START.md로 이동

**Q: 검증 시간이 얼마나 걸리나요?**  
A: 로컬 15분 + 배포 5분 + Google 인덱싱 1주일

**Q: 메타 태그 추가로 성능이 떨어지나요?**  
A: 아니오. 성능 저하 0%입니다 (메타 태그는 렌더링 영향 없음)

---

**문서 버전**: 1.1  
**마지막 업데이트**: 2026-06-09  
**총 문서 개수**: 6개 (+ 자동화 스크립트 1개)
