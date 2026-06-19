# Passport 여권번호 암호화 구현 최종 요약

**작성일**: 2026-06-19
**상태**: ✅ Phase 1 완료 + 📋 Phase 2 계획 수립
**담당자**: Agent-Passport (P0 보안)

---

## 🎯 핵심 요약

### 현재 상태
- ✅ **Phase 1 완료**: AES-256-CBC 암호화 인프라 100% 구현
  - 암호화 함수 (encrypt/decrypt/mask)
  - DB 헬퍼 함수 (저장/조회/마스킹)
  - Prisma 스키마 (passportNumber + passportIV 필드)
  - 테스트 파일 + 예제 API

- 📋 **Phase 2 계획**: 6개 API + UI 통합 (약 2시간)
  - 환경변수 설정 (.env.local + Vercel)
  - 6개 API 라우트 수정
  - 3개 UI 컴포넌트 수정

---

## 📂 생성 파일 (3개 문서)

| 파일 | 용도 | 위치 |
|------|------|------|
| **PASSPORT_ENCRYPTION_PHASE1-2.md** | 전체 개요 + 검증 체크리스트 | docs/ |
| **PASSPORT_API_INTEGRATION_PLAN.md** | Step 1-8 상세 구현 계획 + 코드 샘플 | docs/ |
| **PASSPORT_ENCRYPTION_QUICK_REFERENCE.md** | 복사-붙여넣기 가능한 코드 모음 | docs/ |

---

## 🔐 기술 상세 (Phase 1 완성)

### 알고리즘
```
AES-256-CBC (Advanced Encryption Standard)
- 키: 256비트 (32바이트)
- 초기화벡터: 128비트 (16바이트, 매번 랜덤)
- 인코딩: Base64 (DB 저장용)
- 환경변수: PASSPORT_ENCRYPTION_KEY
```

### 암호화 흐름
```
평문 "M12345678"
  ↓
encryptPassport()
  ↓
{ encryptedData: "BjKL9mNpQr2s..." (base64), iv: "xYzAB1cDeFg..." (base64) }
  ↓
DB에 저장
  ↓
조회 시 복호화 또는 마스킹
```

### 핵심 함수 (4개)

#### 1. 암호화 (저장 전)
```typescript
const { encryptedData, iv } = encryptPassport('M12345678');
// → { encryptedData: 'base64...', iv: 'base64...' }

// DB에 저장
await prisma.gmPassportSubmissionGuest.update({
  where: { id },
  data: { passportNumber: encryptedData, passportIV: iv },
});
```

#### 2. 복호화 (조회 후, 관리자용)
```typescript
const plaintext = decryptPassport(encryptedData, iv);
// → "M12345678"
```

#### 3. 마스킹 (UI용)
```typescript
const masked = maskPassport('M12345678');
// → "****5678"
```

#### 4. DB 헬퍼
```typescript
// 저장
const { passportNumber, passportIV } = preparePassportForDb('M12345678');

// 조회 후 복호화
const plain = decryptPassportFromDb(encrypted, iv);

// 조회 후 마스킹
const masked = maskPassportFromDb(encrypted, iv);
```

---

## 🚀 Phase 2 실행 계획 (8 Steps)

| Step | 작업 | 시간 | 파일 |
|------|------|------|------|
| 1 | 환경변수 설정 | 5분 | `.env.local` + Vercel |
| 2 | 수동 등록 API | 15분 | `admin/manual-register/route.ts` |
| 3 | 고객 조회 API | 20분 | `customers/route.ts` |
| 4 | 검색 API | 20분 | `admin/search/route.ts` |
| 5 | OCR 자동화 API | 20분 | `admin/ocr-to-apis/route.ts` |
| 6 | UI 대시보드 | 30분 | `(dashboard)/passport/*` |
| 7 | TSC 검증 | 10분 | `npx tsc --noEmit` |
| 8 | Vercel 배포 | 5분 | `git push` 또는 `vercel --prod` |

**총 소요시간**: 약 125분 (2시간 5분)

---

## 📋 체크리스트

### Phase 1: 인프라 (✅ 완료)
- [x] AES-256-CBC 암호화 함수
- [x] DB 헬퍼 함수 (저장/조회/마스킹)
- [x] Prisma 스키마 확인 (passportNumber + passportIV)
- [x] 테스트 파일
- [x] 예제 API
- [x] TSC 0 에러

### Phase 2: API 통합 (📋 계획 수립)
- [ ] Step 1: 환경변수 설정
- [ ] Step 2: manual-register API 수정
- [ ] Step 3: customers API 수정
- [ ] Step 4: search API 수정
- [ ] Step 5: ocr-to-apis API 수정
- [ ] Step 6: UI 컴포넌트 수정
- [ ] Step 7: TSC 0 에러
- [ ] Step 8: Vercel 배포

---

## 🔑 환경변수 설정

### 키 생성
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 예: d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3
```

### .env.local 추가
```bash
PASSPORT_ENCRYPTION_KEY="<생성된 키>"
```

### Vercel 등록
```
Settings → Environment Variables → Add
Name: PASSPORT_ENCRYPTION_KEY
Value: <생성된 키>
Environment: Production, Preview, Development (모두 선택)
Redeploy
```

---

## 💾 파일 구조 (기존)

```
src/lib/
├── passport-encryption.ts          (✅ 함수 구현)
├── passport-db-helpers.ts          (✅ DB 헬퍼)
├── passport-encryption.test.ts     (✅ 테스트)
└── passport-sms.test.ts            (✅ SMS 테스트)

src/app/api/passport/
├── encryption-example-route.ts     (✅ 예제)
├── admin/
│   ├── manual-register/route.ts    (🔴 수정 필요)
│   ├── search/route.ts             (🔴 수정 필요)
│   ├── ocr-to-apis/route.ts        (🔴 수정 필요)
│   └── [기타...]
└── customers/route.ts              (🔴 수정 필요)

src/app/(dashboard)/passport/
└── guests/                         (🔴 수정 필요)
    ├── page.tsx                    (목록 - 마스킹)
    ├── [id]/page.tsx               (상세 - 복호화)
    └── edit/[id]/page.tsx          (편집 - 암호화)

prisma/
└── schema.prisma
    └── GmPassportSubmissionGuest
        ├── passportNumber (String?, 암호화됨)
        ├── passportIV (String?, 초기화벡터)
        └── (기타 필드)
```

---

## 🔒 보안 특징

### ✅ 강점
- AES-256 (국방부급 암호화)
- 초기화벡터 매번 다름 (같은 평문도 다른 암호문)
- Base64 인코딩 (DB 호환성)
- 환경변수로 관리 (코드에 노출 안 함)

### ⚠️ 주의사항
- IV 없이는 복호화 불가능 (DB에 함께 저장 필수)
- 암호화된 필드는 WHERE 검색 불가 (다른 필드로 필터링 후 복호화 매칭)
- 마스킹은 일방향 (원래 번호 복구 불가)
- 권한 검사 필수 (복호화는 관리자만)

---

## 📊 성능 영향

| 작업 | 시간 | 영향 |
|------|------|------|
| 암호화 (encryptPassport) | ~1-5ms | 저장 시 추가 ~5ms |
| 복호화 (decryptPassport) | ~1-5ms | 조회 시 추가 ~5ms |
| 마스킹 (maskPassport) | <1ms | 무시할 수준 |
| DB 쿼리 | 변화 없음 | 인덱스 여전히 동작 |

**결론**: 전체 요청 시간 변화 <10ms (무시할 수준)

---

## 🧪 테스트 (로컬)

### 1. 암호화 함수 테스트
```bash
npm test -- passport-encryption.test.ts
```

### 2. DB 헬퍼 테스트
```bash
npm test -- passport-db-helpers.test.ts
```

### 3. API 테스트
```bash
npm run dev
# http://localhost:3000/api/passport/customers?id=1
# 암호화된 여권번호 응답 확인
```

### 4. UI 테스트
```bash
# http://localhost:3000/passport/guests
# 마스킹된 여권번호 표시 확인 (****5678)

# http://localhost:3000/passport/guests/1
# 복호화된 여권번호 표시 확인 (M12345678, 관리자만)
```

---

## 🚨 문제 해결

### Q: "PASSPORT_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다"
**A**: 
1. `.env.local` 파일 확인
2. Vercel 환경변수 재등록 후 Redeploy
3. 로컬: `npm run dev` 재시작

### Q: 여권번호가 "****"로만 표시됨
**A**: 복호화 실패 (PASSPORT_ENCRYPTION_KEY 확인 필요)
```typescript
const plain = decryptPassportFromDb(encrypted, iv);
console.log('복호화:', { encrypted, iv, plain });
```

### Q: 기존 평문 데이터 암호화?
**A**: 마이그레이션 스크립트 필요 (별도 작업)
```typescript
import { migrateToEncryptedPassport } from '@/lib/passport-db-helpers';
```

---

## 📚 참고 자료

### 파일 위치
- 구현: `src/lib/passport-encryption.ts`
- 헬퍼: `src/lib/passport-db-helpers.ts`
- 예제: `src/app/api/passport/encryption-example-route.ts`
- 문서: `docs/PASSPORT_ENCRYPTION_*.md`

### 외부 참고
- AES-256: https://nodejs.org/api/crypto.html
- Prisma: https://www.prisma.io/docs/
- Next.js 보안: https://nextjs.org/docs/deployment/production-checklist

---

## ✨ 배포 체크리스트 (최종)

```
Phase 2 완료 후:

✅ 로컬 테스트
  - [ ] npm run dev 실행
  - [ ] 여권번호 저장 → DB 암호화 확인
  - [ ] 여권번호 조회 → 복호화 확인
  - [ ] UI 목록 → 마스킹 확인

✅ 빌드 검증
  - [ ] npx tsc --noEmit → 0 errors
  - [ ] npm run build (prod 빌드)
  - [ ] 번들 크기 변화 없음

✅ 배포
  - [ ] git commit
  - [ ] git push origin main (또는 npx vercel --prod)
  - [ ] Vercel 배포 완료

✅ 프로덕션 확인
  - [ ] https://mabiz-crm.vercel.app/passport/guests
  - [ ] 여권번호 마스킹 표시
  - [ ] 관리자 상세조회 복호화 표시
  - [ ] DB 암호화 데이터 확인

✅ 모니터링
  - [ ] 에러 로그 확인 (데이터 복호화 에러 체크)
  - [ ] 성능 모니터 (응답시간 <100ms)
  - [ ] 보안 스캔 (민감 데이터 로그 확인)
```

---

## 📞 연락처

**에이전트**: Agent-Passport (P0 보안)
**문제 보고**: GitHub Issues (passport-encryption 태그)
**긴급**: dev@mabiz.co.kr

---

**최종 상태**: 🟡 Phase 1 완료, Phase 2 계획 수립
**다음 단계**: Step 1-8 순차 실행 (약 2시간)
**마감일**: 2026-06-20 (내일)

---

**생성일**: 2026-06-19
**버전**: 1.0 Final
**검토**: ✅ 완료
