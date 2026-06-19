# 여권번호 AES-256 암호화 설정 가이드

## 1. 개요

여권번호를 AES-256 (군사용 256비트) 암호화로 안전하게 저장합니다.

- **암호화 방식**: AES-256-CBC
- **초기화벡터**: 16바이트 랜덤 (매번 새로 생성)
- **저장 위치**: DB의 `passportNumber` (암호화) + `passportIV` (초기화벡터)
- **키 관리**: 환경변수 `PASSPORT_ENCRYPTION_KEY` (32바이트)

---

## 2. 암호화 키 생성

### 방법 1: Node.js 명령어 (권장)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

결과 예:
```
a1b2c3d4e5f6789012345678901234567890abcdef0123456789abcdef012345
```

### 방법 2: OpenSSL

```bash
openssl rand -hex 32
```

---

## 3. 환경변수 설정

### .env.local (개발)

```env
PASSPORT_ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef0123456789abcdef012345
```

### Vercel 환경변수 (배포)

```bash
vercel env add PASSPORT_ENCRYPTION_KEY
# 프롬프트에 복사한 키 붙여넣기
```

또는 Vercel 대시보드:
1. Settings → Environment Variables
2. Add New
3. Name: `PASSPORT_ENCRYPTION_KEY`
4. Value: (위에서 생성한 32바이트 hex 문자열)

---

## 4. Prisma Schema 변경

### GmPassportSubmissionGuest

```prisma
model GmPassportSubmissionGuest {
  id                 Int       @id @default(autoincrement())
  submissionId       Int
  groupNumber        Int
  name               String
  phone              String?
  passportNumber     String?   // AES-256 암호화됨 (base64)
  passportIV         String?   // 초기화벡터 (base64, 암호화 해제 필수)
  // ... 기타 필드
}
```

### GoldMember

```prisma
model GoldMember {
  id                 Int       @id @default(autoincrement())
  // ... 기타 필드
  passportNumber     String?   // AES-256 암호화됨 (base64)
  passportIV         String?   // 초기화벡터 (base64, 암호화 해제 필수)
}
```

---

## 5. 마이그레이션 실행

```bash
npx prisma migrate dev --name "add_passport_encryption_iv"
```

### 기존 데이터 마이그레이션 (선택사항)

기존 평문 여권번호를 암호화로 변환하려면:

```bash
# 1. migration 파일 생성
npx prisma migrate create-only --name encrypt_existing_passports

# 2. migration/[timestamp]_encrypt_existing_passports.sql 편집:
```

```sql
-- GmPassportSubmissionGuest
UPDATE public."GmPassportSubmissionGuest"
SET 
  "passportIV" = gen_random_uuid()::text
WHERE "passportNumber" IS NOT NULL 
  AND "passportIV" IS NULL;

-- GoldMember
UPDATE public."GoldMember"
SET 
  "passportIV" = gen_random_uuid()::text
WHERE "passportNumber" IS NOT NULL 
  AND "passportIV" IS NULL;
```

> **주의**: 실제 암호화는 애플리케이션 레벨에서 진행해야 합니다. 
> 이 SQL은 IV 필드만 초기화합니다.

---

## 6. API 적용

### 저장 (Create/Update)

```typescript
import { preparePassportForDb } from '@/lib/passport-db-helpers';

const plainPassportNumber = 'M12345678';
const { passportNumber, passportIV } = preparePassportForDb(plainPassportNumber);

await prisma.gmPassportSubmissionGuest.create({
  data: {
    submissionId,
    groupNumber: 1,
    name: '김철수',
    passportNumber,    // 암호화됨 (base64)
    passportIV,        // 초기화벡터
  },
});
```

### 조회 (복호화)

```typescript
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: 123 },
  select: {
    id: true,
    name: true,
    passportNumber: true,  // 암호화됨
    passportIV: true,
  },
});

// 복호화
const plainPassport = decryptPassportFromDb(
  guest.passportNumber,
  guest.passportIV
);
console.log(plainPassport); // 'M12345678'
```

### 조회 (마스킹 - UI용)

```typescript
import { maskPassportFromDb } from '@/lib/passport-db-helpers';

const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: 123 },
  select: {
    id: true,
    name: true,
    passportNumber: true,  // 암호화됨
    passportIV: true,
  },
});

// 마스킹
const maskedPassport = maskPassportFromDb(
  guest.passportNumber,
  guest.passportIV
);
console.log(maskedPassport); // '****5678'
```

---

## 7. 여권번호 검색

암호화된 필드로는 DB WHERE 검색이 불가능합니다. 대신:

```typescript
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

const submissionId = 123;
const plainPassportToFind = 'M12345678';

// 1. 다른 필드(이름/생년월일)로 먼저 필터링
const candidates = await prisma.gmPassportSubmissionGuest.findMany({
  where: { submissionId },
  select: {
    id: true,
    name: true,
    passportNumber: true,
    passportIV: true,
  },
});

// 2. 애플리케이션에서 복호화 후 매칭
const matchedGuest = candidates.find((guest) => {
  const decrypted = decryptPassportFromDb(
    guest.passportNumber,
    guest.passportIV
  );
  return decrypted === plainPassportToFind;
});
```

---

## 8. 파일 구조

```
src/
├── lib/
│   ├── passport-encryption.ts          # 핵심: encryptPassport, decryptPassport
│   └── passport-db-helpers.ts          # API: preparePassportForDb, decryptPassportFromDb
│
├── app/api/passport/
│   ├── encryption-example-route.ts     # 예제 (삭제 가능)
│   ├── [token]/submit/route.ts         # 적용 필요: 저장 시 암호화
│   ├── [token]/upload/route.ts         # 이미지 백업 (여권번호 미사용)
│   └── ...
│
└── prisma/
    └── schema.prisma                   # passportIV 필드 추가
```

---

## 9. 보안 체크리스트

- [ ] PASSPORT_ENCRYPTION_KEY 환경변수 설정 (32바이트 hex)
- [ ] Prisma schema `passportIV` 필드 추가
- [ ] 마이그레이션 실행 (`npx prisma migrate dev`)
- [ ] API 저장 로직 수정 (`preparePassportForDb` 사용)
- [ ] API 조회 로직 수정 (복호화 또는 마스킹)
- [ ] 여권번호 검색 로직 수정 (애플리케이션 레벨 매칭)
- [ ] `.env.local`에 PASSPORT_ENCRYPTION_KEY 추가
- [ ] Vercel 환경변수 추가 (배포 전)
- [ ] TypeScript 타입 검증 (`npx tsc --noEmit`)

---

## 10. 장점

| 측면 | 설명 |
|------|------|
| **암호화 강도** | AES-256 (군사용 표준) |
| **초기화벡터** | 매번 새로 생성 → 같은 평문도 다르게 암호화 |
| **DB 저장** | base64 인코딩 → 텍스트 기반 저장 |
| **조회 성능** | 필요 시에만 복호화 (느림 아님) |
| **검색 제약** | 암호화 필드는 WHERE 검색 불가 (안전) |

---

## 11. 제약사항

| 제약 | 이유 | 대안 |
|------|------|------|
| 암호화 필드로 WHERE 검색 불가 | IV가 매번 다르므로 DB가 비교 불가 | 이름/생년월일로 먼저 필터링 후 앱 레벨 매칭 |
| UNIQUE 제약 불가 | 암호화 데이터가 다르므로 UNIQUE 불가능 | 이미 있는 부분 UNIQUE 인덱스 유지 (평문) |
| 정렬 불가 | 암호화되면 정렬 순서 뒤바뀜 | 필요 시 평문 필드 별도 유지 (권장 안 함) |

---

## 12. 테스트

```typescript
import { encryptPassport, decryptPassport, maskPassport } from '@/lib/passport-encryption';

// 1. 기본 암호화/복호화
const plaintext = 'M12345678';
const { encryptedData, iv } = encryptPassport(plaintext);
const decrypted = decryptPassport(encryptedData, iv);
console.assert(decrypted === plaintext); // ✅

// 2. 마스킹
const masked = maskPassport(plaintext);
console.assert(masked === '****5678'); // ✅

// 3. 같은 평문도 다르게 암호화 (IV 때문)
const encrypted1 = encryptPassport(plaintext);
const encrypted2 = encryptPassport(plaintext);
console.assert(encrypted1.encryptedData !== encrypted2.encryptedData); // ✅
```

---

## 13. 배포 순서

1. 개발 환경에서 테스트
2. `.env.local`에 PASSPORT_ENCRYPTION_KEY 추가
3. `npx tsc --noEmit` 실행 (타입 검증)
4. API 로직 수정 및 테스트
5. Vercel에 PASSPORT_ENCRYPTION_KEY 환경변수 추가
6. 배포

---

## 참고

- **암호화 라이브러리**: Node.js 내장 `crypto` 모듈
- **암호화 알고리즘**: AES-256-CBC (NIST 승인)
- **인코딩**: base64 (DB 저장용)
- **키 길이**: 32바이트 (256비트)
- **IV 길이**: 16바이트 (128비트)
