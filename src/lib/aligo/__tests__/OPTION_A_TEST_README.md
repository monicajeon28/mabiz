# Option A Integration Test — Quick Start

## 📍 파일 위치

```
src/lib/aligo/__tests__/option-a-integration.test.ts (724줄)
```

## 🚀 빠른 시작

### 모든 테스트 실행
```bash
npm test -- src/lib/aligo/__tests__/option-a-integration.test.ts
```

### 특정 블록만 실행
```bash
# resolveUserSmsConfig 테스트만
npm test -- -t "resolveUserSmsConfig 환경 분기"

# processPendingSms 테스트만
npm test -- -t "processPendingSms 배치 발송"

# 특정 테스트 1개
npm test -- -t "1.1: UserSmsConfig 존재"
```

### Watch 모드
```bash
npm test -- --watch src/lib/aligo/__tests__/option-a-integration.test.ts
```

---

## 📊 테스트 구조

```
21개 테스트 케이스

[Option A] resolveUserSmsConfig 환경 분기 (9개)
  ├─ 1.1: UserSmsConfig 존재 → 개인 설정
  ├─ 1.2: UserSmsConfig 없음 → OrgSmsConfig
  ├─ 1.3: senderVerified=false → OrgSmsConfig
  ├─ 1.4: OrgSmsConfig 없음 → env
  ├─ 1.5: 모든 설정 없음 → null
  ├─ 1.6: UserSmsConfig 복호화 실패 → OrgSmsConfig
  ├─ 1.7: OrgSmsConfig 복호화 실패 → env
  ├─ 1.8: 우선순위 검증
  └─ 1.9: isActive=false 무시

[Option A] processPendingSms 배치 발송 (5개)
  ├─ 4.1: createdByUserId별 알리고 분리
  ├─ 4.2: createdByUserId=null → 조직 알리고
  ├─ 4.3: 발신 계정 미설정 → FAILED
  ├─ 4.4: 수신거부 번호 → BLOCKED
  └─ 4.5: 전화번호 없음 → FAILED

[Option A] E2E 시뮬레이션 (3개)
  ├─ 3.1: 로컬 Monica 개인 알리고
  ├─ 3.2: 로컬 설정 없으면 폴백
  └─ 3.3: 구조적 보호 (타 발신번호 변작 불가)

[Option A] 에러 시나리오 (3개)
  ├─ 6.1: 모든 설정 없음
  ├─ 6.2: 암호화 키 회전
  └─ 6.3: 부분 env 변수

[Option A] 통합 테스트 (1개)
  └─ 검증 완료 선언
```

---

## 🎯 핵심 검증 항목

### 1. 우선순위 (우선순위순)
```
1️⃣ UserSmsConfig (senderVerified=true && isActive=true)
2️⃣ OrgSmsConfig (isActive=true)
3️⃣ 환경변수 (ALIGO_API_KEY + ALIGO_USER_ID + ALIGO_SENDER_PHONE)
❌ null (설정 없음)
```

### 2. 환경 분기 (NODE_ENV)
```
development  → 개인/조직 설정 사용 (역할별 다양성)
production   → env 변수만 사용 (일원화)
```

### 3. 배치 발송
```
processPendingSms(orgId)
  ↓
createdByUserId별 그룹핑
  ↓
각 그룹별 resolveUserSmsConfig(orgId, creatorId)
  ↓
개별 Aligo 클라이언트로 발송
```

### 4. 필터링
```
수신거부 (SmsOptOut) → BLOCKED
전화번호 없음 → FAILED (Aligo 호출 전)
```

---

## 📋 Mock 객체

```typescript
prisma.userSmsConfig.findUnique()
prisma.orgSmsConfig.findUnique()
prisma.scheduledSms.findMany()
prisma.scheduledSms.update()
prisma.scheduledSms.updateMany()
prisma.contact.findMany()
prisma.smsOptOut.findMany()
prisma.smsLog.create()
prisma.$transaction()

logger.log() / logger.warn() / logger.error()

decrypt(encryptedValue, key) → 'decrypted-{encryptedValue}'

createAligoClient(config) → { sendSmsBatch(), sendSms() }
```

---

## 🔍 예제: 테스트 케이스 1.1

```typescript
it('1.1: UserSmsConfig 존재 & senderVerified=true → 개인 설정 반환', async () => {
  const orgId = 'org-001';
  const userId = 'user-monica';

  // Mock UserSmsConfig
  (prisma.userSmsConfig.findUnique as jest.Mock).mockResolvedValueOnce({
    userId,
    organizationId: orgId,
    aligoUserId: 'monica-aligo-id',
    aligoKeyEncrypted: 'monica-key-encrypted',
    senderPhone: '01012345678',
    senderVerified: true,  // ✅ 검증 완료
    isActive: true,        // ✅ 활성화
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Mock decrypt
  const { decrypt } = await import('@/lib/crypto');
  (decrypt as jest.Mock).mockReturnValueOnce('decrypted-monica-key-encrypted');

  // 호출
  const result = await resolveUserSmsConfig(orgId, userId);

  // 검증
  expect(result).toEqual({
    userId: 'monica-aligo-id',
    key: 'decrypted-monica-key-encrypted',
    sender: '01012345678',
  });
});
```

---

## 📝 테스트 작성 시 주의사항

### 1. Mock 초기화
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ALIGO_API_KEY;
  delete process.env.ALIGO_USER_ID;
  delete process.env.ALIGO_SENDER_PHONE;
  process.env.NODE_ENV = 'development';
});
```

### 2. 환경변수 설정
```typescript
// 환경변수 테스트
process.env.ALIGO_API_KEY = 'env-key-value';
process.env.ALIGO_USER_ID = 'env-user-id';
process.env.ALIGO_SENDER_PHONE = '01099999999';

// 정리
delete process.env.ALIGO_API_KEY;
```

### 3. Mock 체인
```typescript
// resolve 반환값 설정
(prisma.userSmsConfig.findUnique as jest.Mock).mockResolvedValueOnce({...});

// 여러 호출 순서
(decrypt as jest.Mock)
  .mockReturnValueOnce('first')
  .mockReturnValueOnce('second');
```

---

## 📌 배포 전 체크리스트

- [ ] 로컬 개발: `npm test -- option-a` 모두 통과
- [ ] Vercel 배포 전: env 변수 설정 확인
  - [ ] ALIGO_API_KEY (공용)
  - [ ] ALIGO_USER_ID (공용)
  - [ ] ALIGO_SENDER_PHONE (공용)
- [ ] 개인 알리고 설정 (선택)
  - [ ] UserSmsConfig 테이블 확인
  - [ ] senderVerified 상태 확인
- [ ] 조직 알리고 설정
  - [ ] OrgSmsConfig 존재
  - [ ] isActive=true
- [ ] 모니터링
  - [ ] 로그: [aligo] 메시지 추적
  - [ ] 발신번호별 통계

---

## 🐛 문제 해결

### 테스트 실패: "Cannot read properties of undefined"
```
원인: 이전 테스트에서 Mock이 복구되지 않음
해결: beforeEach에서 jest.clearAllMocks() 추가
```

### 환경변수 남아있음
```
원인: 이전 테스트에서 delete하지 않음
해결: afterEach에서 모든 env 변수 정리
```

### 복호화 테스트 실패
```
원인: decrypt Mock이 여러 번 호출되는데 한 번만 설정
해결: mockReturnValueOnce가 아닌 mockReturnValue 또는 
      여러 호출에 대해 순서대로 설정
```

---

## 📖 참고 자료

**상세 시나리오**:
→ `docs/option-a-test-scenarios.md`

**전체 보고서**:
→ `docs/OPTION_A_TEST_SUMMARY.md`

**구현 코드**:
→ `src/lib/aligo.ts` (resolveUserSmsConfig)
→ `src/lib/aligo/batch-sender.ts` (processPendingSms)

---

## 💡 Tips

### 개별 테스트 디버깅
```bash
# 특정 테스트만 실행
npm test -- -t "1.1"

# 콘솔 출력 보기
npm test -- --verbose

# 로그 추적
npm test -- -t "1.1" --logHeapUsage
```

### 모든 Mock 호출 확인
```typescript
// 테스트 마지막에
console.log(prisma.userSmsConfig.findUnique.mock.calls);
```

### Mock 호출 횟수 검증
```typescript
expect(prisma.userSmsConfig.findUnique).toHaveBeenCalledTimes(1);
expect(prisma.orgSmsConfig.findUnique).not.toHaveBeenCalled();
```

---

## ✅ 완료 체크

- [x] 테스트 파일 생성 (23KB)
- [x] 21개 테스트 케이스
- [x] Mock 설정 5개
- [x] 환경 분기 검증
- [x] 우선순위 검증
- [x] 폴백 처리
- [x] 배치 발송 분기
- [x] 필터링
- [x] E2E 시뮬레이션
- [x] 에러 처리
- [x] 보안 검증
- [x] 문서화 (400+ 줄)

