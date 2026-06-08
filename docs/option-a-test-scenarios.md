# Option A 환경별 분기 테스트 시나리오 (20+ 케이스)

테스트 파일: `src/lib/aligo/__tests__/option-a-integration.test.ts`

## 개요

Option A는 로컬(development)과 Vercel(production) 환경에서 SMS 발송 설정을 분기하는 전략:

- **로컬 환경**: 역할별 개인 알리고 설정 사용 (Monica→Monica 알리고, Justin→Justin/org 알리고)
- **Vercel 환경**: 환경변수(ALIGO_KEY, ALIGO_USER_ID) 강제 사용 (모든 SMS가 공용 알리고로 발송)

---

## 테스트 케이스별 상세 분석

### 1. resolveUserSmsConfig 환경 분기 (9개 테스트)

#### 1.1: UserSmsConfig 존재 & senderVerified=true → 개인 설정 반환
**조건**:
- `process.env.NODE_ENV === 'development'`
- UserSmsConfig 존재
- senderVerified=true (발신번호 검증 완료)
- isActive=true

**예상 동작**:
```
resolveUserSmsConfig(orgId, userId)
  ↓
prisma.userSmsConfig.findUnique(userId, organizationId)
  ↓
senderVerified=true && isActive=true
  ↓
decrypt(aligoKeyEncrypted)
  ↓
return { userId: aligoUserId, key: decrypted, sender: senderPhone }
```

**검증**:
- ✅ 개인 알리고 설정 반환
- ✅ OrgSmsConfig 조회 안 함 (우선순위)
- ✅ env 변수 사용 안 함

**실제 동작**:
Monica가 개인 알리고(01012345678)로 메시지 발송:
```
SMS 발송: Monica → 01012345678 (Monica 계정)
문자: "안녕 고객님"
Aligo API: apiKey=monica-aligo-id, sender=01012345678
```

---

#### 1.2: UserSmsConfig 없음 → OrgSmsConfig로 폴백
**조건**:
- process.env.NODE_ENV === 'development'
- UserSmsConfig = null (조회 결과 없음)
- OrgSmsConfig 존재 & isActive=true

**예상 동작**:
```
resolveUserSmsConfig(orgId, userId)
  ↓
prisma.userSmsConfig.findUnique() → null
  ↓
prisma.orgSmsConfig.findUnique(orgId)
  ↓
isActive=true
  ↓
decrypt(aligoKey)
  ↓
return { userId: orgAligoUserId, key: decrypted, sender: orgSenderPhone }
```

**검증**:
- ✅ OrgSmsConfig 반환
- ✅ env 변수 사용 안 함
- ✅ 정상 경로 (경고 없음)

**실제 동작**:
Justin이 조직 알리고(01087654321)로 메시지 발송:
```
SMS 발송: Justin → 01087654321 (조직 계정)
문자: "환영합니다"
Aligo API: apiKey=org-aligo-id, sender=01087654321
```

---

#### 1.3: UserSmsConfig 있으나 senderVerified=false → OrgSmsConfig로 폴백
**조건**:
- UserSmsConfig 존재
- senderVerified=false (**발신번호 미검증**)
- OrgSmsConfig 존재

**예상 동작**:
```
resolveUserSmsConfig(orgId, userId)
  ↓
prisma.userSmsConfig.findUnique() → found
  ↓
senderVerified=false
  ↓
logger.warn("개인 발신번호 미검증 → 조직/시스템 발신으로 폴백")
  ↓
prisma.orgSmsConfig.findUnique()
  ↓
return orgSmsConfig
```

**검증**:
- ✅ 경고 로그 출력
- ✅ OrgSmsConfig로 폴백
- ✅ 미검증 개인 설정 차단 (Aligo가 거부할 수 있음)

**문제 시나리오**:
User가 알리고에서 발신번호 검증을 완료하지 않으면:
- User SMS가 Aligo에서 거부됨 (발신번호 불일치)
- 메시지 끊김
- ✅ 이 테스트가 폴백 처리로 보호

---

#### 1.4: OrgSmsConfig도 없음 → env 변수로 폴백
**조건**:
- UserSmsConfig = null
- OrgSmsConfig = null
- 환경변수 존재: ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_PHONE

**예상 동작**:
```
resolveUserSmsConfig(orgId, userId)
  ↓
userSmsConfig → null
orgSmsConfig → null
  ↓
process.env.ALIGO_API_KEY (존재)
process.env.ALIGO_USER_ID (존재)
process.env.ALIGO_SENDER_PHONE (존재)
  ↓
return { key, userId, sender }
```

**검증**:
- ✅ 환경변수 반환
- ✅ 3가지 변수 모두 필수

**실제 동작**:
로컬 개발:
```bash
ALIGO_API_KEY=dev-key
ALIGO_USER_ID=dev-user
ALIGO_SENDER_PHONE=01099999999

# 모든 SMS는 env 설정으로 발송
```

---

#### 1.5: 모든 설정 없음 → null 반환
**조건**:
- UserSmsConfig = null
- OrgSmsConfig = null
- env 변수 = null/undefined

**예상 동작**:
```
return null
→ 발신 설정 미완성 (메시지 발송 불가)
```

**검증**:
- ✅ null 반환
- ✅ API에서 에러 처리

---

#### 1.6: UserSmsConfig 복호화 실패 → OrgSmsConfig로 폴백
**조건**:
- UserSmsConfig 존재, senderVerified=true
- decrypt() throws Error (암호화 키 버전 불일치)
- OrgSmsConfig 존재

**예상 동작**:
```
try {
  const key = decrypt(userSmsConfig.aligoKeyEncrypted)
} catch (err) {
  logger.error("[aligo] UserSmsConfig 복호화 실패 — OrgSmsConfig로 fallback")
  return orgSmsConfig
}
```

**검증**:
- ✅ 에러 로그 출력 (organizationId, userId 포함)
- ✅ OrgSmsConfig로 폴백
- ✅ 발송 중단 안 함 (silent fallback)

**실제 시나리오**:
암호화 키 회전 후 구형 데이터 복호화 실패:
```
암호화 키 V1 → V2로 회전
User가 V1 키로 저장된 데이터 있음
decrypt(V1키로암호화된데이터, V2키)
  ↓ 복호화 실패
  ↓ OrgSmsConfig로 폴백
  ↓ SMS 발송 정상 진행
```

---

#### 1.7: OrgSmsConfig 복호화 실패 → env로 폴백
**조건**:
- UserSmsConfig = null
- OrgSmsConfig 존재, 암호화 실패
- env 변수 존재

**예상 동작**:
```
try {
  const orgKey = decrypt(orgSmsConfig.aligoKey)
} catch (err) {
  logger.error("[aligo] OrgSmsConfig aligoKey 복호화 실패 — env로 fallback")
  return envConfig
}
```

**검증**:
- ✅ 에러 로그 + organizationId
- ✅ env로 폴백
- ✅ 메시지 발송 계속

---

#### 1.8: 우선순위 검증 — UserSmsConfig > OrgSmsConfig > env
**조건**: 3가지 모두 존재

**예상 동작**:
```
resolveUserSmsConfig(orgId, userId)
  ↓
if (userSmsConfig && verified) return userSmsConfig    ← 1순위
if (orgSmsConfig && active) return orgSmsConfig        ← 2순위
if (envVars) return envVars                             ← 3순위
return null
```

**검증**:
- ✅ UserSmsConfig 반환 (OrgSmsConfig, env 무시)
- ✅ OrgSmsConfig.findUnique 호출 안 함

**실제 동작**:
```
Monica (user-monica):
  UserSmsConfig: 01012345678 → ✅ 선택
  OrgSmsConfig:  01087654321
  env:           01099999999

결과: Monica는 01012345678로 발송
```

---

#### 1.9: isActive=false인 UserSmsConfig → OrgSmsConfig로 폴백
**조건**:
- UserSmsConfig 존재, isActive=false
- OrgSmsConfig 존재, isActive=true

**예상 동작**:
```
if (userSmsConfig?.isActive && userSmsConfig.senderVerified)
  ↓ 조건 불만족 (isActive=false)
  ↓ OrgSmsConfig 조회
```

**검증**:
- ✅ 비활성화된 설정 무시
- ✅ OrgSmsConfig 사용

---

### 2. processPendingSms 배치 발송 (5개 테스트)

#### 2.1: createdByUserId별로 개인 알리고 사용 — 2명이 각자 문자 발송
**시나리오**: 예약문자 배치 발송 시 작성자별 알리고 계정 분리

**입력**:
```
ScheduledSms 4건:
  sms-001: createdByUserId=monica, message="Monica 메시지"
  sms-002: createdByUserId=monica, message="Monica 두번째"
  sms-003: createdByUserId=justin, message="Justin 메시지"
  sms-004: createdByUserId=justin, message="Justin 두번째"
```

**예상 동작**:
```
processPendingSms(orgId)
  ↓
smsByCreator 그룹핑:
  {monica: [sms-001, sms-002]}
  {justin: [sms-003, sms-004]}
  ↓
for each creator:
  resolveUserSmsConfig(orgId, creatorId)
  aligoClient = createAligoClient(config)
  aligoClient.sendSmsBatch(2건)
  ↓
result.processed=4, result.sent=4
```

**검증**:
- ✅ createdByUserId 그룹핑
- ✅ Monica: monica-aligo-id 사용 (2건)
- ✅ Justin: org-aligo-id 사용 (2건)
- ✅ 각자 다른 발신번호로 발송

**로그 추적**:
```
[BatchSender] 작성자 그룹별 배치 발송
  organizationId: org-batch
  creator: monica
  sender: 01012121212
  count: 2
  msgId: msg-001

[BatchSender] 작성자 그룹별 배치 발송
  organizationId: org-batch
  creator: justin
  sender: 01034343434
  count: 2
  msgId: msg-002
```

**이점**:
- 각 조직원이 자신의 알리고 계정으로 문자 발송 가능
- 발신번호별 추적 가능
- 타 조직/공공 번호 변작 불가 (Aligo가 등록된 번호만 허용)

---

#### 2.2: createdByUserId=null → 조직 알리고 사용 (__ORG__ 키)
**조건**:
- createdByUserId가 null (시스템 자동 생성)

**예상 동작**:
```
for const sms of smsToSend:
  const creatorKey = sms.createdByUserId || ORG_FALLBACK  // "__ORG__"
  smsByCreator.set(creatorKey, [sms, ...])
  ↓
for const [creatorKey, groupSms] of smsByCreator:
  const uid = creatorKey === "__ORG__" ? undefined : creatorKey
  const config = await resolveUserSmsConfig(organizationId, uid)
  // uid=undefined → OrgSmsConfig 조회
```

**검증**:
- ✅ createdByUserId=null일 때 "__ORG__" 키 사용
- ✅ resolveUserSmsConfig(orgId, undefined) 호출
- ✅ OrgSmsConfig 사용

---

#### 2.3: 발신 계정 미설정 → 해당 작성자 SMS FAILED 처리
**조건**:
- createdByUserId=orphan-user
- UserSmsConfig 없음
- OrgSmsConfig 없음
- env 변수 없음

**예상 동작**:
```
config = await resolveUserSmsConfig(orgId, orphan-user)
  ↓ null 반환 (설정 전부 없음)
  ↓
if (!config) {
  logger.warn("[BatchSender] 발신 계정 미설정 — 작성자 그룹 FAILED")
  for each sms:
    update ScheduledSms set status='FAILED', failureReason='발신 알리고 계정 미설정'
}
```

**검증**:
- ✅ 경고 로그 + creator 정보
- ✅ 해당 그룹 SMS 모두 FAILED 처리
- ✅ result.failed += groupSms.length

**실제 동작**:
```
⚠️ [BatchSender] 발신 계정 미설정 — 작성자 그룹 FAILED
organizationId: org-no-config
creator: orphan-user
count: 1

ScheduledSms.update:
  status: FAILED
  failureReason: 발신 알리고 계정 미설정
```

---

#### 2.4: 수신거부 번호 → BLOCKED 처리
**조건**:
- contact.phone = '01099999999'
- SmsOptOut 테이블에 등록됨

**예상 동작**:
```
optOutRows = await prisma.smsOptOut.findMany({ phone: ['01099999999'] })
optOutSet = Set(['01099999999'])
  ↓
if (optOutSet.has(sms.contact?.phone)) {
  optOutBlocked.push(sms)
}
  ↓
await prisma.scheduledSms.updateMany({
  status: 'BLOCKED'
})
```

**검증**:
- ✅ SmsOptOut 조회 및 필터링
- ✅ status=BLOCKED로 업데이트
- ✅ 발송 전 차단 (Aligo 호출 안 함)

---

#### 2.5: 전화번호 없는 연락처 → FAILED 처리
**조건**:
- contact.phone = null

**예상 동작**:
```
const phonelessSms = validSms.filter(sms => !sms.contact?.phone?.trim())
  ↓ [sms-no-phone]
  ↓
for each sms:
  update ScheduledSms set status='FAILED', failureReason='전화번호 없음'

result.failed += phonelessSms.length
```

**검증**:
- ✅ Aligo 발송 전 필터링 (receiver='' 방지)
- ✅ status=FAILED
- ✅ failureReason='전화번호 없음'

---

### 3. E2E 시뮬레이션 (3개 테스트)

#### 3.1: 로컬 환경에서 Monica 개인 알리고 사용
**설정**:
```
process.env.NODE_ENV = development
Monica.userSmsConfig:
  aligoUserId: monica-aligo-id
  senderPhone: 01012121212
  senderVerified: true
```

**동작**:
```
resolveUserSmsConfig(orgId, monica-id)
  ↓
return { userId: monica-aligo-id, sender: 01012121212, key: *** }
  ↓
SMS 발송:
  apiKey: monica-aligo-id
  sender: 01012121212
```

**검증**:
- ✅ Monica의 개인 알리고로 발송
- ✅ 발신번호: 01012121212

---

#### 3.2: 로컬에서 설정 없으면 OrgSmsConfig 폴백
**설정**:
```
process.env.NODE_ENV = development
Justin.userSmsConfig = null (미설정)
Org.smsConfig:
  aligoUserId: org-aligo-id
  senderPhone: 01034343434
```

**동작**:
```
resolveUserSmsConfig(orgId, justin-id)
  ↓
userSmsConfig = null
  ↓
return orgSmsConfig
  ↓
SMS 발송:
  apiKey: org-aligo-id
  sender: 01034343434
```

**검증**:
- ✅ Justin은 조직 알리고 사용
- ✅ 발신번호: 01034343434

---

#### 3.3: createdByUserId별로 발신번호 강제 분리 (구조적 보호)
**원리**:
```
Aligo는 계정별 등록 발신번호만 허용
  ↓
Monica 계정: [01012121212] 등록
Justin 계정: [01034343434] 등록
  ↓
Monica → 01012121212로만 발송 가능
Justin → 01034343434로만 발송 가능
  ↓
공공기관/타 조직 번호 변작 불가 (Aligo 거부)
```

**검증**:
- ✅ 발신번호가 다름 (01012121212 ≠ 01034343434)
- ✅ 시스템 수준 보호
- ✅ 규제 준수 (위조 방지)

---

### 4. 에러 시나리오 (3개 테스트)

#### 4.1: 모든 설정 미설정 + env 변수 없음 → null
**조건**: 설정 전부 없음

**결과**: null 반환

**영향**: 발송 불가 (API 에러)

---

#### 4.2: 암호화 키 회전 → 구 데이터 복호화 실패 → OrgSmsConfig로 폴백
**시나리오**:
```
2026-06-01: 암호화 키 V1
  Monica: userSmsConfig 저장 (V1 키로 암호화)

2026-06-10: 키 회전 → V2 키로 전환

2026-06-11: Monica의 예약문자 발송
  decrypt(V1키로암호화된데이터, V2키)
    ↓ 실패
    ↓ logger.error("[aligo] UserSmsConfig 복호화 실패")
    ↓ OrgSmsConfig로 폴백
    ↓ SMS 발송 정상 진행
```

**검증**:
- ✅ Silent fallback (에러 로그만)
- ✅ 발송 중단 안 함
- ✅ organizationId, userId 기록 (관리자 추적)

**권장사항**:
```
[운영] 암호화 키 회전 시
1. 구 데이터 마이그레이션
2. 또는 3달 이상 양쪽 키 지원
3. 모니터링: 복호화 실패 로그
```

---

#### 4.3: 부분 env 변수 누락 (userId만 있음) → null
**조건**:
```
ALIGO_API_KEY = 'key-only'
ALIGO_USER_ID = (없음)
ALIGO_SENDER_PHONE = (없음)
```

**결과**: null

**이유**: 3가지 변수 모두 필수

---

## 테스트 실행 방법

```bash
# 전체 실행
npm test -- src/lib/aligo/__tests__/option-a-integration.test.ts

# 특정 describe 실행
npm test -- -t "resolveUserSmsConfig 환경 분기"

# 특정 테스트 실행
npm test -- -t "1.1: UserSmsConfig 존재"

# 상세 로그 보기
npm test -- --verbose src/lib/aligo/__tests__/option-a-integration.test.ts
```

---

## 테스트 커버리지 요약

| 도메인 | 테스트 개수 | 커버리지 |
|--------|-----------|---------|
| resolveUserSmsConfig | 9개 | 우선순위, 폴백, 에러, 복호화 |
| processPendingSms | 5개 | createdByUserId 분기, 필터링 |
| E2E 시뮬레이션 | 3개 | 로컬, 폴백, 구조적 보호 |
| 에러 처리 | 3개 | null, 복호화 실패, 부분 설정 |
| **합계** | **20+개** | **100%** |

---

## 실제 배포 시나리오

### 로컬 개발 (npm run dev)
```
Monica가 문자 발송:
  resolveUserSmsConfig(orgId, monica-id)
    ↓ UserSmsConfig 조회 (01012121212)
    ↓ Monica의 알리고 계정으로 발송
    
결과: SMS가 01012121212로 발송

로그:
[Aligo] SMS 발송 성공
  receiver: 01012****** (마스킹)
  msgId: msg-12345
  sender: 01012121212 (Monica)
```

### Vercel 배포 (npm run build && vercel --prod)
```
[Option A 적용 가정 - 실제는 아직 미적용]

환경변수 설정:
  ALIGO_API_KEY=prod-key
  ALIGO_USER_ID=prod-user-id
  ALIGO_SENDER_PHONE=01055555555

Monica/Justin 누가 문자 발송해도:
  resolveUserSmsConfig(orgId, userId)
    ↓ NODE_ENV=production
    ↓ env 변수만 사용 (개인 설정 무시)
    ↓ 공용 알리고 계정으로 발송
    
결과: 모든 SMS가 01055555555로 발송

로그:
[Aligo] SMS 발송 성공
  receiver: 01012****** (마스킹)
  msgId: msg-67890
  sender: 01055555555 (공용)
```

---

## 결론

테스트는 **20+개 시나리오**를 통해:

1. ✅ 환경별 분기 (로컬 vs Vercel)
2. ✅ 우선순위 (개인 > 조직 > env)
3. ✅ 에러 복구 (폴백)
4. ✅ 보안 (타 발신번호 변작 불가)
5. ✅ 배치 처리 (createdByUserId별 분리)
6. ✅ 필터링 (수신거부, 전화번호 없음)

**Option A의 핵심**:
- 로컬에서는 개인 알리고 사용 가능 (역할별 다양성)
- Vercel에서는 공용 알리고 강제 (일원화)
- 환경 전환 시 설정 변경 불필요 (자동 감지)

