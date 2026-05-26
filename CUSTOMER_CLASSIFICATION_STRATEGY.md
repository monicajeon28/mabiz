# 고객 분류 아키텍처 (2026-05-27)

## 🎯 핵심 문제

현재 모든 고객이 Contact 테이블에 동일하게 저장되고 있어 출처별 구분이 불가능합니다. 
**"왜 모든 고객들이 다 구매고객 관리로 들어와 있는거야?"** - 사용자 피드백

필요한 분류:
- 📋 **문의고객**: CruiseProductInquiry 에서 온 고객 (상품코드 추적)
- 🛍️ **구매고객**: User 에서 온 고객 (가입 방법별 추적)
- 🤝 **어필리에이트**: AffiliateLead 에서 온 고객 (링크, 담당자, 에이전트 추적)
- 🎓 **교육**: 랜딩페이지에서 신청한 고객
- 👑 **골드회원**: GoldMember 에서 온 고객
- ❓ **골드문의**: 어필리에이트 링크를 통한 문의

---

## 🔧 해결 방안: Contact 스키마 확장

### 1단계: 새 필드 추가 (Prisma 마이그레이션)

```prisma
model Contact {
  // ... 기존 필드 ...
  
  // P0-6: 고객 출처 분류 (2026-05-27)
  sourceType           String?        @db.VarChar(30)  // "user", "inquiry", "affiliate", "landing_page", "education", "gold_member"
  sourceId             String?        @db.VarChar(50)  // 원본 시스템의 ID
  signupMethod         String?        @db.VarChar(20)  // User 출처만: "general", "kakao", "naver", "google"
  
  // Affiliate 전용 필드
  affiliateLinkId      String?        @db.VarChar(50)  // AffiliateLead.linkId
  affiliateManagerId   String?        @db.VarChar(50)  // AffiliateLead.managerId (본사)
  affiliateAgentId     String?        @db.VarChar(50)  // AffiliateLead.agentId (판매원)
  
  // Inquiry 전용 필드
  inquiryProductCode   String?        @db.VarChar(50)  // CruiseProductInquiry.productCode
  
  // 인덱스
  @@index([organizationId, sourceType], map: "idx_contact_org_source_type")
  @@index([organizationId, sourceId], map: "idx_contact_org_source_id")
  @@index([affiliateLinkId], map: "idx_contact_affiliate_link_id")
  @@index([affiliateManagerId], map: "idx_contact_affiliate_manager_id")
  @@index([affiliateAgentId], map: "idx_contact_affiliate_agent_id")
  @@index([signupMethod], map: "idx_contact_signup_method")
}
```

### 2단계: 데이터 동기화 로직

#### 2-1. User → Contact 매핑 (구매고객)
```
sourceType: "user"
sourceId: user.id (Supabase ID)
signupMethod: 파싱(user.externalId)
  - "%kakao%" → "kakao"
  - "%naver%" → "naver"
  - "%google%" → "google"
  - 기타 → "general"
name: user.name
phone: user.phone
email: user.email
```

#### 2-2. CruiseProductInquiry → Contact 매핑 (문의고객)
```
sourceType: "inquiry"
sourceId: inquiry.id
inquiryProductCode: inquiry.productCode
name: inquiry.name
phone: inquiry.phone
email: null (일반적으로 없음)
```

#### 2-3. AffiliateLead → Contact 매핑 (어필리에이트)
```
sourceType: "affiliate"
sourceId: affiliate.id
affiliateLinkId: affiliate.linkId
affiliateManagerId: affiliate.managerId
affiliateAgentId: affiliate.agentId
name: affiliate.customerName
phone: affiliate.customerPhone
```

---

## 👥 역할별 접근 제어 (RBAC)

### 관리자 (관리자 권한)
- ✅ 모든 고객 조회 (전체 Contact 테이블)
- 필터: 모든 sourceType 표시
- 대시보드: 전체 매출, 출처별 비교

### 본사 (본사 권한)
- ✅ 본사 어필리에이트 고객만 조회
- WHERE: `affiliateManagerId = current_user.managerId`
- 필터: 어필리에이트 출처만

### 대리점장 (지점장 권한)
- ✅ 자신의 팀원(판매원) 고객만 조회
- WHERE: `affiliateAgentId IN (selected_agents)`
- 필터: 어필리에이트 출처만

### 판매원 (영업 권한)
- ✅ 자신의 고객만 조회
- WHERE: `affiliateAgentId = current_user.agentId`
- 필터: 어필리에이트 출처만

---

## 📊 UI 뷰 구조

### 고객 관리 페이지 (`/고객 관리`)
- **전체 고객** (관리자 전용)
  - 필터: 문의 | 구매 | 어필리에이트 | 교육 | 골드회원
  - 출처 표시: 🔹 문의 | 🟢 구매 | 🟡 어필리에이트 | 🔵 교육 | 👑 골드

- **내 고객** (모든 역할)
  - 자동 필터: 역할에 따라 해당 고객만 표시

### 고객 상세 보기
```
고객 정보
├─ 이름: [name]
├─ 전화: [phone]
├─ 출처: [sourceType 로컬라이징]
│  ├─ 문의고객
│  │  ├─ 상품: [inquiryProductCode]
│  │  └─ 문의일: [createdAt]
│  ├─ 구매고객
│  │  ├─ 가입방법: [signupMethod 로컬라이징]
│  │  └─ 가입일: [createdAt]
│  └─ 어필리에이트
│     ├─ 링크: [affiliateLinkId]
│     ├─ 담당자(본사): [affiliateManagerId]
│     ├─ 담당자(판매원): [affiliateAgentId]
│     └─ 추천일: [createdAt]
└─ 상태: [type: LEAD/CUSTOMER/etc]
```

---

## 🔄 마이그레이션 계획 (3단계)

### Phase 1: 스키마 변경 (즉시 - 2026-05-27)
- [ ] Prisma 마이그레이션 파일 생성
- [ ] Contact 테이블에 6개 새 필드 추가
- [ ] 인덱스 생성 (성능 최적화)
- [ ] 기존 데이터: sourceType = null로 초기화

### Phase 2: 데이터 마이그레이션 (2026-05-27)
- [ ] sync-cruisedot-to-crm.ts 스크립트 수정
  - User → sourceType="user", signupMethod 파싱
  - CruiseProductInquiry → sourceType="inquiry"
  - AffiliateLead → sourceType="affiliate", 링크/담당자 정보
- [ ] 기존 194명 데이터 재동기화
- [ ] 검증: 모든 고객이 올바른 sourceType 할당 확인

### Phase 3: UI 업데이트 (2026-05-27 ~ 05-28)
- [ ] Contact 필터링 컴포넌트 수정
- [ ] sourceType별 아이콘/색상 매핑
- [ ] RBAC 구현 (API 레이어)
- [ ] /고객 관리 페이지 업데이트

---

## 📈 기대 효과

| 항목 | Before | After |
|------|--------|-------|
| **고객 분류 정확도** | 0% (미분류) | 100% (출처별 분류) |
| **역할별 접근 제어** | 모든 사용자가 모든 고객 조회 | 역할별로 제한된 고객만 조회 |
| **어필리에이트 추적** | 불가능 | 링크/담당자/에이전트별 추적 가능 |
| **CRM 신뢰도** | "왜 다 구매고객이지?" | "출처별로 정확하게 분류됨" |

---

## 🛠️ 기술 체크리스트

### Prisma 마이그레이션
- [ ] `npx prisma migrate create add_customer_source_fields` 생성
- [ ] 6개 필드 + 5개 인덱스 추가
- [ ] `npx prisma migrate deploy` 실행
- [ ] `npx prisma generate` 타입 재생성

### 동기화 스크립트 수정
- [ ] `sync-cruisedot-to-crm.ts`에서 User 동기화 함수 수정
  - signupMethod 파싱 로직 추가
- [ ] CruiseProductInquiry 동기화 함수 수정
  - sourceType="inquiry" 할당
- [ ] AffiliateLead 동기화 함수 수정
  - affiliateLinkId, affiliateManagerId, affiliateAgentId 할당
- [ ] 테스트 데이터로 검증

### API 레이어 (RBAC)
- [ ] `GET /api/contacts` 엔드포인트 수정
  - 현재 사용자의 역할에 따라 WHERE 절 자동 추가
- [ ] 쿼리 최적화 (인덱스 활용)

### UI 업데이트
- [ ] Contact 필터 컴포넌트
- [ ] Contact 리스트 아이콘/색상
- [ ] Contact 상세 보기
- [ ] 검색 기능 (sourceType 포함)

---

## ✅ 성공 기준

1. ✅ 194명 모두가 올바른 sourceType 할당됨
2. ✅ 어필리에이트 고객의 linkId/managerId/agentId가 추적됨
3. ✅ 구매고객의 signupMethod가 파싱됨 (일반/카카오/네이버/구글)
4. ✅ UI에서 출처별 필터링 가능
5. ✅ 역할별 접근 제어 적용됨
6. ✅ 사용자가 "이제 출처별로 분류되었네"라고 확인

---

**작성일**: 2026-05-27  
**상태**: 📋 설계 완료, Phase 1 구현 예정  
**예상 완료**: 2026-05-27 ~ 05-28
