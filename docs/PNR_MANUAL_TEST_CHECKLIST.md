# PNR 페이지 P2-5 수동 테스트 체크리스트

## Pre-Test Setup

필수 사항:
- [ ] Node 18+ 설치 확인 (`node --version`)
- [ ] npm 9+ 설치 확인 (`npm --version`)
- [ ] `npm install` 완료
- [ ] `npm run build` 성공 (TypeScript 에러 0개)
- [ ] `npm run dev` 실행
- [ ] http://localhost:3000/pnr/1 접속 가능 확인
- [ ] 브라우저 DevTools 열기 (F12)
  - Network 탭으로 API 호출 추적
  - Console 탭으로 로그 확인
  - Application 탭으로 로컬 스토리지 확인

---

## T1: 에러 메시지 표준화 (보안)

### 테스트 케이스 1.1: 본인 확인 실패 - 존재하지 않는 전화번호

**목적**: 에러 메시지가 사용자 친화적이며 기술 정보를 노출하지 않는지 확인

**단계**:
1. http://localhost:3000/pnr/1 접속
2. 전화번호 입력란에 존재하지 않는 번호 입력: `010-9999-9999`
3. "본인 확인" 버튼 클릭
4. DevTools Network 탭 확인

**검증 항목**:
- [ ] 에러 메시지 표시: "예약 정보를 찾을 수 없거나 본인 확인에 실패했습니다" (또는 유사한 일반 메시지)
- [ ] 에러 메시지에 다음 용어 **없음**:
  - "Prisma error"
  - "Database error"
  - "Cannot read property"
  - "null reference"
  - "Unexpected token"
- [ ] DevTools Network → POST 응답 JSON에 기술 정보 없음
- [ ] Console에 error 로그 있음 (사용자 보이지 않음)

**예상 결과**:
```
에러 메시지 (표시됨): "예약 정보를 찾을 수 없거나 본인 확인에 실패했습니다"
DevTools Network: {"ok": false, "message": "예약 정보를 찾을 수 없거나..."}
DevTools Console: [ERROR] [PNR Verify Phone] Error: ...
```

---

### 테스트 케이스 1.2: 저장 실패 - 여행자 정보 제출

**목적**: 저장 실패 시 에러 메시지 표준화 확인

**단계**:
1. 본인 확인 완료 (유효한 전화번호로)
2. 여행자 정보 입력
3. "저장" 버튼 클릭
4. DevTools Network 탭에서 POST /api/pnr/customer/submit 응답 확인

**검증 항목**:
- [ ] 성공 또는 실패 여부와 관계없이 메시지가 일반적이고 명확함
- [ ] 기술 용어 노출 없음: "Transaction failed", "Foreign key constraint", "Deadlock" 등
- [ ] HTTP 상태 코드 정상 (200, 400, 500 등)

---

## T2: null coalescing 일관성 (성능)

### 테스트 케이스 2.1: 주민번호 입력 안 함 - null vs 빈 문자열

**목적**: 선택적 필드가 null로 처리되는지 확인 (빈 문자열 아님)

**단계**:
1. 여행자 추가 (동행자)
2. 이름만 입력: "김영희"
3. 주민번호: 입력하지 않음 (비움)
4. "저장" 버튼 클릭
5. DevTools Network → POST 요청 본문 확인

**검증 항목**:
- [ ] DevTools Network → Request Body에서 확인:
  ```json
  {
    "reservationId": 1,
    "travelers": [
      {
        "korName": "홍길동",
        "residentNum": "000000-0000000",
        "phone": "010-1234-5678",
        "roomNumber": 1
      },
      {
        "korName": "김영희",
        "residentNum": null,  // ✅ null이어야 함 (""이 아님)
        "phone": null,         // ✅ null이어야 함
        "roomNumber": 1
      }
    ]
  }
  ```
- [ ] 데이터베이스에 null이 저장됨 (빈 문자열 아님)

**검증 방법**:
- DevTools Network → 요청 본문 JSON 확인
- 또는 DevTools Console에서: `JSON.stringify(travelers)`로 확인

---

### 테스트 케이스 2.2: 방 번호 기본값 - roomNumber 연산자

**목적**: `roomNumber || 1` 대신 `roomNumber ?? 1` 사용 확인

**단계**:
1. 새 여행자 추가
2. 방 번호가 1로 자동 설정되었는지 확인
3. 방 번호 필드에서 값 확인

**검증 항목**:
- [ ] 여행자 추가 시 roomNumber 기본값: 1
- [ ] roomNumber가 0 또는 falsy 값이어도 올바르게 처리됨
- [ ] 코드 리뷰: `roomNumber ?? 1` 사용 (not `||`)

---

## T3: Constants 활용 (유지보수)

### 테스트 케이스 3.1: 메시지 중앙화

**목적**: 에러 메시지가 상수에서 참조되는지 확인

**단계**:
1. 소스 코드 확인:
   - `src/lib/pnr-errors.ts` 또는 유사 파일 확인
   - `ERROR_MESSAGES` 객체 존재 확인
2. 페이지 실행 중 에러 발생 시 메시지 확인

**검증 항목**:
- [ ] `src/lib/pnr-errors.ts` 파일 존재
- [ ] `ERROR_MESSAGES` 객체에 다음 키 포함:
  - `LOAD_FAILED`
  - `SUBMISSION_FAILED`
  - `PHONE_VERIFICATION_FAILED`
  - 등등
- [ ] `page.tsx` 또는 `route.ts`에서 하드코딩 메시지 없음
- [ ] 모든 에러 메시지가 `ERROR_MESSAGES.*` 형식으로 참조

**코드 검증**:
```typescript
// ✅ 올바른 예
const message = ERROR_MESSAGES.LOAD_FAILED;

// ❌ 하드코딩 (금지)
const message = '예약 정보를 불러오는 중 오류가 발생했습니다.';
```

---

### 테스트 케이스 3.2: 네트워크 설정 상수화

**목적**: 네트워크 타임아웃 및 재시도 설정이 상수로 관리되는지 확인

**단계**:
1. 소스 코드 확인:
   - `src/lib/fetch-utils.ts` 또는 `src/lib/pnr-*` 파일 확인
   - `NETWORK_CONFIG` 또는 유사 객체 확인

**검증 항목**:
- [ ] Constants 파일에 네트워크 설정 존재:
  ```typescript
  const NETWORK_CONFIG = {
    MAX_RETRIES: 3,
    TIMEOUT_MS: 10000,
    // 등
  };
  ```
- [ ] `fetchWithRetry` 호출에서 상수 사용:
  ```typescript
  // ✅ 올바른 예
  fetchWithRetry(url, options, { 
    maxRetries: NETWORK_CONFIG.MAX_RETRIES, 
    timeoutMs: NETWORK_CONFIG.TIMEOUT_MS 
  });
  
  // ❌ 하드코딩 (금지)
  fetchWithRetry(url, options, { maxRetries: 3, timeoutMs: 10000 });
  ```

---

## T4: Zod strict 모드 (타입안전)

### 테스트 케이스 4.1: 추가 필드 거부

**목적**: API가 스키마에 정의되지 않은 필드를 거부하는지 확인

**단계**:
1. DevTools Console에서 직접 API 호출:
   ```javascript
   fetch('/api/pnr/customer/submit', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'include',
     body: JSON.stringify({
       reservationId: 1,
       travelers: [{
         korName: '홍길동',
         residentNum: '000000-0000000',
         phone: '010-1234-5678',
         roomNumber: 1,
         admin: true,  // 추가 필드 (권한 상승 시도)
         roomColor: '#FF0000',  // UI-only 필드
       }],
     }),
   }).then(r => r.json()).then(console.log);
   ```

**검증 항목**:
- [ ] HTTP 상태: 400 (Bad Request) 또는 422 (Unprocessable Entity)
- [ ] 응답 메시지: "입력하신 정보가 올바르지 않습니다" 또는 유사 메시지
- [ ] 추가 필드가 무시되거나 거부됨
- [ ] 권한 상승 불가능

**예상 응답**:
```json
{
  "ok": false,
  "message": "입력하신 정보가 올바르지 않습니다"
}
```

---

### 테스트 케이스 4.2: roomColor 필드 분리

**목적**: UI-only 필드가 서버에 저장되지 않는지 확인

**단계**:
1. 여행자 추가 후 색상 표시 확인
2. 저장 버튼 클릭
3. DevTools Network → POST 요청 확인
4. GET /api/pnr/customer/[id] 응답 확인

**검증 항목**:
- [ ] POST 요청 본문에 roomColor 필드 없음:
  ```json
  {
    "travelers": [
      {
        "korName": "홍길동",
        "residentNum": "000000-0000000",
        "phone": "010-1234-5678",
        "roomNumber": 1
        // roomColor 없음
      }
    ]
  }
  ```
- [ ] 클라이언트 상태 (page.tsx)에는 roomColor 있음 (UI-only):
  ```typescript
  interface TravelerWithColor extends Traveler {
    roomColor: string; // UI-only
  }
  ```
- [ ] 서버 응답에 roomColor 없음 (DB 저장 안 됨)

---

### 테스트 케이스 4.3: 주민번호 형식 검증

**목적**: Zod 스키마가 주민번호 형식을 검증하는지 확인

**단계**:
1. 여행자 이름 입력: "홍길동"
2. 주민번호에 잘못된 형식 입력: "12345" (너무 짧음)
3. "저장" 버튼 클릭

**검증 항목**:
- [ ] 에러 메시지 표시 (클라이언트 또는 서버):
  - 클라이언트: "올바른 형식의 주민등록번호를 입력해주세요"
  - 또는 서버: 400 응답
- [ ] 기술 용어 없음 (예: "Zod validation failed")
- [ ] 폼 제출 안 됨

---

## T5: 테스트 커버리지

### 테스트 케이스 5.1: Jest 테스트 실행

**목적**: 단위 테스트가 성공하는지 확인

**단계**:
1. 터미널에서 실행:
   ```bash
   npm run test -- pnr
   ```

**검증 항목**:
- [ ] 테스트 결과: ✅ PASS (모든 테스트)
- [ ] 테스트 케이스 수: 최소 10개 이상
- [ ] 실패한 테스트: 0개
- [ ] 경고: 0개

**예상 출력**:
```
PASS  src/app/pnr/__tests__/validators.test.ts
  PNR Validators
    validateTraveler - 필드 검증
      ✓ should return error for missing korName (대표자) (2ms)
      ✓ should accept valid companion traveler without residentNum (1ms)
      ...
  ✓ 15 tests passed (50ms)

PASS  src/app/api/pnr/customer/__tests__/submit.test.ts
  POST /api/pnr/customer/submit
    [T1] 에러 메시지 표준화
      ✓ should return generic error message on server failure (5ms)
      ...
  ✓ 18 tests passed (100ms)

Tests: 33 passed, 33 total
```

---

### 테스트 케이스 5.2: 빌드 검증

**목적**: TypeScript 컴파일 및 빌드 성공 확인

**단계**:
1. 터미널에서 실행:
   ```bash
   npm run build
   ```

**검증 항목**:
- [ ] 빌드 결과: ✅ Success
- [ ] TypeScript 에러: 0개
- [ ] 경고: 0개 (또는 최소화)
- [ ] 생성된 `.next` 폴더 크기: 합리적 (>50MB 아님)

---

## T6: 통합 시나리오 (E2E 시뮬레이션)

### 시나리오 1: 정상 흐름 - 3명 여행자, 2개 방

**단계**:
1. http://localhost:3000/pnr/1 접속
2. 본인 확인: "010-1111-1111" (유효한 전화번호)
3. 대표자 정보 확인 및 수정
4. 동행자 추가: "김영희", 방 1
5. 동행자 추가: "이순신", 방 2
6. "저장" 클릭

**검증 항목**:
- [ ] 각 단계에서 에러 메시지 없음
- [ ] 성공 메시지 표시: "PNR 정보 등록 완료"
- [ ] 다음 단계 버튼: "여권 정보 등록하러 가기" 활성화
- [ ] DevTools Network: 4개 API 호출 (본인확인 + 저장 + APIS 큐 생성 + 감사로그)

---

### 시나리오 2: 검증 실패 흐름

**단계**:
1. 여행자 이름 빈 채로 두기
2. "저장" 클릭

**검증 항목**:
- [ ] 에러 메시지: "대표자의 이름을 입력해주세요"
- [ ] 폼 제출 안 됨
- [ ] API 호출 안 됨

---

## 최종 검증 (배포 전 체크리스트)

### 코드 품질
- [ ] `npm run build` 성공 (TypeScript 에러 0개)
- [ ] `npm run test -- pnr` 성공 (모든 테스트 PASS)
- [ ] `npm run lint` 경고 최소화 (또는 0개)

### 보안
- [ ] 에러 메시지에 기술 정보 노출 없음
- [ ] API 응답에 PII (개인정보) 마스킹됨 (주민번호 일부만 표시 등)
- [ ] IDOR 방지: 권한 없는 예약 접근 불가
- [ ] CSRF 토큰: credentials 'include' 확인

### 성능
- [ ] 페이지 로드 시간: 2초 이하
- [ ] API 응답 시간: 1초 이하
- [ ] null coalescing 사용 (|| 아님)
- [ ] 불필요한 재렌더링 없음 (React DevTools Profiler)

### 사용자 경험
- [ ] 모바일 반응형 확인 (iPhone SE, Pixel)
- [ ] 로딩 상태 명확함 (스피너 등)
- [ ] 에러 메시지 이해하기 쉬움
- [ ] 접근성: 스크린 리더 호환 (aria-label 등)

---

## 배포 승인 체크리스트

### Phase 1: Code Quality
- [ ] 소스 코드 리뷰 완료
- [ ] ESLint 경고 0개
- [ ] TypeScript 엄격 모드 패스

### Phase 2: Testing
- [ ] 유닛 테스트: PASS (33/33)
- [ ] 통합 테스트: PASS (6개 시나리오)
- [ ] 수동 테스트: PASS (체크리스트 전부)
- [ ] 브라우저 호환성: Chrome, Firefox, Safari

### Phase 3: Security
- [ ] 에러 메시지 표준화: ✅
- [ ] 권한 검증 (RBAC): ✅
- [ ] IDOR 방지: ✅
- [ ] XSS 방지: ✅
- [ ] CSRF 토큰: ✅

### Phase 4: Performance
- [ ] 번들 크기: 증가 없음 (또는 <10KB)
- [ ] Lighthouse 성능 점수: 85+
- [ ] Core Web Vitals 합격

### Phase 5: Documentation
- [ ] README.md 업데이트: ✅
- [ ] API 문서: ✅
- [ ] 테스트 케이스 문서: ✅

---

## 최종 서명

| 항목 | 체크 | 담당자 | 날짜 |
|------|------|--------|------|
| 코드 리뷰 | [ ] | | |
| 기능 테스트 | [ ] | | |
| 보안 검토 | [ ] | | |
| 성능 최적화 | [ ] | | |
| 배포 승인 | [ ] | | |

---

## 배포 준비도 점수

**현재**: P2-5 구현 전 (0%)
**목표**: 100% (모든 체크리스트 완료)

| 카테고리 | 목표 | 현재 | 진행률 |
|---------|------|------|--------|
| 유닛 테스트 | 33/33 PASS | 0/33 | 0% |
| 통합 테스트 | 6/6 PASS | 0/6 | 0% |
| 수동 테스트 | 25/25 체크 | 0/25 | 0% |
| 빌드 | Success | ⏳ | - |
| 보안 | All Clear | ⏳ | - |
| **종합** | 100% | **0%** | **진행 중** |

---

## 참고 자료

- [PNR 페이지 구현 가이드](../src/app/pnr/README.md)
- [Jest 테스트 작성 가이드](https://jestjs.io/docs/getting-started)
- [Next.js API 라우트 테스트](https://nextjs.org/docs/testing)
- [Zod 검증 라이브러리](https://zod.dev/)
