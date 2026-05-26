# Quick Start: Day 0-3 Sequence Cron

## 5-Minute Setup

### 1. Deploy Code

```bash
# The cron endpoint is already in:
# src/app/api/cron/sequence-dispatcher/route.ts

# If files missing, verify:
git log --oneline | grep -i "day 0-3 sequence"
git status
```

### 2. Update vercel.json

Add to `vercel.json` crons array:

```json
{
  "crons": [
    {
      "path": "/api/cron/sequence-dispatcher",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### 3. Verify Environment Variables

Ensure these exist in `.env.local` or Vercel settings:

```env
ALIGO_API_KEY=your_api_key
ALIGO_USER_ID=your_user_id
ALIGO_SENDER_PHONE=01012345678
```

### 4. Deploy

```bash
git add .
git commit -m "feat: Day 0-3 Sequence Cron Implementation"
git push origin main

# Vercel auto-deploys
# Cron starts executing in ~5 minutes
```

### 5. Verify Execution

Wait 5 minutes, then:

```bash
curl https://your-domain.com/api/admin/sequence-cron-status
```

Expected response shows:
- `schedule.nextRunAt`: Next execution time
- `health`: Organization stats
- `activeSequences`: Your sequences

## Testing Locally

### Test with Mock Data

```bash
# 1. Create test sequence via API
curl -X POST http://localhost:3000/api/playbook/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Day 0-3",
    "psychologyLens": "L6",
    "days": [
      {
        "day": 0,
        "delay": 0,
        "message": "Hi {{name}}, your {{product}} is ready!",
        "variants": [{"code": "A", "message": "Hi {{name}}, your {{product}} is ready!"}]
      },
      {
        "day": 1,
        "delay": 1440,
        "message": "Don't miss out! {{product}} is waiting.",
        "variants": [{"code": "A", "message": "Don't miss out! {{product}} is waiting."}]
      },
      {
        "day": 2,
        "delay": 2880,
        "message": "Final reminder: {{product}} offer ends soon!",
        "variants": [{"code": "A", "message": "Final reminder: {{product}} offer ends soon!"}]
      },
      {
        "day": 3,
        "delay": 4320,
        "message": "Last chance! Secure your {{product}} now.",
        "variants": [{"code": "A", "message": "Last chance! Secure your {{product}} now."}]
      }
    ],
    "productCode": "CRUISE_GOLD"
  }'

# 2. Get sequence ID from response
SEQUENCE_ID="copied-from-response-id"

# 3. Deploy to test contact
curl -X POST http://localhost:3000/api/playbook/sequences/$SEQUENCE_ID/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "contactIds": ["your-test-contact-id"]
  }'

# 4. Manually trigger cron
curl -X POST http://localhost:3000/api/cron/sequence-dispatcher \
  -H "Authorization: Bearer test"

# 5. Check results
curl http://localhost:3000/api/admin/sequence-cron-status
```

### View Database State

```sql
-- Check sequence instance
SELECT id, contactId, sequenceId, status, day0SentAt, createdAt
FROM "ContactSequenceInstance"
WHERE contactId = 'your-test-contact-id'
LIMIT 1;

-- Check SMS logs
SELECT phone, contentPreview, status, sentAt
FROM "SmsLog"
WHERE channel = 'DAY_0_3_SEQUENCE'
ORDER BY sentAt DESC
LIMIT 5;
```

## Common Setups

### Setup 1: Rental Products

For short-term rentals with Day 0-3 urgency:

```json
{
  "name": "렌탈상품 Day 0-3",
  "productCode": "RENTAL",
  "psychologyLens": "L6",
  "days": [
    {
      "day": 0,
      "message": "{{name}}님, {{product}} 예약이 확정되었습니다! 📦 출발 전 꼭 확인하세요."
    },
    {
      "day": 1,
      "message": "혹시 궁금한 점이 있으신가요? {{company}}에서 도와드리겠습니다. 📞"
    },
    {
      "day": 2,
      "message": "{{product}} 최고의 경험을 위한 팁을 공유합니다! 💡"
    },
    {
      "day": 3,
      "message": "마지막 기회! 추가 서비스 선택은 지금까지만 가능합니다. ⏰"
    }
  ]
}
```

### Setup 2: Cruise Gold Members

For premium cruise packages with L10 closing:

```json
{
  "name": "크루즈골드 Day 0-3",
  "productCode": "CRUISE_GOLD",
  "psychologyLens": "L10",
  "days": [
    {
      "day": 0,
      "message": "VIP {{name}}님, 당신을 위한 크루즈 골드 여행이 준비되었습니다! 🚢"
    },
    {
      "day": 1,
      "message": "실제 고객 후기: '최고의 경험이었습니다!' ⭐⭐⭐⭐⭐"
    },
    {
      "day": 2,
      "message": "지금 예약하면 할인 혜택을 받으실 수 있습니다! 💰"
    },
    {
      "day": 3,
      "message": "오늘 밤이 마지막 예약일입니다! 지금 확인하세요 → [버튼]"
    }
  ]
}
```

### Setup 3: B2B Group Tours

For group travel with L7 companion persuasion:

```json
{
  "name": "그룹여행 Day 0-3",
  "productCode": "GROUP_TOUR",
  "psychologyLens": "L7",
  "triggerOn": "INQUIRY",
  "days": [
    {
      "day": 0,
      "message": "{{name}}님, 팀원들을 위한 {{product}} 여행 계획이 완성되었습니다!"
    },
    {
      "day": 1,
      "message": "팀 리더 {{name}}님께: 팀원들의 만족도를 높일 최고의 선택입니다."
    },
    {
      "day": 2,
      "message": "30% 이상의 그룹 리더들이 우리를 선택합니다. 당신의 팀도!"
    },
    {
      "day": 3,
      "message": "최종 결정! {{name}}님의 팀을 위해 지금 예약하세요."
    }
  ]
}
```

## Monitoring Dashboard

View real-time status:

```bash
# Every 30 seconds
watch -n 30 'curl -s http://localhost:3000/api/admin/sequence-cron-status | jq .health'
```

**Key metrics to watch**:

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Active sequences | >0 | 0 | - |
| Error rate | <2% | 2-5% | >5% |
| Execution time | <10s | 10-30s | >30s |
| Completion rate | >60% | 40-60% | <40% |

## Troubleshooting

### "No active sequences found"
→ Create sequence via UI → Deploy to contacts → Wait 5 min

### "Aligo API error"
→ Check ALIGO_API_KEY in .env → Verify account has balance

### "Template not found"
→ Ensure sequence variants exist for each day (0-3)

### "High error rate"
→ See: [DAY0_3_CRON_TROUBLESHOOTING.md](./docs/DAY0_3_CRON_TROUBLESHOOTING.md)

## Files Overview

| File | Purpose |
|------|---------|
| `sequence-lifecycle-service.ts` | Core day calculation & template logic |
| `sequence-batch-processor.ts` | Parallel processing & SMS sending |
| `sequence-completion-detector.ts` | Completion/failure detection |
| `sequence-dispatcher/route.ts` | Main cron endpoint |
| `sequence-cron-status/route.ts` | Monitoring endpoint |
| `DAY0_3_CRON_IMPLEMENTATION.md` | Full technical documentation |
| `DAY0_3_CRON_TROUBLESHOOTING.md` | Detailed troubleshooting guide |

## Next Steps

1. **Create sequences** via Playbook UI
2. **Deploy to contacts** to activate sequences
3. **Monitor health** via `/api/admin/sequence-cron-status`
4. **Analyze performance** with Day-wise metrics
5. **A/B test variants** to optimize rates
6. **Iterate on templates** based on results

## Support

- **Docs**: See [DAY0_3_CRON_IMPLEMENTATION.md](./docs/DAY0_3_CRON_IMPLEMENTATION.md)
- **Troubleshooting**: See [DAY0_3_CRON_TROUBLESHOOTING.md](./docs/DAY0_3_CRON_TROUBLESHOOTING.md)
- **Code**: `src/lib/services/sequence-*.ts`

