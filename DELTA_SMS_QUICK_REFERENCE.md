# Delta SMS Cron - Quick Reference

**Menu #38 Phase 4 Track 1 완성 가이드**

---

## 파일 구조

```
src/
├── lib/
│   ├── delta-sms.ts (347줄)
│   │   ├── executeDeltagSms(campaignId) - 메인 발송 함수
│   │   ├── getActiveDeltaCampaigns() - 캠페인 조회
│   │   ├── calculateDaysSincePurchase() - Day 계산
│   │   ├── selectVariant() - A/B/C 선택
│   │   ├── getDeltaMessage() - 메시지 조회
│   │   └── RENTAL_MESSAGES 라이브러리 (12개)
│   │
│   └── cron/
│       └── delta-sms-schedule.ts (149줄)
│           ├── scheduleDeltaSms(schedule) - 스케줄러
│           ├── deltaSmsScheduleMorning()
│           ├── deltaSmsScheduleAfternoon()
│           └── deltaSmsScheduleEvening()
│
└── app/
    └── api/
        └── cron/
            └── delta-sms/
                └── route.ts (208줄)
                    ├── GET /api/cron/delta-sms?schedule=...
                    └── POST /api/cron/delta-sms (개발용)
```

**Total: 704줄 + 문서 3개**

---

## 빠른 배포

### 1. 로컬 테스트 (1분)
```bash
npm run dev
curl -X POST http://localhost:3000/api/cron/delta-sms \
  -H "Content-Type: application/json" \
  -d '{"schedule":"morning"}'
```

### 2. Vercel 설정 (2분)
```json
{
  "crons": [
    { "path": "/api/cron/delta-sms?schedule=morning", "schedule": "0 0 * * *" },
    { "path": "/api/cron/delta-sms?schedule=afternoon", "schedule": "0 5 * * *" },
    { "path": "/api/cron/delta-sms?schedule=evening", "schedule": "0 10 * * *" }
  ]
}
```

### 3. 환경변수 (1분)
```
CRON_SECRET=your_secret_key
```

### 4. 배포 (1분)
```bash
git push origin main
```

---

## 메시지 미리보기

### Day 0 (간단함)
```
[크루즈 렌탈]
모니카님, 반가워요! 신민형입니다.

💡 너무 복잡하게 생각하지 마세요.
정말 간단해요:

📱 앱에서 신청 (2분)
📦 집에서 받기 (3일)
✅ 사용 시작 (바로)

"이렇게 간단할 줄 몰랐어요" - 이00님

지금 첫 달 무료로 시작해보세요!
```

### Day 1 (가격)
```
월 4만원 vs 홈케어 15만원
→ 매달 11만원 절약!

배송료 무료, 지금 신청하세요.
```

### Day 2 (위험역전)
```
"만약 안 맞으면 어떻게 하지?"

안심하세요!
• 언제든 취소 가능
• 위약금 0원
• 환불 3일 안에 처리

2주 무료체험으로 확인해보세요!
```

### Day 3 (긴급성)
```
⏰ 마지막 기회입니다!

오늘까지만:
🎁 첫 달 100% 무료 + 배송비 0원
🎁 언제든 취소 가능 (계약금 0원)

"이미 100명이 시작했어요!"

내일부터는 월 4만원이 돼요.
```

---

## 시간대 설정

| 시간 | 용도 | Cron |
|------|------|------|
| 09:00 KST | 아침 (Day 0/1) | `0 0 * * *` |
| 14:00 KST | 오후 (Day 2) | `0 5 * * *` |
| 19:00 KST | 저녁 (Day 3) | `0 10 * * *` |

---

## 테스트 SQL

```sql
-- 렌탈 캠페인 생성
INSERT INTO "CrmMarketingCampaign" (
  id, organizationId, groupId, title, status, sendSms, sendAt
) VALUES (
  'test_rental', 'org_id', 'group_id', '렌탈 3일 시퀀스', 
  'ACTIVE', true, NOW()
);

-- Day 0 고객 추가
INSERT INTO "SendingHistory" (
  id, organizationId, campaignId, contactId, phone, channel, 
  body, status, scheduledAt
) VALUES (
  'h1', 'org_id', 'test_rental', 'c1', '01012345671', 'SMS',
  '[테스트]', 'SENT', NOW()
);
```

---

## 모니터링

### 실시간 발송 확인
```sql
SELECT 
  variantKey,
  COUNT(*) as count,
  SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed
FROM "SendingHistory"
WHERE campaignId IN (
  SELECT id FROM "CrmMarketingCampaign" WHERE title LIKE '%렌탈%'
)
  AND createdAt > NOW() - INTERVAL '1 day'
GROUP BY variantKey;
```

### 일일 통계
```sql
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as total,
  ROUND(100.0 * SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) / COUNT(*), 1) as delivery_rate
FROM "SendingHistory"
WHERE campaignId IN (
  SELECT id FROM "CrmMarketingCampaign" WHERE title LIKE '%렌탈%'
)
GROUP BY DATE(createdAt)
ORDER BY date DESC;
```

---

## 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| SMS 미수신 | Aligo 설정 | OrgSmsConfig 확인 |
| Cron 미실행 | vercel.json 오류 | 문법 검증 후 재배포 |
| 발송 0건 | 캠페인 없음 | title에 "렌탈" 포함 필수 |
| 502 에러 | CRON_SECRET 미설정 | 환경변수 추가 |

---

## 성과 목표

```
일 100명 신청 × 18% 구독율 = 18명/일
월간: 540명 신규 구독
월 수익: 540 × ₩40,000 = ₩21.6M
```

---

## 담당자

**구현:** Agent β (Menu #38 Phase 4 Track 1)  
**문서:** DELTA_SMS_IMPLEMENTATION_SUMMARY.md, DELTA_SMS_DEPLOYMENT_GUIDE.md  
**완료:** 2026-05-19

---

## 체크리스트

- [ ] 로컬 테스트 완료
- [ ] vercel.json 추가
- [ ] CRON_SECRET 설정
- [ ] git commit & push
- [ ] 첫 Cron 실행 대기
- [ ] SendingHistory 확인
- [ ] SMS 수신 확인
- [ ] 모니터링 시작

