# 버그 헌터 2 | 논리 검증 보고서

**대상 코드**: Contact Lens 심리렌즈 체계
**검증일**: 2026-06-24
**검증자**: Claude Code (Haiku 4.5)

---

## 🎯 검증 요약

| 항목 | 상태 | 심각도 | 발견사항 |
|------|------|--------|---------|
| 렌즈 점수 정렬 | ✅ PASS | - | 내림차순 정렬 정확 |
| 상위 4개 선택 | ✅ PASS | - | slice(0,4) 로직 정확 |
| 날짜 차이 계산 | ✅ PASS | - | Math.floor 정확 |
| 고객 타입별 렌즈 매핑 | ⚠️ CAUTION | 중간 | **대소문자 불일치 가능성** |
| VIP 배지 로직 | ✅ PASS | - | 우선순위 정확 |
| 렌즈 감지 엔진 | ⚠️ CAUTION | 중간 | **100점 이진 로직 개선 필요** |
| DB 스키마 일관성 | ❌ FAIL | 높음 | **lensInfo 저장 위치 불명확** |

---

## 📋 상세 검증

### 1️⃣ 렌즈 점수 정렬 (ContactLensTab.tsx Line 80-88)

```typescript
// 실제 코드
const sortedLenses = lensInfo
  .map(lens => ({
    ...lens,
    score: lensScores[lens.id] ?? 0,  // ✅ 0이 기본값
  }))
  .sort((a, b) => b.score - a.score);  // ✅ 내림차순 정렬

return sortedLenses.slice(0, 4);  // ✅ 최대 4개
```

**검증 결과**: ✅ **PASS**
- 내림차순 정렬 정확 (b.score - a.score)
- 예: [100, 100, 60, 30, 0, 0] → [100, 100, 60, 30] 반환 ✅
- 데이터 4개 미만일 때도 정상 작동

---

### 2️⃣ 신청이력 날짜 계산 (ContactSignupHistoryTab.tsx Line 40-45)

```typescript
// 실제 코드
const daysDiff = nextDate
  ? Math.floor(
      (new Date(nextDate).getTime() - new Date(date).getTime()) /
      (1000 * 60 * 60 * 24)
    )
  : null;
```

**검증 결과**: ✅ **PASS**
- 밀리초 → 일 단위 변환 정확
- 예: "2026-06-15" ~ "2026-06-20" = 정확히 5일
- Math.floor로 정수 반환 (소수점 제거) ✅
- 마지막 신청 (nextDate = null)일 때 null 반환 ✅

**주의사항**: 시간대 차이
```typescript
// 예시: 시간대 영향
new Date("2026-06-15T23:00:00Z")  // UTC 15일 23:00
new Date("2026-06-20T01:00:00Z")  // UTC 20일 01:00
// → 4.083일 → Math.floor(4) → "다음 신청까지: 4일"
// ⚠️ 실제로는 4일 2시간이지만, UI에 "4일"로 표시 (수용 가능)
```

---

### 3️⃣ 고객 타입별 렌즈 매핑 (ContactLensTab.tsx Line 61-70)

```typescript
// 실제 코드
function getLensInfoByType(sourceType?: string | null): typeof LENS_INFO_DEFAULT {
  switch (sourceType) {
    case 'education':
      return LENS_INFO_EDUCATION;
    case 'gold_member':
      return LENS_INFO_GOLD;
    default:
      return LENS_INFO_DEFAULT;
  }
}
```

**검증 결과**: ⚠️ **CAUTION (중간 위험)**

**문제점**: sourceType 대소문자 불일치 가능성

| 소스 | sourceType 값 | 예상 매핑 | 실제 | 비고 |
|------|--------------|---------|------|------|
| 랜딩 | `'landing_page'` | DEFAULT | ✅ | 기본값 사용 |
| 직접입력 | `'user'` | DEFAULT | ✅ | 기본값 사용 |
| 문의신청 | `'inquiry'` | DEFAULT | ✅ | 기본값 사용 |
| 교육 | `'education'` | EDUCATION | ✅ | case 정확 |
| 골드 | `'gold_member'` | GOLD | ✅ | case 정확 |
| **교육** | `'EDUCATION'` (대문자) | DEFAULT | ❌ | **불일치!** |
| **골드** | `'GOLD_MEMBER'` (대문자) | DEFAULT | ❌ | **불일치!** |

**근본 원인**: 
- `ContactSlidePanel.tsx` Line 55-62에서 정의된 SOURCE_TYPE_LABELS의 키:
  ```typescript
  const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    landing_page: { ... },   // ✅ 소문자_언더스코어
    user: { ... },           // ✅ 소문자
    inquiry: { ... },        // ✅ 소문자
    affiliate: { ... },      // ✅ 소문자_언더스코어
    gold_member: { ... },    // ✅ 소문자_언더스코어 (일관성)
    education: { ... },      // ✅ 소문자 (일관성)
  };
  ```

**검증 필요**:
1. Prisma schema `sourceType` 저장 형식 확인
2. 모든 API 엔드포인트에서 일관된 대소문자 사용
3. DB에 실제 저장된 값들 샘플링

**권장 수정**:
```typescript
// 안전한 비교 (소문자 통일)
function getLensInfoByType(sourceType?: string | null): typeof LENS_INFO_DEFAULT {
  const normalized = sourceType?.toLowerCase();
  switch (normalized) {
    case 'education':
      return LENS_INFO_EDUCATION;
    case 'gold_member':
      return LENS_INFO_GOLD;
    default:
      return LENS_INFO_DEFAULT;
  }
}
```

---

### 4️⃣ VIP 배지 로직 (ContactSlidePanel.tsx Line 65-79)

```typescript
// 실제 코드
function RiskBadge({ score, sourceType }: { score: number; sourceType?: string | null }) {
  // VIP 고객 우선 처리
  if (sourceType === 'gold_member') {
    return <span>🔴 VIP 응답 급함</span>;  // ✅ 우선순위 1
  }

  // 일반 고객 3단계
  if (score <= 30) {
    return <span>🟢 정상</span>;           // ✅ score <= 30
  } else if (score <= 70) {
    return <span>🟡 주의</span>;           // ✅ 30 < score <= 70
  } else {
    return <span>🔴 위험</span>;           // ✅ score > 70
  }
}
```

**검증 결과**: ✅ **PASS**

**경계값 검증**:
| score | 예상 배지 | 로직 |
|-------|---------|------|
| 0 | 🟢 정상 | score <= 30 ✅ |
| 30 | 🟢 정상 | score <= 30 ✅ |
| 31 | 🟡 주의 | 30 < 31 <= 70 ✅ |
| 70 | 🟡 주의 | 70 <= 70 ✅ |
| 71 | 🔴 위험 | 71 > 70 ✅ |
| 100 | 🔴 위험 | 100 > 70 ✅ |

**VIP 우선순위 정확**: gold_member는 항상 "VIP 응답 급함" (score 무관) ✅

---

### 5️⃣ 렌즈 감지 엔진 (lens-detector.ts Line 257-270)

```typescript
// 실제 코드
export function getLensScores(data: ContactData): Record<LensType, number> {
  const lenses = detectLenses(data);
  const scores: Record<LensType, number> = {
    L0: 0, L1: 0, L2: 0, ..., L10: 0,  // ✅ 모든 렌즈 초기값 0
  };

  // 감지된 렌즈는 100점
  for (const lens of lenses) {
    scores[lens] = 100;  // ✅ 감지=100, 미감지=0
  }

  return scores;
}
```

**검증 결과**: ✅ **PASS (기능상)**
하지만 ⚠️ **설계 상 개선점 있음**

**현재 로직**:
- 감지됨 = 100점 (이진 논리)
- 미감지 = 0점 (이진 논리)

**문제점**:
1. **신뢰도 부족**: 모든 감지된 렌즈가 동일 100점
   - 예: "가격 매우 민감" vs "가격 조금 언급" → 모두 100점
   - 심리학 렌즈 강도가 무시됨

2. **우선순위 미반영**: ContactLensTab에서 score로만 정렬
   - renderView L0과 L10은 긴급도가 다르지만 동일 점수

**개선 제안**:
```typescript
// 렌즈별 가중치 적용
export function getLensScores(data: ContactData): Record<LensType, number> {
  const weights: Record<LensType, number> = {
    L0: 100,  // 부재중 - 즉시
    L10: 95,  // 클로징 - 즉시
    L6: 90,   // 타이밍 - 긴박
    L1: 70,   // 가격 - 중
    L2: 70,   // 준비 - 중
    // ...
  };

  const lenses = detectLenses(data);
  const scores: Record<LensType, number> = {
    L0: 0, L1: 0, ..., L10: 0,
  };

  for (const lens of lenses) {
    scores[lens] = weights[lens];  // ⚠️ 가중치 기반
  }

  return scores;
}
```

**결론**: 현재 로직은 **기능상 정확**하지만, **렌즈 강도 구분 부재**

---

### 6️⃣ DB 스키마 일관성 검증 (치명적 문제)

**문제**: lensInfo 저장 위치 불명확

```typescript
// ContactLensTab.tsx Line 79
const lensScores = contact.lensInfo || {};

// types/contact.ts Line 123
lensInfo?: Record<string, number>;  // Json → Record (L0-L10 점수: 0-100)

// api/contacts/[id]/route.ts Line 55
const lensInfo = getLensScores(contact);
```

**검증 질문**:

1. ❓ **DB에 저장되는가?**
   - Prisma schema에서 Contact.lensInfo 필드 정의 있는가?
   - JSON 타입인가? Text? Object?

2. ❓ **읽기 경로 일치하는가?**
   - API GET: `getLensScores(contact)` → **실시간 계산**
   - UI 렌더: `contact.lensInfo` → **DB 저장 값**
   - **→ 데이터 소스 불일치!** ⚠️

3. ❓ **갱신 주기?**
   - 언제 계산/저장되는가?
   - Contact 생성 시? Contact 업데이트 시? 매일? 매시간?

**근본 원인 분석**:

```typescript
// 현재 API 로직
const contact = await prisma.contact.findFirst({ ... });
const lensInfo = getLensScores(contact);  // ✅ 실시간 계산

// 응답 시 lensInfo 추가?
// 응답 코드를 확인해야 함 (제한된 이유로 보이지 않음)
```

**위험 시나리오**:
1. 콜 기록 추가 → Contact 객체 업데이트 → lensInfo **재계산되지 않음** ⚠️
2. UI는 **이전 lensInfo** 표시
3. 사용자는 **오래된 렌즈** 보게 됨

---

## 🔴 발견된 버그 (심각도별)

### 버그 #1: lensInfo 데이터 소스 불일치 **[높음]**

**상태**: ❌ FAIL
**영향**: Contact 열 때마다 렌즈 점수 갱신 필요

```
API GET /api/contacts/[id]
  ├─ DB에서 contact 읽음 (6주전 lensInfo 포함)
  └─ getLensScores() 실시간 계산
       └─ callLogs 등 최신 데이터 기반 계산
       └─ 하지만 응답에 포함되는가?

ContactLensTab
  ├─ contact.lensInfo 사용 (?)
  └─ 항상 최신인가? (의문)
```

**확인 필요 코드**: `api/contacts/[id]/route.ts` 전체 (제한으로 읽을 수 없음)

---

### 버그 #2: sourceType 대소문자 민감성 **[중간]**

**상태**: ⚠️ CAUTION
**영향**: 특정 고객 타입의 렌즈 매핑 실패 가능

```typescript
// 현재 (위험)
case 'gold_member':  // ← GOLD_MEMBER면 실패

// 개선 필요
case sourceType?.toLowerCase() === 'gold_member':
```

---

### 버그 #3: 렌즈 점수 우선순위 미반영 **[낮음]**

**상태**: ⚠️ DESIGN ISSUE
**영향**: 렌즈 정렬에서 심리학 우선순위 무시

```
현재: 감지된 렌즈 = 모두 100점 → 감지 순서로 정렬
개선: L0/L10 = 95-100점, L1-5 = 70-90점 → 우선도 기반 정렬
```

---

## ✅ 최종 체크리스트

```
렌즈 정렬 (내림차순)
[ ✅ ] 높은 점수 먼저 나옴
[ ✅ ] 동일 점수 시 원본 순서 유지 (기본값)
[ ✅ ] 상위 4개만 표시

신청이력 (날짜 계산)
[ ✅ ] 일 단위 정확
[ ✅ ] Math.floor로 정수 반환
[ ✅ ] 마지막 항목 null 처리

고객 타입별 렌즈 매핑
[ ⚠️ ] sourceType 대소문자 확인 필요
[ ✅ ] 3가지 분기 로직 정확
[ ✅ ] 기본값 처리 정확

VIP 배지
[ ✅ ] gold_member 우선 처리
[ ✅ ] 경계값 정확 (<=30, <=70)
[ ✅ ] score 무관 처리 정확

렌즈 감지 엔진
[ ✅ ] 모든 렌즈 초기값 0
[ ✅ ] 감지 렌즈 100점 할당
[ ⚠️ ] 가중치 기반 개선 권장

DB 스키마
[ ❌ ] lensInfo 저장/조회 위치 불명확
[ ❌ ] 실시간 계산 vs DB 저장 일관성 미확인
[ ❌ ] 갱신 타이밍 정의 필요
```

---

## 📊 종합 평가

| 범주 | 점수 | 설명 |
|------|------|------|
| **기능 정확도** | 8/10 | 렌즈 정렬/신청이력 정확하나 DB 일관성 의문 |
| **데이터 일관성** | 5/10 | sourceType 대소문자 + lensInfo 출처 불명확 |
| **에러 처리** | 7/10 | null 체크 적절하나 예외 케이스 미점검 |
| **성능** | 9/10 | useMemo 최적화, 불필요한 재계산 없음 |
| **유지보수성** | 6/10 | getLensInfoByType 하드코딩된 분기, 확장 어려움 |

**종합 점수: 7/10**

---

## 🚨 즉시 조치 필요 사항

### P0 (높음)
- [ ] Prisma schema에서 Contact.lensInfo 필드 정의 확인
- [ ] API `/api/contacts/[id]` 응답에 lensInfo 포함 여부 확인
- [ ] 콜 기록 추가 후 lensInfo 갱신 메커니즘 구현

### P1 (중간)
- [ ] sourceType 대소문자 일관성 가이드 작성
- [ ] 모든 고객 타입 3개 케이스 단위 테스트 추가

### P2 (낮음)
- [ ] 렌즈 점수 가중치 시스템 검토 (UX 개선)
- [ ] ContactLensTab 확장 가능하도록 리팩토링

---

**리포트 작성일**: 2026-06-24 10:45 UTC
**버전**: 1.0
