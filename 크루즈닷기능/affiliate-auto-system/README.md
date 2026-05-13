# 어필리에이트 자동화 시스템 (Affiliate Auto System)

> 계약서 → 자동으로 대리점장/판매원 계정 생성 + 어필리에이트 링크 생성

## 📋 개요

이 시스템은 **다음을 자동으로 처리**합니다:

1. **계약서 작성** (330/540/750만원 3가지 가격대)
2. **계약 완료** → **자동 계정 생성**
   - 대리점장(manager) 계정 + 프로필
   - 판매원(agent) 계정 + 프로필
   - 관계 연결 (manager ↔ agent)
3. **자동 어필리에이트 링크 생성**
   - Manager 링크
   - Agent 링크

---

## 🚀 설치 방법 (다른 사이트에 적용)

### Step 1: 폴더 복사
```bash
cp -r affiliate-auto-system /path/to/your/project/
```

### Step 2: 구조에 맞게 배치

**프로젝트 구조 (Next.js 기준):**
```
your-project/
├─ lib/affiliate-auto/         ← lib/ 폴더의 파일들 복사
│  ├─ contractPriceTiers.ts
│  ├─ createAffiliateAccountPair.ts
│  ├─ generateAffiliateLink.ts
│  └─ index.ts
│
├─ app/api/affiliate/contracts/
│  └─ [contractId]/approve/
│     └─ route.ts               ← api/contracts/approve-route.ts 복사
│
├─ components/affiliate/
│  └─ ContractForm.tsx          ← components/ 폴더 파일 복사
│
└─ prisma/
   ├─ schema.prisma            ← 아래 수정 필요
   └─ migrations/
      └─ [timestamp]_add_amount/
         └─ migration.sql       ← db/migration.sql 복사
```

### Step 3: Prisma 스키마 수정

**prisma/schema.prisma의 AffiliateContract 모델:**

```prisma
model AffiliateContract {
  id        Int     @id @default(autoincrement())
  userId    Int?
  name      String
  phone     String
  email     String?
  amount    Int     @default(3300000)  // ← 이 줄 추가!
  status    String  @default("submitted")
  // ... 나머지 필드들
  
  @@index([amount, status])  // ← 이 인덱스 추가!
}
```

### Step 4: 데이터베이스 마이그레이션

```bash
# 마이그레이션 실행
npx prisma migrate deploy

# 또는 개발 환경
npx prisma migrate dev --name add_amount_to_affiliate_contract
```

### Step 5: API 환경 변수

**.env.local에 추가:**
```
NEXT_PUBLIC_APP_URL=https://yoursite.com
```

---

## 📁 파일 구조 설명

### lib/ (비즈니스 로직)

**contractPriceTiers.ts**
```ts
CONTRACT_PRICE_TIERS = {
  BASIC: { priceKRW: 3300000, commissionRate: 10 },
  STANDARD: { priceKRW: 5400000, commissionRate: 15 },
  PREMIUM: { priceKRW: 7500000, commissionRate: 20 },
}
```

**createAffiliateAccountPair.ts**
- manager User 생성
- manager AffiliateProfile 생성
- agent User 생성
- agent AffiliateProfile 생성
- AffiliateRelation 연결 (transaction)

**generateAffiliateLink.ts**
- manager 어필리에이트 링크 생성
- agent 어필리에이트 링크 생성

---

### api/ (API 엔드포인트)

**[contractId]/approve/route.ts**

```
PUT /api/affiliate/contracts/[contractId]/approve
요청: { amount: 3300000 | 5400000 | 7500000 }

응답:
{
  ok: true,
  data: {
    manager: {
      id: 1,
      name: "홍길동 대리점장",
      affiliateCode: "MGR-ABC123",
      linkCode: "aff_XYZ789",
      linkUrl: "https://site.com?ref=aff_XYZ789"
    },
    agent: {
      id: 2,
      name: "홍길동 판매원",
      affiliateCode: "AGT-DEF456",
      linkCode: "aff_UVW456",
      linkUrl: "https://site.com?ref=aff_UVW456"
    },
    tier: {
      label: "표준 대리점",
      amount: 5400000,
      commissionRate: 15
    }
  }
}
```

---

### components/ (UI)

**ContractForm.tsx**
- 3가지 가격대 선택 UI
- 계약 승인 버튼
- 자동 생성 결과 표시

```tsx
<ContractForm 
  contractId={123} 
  onSuccess={(data) => console.log(data)}
  onError={(err) => console.error(err)}
/>
```

---

## 🔌 DB 스키마 요구사항

필수 테이블:
- `User` (userId, email, name, phone, passwordHash)
- `AffiliateProfile` (userId, type, status, affiliateCode, displayName)
- `AffiliateRelation` (managerId, agentId, status)
- `AffiliateLink` (managerId/agentId, code, url, status)
- `AffiliateContract` (userId, name, phone, **amount**, status, metadata)

---

## 💡 사용 예제

### 1. 계약서 작성
```ts
// POST /api/affiliate/contracts
const contract = await fetch('/api/affiliate/contracts', {
  method: 'POST',
  body: JSON.stringify({
    name: '홍길동',
    phone: '010-1234-5678',
    email: 'hong@email.com',
    amount: 5400000, // 선택한 가격대
    // ... 나머지 정보
  })
});
```

### 2. 계약 승인 (자동 생성)
```ts
// PUT /api/affiliate/contracts/[contractId]/approve
const result = await fetch(`/api/affiliate/contracts/123/approve`, {
  method: 'PUT',
  body: JSON.stringify({
    amount: 5400000
  })
});
// 응답: manager, agent, links 자동 생성됨
```

### 3. UI에서 사용
```tsx
<ContractForm contractId={contractId} onSuccess={handleSuccess} />
```

---

## 🔒 보안 체크리스트

- ✅ IDOR 방지 (소유권 검증)
- ✅ CSRF 토큰 (POST/PUT/DELETE)
- ✅ Zod 입력 검증
- ✅ 에러 마스킹 (민감 정보 노출 금지)
- ✅ 트랜잭션 (원자성 보장)
- ✅ 구조화된 로깅

---

## 📊 데이터 흐름

```
계약 생성
  ↓
[관리자 승인]
  ↓
PUT /api/affiliate/contracts/[id]/approve
  ↓
createAffiliateAccountPair()
  ├─ User (manager) 생성
  ├─ AffiliateProfile (manager) 생성
  ├─ User (agent) 생성
  ├─ AffiliateProfile (agent) 생성
  └─ AffiliateRelation 연결
  ↓
generateAffiliateLinksPair()
  ├─ AffiliateLink (manager) 생성
  └─ AffiliateLink (agent) 생성
  ↓
✅ 완료 (manager/agent 계정 + 링크 생성됨)
```

---

## 🆘 트러블슈팅

### "AffiliateContract에 amount 필드 없음" 에러
→ DB 마이그레이션 실행: `npx prisma migrate deploy`

### "User 또는 AffiliateProfile 생성 실패"
→ Prisma transaction 체크 + 필수 필드 확인

### "링크가 안 생성됨"
→ NEXT_PUBLIC_APP_URL 환경변수 확인

---

## 📝 라이센스

MIT

---

## 💬 지원

문제가 있으면 로그를 확인하세요:
```
logger.error('[AFFILIATE-AUTO] ...', { error details })
```
