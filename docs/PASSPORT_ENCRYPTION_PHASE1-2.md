# Passport 여권번호 암호화 구현 (Phase 1-2)

**상태**: ✅ 완료 (2026-06-19)
**담당**: Agent-Passport
**우선순위**: P0 (보안 필수)

---

## 📋 검증 체크리스트

### ✅ Phase 1: 암호화 인프라 (완료)

- [x] `src/lib/passport-encryption.ts` — AES-256-CBC 함수 구현 완료
  - `encryptPassport(plaintext)` → `{ encryptedData, iv }` (base64)
  - `decryptPassport(encryptedData, iv)` → plaintext
  - `maskPassport(plaintext)` → "****xxxx"
  - `generateEncryptionKey()` — 개발용 키 생성
  - `validateEncryptionKey()` — 키 검증

- [x] `src/lib/passport-db-helpers.ts` — DB 헬퍼 함수 완료
  - `preparePassportForDb()` — 저장 전 암호화
  - `decryptPassportFromDb()` — 조회 후 복호화
  - `maskPassportFromDb()` — 조회 후 마스킹
  - `passportSelectFields` — SELECT 타입 힌트
  - `migrateToEncryptedPassport()` — 대량 데이터 변환용

- [x] Prisma Schema — 필드 이미 존재
  - `GmPassportSubmissionGuest.passportNumber` (String?, base64 암호화)
  - `GmPassportSubmissionGuest.passportIV` (String?, base64 초기화벡터)
  - 부분 UNIQUE 인덱스 생성 (migrations/20260606120001_guest_passport_partial_uq)

- [x] 테스트 파일
  - `src/lib/passport-encryption.test.ts` — 단위 테스트 (예제 코드)
  - `src/lib/passport-sms.test.ts` — SMS 관련 테스트

- [x] 예제 API
  - `src/app/api/passport/encryption-example-route.ts` — 7가지 사용 패턴

---

### ⚠️ Phase 2: API 통합 (진행 중)

#### 필수 수정 파일 목록

| 파일 | 역할 | 상태 | 설명 |
|------|------|------|------|
| `.env.local` | 암호화 키 설정 | 🔴 필요 | `PASSPORT_ENCRYPTION_KEY` 추가 필수 |
| `src/app/api/passport/customers/route.ts` | 고객 조회 | 🟡 검토 | 여권번호 조회 시 decryptPassportFromDb 적용 |
| `src/app/api/passport/admin/manual-register/route.ts` | 수동 등록 | 🟡 검토 | 여권번호 저장 시 preparePassportForDb 적용 |
| `src/app/api/passport/admin/search/route.ts` | 검색 API | 🟡 검토 | 암호화된 여권번호 검색 불가 (다른 필드로 필터링) |
| `src/app/api/passport/admin/ocr-to-apis/route.ts` | OCR 자동화 | 🟡 검토 | OCR 결과 저장 시 암호화 적용 |
| `src/app/(dashboard)/passport/` | 대시보드 | 🟡 검토 | UI 표시 시 maskPassportFromDb 적용 |

---

## 🔑 핵심 구현 패턴

### 패턴 1: 저장 (Create/Update)

```typescript
import { preparePassportForDb } from '@/lib/passport-db-helpers';

// 평문 입력값
const plainPassport = req.body.passportNumber;

// 암호화
const { passportNumber, passportIV } = preparePassportForDb(plainPassport);

// DB에 저장
await prisma.gmPassportSubmissionGuest.update({
  where: { id: guestId },
  data: {
    passportNumber,      // 암호화됨
    passportIV,          // 초기화벡터
  },
});
```

### 패턴 2: 조회 (복호화, 관리자용)

```typescript
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: guestId },
});

// 복호화 (민감 데이터 - 관리자만 접근)
const plainPassport = decryptPassportFromDb(guest.passportNumber, guest.passportIV);
```

### 패턴 3: 조회 (마스킹, UI용)

```typescript
import { maskPassportFromDb } from '@/lib/passport-db-helpers';

const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: guestId },
});

// 마스킹 (UI 표시용 - 안전)
const maskedPassport = maskPassportFromDb(guest.passportNumber, guest.passportIV);
// 결과: "****5678"
```

### 패턴 4: 검색 (불가능 - 다른 방법)

```typescript
// ❌ 이렇게 하면 안 됨:
// WHERE passportNumber = '...'  // 암호화되어 있으므로 검색 불가

// ✅ 올바른 방법: 이름/생년월일로 먼저 필터링
const candidates = await prisma.gmPassportSubmissionGuest.findMany({
  where: {
    submissionId,
    name: searchName,                 // 암호화 안 된 필드로 검색
    dateOfBirth: searchDob,
  },
});

// 애플리케이션에서 복호화해서 매칭
const matched = candidates.find(guest => {
  const decrypted = decryptPassportFromDb(guest.passportNumber, guest.passportIV);
  return decrypted === plainSearchPassport;
});
```

---

## 🔐 환경변수 설정

### 로컬 개발 (.env.local)

```bash
# 32바이트 = 256비트 AES 키
# 생성 방법: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

PASSPORT_ENCRYPTION_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**예제 (테스트용, 실제 배포는 다른 값 사용)**:
```bash
PASSPORT_ENCRYPTION_KEY="d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3"
```

### Vercel 프로덕션

1. **Vercel Console** → Settings → Environment Variables
2. `PASSPORT_ENCRYPTION_KEY` 추가
3. Production / Preview / Development 모두 체크
4. Deploy 재실행

### 키 생성 (NodeJS)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**결과 예시**:
```
d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3
```

### 보안 점검

- ✅ `.env.local` git에 커밋 금지 (.gitignore에 이미 등록됨)
- ✅ 환경변수만 사용 (코드에 하드코딩 금지)
- ✅ 로그에 KEY 노출 금지
- ✅ 소스 코드에 민감 데이터 저장 금지

---

## 📊 암호화 기술 상세

### AES-256-CBC

```
알고리즘: AES (Advanced Encryption Standard)
모드: CBC (Cipher Block Chaining)
키 길이: 256비트 (32바이트)
초기화벡터: 128비트 (16바이트, 매번 랜덤 생성)
인코딩: Base64 (DB 저장용)
```

### 암호화 흐름

```
평문 (plaintext)
  ↓
[AES-256-CBC 암호화]
  ↓ encryptedData (hex) + iv (binary)
  ↓
Base64 인코딩
  ↓
DB에 저장: { passportNumber: "base64...", passportIV: "base64..." }
```

### 복호화 흐름

```
DB 조회: { passportNumber: "base64...", passportIV: "base64..." }
  ↓
Base64 디코딩
  ↓
[AES-256-CBC 복호화]
  ↓
평문 (plaintext)
  ↓
UI 표시 또는 처리
```

---

## 🧪 테스트 전략

### 단위 테스트

```typescript
import { encryptPassport, decryptPassport, maskPassport } from '@/lib/passport-encryption';

describe('Passport Encryption', () => {
  const testPassport = 'M12345678';

  test('암호화 후 복호화', () => {
    const { encryptedData, iv } = encryptPassport(testPassport);
    const decrypted = decryptPassport(encryptedData, iv);
    expect(decrypted).toBe(testPassport);
  });

  test('마스킹', () => {
    const masked = maskPassport(testPassport);
    expect(masked).toBe('****5678');
  });

  test('매번 다른 IV 생성 (보안)', () => {
    const encrypt1 = encryptPassport(testPassport);
    const encrypt2 = encryptPassport(testPassport);
    // IV가 다르므로 결과도 다름
    expect(encrypt1.encryptedData).not.toBe(encrypt2.encryptedData);
    // IV도 다름
    expect(encrypt1.iv).not.toBe(encrypt2.iv);
    // 하지만 같은 평문이므로 복호화 결과는 같음
    expect(decryptPassport(encrypt1.encryptedData, encrypt1.iv))
      .toBe(decryptPassport(encrypt2.encryptedData, encrypt2.iv));
  });
});
```

### 통합 테스트

```typescript
import { preparePassportForDb, decryptPassportFromDb } from '@/lib/passport-db-helpers';
import prisma from '@/lib/prisma';

describe('Passport DB Integration', () => {
  test('저장 → 복호화', async () => {
    const plainPassport = 'M12345678';
    const { passportNumber, passportIV } = preparePassportForDb(plainPassport);

    const guest = await prisma.gmPassportSubmissionGuest.update({
      where: { id: 1 },
      data: { passportNumber, passportIV },
    });

    const retrieved = await prisma.gmPassportSubmissionGuest.findUnique({
      where: { id: 1 },
    });

    const decrypted = decryptPassportFromDb(
      retrieved.passportNumber,
      retrieved.passportIV
    );

    expect(decrypted).toBe(plainPassport);
  });
});
```

---

## 🛑 주의사항

### 1. IV(초기화벡터)는 매번 다름

```typescript
// ❌ 잘못된 예: IV를 저장하지 않음
const { encryptedData } = encryptPassport('M12345678');
// → IV를 잃어버림 (복호화 불가)

// ✅ 올바른 방법: 반드시 IV와 함께 저장
const { encryptedData, iv } = encryptPassport('M12345678');
// → { passportNumber: encryptedData, passportIV: iv } 저장
```

### 2. 암호화된 필드는 WHERE 검색 불가

```typescript
// ❌ 이렇게 하면 안 됨
WHERE passportNumber = 'M12345678'

// ✅ 올바른 방법: 다른 필드로 먼저 필터링
WHERE submissionId = 123 AND name = '김철수'
// → 애플리케이션에서 복호화해서 매칭
```

### 3. 마스킹은 일방향 (복호화 불가)

```typescript
// maskPassport('M12345678') → '****5678'
// 이것은 원래 번호를 복구할 수 없음
// UI 표시용으로만 사용
```

### 4. 권한 검사 필수

```typescript
// ✅ 복호화는 관리자만
if (user.role !== 'ADMIN') {
  return { error: '관리자 권한 필요' };
}
const plainPassport = decryptPassportFromDb(...);

// ✅ 마스킹은 모든 사용자
const maskedPassport = maskPassportFromDb(...);
```

---

## 📈 마이그레이션 (기존 평문 데이터)

### 상황: 기존 DB에 평문 여권번호가 있는 경우

```typescript
import { migrateToEncryptedPassport } from '@/lib/passport-db-helpers';

// 기존 평문 데이터 조회
const guests = await prisma.gmPassportSubmissionGuest.findMany({
  where: {
    passportNumber: { not: null },
  },
});

// 일괄 암호화
const updates = guests.map(guest => {
  const { passportNumber, passportIV } = migrateToEncryptedPassport(
    guest.passportNumber
  );

  return prisma.gmPassportSubmissionGuest.update({
    where: { id: guest.id },
    data: { passportNumber, passportIV },
  });
});

await Promise.all(updates);
```

---

## ✅ 완료 기준

### Phase 1: 인프라 (✅ 완료)
- [x] 암호화 함수 구현
- [x] DB 헬퍼 함수 구현
- [x] Prisma 스키마 필드 확인
- [x] 테스트 파일 작성
- [x] 예제 API 작성

### Phase 2: API 통합 (진행 중)
- [ ] 환경변수 설정 (.env.local + Vercel)
- [ ] API 라우트 수정 (6개 파일)
- [ ] 권한 검사 추가
- [ ] TSC 0에러
- [ ] 로컬 테스트
- [ ] Vercel 배포

---

## 📞 참고 자료

### 파일 위치
- 암호화 함수: `src/lib/passport-encryption.ts`
- DB 헬퍼: `src/lib/passport-db-helpers.ts`
- 예제: `src/app/api/passport/encryption-example-route.ts`
- 테스트: `src/lib/passport-encryption.test.ts`, `src/lib/passport-sms.test.ts`

### 관련 모델
- `GmPassportSubmissionGuest` — 여권번호 저장 모델
- `GmPassportSubmission` — 제출 요청
- `GmPassportRequestLog` — 요청 로그

### Prisma 마이그레이션
- `migrations/20260606120001_guest_passport_partial_uq` — 부분 UNIQUE 인덱스
