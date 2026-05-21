# P2 실전 UX 테스트 시나리오

## 개요

이 문서는 실제 사용자 환경에서 P2 변경이 문제 없는지 검증하는 실제 테스트 케이스를 제공합니다.  
개발자 로컬 테스트, QA 통합 테스트, 사용자 UAT 단계별 구성.

---

## 테스트 환경 구성

### 필요한 사용자 계정

```
1. GLOBAL_ADMIN 계정
   ID: admin@test.com / PW: admin123
   권한: /admin/*, /dashboard/*, /payments
   
2. OWNER 계정 (지사장)
   ID: owner@test.com / PW: owner123
   권한: /dashboard/*, /team/affiliate, /payments
   
3. AGENT 계정 (영업사원)
   ID: agent@test.com / PW: agent123
   권한: /dashboard, /contacts
   
4. PUBLIC 계정 (없음)
   상태: 로그인하지 않은 상태
   권한: /pnr/[id] (공개 고객 경로만)
```

### 테스트 기기

```
데스크톱 (필수):
- Chrome 최신판 (기본)
- Firefox 최신판 (호환성)
- Safari (Mac)

모바일 (권장):
- iPhone 12+ (iOS 16+)
- Samsung Galaxy (Android 12+)
- 5G 및 4G LTE 연결 테스트

네트워크:
- 빠른 연결 (다운로드 25Mbps+)
- 느린 연결 (Throttling: 3G 느린 속도)
- 오프라인 (네트워크 연결 없음, DevTools)
```

---

## 1. 개발자 로컬 테스트 (Dev Mode)

### 테스트 1.1: PNR 조회 — 비로그인 고객 경로 (Happy Path)

**시나리오**: 크루즈 승객이 휴대폰에서 PNR 조회

```
제목: 비로그인 상태에서 PNR 조회 (공개 경로)
시간: 3분
도구: Chrome DevTools, Lighthouse

[SETUP]
1. Chrome 새 시크릿 창 열기 (로그인 상태 제거)
2. URL: http://localhost:3000/pnr/12345
3. DevTools 열기 (F12)
4. Network 탭 활성화
5. Performance 탭 준비 (Lighthouse)

[TEST STEPS]

Step 1: 페이지 로드 (로그인 없음)
├─ 예상: 로딩 화면 표시
├─ 예상: 전화번호 입력 폼
├─ 확인 사항:
│  ✓ 로딩 시간 < 500ms (FCP)
│  ✓ /api/auth/me 호출 없음 (Network 탭 확인)
│  ✓ 입력 폼이 명확함
│  ✓ 오류 메시지 없음
│
└─ 측정:
   Network 탭: 요청 2-3개만 (이전 4개)
   Performance: LCP < 800ms

Step 2: 전화번호 입력
├─ 입력: "010-1234-5678"
├─ 예상: "본인 확인 중..." 로딩
├─ 확인 사항:
│  ✓ 로딩 인디케이터 표시
│  ✓ /api/pnr/customer/12345?phone=... 호출 (1회)
│  ✓ 응답 시간 < 200ms
│  ✓ 여행자 정보 테이블 표시
│
└─ 측정:
   요청 수: 1회 (이전 2회)
   응답 시간: 150-200ms 범위

Step 3: 객실 배정
├─ 액션: 여행자별 객실 번호 입력
├─        "제출" 버튼 클릭
├─ 예상: "객실 배정이 완료되었습니다" 토스트
├─ 확인 사항:
│  ✓ 제출 후 API 응답 < 1초
│  ✓ 토스트 메시지 3초 표시 후 사라짐
│  ✓ 폼 비활성화 (재제출 방지)
│  ✓ 새로고침 후에도 데이터 유지
│
└─ 측정:
   API 응답: 200-300ms

[PASS CRITERIA]
✅ /api/auth/me 호출 0회
✅ 전체 로딩 < 800ms
✅ 객실 배정 성공
✅ 에러 없음
```

### 테스트 1.2: PNR 조회 — 관리자 경로 (기존 호환성)

**시나리오**: 영업사원이 관리자 권한으로 고객 PNR 조회

```
제목: AGENT가 관리자 모드로 PNR 조회
시간: 3분
도구: Chrome, Network 탭

[SETUP]
1. AGENT 계정으로 로그인 (agent@test.com)
2. DevTools 열기
3. 고객 예약번호 URL 접근: /pnr/12345

[ISSUE]
⚠️ 현재: /pnr/[id]는 공개 경로 (isAdminMode 제거됨)
   → AGENT가 관리자 UI에 접근 불가
   → 공개 고객 폼만 표시됨 (이상 동작)

[SOLUTION PATH]
✅ 예상: AGENT가 /dashboard/pnr/[id]로 리다이렉트
   또는 새로운 어드민 PNR 경로에서 조회

[TEST]
- 만약 /dashboard/pnr/[id]가 존재하면:
  1. AGENT 로그인 후 /pnr/12345 접근
  2. 자동으로 /dashboard/pnr/12345로 리다이렉트되는가?
  3. 관리자 UI (수정, 삭제 등) 표시되는가?
  
⚠️ 만약 없으면 P2 배포 금지 (관리자 기능 손상)
```

### 테스트 1.3: 파트너 신청 페이지 — 권한 검증

**시나리오**: GLOBAL_ADMIN과 AGENT의 접근 제어

```
제목: 파트너 신청 페이지 권한 검증
시간: 5분
도구: Chrome, Network 탭

[SETUP]
1. 2개 탭 준비 (탭 1 = GLOBAL_ADMIN, 탭 2 = AGENT)
2. DevTools 열기 (Network 탭)
3. 성능 측정 준비

[TEST 1: GLOBAL_ADMIN 접근]
Step 1: 탭 1에서 GLOBAL_ADMIN 로그인
├─ ID: admin@test.com
│
Step 2: /admin/partner-applications 접근
├─ 예상: 신청서 목록 표시
├─ 확인:
│  ✓ 페이지 로드 < 500ms (authChecked 제거)
│  ✓ /api/auth/me 호출 0회
│  ✓ 승인/반려 버튼 활성화
│  ✓ 신청서 필터링 가능
│
Step 3: 신청서 승인
├─ 액션: "승인" 버튼 클릭
├─ 예상: 신청서 상태 변경 + 목록 갱신
├─ 확인:
│  ✓ API 호출 1회 (승인 요청)
│  ✓ 응답 < 300ms
│  ✓ 목록 즉시 갱신
│  ✓ "승인이 완료되었습니다" 토스트

[TEST 2: AGENT 접근 제어]
Step 1: 탭 2에서 AGENT 로그인
├─ ID: agent@test.com
│
Step 2: /admin/partner-applications 접근
├─ 예상: 리다이렉트 (/)
├─ 확인:
│  ✓ 페이지 로드 < 200ms (Layout 검증)
│  ✓ 즉시 리다이렉트 (깜박임 없음)
│  ✓ 신청서 데이터 노출 없음 (보안)
│  ✓ URL이 /로 변경됨

[PASS CRITERIA]
✅ GLOBAL_ADMIN 권한 있음 → 기능 모두 작동
✅ AGENT 권한 없음 → 빠른 리다이렉트
✅ 로딩 시간 25% 개선
✅ 보안: 권한 없는 접근 차단
```

### 테스트 1.4: 제휴사 현황 페이지 — N+1 해결 확인

**시나리오**: 3개의 중복 `/api/auth/me` 호출이 제거되었는지 확인

```
제목: 제휴사 현황 페이지 API 호출 최적화
시간: 5분
도구: Chrome Network 탭

[SETUP]
1. OWNER 계정으로 로그인
2. DevTools Network 탭 열기
3. 캐시 비우기 (Hard Reload)
4. /team/affiliate 접근

[CURRENT BEHAVIOR]
❌ 변경 전:
   useEffect 1 → /api/auth/me 호출
   useEffect 2 → /api/auth/me 호출 (중복)
   useEffect 3 → /api/auth/me 호출 (중복)
   = 총 3회 + 데이터 API 1회 = 4회 요청

[P2 EXPECTED]
✅ 변경 후:
   useEffect 1, 2, 3 → /api/auth/me 호출 제거
   = 데이터 API 1회만
   = 3회 요청 감소 (시간: 300-400ms 단축)

[TEST VERIFICATION]
Step 1: Network 탭에서 /api/auth/me 검색
├─ 필터: 'api/auth/me'
├─ 예상 결과: 0개 요청 (이전 3개)
├─ ❌ 만약 3개 호출 보임: P2 미적용 (배포 금지)

Step 2: 데이터 API만 확인
├─ /api/affiliates 또는 /api/team 검색
├─ 예상: 1-2개 요청만 (병렬 요청 가능)
├─ 응답 시간 측정: 이전 1,200ms → 목표 950ms

Step 3: 필터 변경 시 성능
├─ 액션: 담당자 필터 변경
├─ 예상: API 호출 1회 (이전 1+3회)
├─ 응답 시간: < 200ms
├─ ✓ 로딩 인디케이터 표시 (스켈레톤)

[PASS CRITERIA]
✅ /api/auth/me 호출 0회 (이전 3회)
✅ 페이지 로딩 20% 이상 개선
✅ 필터 변경 시 단일 API 호출
✅ 권한 검증 로직 작동 (데이터 노출 안 됨)
```

### 테스트 1.5: 결제 현황 페이지 — 민감 정보 보안

**시나리오**: 권한 없는 사용자가 정산금 정보에 접근하는지 확인

```
제목: 결제 현황 페이지 권한 검증 및 보안
시간: 5분
도구: Chrome, DevTools

[SETUP 1: 권한 있는 경우]
1. GLOBAL_ADMIN 로그인
2. /payments 접근
3. DevTools Network 탭 활성화

[TEST 1: 권한 있음 (GLOBAL_ADMIN)]
Step 1: 페이지 로드
├─ 예상: 정산금 정보 표시
│  ├─ 정산금액
│  ├─ 세금
│  ├─ 입금 계좌
│  └─ 통계 차트
├─ 확인:
│  ✓ 데이터 로드 < 500ms
│  ✓ /api/auth/me 호출 0회 (이전 1회)
│  ✓ 권한 검증 로딩 없음

Step 2: 엑셀 다운로드
├─ 액션: "다운로드" 버튼 클릭
├─ 예상: 파일 다운로드 시작
├─ 확인:
│  ✓ Content-Disposition: attachment
│  ✓ XLSX 파일 생성

[SETUP 2: 권한 없는 경우]
1. 새 시크릿 창 (비로그인)
2. /payments 직접 접근

[TEST 2: 권한 없음 (비로그인)]
Step 1: 페이지 접근
├─ 예상: 리다이렉트 (/sign-in)
├─ 확인:
│  ✓ 페이지 로드 < 200ms
│  ✓ 정산금 정보 노출 0 (보안)
│  ✓ URL이 /sign-in으로 변경
│  ✓ 빈 페이지 표시 안 됨

[SETUP 3: 권한 부족한 경우]
1. AGENT 로그인
2. /payments 접근

[TEST 3: 권한 부족 (AGENT)]
Step 1: 페이지 접근
├─ 예상: 리다이렉트 또는 에러 표시
├─ 확인:
│  ✓ 정산금 정보 노출 0
│  ✓ 권한 오류 메시지 (선택)

[SECURITY CHECKLIST]
✅ 비로그인 → 민감 정보 0% 노출
✅ AGENT → 정산금 정보 0% 노출
✅ 관리자만 정산금 접근 가능
✅ 다운로드 파일 권한 검증됨
```

---

## 2. QA 통합 테스트

### 테스트 2.1: 다중 탭 세션 동기화

**시나리오**: 한 탭에서 로그아웃 → 다른 탭 새로고침

```
제목: 다중 탭 세션 동기화 (Critical)
시간: 10분
도구: Chrome, 2개 탭

[SETUP]
1. 탭 A: /admin/partner-applications 열기 (GLOBAL_ADMIN 로그인)
2. 탭 B: /dashboard 열기 (같은 계정)
3. DevTools Network 탭 활성화 (탭 A)

[SCENARIO: 탭 A에서 로그아웃]

Timeline:
T0: 탭 A에서 /admin/partner-applications 표시 중
    탭 B에서 /dashboard 표시 중
    
T1: 탭 A에서 로그아웃 클릭
    └─ POST /api/auth/logout
       └─ 서버 세션 무효화 (Redis 삭제)
       
T2: 탭 B에서 F5 (새로고침) 클릭
    (사용자가 탭을 전환하지 않았다고 가정)
    └─ 새 요청 생성
    
T3: 탭 B 새로고침 처리
    ├─ [현재 방식]
    │  ├─ 서버: 세션 검증 OK (아직 유효)
    │  ├─ 클라이언트: /api/auth/me 호출
    │  ├─ 서버: 401 응답 (세션 무효화됨)
    │  ├─ 클라이언트: authChecked = false
    │  └─ 로딩 화면 → 리다이렉트 (500ms)
    │
    └─ [P2 방식]
       ├─ 서버: 세션 검증 → 무효화됨 감지
       ├─ 서버: 즉시 /sign-in로 리다이렉트
       └─ 클라이언트: 리다이렉트 (100ms)

[DETAILED STEPS]

Step 1: 탭 A에서 로그아웃
├─ 액션: 사용자 메뉴 > "로그아웃"
├─ Network 탭 기록:
│  POST /api/auth/logout → 200 OK
│  (Set-Cookie: sessionId=; Max-Age=0)
│
├─ 예상:
│  ✓ 탭 A → 로그인 페이지로 리다이렉트
│  ✓ 서버 세션 무효화됨

Step 2: 탭 B에서 새로고침
├─ 액션: F5 (강력 새로고침)
├─ Network 탭 기록:
│  GET /dashboard → 307 Redirect to /sign-in
│  (P2에서는 서버에서 즉시 리다이렉트)
│
├─ 예상:
│  ✓ 로딩 없이 즉시 /sign-in로 이동
│  ✓ 에러 메시지 없음
│  ✓ 빈 페이지 표시 안 됨

Step 3: 성능 측정
├─ [현재] authChecked 대기 시간: ~500ms
├─ [P2]   Layout 검증만: ~100ms
└─ 개선율: 80% 단축

[PASS CRITERIA]
✅ 탭 A 로그아웃 → 탭 B 새로고침 시 즉시 리다이렉트
✅ 로딩 < 200ms
✅ 빈 페이지 표시 안 됨
✅ 에러 메시지 없음
```

### 테스트 2.2: 권한 변경 동기화 (다중 탭)

**시나리오**: 관리자가 사용자 권한을 상향 → 사용자 탭에 반영

```
제목: 다중 탭 권한 변경 동기화
시간: 15분
도구: Chrome, 2개 탭, 관리자 콘솔

[SETUP]
1. 탭 A: AGENT 계정으로 로그인
   URL: /dashboard
   
2. 탭 B: 관리자 계정으로 로그인
   URL: /admin/organizations (사용자 권한 관리)
   
3. DevTools Network 탭 활성화

[SCENARIO: 관리자가 권한 상향]

Timeline:
T0: 탭 A (AGENT)
    ├─ /dashboard 표시
    ├─ /team/affiliate 접근 불가 (OWNER+ 필요)
    
T1: 탭 B (관리자)
    ├─ 사용자 권한 변경: AGENT → OWNER
    ├─ POST /api/organizations/users/[id]/role
    └─ 서버: DB 업데이트, next-auth 세션 갱신 신호
    
T2: 탭 A에서 /team/affiliate 접근 시도
    ├─ [현재 방식]
    │  ├─ Layout 검증: 캐시된 역할 = AGENT
    │  ├─ /api/auth/me 호출 → { role: AGENT }
    │  ├─ 접근 거부 → /dashboard로 리다이렉트
    │  └─ 권한 변경 미반영 (캐시 때문에 최대 50초)
    │
    └─ [P2 방식]
       ├─ Layout 검증: 캐시된 역할 = AGENT (여전함)
       ├─ /api/auth/me 호출 제거됨
       ├─ 권한 변경은 여전히 캐시 문제
       └─ ⚠️ 해결책: next-auth useSession() 갱신 필요

[DETAILED STEPS]

Step 1: 탭 A (AGENT) 초기 상태
├─ URL: /dashboard
├─ 사이드바에서 "제휴사 현황" 보이지 않음 (접근 권한 없음)
├─ 만약 /team/affiliate URL 직접 입력
│  └─ /dashboard로 리다이렉트 (Layout 검증)

Step 2: 탭 B (관리자)에서 권한 상향
├─ URL: /admin/organizations
├─ 액션:
│  1. 사용자 검색: "agent@test.com"
│  2. 역할 변경: AGENT → OWNER
│  3. "저장" 클릭
│
├─ Network 탭:
│  PATCH /api/organizations/users/[id] → 200 OK
│  
├─ 예상 (next-auth 갱신 시 작동):
│  ✓ next-auth broadcast 신호
│  ✓ 세션 갱신 요청

Step 3: 탭 A에서 권한 확인
├─ 액션: F5 (새로고침)
├─ 예상:
│  [P0-5 현재]
│  - /api/auth/me 호출 → { role: OWNER }
│  - 사이드바 "제휴사 현황" 표시됨
│  - /team/affiliate 접근 가능
│  
│  [P2 이후]
│  - Layout 캐시 확인 → AGENT (여전함)
│  - ⚠️ 권한 미반영 (캐시 문제)
│  
│  [P2 + next-auth 갱신]
│  - useSession() 호출 → 권한 갱신
│  - 사이드바 재렌더링 → OWNER 권한 표시
│  - /team/affiliate 접근 가능

[ISSUE & SOLUTION]
🔴 문제: P2에서 /api/auth/me 제거 → 권한 변경 감지 지연
   (Layout 캐시 때문에 최대 50초)
   
✅ 해결책:
   1. next-auth useSession() 자동 갱신 (30초마다)
   2. 또는 WebSocket/Polling으로 권한 변경 실시간 감지
   3. 또는 "페이지 새로고침 필요" 배너 표시

[PASS CRITERIA]
⚠️ 현재: 권한 변경이 최대 50초 지연 (허용 가능)
✅ 추천: next-auth 갱신 메커니즘 추가 (30초)
❌ 불가: 사용자가 수동으로 새로고침 필요 (UX 나쁨)
```

### 테스트 2.3: 네트워크 오류 복구

**시나리오**: 로딩 중 네트워크 끊김 → 재연결

```
제목: 네트워크 오류 복구
시간: 10분
도구: Chrome DevTools, Network Throttling

[SETUP]
1. DevTools Network 탭 열기
2. Throttling: "Offline" 선택
3. GLOBAL_ADMIN 로그인 후 /admin/partner-applications 접근

[SCENARIO 1: 오프라인 상태에서 페이지 접근]

Step 1: 오프라인 상태로 전환
├─ Chrome DevTools
│  └─ Network 탭 > Throttling > "Offline"
│
├─ 예상:
│  ✓ "인터넷 연결이 없습니다" 에러 (또는 토스트)
│  ✓ 페이지 부분 렌더링 (SSR 캐시)
│  ✓ 버튼 비활성화

Step 2: 재연결
├─ 액션: Throttling > "No throttling"로 변경
├─ 예상:
│  ✓ 자동 재로드 (optional)
│  ✓ 또는 "재시도" 버튼 활성화
│  ✓ 데이터 로드 완료

[SCENARIO 2: 로딩 중 네트워크 끊김]

Step 1: 느린 네트워크에서 로드
├─ Throttling: "Slow 3G"
├─ /admin/partner-applications 접근
├─ 로딩 중...

Step 2: 네트워크 오프라인으로 전환
├─ 액션: DevTools Network 탭에서 "Offline" 선택
├─ 예상:
│  ✓ 타임아웃 에러 메시지
│  ✓ "재시도" 버튼 표시

Step 3: 재연결 후 재시도
├─ 액션: Throttling 정상화 > "재시도" 클릭
├─ 예상:
│  ✓ 데이터 로드 성공
│  ✓ 에러 메시지 사라짐

[PASS CRITERIA]
✅ 오프라인 에러 메시지 명확함
✅ 재시도 버튼 기능 정상
✅ 재연결 후 자동 로드 (또는 버튼으로 로드)
✅ 타임아웃 시간 < 30초
```

### 테스트 2.4: 권한별 접근 제어 매트릭스

**시나리오**: 모든 역할의 접근 제어가 정상 작동하는지 확인

```
제목: 권한별 접근 제어 (Regression Test)
시간: 20분
도구: Chrome, 4개 계정

[TEST MATRIX]

| URL | GLOBAL_ADMIN | OWNER | AGENT | PUBLIC | 결과 |
|-----|------------|-------|-------|--------|------|
| /admin/partner-applications | ✅ OK | ❌ 리다이렉트 | ❌ 리다이렉트 | ❌ /sign-in | P2에서 동일 |
| /admin/affiliate-sales | ✅ OK | ❌ 리다이렉트 | ❌ 리다이렉트 | ❌ /sign-in | P2에서 동일 |
| /team/affiliate | ✅ OK | ✅ OK | ❌ 리다이렉트 | ❌ /sign-in | P2에서 동일 |
| /payments | ✅ OK | ✅ OK | ❌ 리다이렉트 | ❌ /sign-in | P2에서 동일 |
| /pnr/[id] (공개) | ✅ OK | ✅ OK | ✅ OK | ✅ OK (폰검증) | P2 동일 |
| /dashboard | ✅ OK | ✅ OK | ✅ OK | ❌ /sign-in | P2 동일 |

[TEST EXECUTION]

각 행마다 체크:
1. URL을 각 역할로 접근
2. Network 탭에서 리다이렉트 상태 코드 확인
3. 리다이렉트 시간 < 200ms 확인
4. 깜박임 없는지 확인
```

---

## 3. 사용자 UAT (User Acceptance Testing)

### UAT 3.1: 실제 사용자 피드백 (5명)

**대상**: 각 역할별 실제 사용자

```
제목: 실제 사용자 피드백 수집
시간: 2시간 (역할당 20분)
인원: 5명 (GLOBAL_ADMIN 1, OWNER 2, AGENT 2)

[GLOBAL_ADMIN]
사용자: 관리팀장
작업:
  1. /admin/partner-applications에서 신청서 승인/반려 (5개)
  2. /payments에서 정산금 확인 및 엑셀 다운로드
  3. /admin/affiliate-sales-by-partner에서 통계 확인
  
피드백 질문:
  - "페이지 로딩이 빨라졌는가?" (1-10점)
  - "기능이 변했는가?" (YES/NO)
  - "에러가 발생했는가?" (YES/NO + 상세 설명)
  - "접근 제어가 정상인가?" (YES/NO)

[OWNER (지사장)]
사용자: A 지사장, B 지사장
작업:
  1. /team/affiliate에서 담당자 조회 및 SMS 발송
  2. /payments에서 지사 정산금 확인
  3. /dashboard에서 주간 리포트 생성
  
피드백 질문:
  - "제휴사 현황 페이지가 더 빠른가?"
  - "다중 탭에서 세션이 잘 관리되는가?"
  - "마지막으로 "에러가 있었는가?"

[AGENT (영업사원)]
사용자: C 영업사원, D 영업사원
작업:
  1. /pnr/[id]에서 고객 PNR 조회 및 객실 배정 (3회)
  2. /dashboard에서 일일 목표 관리
  3. 필요시 관리자 도움 요청
  
피드백 질문:
  - "고객 PNR 조회 시간이 개선됐는가?"
  - "객실 배정 기능이 정상인가?"
  - "권한 거부 메시지가 명확한가?"

[FEEDBACK COLLECTION]
음성 또는 영상 기록:
├─ 사용자의 목소리 트톤 ("빠르네!", "여전하네")
├─ 시간 지연 (생각하는 시간 vs 로딩 시간)
├─ 에러 발생 시 반응
└─ 제안사항 (UI 개선, 기능 추가)

[PASS CRITERIA]
✅ 모든 사용자: "페이지 로딩이 빨라졌거나 동일하다" (최소 8/10)
✅ 모든 사용자: "기능이 변하지 않았다" (NO 응답)
✅ 에러 없음 또는 기대하는 에러만 발생
✅ 권한 거부가 명확하고 신속함
```

### UAT 3.2: 모바일 사용자 피드백

**대상**: 모바일 앱 사용자

```
제목: 모바일 환경 UX 검증
시간: 1시간
기기: iPhone, Android 각 1명

[MOBILE TEST]

iPhone 사용자:
  - Safari에서 /pnr/[id] 접근
  - 전화번호 입력 (키보드 표시)
  - 객실 배정 폼 (스크롤, 선택)
  - 제출 (토스트 메시지)
  
Android 사용자:
  - Chrome에서 /team/affiliate 접근
  - 필터 변경 (드롭다운)
  - SMS 발송 (모달)
  - 로딩 인디케이터 (진행 상황)

피드백 질문:
  - "화면 터치 대상이 충분한가?" (버튼 크기)
  - "입력 폼이 쉬운가?" (키보드, 아이콘)
  - "로딩이 명확한가?" (스켈레톤, 프로그레스)
  - "느린 네트워크에서 작동하는가?" (3G 테스트)

[PASS CRITERIA]
✅ 터치 대상 >= 44x44px
✅ 모바일 키보드 자동 표시/숨김
✅ 반응형 레이아웃 (스크롤 필요 없음)
✅ 느린 네트워크에서 로딩 < 3초
```

---

## 4. 배포 후 모니터링 (Go-Live + 24h)

### 모니터링 4.1: 즉시 경보 (1시간)

```
제목: P2 배포 직후 모니터링
시간: 배포 후 1시간
담당: DevOps + QA

[CHECK LIST]

[ ] 에러율 확인 (Sentry)
    - 401 에러 급증? (< 5% 증가 OK)
    - 403 에러 급증? (< 3% 증가 OK)
    - 5xx 에러? (발생 시 즉시 알림)

[ ] 성능 메트릭 (Lighthouse CI)
    - LCP > 2초? (경고)
    - CLS > 0.1? (경고)
    - FID > 100ms? (경고)

[ ] 데이터베이스 (Monitoring)
    - 쿼리 시간 감소? (예상: 15-20% 개선)
    - 연결 풀 사용률? (예상: 5-10% 감소)
    - 슬로우 쿼리? (100ms 이상)

[ ] 서버 리소스
    - CPU 사용률 < 70%
    - 메모리 < 80%
    - 네트워크 I/O 정상

[ ] 사용자 피드백 (Slack, 이메일)
    - 예상치 못한 버그?
    - 성능 불만?
    - 접근 제어 오류?

[ROLLBACK CRITERIA]
🔴 즉시 롤백:
  1. 401/403 에러 > 10% 증가
  2. 5xx 에러 > 1% 발생
  3. LCP > 3초 (심각한 성능 악화)
  4. 무한 리다이렉트 루프
  5. 비로그인 사용자 민감 정보 노출

[ROLLBACK PROCEDURE]
  1. git revert [P2-commit]
  2. npm run build
  3. Deploy to Vercel (automatic)
  4. Verify rollback (5분)
  5. Post-mortem (분석)
```

### 모니터링 4.2: 확대된 모니터링 (24시간)

```
제목: P2 배포 후 24시간 모니터링
담당: DevOps + Engineering

[DAILY CHECKPOINTS]

T0 (배포 직후):
  ✓ 에러율 정상 확인
  ✓ 성능 메트릭 개선 확인
  ✓ 사용자 피드백 모니터링 시작

T4h (4시간 후):
  ✓ 401/403 에러 추이 확인
  ✓ 다중 탭 세션 문제 모니터링
  ✓ 프로덕션 로그 분석

T12h (12시간 후):
  ✓ 월간 패턴 분석 시작
  ✓ Core Web Vitals 개선율 확인
  ✓ DB 비용 절감 추산

T24h (24시간 후):
  ✓ 전체 메트릭 분석 리포트
  ✓ UAT 최종 피드백 수집
  ✓ 향후 계획 (P3 준비)

[SUCCESS CRITERIA]
✅ 401/403 에러 정상 범위
✅ 성능 메트릭 20%+ 개선
✅ 사용자 피드백 긍정적
✅ 버그 0개 (또는 minor만)
✅ 롤백 불필요
```

---

## 체크리스트 요약

```
개발자 로컬 테스트 (Dev Mode):
[ ] PNR 조회 (공개 고객)
[ ] PNR 조회 (관리자 경로) ⚠️ 신규 경로 확인
[ ] 파트너 신청 (권한 검증)
[ ] 제휴사 현황 (N+1 해결)
[ ] 결제 현황 (민감 정보 보안)

QA 통합 테스트:
[ ] 다중 탭 세션 동기화
[ ] 권한 변경 동기화
[ ] 네트워크 오류 복구
[ ] 권한별 접근 제어 매트릭스

사용자 UAT:
[ ] 각 역할별 5명 피드백
[ ] 모바일 환경 테스트
[ ] 느린 네트워크 테스트

배포 후 모니터링:
[ ] 즉시 경보 (1시간)
[ ] 확대 모니터링 (24시간)
[ ] 성공 기준 확인
```

---

## 다음 단계

```
P2 배포 성공 후:

1. /dashboard/pnr/[id] 어드민 경로 신규 추가 (P2.1)
2. next-auth 세션 갱신 자동화 (P2.2)
3. 다중 조직 권한 캐시 전략 (P2.3)
4. Rate Limiting 추가 (P3)

성공 메트릭:
- 월간 DB 쿼리 46,500회 제거
- 페이지 로딩 20-25% 개선
- 사용자 만족도 증가
- 운영 비용 감소 ($4,450/년)
```
