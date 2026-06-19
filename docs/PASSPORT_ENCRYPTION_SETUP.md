# Passport Encryption Setup Guide

## Overview

Passport numbers are encrypted using AES-256-CBC with random initialization vectors (IV). This guide helps you set up and use the encryption system.

---

## 1. Environment Variable Setup

### Generate Encryption Key

Run the following command to generate a 32-byte (256-bit) encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This outputs a 64-character hex string (32 bytes). Example:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Add to Environment Variables

Add the key to your `.env.local` (for development) or deployment environment:

```bash
PASSPORT_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**IMPORTANT**: 
- Keep this key secret and secure
- Use different keys for different environments (dev/staging/prod)
- Store in secure secret management (Vercel Environment Variables, AWS Secrets Manager, etc.)
- Never commit to version control

---

## 2. Database Schema

The Prisma schema already includes the required fields:

```prisma
model GmPassportSubmissionGuest {
  // ... other fields ...
  passportNumber     String? // AES-256 encrypted (base64)
  passportIV         String? // Initialization Vector (base64)
  // ... other fields ...
}

model GmTraveler {
  // ... other fields ...
  passportNumber     String? // AES-256 encrypted (base64)
  passportIV         String? // Initialization Vector (base64)
  // ... other fields ...
}
```

No migration needed — fields already exist in the schema.

---

## 3. Implementation Guide

### Saving Encrypted Passport

When creating or updating a record with passport number:

```typescript
import { preparePassportForDb } from '@/lib/passport-db-helpers';

const plainPassportNumber = 'M12345678';

// Encrypt the passport number
const { passportNumber, passportIV } = preparePassportForDb(plainPassportNumber);

// Save to database
await prisma.gmPassportSubmissionGuest.create({
  data: {
    // ... other fields ...
    passportNumber,    // Encrypted
    passportIV,        // Initialization vector
  },
});
```

### Retrieving Decrypted Passport (Admin/Detail View)

When you need the full decrypted passport number:

```typescript
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

const record = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: guestId },
  select: {
    passportNumber: true,
    passportIV: true,
    name: true,
  },
});

// Decrypt
const plainPassport = decryptPassportFromDb(
  record.passportNumber,
  record.passportIV
);

console.log(plainPassport); // "M12345678"
```

### Masking Passport (UI Display)

When showing passport number in lists or previews, use masking:

```typescript
import { maskPassportFromDb } from '@/lib/passport-db-helpers';

const record = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: guestId },
  select: {
    passportNumber: true,
    passportIV: true,
  },
});

// Mask (shows only last 4 digits)
const masked = maskPassportFromDb(
  record.passportNumber,
  record.passportIV
);

console.log(masked); // "****5678"
```

---

## 4. API Endpoints Updated

The following API endpoints now automatically encrypt passport numbers:

1. **POST `/api/passport/public/[token]/submit`** — Customer form submission
2. **POST `/api/passport/public/submit`** — Public passport submission
3. **POST `/api/passport/admin/manual-register`** — Manual registration (admin)
4. **POST `/api/passport/admin/ocr-to-apis`** — OCR processing (admin)
5. **POST `/api/passport/partner/ocr`** — Partner OCR processing

All other endpoints that read passport data should use decryption helpers.

---

## 5. File Structure

- **`src/lib/passport-encryption.ts`** — Core encryption/decryption functions
  - `encryptPassport(text)` — AES-256 encrypt with random IV
  - `decryptPassport(encrypted, iv)` — Decrypt using IV
  - `maskPassport(text)` — Mask (****5678)
  - `generateEncryptionKey()` — Generate new key (for testing)
  - `validateEncryptionKey()` — Validate key setup

- **`src/lib/passport-db-helpers.ts`** — Database integration helpers
  - `preparePassportForDb(passportNumber)` — Prepare for saving
  - `decryptPassportFromDb(encrypted, iv)` — Decrypt from DB
  - `maskPassportFromDb(encrypted, iv)` — Decrypt and mask

- **`src/lib/passport-encryption.test.ts`** — Comprehensive test suite
  - Encryption/decryption tests
  - Multiple format tests (Korean, Chinese, alphanumeric, special chars)
  - Edge case handling (empty, long strings, Unicode)
  - Performance tests (1000 operations < 5 seconds)

- **`src/app/api/passport/encryption-example-route.ts`** — Example implementation patterns

---

## 6. Testing

Run the test suite to verify encryption setup:

```bash
npm test -- passport-encryption
```

Expected output: All tests pass, including:
- Encryption/decryption roundtrip
- Different encryption each time (different IV)
- Multiple formats
- Masking
- Error handling
- Performance (< 5ms per operation on average)

---

## 7. Security Considerations

### ✅ What's Protected
- Passport numbers are encrypted at rest in the database
- Random IV for each encryption (semantic security)
- Uses industry-standard AES-256-CBC
- Encrypted data and IV stored as base64

### ⚠️ Limitations
- **Encrypted fields cannot be directly queried** (WHERE passportNumber = X won't work)
  - Solution: Match by name/DOB/nationality first, then decrypt and compare
  - See `exampleSearchByPassportNumber()` in encryption-example-route.ts
- Key exposure would compromise all encrypted data
- Key rotation requires re-encryption (not implemented yet)

### 🔒 Best Practices
1. **Keep key secure** — Use environment variable management tools
2. **Audit logging** — Log all passport access (already done in `passport-auth.ts`)
3. **Access control** — Only admins can view full passport numbers
4. **Mask by default** — UI lists should use `maskPassportFromDb()`
5. **Export control** — Decrypt only when necessary for authorized users
6. **Data deletion** — Setting to NULL will delete encrypted data (safe deletion)

---

## 8. Migration from Unencrypted Data

If you have existing unencrypted passport data, follow these steps:

### Option 1: One-Time Encryption (Recommended)

```typescript
import prisma from '@/lib/prisma';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

async function encryptExistingPassports() {
  const unencryptedGuests = await prisma.gmPassportSubmissionGuest.findMany({
    where: {
      passportNumber: { not: null },
      passportIV: null,  // Only unencrypted records
    },
  });

  for (const guest of unencryptedGuests) {
    if (guest.passportNumber) {
      const { passportNumber, passportIV } = preparePassportForDb(
        guest.passportNumber
      );
      await prisma.gmPassportSubmissionGuest.update({
        where: { id: guest.id },
        data: { passportNumber, passportIV },
      });
    }
  }

  console.log(`Encrypted ${unencryptedGuests.length} passport records`);
}

// Run migration
encryptExistingPassports().catch(console.error);
```

### Option 2: Database-Level Script

Create `scripts/encrypt-passports.mjs`:

```javascript
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const key = process.env.PASSPORT_ENCRYPTION_KEY;
if (!key) throw new Error('PASSPORT_ENCRYPTION_KEY not set');

const keyBuffer = key.length === 64
  ? Buffer.from(key, 'hex')
  : Buffer.from(key, 'base64');

function encryptPassport(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encrypted: Buffer.from(encrypted, 'hex').toString('base64'),
    iv: iv.toString('base64'),
  };
}

async function migratePassports() {
  const guests = await prisma.gmPassportSubmissionGuest.findMany({
    where: {
      passportNumber: { not: null },
      passportIV: null,
    },
  });

  for (const guest of guests) {
    const { encrypted, iv } = encryptPassport(guest.passportNumber);
    await prisma.gmPassportSubmissionGuest.update({
      where: { id: guest.id },
      data: { passportNumber: encrypted, passportIV: iv },
    });
  }

  console.log(`✅ Encrypted ${guests.length} records`);
  await prisma.$disconnect();
}

migratePassports().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
```

Run with:
```bash
node scripts/encrypt-passports.mjs
```

---

## 9. Troubleshooting

### Error: "PASSPORT_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다"

**Solution**: Add `PASSPORT_ENCRYPTION_KEY` to `.env.local` or deployment environment.

### Error: "PASSPORT_ENCRYPTION_KEY는 32바이트여야 합니다"

**Solution**: Key must be exactly 32 bytes (64 hex characters or 44 base64 characters).

```bash
# Verify key length
echo "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2" | wc -c
# Should output: 65 (64 chars + newline)
```

### Decryption fails with "Unsupported state or unable to authenticate data"

This usually means:
1. Wrong IV was used
2. Data was corrupted
3. Wrong encryption key (key changed)

**Solution**: 
- Verify IV and passportNumber match from database
- Check that `PASSPORT_ENCRYPTION_KEY` hasn't changed
- If key changed, old data cannot be decrypted

### Performance issues during bulk operations

**Solution**: 
- Encryption/decryption is fast (~0.1-0.2ms per operation)
- If slow, check database performance (N+1 queries)
- Consider batch operations with transactions

---

## 10. Verification Checklist

Before deploying to production:

- [ ] `PASSPORT_ENCRYPTION_KEY` is set in production environment
- [ ] Key is 32 bytes (64 hex chars)
- [ ] Test encryption/decryption works: `npm test -- passport-encryption`
- [ ] All APIs updated to use `preparePassportForDb()` when saving
- [ ] UI uses `maskPassportFromDb()` for display
- [ ] Admin views use `decryptPassportFromDb()` when needed
- [ ] Existing unencrypted data migrated (if applicable)
- [ ] Audit logging configured for sensitive operations
- [ ] Database backups taken before migration
- [ ] Error handling for decryption failures implemented

---

## 11. Version History

- **v1.0** (2026-06-18) — Initial implementation
  - AES-256-CBC encryption with random IV
  - Database helpers for create/read/mask
  - API integration in 5 endpoints
  - Comprehensive test suite
  - Migration guide

---

For questions or issues, refer to:
- `src/lib/passport-encryption.ts` — Core implementation
- `src/lib/passport-db-helpers.ts` — Database usage patterns
- `src/lib/passport-encryption.test.ts` — Test examples
- `src/app/api/passport/encryption-example-route.ts` — API patterns
