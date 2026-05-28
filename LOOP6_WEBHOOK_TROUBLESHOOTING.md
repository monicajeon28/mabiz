# Loop 6 Webhook Troubleshooting Guide

## Quick Diagnosis

### 1. Webhook Not Received
**Symptom**: Webhook sent but endpoint returned no response

**Checklist**:
```bash
# 1. Verify endpoint exists
curl -X POST http://localhost:3000/api/webhooks/cruisedot-payment \
  -H "Authorization: Bearer test_secret" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test_123","status":"CONFIRMED"}'

# Expected: HTTP 400 (missing required fields) or 500 (missing secret)
# Not expected: HTTP 404 (endpoint not found)

# 2. Check environment variables
grep CRUISEDOT_WEBHOOK_SECRET .env.local
grep MABIZ_INQUIRY_WEBHOOK_SECRET .env.local

# 3. Verify Vercel deployment
vercel logs --tail
```

---

### 2. HTTP 401 (Unauthorized)

**Error**: `"인증 실패"`

**Cause**: Bearer token doesn't match secret

**Fix**:
```
1. Check Cruisedot webhook configuration:
   - Go to Cruisedot Admin > Webhooks
   - Verify Authorization header: Bearer XXXXX

2. Verify .env.local has CRUISEDOT_WEBHOOK_SECRET
   grep CRUISEDOT_WEBHOOK_SECRET .env.local
   
3. Token must match EXACTLY (case-sensitive)
   - No extra spaces
   - No Bearer prefix in secret itself (only in header)
```

**Example**:
```bash
# WRONG:
Authorization: Bearer CRUISEDOT_WEBHOOK_SECRET_VALUE_IS_HERE
CRUISEDOT_WEBHOOK_SECRET="Bearer CRUISEDOT_WEBHOOK_SECRET_VALUE_IS_HERE"

# RIGHT:
Authorization: Bearer CRUISEDOT_WEBHOOK_SECRET_VALUE_IS_HERE
CRUISEDOT_WEBHOOK_SECRET="CRUISEDOT_WEBHOOK_SECRET_VALUE_IS_HERE"
```

---

### 3. HTTP 403 (Forbidden - Signature Mismatch)

**Error**: `"서명 검증 실패"`

**Cause**: HMAC signature doesn't match

**Debugging**:
```javascript
// Expected flow in Cruisedot:
const secret = 'CRUISEDOT_WEBHOOK_SECRET_VALUE';
const body = JSON.stringify(payload);
const crypto = require('crypto');

// Generate signature
const signature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

// Send headers
headers = {
  'Authorization': `Bearer ${secret}`,
  'x-signature': signature,
  'Content-Type': 'application/json'
};
```

**Fix**:
1. Verify Cruisedot uses SHA256 (not MD5, SHA1)
2. Verify body sent to signature matches exactly (no whitespace changes)
3. Verify secret is same in both places
4. Check signature is 64 hex characters

```bash
# Test locally
node -e "
const crypto = require('crypto');
const secret = 'test_secret_key';
const body = JSON.stringify({eventId: 'test123'});
const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
console.log('Signature:', sig);
console.log('Length:', sig.length, '(should be 64)');
"
```

---

### 4. HTTP 400 (Bad Request - Missing Fields)

**Error**: `"필수 필드 누락"`

**Cause**: Required fields missing from payload

**Payment Webhook - Required Fields**:
```json
{
  "eventId": "evt_payment_123",           // ✅ REQUIRED
  "eventType": "payment.created",         // ✅ REQUIRED
  "bookingRef": "booking_123",            // ✅ REQUIRED
  "status": "CONFIRMED"                   // ✅ REQUIRED
}
```

**Settlement Webhook - Required Fields**:
```json
{
  "eventId": "evt_settlement_123",        // ✅ REQUIRED
  "eventType": "settlement.approved",     // ✅ REQUIRED
  "settlementId": "settle_123",           // ✅ REQUIRED
  "partnerId": "partner_001",             // ✅ REQUIRED
  "period": "2026-05",                    // ✅ REQUIRED
  "status": "APPROVED",                   // ✅ REQUIRED
  "amount": 1000000                       // ✅ REQUIRED
}
```

**Inquiry Webhook - Required Fields**:
```json
{
  "phone": "01012345678",                 // ✅ REQUIRED
  "name": "John Doe"                      // ✅ REQUIRED
}
```

**Fix**: Verify payload includes all required fields (no null/undefined)

---

### 5. HTTP 422 (Organization Not Found)

**Error**: `"조직 미확인"`

**Cause**: Contact's organizationId doesn't exist in database

**Fix**:
```bash
# 1. Check if organizationId exists
psql $DATABASE_URL -c "SELECT id, name FROM Organization LIMIT 5;"

# 2. Verify Contact.organizationId matches
psql $DATABASE_URL -c "SELECT * FROM Contact WHERE bookingRef='booking_123';"

# 3. If organization missing, create it:
psql $DATABASE_URL -c "
  INSERT INTO Organization (id, name) 
  VALUES ('org_001', 'Default Organization');
"
```

**Notes**:
- organizationId is required for multi-tenant support
- Each webhook must include valid organizationId
- If Cruisedot doesn't provide it, set default in .env: `NEXT_PUBLIC_DEFAULT_ORG_ID`

---

### 6. HTTP 500 (Server Error)

**Error**: Could be multiple causes

**Debug Steps**:
```bash
# 1. Check server logs
npm run dev  # or production logs

# 2. Check specific errors:
# - "CRUISEDOT_WEBHOOK_SECRET 미설정" → Set environment variable
# - "JSON 파싱 실패" → Payload is not valid JSON
# - Database connection error → Check DATABASE_URL
# - SMS API failure → Check ALIGO credentials

# 3. Check database connection
npx prisma db execute --stdin << 'SQL'
SELECT 1
SQL

# 4. Verify Prisma schema
npx prisma generate
npx prisma db push
```

---

## Monitoring in Production

### Webhook Success Rate
```bash
# Check logs for webhook processing
# Expected pattern:
# [CruisedotWebhook] 수신 { eventId: '...', status: '...' }
# [CruisedotWebhook] Contact upsert { contactId: '...', isNew: true }

# Success rate should be >99%
# Monitor alerts if >1% failures in any hour
```

### Common Issues & Solutions

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Webhooks slow (>2s) | DB queries slow | Add indexes on eventId, bookingRef |
| SMS not sent | Aligo API key invalid | Verify ALIGO_API_KEY in dashboard |
| Duplicate contacts | Multiple webhooks same bookingRef | UPSERT pattern handles this |
| Tasks not created | organizationId missing | Verify organizationId in Inquiry payload |
| Contact phone empty | Webhook doesn't include phone | Update Cruisedot payload format |

---

## Testing Locally

### Setup Test Environment
```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Set test values
echo "CRUISEDOT_WEBHOOK_SECRET=test_secret_key_123456789012345678" >> .env.local
echo "MABIZ_INQUIRY_WEBHOOK_SECRET=test_inquiry_secret_key_123456" >> .env.local
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/mabiz_test" >> .env.local

# 3. Start dev server
npm run dev

# 4. Test webhook in another terminal
```

### Test Payment Webhook
```bash
#!/bin/bash

SECRET="test_secret_key_123456789012345678"
PAYLOAD=$(cat <<'EOF'
{
  "eventId": "evt_test_1234",
  "eventType": "payment.created",
  "timestamp": "2026-05-28T02:30:00Z",
  "bookingRef": "booking_test_001",
  "status": "CONFIRMED",
  "refundAmount": 0
}
EOF
)

# Generate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.*= //')

# Send webhook
curl -X POST http://localhost:3000/api/webhooks/cruisedot-payment \
  -H "Authorization: Bearer $SECRET" \
  -H "x-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "Expected response: {\"ok\":true}"
```

### Test Inquiry Webhook
```bash
#!/bin/bash

SECRET="test_inquiry_secret_key_123456"
PAYLOAD=$(cat <<'EOF'
{
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
}
EOF
)

curl -X POST http://localhost:3000/api/webhooks/inquiry \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "Expected response includes: suggestedResponse with lensType L1"
```

---

## Production Deployment Checklist

### Before Deploying
- [ ] All environment variables set in Vercel
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] Database migrations applied
- [ ] SMS API credentials verified

### After Deploying
- [ ] Webhook URLs registered in Cruisedot
- [ ] Send test webhooks to verify routing
- [ ] Check logs appear in Vercel dashboard
- [ ] Monitor error rate for first hour

### First Week
- [ ] Check webhook success rate daily
- [ ] Verify SMS messages sent
- [ ] Review Contact/Task creation in dashboard
- [ ] Monitor database performance

---

## Contact Support

If issues persist after troubleshooting:

**Logs to provide**:
1. Webhook request body (redact secrets)
2. Webhook response (HTTP status + body)
3. Server logs (timestamp of webhook)
4. Environment variables (mask values)

**Example bug report**:
```
Webhook: Payment
Timestamp: 2026-05-28 02:35:00 UTC
EventID: evt_payment_12345
Status Code: 403
Error: "서명 검증 실패"
Secret length: 64 chars
Signature length: 64 chars (hex)
Action: Update secret in Cruisedot to match .env.local
```

---

## FAQ

**Q: Can I test webhooks without Cruisedot?**  
A: Yes, use curl or Postman with test payloads above

**Q: What if Contact already exists?**  
A: UPSERT pattern updates existing, idempotent

**Q: How long to process webhook?**  
A: <500ms typically, <2s if slow DB

**Q: What if SMS API fails?**  
A: Contact still created, Task created anyway, SMS retried later

**Q: Can I replay webhooks?**  
A: No, idempotency check prevents duplicate processing

**Q: How to monitor webhook health?**  
A: Check logs for success rate, set alerts for >1% errors

---

**Last Updated**: 2026-05-28  
**Status**: READY FOR PRODUCTION
