# Menu #49: L3 렌즈 (차별성 미인지형 고객) 구현 가이드

**작성일**: 2026-05-25  
**목표**: 경쟁사(Royal, MSC, Disney) 언급 고객 감지 → 차별성 메시지 → 전환율 40-50% 달성  
**상태**: 완료  

---

## 📌 L3 렌즈 개념

### 정의
"호텔 여행 경험만 있어서 크루즈를 호텔 기준으로 평가하며, '일반 여행이랑 같잖아'라고 거절하는 고객"

### 핵심 특징
| 특징 | 고객 발화 | 우리의 대응 |
|------|---------|-----------|
| **준거틀 오류** | "호텔이랑 같잖아요?" | 구조적 차이 명확화 |
| **공간 가치 과소평가** | "선실이 작으면..." | "배=리조트" 시각화 |
| **이동의 가치 미인지** | "배가 움직인다는 게..." | 매일 새로운 나라 강조 |

---

## 🎯 구현 항목 요약

### 1. 데이터베이스 스키마 (완료)
**파일**: `prisma/schema.prisma`, `prisma/migrations/20260525000002_add_l3_lens_fields/migration.sql`

**추가 필드** (Contact 모델):
```
- competitorMentioned: Boolean (경쟁사 언급 여부)
- competitorNames: String[] (언급된 경쟁사 목록)
- lastCompetitorMentionAt: DateTime (마지막 언급 시간)
- lastCompetitorName: String (가장 최근 언급된 경쟁사)
- differentiationScore: Int (0-100, 차별성 이해도)
- hotelExperienceLevel: String (none/basic/frequent/regular)
- preparationFrameworkLevel: String (inquiry/understanding/convinced/booked)
- differentiationResponseSent: Boolean (차별성 메시지 발송 여부)
- lastDifferentiationResponseAt: DateTime
- differentiationSequenceStartedAt: DateTime
```

**인덱스**:
- `idx_contact_competitor_mentioned`
- `idx_contact_differentiation_score`
- `idx_contact_last_competitor_mention`

---

### 2. 경쟁사 비교 데이터 (완료)
**파일**: `src/lib/l3-competitor-data.ts`

**포함 정보**:
- Royal Caribbean: 선박 규모, 가격대, 우리의 장점 3-5가지
- MSC Cruises: 서비스 스타일, 한국 친화도, 가성비 비교
- Disney Cruise Line: 가족 중심 vs 성인 경험, 가격 차이

**우리의 차별성**:
1. 호텔의 편안함 + 매일 새로운 나라를 깨어나기
2. 한국인 맞춤형 (한국 스태프, 음식, 일정)
3. 50-60% 저렴 (1박당 가격)
4. 가족 중심 (kids club, family programs)

---

### 3. API 엔드포인트 (4개, 완료)

#### 3-1. GET /api/comparisons/competitor?competitor=royal|msc|disney
**용도**: 경쟁사 비교 테이블 조회

**응답**:
```json
{
  "ok": true,
  "competitor": {
    "name": "Royal Caribbean",
    "code": "royal",
    "metrics": {
      "shipSize": "Large (4,000+ passengers)",
      "targetAgeGroup": "40-65 (Average 55)",
      "priceRange": "$1,200-$3,500"
    },
    "ourAdvantage": [
      "Service quality: Personal attention (Royal 5/10 vs us 9/10)",
      "Korean staff: 100% vs Royal <20%",
      "50-60% cheaper for same quality"
    ]
  },
  "coreMessage": {
    "headline": "호텔+여행을 동시에, 리조트처럼 편한 크루즈",
    "corePoints": [...]
  }
}
```

#### 3-2. POST /api/comparisons/detect-mention
**용도**: 고객 메모/콜로그에서 경쟁사 언급 자동 감지 → SMS 자동 발송

**요청**:
```json
{
  "contactId": "cxx...",
  "text": "Royal Caribbean 가격이 좀 더 싼데...",
  "sourceType": "memo|calllog|inquiry"
}
```

**응답**:
```json
{
  "ok": true,
  "detected": true,
  "competitor": "Royal Caribbean",
  "action": "sms_scheduled",
  "riskFlags": ["competitor_booking_imminent"]
}
```

**자동 처리**:
- 경쟁사 언급 감지 시 Contact 업데이트
- Tag 자동 추가: `l3_competitor_royal`
- Day 0 SMS 자동 스케줄 (30분 후 발송)
- Risk Flag 감지: "이미 예약", "예약 고민 중" → CRITICAL

#### 3-3. POST /api/comparisons/send-differentiation
**용도**: 호텔 경험도 기반 맞춤형 차별성 메시지 발송

**요청**:
```json
{
  "contactId": "cxx...",
  "hotelExperienceLevel": "frequent",
  "scheduleDay": 0
}
```

**응답**:
```json
{
  "ok": true,
  "smsScheduled": true,
  "differentiationScore": 50,
  "experienceLevel": "frequent",
  "coreMessage": {...}
}
```

**자동 처리**:
- Day 0 발송 시: Day 1-3 SMS도 자동 스케줄
- 차별성 점수 계산 (40-80 범위)
  - `regular` (전문가): 40 (더 높은 설득력 필요)
  - `frequent`: 50
  - `basic`: 65
  - `none`: 80 (쉬운 설득)

#### 3-4. GET /api/comparisons/metrics
**용도**: 대시보드 KPI 조회

**응답**:
```json
{
  "ok": true,
  "metrics": {
    "totalCompetitorMentions": 25,
    "byCompetitor": {
      "Royal Caribbean": 12,
      "MSC Cruises": 8,
      "Disney Cruise Line": 5
    },
    "differentiationMessagesSent": 20,
    "conversionRate": 42.5,
    "avgDifferentiationScore": 52.3,
    "byExperienceLevel": {
      "frequent": 10,
      "basic": 7,
      "regular": 3
    }
  }
}
```

---

### 4. SMS 자동화 시퀀스 (완료)
**파일**: `src/lib/sms-service.ts`

#### Day 0: 경쟁사 비교 감지 (즉시 + 30분)
```
"안녕하세요! [이름]님이 Royal과 비교해주셨군요.

같은 가격에:
- Royal: 1박
- 우리: 7박

호텔의 편안함 + 매일 새로운 나라를 깨어나는 경험, 비교해보시겠어요?
[비교 자료 보기]"
```

**심리학**: L3_differentiation (차별성 강조)

#### Day 1: 구조 설명 (1일 후)
```
"[이름]님, 호텔과 크루즈의 핵심 차이 아세요?

호텔 여행:
- 매일 같은 호텔 + 짐 싸기 + 새 호텔 체크인 = 번거로움 ❌

우리 크루즈:
- 한 번만 짐 싸기 + 배가 당신을 옮김 + 7박 = 자유 ✅

더 자세한 설명이 필요하신가요?"
```

**심리학**: L3_structure_visualization

#### Day 2: 라이프스타일 가치 (2일 후)
```
"[이름]님의 가족을 위한 맞춤 패키지를 준비했어요.

🏖️ 호텔 풀장 vs 우리 배 워터파크 (+액티비티 10가지)
🍽️ 호텔 1가지 음식 vs 우리 10가지 레스토랑
👨‍👩‍👧‍👦 매일 함께하는 가족 프로그램

지금 예약하면 20% 할인!"
```

**심리학**: L3_lifestyle_value

#### Day 3: 최종 클로징 (3일 후)
```
"[이름]님, 결정하세요.

Royal $3,000 x 1박 = $3,000/박
우리 크루즈 $1,500 x 7박 = $214/박 (가족 모두 포함)

호텔에서 쉬실까요? 아니면 리조트처럼 편한 배에서 여행할까요?

[지금 예약하기]"
```

**심리학**: L3_price_value_closing (손실회피 + 긴박감)

---

### 5. 대시보드 (완료)
**파일**: `src/app/(dashboard)/comparisons/page.tsx`

**기능**:
- KPI 카드: 경쟁사 언급 고객, 메시지 발송, 전환율, 평균 차별성 점수
- 경쟁사 분석: 경쟁사별 언급 현황 + 우리의 차별성 요약
- 경험도 분석: 호텔 경험도별 분포 + 메시지 전략
- 구현 체크리스트

**전환율 목표**: 40-50%

---

## 🔄 사용 흐름

### 시나리오 1: 고객이 콜에서 "Royal 저렴하던데..." 언급
```
1. CallLog 저장
2. Webhook 또는 Agent가 detect-mention API 호출
3. API가 Royal 감지 → Contact 업데이트
4. Day 0 SMS 자동 스케줄 (30분 후)
5. Day 1-3 자동 시퀀스 스케줄
6. 대시보드에서 실시간 추적
```

### 시나리오 2: 영업팀이 "이 고객 호텔 여행 경험 많아요" 판단
```
1. send-differentiation API 호출 (hotelExperienceLevel: "frequent")
2. 맞춤형 메시지 결정 → SMS 발송
3. Day 0-3 시퀀스 자동 스케줄
4. 차별성 점수 계산 (50)
5. 성과 추적
```

### 시나리오 3: Dashboard에서 KPI 확인
```
1. metrics API 호출
2. 경쟁사별 언급 현황 표시
3. 전환율 모니터링 (목표 45% vs 현재 42.5%)
4. 호텔 경험도별 세그먼트 분석
```

---

## 📊 성과 지표 (KPI)

### 목표
```
전환율: 현재 → 40-50% (L3 렌즈 적용 후)
SMS 클릭율: 35% 이상
차별성 이해도: 80점 이상 (0-100)
```

### 추적 항목
- `totalCompetitorMentions`: 경쟁사 언급 고객 수
- `differentiationMessagesSent`: 차별성 메시지 발송 고객 수
- `conversionRate`: (경쟁사 언급 고객 중 구매) / (전체 경쟁사 언급 고객)
- `byCompetitor`: Royal/MSC/Disney별 언급 현황
- `byExperienceLevel`: none/basic/frequent/regular별 분포

---

## 🔌 통합 포인트

### 1. Contact Memo / CallLog 변경 시
```typescript
// ContactMemoForm.tsx 또는 CallLogForm.tsx에서
import { detectCompetitorMention } from '@/app/api/comparisons/detect-mention/route';

useEffect(() => {
  if (memo) {
    fetch('/api/comparisons/detect-mention', {
      method: 'POST',
      body: JSON.stringify({
        contactId,
        text: memo,
        sourceType: 'memo'
      })
    });
  }
}, [memo]);
```

### 2. Contact 상세 페이지
```typescript
// src/app/(dashboard)/contacts/[id]/page.tsx에 추가
<CompetitorInfoCard
  lastCompetitorName={contact.lastCompetitorName}
  differentiationScore={contact.differentiationScore}
  hotelExperienceLevel={contact.hotelExperienceLevel}
/>
```

### 3. SMS 발송 로직
```typescript
// ScheduledSmsSender cron job에서
if (sms.campaignType === 'L3_DIFFERENTIATION') {
  await sendL3DifferentiationMessage(sms);
}
```

---

## 🧪 테스트 케이스

### Test 1: 경쟁사 자동 감지
```bash
curl -X POST http://localhost:3000/api/comparisons/detect-mention \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "cxx123",
    "text": "Royal Caribbean가 더 싸던데...",
    "sourceType": "memo"
  }'
```

**예상 결과**: 
- HTTP 200
- `detected: true, competitor: "Royal Caribbean"`
- SMS 스케줄됨

### Test 2: 차별성 메시지 발송
```bash
curl -X POST http://localhost:3000/api/comparisons/send-differentiation \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "cxx123",
    "hotelExperienceLevel": "frequent",
    "scheduleDay": 0
  }'
```

**예상 결과**:
- HTTP 200
- `smsScheduled: true`
- `differentiationScore: 50`
- Day 0-3 SMS 모두 스케줄됨

### Test 3: 경쟁사 비교 데이터 조회
```bash
curl http://localhost:3000/api/comparisons/competitor?competitor=royal
```

**예상 결과**:
- HTTP 200
- Royal의 metrics + 우리 장점

### Test 4: 메트릭 조회
```bash
curl http://localhost:3000/api/comparisons/metrics
```

**예상 결과**:
- HTTP 200
- 경쟁사별 언급 수, 차별성 메시지 발송 수, 전환율 등

---

## 🚀 배포 체크리스트

### DB 마이그레이션
- [ ] `prisma migrate deploy` 실행
- [ ] Contact 테이블에 L3 필드 확인
- [ ] 인덱스 생성 확인

### API 배포
- [ ] `/api/comparisons/competitor` 작동 확인
- [ ] `/api/comparisons/detect-mention` 작동 확인
- [ ] `/api/comparisons/send-differentiation` 작동 확인
- [ ] `/api/comparisons/metrics` 작동 확인

### 대시보드 배포
- [ ] `/comparisons` 페이지 로드 확인
- [ ] KPI 카드 데이터 표시 확인
- [ ] 경쟁사/경험도 탭 작동 확인

### SMS 자동화 배포
- [ ] SMS 스케줄 테이블에 데이터 저장 확인
- [ ] Cron job이 ScheduledSms 처리 확인
- [ ] 실제 SMS 발송 확인

### 통합 배포
- [ ] Contact Memo 저장 시 detect-mention API 호출 확인
- [ ] CallLog 저장 시 detect-mention API 호출 확인
- [ ] 대시보드 메트릭 업데이트 확인

---

## 📝 참고 문서

- [[l3_lens_detailed_work_instructions]] - L3 렌즈 콜 스크립트 (6단계)
- [[grant_cardone_closing]] - 클로징 심리학
- [[pasona_framework_complete]] - PASONA 메시지 구조
- [[L3_LENS_DESTINATION_COMPARISON]] - 목적지별 경쟁사 비교

---

## ✅ 구현 완료 사항

| 항목 | 상태 | 파일 |
|------|------|------|
| DB 스키마 | ✅ | `prisma/schema.prisma` |
| 마이그레이션 | ✅ | `prisma/migrations/20260525000002_add_l3_lens_fields/` |
| 경쟁사 데이터 | ✅ | `src/lib/l3-competitor-data.ts` |
| API 1 (비교) | ✅ | `src/app/api/comparisons/competitor/route.ts` |
| API 2 (감지) | ✅ | `src/app/api/comparisons/detect-mention/route.ts` |
| API 3 (발송) | ✅ | `src/app/api/comparisons/send-differentiation/route.ts` |
| API 4 (메트릭) | ✅ | `src/app/api/comparisons/metrics/route.ts` |
| SMS 서비스 | ✅ | `src/lib/sms-service.ts` |
| 대시보드 | ✅ | `src/app/(dashboard)/comparisons/page.tsx` |

---

## 📞 담당자 및 문의

**구현 담당**: Claude Code Agent  
**심리학 기반**: Grant Cardone 10렌즈 (L3 차별성 미인지형)  
**자동화 기반**: Day 0-3 PASONA + Russell Brunson 프레임워크  

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0 (완료)
