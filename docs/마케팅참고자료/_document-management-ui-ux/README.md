# 서류관리 UI/UX 시스템 (Document Management System)

## 📋 개요
Admin Panel과 Partner Dashboard의 **서류관리** 기능을 한곳에 모은 완전한 UI/UX 코딩 구현물입니다.

### 🎯 주요 기능
- **타사 비교 견적서**: 고객에게 경쟁사 가격과 비교한 견적서 제공
- **구매확인서**: 고객이 구매한 상품의 확인서 발급
- **환불완료증서**: 환불 처리 후 증서 생성
- **승인 관리**: 문서 생성 요청 및 승인 상태 관리

---

## 📁 폴더 구조

```
_document-management-ui-ux/
├── admin/
│   ├── pages/
│   │   └── affiliate-documents.page.tsx     # Admin Panel 서류관리 페이지
│   └── api/
│       ├── documents-generate.route.ts      # 문서 생성 API
│       ├── documents-product-info.route.ts  # 상품 정보 조회 API
│       └── documents-sync.route.ts          # 구글 드라이브 동기화 API
│
├── partner/
│   ├── pages/
│   │   └── partner-documents.page.tsx       # Partner Dashboard 서류관리 페이지
│   └── api/
│       └── (partner-specific APIs)
│
├── components/
│   ├── ComparisonQuoteImage.tsx             # 비교견적서 렌더링
│   ├── AffiliateCertificate.tsx             # 구매/환불 인증서
│   ├── CertificateApprovals.tsx             # 승인 관리 컴포넌트
│   └── ...
│
├── lib/
│   ├── document-generator.ts                # 문서 생성 로직
│   ├── purchase-confirmation.ts             # 구매확인서 발송 로직
│   └── document-drive-sync.ts               # 드라이브 동기화 로직
│
└── README.md                                 # 이 파일
```

---

## 🔧 주요 컴포넌트 설명

### Admin Panel Pages
**경로**: `app/admin/affiliate/documents/page.tsx`

#### 주요 기능
- 판매 목록 조회 (필터링, 검색)
- 문서 타입별 탭 네비게이션
  - 비교견적서
  - 구매확인증서
  - 환불인증서
  - 승인 관리

#### 상태 관리 (useState)
```typescript
- activeTab: TabType               // 현재 활성 탭
- sales: AffiliateSale[]           // 판매 목록
- filters: { search, status }      // 필터링 조건
- selectedSale: AffiliateSale      // 선택된 판매
- selectedDocumentType: DocumentType // 선택된 문서 타입
- isModalOpen: boolean             // 모달 표시 여부
- comparisonQuoteData: Object      // 비교견적서 폼 데이터
```

#### 주요 핸들러 함수
```typescript
- loadSales()                   // 판매 목록 로드
- handleOpenModal()             // 모달 오픈
- handleGenerateDocument()      // 문서 생성
- handleDownloadImage()         // 이미지 다운로드 (비교견적서)
- searchCustomers()             // 고객 검색
```

### Partner Dashboard Pages
**경로**: `app/partner/[partnerId]/documents/page.tsx`

#### 주요 차이점
- 대리점장(Branch Manager)과 판매원(Sales Agent)의 권한 분리
- 대리점장: 모든 문서 관리 가능
- 판매원: 제한된 기능만 사용 가능

---

## 🔌 API 라우트

### 1. 문서 생성 API
**경로**: `POST /api/admin/affiliate/documents/generate`

#### Request Body
```json
{
  "documentType": "COMPARISON_QUOTE" | "PURCHASE_CONFIRMATION" | "REFUND_CERTIFICATE",
  "saleId": number,
  "leadId": number,
  "customerName": string,
  "productCode": string,
  "ourPrice": number,
  "competitorPrices": [{ companyName, price, notes }]
}
```

#### Response
```json
{
  "ok": true,
  "documentType": "COMPARISON_QUOTE",
  "templates": {...},
  "message": "타사 비교 견적서가 생성되었습니다"
}
```

### 2. 상품 정보 조회 API
**경로**: `GET /api/admin/affiliate/documents/product-info?productCode=XXX`

#### Response
```json
{
  "ok": true,
  "product": {
    "productCode": "MSC001",
    "productName": "MSC Seaside - 14일 크루즈",
    "basePrice": 2500000,
    "nights": 13,
    "days": 14
  }
}
```

### 3. 문서 동기화 API
**경路**: `POST /api/admin/affiliate/documents/sync`

#### Request Body
```json
{
  "profileId": number  // 선택적 (없으면 모든 프로필 동기화)
}
```

#### 기능
- 생성된 문서를 구글 드라이브에 자동 저장
- 프로필별 또는 전체 동기화 지원

---

## 🎨 UI/UX 특징

### 디자인 시스템
- **색상**: Tailwind CSS (Indigo, Blue, Slate, Emerald, Red)
- **레이아웃**: 그리드 기반 반응형 디자인
- **아이콘**: react-icons (Feather Icons)

### 인터랙션
- 탭 네비게이션 (활성 탭 하이라이트)
- 모달 다이얼로그 (오버레이 배경)
- 토스트 알림 (성공/에러)
- 로딩 상태 표시 (스피너)
- 고객 자동완성 검색

### 반응형 디자인
```css
- Desktop: 최대 7xl (80rem) 너비
- Mobile: 전체 화면 패딩
- 탭: 오버플로우 시 가로 스크롤
```

---

## 🔐 보안 기능

### 권한 검증
- **관리자**: 모든 문서 생성 가능
- **대리점장**: 자신의 팀 판매만 문서 생성
- **판매원**: 자신의 판매만 문서 생성

### 입력 검증
- Zod 스키마 기반 검증
- 필수 필드 확인
- 상품 코드 대문자 변환

### 에러 처리
- 에러 메시지 마스킹 (시스템 정보 노출 금지)
- 구조화된 로깅
- 트랜잭션 기반 원자성 보장

---

## 📊 데이터 흐름

### 비교견적서 생성 플로우
```
1. 판매 목록 로드 → loadSales()
2. 판매 선택 → handleOpenModal()
3. 고객 정보 입력 (자동완성 검색)
4. 상품 정보 자동 로드 → loadProductInfo()
5. 타사 가격 입력
6. 미리보기 렌더링 → ComparisonQuoteImage
7. 이미지 다운로드 → html2canvas()
```

### 구매확인서 생성 플로우
```
1. 판매 선택
2. API 호출 → /api/admin/affiliate/documents/generate
3. 고객 이메일로 자동 발송 → sendPurchaseConfirmation()
4. 상호작용 로그 기록 → affiliateInteraction 테이블
```

---

## 🚀 설치 및 사용

### 1. 파일 복사
프로젝트의 다음 경로에 파일을 배치하세요:

```bash
# Admin pages
app/admin/affiliate/documents/page.tsx

# Partner pages
app/partner/[partnerId]/documents/page.tsx

# Admin API
app/api/admin/affiliate/documents/generate/route.ts
app/api/admin/affiliate/documents/product-info/route.ts
app/api/admin/affiliate/documents/sync/route.ts

# Components
app/components/admin/ComparisonQuoteImage.tsx
app/components/admin/documents/CertificateApprovals.tsx
app/components/affiliate/documents/AffiliateCertificate.tsx
app/components/partner/documents/ComparativeQuote.tsx
app/components/partner/documents/Certificate.tsx
app/components/partner/documents/CertificateApprovals.tsx
```

### 2. 의존성 확인
```bash
npm install react-icons html2canvas
```

### 3. 환경 변수
```env
# .env.local
DATABASE_URL=...
GOOGLE_DRIVE_API_KEY=...
```

---

## 📝 주요 특징

### 확장 가능한 구조
- 문서 타입 추가 시 `DocumentType` enum 확장
- 새 상태 추가 시 `getStatusColor()`, `getStatusLabel()` 함수 수정

### 성능 최적화
- useCallback으로 메모이제이션
- 검색 디바운싱 (200ms)
- 판매 목록 캐싱

### 접근성
- ARIA 라벨 제공
- 키보드 네비게이션 지원
- 색상 대비 WCAG 준수

---

## 🐛 에러 처리

| 상황 | 처리 방식 |
|------|---------|
| 로그인 필요 | 401 상태 코드 + 토스트 알림 |
| 권한 없음 | 403 상태 코드 + 에러 메시지 |
| 필수 정보 누락 | 400 상태 코드 + 유효성 검사 |
| 서버 오류 | 500 상태 코드 + 구조화된 로깅 |

---

## 🔄 유지보수

### 로깅
- `console.error()`: 디버깅용 에러 로깅
- `logger.log()`: 구조화된 비즈니스 로깅
- `affiliateInteraction`: 감사 추적용 레코드

### 모니터링
- 문서 생성 실패율
- API 응답 시간
- 고객 검색 정확도

---

## 📞 관련 파일

| 파일명 | 설명 |
|-------|------|
| `lib/affiliate/document-generator.ts` | 타사 비교 견적서, 환불증서 생성 |
| `lib/affiliate/purchase-confirmation.ts` | 구매확인서 발송 |
| `lib/affiliate/document-drive-sync.ts` | 구글 드라이브 동기화 |
| `lib/auth.ts` | 세션 사용자 인증 |
| `lib/prisma.ts` | 데이터베이스 접근 |

---

## ✅ 체크리스트

배포 전 확인사항:
- [ ] TypeScript 타입 검사 (0 에러)
- [ ] 모든 API 테스트 완료
- [ ] 권한 검증 확인
- [ ] 모바일 반응형 테스트
- [ ] 에러 메시지 마스킹 확인
- [ ] 환경 변수 설정

---

## 📄 라이센스

내부용 (cruiseai 프로젝트)

---

**마지막 업데이트**: 2026-06-04
