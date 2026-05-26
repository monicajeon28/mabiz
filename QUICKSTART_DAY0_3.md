# Day 0-3 Sequence - Quick Start Guide

## 1️⃣ Apply Database Migration
```bash
# Option A: Using Prisma (if DB_URL set)
npx prisma migrate deploy

# Option B: Manual SQL execution
# Run: D:\mabiz-crm\prisma\migrations\add_sms_sequence_models.sql
# Against your PostgreSQL database
```

## 2️⃣ Seed Test Data
```bash
cd D:\mabiz-crm
npx ts-node scripts/seed-day0-3-sequences.ts

# Creates 3 sequences:
# - 크루즈 골드 Day 0-3 (ACTIVE, L6 렌즈)
# - 렌탈 Day 0-3 (DRAFT)
# - 부재중 고객 재활성화 (ACTIVE, L0 렌즈)
```

## 3️⃣ Test API Endpoints

### List Sequences
```bash
curl -X GET http://localhost:3000/api/tools/day0-3-sequences \
  -H "Authorization: Bearer {token}"

# Response: { ok: true, sequences: [...], total: 3 }
```

### Get Sequence Details
```bash
curl -X GET http://localhost:3000/api/tools/day0-3-sequences/seq_123 \
  -H "Authorization: Bearer {token}"

# Response: { ok: true, sequence: {...with days and variants} }
```

### Create New Sequence
```bash
curl -X POST http://localhost:3000/api/tools/day0-3-sequences \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Sequence",
    "productCode": "CRUISE_GOLD",
    "psychologyLens": "L6",
    "days": [
      {
        "day": 0,
        "delay": 0,
        "message": "Day 0 message",
        "variants": [
          {"code": "A", "message": "Variant A"},
          {"code": "B", "message": "Variant B"}
        ]
      }
    ]
  }'

# Response: { ok: true, id: "seq_456" }
```

### Deploy Sequence
```bash
curl -X POST http://localhost:3000/api/tools/day0-3-sequences/seq_123/deploy \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "contactIds": ["contact_1", "contact_2"],
    "deployMessage": "Testing deployment"
  }'

# Response: { ok: true, deployed: 2, scheduled: 2 }
```

### Send Test SMS
```bash
curl -X POST http://localhost:3000/api/tools/day0-3-sequences/seq_123/test \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "contactPhone": "01012345678",
    "delaySeconds": 5
  }'

# Response: { ok: true, schedule: [Day 0-3 times] }
```

### Get Analytics
```bash
curl -X GET http://localhost:3000/api/tools/day0-3-sequences/seq_123/analytics \
  -H "Authorization: Bearer {token}"

# Response: { ok: true, analytics: {...performance metrics} }
```

## 4️⃣ Database Queries

### Check Created Sequences
```sql
SELECT id, name, status, totalSent, totalOpened 
FROM "SmsSequenceTemplate" 
ORDER BY createdAt DESC;
```

### Check Active Deployments
```sql
SELECT c.id, c.contactId, c.status, c.nextSendAt
FROM "ContactSequenceInstance" c
WHERE c.status = 'ACTIVE'
ORDER BY c.nextSendAt ASC
LIMIT 10;
```

### Check Variants
```sql
SELECT s.id, s.variantCode, s.day, s.messageContent, s.isWinner
FROM "SmsSequenceVariant" s
ORDER BY s.sequenceId, s.day, s.variantCode;
```

## 5️⃣ Troubleshooting

### "Table does not exist"
→ Apply migration: `npx prisma migrate deploy`

### "Organization not found"
→ Check session has organizationId: `console.log(session)`

### "Sequence not found"
→ Check organizationId matches: `SELECT * FROM "SmsSequenceTemplate" WHERE id = 'seq_xxx'`

### "Validation error"
→ Check Zod error details in response: `error.details`

## 6️⃣ Next Steps

- **Phase 2**: Add frontend components (Playbook UI)
- **Phase 3**: Implement cron jobs (SMS dispatch + analytics)
- **Phase 4**: Testing & production deployment

See docs/DAY0_3_SEQUENCE_IMPLEMENTATION.md for detailed docs.
