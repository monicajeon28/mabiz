# Loop 6 Webhook Deployment Checklist

## Pre-Deployment (Do This First)

### Environment Setup
- [ ] Copy `.env.example` to `.env.local`
- [ ] Set `CRUISEDOT_WEBHOOK_SECRET` (actual value, not placeholder)
- [ ] Set `MABIZ_INQUIRY_WEBHOOK_SECRET` (actual value)
- [ ] Set `ALIGO_API_KEY` from Aligo dashboard
- [ ] Set `ALIGO_USER_ID` (your Aligo account)
- [ ] Set `ALIGO_SENDER_PHONE` (pre-approved sender number)
- [ ] Verify `DATABASE_URL` points to production database
- [ ] Set `CRON_SECRET` for scheduled tasks (if using Vercel Cron)

### Code Build
- [ ] Run `npm install` (verify all dependencies)
- [ ] Run `npm run build` (should complete without errors)
- [ ] Run `npm run lint` (should have 0 lint issues)
- [ ] Verify TypeScript compilation (no type errors)
- [ ] Check `.next/` directory created

### Database Migrations
- [ ] Connect to production database
- [ ] Run `npx prisma db push` (apply schema changes)
- [ ] Verify all tables exist:
  - `Contact`
  - `FormSubmission`
  - `CommissionLedger`
  - `Partner`
  - `Task`
  - `processedWebhookEvent`
- [ ] Check unique constraints:
  - `Contact.bookingRef_organizationId`
  - `processedWebhookEvent.eventId`
- [ ] Verify indexes on webhook key fields

### Webhook URL Registration
- [ ] Register in Cruisedot Admin:
  ```
  https://your-domain.com/api/webhooks/cruisedot-payment
  Authorization: Bearer [CRUISEDOT_WEBHOOK_SECRET]
  ```
- [ ] Register in Cruisedot Admin:
  ```
  https://your-domain.com/api/webhooks/cruisedot-settlement
  Authorization: Bearer [CRUISEDOT_WEBHOOK_SECRET]
  ```
- [ ] Register in GMcruise Admin:
  ```
  https://your-domain.com/api/webhooks/inquiry
  Authorization: Bearer [MABIZ_INQUIRY_WEBHOOK_SECRET]
  ```
- [ ] Test webhook signature generation matches (HMAC-SHA256)

---

## Deployment

### Vercel Deployment
- [ ] Commit all changes to git
- [ ] Push to main branch: `git push origin main`
- [ ] Verify GitHub Actions build succeeded
- [ ] Check Vercel deployment dashboard for success
- [ ] Verify preview URL loads without errors

### Environment Variables in Vercel
- [ ] Add to Vercel Settings > Environment Variables:
  - [ ] `CRUISEDOT_WEBHOOK_SECRET` (Production only)
  - [ ] `MABIZ_INQUIRY_WEBHOOK_SECRET` (Production only)
  - [ ] `DATABASE_URL` (Production)
  - [ ] `DIRECT_URL` (Production, for migrations)
  - [ ] `ALIGO_API_KEY` (Production)
  - [ ] `ALIGO_USER_ID` (Production)
  - [ ] `ALIGO_SENDER_PHONE` (Production)
  - [ ] `CRON_SECRET` (Production)
  - [ ] `NODE_ENV=production`
  - [ ] `LOG_LEVEL=info`

### Verify Production Build
- [ ] Webhook endpoints accessible:
  - [ ] `POST /api/webhooks/cruisedot-payment` → 401 (missing auth) or 400 (bad request)
  - [ ] `POST /api/webhooks/cruisedot-settlement` → 401 or 400
  - [ ] `POST /api/webhooks/inquiry` → 401 or 400
- [ ] Logs appear in Vercel dashboard
- [ ] Database connection working (check logs for connection errors)

---

## Testing (Post-Deployment)

### Manual E2E Test 1: Payment Webhook
```bash
# Generate test payload
SECRET="[your-CRUISEDOT_WEBHOOK_SECRET]"
PAYLOAD='{
  "eventId": "evt_test_payment_001",
  "eventType": "payment.created",
  "timestamp": "2026-05-28T02:30:00Z",
  "bookingRef": "booking_test_001",
  "status": "CONFIRMED"
}'

# Generate HMAC signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.*= //')

# Send webhook
curl -X POST https://your-domain.com/api/webhooks/cruisedot-payment \
  -H "Authorization: Bearer $SECRET" \
  -H "x-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

**Expected Response**:
```json
{
  "ok": true
}
```

**Verify in Database**:
- [ ] Contact created with `bookingRef: "booking_test_001"`
- [ ] FormSubmission created with `variant: "cruisedot_payment"`
- [ ] processedWebhookEvent created with `eventId: "evt_test_payment_001"`
- [ ] Check logs for: `[CruisedotWebhook] 수신`

### Manual E2E Test 2: Inquiry Webhook
```bash
SECRET="[your-MABIZ_INQUIRY_WEBHOOK_SECRET]"
PAYLOAD='{
  "phone": "01012345678",
  "name": "테스트고객",
  "email": "test@example.com",
  "inquiryType": "pricing",
  "message": "가격이 너무 비싼데 할인은 없나요?",
  "productCode": "cruise_001",
  "affiliateCode": "aff_001",
  "organizationId": "org_001",
  "submittedAt": "2026-05-28T02:30:00Z",
  "eventId": "evt_inquiry_test_001"
}'

curl -X POST https://your-domain.com/api/webhooks/inquiry \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

**Expected Response**:
```json
{
  "ok": true,
  "contact": {
    "id": "...",
    "phone": "01012345678"
  },
  "task": {
    "id": "...",
    "dueDate": "2026-05-29T02:30:00Z"
  },
  "suggestedResponse": {
    "lensType": "L1",
    "lensLabel": "가격이의",
    "responseStrategy": "가치 재정의 + 분할결제 강조",
    "suggestedScript": "...",
    "urgencyLevel": "HIGH",
    "followUpTemplate": "L1_PRICE_OBJECTION_FLOW"
  }
}
```

**Verify in Database**:
- [ ] Contact created with `phone: "01012345678"`
- [ ] Task created with `type: "INQUIRY_RESPONSE"`
- [ ] Task has `dueDate: NOW + 24 hours`
- [ ] Check logs for lens detection: `detectLensFromMessage`

### Manual E2E Test 3: Settlement Webhook
```bash
SECRET="[your-CRUISEDOT_WEBHOOK_SECRET]"
PAYLOAD='{
  "eventId": "evt_test_settlement_001",
  "eventType": "settlement.approved",
  "timestamp": "2026-05-28T02:30:00Z",
  "settlementId": "settle_test_001",
  "partnerId": "partner_001",
  "period": "2026-05",
  "status": "APPROVED",
  "amount": 1000000,
  "commissionRate": 10
}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.*= //')

curl -X POST https://your-domain.com/api/webhooks/cruisedot-settlement \
  -H "Authorization: Bearer $SECRET" \
  -H "x-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

**Verify in Database**:
- [ ] CommissionLedger created with `settlementId: "settle_test_001"`
- [ ] Partner revenue updated
- [ ] Check logs for: `[SettlementWebhook] 수신`

### Error Scenario Testing
- [ ] Test 401 response: Send webhook without Authorization header
  - Expected: `{"ok": false}` with HTTP 401
- [ ] Test 403 response: Send webhook with invalid signature
  - Expected: `{"ok": false}` with HTTP 403
- [ ] Test 400 response: Send JSON with missing required fields
  - Expected: `{"ok": false, "message": "필수 필드 누락"}` with HTTP 400
- [ ] Test duplicate handling: Send same eventId twice
  - Expected: First request HTTP 200 with `ok: true`, second request HTTP 200 with `duplicate: true`

---

## Monitoring (First 24 Hours)

### Log Monitoring
- [ ] Check Vercel logs every 2 hours
- [ ] Look for error patterns:
  - [ ] CRUISEDOT_WEBHOOK_SECRET 미설정 → env vars issue
  - [ ] 인증 실패 → token mismatch
  - [ ] 서명 검증 실패 → signature calculation issue
  - [ ] JSON 파싱 실패 → payload format issue
  - [ ] Database errors → connection or schema issue

### Performance Metrics
- [ ] Webhook latency: Should be <500ms (mean)
  - Check Vercel Analytics
  - Look for spikes (should be <2s max)
- [ ] Success rate: Should be >99%
  - Count successful responses vs errors
  - Investigate any failures
- [ ] Database connection: Monitor for errors
  - Check Prisma logs for connection pool issues
  - Verify database is not reaching capacity

### Alert Setup (Recommended)
- [ ] Set up Sentry integration for errors
  - [ ] Monitor 500 errors on webhook endpoints
  - [ ] Alert if error rate >1% in any 5-minute window
- [ ] Set up dashboard monitoring
  - [ ] Track webhook success rate by endpoint
  - [ ] Monitor SMS delivery rate (should be >95%)
  - [ ] Track Contact creation rate
- [ ] Set up email alerts for critical errors
  - [ ] CRUISEDOT_WEBHOOK_SECRET not set
  - [ ] Database connection failure
  - [ ] SMS API failure

---

## Post-Deployment (After 24 Hours)

### Monitoring Handoff
- [ ] Assign monitoring responsibility
- [ ] Document alert recipients
- [ ] Set up runbook for common issues
- [ ] Update team on webhook status

### Production Validation
- [ ] Verify real payment webhooks are being processed
- [ ] Verify real inquiry webhooks are working
- [ ] Check Contact creation rate matches expected volume
- [ ] Verify Task creation rate is reasonable
- [ ] Check SMS delivery reports from Aligo

### Performance Optimization (if needed)
- [ ] Profile slow webhooks (>1 second)
- [ ] Add database indexes if needed
- [ ] Consider connection pooling if high volume
- [ ] Review lock contention on Contact UPSERT

### Documentation Update
- [ ] Document any deviations from test plan
- [ ] Update runbook with real-world scenarios
- [ ] Document any performance baselines achieved
- [ ] Create incident response guide for common failures

---

## Rollback Plan (If Issues Found)

### If Webhook Endpoints Fail
```bash
# 1. Disable webhooks in Cruisedot Admin (pause or delete)
# 2. Revert to previous version in Vercel
#    - Go to Deployments tab
#    - Select previous successful deployment
#    - Click "Promote to Production"
# 3. Verify old endpoints working
# 4. Investigation:
#    - Check git diff to find breaking changes
#    - Review error logs from failed deployment
#    - Fix issue and re-deploy
```

### If SMS API Fails
```bash
# 1. Check Aligo service status
# 2. Verify credentials in .env
# 3. Test SMS directly via Aligo dashboard
# 4. If issue persists:
#    - Comment out sendDay0Sms in payment webhook
#    - Re-deploy
#    - Contacts will still be created (no SMS, but no blocking error)
#    - Investigate Aligo issue separately
```

### If Database Connection Fails
```bash
# 1. Check DATABASE_URL is correct
# 2. Verify IP whitelist includes Vercel IPs
# 3. Check database is running and accessible
# 4. Verify schema migrations applied
# 5. Redeploy with corrected credentials
```

---

## Sign-Off

- [ ] All tests passed (39/39 integration tests)
- [ ] All environment variables set
- [ ] Production build successful
- [ ] Webhook URLs registered
- [ ] Manual E2E tests passed (3/3 flows)
- [ ] Error scenarios tested
- [ ] Monitoring configured
- [ ] Team notified and trained
- [ ] Documentation complete

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Verified By**: _______________  

---

## Notes

**Success Criteria**:
- Webhook endpoints respond with HTTP 200 on valid payloads
- Contacts created from payment webhooks
- Tasks created from inquiry webhooks
- SMS messages queued for Day 0 delivery
- CommissionLedgers recorded from settlement webhooks
- Error rate <1% (excluding Cruisedot network issues)
- Latency <500ms (mean)

**Support Contacts**:
- On-call Engineer: _______________
- Database Admin: _______________
- Product Manager: _______________

**Useful Links**:
- [Sentry Error Tracking](https://sentry.io)
- [Vercel Dashboard](https://vercel.com)
- [Database Console](link-to-db-console)
- [Cruisedot Webhook Settings](link-to-cruisedot-admin)

---

**Created**: 2026-05-28  
**Status**: READY FOR DEPLOYMENT
