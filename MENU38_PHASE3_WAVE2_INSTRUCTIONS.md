# Menu #38 Phase 3-β Wave 2: 작업 지시서

**세션 기준일**: 2026-05-19  
**검토 완료**: MENU38_PHASE3_CODE_REVIEW_BETA.md (코드 점수: 88/100)  
**배포 상태**: ✅ 배포 가능 (P0 블로커 없음)  
**다음 작업**: Hotfix 3건 → γ 트랙 병렬 진행

---

## Phase 3 전체 일정

```
Phase 3-β (현재)
├─ 코드 검토 ✅ COMPLETE
├─ Wave 2 (오늘) ← 당신은 여기
│  ├─ HF-1: TODO 주석 제거
│  ├─ HF-2: 에러 매핑 공통 추출
│  └─ HF-3: Feature Flag 중복 import 제거
│
Phase 3-γ (1주일 후)
├─ preloadedContact 최적화
├─ Rate Limiting 추가
├─ JSDoc 완성
└─ 에러 분류 개선

Phase 3-δ (2주일 후)
├─ DI 패턴 도입
├─ 단위 테스트 100% 커버리지
├─ E2E 테스트 작성
└─ 성능 벤치마크

Phase 3-ε (3주일 후) - 배포 준비
├─ Feature Flag 문서화
├─ 롤백 계획서
├─ 모니터링 대시보드
└─ Staging Full Load Test
```

---

## Wave 2 작업 (Hotfix 3건)

### HF-1: TODO 주석 제거 (5분)

**파일**: `src/lib/services/contact-template-sender.ts`

**현재 상태**:
```typescript
// Line 517
// TODO: lib/config/feature-flags.ts에서 로드
// 임시: 환경변수 또는 DB에서 읽기
const env = process.env[`FEATURE_${flagName}`] || "false";
return env === "true";
```

**문제**: 
- TODO가 이미 해결됨 (feature-flags.ts가 존재)
- execute-campaigns.ts는 올바르게 import하고 있음
- 자체 구현은 제거 대상

**작업**:
1. ✅ `getFeatureFlag()` 함수 전체 제거 (L516-521)
2. ✅ feature-flags.ts import 추가:
   ```typescript
   import { getFeatureFlag } from "../config/feature-flags";
   ```

**검증**:
```bash
# contact-template-sender.ts에서 getFeatureFlag 호출 확인
grep "getFeatureFlag" src/lib/services/contact-template-sender.ts
# → L141에서만 호출되어야 함
```

**예상 시간**: 5분

---

### HF-2: 에러 매핑 함수 공통 추출 (30분)

**목표**: `mapAligoErrorToFailureReason()` / `mapEmailErrorToFailureReason()` 중복 제거

**현재 상태**:
- `contact-template-sender.ts` L482-510 (자체 구현)
- `execute-campaigns.ts` L641-670 (기존 구현)
- 코드 100% 동일 → 유지보수 위험

**작업 순서**:

#### Step 1: 신규 파일 생성 (완료)
```bash
# 파일: src/lib/services/error-mapper.ts (이미 생성됨)
cat src/lib/services/error-mapper.ts
```

✅ 신규 파일에는 다음 함수 포함:
- `mapAligoErrorToFailureReason()`
- `mapEmailErrorToFailureReason()`
- `classifyErrorType()` (보너스)
- `getErrorMessage()` (보너스)

#### Step 2: contact-template-sender.ts 업데이트

**제거 대상** (L482-510):
```typescript
function mapAligoErrorToFailureReason(resultCode: number): SendingFailureReason { ... }
function mapEmailErrorToFailureReason(resultCode: number): SendingFailureReason { ... }
```

**추가** (L1-26 import 섹션에):
```typescript
import {
  mapAligoErrorToFailureReason,
  mapEmailErrorToFailureReason,
} from "./error-mapper";
```

**변경 사항**:
```typescript
// Before (L239)
failureReason: mapAligoErrorToFailureReason(smsResult.result_code),

// After (코드 동일, import만 변경)
failureReason: mapAligoErrorToFailureReason(smsResult.result_code),
```

#### Step 3: execute-campaigns.ts 업데이트

**제거 대상** (L641-670):
```typescript
function mapAligoErrorToFailureReason(resultCode: number): SendingFailureReason { ... }
function mapEmailErrorToFailureReason(resultCode: number): SendingFailureReason { ... }
```

**추가** (import 섹션에):
```typescript
import {
  mapAligoErrorToFailureReason,
  mapEmailErrorToFailureReason,
} from "../services/error-mapper";
```

**변경 사항**: 
- L243 (mapAligoErrorToFailureReason 호출)
- L276 (mapEmailErrorToFailureReason 호출)
- 코드 로직은 동일, import만 변경

#### Step 4: 검증

```bash
# 중복 확인 (결과가 없어야 함)
grep -n "function mapAligoErrorToFailureReason" \
  src/lib/services/contact-template-sender.ts \
  src/lib/cron/execute-campaigns.ts

# 올바른 import 확인
grep -n "from.*error-mapper" \
  src/lib/services/contact-template-sender.ts \
  src/lib/cron/execute-campaigns.ts

# TypeScript 컴파일 확인
npm run build 2>&1 | grep -i error
```

**예상 시간**: 30분

---

### HF-3: Feature Flag 중복 import 제거 (15분)

**목표**: contact-template-sender.ts의 자체 getFeatureFlag() 제거 (HF-1과 연관)

**현재 상태**:
- feature-flags.ts: 중앙화된 getFeatureFlag() ✅
- contact-template-sender.ts: 자체 구현 ❌ (중복)
- execute-campaigns.ts: 올바르게 import ✅

**작업**:

#### Step 1: contact-template-sender.ts 수정
```typescript
// Line 141 (현재 코드는 이미 정상)
const useExecutionLog = overrideFeatureFlag ?? getFeatureFlag("ENABLE_EXECUTION_LOG_WRAPPER");

// 이 getFeatureFlag는 현재 L516-521에서 정의됨
// HF-1에서 제거 예정이므로, import 추가 필요
```

**추가해야 할 import**:
```typescript
import { getFeatureFlag } from "../config/feature-flags";
```

**위치**: L1-26 import 섹션 (가장 뒤)

#### Step 2: 자체 구현 제거

L516-521 전체 제거:
```typescript
// ❌ 제거 대상
function getFeatureFlag(flagName: string): boolean {
  // TODO: lib/config/feature-flags.ts에서 로드
  // 임시: 환경변수 또는 DB에서 읽기
  const env = process.env[`FEATURE_${flagName}`] || "false";
  return env === "true";
}
```

#### Step 3: 검증

```bash
# contact-template-sender.ts에서 getFeatureFlag 정의 확인 (없어야 함)
grep -n "^function getFeatureFlag" src/lib/services/contact-template-sender.ts

# import 확인
grep "import.*getFeatureFlag" src/lib/services/contact-template-sender.ts
# → ../config/feature-flags에서만 import

# TypeScript 컴파일
npm run build
```

**예상 시간**: 15분

---

## Wave 2 검증 체크리스트

### 코드 변경 전

- [ ] 모든 파일을 읽어 현재 상태 파악
- [ ] 기존 단위 테스트 실행 (실패 없음)
  ```bash
  npm run test -- --testPathPattern="contact-template-sender" 2>&1 | tail -20
  ```

### HF-1 완료 후

- [ ] contact-template-sender.ts L516-521 제거 확인
- [ ] TODO 주석 모두 제거 확인
- [ ] import 섹션 정리 (불필요한 import 없음)
- [ ] npm run build 성공

### HF-2 완료 후

- [ ] error-mapper.ts 파일 확인 (존재)
- [ ] contact-template-sender.ts & execute-campaigns.ts에서 중복 함수 제거 확인
- [ ] import 문 추가 확인:
  ```bash
  grep "from.*error-mapper" src/lib/services/*.ts src/lib/cron/*.ts
  # 2개 파일에서만 나타나야 함
  ```
- [ ] npm run build 성공

### HF-3 완료 후

- [ ] feature-flags.ts import 추가 확인
- [ ] 자체 getFeatureFlag() 제거 확인
- [ ] L141 getFeatureFlag() 호출이 정상 동작하는지 확인
- [ ] npm run build 성공

### 전체 검증

```bash
# 1. 타입 체크
npm run type-check

# 2. 린트 (경고 없음)
npm run lint -- src/lib/services/contact-template-sender.ts src/lib/cron/execute-campaigns.ts

# 3. 빌드
npm run build

# 4. 기존 테스트 재실행
npm run test -- --testPathPattern="contact-template-sender|execute-campaign"

# 5. 변경 요약
git diff --stat
```

---

## Phase 3-γ 사전 준비 (다음 세션)

Wave 2 완료 후 즉시 시작할 수 있도록 사전 준비:

### γ-1: preloadedContact 최적화

**문제 식별**:
- 배치 처리 중: Contact 배치 로드 O
- 재시도 처리: Contact 개별 조회 O (비효율)

**해결 방법**:
```typescript
// execute-campaigns.ts retrySendingMessage() 함수
// 현재 L417-419: Contact 개별 조회
const contact = await db.contact.findUnique({ ... });

// 개선안: SendingHistory에 스냅샷 저장 후 재사용
// 또는 배치 재시도 처리
```

**파일**: `src/lib/cron/execute-campaigns.ts` (L393-459 retrySendingMessage 함수)

### γ-2: Rate Limiting 추가

**현재**: Aligo API 호출 시 제한 없음 → 속도 제한 위반 가능

**해결**: 배치 간 딜레이 추가
```typescript
// execute-campaigns.ts L86-122
for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
  if (i > 0) {
    // 배치 간 500ms 대기 (Aligo API 한도 고려)
    await new Promise(r => setTimeout(r, 500));
  }
  // ... 배치 처리
}
```

### γ-3: JSDoc 완성

**파일**: `src/lib/services/contact-template-sender.ts`

**대상 함수**:
- `sendToContactByTemplate()` - @param 추가
- `sendSmsInternal()` - JSDoc 추가
- `sendEmailInternal()` - JSDoc 추가
- `recordSendingHistory()` - @param 추가
- `recordExecutionLog()` - @param 추가

**템플릿**:
```typescript
/**
 * 함수 설명
 *
 * @param params.field1 - 필드 설명
 * @param params.field2 - 필드 설명 (선택)
 * @returns {Promise<ReturnType>} 반환값 설명
 *
 * @example
 * const result = await functionName({ ... });
 */
```

### γ-4: 에러 분류 개선

**파일**: `src/lib/services/contact-template-sender.ts` L178-185

**목표**: catch 블록에서 에러 타입 구분
```typescript
catch (err) {
  const errorType = classifyErrorType(err);
  logger.error("[Wrapper] ...", { errorType, ... });
}
```

**import 추가**:
```typescript
import { classifyErrorType } from "./error-mapper";
```

---

## 커밋 계획

### Wave 2 완료 후 커밋 구조

```bash
# HF-1: TODO 주석 제거
git add src/lib/services/contact-template-sender.ts
git commit -m "fix(contact-template-sender): Phase 3-β HF-1 - TODO 주석 제거 및 Feature Flag import 추가"

# HF-2: 에러 매핑 공통 추출
git add src/lib/services/error-mapper.ts
git add src/lib/services/contact-template-sender.ts
git add src/lib/cron/execute-campaigns.ts
git commit -m "refactor(error-mapper): Phase 3-β HF-2 - 에러 매핑 함수 중앙화 (280줄 감소)"

# HF-3: Feature Flag 중복 제거 (HF-1과 함께)
# → HF-1 커밋에 포함됨

# 최종 검증
git log --oneline -3
npm run build
npm run test
```

---

## 진행 상황 추적

**세션 시작**: 2026-05-19 (코드 리뷰 완료)

**체크포인트**:

| 단계 | 예상 시간 | 상태 |
|------|----------|------|
| HF-1 (TODO 제거) | 5분 | ⏳ 대기 |
| HF-2 (에러 매핑) | 30분 | ⏳ 대기 |
| HF-3 (Feature Flag) | 15분 | ⏳ 대기 |
| **Wave 2 총계** | **50분** | ⏳ 대기 |
| 빌드 + 테스트 | 10분 | ⏳ 대기 |
| **전체** | **1시간** | ⏳ 대기 |

---

## FAQ

### Q1: HF-2에서 error-mapper.ts는 이미 생성되었나?
**A**: 네, 코드 리뷰 보고서의 개선 스니펫으로 이미 생성되었습니다. 위의 "Step 1: 신규 파일 생성 (완료)" 참조.

### Q2: 이 변경이 기존 기능에 영향을 주나?
**A**: 아니요. 함수 로직은 100% 동일하고, import 경로만 변경됩니다. Feature Flag 동작은 완전히 동일합니다.

### Q3: 테스트를 다시 작성해야 하나?
**A**: 아니요. __tests__/lib/services/contact-template-sender.test.ts는 이미 생성되었으므로, Wave 2 커밋 후 실행하면 됩니다.

### Q4: 다음 단계는 언제 시작하나?
**A**: Wave 2 완료 후 즉시 Phase 3-γ를 시작할 수 있습니다. γ-1~4는 병렬로 진행 가능합니다.

### Q5: 배포는 언제?
**A**: Phase 3-ε (3주일 후) Staging Full Load Test 후 본 배포 진행. 현재는 배포 가능 상태입니다 (P0 블로커 없음).

---

## 참고 자료

- **코드 리뷰**: MENU38_PHASE3_CODE_REVIEW_BETA.md
- **검토 파일**:
  - src/lib/services/contact-template-sender.ts (529줄)
  - src/lib/config/feature-flags.ts (127줄)
  - src/lib/cron/execute-campaigns.ts (725줄)
  - src/lib/enum-mapping.ts (152줄)
- **신규 파일** (이미 생성됨):
  - src/lib/services/error-mapper.ts
  - __tests__/lib/services/contact-template-sender.test.ts

---

## 다음 세션 메모

1. **세션 시작**: 이 파일 (MENU38_PHASE3_WAVE2_INSTRUCTIONS.md) 참조
2. **Wave 2 상태**: HF-1/2/3 진행 상황 확인
3. **Phase 3-γ**: 준비 완료 시 즉시 시작 (4개 트랙 병렬)
4. **배포**: Phase 3-ε 기준일까지 준비 완료

---

**문서 작성자**: Code Review Agent (Phase 3-β)  
**작성일**: 2026-05-19  
**상태**: ✅ 준비 완료 (Wave 2 실행 대기)
