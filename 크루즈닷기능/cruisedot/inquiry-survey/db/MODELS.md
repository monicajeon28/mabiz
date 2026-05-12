# 문의/설문 시스템 Prisma 모델

## 1. ProductInquiry (구매 문의)
```prisma
model ProductInquiry {
  id                 Int
  userId             Int?               // 사용자 ID (선택사항)
  name               String             // 고객명
  phone              String             // 연락처 (정규화됨)
  status             String @default("pending") // pending → confirmed
  productCode        String             // 상품코드
  managerId          Int?               // 어필리에이트 대리점장 ID
  agentId            Int?               // 어필리에이트 판매원 ID
  createdAt          DateTime @default(now())
  updatedAt          DateTime
  message            String?            // 추가 메시지
  passportNumber     String?            // 여권번호 (선택사항)
  createdByAdminId   Int?               // 관리자가 생성한 경우
  createdByProfileId Int?               // 어필리에이트 프로필이 생성한 경우
}
```

**상태머신**: `pending` → `confirmed`
- 어드민이 `/admin/inquiries/{id}/confirm` 호출 시 자동으로 `confirmed`로 변경

**자동 트리거**:
- `confirmed` 상태일 때:
  - Trip 생성 (여행)
  - Itinerary 생성 (일일 일정)
  - VisitedCountry 업데이트
  - APIS 스프레드시트 자동 생성
  - 사용자 비밀번호 3800으로 초기화
  - tripCount >= 2이면 RePurchaseTrigger 생성

---

## 2. ChatBotFlow (챗봇 플로우)
```prisma
model ChatBotFlow {
  id              Int
  name            String             // 플로우명 (예: "AI 지니 채팅봇(구매)")
  category        String @default("AI 지니 채팅봇(구매)")
  description     String?
  startQuestionId Int?               // 시작 질문 ID
  finalPageUrl    String?            // 완료 후 리다이렉트 URL
  isActive        Boolean @default(true)
  order           Int @default(0)
  productCode     String?            // 특정 상품에 연결
  shareToken      String? @unique    // 공유 링크용 토큰
  isPublic        Boolean @default(false)
  isTemplate      Boolean @default(false) // 템플릿 여부
  createdBy       Int?
  createdAt       DateTime
  updatedAt       DateTime
  
  // 관계
  ChatBotQuestion ChatBotQuestion[]
  ChatBotSession  ChatBotSession[]
}
```

**네비게이션**:
- `startQuestionId` → 첫 질문 시작
- 각 질문의 `nextQuestionIdA`, `nextQuestionIdB`로 분기
- 마지막 질문 도달 → `finalPageUrl`로 리다이렉트

---

## 3. ChatBotQuestion (챗봇 질문)
```prisma
model ChatBotQuestion {
  id              Int
  flowId          Int                // ChatBotFlow 참조
  questionText    String             // 질문 텍스트
  questionType    String @default("choice") // choice, text, multiple
  spinType        String?            // 질문 애니메이션 타입
  information     String?            // 질문 설명
  optionA         String?            // 선택지 A
  optionB         String?            // 선택지 B
  options         Json?              // 다중선택지 (JSON 배열)
  nextQuestionIdA Int?               // optionA 선택 시 다음 질문
  nextQuestionIdB Int?               // optionB 선택 시 다음 질문
  nextQuestionIds Json?              // 다중선택지의 다음 질문 맵
  order           Int @default(0)    // 질문 순서 (같은 Flow 내에서)
  isActive        Boolean @default(true)
  createdAt       DateTime
  updatedAt       DateTime
  
  // 관계
  ChatBotFlow     ChatBotFlow
  ChatBotResponse ChatBotResponse[]
}
```

**네비게이션 로직**:
```
questionType = "choice" → optionA/B → nextQuestionIdA/B
questionType = "multiple" → options[] → nextQuestionIds (JSON 맵)
```

---

## 4. ChatBotResponse (사용자 응답)
```prisma
model ChatBotResponse {
  id              Int
  sessionId       String             // ChatBotSession 참조
  questionId      Int                // ChatBotQuestion 참조
  selectedOption  String?            // 선택한 옵션 (A/B/custom)
  selectedText    String?            // 사용자 입력 텍스트
  responseTime    Int?               // 응답 소요 시간 (ms)
  isAbandoned     Boolean @default(false) // 중도 이탈 여부
  nextQuestionId  Int?               // 다음 질문 ID
  questionOrder   Int?               // 플로우 내 질문 순서
  optionLabel     String?            // 선택한 옵션의 라벨
  displayedAt     DateTime?          // 질문 표시 시간
  answeredAt      DateTime? @default(now())
  createdAt       DateTime @default(now())
  
  // 관계
  ChatBotQuestion ChatBotQuestion
  ChatBotSession  ChatBotSession
}
```

---

## 5. ChatBotSession (사용자 세션)
```prisma
model ChatBotSession {
  id                 Int
  sessionId          String @unique  // 공개 세션 ID
  flowId             Int             // ChatBotFlow 참조
  userId             Int?            // 사용자 ID (로그인 시)
  userPhone          String?         // 전화번호
  userEmail          String?         // 이메일
  productCode        String?         // 상품코드
  startedAt          DateTime @default(now())
  completedAt        DateTime?       // 완료 시간
  endedAt            DateTime?       // 세션 종료 시간
  durationMs         Int?            // 소요 시간 (ms)
  isCompleted        Boolean @default(false)
  finalStatus        String @default("ONGOING") // COMPLETED, ABANDONED, CONVERTED
  finalPageUrl       String?        // 최종 리다이렉트 URL
  paymentStatus      String?        // PENDING, COMPLETED, FAILED
  paymentAttemptedAt DateTime?
  paymentCompletedAt DateTime?
  paymentOrderId     String?        // 결제 주문 ID
  conversionRate     Float?         // 전환율 분석
  createdAt          DateTime @default(now())
  updatedAt          DateTime
  
  // 관계
  ChatBotResponse    ChatBotResponse[]
  ChatBotFlow        ChatBotFlow
  User               User?
}
```

---

## 6. UserTripFeedback (여행 피드백)
```prisma
model UserTripFeedback {
  id                  Int
  tripId              Int @unique       // Trip 참조
  userId              Int               // User 참조
  satisfactionScore   Int?              // 만족도 (1-5)
  improvementComments String?           // 개선사항 코멘트
  detailedFeedback    Json?             // 상세 피드백 (구조화된 JSON)
  createdAt           DateTime @default(now())
  updatedAt           DateTime
  
  // 관계
  Trip                Trip
}
```

---

## 7. InquiryCallLog (문의 콜 로그)
```prisma
model InquiryCallLog {
  id            Int
  inquiryId     Int                // ProductInquiry 참조
  result        String             // REACHED, NOT_REACHED, CALLBACK, etc.
  memo          String?            // 통화 메모
  calledAt      DateTime @default(now())
  createdAt     DateTime @default(now())
  createdBy     Int                // 담당자 ID
  nextContactAt DateTime?          // 다음 연락 예정일
  
  @@index([inquiryId, calledAt])
}
```

---

## 8. RagQuestion (RAG 학습 질문)
```prisma
model RagQuestion {
  id        Int
  question  String @unique        // 질문 (중복 제거)
  likeCount Int @default(0)       // 좋아요 수
  videoId   String?               // 유튜브 영상 ID
  source    String @default("youtube-comment") // 질문 출처
  status    String @default("pending") // pending → approved → rejected
  cluster   Int?                  // 클러스터링된 질문 그룹 ID
  createdAt DateTime @default(now())
  updatedAt DateTime
}
```

---

## 9. BotGuideAnswer (봇 가이드 답변)
```prisma
model BotGuideAnswer {
  id        Int
  key       String @unique        // 답변 키 (캐시용)
  question  String                // 원본 질문
  answer    String @db.Text       // AI 생성 답변 (Markdown)
  source    String @default("ai-generated") // 답변 출처
  isActive  Boolean @default(false) // 활성화 여부
  createdAt DateTime @default(now())
  updatedAt DateTime
  
  @@index([isActive, updatedAt])
}
```

---

## 데이터 흐름

### 문의 → 자동 구매확정 플로우
```
1. 사용자가 /api/public/inquiry 호출
   ↓
2. ProductInquiry 생성 (status = "pending")
   ↓
3. AffiliateLead 자동 생성 (어필리에이트 추적)
   ↓
4. 어드민이 /api/admin/inquiries/{id}/confirm 호출
   ↓
5. ProductInquiry.status = "confirmed"
   ↓
6. 자동 처리:
   - Trip 생성 (시작일 + 종료일)
   - Itinerary 생성 (일일 일정)
   - VisitedCountry 업데이트
   - APIS 스프레드시트 생성
   - 사용자 비밀번호 3800으로 초기화
   - tripCount >= 2 → RePurchaseTrigger 생성
```

### 채팅봇 플로우
```
1. ChatBotSession 생성 (sessionId, flowId, userId 등)
   ↓
2. startQuestionId의 ChatBotQuestion 표시
   ↓
3. 사용자가 선택 → ChatBotResponse 생성
   ↓
4. response.nextQuestionId를 따라 분기
   ↓
5. 마지막 질문 도달 → finalPageUrl로 리다이렉트
   ↓
6. ChatBotSession.finalStatus = "COMPLETED"
```

---

## 인덱싱 전략

### ProductInquiry
- `(agentId, status, createdAt)` - 판매원 문의 조회
- `(managerId, status, createdAt)` - 대리점장 문의 조회
- `(productCode)` - 상품별 문의 조회
- `(status)` - 상태별 필터링
- `(createdAt)` - 시간순 정렬

### ChatBotQuestion
- `(flowId, order)` - 플로우 내 질문 순서 조회
- `(nextQuestionIdA)`, `(nextQuestionIdB)` - 다음 질문 네비게이션

### ChatBotSession
- `(flowId, startedAt)` - 플로우별 세션 조회
- `(userId)` - 사용자별 세션 조회
- `(finalStatus)` - 상태별 필터링
- `(paymentStatus)` - 결제 상태 조회

---

## 상태 전이

### ProductInquiry
```
pending → confirmed (자동 구매)
```

### ChatBotSession
```
ONGOING → COMPLETED (정상 완료)
ONGOING → ABANDONED (중도 이탈)
ONGOING → CONVERTED (구매로 전환)
```

### RagQuestion
```
pending → approved (어드민 승인)
pending → rejected (어드민 거절)
```

---

## 주의사항

1. **ProductInquiry.confirm**: 중복 호출 방지 (이미 confirmed 상태면 에러)
2. **ChatBotSession.nextQuestionId**: 없으면 finalPageUrl로 리다이렉트
3. **ChatBotQuestion.nextQuestionIds**: JSON 맵 형식 (다중선택지용)
4. **UserTripFeedback**: tripId는 UNIQUE (1:1 관계)
5. **BotGuideAnswer.key**: 캐시 조회용이므로 UNIQUE 필수
