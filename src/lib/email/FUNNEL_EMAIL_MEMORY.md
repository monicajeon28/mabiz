# Day 0-3 이메일 퍼널 구현 가이드 (2026-06-02)

## 개요
PASONA 기반 심리학 프레임워크 + Grant Cardone 10렌즈를 적용한 Day 0-3 자동 이메일 시퀀스

---

## 📊 Day별 PASONA 맵핑

### Day 0 - Problem + Agitate (상담 후 1시간)
| 단계 | 심리학 | 메시지 | CTA |
|------|-------|--------|-----|
| P (Problem) | **L6 손실회피** | "지금 받지 않으면 평생 후회" | 72시간 한정 버튼 |
| A (Agitate) | **L10 즉시구매** | "3일 뒤 할인 종료" | "실천 계획서 받기" |

**목표 메트릭**: 오픈율 45% → 클릭율 18%

---

### Day 1 - Solution + Offer (다음날 9시)
| 단계 | 심리학 | 메시지 | CTA |
|------|-------|--------|-----|
| S (Solution) | **L3 차별성** | "3가지 맞춤 솔루션" | "추천상품 선택" |
| O (Offer) | **L5 자기투영** | "당신의 건강 수준에 정확히 맞춤" | "비교 테이블" |

**목표 메트릭**: 오픈율 52% → 클릭율 22%

---

### Day 2 - Offer + Narrow (2일 후 10시)
| 단계 | 심리학 | 메시지 | CTA |
|------|-------|--------|-----|
| O (Offer) | **L7 동반자설득** | "94% 고객 만족도 + 성공 사례" | "함께 시작하기" |
| N (Narrow) | **L9 의료신뢰** | "전문가팀의 지속적 피드백" | "성공 사례 더보기" |

**목표 메트릭**: 오픈율 48% → 클릭율 20%

---

### Day 3 - Narrow + Action (3일 후 8시, 최종 클로징)
| 단계 | 심리학 | 메시지 | CTA |
|------|-------|--------|-----|
| N (Narrow) | **L6 손실회피** | "남은 시간: 72시간 ⏱️" | "지금 신청하기" |
| A (Action) | **L1 희소성** | "10석 남음 + 할인 마감" | "결정하기" |

**목표 메트릭**: 오픈율 58% → 클릭율 25%

**기대 효과**: 전환율 15% → 35% (+233% 증대)

---

## 🎯 세그먼트별 맞춤 메시지

### 파트너 타입별 Day 1 추천 등급

| 파트너 Type | L2 복잡도 | 추천 등급 | 특징 |
|-----------|---------|----------|------|
| **크루즈선 초심자** | 낮음 (1-2) | Basic | "쉽고 간단하게 시작" |
| **재방문 고객** | 중간 (3-5) | **Standard** (기본) | "검증된 최적 경험" |
| **VIP/고액** | 높음 (6-10) | Premium | "최고 수준의 관리" |

---

## 📈 성과 메트릭 정의

### KPI 현재 vs 목표

```
메트릭                현재 (자동화 전)    목표 (자동화 후)    상승도
─────────────────────────────────────────────────────────
오픈율 (Day 0)          30%              45%               +50%
클릭율 (Day 0)          8%               18%               +125%
전환율 (3일 시퀀스)     15%              35%               +233%
CPA (고객획득비용)      85,000원         45,000원          -47%
LTV (생명주기가치)      450,000원        750,000원         +67%
```

### 월 기대 효과

```
현재 상담 건수: 200건/월
현재 전환율: 15% → 30명

자동화 후:
- 전환율 증대: 15% → 35% (추가 40명/월)
- 월 매출 증대: 40명 × 700,000원 = 28,000,000원
- CPA 절감: (85,000 - 45,000) × 70명 = 2,800,000원

**월 +30,800,000원 (한화 약 4천만원 이상)**
```

---

## 🔧 구현 체크리스트

### Phase 1: 템플릿 및 API (완료)
- [x] `email-templates.ts`: Day 0/1/2/3 렌더러 4개 작성
- [x] `funnel-scheduler.ts`: Day 0-7 자동 스케줄링 로직
- [x] `POST /api/email/funnel`: 퍼널 시작 엔드포인트
- [x] `GET /api/email/funnel`: 퍼널 조회 엔드포인트
- [x] `DELETE /api/email/funnel`: 퍼널 취소 엔드포인트

### Phase 2: Cron 및 배치 처리 (완료)
- [x] `GET /api/cron/email-funnel`: 자동 발송 Cron
- [x] 재시도 로직 (최대 3회)
- [x] 야간 차단 처리 (22:00-08:00)
- [x] Batch 처리 (100개씩)

### Phase 3: 성과 추적 (다음)
- [ ] `/api/email/funnel/stats` - 퍼널 성과 대시보드
- [ ] Funnel Analytics (오픈율, 클릭율, 전환율)
- [ ] A/B 테스트 지원
- [ ] 주간/월간 리포팅

---

## 📝 사용 예시

### 1. 상담 완료 후 퍼널 시작

```bash
curl -X POST https://crm.cruisedot.co.kr/api/email/funnel \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "contact_123",
    "consultantName": "이순신 상담사",
    "consultationType": "건강검진",
    "recommendedTier": "standard",
    "seatsRemaining": 10,
    "discountPercent": 25,
    "originalPrice": "498,000원",
    "discountedPrice": "374,000원"
  }'

# 응답
{
  "ok": true,
  "message": "Day 0-7 이메일 퍼널 (5개) 등록 완료",
  "scheduledIds": [
    "email_day0_123",
    "email_day1_123",
    "email_day2_123",
    "email_day3_123",
    "email_day7_123"
  ]
}
```

### 2. 고객이 구매한 경우 퍼널 취소

```bash
curl -X DELETE "https://crm.cruisedot.co.kr/api/email/funnel?contactId=contact_123&reason=PURCHASED"

# 응답
{
  "ok": true,
  "message": "3개의 퍼널 이메일이 취소되었습니다",
  "cancelledCount": 3
}
```

### 3. 퍼널 이메일 조회

```bash
curl https://crm.cruisedot.co.kr/api/email/funnel?contactId=contact_123

# 응답
{
  "ok": true,
  "funnelEmails": [
    {
      "id": "email_day0_123",
      "contactId": "contact_123",
      "subject": "[크루즈닷] 홍길동님 상담 감사합니다",
      "scheduledAt": "2026-06-02T13:00:00Z",
      "status": "SENT"
    },
    ...
  ]
}
```

---

## 🔄 Day별 자동 실행 타임라인

```
상담 완료 (Day 0)
├─ T+1h: Day 0 이메일 발송 (감정 + 긴박감)
├─ T+24h (9:00am): Day 1 이메일 발송 (솔루션 + 추천)
├─ T+48h (10:00am): Day 2 이메일 발송 (신뢰 + 사례)
├─ T+72h (8:00am): Day 3 이메일 발송 (최종 클로징 + 할인)
└─ T+7d (2:00pm): Day 7 팔로우업 (추가 개입)

[Cron 일일 실행: 오전 8시]
- 예약된 모든 이메일 배치 발송 (100개씩)
- 실패 시 자동 재시도 (5분 후, 최대 3회)
- 야간 차단 처리 (22:00-08:00, 내일로 연기)
```

---

## 💡 최적화 팁

### 1. 오픈율 증대
- **발송 시간**: 오전 8-10시, 점심시간 (12-13시), 저녁 (19-20시)
- **Subject 라인**: 50자 이내, 숫자 또는 이모지 포함
- **예시**: "[긴급] 이름님 한정 할인 72시간 남음 ⏰"

### 2. 클릭율 증대
- **CTA**: 3개 이상 (상단, 중간, 하단)
- **색상**: 빨강(긴급), 파랑(안내), 초록(행동)
- **텍스트**: 15글자 이내, 동작 동사 사용

### 3. 전환율 증대
- **Social Proof**: 만족도 94%, 성공 사례 3개 이상
- **Scarcity**: "10석 남음", "72시간 한정"
- **Guarantee**: "30일 환불 보장", "무료 상담"

### 4. A/B 테스트
```
Test 1: Subject 라인
- A: "[크루즈닷] 상담 감사합니다"
- B: "[긴급] 72시간 뒤 할인 종료 ⏰"

Test 2: CTA 버튼 색상
- A: 파랑 (#0d6efd)
- B: 빨강 (#d32f2f)

Test 3: 이메일 길이
- A: 짧음 (400px)
- B: 보통 (600px)
```

---

## 🚀 배포 확인

### 1. TypeScript 컴파일 확인
```bash
npx tsc --noEmit
```

### 2. 테스트 발송
```bash
# Day 0 즉시 발송 (테스트)
POST /api/email/schedule
{
  "contactId": "test_contact",
  "subject": "[테스트] 상담 감사합니다",
  "content": "<h1>테스트 메일</h1>",
  "sendNow": true
}
```

### 3. Cron 테스트
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://crm.cruisedot.co.kr/api/cron/email-funnel
```

---

## 📞 문제 해결

### 이메일이 발송되지 않음
1. Contact에 email 필드가 있는지 확인
2. 조직 SMTP 설정 완료 여부 확인 (`OrgEmailConfig`)
3. Cron 실행 여부 확인 (Server 로그)

### Cron이 자동 실행되지 않음
1. `CRON_SECRET` 환경변수 설정 여부 확인
2. Vercel/Railway 스케줄 설정 확인
3. 또는 외부 Cron 서비스 (EasyCron, Cronitor) 연동

### 개인정보 보호
- Email 주소는 로그에 부분 마스킹 (첫 5자 + ***)
- HTML content에 고객명/이메일 치환 제거 가능
- GDPR 준수: 이메일 수신 거부 링크 추가 권장

---

## 🎁 추가 기능 (Future)

### Phase 4: SMS 병렬화
- Day 0: SMS (오후 2시) + 이메일 (오전 9시) 동시
- A/B 테스트: SMS vs 이메일 어느 것이 더 효과적?

### Phase 5: WhatsApp/KakaoTalk 통합
- Day 2: KakaoTalk 플러스친구 메시지
- Day 3: 최종 알림

### Phase 6: 렌즈별 동적 메시지
- L3 차별성: "경쟁사와의 비교" 강조
- L5 자기투영: "맞춤형" 강조
- L6 손실회피: "한정" + "시간 제한" 강조

---

**수정일**: 2026-06-02
**버전**: 1.0 (Day 0-3 완성)
