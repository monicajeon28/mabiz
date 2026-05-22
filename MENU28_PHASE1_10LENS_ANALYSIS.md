# Menu #28 (문자 CRM) Phase 1 - 10렌즈 종합 분석

**분석 완료**: 2026-05-23  
**파일**: `src/app/(dashboard)/messages/page.tsx` (597줄)  
**10렌즈 점수**: 4.8/10 🔴 **배포 차단**  
**배포 준비도**: 2.5/10 ❌ **P0 8개 긴급 수정 필요**

---

## 📊 10렌즈 종합 점수

| 렌즈 | 점수 | P0 | P1 | P2 | 상태 |
|-----|------|----|----|----|----|
| 1️⃣ 보안 | 3/10 | 3 | 2 | 0 | 🔴 |
| 2️⃣ 성능 | 6/10 | 0 | 2 | 2 | 🟡 |
| 3️⃣ 접근성 | 4/10 | 0 | 3 | 2 | 🟡 |
| 4️⃣ UX | 5/10 | 1 | 4 | 1 | 🟡 |
| 5️⃣ 확장성 | 5/10 | 0 | 3 | 1 | 🟡 |
| 6️⃣ 에러처리 | 4/10 | 1 | 4 | 0 | 🔴 |
| 7️⃣ 테스트 | 2/10 | 1 | 3 | 0 | 🔴 |
| 8️⃣ 유지보수 | 6/10 | 0 | 2 | 2 | 🟡 |
| 9️⃣ 호환성 | 8/10 | 0 | 0 | 1 | 🟢 |
| 🔟 비즈니스 | 5/10 | 2 | 1 | 1 | 🟡 |
| **평균** | **4.8/10** | **8** | **24** | **10** | **42개 이슈** |

---

## 🔴 P0 이슈 (배포 차단 - 8개)

### P0-S1: CSRF 토큰 미구현
**위치**: `page.tsx:81-87` (초기 fetch)  
**심각도**: 🔴 CRITICAL  
**문제**:
```typescript
// 현재 (WRONG)
fetch("/api/groups").then(r => r.json()).then(d => { if (d.ok) setGroups(...) });
fetch("/api/links").then(r => r.json())...
```
- GET 요청이지만 데이터 조회 후 클라이언트 상태 변경 → CSRF 공격 가능
- 다른 도메인에서 자동으로 발송될 수 있음

**해결**: 
```typescript
// 헤더에 X-CSRF-Token 추가
useEffect(() => {
  fetch("/api/csrf-token")
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        setCsrfToken(d.token);
        // 이후 모든 fetch에 헤더 추가
      }
    });
}, []);
```

---

### P0-S2: XSS 취약점 - dryRunResult 미검증
**위치**: `page.tsx:122-127` (dry-run 응답 처리)  
**심각도**: 🔴 CRITICAL  
**문제**:
```typescript
// 현재 (WRONG)
<div className="whitespace-pre-wrap">
  {dryRunResult.sample}  {/* 서버에서 온 메시지를 검증 없이 렌더링 */}
</div>
```
- 악의적인 사용자가 SMS에 `<script>` 태그 포함 가능
- XSS 공격으로 토큰 탈취/피싱 가능

**해결**:
```typescript
// DOMPurify 라이브러리 사용
import DOMPurify from 'dompurify';

<div className="whitespace-pre-wrap">
  {DOMPurify.sanitize(dryRunResult.sample, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  })}
</div>
```

---

### P0-S3: 주전화번호 평문 저장
**위치**: API `/api/groups/[id]/blast` (139-146줄)  
**심각도**: 🔴 CRITICAL  
**문제**:
```typescript
// 현재 (WRONG)
const personalizedMsg = message.replace("[전화번호]", contact.phone);
// contact.phone이 010-1234-5678처럼 평문 저장됨
```
- 개인정보 유출 위험
- 저장된 로그에도 노출됨

**해결**:
```typescript
// 클라이언트에서 마스킹
const maskedPhone = contact.phone
  ? contact.phone.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$4')
  : '';
// 010-****-5678로 표시
```

---

### P0-U1: 발송 전 확인 로직 부실
**위치**: `page.tsx:310-312` (발송 버튼 활성화 조건)  
**심각도**: 🔴 CRITICAL  
**문제**:
```typescript
// 현재 (WRONG)
<button 
  onClick={doSend}
  disabled={!message.trim() || sending}  // 오직 텍스트와 로딩 상태만 확인
>
```
- 미리보기 없이 바로 발송 가능 → 수백 명에게 오타 메시지 발송 가능
- 확인 체크박스도 없음

**해결**:
```typescript
// 2단계 확인 추가
1. 대상 확인 (dry-run) → dryRunResult 표시
2. 최종 확인 체크박스 + confirm() 다이얼로그

<button 
  onClick={doSend}
  disabled={!dryRunResult || !confirmed || sending}  // 미리보기 + 체크박스
>
  {dryRunResult ? `✓ 발송 (${dryRunResult.count}명)` : '대상 확인'}
</button>
```

---

### P0-B1: SMS 무한 발송 가능
**위치**: `page.tsx` 전체 + API  
**심각도**: 🔴 CRITICAL  
**문제**:
```typescript
// 현재 (WRONG)
// 같은 그룹에 몇 번이고 발송 가능
// 하루 최대 발송량 제한 없음
```
- 비용 폭증 (알리고 과금)
- 고객 스팸 신고 위험

**해결**:
```typescript
// Rate limiting 구현
// 1. 같은 그룹: 하루 5회 제한
// 2. 조직 전체: 하루 1,000명 제한
// DB에 발송 이력 저장 후 검사

const canSend = await checkRateLimit(groupId, orgId);
if (!canSend) {
  showError("하루 발송 횟수(5회)를 초과했습니다. 내일 다시 시도해주세요.");
  return;
}
```

---

### P0-E1: try-catch 부재
**위치**: `page.tsx:81-87` (초기 fetch)  
**심각도**: 🔴 CRITICAL  
**문제**:
```typescript
// 현재 (WRONG)
fetch("/api/groups")
  .then(r => r.json())
  .then(d => { if (d.ok) setGroups(...); })
  // .catch() 없음 → 네트워크 오류 시 화면 멈춤
```

**해결**:
```typescript
fetch("/api/groups")
  .then(r => r.json())
  .then(d => { if (d.ok) setGroups(...); else setError("그룹 로드 실패"); })
  .catch(err => {
    logger.error("[MessagesPage] groups fetch", { err });
    setError("그룹을 불러올 수 없습니다. 네트워크를 확인해주세요.");
  });
```

---

### P0-T1: 테스트 코드 부재
**위치**: 파일 미존재  
**심각도**: 🔴 CRITICAL  
**문제**:
- SMS/Email 발송 로직 테스트 불가
- 배포 전 검증 불가

**해결**:
```bash
# 생성할 파일
src/app/__tests__/messages.test.tsx

# 테스트 케이스
1. dry-run 시 count 반환 확인
2. 미리보기 미표시 시 발송 불가
3. CSRF 토큰 헤더 포함 확인
```

---

## 🟡 P1 이슈 (주요 수정 - 24개)

### 보안
| 번호 | 이슈 | 위치 | 해결법 |
|------|------|------|--------|
| P1-S4 | 입력값 검증 부재 (textarea) | `page.tsx:244` | 클라이언트 정규식 추가 (특수문자/이모지) |
| P1-S5 | 민감정보 노출 (알리고 키) | API 62-87 | localStorage 대신 서버 세션 저장 |

### 성능
| 번호 | 이슈 | 위치 | 해결법 |
|------|------|------|--------|
| P1-P1 | 무한 re-fetch (의존성 배열 없음) | `page.tsx:81` | `useEffect(..., [])` 추가 |
| P1-P2 | 리스트 메모이제이션 부재 | `page.tsx:190` | `useMemo(() => groups.map(...), [groups])` |

### 접근성
| 번호 | 이슈 | 위치 | 해결법 |
|------|------|------|--------|
| P1-A1 | aria-label 부재 (탭 버튼) | `page.tsx:46-53` | `<button aria-label="SMS 탭 선택">` |
| P1-A2 | label-input 미연결 | `page.tsx:239` | `<label htmlFor="message-textarea">` + `<textarea id="message-textarea">` |
| P1-A3 | 색상 대비 부족 | `page.tsx:240` | `text-gray-400` → `text-gray-600` |

### UX
| 번호 | 이슈 | 위치 | 해결법 |
|------|------|------|--------|
| P1-U2 | 에러 메시지 불명확 | API 40-50 | "사용할 수 없는 문자: @, #" 명시 |
| P1-U3 | 로딩 상태 부재 | `page.tsx:81-87` | 스켈레톤 로더 추가 |
| P1-U4 | 200명 제한 초과 UX | API 111-114 | 클라이언트 경고 메시지 추가 |

### 확장성
| 번호 | 이슈 | 위치 | 해결법 |
|------|------|------|--------|
| P1-E1 | 하드코딩 상수 | `page.tsx:18-34` | `constants.ts` 파일 분리 |
| P1-E2 | 컴포넌트 비대 (600줄) | `page.tsx:37-597` | `SmsTab.tsx`, `EmailTab.tsx` 분리 |
| P1-E3 | API 응답 타입 미정의 | `page.tsx:120-124` | `types.ts` 정의: `type DryRunResult = { ... }` |

### 에러처리
| 번호 | 이슈 | 위치 | 해결법 |
|------|------|------|--------|
| P1-E2 | 부분 실패 미처리 | API 157-182 | `failedCount > 0`일 때 재시도 옵션 제공 |
| P1-E3 | 네트워크 오류 미구분 | `page.tsx:142` | `getErrorMessage(err, "[SMS 발송]")` 함수 추가 |
| P1-E4 | SMS 설정 없을 때 경고만 | API 119-121 | 인라인 설정 폼 제공 (settings로 리다이렉트 대신) |

### 유지보수
| 번호 | 이슈 | 위치 | 해결법 |
|------|------|------|--------|
| P1-M1 | 변수명 불명확 | `page.tsx:75-77` | `linkNoCount` → `insertedLinksCount` |
| P1-M2 | 주석 부재 | 전체 | 복잡 로직에 주석 추가 (치환변수, 필터링) |

---

## 🟢 P2 이슈 (개선 - 10개)

### 성능
- 이미지 lazy loading 추가 (EmailTab의 썸네일)
- 불필요한 상태 변경 최소화

### 접근성
- 탭 키보드 네비게이션 (tabIndex)
- 포커스 시각화 (focus-visible)

### UX
- 이메일 예약 시간: 기본값 "현재 + 1분" 설정
- 발신번호 미인증 경고를 항상 표시

### 호환성
- datetime-local 브라우저 호환성 (Safari/IE fallback)

### 비즈니스
- 이메일 응답률 추적 (열람/클릭)
- A/B 테스트 기능 (Menu #38과 연동)

---

## 📋 작업 계획

### Phase 2: 10렌즈 토론 (2시간)
각 렌즈별 의사결정:
- 보안: CSRF 토큰 + XSS sanitize 방식 확정
- 성능: useMemo/useCallback 적용 범위 확정
- 접근성: WCAG AA 준수 방식 확정
- ...등등

### Phase 3: 구현 (2-3주)
**Wave 1: P0 긴급 수정 (5-6일)**
1. 보안 (CSRF/XSS) - 4시간
2. UX (발송확인) - 2시간
3. 에러처리 (try-catch) - 3시간
4. Rate limiting - 4시간
5. 테스트 기본 구조 - 2시간

**Wave 2: P1 주요 수정 (7-8일)**
1. 컴포넌트 분리 - 8시간
2. 접근성 - 3시간
3. 성능 - 2시간
4. 타입 정의/상수화 - 3시간

**Wave 3: P2 개선 (3-4일)**
1. lazy loading/호환성 - 2시간
2. 비즈니스 기능 (추적) - 4시간
3. A/B 테스트 연동 - 2시간

---

## ✅ 다음 단계

**선택지:**
1. ✅ **Phase 2로 진행** (10렌즈 토론 2시간) → Phase 3 구현
2. ⚡ **빠른 진행** (토론 생략, 작업지시서 자동 생성)
3. 📅 **일정 보류** (다른 메뉴 우선)

**추천**: 매뉴얼 #27 성공 경험을 살려 **Phase 2 진행 (2시간) → Phase 3 병렬 구현**하는 것을 추천합니다.

---

_분석일: 2026-05-23 (Menu #27 Wave 3 완료 직후)_  
_방법론: 절대법칙 (Phase 1 분석 완료)_  
_다음: Phase 2 토론 또는 Phase 3 구현 시작_
