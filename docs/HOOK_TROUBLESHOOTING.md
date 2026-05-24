# Hook Troubleshooting Guide (2026-05-24)

## 개요
실제 개발 중 마주칠 수 있는 Hook 관련 문제 10가지 + 해결책

---

## 문제 1: Hook 1 (Commit) 검증 실패 - PASONA 6단계 중 일부 누락

### 증상
```
⚠ PASONA 검증 실패: 5/6 완성
  ✗ 누락된 단계: O (Offer) 미정의
  
Commit 진행? (Y/n): Y
경고: PASONA 완성도 5/6 (83%) 낮음
```

### 원인
- SMS/마케팅 파일에서 PASONA 6단계 중 1개 이상 누락
- 예: Day 3에서 구체적 오퍼 (초대 보너스, 기한 등) 없음

### 해결책

#### 1단계: 파일 확인
```typescript
// ❌ 잘못된 예
const smsSequence = {
  day3: "오늘이 마지막 기회입니다! 지금 신청하세요."
}

// ✅ 올바른 예
const smsSequence = {
  day3: "마감 임박! 오늘 신청 시 초대 보너스 ₩300K + 즉시 정산 (한정)"
}
```

#### 2단계: PASONA 매핑 확인
```typescript
// PASONA 6단계 체크리스트
const smsSequence = {
  day0: "월 추가 수익 확인 가능!", // P(Problem) + A(Agitate)
  day1: "경쟁사보다 30% 높은 수익 확인 →", // S(Solution)
  day2: "실제 파트너 월 ₩2M 수익", // O(Offer)
  day3: "보너스 ₩300K + 즉시 정산", // N(Narrow) + A(Action)
  // ↑ O가 Day 2로 분산됨
}
```

#### 3단계: 수정 후 재커밋
```bash
$ git add src/app/api/sms/templates.ts
$ git commit -m "fix(sms): Day 3 Offer 명확화 - 초대보너스 추가"
# → Hook 1 자동 실행: PASONA 6/6 ✓
```

### 예방법
- PASONA 체크리스트 템플릿 사용 (HOOK_INTEGRATION_CHECKLIST.md 참고)
- SMS Day별로 단계 분산: P-A (Day 0) → S (Day 1) → O (Day 2) → N-A (Day 3)

---

## 문제 2: Hook 1 심리학 렌즈 감지 실패 - L0-L10 인식 미흡

### 증상
```
⚠ 심리학 렌즈 검증 실패:
  감지된 렌즈: 0개
  필요한 최소: 3개
  → Commit 진행 가능하나 경고 출력
```

### 원인
- 코드에서 심리학 렌즈 관련 키워드 없음
- 예: "L6", "손실회피", "타이밍" 키워드 부재
- 렌즈 명칭이 영어로만 작성됨 (영문 매칭 불가)

### 해결책

#### 1단계: 코드에 렌즈 명시
```typescript
// ❌ 잘못된 예 (렌즈 명시 없음)
export function calculatePrice() {
  return basePrice * 1.5;
}

// ✅ 올바른 예 (렌즈 L6 명시)
export function calculatePrice() {
  // L6 타이밍 손실회피: "지금 신청하면 가격 인상 전 저가"
  const fomoDayCount = calculateDaysUntilPriceIncrease();
  const message = `${fomoDayCount}일 남음! 지금 신청 시 ₩${savings}K 절약`;
  
  return { basePrice: basePrice * 1.5, message };
}
```

#### 2단계: 렌즈별 키워드 추가
```typescript
// L0: 부재중고객재활성화
export function reactivateInactiveCustomer(inactivityDays: number) {
  // "L0" 또는 "부재중" 또는 "comeback" 또는 "reactivation"
  if (inactivityDays > 180) {
    return "구입한 지 6개월 이상 방문 없으신 고객님, 새로운 상품을 소개합니다";
  }
}

// L6: 타이밍 손실회피
export function applyTimingPressure() {
  // "L6" 또는 "손실회피" 또는 "timing" 또는 "now" 또는 "deadline"
  const deadline = calculateDeadline();
  return `지금 신청하면 ${deadline}까지 ₩XXX 할인`;
}
```

#### 3단계: 렌즈 주석 표준화
```typescript
/**
 * L3 차별성미인지 + L6 타이밍손실회피
 * 경쟁사와의 차이점을 강조하면서 시간 압박 추가
 */
export function differentiate() {
  const competitorPrice = 800000;
  const ourPrice = 700000;
  const savings = competitorPrice - ourPrice;
  
  return `우리만 ${savings}K 저렴! 오늘 신청 시 추가 ₩100K 할인`;
  // ↑ L3(차별) + L6(타이밍) 동시 적용
}
```

### 예방법
- 파일명에 렌즈 명칭 포함: `l6_timing_calculator.ts` (권장)
- 함수명에 렌즈 명칭 포함: `calculateL6TimingMessage()` (권장)
- 주석에 렌즈 명시: `// L6 타이밍 손실회피` (필수)

---

## 문제 3: Hook 2 (PR) 자동 생성 실패 - 조건 미충족

### 증상
```
PR 생성 시 Hook 2 자동 체크리스트 미추가
- 변경 파일: 5개 (필요: >10개)
- 변경 라인: 200줄 (필요: >500줄)
→ Hook 2 조건 미충족으로 자동 실행 안 됨
```

### 원인
- Hook 2 조건: `changed files > 10 OR lines > 500`
- 소규모 변경만 있음

### 해결책

#### 방법 1: 작은 PR도 체크리스트 포함 (설정 변경)
```json
// settings.json에서 Hook 2 조건 수정
"pr": {
  "condition": "files changed > 5 or lines > 300", // 기준 완화
  // 또는
  "condition": "always" // 항상 추가
}
```

#### 방법 2: 여러 커밋 배치로 PR 생성
```bash
# 대신 이렇게 여러 관련 작업 한 PR로 병합
$ git checkout -b feature/menu-40-complete
$ # 커밋 1: SMS Day 0-3
$ # 커밋 2: Contact 분류 규칙
$ # 커밋 3: 대시보드 KPI
$ git push origin feature/menu-40-complete
$ gh pr create # → 이제 Hook 2 자동 실행
```

#### 방법 3: PR 템플릿 수동 적용
```bash
# 자동 적용 안 되면 수동으로 적용
$ gh pr edit <pr-number> --body "$(cat docs/HOOK_INTEGRATION_CHECKLIST.md | grep -A 30 '심리학 기반 코드 리뷰')"
```

### 예방법
- 관련 작업 여러 개 모아서 1 PR로 (권장)
- 커밋 50줄 이상인 경우만 분리 PR 생성

---

## 문제 4: Hook 3 (Merge) RAG 메모리 파일 미발견

### 증상
```
🔍 변경된 파일 유형 감지: "마케팅자동화"

📚 관련 메모리 파일 자동 제시:
   
   ⚠ 1순위: pasona_framework_complete.md
      → 파일 미발견 (경로 오류?)
   
   ✗ Merge 진행 불가능
```

### 원인
- CLAUDE_RAG_INDEX.md에 참조된 메모리 파일명이 실제 파일과 불일치
- 파일명 변경되었으나 인덱스 미업데이트

### 해결책

#### 1단계: 실제 파일 확인
```bash
$ ls -la D:\mabiz-crm\docs\PASONA* | head
# → pasona_framework_complete.md 또는 다른 이름?
# → PASONA_COMPLETE_MASTER.md 인가?
```

#### 2단계: RAG 인덱스 업데이트
```markdown
// ❌ 잘못된 참조
[[pasona_framework_complete]] 

// ✅ 올바른 참조 (실제 파일명으로)
[[PASONA_COMPLETE_MASTER_통합분석]]
```

#### 3단계: 인덱스 재생성
```bash
$ # CLAUDE_RAG_INDEX.md 자동 생성 스크립트 실행
$ npm run generate:rag-index
# 또는 수동 확인
$ grep -r "파일명" D:\mabiz-crm\docs\ | grep -v ".md:" | head -20
```

### 예방법
- 파일명 변경 시 CLAUDE_RAG_INDEX.md도 함께 업데이트
- 월 1회 RAG 인덱스 유효성 검증

---

## 문제 5: Hook 4 (Build) SMS Day 0-3 파일 미발견

### 증상
```
📋 검증 영역 1: SMS/이메일 템플릿 Day 0-3

  검색 경로: src/lib/sms, src/lib/email, src/app/api/**/sms
  
  ❌ Day 0 파일 미발견: src/lib/sms/templates/day0.ts
  ❌ Day 1 파일 미발견: src/lib/sms/templates/day1.ts
  ❌ Day 2 파일 미발견: src/lib/sms/templates/day2.ts
  ❌ Day 3 파일 미발견: src/lib/sms/templates/day3.ts
  
  결과: 0/5 완성 (0%) 🚫
```

### 원인
- SMS 템플릿 파일이 다른 폴더 구조로 구성되었거나
- 파일명 컨벤션이 설정과 다름
- Hook 4의 searchPaths 설정이 부정확

### 해결책

#### 1단계: 실제 파일 구조 확인
```bash
$ find D:\mabiz-crm -type f -name "*sms*" -o -name "*message*" | grep -i template | head -20
# → 실제 경로 파악
# 예: src/lib/sms/messages/templates.ts
#     src/app/api/sms/templates/index.ts
```

#### 2단계: Hook 4 설정 업데이트
```json
// settings.json의 Hook 4 - smsEmailTemplates 부분
"smsEmailTemplates": {
  "enabled": true,
  "searchPaths": [
    "src/lib/sms/**/*.ts",      // 확장자 추가
    "src/lib/email/**/*.ts",
    "src/app/api/**/sms/**/*.ts",
    "src/app/api/**/email/**/*.ts"
  ],
  "fileNamePatterns": [
    "*day0*", "*day1*", "*day2*", "*day3*",
    "*day0_*", "*day1_*", "*day2_*", "*day3_*"  // 언더스코어 패턴 추가
  ]
}
```

#### 3단계: 파일명 표준화 (또는 설정에 맞추기)
```typescript
// 방법 1: 파일 이름 변경 (권장)
src/lib/sms/templates/
  ├── day0-initial.ts
  ├── day1-followup.ts
  ├── day2-value.ts
  └── day3-closing.ts

// 방법 2: 단일 파일에서 Day별 객체로 관리
src/lib/sms/templates.ts
  export const templates = {
    day0: { ... },
    day1: { ... },
    day2: { ... },
    day3: { ... }
  }
```

#### 4단계: Hook 4 다시 실행
```bash
$ npm run build
# → Day 0-3 파일 모두 발견 ✓
```

### 예방법
- SMS 파일 생성 시 명확한 Day 명칭 사용 (day0, day1, day2, day3)
- 프로젝트 초반에 파일 구조 통일 후 Hook 설정

---

## 문제 6: Hook 1 심리학 렌즈 중복 감지 - L3와 L30 혼동

### 증상
```
⚠ 심리학 렌즈 검증 실패:
  감지된 렌즈: L3, L30 (잘못된 감지)
  필요한 최소: 3개
  
  💡 주의: "L30" 렌즈는 존재하지 않음 (L0-L10만 유효)
```

### 원인
- 정규표현식 매칭 오류: "L3"를 포함하는 단어 (예: "L30", "L3Product")에서 잘못 감지
- 렌즈 범위 검증 미흡 (L0-L10만 유효)

### 해결책

#### 1단계: 정규표현식 개선 (Hook 설정)
```json
// settings.json의 Hook 1 - psychology 섹션 개선
"psychology": {
  "enabled": true,
  "lensDetection": {
    "pattern": "\\bL[0-9]\\b",  // 단어 경계 추가
    "validRange": [0, 10],       // L0-L10만 유효
    "caseSensitive": false
  }
}
```

#### 2단계: 코드에서 렌즈 명명 표준화
```typescript
// ❌ 혼동되는 명명
const L30Product = "Premium"; // L30으로 감지될 수 있음

// ✅ 명확한 명명
const PREMIUM_PRODUCT = "Premium";
const L6_TIMING = "손실회피";  // L6 명확히
```

#### 3단계: 주석에서도 표준화
```typescript
/**
 * ❌ 불명확
 * 이 함수는 L3과 관련된 로직을 처리합니다.
 * 
 * ✅ 명확
 * [L3 차별성미인지] 이 함수는 경쟁사와의 차이점을 강조합니다.
 */
```

### 예방법
- 렌즈 표기는 항상 `[L0-L10]` 형식으로 통일
- 함수명에는 렌즈 번호만 사용 (L3_differentiate() ✓, L30_xxx() ✗)

---

## 문제 7: Hook 4 Contact 분류 필드 미존재

### 증상
```
📋 검증 영역 3: Contact 자동분류 렌즈 라벨 매핑

  ✗ L0: 부재중고객 필드 미발견
    → contacts.inactivityDays 존재하지 않음
  
  ✗ L1: 가격민감도 필드 미발견
    → contacts.priceSegment 존재하지 않음
  
  결과: 0/7 완성 (0%) 🚫
```

### 원인
- Prisma schema에 렌즈 관련 필드가 아직 추가되지 않음
- 또는 필드명이 다름 (예: `inactiveMonths` vs `inactivityDays`)

### 해결책

#### 1단계: Prisma schema 확인
```bash
$ cat D:\mabiz-crm\prisma\schema.prisma | grep -A 50 "model Contact"
```

#### 2단계: 렌즈 필드 추가
```prisma
model Contact {
  id          String   @id @default(cuid())
  name        String
  email       String
  
  // L0: 부재중고객 재활성화
  lastContactAt    DateTime?
  inactivityDays   Int?      @default(0)
  
  // L1: 가격이의대응
  priceSegment     String?   // "low", "medium", "high"
  priceObjections  Int?      @default(0)
  
  // L2: 준비복잡불안
  readinessScore   Int?      @default(0) // 0-100
  readinessNotes   String?
  
  // L3: 차별성미인지
  differentiationScore Int?   @default(0) // 0-100
  competitorMentions   Int?   @default(0)
  
  // L5-L10: 세그먼트별
  lens             String?   // "L0", "L1", ..., "L10"
  
  // 일반 필드
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### 3단계: 마이그레이션 생성 및 실행
```bash
$ npx prisma migrate dev --name add_lens_fields
# → 새로운 필드 DB에 추가
```

#### 4단계: Hook 4 재실행
```bash
$ npm run build
# → Contact 분류 필드 모두 발견 ✓
```

### 예방법
- Hook 4 검증 전에 Prisma schema 먼저 업데이트
- 렌즈별 필드 추가 시 렌즈 정의 문서 참조 (HOOK_INTEGRATION_CHECKLIST.md)

---

## 문제 8: Hook 3 새로운 렌즈 추가 후 CLAUDE_RAG_INDEX.md 미업데이트

### 증상
```
🔍 새로운 렌즈/기법 감지:
   - L11 신규렌즈: 코드 발견
   - SPIN 개선: 새로운 기법
   
   ⚠ CLAUDE_RAG_INDEX.md에 미등록
   → 메모리 인덱스 업데이트 필수
```

### 원인
- 새로운 심리학 기법 추가했으나 RAG 인덱스 미업데이트
- L11 같은 범위 외 렌즈 추가

### 해결책

#### 1단계: 새 렌즈 정의 확인
```typescript
// 새로운 L11이 정말 필요한가? (L0-L10이 표준)
// 또는 기존 L0-L10 중 하나로 매핑?

// L11 신규렌즈 → L0-L10 중 어느 것? 확인
export const L11_CustomLens = "..."  // ❌ 비표준

export const L6_Timing = "..."  // ✅ 표준 범위 내 확장
```

#### 2단계: RAG 인덱스 업데이트
```markdown
// D:\mabiz-crm\docs\CLAUDE_RAG_INDEX.md에 추가

### 🟢 섹션 11: 신규 심리학 기법 (2026-05-24)

| 렌즈 | 파일명 | 핵심내용 | Template |
|-----|--------|---------|----------|
| **L6 확장** | [[l6_timing_loss_aversion_extended]] | 타이밍 심화 기법 | T1 |
| **SPIN 개선** | [[spin_selling_advanced]] | 심화 질문법 | T1 |
```

#### 3단계: MEMORY.md 메모리 파일 추가
```bash
$ cat > "D:\mabiz-crm\docs\l6_timing_loss_aversion_extended.md" << 'EOF'
# L6 타이밍 손실회피 심화 기법 (2026-05-24)

## 소개
기존 L6 기본 기법에 추가된 고급 기법

## 적용 방식
...
EOF
```

#### 4단계: Hook 설정 검증
```json
// settings.json의 Hook 3에서 새 기법 감지?
"newLensDetection": {
  "enabled": true,
  "maxLensNumber": 10,  // L0-L10만 인정
  "warningIfHigher": true,  // L11+ 발견 시 경고
  "requireRagUpdate": true  // RAG 인덱스 업데이트 의무
}
```

### 예방법
- 새로운 기법 추가 전에 기존 L0-L10과의 중복 확인
- 새 기법 추가 시 RAG 인덱스 동시 업데이트 (PR 조건)

---

## 문제 9: Hook 4 KPI 대시보드 자동 계산 오류 - 0으로 나누기

### 증상
```
⚠ 영역 4 (KPI 대시보드): 계산 오류 감지

  ⚠ 콜 전환율 계산 실패
    → Error: Division by zero (콜 수 = 0)
  
  ⚠ CPA 계산 실패
    → Error: NaN (신규 고객 = 0)
  
  결과: 계산 중단
```

### 원인
- 신규 고객 또는 콜 수가 0인 경우 처리 미흡
- 에러 처리 미구현

### 해결책

#### 1단계: KPI 계산 함수에 보호 로직 추가
```typescript
// ❌ 위험한 계산
export function calculateConversionRate(closedDeals: number, totalCalls: number) {
  return (closedDeals / totalCalls) * 100;  // totalCalls=0 시 에러
}

// ✅ 안전한 계산
export function calculateConversionRate(closedDeals: number, totalCalls: number) {
  if (totalCalls === 0) {
    return 0;  // 또는 null
  }
  return (closedDeals / totalCalls) * 100;
}

// ✅ 더 나은 계산 (타입 가드)
export function calculateConversionRate(
  closedDeals: number,
  totalCalls: number
): number | null {
  if (totalCalls <= 0) {
    return null;  // "데이터 부족" 표시
  }
  return (closedDeals / totalCalls) * 100;
}
```

#### 2단계: 대시보드 UI에서 null 처리
```typescript
// 대시보드에서 null 값 표시
export function formatMetric(value: number | null): string {
  if (value === null) return "데이터 부족";
  if (!Number.isFinite(value)) return "계산 불가";
  return `${value.toFixed(2)}%`;
}
```

#### 3단계: Hook 4에서 에러 처리 검증
```json
// settings.json의 Hook 4 - dashboardKPI 섹션에 추가
"dashboardKPI": {
  "enabled": true,
  "errorHandling": {
    "checkDivisionByZero": true,
    "checkNaN": true,
    "checkInfinity": true,
    "defaultValue": 0  // 또는 null
  }
}
```

### 예방법
- KPI 계산 함수 작성 시 항상 0 또는 null 입력 고려
- 단위 테스트에서 edge case 테스트 (0, null, undefined)

---

## 문제 10: Hook 통합 오류 - 순환 참조 또는 매크로 충돌

### 증상
```
⚠ Hook 통합 오류: 순환 참조 감지

Hook 2 (PR)
  → CLAUDE_RAG_INDEX.md 참고
    → CLAUDE_AGENT_PROMPTS.md 참고
      → CLAUDE_RAG_INDEX.md 참고
        → [순환 참조 감지]

❌ PR 생성 실패
```

### 원인
- 4개 Hook이 상호 참조하면서 순환 참조 발생
- Hook 3과 Hook 2가 동시에 메모리 파일 수정 시도
- 문서 간 매크로 충돌

### 해결책

#### 1단계: Hook 실행 순서 정의
```json
// settings.json에서 Hook 순서 명시
"hookExecutionOrder": [
  "commit",    // Hook 1: 먼저 검증
  "pr",        // Hook 2: PR 생성 (Hook 1 후)
  "merge",     // Hook 3: 병합 (Hook 2 후)
  "build"      // Hook 4: 빌드 (Hook 3 후)
]
```

#### 2단계: 각 Hook의 책임 명확화
```
Hook 1 (Commit): 검증만 (읽기만, 쓰기 금지)
  └─ CLAUDE_RAG_INDEX.md (읽기만)
  └─ CLAUDE_AGENT_PROMPTS.md (읽기만)

Hook 2 (PR): PR 본문 생성 (쓰기)
  └─ PR.md 체크리스트 쓰기
  └─ 메모리 파일 읽기만

Hook 3 (Merge): 메모리 업데이트 (쓰기)
  └─ CLAUDE_RAG_INDEX.md 업데이트 (쓰기 권한)
  └─ 새 기법 감지 시 메모리 추가

Hook 4 (Build): 최종 검증 (읽기만)
  └─ 모든 메모리 파일 읽기
  └─ 최종 리포트 생성
```

#### 3단계: 문서 간 매크로 정의
```markdown
// CLAUDE_RAG_INDEX.md에서
[[pasona_framework_complete]] = "docs/PASONA_COMPLETE_MASTER_통합분석.md"

// CLAUDE_AGENT_PROMPTS.md에서
{{pasona_ref}} = "docs/CLAUDE_RAG_INDEX.md#pasona"  // 순환 금지!

// 대신 직접 링크
[[pasona_ref]] = "docs/PASONA_COMPLETE_MASTER_통합분석.md"
```

#### 4단계: 순환 참조 검증
```bash
# 순환 참조 스캔
$ grep -r "\[\[.*\]\]" docs/ | grep -E "CLAUDE_RAG|CLAUDE_AGENT" | sort | uniq -d
# → 중복되는 참조가 있으면 순환 의심

# 더 정확한 검증
$ npm run check:circular-references
```

### 예방법
- Hook 간 책임 명확화 (한 Hook = 한 문서 주인)
- 월 1회 순환 참조 검증 자동화
- Hook 설정 시 실행 순서 명시 (dependencies 추가)

---

## 빠른 해결 가이드 (Quick Fix)

### Hook 1 문제 (Commit)
| 문제 | 빠른 해결 | 예방 |
|------|---------|------|
| PASONA 단계 누락 | `docs/HOOK_INTEGRATION_CHECKLIST.md` 참고 후 수정 | 텍스트 템플릿 사용 |
| 렌즈 미감지 | 코드에 `// L0-L10` 주석 추가 | 파일명에 렌즈 명칭 포함 |
| SPIN 단계 누락 | S→P→I→N 순서 확인 및 추가 | SPIN 사다리 템플릿 사용 |

### Hook 2 문제 (PR)
| 문제 | 빠른 해결 | 예방 |
|------|---------|------|
| 체크리스트 미추가 | `gh pr edit --body` 수동 추가 | 파일 10개+ 변경 시 PR 생성 |
| 템플릿 손상 | `git reset PR` 후 재생성 | settings.json 체크 |

### Hook 3 문제 (Merge)
| 문제 | 빠른 해결 | 예방 |
|------|---------|------|
| 메모리 파일 미발견 | `CLAUDE_RAG_INDEX.md` 파일명 확인 및 수정 | 월 1회 인덱스 검증 |
| 순환 참조 | 문서 간 참조 제거 (직접 링크만) | Hook 책임 명확화 |

### Hook 4 문제 (Build)
| 문제 | 빠른 해결 | 예방 |
|------|---------|------|
| SMS 파일 미발견 | `searchPaths` 설정 확인 및 업데이트 | 명확한 파일명 컨벤션 |
| Contact 필드 미존재 | Prisma schema에 필드 추가 및 migration | Hook 4 실행 전 schema 확인 |
| KPI 계산 오류 | 0으로 나누기 보호 로직 추가 | 단위 테스트에 edge case 포함 |

---

## 모니터링 및 로깅

### Hook 실행 로그 확인
```bash
# Hook 1 (Commit) 로그
$ cat .git/hooks/pre-commit.log

# Hook 2 (PR) 로그
$ gh api repos/mabiz/crm/actions/runs | jq '.workflow_runs[0].conclusion'

# Hook 3 (Merge) 로그
$ git log --oneline | grep "Merge"

# Hook 4 (Build) 로그
$ cat reports/pre-build-validation.json
```

### Hook 실행 통계
```bash
# Hook 평균 실행 시간
$ npm run analyze:hook-performance

# Hook 성공률
$ npm run analyze:hook-success-rate

# Hook 오류 통계
$ npm run analyze:hook-errors
```

---

## 지원 및 피드백

### 문제 보고
문제 발견 시:
1. Hook 문제 번호 확인 (위 10가지 중)
2. 증상 캡처 (console 출력)
3. 문제 추가 시 이 파일 업데이트 (PR)

### 개선 요청
Hook 설정 개선 필요 시:
- `settings.json` PR 생성
- 변경 사항 명확히 (이유 + 기대 효과)
- 테스트 케이스 포함

---

**마지막 업데이트**: 2026-05-24
**버전**: 1.0
**유지보수**: 월 1회 검토 + 분기 1회 심화 검증
