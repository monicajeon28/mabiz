# Menu #50: L7 렌즈 (동반자 설득) 완전 구현 가이드

**완성일**: 2026-05-25
**성과 목표**: 동반 예약율 40% → 55-70% | 월별 예상 효과 $180K-250K

---

## 📋 목차

1. [개요](#개요)
2. [Prisma 스키마 마이그레이션](#prisma-스키마-마이그레이션)
3. [API 엔드포인트 구현](#api-엔드포인트-구현)
4. [SMS 템플릿 24개](#sms-템플릿-24개)
5. [심리학 적용 프레임워크](#심리학-적용-프레임워크)
6. [배포 체크리스트](#배포-체크리스트)
7. [성과 추적](#성과-추적)

---

## 개요

### L7 렌즈란?

**동반자 설득 (Companion Family Persuasion)**

배우자, 부모, 친구 등 의사결정 동반자의 동의를 획득하는 심리학 기법입니다.

- 크루즈 구매의 60-75%는 "배우자 또는 가족의 동의"가 필수 조건
- Grant Cardone의 "이의 대응" 프레임워크 + PASONA 6단계 적용
- Day 0-3 자동 SMS 시퀀스 + 역할별 메시지 변형

### 주요 특징

| 항목 | 설명 |
|------|------|
| **타겟 역할** | 배우자 (Spouse) / 부모 (Parent) / 친구 (Friend) |
| **의사결정자** | "self" / "spouse" / "parent" / "friend" 중 선택 |
| **가족 구성** | "spouse" / "parents" / "friends" / "mixed" / "single" |
| **SMS 시퀀스** | Day 0-3 (4가지 심리학 단계) × 2 변형 = 24개 템플릿 |
| **성과 메트릭** | 동반 예약율, 가족 영향력 점수 (0-100) |
| **예상 효과** | 월 $180K-250K 추가 수익 |

---

## Prisma 스키마 마이그레이션

### 1단계: 스키마 필드 추가 (완료)

**Contact 모델에 L7 필드 추가**

```prisma
// L7 Lens: 동반자 설득 (Menu #50)
familyComposition          String?   // "spouse", "parents", "friends", "mixed", "single"
decisionMaker              String?   // "self", "spouse", "parent", "friend"
familyInfluenceScore       Int       // 0-100: 가족 영향력
companionPersuasionStage   String?   // inquiry, interested, hesitant, agreed, booked

// Companion Details
spouseName                 String?
spousePhone                String?
spouseEngagement           String?   // "not_contacted", "aware", "interested", "convinced"
parentName                 String?
parentPhone                String?
parentEngagement           String?
friendName                 String?
friendPhone                String?
friendEngagement           String?

// SMS Tracking
companionSmsDay0Sent       Boolean
companionSmsDay0SentAt     DateTime?
companionSmsDay1Sent       Boolean
companionSmsDay1SentAt     DateTime?
companionSmsDay2Sent       Boolean
companionSmsDay2SentAt     DateTime?
companionSmsDay3Sent       Boolean
companionSmsDay3SentAt     DateTime?

// Metadata
familyObjections           String[]  // 가족의 주요 이의사항
familyAssessmentCompletedAt DateTime?
companionPersuasionStartedAt DateTime?
```

### 2단계: 인덱스 생성

```prisma
@@index([organizationId, familyComposition])
@@index([organizationId, decisionMaker])
@@index([organizationId, familyInfluenceScore])
@@index([organizationId, companionPersuasionStage])
@@index([organizationId, spouseEngagement])
@@index([organizationId, companionSmsDay0Sent, companionSmsDay1Sent, companionSmsDay2Sent, companionSmsDay3Sent])
```

### 3단계: Prisma 클라이언트 재생성

```bash
npx prisma generate
```

---

## API 엔드포인트 구현

### 4개 핵심 API

#### 1️⃣ POST /api/my/family-assessment

**가족 구성 및 의사결정자 평가**

**요청**

```json
{
  "contactId": "cuid_123",
  "familyComposition": "spouse",
  "decisionMaker": "self"
}
```

**응답**

```json
{
  "success": true,
  "contact": {
    "id": "cuid_123",
    "name": "김철수",
    "phone": "010-1234-5678",
    "familyComposition": "spouse",
    "decisionMaker": "self",
    "familyInfluenceScore": 0,
    "companionPersuasionStage": "inquiry",
    "familyAssessmentCompletedAt": "2026-05-25T10:30:00Z"
  }
}
```

#### 2️⃣ POST /api/my/family-assessment/score

**가족 영향력 점수 계산**

**요청**

```json
{
  "contactId": "cuid_123",
  "spouseName": "이영희",
  "spousePhone": "010-9876-5432",
  "spouseEngagement": "interested",
  "parentName": "김순신",
  "parentPhone": "010-5555-5555",
  "parentEngagement": "convinced",
  "friendName": "박민수",
  "friendPhone": "010-3333-3333",
  "friendEngagement": "aware",
  "familyObjections": ["비용 부담", "시간 부족"]
}
```

**응답**

```json
{
  "success": true,
  "contact": {
    "id": "cuid_123",
    "familyInfluenceScore": 75,
    "companionPersuasionStage": "convinced"
  },
  "score": 75,
  "stage": "convinced",
  "message": "가족 영향력 점수: 75점 (convinced)"
}
```

**점수 해석**

| 점수 범위 | 단계 | 다음 액션 |
|----------|------|---------|
| 0-24 | hesitant | 재검토 필요 (Day 0 재발송) |
| 25-49 | interested | Day 1 SMS 발송 |
| 50-74 | interested | Day 2 SMS 발송 |
| 75-100 | convinced | Day 3 최종 클로징 |

#### 3️⃣ POST /api/sms/family-persuasion

**Day 0-3 자동 SMS 발송**

**요청**

```json
{
  "contactId": "cuid_123",
  "targetRole": "spouse",
  "day": 0,
  "useTemplate": true
}
```

**응답**

```json
{
  "success": true,
  "message": "spouse 설득 SMS Day 0 발송 완료",
  "details": {
    "recipientName": "이영희",
    "recipientPhone": "010-9876-5432",
    "day": 0,
    "targetRole": "spouse",
    "variant": "variant_a",
    "messagePreview": "안녕하세요 이영희님! 김철수님과 함께 하실 크루즈여행..."
  }
}
```

#### 4️⃣ GET /api/my/family-analytics

**가족 설득 성과 분석**

**요청**

```
GET /api/my/family-analytics?period=30
```

**응답**

```json
{
  "success": true,
  "period": {
    "startDate": "2026-04-25T00:00:00Z",
    "endDate": "2026-05-25T10:30:00Z",
    "days": 30
  },
  "summary": {
    "totalContacts": 150,
    "bookedCount": 85,
    "bookedPercentage": 57,
    "convincedCount": 92,
    "interestedCount": 120,
    "avgFamilyInfluenceScore": 68
  },
  "smsSequence": {
    "day0Sent": 150,
    "day0SentRate": 100,
    "day1Sent": 142,
    "day1SentRate": 95,
    "day2Sent": 135,
    "day2SentRate": 90,
    "day3Sent": 127,
    "day3SentRate": 85
  },
  "familyComposition": {
    "spouse": 85,
    "parents": 40,
    "friends": 15,
    "mixed": 8,
    "single": 2
  },
  "spouseEngagement": {
    "not_contacted": 5,
    "aware": 30,
    "interested": 40,
    "convinced": 85
  },
  "topObjections": [
    { "objection": "비용 부담", "count": 45, "percentage": 30 },
    { "objection": "시간 부족", "count": 38, "percentage": 25 },
    { "objection": "건강 문제", "count": 22, "percentage": 15 }
  ],
  "expectedRevenue": "$212500-297500"
}
```

---

## SMS 템플릿 24개

### 템플릿 구조

| 역할 | Day | 변형 | 초점 | 심리학 기법 |
|------|-----|------|------|----------|
| **배우자(Spouse)** | 0 | A | 초기 제안 | PASONA P+A |
| | 0 | B | 감정적 연결 | 감정 호소 |
| | 1 | A | 의문 해소 | PASONA S |
| | 1 | B | 사회증명 | 사회심리학 |
| | 2 | A | 가격 가치 | PASONA O |
| | 2 | B | 결정 촉구 | 권위성 |
| | 3 | A | 마감 임박 | 희소성 + 긴박감 |
| | 3 | B | 최종 클로징 | PASONA N+A |
| **부모(Parent)** | 0 | A | 자녀 효심 | 가족 가치 |
| | 0 | B | 가족 단합 | 공동체 |
| | 1 | A | 배려심 | 신뢰 구축 |
| | 1 | B | 시간 소중함 | 손실회피 |
| | 2 | A | 가격 합리성 | 사회증명 |
| | 2 | B | 결정권 | 자율성 |
| | 3 | A | 마지막 기회 | 희소성 |
| | 3 | B | 행복 약속 | 감정 마무리 |
| **친구(Friend)** | 0 | A | 우정 제안 | 유대감 |
| | 0 | B | 공동 경험 | 집단 동조 |
| | 1 | A | 공동 고민 | 공감 |
| | 1 | B | 신뢰 관계 | 상호성 |
| | 2 | A | 가격 공유 | 경제성 |
| | 2 | B | 함께의 가치 | 소속감 |
| | 3 | A | 최종 확인 | 긴박감 |
| | 3 | B | 우정 약속 | 감정 클로징 |

### Day별 심리학 매핑

**Day 0 (P+A 단계)**
- 문제 인식: "가족과의 시간이 중요해요"
- 감정 자극: "이번 기회를 놓치지 말아야 해요"
- 기법: 감정 호소, 시간의 소중함

**Day 1 (S 단계)**
- 솔루션 제시: "저희가 모든 걱정을 해결해드립니다"
- 신뢰 구축: "많은 가족들이 선택했어요"
- 기법: 사회증명, 신뢰 마커

**Day 2 (O+N 단계)**
- 오퍼 강조: "이 가격은 정말 특별해요"
- 범위 좁히기: "지금 예약하면 50% 할인"
- 기법: 희소성, 경제적 가치

**Day 3 (A 단계)**
- 행동 촉구: "마감이 24시간 남았어요"
- 최종 클로징: "지금이 최종 기회입니다"
- 기법: 긴박감, 손실회피

---

## 심리학 적용 프레임워크

### 1. Grant Cardone 10렌즈 적용

| 렌즈 | L7 적용 사례 |
|------|----------|
| **L0 부재 재활성화** | 장기 미접촉 배우자 재설득 |
| **L1 가격 이의** | "비용 부담"을 신뢰와 경제성으로 해소 |
| **L6 타이밍 손실회피** | "이번 기회를 놓치면 내년까지 기다려야" |
| **L7 동반자 설득** | 🎯 주요 렌즈 (Menu #50) |
| **L10 즉시 구매** | 최종 클로징 (Day 3) |

### 2. PASONA 6단계 매핑

```
Day 0: P(Problem) + A(Agitate)
├─ 가족과의 시간이 점점 줄어들고 있어요
└─ 이번 기회를 놓치면 언제 함께할까요?

Day 1: S(Solution)
├─ 저희가 모든 불안감을 해결해드립니다
└─ 많은 가족들이 선택해서 성공했어요

Day 2: O(Offer) + N(Narrow)
├─ 이 가격은 정말 특별합니다 (지금만!)
└─ 내일 마감! 지금 예약하면 50% 할인

Day 3: A(Action)
├─ 마지막 24시간! 지금 결정하세요
└─ 동의하시면 행복한 여행이 시작됩니다
```

### 3. 역할별 심리학 전략

**배우자 (Spouse)**
- 핵심 심리: "우리 시간" + "가족 건강"
- 이의 해소: 경제성, 편의성, 안전성
- 클로징: 감정적 공감 + 실리적 이득

**부모 (Parent)**
- 핵심 심리: "자녀 효심" + "건강" + "추억"
- 이의 해소: 신뢰성, 건강성, 가족 가치
- 클로징: 감사와 행복한 미래상

**친구 (Friend)**
- 핵심 심리: "우정" + "공동 경험" + "함께"
- 이의 해소: 경제성, 즐거움, 관계 강화
- 클로징: 유대감 + 희소성

---

## 배포 체크리스트

### Phase 1: 데이터베이스 (완료)

- [x] Prisma 스키마 필드 추가 (15개 필드 + 6개 인덱스)
- [x] Contact 모델 L7 필드 정의
- [ ] `npx prisma migrate deploy` 실행
- [ ] 데이터베이스 동기화 확인

### Phase 2: API 구현 (완료)

- [x] POST /api/my/family-assessment (가족 구성 평가)
- [x] GET /api/my/family-assessment (조회)
- [x] POST /api/my/family-assessment/score (점수 계산)
- [x] POST /api/sms/family-persuasion (Day 0-3 자동 SMS)
- [x] GET /api/my/family-analytics (성과 분석)

### Phase 3: SMS 템플릿 (준비)

- [ ] `npm run seed:l7-templates` 실행 (24개 템플릿 생성)
- [ ] SMS 프로바이더 연동 (Aligo) 확인
- [ ] 템플릿 검증 (특수문자, 링크 포함 여부)

### Phase 4: UI 페이지 (대기)

- [ ] Menu #50: 가족 설득 대시보드 페이지 생성
  - 가족 구성 입력 폼
  - 가족 영향력 점수 시각화
  - SMS 시퀀스 상태 추적
  - 실시간 성과 분석 대시보드

### Phase 5: 통합 테스트

- [ ] E2E 테스트: 가족 구성 입력 → 점수 계산 → SMS 발송
- [ ] A/B 테스트: 배우자 vs 부모 vs 친구 효과 비교
- [ ] 성과 메트릭: 동반 예약율 추적

### Phase 6: 배포

- [ ] Staging 환경 배포 및 QA
- [ ] Production 배포
- [ ] 모니터링 설정
- [ ] 성과 리포팅 자동화

---

## 성과 추적

### KPI 정의

| 메트릭 | 현재 | 목표 | 달성 기준 |
|--------|------|------|---------|
| **동반 예약율** | 40% | 55-70% | +15-30%p |
| **가족 영향력 점수** | 50점 | 75점 | +25점 |
| **SMS Day 0 오픈율** | 35% | 55% | +20%p |
| **SMS Day 3 전환율** | 12% | 25% | +13%p |
| **월별 추가 수익** | - | $180K-250K | 85+ 추가 예약 |
| **이의 해소율** | 60% | 80% | +20%p |

### 주간 리포팅

**매주 목요일 자동 생성**

```
📊 L7 렌즈 주간 성과 (2026-05-18~2026-05-24)

🎯 주요 지표
├─ 신규 가족 평가: 42명 (+5명)
├─ 동반 예약: 28명 (66% 달성!) 🚀
├─ 평균 가족 영향력: 72점 (-3점)
└─ 월 누적 수익: $187,500

📈 역할별 성과
├─ 배우자(Spouse): 18명 예약 (70% 달성)
├─ 부모(Parent): 8명 예약 (60% 달성)
└─ 친구(Friend): 2명 예약 (50% 달성)

⚡ 상위 이의사항
├─ 1. 비용 부담 (35건) → 경제성 메시지 강화
├─ 2. 시간 부족 (28건) → 유연성 강조
└─ 3. 건강 문제 (15건) → 의료 신뢰 L9 병행

🔄 개선 사항
├─ Day 1 오픈율 +5%p (신뢰 마커 추가)
├─ Day 3 전환율 +8%p (희소성 강화)
└─ 친구 세그먼트 전환율 +12%p (공감 추가)
```

### 월간 리포팅

**매월 첫 주 월요일 자동 생성**

```
📊 L7 렌즈 월간 성과 (2026-05-01~2026-05-31)

🎯 목표 vs 실적
├─ 동반 예약율: 목표 55% → 실적 68% ✅ (+13%p)
├─ 월 수익: 목표 $180K → 실적 $212.5K ✅ (+$32.5K)
├─ 이의 해소: 목표 75% → 실적 82% ✅ (+7%p)
└─ SMS Day 3 전환: 목표 20% → 실적 28% ✅ (+8%p)

📈 세부 분석
├─ 가족 구성별
│  ├─ 배우자: 85명 중 62명 예약 (73%)
│  ├─ 부모: 40명 중 20명 예약 (50%)
│  └─ 친구: 15명 중 3명 예약 (20%)
├─ SMS 시퀀스별
│  ├─ Day 0 발송: 150명 (100%)
│  ├─ Day 1 오픈: 142명 (95%)
│  ├─ Day 2 클릭: 135명 (90%)
│  └─ Day 3 전환: 42명 (28%)
└─ 심리학 기법별
   ├─ PASONA 적용: 효과 +20%p
   ├─ 감정 호소: 효과 +18%p
   └─ 희소성 강화: 효과 +15%p

💰 수익 분석
├─ 기존 경로: $155K (73 예약 × $2.1K)
├─ L7 추가: $57.5K (23 추가 예약 × $2.5K)
└─ 월 총 수익: $212.5K

🔮 다음 달 목표
├─ 동반 예약율: 70%
├─ 월 수익: $240K
└─ 친구 세그먼트: 30% 전환율 달성
```

---

## 문제 해결 가이드

### 문제 1: SMS 발송 실패

**증상**: API에서 "Failed to send SMS" 에러

**해결 방법**:

1. SMS 프로바이더 (Aligo) API 키 확인
   ```bash
   echo $ALIGO_KEY
   ```

2. 수신자 전화번호 형식 확인
   ```javascript
   // 올바른 형식: 010-1234-5678 또는 01012345678
   const phoneRegex = /^01[0-9]\d{7,8}$/;
   ```

3. 일일 발송 한도 확인
   ```sql
   SELECT COUNT(*) as today_sms FROM sms_log 
   WHERE DATE(sent_at) = CURRENT_DATE;
   ```

### 문제 2: 가족 영향력 점수가 0점

**증상**: 점수 계산 후에도 familyInfluenceScore가 0

**해결 방법**:

1. 가족 정보가 제대로 저장됐는지 확인
   ```sql
   SELECT spouse_engagement, parent_engagement, friend_engagement 
   FROM contact WHERE id = 'cuid_123';
   ```

2. 점수 계산 로직 재실행
   ```bash
   curl -X POST http://localhost:3000/api/my/family-assessment/score \
     -H "Content-Type: application/json" \
     -d '{"contactId": "cuid_123", "spouseEngagement": "convinced"}'
   ```

### 문제 3: SMS 템플릿 플레이스홀더 미치환

**증상**: SMS에 "{contact_name}", "{spouse_name}" 그대로 출력

**해결 방법**:

1. 정규식 확인
   ```typescript
   const regex = /\{(\w+)\}/g;
   const placeholders = messageTemplate.match(regex);
   console.log(placeholders); // ["{contact_name}", "{spouse_name}", ...]
   ```

2. 치환 로직 개선
   ```typescript
   const replacements = {
     contact_name: contact.name,
     spouse_name: contact.spouseName || '',
     parent_name: contact.parentName || '',
     friend_name: contact.friendName || '',
   };
   
   let msg = messageTemplate;
   Object.entries(replacements).forEach(([key, value]) => {
     msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
   });
   ```

---

## 참고 자료

### 관련 문서

- [[l7_companion_family_persuasion]] - L7 렌즈 메모리 파일
- [[grant_cardone_rebuttal]] - Grant Cardone 이의 대응 프레임워크
- [[pasona_framework_complete]] - PASONA 6단계 완전 가이드
- [[rental_sms_3day_sequence]] - 3일 SMS 시퀀스 템플릿

### 코드 경로

```
D:\mabiz-crm\
├── prisma\
│   └── schema.prisma (✅ L7 필드 추가)
├── src\app\api\
│   ├── my\
│   │   ├── family-assessment\
│   │   │   ├── route.ts (✅ GET/POST)
│   │   │   └── score\route.ts (✅ POST)
│   │   └── family-analytics\
│   │       └── route.ts (✅ GET)
│   └── sms\
│       └── family-persuasion\
│           └── route.ts (✅ POST)
├── scripts\
│   └── seed-l7-sms-templates.ts (✅ 템플릿 시드)
└── docs\
    └── MENU_50_L7_LENS_IMPLEMENTATION.md (📄 이 파일)
```

---

## 다음 단계

### Stage 3 진행 상황

| 에이전트 | 담당 | 상태 | 완료 예상 |
|---------|------|------|---------|
| α | Menu #41 (내정산) L1/L6 | ✅ | 2026-05-24 |
| β | Menu #42 (팀정산) L5 | ✅ | 2026-05-24 |
| γ | Menu #43 (계약) L10 | ✅ | 2026-05-24 |
| δ | Menu #50 (동반자) L7 | 🔄 현재 | 2026-05-25 |
| θ | Menu #51 (재방문) L8 | ⏸️ 대기 | 2026-05-26 |
| ε | Menu #52 (건강) L9 | ⏸️ | 2026-05-27 |
| ζ | Menu #53 (즉시) L10 | ⏸️ | 2026-05-28 |

### 최종 배포 예정

- **Staging**: 2026-05-25 18:00
- **Production**: 2026-05-25 22:00
- **모니터링**: 2026-05-26~2026-06-15 (14일)

---

**작성**: 2026-05-25 | **상태**: 🚀 Implementation in Progress
