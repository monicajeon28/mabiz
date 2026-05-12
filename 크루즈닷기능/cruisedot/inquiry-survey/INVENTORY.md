# 📁 기항지투어 + 문의/설문 시스템 파일 인벤토리

## 📊 폴더 구조 및 파일 목록

### 총 통계
- **총 파일 수**: 20개
- **API 엔드포인트**: 8개
- **Prisma 모델**: 6개 (ProductInquiry, ChatBotFlow, ChatBotQuestion, UserTripFeedback, InquiryCallLog, RagQuestion, BotGuideAnswer)
- **Zod 스키마**: 9개
- **UI 컴포넌트**: 1개 (InquiryForm.tsx)
- **어드민 페이지**: 3개

---

## 📂 파일 상세 목록

### 1. 공개 API (`api/public/`)

#### `route.ts` (294 라인)
**목적**: 구매 문의 공개 API (로그인 불필요)

**엔드포인트**: `POST /api/public/inquiry`

**기능**:
- 상품 문의 제출 (ProductInquiry 생성)
- 어필리에이트 추적 (managerId, agentId 결정)
- 사용자 자동 생성 (없을 시, password="1101")
- AffiliateLead 누적 기록

**입력 검증**: `publicInquirySchema`
```typescript
{
  productCode: string (필수)
  name: string (필수, 100자 이내)
  phone: string (필수, 정규화됨)
  message?: string (500자 이내)
  passportNumber?: string
  isPhoneConsultation?: boolean
  actualName?: string
  actualPhone?: string
  partnerId?: string
}
```

**데이터베이스 변경**:
- ProductInquiry 1개 생성 (status="pending")
- User 1개 생성 또는 업데이트
- AffiliateLead 1개 생성

---

#### `feedback.ts` (164 라인)
**목적**: 여행 피드백 GET/POST API

**엔드포인트**:
- `GET /api/feedback?tripId={id}` - 특정 여행 피드백 조회
- `GET /api/feedback` - 모든 피드백 조회
- `POST /api/feedback` - 피드백 생성/업데이트

**기능**:
- 사용자 세션 인증 필수
- 본인 여행만 조회 가능 (IDOR 방지)
- 만족도, 개선사항, 상세 피드백 저장

**입력 검증**: `tripFeedbackSchema`
```typescript
{
  tripId: number (필수)
  satisfactionScore?: number (1-5)
  improvementComments?: string (500자 이내)
  detailedFeedback?: Record<string, unknown>
}
```

---

### 2. 어드민 API (`api/admin/`)

#### `list.ts` (파일명: `route.ts`)
**목적**: 문의 목록 조회 API

**엔드포인트**: `GET /api/admin/inquiries`

**기능**:
- 어드민만 접근 가능 (role="admin")
- 문의 목록 조회 (필터링, 페이지네이션)
- 상태별, 담당자별 필터링

---

#### `get.ts` (파일명: `[inquiryId]/route.ts`)
**목적**: 문의 상세 조회/수정 API

**엔드포인트**:
- `GET /api/admin/inquiries/{inquiryId}` - 상세 조회
- `PUT /api/admin/inquiries/{inquiryId}` - 수정 (담당자 변경 등)
- `DELETE /api/admin/inquiries/{inquiryId}` - 삭제 (소프트 삭제)

---

#### `status.ts` (파일명: `[inquiryId]/status/route.ts`)
**목적**: 문의 상태 변경 API

**엔드포인트**: `PATCH /api/admin/inquiries/{inquiryId}/status`

**기능**:
- 상태 변경: pending → confirmed, cancelled
- 상태 감사 로그 기록

**입력 검증**: `inquiryStatusSchema`
```typescript
{
  status: "pending" | "confirmed" | "cancelled" (필수)
}
```

---

#### `confirm.ts` (325 라인) ⭐ **핵심 API**
**목적**: 구매 확정 + 자동화 API

**엔드포인트**: `POST /api/admin/inquiries/{inquiryId}/confirm`

**자동 처리**:
1. ProductInquiry 상태 확인 (pending만 처리)
2. 사용자 확보/생성 (비밀번호: "3800")
3. Trip 생성 (시작일 + 종료일)
4. Itinerary 자동 생성 (days만큼)
5. VisitedCountry 업데이트 (한국 제외)
6. APIS 스프레드시트 생성 (비동기)
7. tripCount 업데이트
8. tripCount >= 2 → RePurchaseTrigger 생성
9. ProductInquiry.status = "confirmed"

**입력 검증**: `inquiryConfirmSchema`
```typescript
{
  startDate: string (ISO datetime, 필수)
}
```

**생성되는 데이터**:
- Trip 1개
- Itinerary N개 (days만큼)
- VisitedCountry N개 (고유 국가만큼)
- RePurchaseTrigger (tripCount >= 2일 시)

---

#### `feedback.ts` (파일명: `api/admin/feedback/route.ts`)
**목적**: 어드민 피드백 관리 API

**엔드포인트**:
- `GET /api/admin/feedback` - 모든 피드백 조회 + 통계
- `DELETE /api/admin/feedback/{feedbackId}` - 피드백 삭제

**기능**:
- 모든 사용자의 피드백 조회 (어드민만)
- 만족도 분포 통계 계산
- 평균 점수, 총 개수 등 집계

---

### 3. 챗봇 API (`api/chat-bot/`)

#### `questions.ts` (95 라인)
**목적**: 챗봇 질문 관리 API

**엔드포인트**:
- `GET /api/admin/chat-bot/questions?flowId={id}` - 질문 목록
- `POST /api/admin/chat-bot/questions` - 질문 생성

**기능**:
- 플로우별 질문 조회 (order로 정렬)
- 새 질문 생성 (choice, text, multiple 타입)
- nextQuestionId로 네비게이션 구조 정의

**입력 검증**: `chatBotQuestionSchema`
```typescript
{
  flowId: number (필수)
  questionText: string (필수, 500자 이내)
  questionType: "choice" | "text" | "multiple" (기본: "choice")
  optionA?: string (100자 이내)
  optionB?: string (100자 이내)
  options?: string[] (다중선택지)
  nextQuestionIdA?: number
  nextQuestionIdB?: number
  nextQuestionIds?: Record<string, number>
  order?: number (기본: 0)
  isActive?: boolean (기본: true)
}
```

---

#### `start.ts` (파일명: `api/chat-bot/start/route.ts`)
**목적**: 챗봇 세션 시작 API

**엔드포인트**: `POST /api/chat-bot/start`

**기능**:
- ChatBotSession 생성 (sessionId, flowId, userId)
- 첫 질문 정보 반환

**입력 검증**: `chatBotSessionSchema`
```typescript
{
  flowId: number (필수)
  productCode?: string
  userPhone?: string
  userEmail?: string (유효한 이메일 형식)
}
```

---

#### `response.ts` (파일명: `api/chat-bot/response/route.ts`)
**목적**: 사용자 응답 기록 API

**엔드포인트**: `POST /api/chat-bot/response`

**기능**:
- ChatBotResponse 생성
- nextQuestionId 계산 및 반환
- 응답 시간 측정

**입력 검증**: `chatBotResponseSchema`
```typescript
{
  sessionId: string (필수)
  questionId: number (필수)
  selectedOption?: string (100자 이내)
  selectedText?: string (500자 이내)
  responseTime?: number
  nextQuestionId?: number
}
```

---

### 4. UI 컴포넌트 (`components/`)

#### `InquiryForm.tsx`
**목적**: 공개 문의 제출 폼 UI

**기능**:
- 성명 입력
- 전화번호 입력 (자동 정규화)
- 메시지 입력 (선택)
- 제출 버튼
- 유효성 검증
- 로딩 및 성공/오류 메시지

---

### 5. 어드민 페이지 (`pages/admin/`)

#### `inquiries.tsx`
**목적**: 문의 관리 어드민 페이지

**기능**:
- 문의 목록 조회 (테이블)
- 상태별 필터링 (pending, confirmed, cancelled)
- 담당자별 필터링
- 상세 조회 모달
- 상태 변경 버튼
- 구매 확정 버튼 (startDate 입력)
- 콜 로그 기록 폼

---

#### `chat-bot.tsx`
**목적**: 챗봇 플로우 관리 어드민 페이지

**기능**:
- ChatBotFlow 목록
- 새 플로우 생성
- 플로우 상세 조회
- 질문 목록 조회/추가
- 질문 순서 변경 (drag-and-drop)
- 다음 질문 네비게이션 설정
- 플로우 템플릿 저장/로드

---

#### `feedback.tsx`
**목적**: 피드백 관리 어드민 페이지

**기능**:
- 모든 피드백 조회 (테이블)
- 만족도 분포 차트
- 평균 점수 표시
- 개별 피드백 상세 조회
- 피드백 삭제
- CSV 내보내기

---

### 6. 라이브러리 (`lib/`)

#### `schemas/inquirySchema.ts` (118 라인)
**목적**: Zod 입력 검증 스키마

**스키마 목록**:
1. `publicInquirySchema` - 공개 문의 검증
2. `inquiryStatusSchema` - 상태 변경 검증
3. `inquiryConfirmSchema` - 구매 확정 검증
4. `inquiryCallLogSchema` - 콜 로그 검증
5. `tripFeedbackSchema` - 여행 피드백 검증
6. `chatBotFlowSchema` - 플로우 생성 검증
7. `chatBotQuestionSchema` - 질문 생성 검증
8. `chatBotResponseSchema` - 응답 기록 검증
9. `chatBotSessionSchema` - 세션 시작 검증

**모든 입력은 Zod로 검증됨** (Type-safe)

---

#### `utils/question-utils.ts`
**목적**: 챗봇 질문 유틸리티 함수

**기능**:
- nextQuestionId 계산
- 질문 네비게이션 로직
- 응답 유효성 검증

---

### 7. 데이터베이스 문서 (`db/`)

#### `MODELS.md` (300+ 라인)
**목적**: Prisma 모델 상세 문서

**포함 내용**:
- 6개 Prisma 모델 상세 설명
  - ProductInquiry (구매 문의)
  - ChatBotFlow (챗봇 플로우)
  - ChatBotQuestion (질문)
  - ChatBotResponse (응답)
  - ChatBotSession (세션)
  - UserTripFeedback (피드백)
  - InquiryCallLog (콜 로그)
  - RagQuestion (RAG 질문)
  - BotGuideAnswer (봇 답변)

- 필드별 설명
- 관계 정의
- 인덱싱 전략
- 상태 머신
- 주의사항

---

### 8. 데이터 (`data/`)

#### `ports.csv` (2+ 라인)
**목적**: 기항지 정보 데이터

**구조**:
```
port_slug | port_name_ko | country_ko | timezone | entry_requirements | transport_from_port | currency | sim_wifi | safety_notes | accessibility | peak_season
yokohama  | 요코하마      | 일본      | UTC+9   | ...                | ...                | JPY     | ...      | ...          | ...            | ...
```

**사용처**:
- Itinerary.location 자동 완성
- 기항지 가이드 생성
- 통화, 비자 정보 등

---

### 9. 문서 (`/`)

#### `README.md` (300+ 라인)
**목적**: 시스템 전체 가이드

**포함 내용**:
- 폴더 구조 및 파일 설명
- 문의 → 자동 구매확정 워크플로우
- 챗봇 플로우 네비게이션
- 여행 피드백 시스템
- ports.csv 참조
- 보안 체크리스트
- 성능 최적화 전략
- 테스트 시나리오
- 배포 체크리스트

---

#### `WORKFLOW.md` (400+ 라인)
**목적**: 상세 플로우 다이어그램

**포함 내용**:
1. 문의 제출 플로우 (상세 다이어그램)
2. 어드민 콜 로그 기록 (선택)
3. 구매 확정 + 자동화 (9단계)
4. 챗봇 플로우 네비게이션
5. 재구매 로직
6. 상태 머신
7. 에러 처리
8. 데이터 흐름 요약

---

#### `INVENTORY.md` (이 파일)
**목적**: 파일 인벤토리 및 통계

---

## 📋 API 엔드포인트 요약

| HTTP | 엔드포인트 | 기능 | 검증 |
|------|-----------|------|------|
| POST | /api/public/inquiry | 문의 제출 | publicInquirySchema |
| GET | /api/feedback | 피드백 조회 | - |
| POST | /api/feedback | 피드백 저장 | tripFeedbackSchema |
| GET | /api/admin/inquiries | 문의 목록 | - |
| GET | /api/admin/inquiries/{id} | 문의 상세 | - |
| PATCH | /api/admin/inquiries/{id}/status | 상태 변경 | inquiryStatusSchema |
| POST | /api/admin/inquiries/{id}/confirm | 구매 확정 ⭐ | inquiryConfirmSchema |
| GET | /api/admin/feedback | 피드백 관리 | - |
| GET | /api/admin/chat-bot/questions | 질문 목록 | - |
| POST | /api/admin/chat-bot/questions | 질문 생성 | chatBotQuestionSchema |
| POST | /api/chat-bot/start | 세션 시작 | chatBotSessionSchema |
| POST | /api/chat-bot/response | 응답 기록 | chatBotResponseSchema |

---

## 🔀 데이터 흐름 (상태 전이)

### 문의 → 구매확정
```
ProductInquiry
  pending ──[/admin/confirm]──> confirmed
  
User
  password: "1101" ──[/confirm]──> "3800"
  tripCount: 0 ──[/confirm]──> 1+ (increment)
  
Trip
  (없음) ──[/confirm]──> created
  
Itinerary
  (없음) ──[/confirm]──> N개 생성
  
VisitedCountry
  (없음) ──[/confirm]──> N개 upsert
  
RePurchaseTrigger
  (tripCount < 2일 시 없음) ──[tripCount >= 2]──> created
```

### 챗봇 플로우
```
ChatBotSession
  ONGOING ──[마지막 질문 도달]──> COMPLETED
  ONGOING ──[중도 이탈]──> ABANDONED
```

---

## 🔐 보안 체크리스트

✅ **Zod 검증**: 모든 API 입력 검증
✅ **CSRF 방지**: 어드민 API는 세션 기반
✅ **IDOR 방지**: 사용자 소유권 확인 (feedback 등)
✅ **에러 마스킹**: 민감정보 노출 금지
✅ **인증**: 어드민 API는 role="admin" 필수

---

## 📊 성능 특성

### 인덱스
- ProductInquiry: `(agentId, status, createdAt)`, `(productCode)`
- ChatBotQuestion: `(flowId, order)`
- ChatBotSession: `(userId)`, `(finalStatus)`
- UserTripFeedback: `(userId)`

### 복잡도
- 공개 문의: O(1) 생성 + O(N) 어필리에이트 조회 (N=어필리에이트 프로필 수)
- 구매 확정: O(N) Itinerary 생성 (N=여행 일수)
- 챗봇: O(1) 응답 기록

### 비동기 처리
- APIS 스프레드시트 생성: 비동기 (실패 무시)

---

## 🧪 테스트 케이스

### 기본 시나리오
1. ✅ 문의 제출 → ProductInquiry 생성
2. ✅ 구매 확정 → Trip + Itinerary + VisitedCountry 생성
3. ✅ 재구매 → RePurchaseTrigger 생성
4. ✅ 챗봇 → 질문 네비게이션
5. ✅ 피드백 → 저장 및 조회

### 엣지 케이스
1. ❓ 이미 confirmed 문의 재확정 → 400 에러
2. ❓ 존재하지 않는 inquiryId → 404 에러
3. ❓ 미로그인 피드백 조회 → 401 에러
4. ❓ 다른 사용자 피드백 조회 → 403 에러

---

## 🚀 배포 체크리스트

- [ ] TypeScript 컴파일 성공
- [ ] Zod 스키마 로드 확인
- [ ] Prisma 마이그레이션 적용
- [ ] 모든 API 엔드포인트 테스트
- [ ] 어드민 페이지 동작 확인
- [ ] 재구매 로직 검증
- [ ] APIS 생성 확인
- [ ] 보안 테스트 (CSRF, IDOR)
- [ ] npm run build 성공
- [ ] 커밋 완료

---

## 📝 추가 메모

### 주요 특징
1. **완전 자동화**: 구매 확정 시 Trip, Itinerary, VisitedCountry 등 모두 자동 생성
2. **재구매 추적**: tripCount >= 2일 시 자동으로 RepurchaseTrigger 생성
3. **다중 플로우**: ChatBotFlow로 여러 챗봇 시나리오 지원
4. **비동기 처리**: APIS 생성은 구매 확정과 분리 (실패 무시)

### 미래 확장
- RAG 기반 질문 수집 (RagQuestion)
- AI 생성 가이드 답변 캐싱 (BotGuideAnswer)
- 챗봇 분석 대시보드 (session 통계)
- 피드백 AI 분석 (sentiment 분석)

---

## 📞 참고자료

- `README.md` - 시스템 개요 및 사용 가이드
- `WORKFLOW.md` - 상세 플로우 다이어그램
- `db/MODELS.md` - Prisma 모델 상세 문서
- `lib/schemas/inquirySchema.ts` - Zod 검증 스키마
