# 📁 전체 파일 인벤토리 (87개)

**범위**: 현재 랜딩페이지 시스템 완전 분석  
**파일 수**: 87개 (코드 41,620줄)  
**용도**: 복제 시 어느 파일을 참고해야 할지 알기 위함

---

## 📊 요약 (30초)

```
총 87개 파일
├─ 페이지 라우트: 3개 (공개 + 어드민 + 파트너)
├─ 컴포넌트: 11개 (랜딩)
├─ API 엔드포인트: 33개
├─ 라이브러리: 7개
├─ 정적 리소스: 6.4MB (이미지)
└─ 설정: 기타

구성별 줄 수:
• 페이지 라우트: 21,528줄
• API: 6,947줄
• 컴포넌트: 2,164줄
• 라이브러리: 1,115줄
```

---

## 🌐 Tier 1: 페이지 라우트 (3개, 21,528줄)

### **공개 (900줄)**
```
app/landing/
├─ [slug]/
│  ├─ page.tsx (699줄) ⭐ 핵심
│  │  • SSR 메인 페이지
│  │  • DB 조회 + 메타데이터
│  │  • 정규화된 HTML 렌더링
│  │
│  └─ payment/
│     └─ complete/page.tsx (150줄)
│        • 결제 완료 페이지
│        • 주문번호 표시
```

### **어드민 (9,985줄)**
```
app/admin/landing-pages/ ⭐ 전체 관리
├─ page.tsx (1,732줄)
│  • 랜딩페이지 목록
│  • 필터 + 검색
│  • 대량 삭제
│
├─ new/page.tsx (4,013줄)
│  • 새 페이지 생성
│  • 리치 텍스트 에디터
│  • 필드 설정 UI
│
└─ [id]/
   └─ edit/page.tsx (4,240줄)
      • 페이지 편집
      • 버전 관리
      • 통계 표시
```

### **파트너 (11,543줄)**
```
app/partner/[partnerId]/landing-pages/ ⭐ 파트너용
├─ page.tsx (1,434줄)
│  • 파트너 랜딩 목록
│  • 공유된 페이지
│  • 클론 기능
│
├─ new/page.tsx (3,962줄)
│  • 새 페이지 생성
│  • 템플릿 선택
│
├─ [id]/
│  ├─ edit/page.tsx (4,120줄)
│  │  • 파트너 페이지 편집
│  │
│  ├─ components/ (460줄)
│  │  ├─ LandingPageTable.tsx
│  │  ├─ LandingPageModals.tsx
│  │  ├─ SharedPagesSection.tsx
│  │  ├─ EmptyState.tsx
│  │  └─ LoadingSpinner.tsx
│  │
│  └─ hooks/ (120줄)
│     ├─ useLandingPageState.ts
│     └─ useModalState.ts
│
└─ lib/
   ├─ api/landing-pages.ts
   └─ types.ts
```

---

## 🧩 Tier 2: 공유 컴포넌트 (11개, 2,164줄)

### **전역 (components/landing/, 1,672줄)**
```
✅ LandingClientWrapper.tsx (210줄)
   • 클라이언트 상태 관리
   • 결제/신청 모드 전환
   
✅ LandingPageContent.tsx (29줄)
   • 콘텐츠 렌더링
   
✅ LandingRegistrationForm.tsx (302줄)
   • 신청 폼 UI
   • React Hook Form 통합
   
✅ LandingCommentForm.tsx (148줄)
   • 댓글 입력
   
✅ LandingCommentList.tsx (537줄)
   • 댓글 목록
   • 페이지네이션
   
✅ LandingCommentsSection.tsx (84줄)
   • 댓글 컨테이너
   
✅ LandingPaymentButton.tsx (194줄)
   • 결제 버튼
   • PayApp 통합
   
✅ LandingPushNotificationPrompt.tsx (168줄)
   • 푸시 알림 권한 요청
```

### **앱 특화 (app/components/landing/, 492줄)**
```
✅ LandingClientWrapper.tsx (355줄)
   • 앱 전용 클라이언트 래퍼
   • 제휴 링크 처리
   
✅ ProductSection.tsx (82줄)
   • 상품 섹션
   
✅ AffiliateErrorDisplay.tsx (55줄)
   • 제휴 에러 표시
```

---

## 🔌 Tier 3: API 엔드포인트 (33개, 6,947줄)

### **어드민 (app/api/admin/landing-pages/)**
```
✅ route.ts (187줄)
   GET  - 랜딩페이지 목록
   POST - 새 페이지 생성

✅ [id]/route.ts (156줄)
   GET    - 단일 페이지 조회
   PUT    - 페이지 수정
   DELETE - 페이지 삭제

✅ [id]/edit/route.ts (89줄)
   POST - 편집 상태 저장

✅ [id]/stats/route.ts (76줄)
   GET - 통계 조회

✅ [id]/share/route.ts (92줄)
   POST - 페이지 공유

✅ [id]/shortcut/route.ts (78줄)
   POST - 단축 URL 생성

✅ [id]/comments/route.ts (145줄)
   GET  - 댓글 조회
   POST - 댓글 생성

✅ [id]/comments/generate/route.ts (203줄)
   POST - AI 댓글 자동 생성

✅ [id]/comments/[commentId]/route.ts (98줄)
   PATCH  - 댓글 수정
   DELETE - 댓글 삭제

✅ [id]/id_tmp/** (567줄)
   * 임시 ID 관리용 라우트 (10개)

✅ bulk-delete/route.ts (134줄)
   POST - 대량 삭제
```

### **파트너 (app/api/partner/landing-pages/)**
```
✅ route.ts (303줄)
   GET  - 파트너 페이지 목록
   POST - 새 페이지 생성

✅ [id]/route.ts (178줄)
   GET    - 단일 페이지 조회
   PUT    - 페이지 수정
   DELETE - 페이지 삭제

✅ [id]/stats/route.ts (89줄)
   GET - 통계 조회

✅ [id]/share/route.ts (124줄)
   POST - 페이지 공유

✅ [id]/clone/route.ts (156줄)
   POST - 페이지 복제

✅ [id]/comments/** (312줄)
   • 댓글 관리 (CRUD)

✅ [id]/registrations/route.ts (167줄)
   GET - 등록자 목록
```

### **공개 (app/api/public/landing-pages/)**
```
✅ [slug]/
   ├─ register/route.ts (370줄) ⭐ 핵심
   │  POST - 랜딩페이지 신청
   │  • Serializable Transaction
   │  • 중복 방지
   │  • User 자동 생성
   │
   ├─ payment/route.ts (201줄)
   │  POST - 결제 요청
   │  • PayApp API 호출
   │  • 주문 생성
   │
   └─ comments/route.ts (178줄)
      GET  - 댓글 조회
      POST - 댓글 작성

✅ affiliate-info/route.ts (145줄)
   GET - 제휴 정보 조회
```

### **결제 (app/api/payapp/landing/)**
```
✅ request/route.ts (156줄)
   POST - 결제 요청 생성

✅ webhook/route.ts (189줄)
   POST - 결제 완료 콜백
```

---

## 📚 Tier 4: 라이브러리 (7개, 1,115줄)

### **HTML 처리**
```
✅ lib/landing-html.ts (173줄)
   • normalizeLandingHtmlContent()
   • extractBodyContent()
   • normalizeLandingImageUrl()
   • XSS 방지
```

### **템플릿**
```
✅ lib/constants/b2b-landing-template.ts (826줄)
   • B2B 랜딩 템플릿
   • 기본 HTML 구조
   • Tailwind CSS
```

### **검증 스키마**
```
✅ lib/schemas/landingPageRegisterSchema.ts (24줄)
   • Zod 검증 규칙
   • 이름, 연락처, 이메일, 제휴코드
```

### **에러 정의**
```
✅ lib/errors/landingPageErrors.ts (92줄)
   • LandingPageError
   • NotFoundError
   • ConflictError
   • ValidationError
```

---

## 📂 Tier 5: 정적 리소스 (6.4MB)

```
📁 public/크루즈정보사진/
├─ landing_exposure/ (5.6MB)
│  • KakaoTalk_20250630_113143093_09_jpg.jpg/webp
│  • KakaoTalk_20251115_225802458_jpg.jpg/webp
│  ← 랜딩페이지 홍보 이미지
│
└─ landing_attachments/ (760KB)
   • 계약서_전혜선_2025_11_19_pdf.pdf
   ← 첨부 문서
```

---

## 🔗 Tier 6: 추가 관련 파일

### **B2B 랜딩**
```
✅ app/b2b/[partnerId]/
   └─ B2BLandingClient.tsx
      • B2B 파트너 랜딩페이지

✅ app/l/[slug]/
   └─ LittlyLandingPage.tsx
      • 단축 URL 랜딩페이지

✅ app/store/[affiliateCode]/[landingSlug]/
   └─ page.tsx
      • 스토어 랜딩페이지

✅ app/admin/mall/visual-editor/
   └─ LandingPageMenuBarEditor.tsx
      • 메뉴바 편집 도구
```

---

## 📊 복제 시 필수/선택 파일

### **필수 (꼭 복사) ⭐⭐⭐**
```
✅ app/landing/[slug]/page.tsx
✅ components/landing/LandingClientWrapper.tsx
✅ components/landing/LandingRegistrationForm.tsx
✅ lib/landing-html.ts
✅ lib/schemas/landingPageRegisterSchema.ts
✅ app/api/public/landing-pages/[slug]/register/route.ts
```

### **권장 (대부분 복사) ⭐⭐**
```
✅ components/landing/LandingCommentForm.tsx
✅ components/landing/LandingCommentList.tsx
✅ components/landing/LandingPaymentButton.tsx
✅ app/api/public/landing-pages/[slug]/comments/route.ts
✅ app/api/payapp/landing/request/route.ts
```

### **선택 (필요시 복사) ⭐**
```
⭐ components/landing/LandingPushNotificationPrompt.tsx
⭐ lib/constants/b2b-landing-template.ts
⭐ app/b2b/[partnerId]/B2BLandingClient.tsx
```

### **제외 (복사 안 함) ❌**
```
❌ app/admin/landing-pages/* (어드민 패널)
❌ app/partner/landing-pages/* (파트너 패널)
❌ app/api/admin/landing-pages/* (어드민 API)
❌ ProductList 관련 파일들
```

---

## 🎯 복제 우선순위

### **Phase 1: 핵심 기능 (필수)**
```
1. page.tsx (페이지 구조)
2. LandingClientWrapper.tsx (상태 관리)
3. LandingRegistrationForm.tsx (폼)
4. register/route.ts (백엔드)
5. landing-html.ts (정규화)
```

### **Phase 2: 부가 기능 (권장)**
```
6. 댓글 시스템 (components + API)
7. 결제 기능 (PaymentButton + API)
8. 검증 스키마 (landingPageRegisterSchema)
```

### **Phase 3: 고급 기능 (선택)**
```
9. 푸시 알림 (PushNotificationPrompt)
10. 템플릿 (b2b-landing-template)
11. 단축 URL (Littly integration)
```

---

## 📈 파일 통계

| 카테고리 | 파일 수 | 줄 수 | 용도 |
|---------|--------|------|------|
| 페이지 라우트 | 3 | 21,528 | 사용자 인터페이스 |
| API 엔드포인트 | 33 | 6,947 | 데이터 처리 |
| 컴포넌트 | 11 | 2,164 | UI 구성 |
| 라이브러리 | 7 | 1,115 | 유틸/스키마 |
| **합계** | **87** | **41,620** | - |

---

**다음**: `../GUIDES/TECHNICAL_GUIDE.md`에서 복제 방법 확인
