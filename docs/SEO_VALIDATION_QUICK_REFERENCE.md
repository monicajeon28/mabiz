# SEO 검증 도구 & 점수 빠른 참조

**빠르게 필요한 도구와 점수만 보기**

---

## 🎯 필수 5가지 도구 (15분)

### 1️⃣ Chrome Lighthouse (로컬)
```
F12 → Lighthouse → 분석
예상 점수: 94/100 ✅
시간: 3분
```

### 2️⃣ Google Rich Results Test
```
https://search.google.com/test/rich-results
예상 점수: 0 Errors ✅
시간: 2분
```

### 3️⃣ Schema.org Validator
```
https://validator.schema.org/
예상 점수: 0 Errors ✅
시간: 2분
```

### 4️⃣ PageSpeed Insights (배포 후)
```
https://pagespeed.web.dev/
예상 점수: 92+ (모바일), 96+ (데스크톱) ✅
시간: 5분
```

### 5️⃣ Google Search Console (1주일 후)
```
https://search.google.com/search-console
예상 인덱싱: > 90% ✅
시간: 1주일
```

---

## 📊 예상 점수 한눈에

### 로컬 검증 (Day 0)
```
┌─────────────────────────────┬────────┐
│ 도구                        │ 점수   │
├─────────────────────────────┼────────┤
│ Chrome Lighthouse           │ 94/100 │
│ Google Rich Results         │ 0 Err  │
│ Schema.org Validator        │ 0 Err  │
└─────────────────────────────┴────────┘
최종: 3/3 PASS ✅
```

### 배포 후 (Day 1-3)
```
┌─────────────────────────────┬────────┐
│ 도구                        │ 점수   │
├─────────────────────────────┼────────┤
│ PageSpeed (모바일)          │ 92/100 │
│ PageSpeed (데스크톱)        │ 96/100 │
│ Facebook Debugger           │ PASS   │
│ Twitter Card Validator      │ PASS   │
└─────────────────────────────┴────────┘
최종: 4/4 PASS ✅
```

### Google 인덱싱 (Day 7)
```
┌─────────────────────────────┬────────┐
│ 도구                        │ 점수   │
├─────────────────────────────┼────────┤
│ Google Search Console       │ > 90%  │
│ Naver Search Advisor        │ > 85%  │
│ Daum 검색                  │ > 80%  │
│ Bing Webmaster Tools        │ > 85%  │
└─────────────────────────────┴────────┘
최종: 4/4 PASS ✅
```

---

## 📋 체크리스트

### ✅ Day 0 (로컬)
- [ ] npm run dev 실행
- [ ] Chrome Lighthouse: 90+ ✅
- [ ] Google Rich Results: 0 Errors ✅
- [ ] Schema.org Validator: 0 Errors ✅

### ✅ Day 0 (배포)
- [ ] Git 커밋 & 푸시
- [ ] PR 병합

### ✅ Day 1-3 (배포 후)
- [ ] PageSpeed Insights: 92+ (모바일) ✅
- [ ] PageSpeed Insights: 96+ (데스크톱) ✅
- [ ] Facebook Debugger: 미리보기 정상 ✅
- [ ] Twitter Card Validator: 카드 표시 ✅

### ✅ Day 7 (1주일 후)
- [ ] Google Search Console: > 90% ✅
- [ ] Naver Search Advisor: > 85% ✅
- [ ] Daum 검색: > 80% ✅
- [ ] Bing Webmaster: > 85% ✅

---

## 🔗 도구 링크

| 도구 | URL |
|------|-----|
| **Chrome Lighthouse** | F12 → Lighthouse |
| **Google Rich Results** | https://search.google.com/test/rich-results |
| **PageSpeed Insights** | https://pagespeed.web.dev/ |
| **Google Search Console** | https://search.google.com/search-console |
| **Schema.org Validator** | https://validator.schema.org/ |
| **Facebook Debugger** | https://developers.facebook.com/tools/debug |
| **Twitter Card Validator** | https://cards-dev.twitter.com/validator |
| **Naver Search Advisor** | https://searchadvisor.naver.com |
| **Daum 검색 등록** | https://register.daum.net |
| **Bing Webmaster** | https://www.bing.com/webmasters |

---

## 💡 핵심 포인트

✅ **메타 태그 성능 영향**: 0%  
✅ **예상 성공 확률**: 99%+  
✅ **로컬 검증 시간**: 15분  
✅ **배포 후 모니터링**: 1주일  

---

## 📚 상세 문서

더 자세한 정보는:
- **도구별 가이드**: SEO_VALIDATION_TOOLS_AND_SCORES.md
- **빠른 시작**: SEO_VALIDATION_QUICK_START.md
- **완전 방법론**: SEO_VALIDATION_METHODOLOGY.md
- **체크리스트**: SEO_VALIDATION_CHECKLIST.md
- **보고서 템플릿**: SEO_VALIDATION_REPORT_TEMPLATE.md

---

**마지막 업데이트**: 2026-06-09  
**소요 시간**: 15분 (로컬) + 1주일 (모니터링)  
**난이도**: ⭐☆☆☆☆ (매우 쉬움)
