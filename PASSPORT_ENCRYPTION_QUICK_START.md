# 여권번호 암호화 - 빠른 시작 (5분)

## 1단계: 키 생성 (30초)

```bash
node scripts/generate-passport-key.mjs
```

출력 예:
```
PASSPORT_ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef0123456789abcdef012345
```

## 2단계: 환경변수 설정 (30초)

### 개발 (.env.local)

`.env.local` 파일 끝에 추가:

```env
PASSPORT_ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef0123456789abcdef012345
```

### 배포 (Vercel)

```bash
vercel env add PASSPORT_ENCRYPTION_KEY
# 프롬프트에 위 값 붙여넣기
```

## 3단계: Prisma 업데이트 (1분)

```bash
npx prisma generate
```

## 4단계: API 적용 (3분)

### 저장하기

```typescript
import { preparePassportForDb } from '@/lib/passport-db-helpers';

const { passportNumber, passportIV } = preparePassportForDb('M12345678');

await prisma.gmPassportSubmissionGuest.create({
  data: {
    submissionId: 123,
    groupNumber: 1,
    name: '김철수',
    passportNumber,  // 암호화됨
    passportIV,      // 초기화벡터
  },
});
```

### 조회하기 (복호화)

```typescript
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: 123 },
  select: { passportNumber: true, passportIV: true },
});

const plainPassport = decryptPassportFromDb(guest.passportNumber, guest.passportIV);
console.log(plainPassport); // 'M12345678'
```

### 조회하기 (마스킹)

```typescript
import { maskPassportFromDb } from '@/lib/passport-db-helpers';

const maskedPassport = maskPassportFromDb(guest.passportNumber, guest.passportIV);
console.log(maskedPassport); // '****5678'
```

## 5단계: 검증 (1분)

```bash
npx tsc --noEmit
```

---

## 자주 묻는 질문

### Q. 암호화 키를 잃어버리면?
**A.** 그 순간부터 저장된 모든 여권번호는 복호화 불가능합니다. **절대 변경하지 마세요.**

### Q. 암호화 안 하고 평문 저장하고 싶으면?
**A.** 
```typescript
// ❌ 절대 금지!
await prisma.gmPassportSubmissionGuest.create({
  data: { passportNumber: 'M12345678' } // 위험!
});
```

### Q. 마스킹된 여권번호('****5678')로 역추적 가능?
**A.** 아니요. 마스킹은 단방향이므로 원래 번호 복원 불가능.

### Q. 1000명의 여권번호를 한번에 암호화하면?
**A.** ~100ms 소요. 우려 없음.

### Q. 암호화된 여권번호를 검색하려면?
**A.** 이름으로 먼저 필터링 후 앱 레벨에서 복호화해서 매칭:
```typescript
const candidates = await prisma.gmPassportSubmissionGuest.findMany({
  where: { submissionId: 123 },
  select: { passportNumber: true, passportIV: true },
});

const found = candidates.find(guest => {
  const decrypted = decryptPassportFromDb(guest.passportNumber, guest.passportIV);
  return decrypted === 'M12345678';
});
```

---

## 핵심 함수 3가지

| 함수 | 용도 | 사용 |
|------|------|------|
| `preparePassportForDb(평문)` | 저장 | `{ passportNumber, passportIV }` |
| `decryptPassportFromDb(암호화, IV)` | 조회 (원본) | `'M12345678'` |
| `maskPassportFromDb(암호화, IV)` | 조회 (마스킹) | `'****5678'` |

---

## 파일 위치

```
📄 src/lib/passport-encryption.ts        ← 핵심 함수
📄 src/lib/passport-db-helpers.ts        ← DB 헬퍼
📄 docs/passport-encryption-setup.md     ← 상세 가이드
📄 PASSPORT_ENCRYPTION_DESIGN.md         ← 설계 문서
🔧 scripts/generate-passport-key.mjs     ← 키 생성 도구
```

---

**준비 완료! 이제 API에 적용하세요.**
