# L6 렌즈 실제 구현 가이드 (B2B 랜딩페이지)

**작성일**: 2026-05-26  
**상태**: ✅ Phase 1 구현 완료  
**담당**: 구현-α Agent

---

## 개요

이 문서는 B2B 랜딩페이지에 **L6 타이밍/손실회피** 렌즈를 실제로 구현한 내용을 정리합니다.

### 구현 범위

- CountdownTimer (48시간 카운트다운)
- StockGaugeWidget (남은 자리 게이지)
- L6LossAnchorSection (가격 앵커 3단계)
- Day 0 SMS 자동 발송 트리거
- Prisma 스키마 확장 (l6_* 필드, SMS 로그)
- API 엔드포인트 (l6-config, sms-trigger)

---

## 파일 구조

```
D:\mabiz-crm\
├── src/
│   ├── app/
│   │   ├── p/[slug]/
│   │   │   ├── LandingClient.tsx          ⭐ 수정 (L6 컴포넌트 임포트)
│   │   │   └── page.tsx                   ⭐ 수정 (L6 설정 데이터 로드)
│   │   └── api/landing-pages/[id]/
│   │       ├── l6-config/route.ts         ✅ 신규 (L6 설정 API)
│   │       └── sms-trigger/route.ts       ✅ 신규 (SMS 발송 트리거)
│   └── components/landing/
│       ├── CountdownTimer.tsx              ✅ 신규 (카운트다운)
│       ├── StockGaugeWidget.tsx            ✅ 신규 (재고 게이지)
│       ├── L6LossAnchorSection.tsx         ✅ 신규 (가격 앵커)
│       └── l6-styles.css                  ✅ 신규 (L6 스타일)
├── prisma/
│   └── schema.prisma                      ⭐ 수정 (l6_* 필드 + 관계)
└── docs/
    └── L6_IMPLEMENTATION_GUIDE.md         ✅ 신규 (이 파일)
```

---

## 핵심 구현 사항

### 1. React 컴포넌트 (클라이언트 사이드)

#### `CountdownTimer.tsx`
- **기능**: 48시간 카운트다운 (일:시간:분)
- **Props**: `targetDate`, `onExpire` 콜백
- **특징**:
  - 1초마다 업데이트 (setInterval)
  - SSR 안전 (클라이언트 렌더링)
  - 만료 시 자동 정리

#### `StockGaugeWidget.tsx`
- **기능**: 남은 자리 게이지 시각화
- **Props**: `currentStock`, `totalStock`, `weeklyBurnRate`, `weeksToZero`
- **UI**:
  - 진행률 바 (green → yellow 그래디언트)
  - 라벨 (지금, N주뒤, 매진)
  - 경고 배너 ("주 6-8개 소진 중")

#### `L6LossAnchorSection.tsx`
- **기능**: 3단계 가격 비교 (지금 vs 다음주 vs 1개월뒤)
- **Props**: `priceAnchors`, `hoursUntilIncrease`
- **UI**:
  - 현재 옵션 강조 (green ring)
  - 화살표로 시간 흐름 표현
  - 비교 가격 red highlight

### 2. API 엔드포인트

#### `GET /api/landing-pages/[id]/l6-config`
**응답 예시**:
```json
{
  "ok": true,
  "l6Config": {
    "enabled": true,
    "priceAnchors": [
      {"day": 0, "price": 1200, "label": "지금"},
      {"day": 7, "price": 1240, "label": "다음주"},
      {"day": 30, "price": 1350, "label": "1개월뒤"}
    ],
    "stockConfig": {
      "currentStock": 30,
      "totalStock": 60,
      "weeklyBurnRate": 6,
      "weeksToZero": 5,
      "countdownTarget": "2026-05-28T23:59:59Z"
    },
    "hoursUntilIncrease": 48
  }
}
```

#### `POST /api/landing-pages/[id]/sms-trigger`
**요청**:
```json
{
  "registrationId": "...",
  "phoneNumber": "010-1234-5678",
  "customerName": "김민수",
  "messageType": "l6_day0"
}
```

**응답**:
```json
{
  "ok": true,
  "smsSent": true,
  "smsContent": "크루즈닷입니다! 😊..."
}
```

**자동 발송 시점**: 폼 제출 후 2시간 이내

### 3. 데이터베이스 (Prisma)

#### CrmLandingPage 모델 확장
```prisma
model CrmLandingPage {
  // 기존 필드...
  
  // L6 설정
  l6Enabled         Boolean    @default(false)
  l6PriceAnchors    Json?      // [{day, price, label}, ...]
  l6StockCurrent    Int        @default(0)
  l6StockTotal      Int        @default(0)
  l6WeeklyBurnRate  Int        @default(5)
  l6CountdownEnd    DateTime?
  
  // SMS 자동화
  smsL6Day0Enabled  Boolean    @default(true)
  smsL6Day1Enabled  Boolean    @default(true)
  smsL6Day2Enabled  Boolean    @default(true)
}
```

---

## 통합 플로우

### 사용자 시점: 랜딩페이지 방문부터 SMS 수신까지

1. **페이지 로드** (SSR)
   - `page.tsx`에서 L6 설정 로드
   - `LandingClient`에 props 전달

2. **UI 렌더링** (CSR)
   - L6 섹션 표시 (활성화된 경우)
   - CountdownTimer 시작
   - StockGauge 표시

3. **폼 제출**
   - 유효성 검사 (이름, 전화)
   - `/api/landing-pages/[id]/register` POST
   - 응답: `registrationId` 포함

4. **Day 0 SMS 트리거** (백그라운드)
   ```typescript
   fetch(`/api/landing-pages/${pageId}/sms-trigger`, {
     method: "POST",
     body: JSON.stringify({
       registrationId,
       phoneNumber,
       customerName,
       messageType: "l6_day0"
     })
   }).catch(() => {}); // 에러 무시
   ```

5. **SMS 발송**
   - CrmSmsLog에 기록
   - 실제 SMS 발송 (KakaoTalk, Toast 등 연동 필요)

---

## Day 0-2 SMS 시퀀스

### Day 0 (30분 내)
**PASONA P + A 단계**: 문제 + 자극
```
크루즈닷입니다! 😊
김민수님의 여행 신청 감사합니다.

알려드릴 게 있는데요 ⏰

🚢 지금 신청: $1,200
📅 48시간 뒤: $1,240 (가격 인상)
🪑 자리: 남은 자리 감소 중

서두르지 않으셔도 괜찮지만,
시간이 지날수록 선택지가 줄어들어요.

더 알고 싶으신가요?
전화 상담 → 1899-4798
카톡 상담 → pf.kakao.com/_cruisedot
```

### Day 1 (2시간 뒤) [준비 필요]
**PASONA S 단계**: 해결책
```
{name}님을 위한 특별 준비 가이드 📋

✅ 4주 후 출발 일정
✅ 여행용 짐 꾸리는 법
✅ 배멀미 예방법 (필독!)
✅ 예약자 특전 (숙실 업그레이드 쿠폰)

👉 가이드 받기: [링크]
```

### Day 2 (24시간 뒤) [준비 필요]
**PASONA O + N + A 단계**: 오퍼 + 협소화 + 행동
```
마지막 안내입니다! ⚠️

🚨 12시간 후 가격 인상 ($1,200 → $1,240)

지금 확정하시면:
✅ 현재 가격 고정
✅ 최고급 선실 선택 가능
✅ 배우자/친구 추가 신청 시 할인

→ 최종 확정: [링크] 또는 카톡
```

---

## 설정 방법 (대시보드)

### Admin에서 L6 활성화

```
Menu #35 또는 B2B 에디터 → 페이지 설정
├── L6 렌즈 활성화 (체크박스)
├── 가격 설정 (JSON)
│   └── [{"day":0,"price":1200,"label":"지금"}...]
├── 현재 자리 (숫자)
├── 총 자리 (숫자)
├── 주간 소진율 (숫자)
└── 카운트다운 종료 시간 (날짜/시간)
```

---

## 성과 메트릭

### 예상 효과 (설계 스펙 기준)

| 메트릭 | 현재 | L6 적용 후 | 증가율 |
|--------|------|-----------|--------|
| Day 0 신청율 | 52% | 71% | +37% |
| 손실회피 효과 | 50% | 85% | +70% |
| SMS 응답율 | 15% | 28% | +87% |
| 최종 전환율 | 3.2% | 5.1% | +59% |

### 경제 효과 (월 예상)
```
기존: 월 120명 신청 × $1,200 = $144,000
L6: 월 190명 신청 × $1,220 = $232,000

월 증가: +$88,000 (+61%)
연간 증가: +$1.056M
```

---

## 테스트 체크리스트

### 기능 테스트

- [ ] 카운트다운 타이머 1초마다 업데이트 확인
- [ ] 게이지 퍼센트 정확 계산 확인
- [ ] 가격 비교 3단계 정렬 확인
- [ ] L6 섹션 활성화/비활성화 토글 확인

### API 테스트

- [ ] `GET /api/landing-pages/[id]/l6-config` 응답 확인
- [ ] `POST /api/landing-pages/[id]/sms-trigger` 요청/응답 확인
- [ ] SMS 로그 DB 기록 확인

### 통합 테스트

- [ ] 폼 제출 → registrationId 수신 확인
- [ ] SMS 트리거 백그라운드 실행 (에러 무시)
- [ ] 완료 화면 카톡/전화 버튼 동작 확인

### 성능 테스트

- [ ] CountdownTimer 메모리 누수 확인 (interval 정리)
- [ ] 대량 폼 제출 시 SMS 트리거 수행 확인
- [ ] API 응답 시간 < 500ms 확인

---

## 다음 단계 (향후 개선)

### Phase 2: SMS 발송 실제 통합 (준비 필요)

1. **KakaoTalk 알림톡** 또는 **NHN Toast SMS** 연동
   ```typescript
   // src/lib/sms-provider.ts
   async function sendSms(phoneNumber: string, content: string) {
     // 실제 API 호출
   }
   ```

2. **Day 1, Day 2 스케줄링**
   - Cron job 또는 Message Queue (Bull)
   - `/api/landing-pages/[id]/sms-schedule` 엔드포인트

3. **A/B 테스트**
   - L6 활성화 vs 비활성화 분할
   - 메트릭 추적 (전환율, SMS 응답율)

### Phase 3: 대시보드 통합

- L6 설정 UI (Admin 페이지)
- 실시간 KPI 대시보드
  - 현재 자리 수 (실시간 업데이트)
  - SMS 발송 현황
  - 전환율 추적

---

## 배포 체크리스트

- [x] 3개 신규 컴포넌트 구현 (CountdownTimer, StockGauge, L6LossAnchor)
- [x] LandingClient.tsx 수정 (L6 UI 통합)
- [x] page.tsx 수정 (L6 설정 로드)
- [x] L6 API 엔드포인트 구현 (2개)
- [x] Prisma 스키마 확장 (l6_* 필드)
- [x] SMS 트리거 로직 구현
- [x] TypeScript 타입 정의 완료
- [x] 스타일 (Tailwind + CSS) 적용
- [ ] 테스트 페이지에서 수동 테스트 완료
- [ ] SMS 실제 발송 통합 (Phase 2)
- [ ] A/B 테스트 설정 (Phase 2)
- [ ] 대시보드 UI 추가 (Phase 3)

---

## 참고 자료

### 심리학 기반
- **Kahneman & Tversky 손실회피**: 손실의 고통 = 이득의 2.25배
- **Cialdini 희소성 원칙**: 제한된 자원에 대한 가치 인상
- **Grant Cardone L6**: 타이밍/손실회피 (부재중 고객 재활성화)

### 메모리 파일
- `[[l6_timing_loss_aversion]]` — L6 완전 가이드
- `[[rental_sms_3day_sequence]]` — Day 0-3 SMS 템플릿
- `[[p1_b2b_l6_design_spec]]` — 설계 스펙 (원본)

### 커밋 참고
- `git log --oneline | grep -i "l6\|landing\|sms"`

---

**작성자**: 구현-α Agent  
**최종 업데이트**: 2026-05-26  
**상태**: ✅ PR-ready (테스트 및 배포 대기)
