# 설치 가이드 (Setup Guide)

> 다른 프로젝트에 affiliate-auto-system을 적용하는 방법

---

## 📦 필수 패키지

```bash
npm install @prisma/client
npm install crypto  # 내장 패키지 (이미 포함)
```

---

## 🗂️ 파일 배치

### 1단계: 파일 복사

```bash
# affiliate-auto-system 폴더 다운로드/복사

# Step 1: lib 파일들 복사
cp affiliate-auto-system/lib/* your-project/lib/affiliate-auto/

# Step 2: API 파일 복사
mkdir -p your-project/app/api/affiliate/contracts/[contractId]/approve
cp affiliate-auto-system/api/contracts/approve-route.ts \
   your-project/app/api/affiliate/contracts/[contractId]/approve/route.ts

# Step 3: 컴포넌트 복사
cp affiliate-auto-system/components/* your-project/components/affiliate/

# Step 4: DB 마이그레이션 복사
cp affiliate-auto-system/db/migration.sql \
   your-project/prisma/migrations/[timestamp]_add_amount_to_affiliate_contract/migration.sql
```

---

## 2단계: Prisma 스키마 수정

**파일: `prisma/schema.prisma`**

### AffiliateContract 모델 수정

```prisma
model AffiliateContract {
  id                     Int                 @id @default(autoincrement())
  userId                 Int?
  name                   String
  phone                  String
  email                  String?
  amount                 Int                 @default(3300000)  // ← 추가!
  
  // 기존 필드들...
  address                String?
  bankAccount            String?
  bankAccountHolder      String?
  bankName               String?
  status                 String              @default("submitted")
  submittedAt            DateTime            @default(now())
  createdAt              DateTime            @default(now())
  updatedAt              DateTime
  
  // 기존 관계들...
  User_AffiliateContract_userIdToUser     User?               @relation("AffiliateContract_userIdToUser", fields: [userId], references: [id])
  // ... 나머지 관계들
  
  // 인덱스 추가 ← 매우 중요!
  @@index([amount, status])
}
```

### User 모델 (기존)

```prisma
model User {
  id           Int     @id @default(autoincrement())
  email        String  @unique
  name         String
  phone        String?
  passwordHash String  // bcryptjs 권장
  role         String  @default("USER")  // AFFILIATE_MANAGER, AFFILIATE_AGENT 등
  emailVerified Boolean @default(false)
  // ...
}
```

### AffiliateProfile 모델 (기존)

```prisma
model AffiliateProfile {
  id                Int     @id @default(autoincrement())
  userId            Int     @unique
  type              String  // "MANAGER", "AGENT"
  status            String  @default("ACTIVE")
  affiliateCode     String  @unique
  displayName       String?
  contactPhone      String?
  contactEmail      String?
  agentCommissionRate Int?
  guarantorId       Int?  // manager의 id (agent인 경우)
  // ...
  User              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### AffiliateRelation 모델 (기존)

```prisma
model AffiliateRelation {
  id          Int     @id @default(autoincrement())
  managerId   Int
  agentId     Int
  status      String  @default("ACTIVE")
  connectedAt DateTime?
  // ...
  @@unique([managerId, agentId])
}
```

### AffiliateLink 모델 (기존)

```prisma
model AffiliateLink {
  id              Int     @id @default(autoincrement())
  managerId       Int?
  agentId         Int?
  code            String  @unique  // "aff_XXXXXXXX"
  url             String
  status          String  @default("ACTIVE")
  clickCount      Int     @default(0)
  conversionCount Int     @default(0)
  totalRevenue    Int     @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime
}
```

---

## 3단계: 마이그레이션 실행

### 개발 환경

```bash
# Prisma 마이그레이션 생성 + 실행
npx prisma migrate dev --name add_amount_to_affiliate_contract

# 또는 수동으로 마이그레이션 실행
npx prisma migrate resolve --rolled-back add_amount_to_affiliate_contract
npx prisma migrate deploy
```

### 프로덕션 환경

```bash
# 마이그레이션만 실행 (schema 변경 없음)
npx prisma migrate deploy

# Prisma 클라이언트 재생성
npx prisma generate
```

---

## 4단계: 환경 변수 설정

**.env.local**

```bash
# Prisma
DATABASE_URL="postgresql://user:password@localhost:5432/yourdb"

# 앱 URL (어필리에이트 링크에 사용)
NEXT_PUBLIC_APP_URL="https://yoursite.com"

# 선택사항: 로깅
LOG_LEVEL="info"  # "debug", "info", "warn", "error"
```

---

## 5단계: API 경로 확인

### 생성된 엔드포인트

```
POST /api/affiliate/contracts
  └─ 계약서 작성

PUT /api/affiliate/contracts/[contractId]/approve
  └─ 계약 승인 → manager/agent 자동 생성 + 링크 생성

GET /api/affiliate/contracts/[contractId]/approve
  └─ 계약 상태 조회
```

---

## 6단계: UI 컴포넌트 사용

### Page 컴포넌트

```tsx
// app/affiliate/contracts/[contractId]/page.tsx
import { ContractForm } from '@/components/affiliate/ContractForm';

export default function ContractPage({ params }: { params: { contractId: string } }) {
  return (
    <div>
      <h1>계약 승인</h1>
      <ContractForm 
        contractId={parseInt(params.contractId)}
        onSuccess={(data) => {
          console.log('✅ 계약 승인 완료:', data);
          // 리다이렉트 또는 상태 업데이트
        }}
        onError={(error) => {
          console.error('❌ 오류:', error);
        }}
      />
    </div>
  );
}
```

---

## 🔄 데이터 흐름

```
1. 계약서 작성 (POST /api/affiliate/contracts)
   {
     name: "홍길동",
     phone: "010-1234-5678",
     email: "hong@email.com",
     amount: 5400000,  // 가격대 선택
     // ... 나머지 정보
   }
   
   ↓
   
2. AffiliateContract 생성 (status: "submitted")
   
   ↓
   
3. 관리자가 계약 승인 (UI: ContractForm 사용)
   
   ↓
   
4. PUT /api/affiliate/contracts/[contractId]/approve
   {
     amount: 5400000
   }
   
   ↓
   
5. 자동 실행:
   a) createAffiliateAccountPair()
      - User (manager) 생성
      - AffiliateProfile (manager) 생성
      - User (agent) 생성
      - AffiliateProfile (agent) 생성
      - AffiliateRelation 연결 (manager ↔ agent)
   
   b) generateAffiliateLinksPair()
      - AffiliateLink (manager) 생성
      - AffiliateLink (agent) 생성
   
   ↓
   
6. 응답 반환:
   {
     ok: true,
     data: {
       manager: { id, name, email, affiliateCode, linkCode, linkUrl },
       agent: { id, name, email, affiliateCode, linkCode, linkUrl },
       tier: { label, amount, commissionRate }
     }
   }
```

---

## 🧪 테스트

### 1. 수동 테스트

```bash
# 계약 생성
curl -X POST http://localhost:3000/api/affiliate/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트",
    "phone": "010-0000-0000",
    "email": "test@email.com",
    "amount": 3300000,
    "address": "서울시",
    "bankName": "국민은행",
    "bankAccount": "123-456-789",
    "bankAccountHolder": "홍길동"
  }'

# 응답: { "ok": true, "contractId": 1 }

# 계약 승인
curl -X PUT http://localhost:3000/api/affiliate/contracts/1/approve \
  -H "Content-Type: application/json" \
  -d '{ "amount": 3300000 }'

# 응답: { "ok": true, "data": { manager, agent, tier } }
```

### 2. DB 검증

```sql
-- 계약 확인
SELECT id, name, amount, status FROM "AffiliateContract" WHERE id = 1;

-- Manager 확인
SELECT id, type, affiliateCode FROM "AffiliateProfile" WHERE type = 'MANAGER' LIMIT 1;

-- Agent 확인
SELECT id, type, affiliateCode FROM "AffiliateProfile" WHERE type = 'AGENT' LIMIT 1;

-- 관계 확인
SELECT * FROM "AffiliateRelation" WHERE status = 'ACTIVE' LIMIT 1;

-- 링크 확인
SELECT id, code, url FROM "AffiliateLink" LIMIT 2;
```

---

## ⚠️ 주의사항

1. **DB 마이그레이션 먼저 실행**
   - amount 필드가 없으면 API 에러 발생

2. **User 모델에 passwordHash 필드 필수**
   - 비밀번호 해싱 구현 필요 (bcryptjs 권장)

3. **NEXT_PUBLIC_APP_URL 환경변수 필수**
   - 어필리에이트 링크 URL에 사용됨

4. **트랜잭션 사용**
   - 계정 생성 실패 시 모두 롤백됨 (atomicity 보장)

5. **에러 마스킹**
   - 민감한 정보는 로그에만 기록

---

## ✅ 체크리스트

- [ ] 파일 복사 완료
- [ ] Prisma 스키마 수정 (amount 필드, 인덱스)
- [ ] DB 마이그레이션 실행
- [ ] 환경변수 설정
- [ ] npm run build 성공
- [ ] API 테스트 (POST, PUT 확인)
- [ ] UI 컴포넌트 렌더링 확인
- [ ] 계약 승인 → 자동 생성 확인

---

완료되면 다른 사이트에서도 동일한 시스템을 사용할 수 있습니다! ✨
