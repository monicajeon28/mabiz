# 기항지투어 + 문의/설문 시스템

## 📋 폴더 구조

```
cruisedot/inquiry-survey/
├── api/
│   ├── public/               (공개 문의/설문 API)
│   │   ├── route.ts         (POST: 구매 문의 제출)
│   │   └── feedback.ts      (GET/POST: 여행 피드백)
│   ├── admin/               (어드민 관리 API)
│   │   ├── list.ts          (GET: 문의 목록 조회)
│   │   ├── get.ts           (GET: 문의 상세 조회)
│   │   ├── status.ts        (PATCH: 문의 상태 변경)
│   │   ├── confirm.ts       (POST: 구매 확정 + 자동화)
│   │   └── feedback.ts      (GET/DELETE: 피드백 관리)
│   └── chat-bot/            (챗봇 API)
│       ├── questions.ts     (GET/POST: 질문 관리)
│       ├── start.ts         (POST: 세션 시작)
│       └── response.ts      (POST: 사용자 응답 기록)
├── components/
│   └── InquiryForm.tsx      (공개 문의 폼 UI)
├── pages/admin/             (어드민 페이지)
│   ├── inquiries.tsx        (문의 목록 + 상세 + 상태 관리)
│   ├── chat-bot.tsx         (챗봇 플로우 관리)
│   └── feedback.tsx         (피드백 관리 및 분석)
├── lib/
│   ├── schemas/
│   │   └── inquirySchema.ts (Zod 검증 스키마)
│   └── utils/
│       └── question-utils.ts (챗봇 질문 유틸)
├── db/
│   └── MODELS.md            (Prisma 모델 문서)
├── data/
│   └── ports.csv            (기항지 데이터)
└── README.md                (이 파일)
```

---

## 🔄 문의 → 자동 구매확정 워크플로우

### 1단계: 공개 문의 제출 (`/api/public/inquiry`)

**역할**: 누구나 로그인 없이 상품 문의

**요청**:
```typescript
POST /api/public/inquiry
{
  productCode: "CRUISE_JAPAN_7D",
  name: "김철수",
  phone: "010-1234-5678",
  message: "상품 상세 정보 문의입니다.",
  passportNumber: "M12345678", // 선택사항
  isPhoneConsultation: false    // 전화상담 신청 여부
}
```

**응답**:
```json
{
  "ok": true,
  "inquiryId": 42,
  "message": "문의가 접수되었습니다. 곧 연락드리겠습니다."
}
```

**자동 처리**:
- `ProductInquiry` 생성 (status = `pending`)
- 사용자 없으면 User 자동 생성 (password = `1101`)
- `AffiliateLead` 생성 (어필리에이트 추적)

---

### 2단계: 어드민 콜 로그 기록 (선택사항)

**역할**: 어드민이 고객과 통화 후 결과 기록

**요청**:
```typescript
POST /api/admin/inquiries/{inquiryId}/call-log
{
  result: "REACHED",        // REACHED | NOT_REACHED | CALLBACK | INVALID
  memo: "고객이 다음주 월요일 구매 예정",
  nextContactAt: "2026-05-19T10:00:00Z" // 다음 연락 예정일
}
```

**자동 처리**:
- `InquiryCallLog` 기록

---

### 3단계: 구매 확정 (`/api/admin/inquiries/{id}/confirm`)

**역할**: 어드민이 문의를 구매 확정으로 전환

**요청**:
```typescript
POST /api/admin/inquiries/{inquiryId}/confirm
{
  startDate: "2026-06-01T00:00:00Z" // 여행 시작일 (필수)
}
```

**응답**:
```json
{
  "ok": true,
  "message": "구매 확정 처리 완료. 크루즈 가이드 지니가 활성화되었습니다.",
  "trip": {
    "id": 1,
    "cruiseName": "Oceania Riviera",
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-06-08T00:00:00Z"
  },
  "user": {
    "id": 5,
    "name": "김철수",
    "phone": "010-1234-5678",
    "tripCount": 1
  },
  "isRePurchase": false
}
```

**자동 처리**:

1. **사용자 처리**:
   - 기존 사용자면 연결, 없으면 생성
   - 비밀번호 `3800` 초기화 (시험용 → 구매 활성화)
   - `onboarded: false` (새 여행이므로 온보딩 필요)

2. **여행 생성**:
   - `Trip` 생성 (상품 정보 기반)
   - 시작일: 입력받은 `startDate`
   - 종료일: `startDate + (days - 1)`
   - 상태: `Upcoming`

3. **일정 자동 생성**:
   - `Itinerary` 생성 (일일 1개씩)
   - day 1~days
   - 기항지, 국가, 도착/출발 시간 자동 입력

4. **방문 국가 업데이트**:
   - `VisitedCountry` upsert
   - 한국 제외, PortVisit/Embarkation/Disembarkation만 포함
   - visitCount 증가

5. **APIS 스프레드시트 생성** (비동기):
   - Google Sheets API 호출
   - 여행 정보 자동 입력

6. **재구매 체크**:
   - `tripCount >= 2`이면 `RePurchaseTrigger` 생성
   - `converted: true` 자동 설정

7. **상태 변경**:
   - `ProductInquiry.status: pending → confirmed`
   - `ProductInquiry.userId` 연결

---

## 💬 챗봇 플로우 네비게이션

### 플로우 구조

```
ChatBotFlow (플로우 = 채팅봇 시나리오)
└── startQuestionId (첫 질문)
    └── ChatBotQuestion (질문)
        ├── optionA → nextQuestionIdA
        ├── optionB → nextQuestionIdB
        └── [finalPageUrl 도달]
```

### 예시: "구매 의도 진단" 플로우

```
Question 1: "크루즈 여행 경험이 있으신가요?"
├─ optionA (있음) → Question 2 (상급자 경로)
└─ optionB (없음) → Question 3 (초급자 경로)

Question 2: "몇 박의 크루즈를 선호하신가요?"
├─ optionA (3박 이하) → Question 4 (단기)
└─ optionB (5박 이상) → Question 5 (장기)

...

Question N: (마지막 질문)
└─ finalPageUrl → 상품 추천 페이지로 리다이렉트
```

### 사용자 경로

1. **세션 시작**: `POST /api/chat-bot/start`
   - `ChatBotSession` 생성 (sessionId, flowId, userId)
   
2. **질문 표시**: `GET /api/chat-bot/question/{questionId}`
   - `ChatBotQuestion` 조회
   - UI에 optionA, optionB 또는 options[] 표시

3. **응답 기록**: `POST /api/chat-bot/response`
   - `ChatBotResponse` 생성
   - selectedOption, responseTime 저장
   - `nextQuestionId` 반환 (또는 null = 완료)

4. **마지막 도달**: `finalPageUrl` 리다이렉트
   - `ChatBotSession.finalStatus: COMPLETED`
   - 사용자를 상품 추천 페이지로 이동

---

## 📊 여행 피드백 시스템

### 피드백 제출 (`/api/feedback`)

**역할**: 여행 종료 후 사용자 만족도 조사

**요청**:
```typescript
POST /api/feedback
{
  tripId: 1,
  satisfactionScore: 5,
  improvementComments: "정보가 매우 유용했습니다!",
  detailedFeedback: {
    guide_quality: 5,
    accommodation: 4,
    food: 3,
    transportation: 5
  }
}
```

**자동 처리**:
- `UserTripFeedback` upsert (여행당 1개)
- 만족도, 의견, 상세 피드백 저장

### 어드민 피드백 조회 (`/api/admin/feedback`)

**역할**: 어드민이 모든 피드백 조회 및 분석

```typescript
GET /api/admin/feedback?sort=createdAt&limit=50
```

**응답**:
```json
{
  "ok": true,
  "feedbacks": [
    {
      "id": 1,
      "tripId": 1,
      "userId": 5,
      "satisfactionScore": 5,
      "improvementComments": "정보가 매우 유용했습니다!",
      "createdAt": "2026-06-09T14:30:00Z"
    }
  ],
  "stats": {
    "avgScore": 4.2,
    "totalCount": 150,
    "scoreDistribution": {
      "5": 80,
      "4": 50,
      "3": 15,
      "2": 3,
      "1": 2
    }
  }
}
```

---

## 📁 데이터 참조

### ports.csv (기항지 정보)

```csv
port_slug,port_name_ko,country_ko,timezone,entry_requirements,transport_from_port,currency,sim_wifi,safety_notes,accessibility,peak_season
yokohama,요코하마,일본,UTC+9,"한국여권 무비자 ≤90d","JR/택시 ¥5,000 내외",JPY,"eSIM 가능/항만 Wi-Fi","치안 양호","휠체어 진입 가능","3–5월, 9–11월"
```

**사용처**:
- Itinerary.location이 요코하마 → 자동으로 일본, JPY, 무비자 정보 채움
- 기항지 가이드 생성 시 참조

---

## 🔒 보안 체크리스트

### CSRF 방지
- 모든 POST/PATCH/DELETE는 CSRF 토큰 검증 필수
- 어드민 API는 세션 기반 인증 필수

### IDOR 방지
- 피드백 조회 시 `trip.userId === session.userId` 확인
- 어드민 API는 `role === 'admin'` 확인

### 입력 검증 (Zod)
- `publicInquirySchema`: 문의 제출 검증
- `tripFeedbackSchema`: 피드백 검증
- `chatBotResponseSchema`: 챗봇 응답 검증

### 에러 마스킹
- 민감정보(전화번호, 여권번호) 로깅 금지
- API 응답에 스택트레이스 노출 금지

---

## 📈 성능 최적화

### 인덱스
- `ProductInquiry`: `(agentId, status, createdAt)`, `(productCode)`
- `ChatBotQuestion`: `(flowId, order)`
- `ChatBotSession`: `(userId)`, `(finalStatus)`
- `UserTripFeedback`: `(userId)`, `(tripId)`

### 캐싱
- ChatBotFlow (거의 변경 없음) → 메모리 캐시
- BotGuideAnswer (AI 생성) → Redis 캐시 (key 기반)

### 비동기 처리
- APIS 스프레드시트 생성 → 구매 확정과 분리
- 어필리에이트 리드 생성 → 배경 작업

---

## 🧪 테스트 시나리오

### 시나리오 1: 일반 사용자 문의 → 구매 확정

```bash
# 1. 문의 제출
curl -X POST http://localhost:3000/api/public/inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "productCode": "CRUISE_JAPAN_7D",
    "name": "김철수",
    "phone": "010-1234-5678",
    "message": "상세 정보 요청"
  }'
# 응답: inquiryId = 42

# 2. 어드민 구매 확정
curl -X POST http://localhost:3000/api/admin/inquiries/42/confirm \
  -H "Cookie: cg.sid.v2={session-id}" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-06-01T00:00:00Z"
  }'
# 응답: trip.id = 1, user.tripCount = 1

# 3. DB 검증
SELECT * FROM ProductInquiry WHERE id = 42;
-- status = 'confirmed'

SELECT * FROM Trip WHERE id = 1;
-- startDate = 2026-06-01, endDate = 2026-06-08

SELECT * FROM Itinerary WHERE tripId = 1 ORDER BY day;
-- 7개 행 (day 1~7)

SELECT * FROM VisitedCountry WHERE userId = 5;
-- 일본 등 방문 국가
```

### 시나리오 2: 재구매 고객 (tripCount >= 2)

```bash
# 첫 구매 후 재구매
# tripCount = 2 → RePurchaseTrigger 자동 생성

SELECT * FROM RePurchaseTrigger WHERE userId = 5;
-- converted: true
```

### 시나리오 3: 챗봇 플로우

```bash
# 1. 세션 시작
curl -X POST http://localhost:3000/api/chat-bot/start \
  -H "Content-Type: application/json" \
  -d '{
    "flowId": 1,
    "productCode": "CRUISE_JAPAN_7D"
  }'
# 응답: sessionId = "sess_abc123"

# 2. 첫 질문 표시
curl http://localhost:3000/api/chat-bot/question/1
# 응답: questionText, optionA, optionB, nextQuestionIdA, nextQuestionIdB

# 3. 사용자 응답 기록
curl -X POST http://localhost:3000/api/chat-bot/response \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_abc123",
    "questionId": 1,
    "selectedOption": "A",
    "responseTime": 5000
  }'
# 응답: nextQuestionId = 2 (또는 null = 완료)

# 4. 다음 질문 표시 / 또는 finalPageUrl로 리다이렉트
```

### 시나리오 4: 여행 피드백

```bash
# 1. 피드백 제출
curl -X POST http://localhost:3000/api/feedback \
  -H "Cookie: cg.sid.v2={session-id}" \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": 1,
    "satisfactionScore": 5,
    "improvementComments": "최고입니다!"
  }'
# 응답: feedback.id = 1

# 2. 어드민이 피드백 조회
curl http://localhost:3000/api/admin/feedback \
  -H "Cookie: cg.sid.v2={admin-session-id}"
# 응답: 모든 피드백 + 통계
```

---

## 🚀 배포 체크리스트

- [ ] TypeScript 컴파일 성공 (`npm run build`)
- [ ] Zod 스키마 로드 (타입 추론 정상)
- [ ] Prisma 마이그레이션 적용
- [ ] 모든 API 엔드포인트 테스트
- [ ] 어드민 페이지 동작 확인
- [ ] 재구매 로직 검증 (tripCount >= 2)
- [ ] APIS 스프레드시트 생성 확인
- [ ] 보안 테스트 (CSRF, IDOR)
- [ ] 커밋 완료

---

## 📞 연락처 및 지원

**문제 발생 시**:
1. `/db/MODELS.md` 에서 데이터 흐름 확인
2. `/lib/schemas/inquirySchema.ts` 에서 입력 검증 확인
3. 해당 API 파일에서 로직 확인

**추가 기능**:
- 전화상담 신청 (`isPhoneConsultation: true`)
- 어필리에이트 추적 (`affiliate_code` 쿠키)
- RAG 질문 수집 (`RagQuestion` 모델)
- 봇 가이드 답변 캐싱 (`BotGuideAnswer` 모델)
