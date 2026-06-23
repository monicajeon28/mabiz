# 판매원 자동메시지 생성기 E2E 테스트 계획

## Phase 1-5 완료 상태
- ✅ DB 스키마 마이그레이션 완료
- ✅ API 3개 엔드포인트 완성
- ✅ UI 5단계 마법사 모달 완성
- ✅ Contact 페이지 통합
- ✅ TypeScript 0 에러

## 라이브 테스트 시나리오

### Test 1: API 엔드포인트 테스트
```
1️⃣ GET /api/funnels/lens-strategies
   - 목표: L0-L10 렌즈 + 전략 로드
   - 예상: 200 OK, 10개 렌즈, 각 3가지 전략

2️⃣ POST /api/funnels/auto-create
   - 목표: Funnel + ScheduledSms 생성
   - 요청: contactId, psychologyLens, messages, schedule
   - 예상: 201 Created, funnelId 반환

3️⃣ GET /api/funnels/preview
   - 목표: 메시지 미리보기
   - 요청: contactId, lens, messages, startDate
   - 예상: 200 OK, 동적 변수 치환됨
```

### Test 2: UI 컴포넌트 테스트
```
1️⃣ Contact 상세 페이지 접속
   - 목표: 마법사 버튼 표시
   - 예상: "🚀 자동메시지 생성" 버튼 보임

2️⃣ 마법사 시작 클릭
   - 목표: 5단계 모달 오픈
   - 예상: Step 1/5 모달 표시

3️⃣ Step별 진행
   - Step 1: L0-L10 카드 클릭 가능
   - Step 2: 전략 3개 선택 가능
   - Step 3: Day 0-3 메시지 입력 가능
   - Step 4: 날짜/시간 선택 가능
   - Step 5: 최종 확인 + 생성 버튼
```

### Test 3: 데이터 흐름 테스트
```
1️⃣ 마법사로 메시지 생성
   - L6 (타이밍/손실회피) 선택
   - "긴박감 강조" 전략 선택
   - Day 0-3 메시지 입력
   - 내일부터 시작, 12시 발송

2️⃣ 데이터베이스 확인
   - Funnel 레코드 생성됨?
   - ScheduledSms 4개 레코드 생성됨?
   - createdByUserId 정상?
   - psychologyLens = 'L6'?

3️⃣ 발송 흐름 테스트 (향후)
   - ScheduledSms Cron 실행
   - Day 0-3 자동 발송
   - SMS 로그 기록
```

## 테스트 체크리스트

### 기능성 (Functionality)
- [ ] API 3개 모두 인증 통과
- [ ] 렌즈 10개 모두 로드
- [ ] 각 렌즈별 전략 3개 로드
- [ ] Funnel 생성 성공
- [ ] ScheduledSms 4개 생성 (Day 0-3)
- [ ] 동적 변수 {{고객명}} 치환됨

### UI/UX (User Experience)
- [ ] Contact 페이지에 마법사 버튼 표시
- [ ] 5단계 모달 부드럽게 작동
- [ ] 진행 바 시각적으로 명확
- [ ] 버튼 비활성화 로직 정상
- [ ] 에러 메시지 표시됨
- [ ] 성공 토스트 표시됨

### 성능 (Performance)
- [ ] API 응답 < 1초
- [ ] UI 렌더링 < 200ms
- [ ] 모달 열기 < 300ms
- [ ] 생성 버튼 < 2초 (네트워크)

### 심리학 검증 (Psychology)
- [ ] L0-L10 렌즈 한글 설명 정확
- [ ] PASONA Day별 메시지 구조 정확
- [ ] 각 렌즈별 전략 설득력 있음
- [ ] 동적 변수로 개인화됨

### 보안 (Security)
- [ ] organizationId 격리 (다른 조직 접근 불가)
- [ ] 인증되지 않은 사용자 401 반환
- [ ] 권한 없는 Contact 404 반환
- [ ] SQL 인젝션 방지됨

## 테스트 결과 기록

### Test Environment
- Node.js: v20+
- Next.js: v15+
- Database: PostgreSQL (Neon)
- Browser: Chrome Latest

### Test Date
- 계획: 2026-06-24
- 실행: TBD
- 완료: TBD

### Results
```
API 테스트: [ ] 대기
UI 테스트: [ ] 대기
데이터 흐름: [ ] 대기
성능 테스트: [ ] 대기
보안 테스트: [ ] 대기
```

## 다음 단계 (Phase 6)
1. Cron 자동화 (Day 0-3 자동 발송)
2. SMS/Email 채널별 발송
3. 분석 대시보드 추가
4. A/B 테스트 기능
5. 성과 리포팅
