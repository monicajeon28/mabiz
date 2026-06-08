# 📁 서류관리 UI/UX 시스템 - 파일 구조

## 전체 폴더 구조

```
_document-management-ui-ux/
│
├── 📄 README.md                           # 전체 시스템 문서
├── 📄 STRUCTURE.md                        # 이 파일 (구조 설명)
│
├── 📂 admin/
│   │
│   ├── 📂 pages/
│   │   └── 📄 affiliate-documents.page.tsx
│   │       ├─ 관리자 패널 서류관리 페이지
│   │       ├─ 4개 탭: 비교견적서 | 구매확인증서 | 환불인증서 | 승인관리
│   │       ├─ 판매 목록 필터링/검색
│   │       ├─ 문서 생성 모달 다이얼로그
│   │       └─ 비교견적서 이미지 미리보기 + 다운로드
│   │
│   └── 📂 api/
│       │
│       ├── 📄 documents-generate.route.ts
│       │   ├─ POST /api/admin/affiliate/documents/generate
│       │   ├─ 문서 타입별 생성 로직 (3가지)
│       │   ├─ 권한 검증 (관리자/판매원/대리점장)
│       │   ├─ 비교견적서: 템플릿 생성
│       │   ├─ 구매확인서: 고객 이메일 발송
│       │   ├─ 환불증서: 증서 생성
│       │   └─ 감사 로그 기록
│       │
│       ├── 📄 documents-product-info.route.ts
│       │   ├─ GET /api/admin/affiliate/documents/product-info
│       │   ├─ 상품 코드로 상품 정보 조회
│       │   ├─ 가격, 선박, 패키지명 등 반환
│       │   └─ 비교견적서 폼에 자동 채우기
│       │
│       └── 📄 documents-sync.route.ts
│           ├─ POST /api/admin/affiliate/documents/sync
│           ├─ 생성된 문서를 구글 드라이브에 저장
│           ├─ 프로필별 또는 전체 동기화
│           └─ 동기화 결과 통계
│
├── 📂 partner/
│   │
│   ├── 📂 pages/
│   │   └── 📄 partner-documents.page.tsx
│   │       ├─ 파트너 대시보드 서류관리 페이지
│   │       ├─ 권한 분리: 대리점장 vs 판매원
│   │       ├─ 프로필 로드 및 권한 확인
│   │       ├─ 4개 탭 구조 (Admin과 동일)
│   │       └─ ComparativeQuote, Certificate 컴포넌트 사용
│   │
│   └── 📂 api/
│       └── (Partner-specific API routes)
│           ├─ 판매 목록 조회
│           ├─ 고객 검색
│           └─ 문서 요청/승인
│
├── 📂 lib/
│   ├── 📄 document-generator.ts
│   │   ├─ generateComparisonQuote()
│   │   │   └─ 타사 비교 견적서 템플릿 생성
│   │   ├─ generateRefundCertificate()
│   │   │   └─ 환불완료증서 템플릿 생성
│   │   └─ 내용 포맷팅, 메타데이터 생성
│   │
│   ├── 📄 purchase-confirmation.ts
│   │   ├─ sendPurchaseConfirmation()
│   │   │   └─ 구매확인서를 고객 이메일로 발송
│   │   └─ 이메일 템플릿, 발송 로직
│   │
│   └── 📄 document-drive-sync.ts
│       ├─ syncAllDocumentsToDrive()
│       │   └─ 문서 생성 후 구글 드라이브에 저장
│       └─ 드라이브 폴더 구조, 권한 관리
│
├── 📂 components/
│   ├── 📄 ComparisonQuoteImage.tsx
│   │   ├─ Props: 고객명, 상품정보, 가격, 타사 가격 등
│   │   ├─ 리턴: JSX (HTML 형태로 렌더링)
│   │   ├─ html2canvas로 이미지로 변환 가능
│   │   └─ 디자인: 전문적인 견적서 레이아웃
│   │
│   ├── 📄 AffiliateCertificate.tsx
│   │   ├─ Props: type ('purchase' | 'refund')
│   │   ├─ 구매확인서/환불증서 검색 및 요청 UI
│   │   ├─ 다중 탭 및 필터링
│   │   └─ 상태 관리: 요청 폼, 로딩, 제출
│   │
│   ├── 📄 CertificateApprovals.tsx (Admin)
│   │   ├─ Props: 없음 (관리자 전용)
│   │   ├─ 문서 생성 요청 목록 표시
│   │   ├─ 승인/거절 액션
│   │   └─ 상태: 대기중, 승인됨, 거절됨
│   │
│   ├── 📄 ComparativeQuote.tsx (Partner)
│   │   ├─ Props: 없음
│   │   ├─ 판매원이 비교견적서 생성
│   │   └─ 고객 검색, 상품 정보 로드
│   │
│   ├── 📄 Certificate.tsx (Partner)
│   │   ├─ Props: type ('purchase' | 'refund')
│   │   ├─ 파트너가 인증서 요청
│   │   └─ 요청 상태 추적
│   │
│   └── 📄 CertificateApprovals.tsx (Partner)
│       ├─ Props: partnerRole ('BRANCH_MANAGER' | 'SALES_AGENT')
│       ├─ 자신의 요청 상태 조회
│       ├─ 팀 요청 조회 (대리점장만)
│       └─ 승인/거절 관리
│
└── 📄 INDEX.md (이 파일의 상위)
    └─ 파일 경로, 라인 수, 설명
```

---

## 🔗 파일 간 관계도

```
Admin Page
├─ affiliate-documents.page.tsx
│  ├─ API: documents-generate.route.ts
│  ├─ API: documents-product-info.route.ts
│  ├─ API: documents-sync.route.ts
│  ├─ Component: ComparisonQuoteImage
│  ├─ Component: AffiliateCertificate
│  └─ Component: CertificateApprovals (Admin)

Partner Page
├─ partner-documents.page.tsx
│  ├─ Component: ComparativeQuote
│  │  ├─ API: documents-generate.route.ts (공유)
│  │  └─ API: documents-product-info.route.ts (공유)
│  ├─ Component: Certificate
│  │  └─ API: documents-generate.route.ts (공유)
│  └─ Component: CertificateApprovals (Partner)

Libraries
├─ document-generator.ts
│  └─ API: documents-generate.route.ts (사용)
├─ purchase-confirmation.ts
│  └─ API: documents-generate.route.ts (호출)
└─ document-drive-sync.ts
   └─ API: documents-sync.route.ts (호출)

Database
├─ affiliateSale (판매 정보)
├─ affiliateLead (고객 정보)
├─ affiliateProfile (판매원/대리점장)
├─ cruiseProduct (상품 정보)
└─ affiliateInteraction (감사 로그)
```

---

## 📊 주요 데이터 타입

### DocumentType
```typescript
'COMPARISON_QUOTE'       // 타사 비교 견적서
'PURCHASE_CONFIRMATION' // 구매확인서
'REFUND_CERTIFICATE'   // 환불완료증서
```

### Status
```typescript
'PENDING'    // 대기중
'CONFIRMED' // 확정됨
'PAID'      // 지급완료
'REFUNDED'  // 환불됨
```

### TabType
```typescript
'comparison' // 비교견적서
'purchase'   // 구매확인증서
'refund'     // 환불인증서
'approvals'  // 승인 관리
```

---

## 🎯 사용 흐름

### 비교견적서 생성 (Admin)
```
1. affiliate-documents.page.tsx
   └─ "견적서" 버튼 클릭
   └─ handleOpenModal(sale, 'COMPARISON_QUOTE')

2. 모달 오픈
   ├─ 고객명 입력 + 자동완성
   ├─ 상품 코드 입력 + 자동로드
   ├─ 타사 가격 입력
   └─ ComparisonQuoteImage로 미리보기

3. "이미지 다운로드" 버튼
   ├─ html2canvas로 렌더링
   ├─ PNG로 변환
   └─ 다운로드 실행
```

### 구매확인서 발송 (Admin)
```
1. affiliate-documents.page.tsx
   └─ "구매확인" 버튼 클릭
   └─ handleOpenModal(sale, 'PURCHASE_CONFIRMATION')

2. 모달 오픈 (비교견적서보다 간단함)
   └─ 판매 정보 표시 (읽기전용)

3. "문서 생성" 버튼
   └─ documents-generate.route.ts 호출
   └─ sendPurchaseConfirmation() 실행
   └─ 고객 이메일로 자동 발송
```

### 환불증서 생성 (Admin)
```
1. affiliate-documents.page.tsx
   └─ "환불증서" 버튼 클릭
   └─ handleOpenModal(sale, 'REFUND_CERTIFICATE')

2. 모달 오픈
   └─ 판매 정보 표시 (읽기전용)

3. "문서 생성" 버튼
   └─ documents-generate.route.ts 호출
   └─ generateRefundCertificate() 실행
   └─ 증서 템플릿 생성
```

---

## 🔐 권한 흐름

```
Request
  ├─ getSessionUser() 확인
  ├─ affiliateProfile 조회
  │  └─ type: 'ADMIN' | 'MANAGER' | 'AGENT'
  │
  ├─ 타입별 권한 검증
  │  ├─ ADMIN: 모든 문서 생성 가능
  │  ├─ MANAGER: 자신의 팀 판매만
  │  └─ AGENT: 자신의 판매만
  │
  └─ 승인 또는 에러 반환
```

---

## 📈 성능 특성

| 작업 | 예상 시간 | 최적화 |
|------|---------|-------|
| 판매 목록 로드 | 200-500ms | 필터링, 페이지네이션 |
| 고객 검색 | 300ms | 디바운싱 (200ms) |
| 상품 정보 로드 | 100-200ms | 캐싱 |
| 비교견적서 렌더링 | 50-100ms | 메모이제이션 |
| 이미지 생성 (html2canvas) | 500ms-1s | 고해상도 (2x) |
| 문서 생성 API | 1-2s | 트랜잭션 |

---

## ✅ 구현 체크리스트

### Pages
- [x] Admin 서류관리 페이지
- [x] Partner 서류관리 페이지
- [x] 4개 탭 네비게이션
- [x] 판매 목록 표시
- [x] 필터링 + 검색

### APIs
- [x] 문서 생성 API
- [x] 상품 정보 조회 API
- [x] 드라이브 동기화 API

### Components
- [x] 비교견적서 이미지 렌더링
- [x] 인증서 요청/생성 UI
- [x] 승인 관리 UI

### Features
- [x] 고객 자동완성 검색
- [x] 상품 정보 자동 로드
- [x] 이미지 다운로드
- [x] 권한 검증
- [x] 에러 처리
- [x] 로딩 상태
- [x] 토스트 알림

---

**생성일**: 2026-06-04  
**프로젝트**: cruise-guide-app  
**버전**: 1.0.0
