# Backup 2026-05-25 Restoration Guide

Complete restoration process for 16 xlsx files from Google Drive to Neon PostgreSQL.

## Quick Start (3 Steps)

### Step 1: Download Files from Google Drive

```bash
mkdir -p backups/neon-restore-2026-05-25
node scripts/download-backup-from-gdrive.js
```

### Step 2: Set Database URL

```bash
export DATABASE_URL="postgresql://user:password@host/dbname"
```

### Step 3: Restore Data

```bash
DATABASE_URL="..." node scripts/execute-neon-restore.js
```

---

## File Inventory (16 Tables)

| File | DB Table | Status |
|------|----------|--------|
| User_2026-05-25_15-00-47.xlsx | GmUser | ⏳ |
| Trip_2026-05-25_15-00-49.xlsx | GmTrip | ⏳ |
| Reservation_2026-05-25_15-00-50.xlsx | GmReservation | ⏳ |
| Traveler_2026-05-25_15-00-52.xlsx | GmTraveler | ⏳ |
| AffiliateProfile_2026-05-25_15-00-53.xlsx | GmAffiliateProfile | ⏳ |
| AffiliateSale_2026-05-25_15-00-55.xlsx | AffiliateSale | ⏳ |
| AffiliateLead_2026-05-25_15-00-57.xlsx | GmAffiliateLead | ⏳ |
| AffiliateProduct_2026-05-25_15-00-58.xlsx | AffiliateProduct | ⏳ |
| AffiliateLedger_2026-05-25_15-01-00.xlsx | AffiliateLedger | ⏳ |
| AdminActionLog_2026-05-25_15-01-03.xlsx | AdminActionLog | ⏳ |
| CruiseProduct_2026-05-25_15-01-05.xlsx | CruiseProduct | ⏳ |
| ProductPricePeriod_2026-05-25_15-01-06.xlsx | ProductPricePeriod | ⏳ |
| ProductCabinPrice_2026-05-25_15-01-08.xlsx | ProductCabinPrice | ⏳ |
| ProductImage_2026-05-25_15-01-10.xlsx | ProductImage | ⏳ |
| PassportSubmission_2026-05-25_15-01-02.xlsx | GmPassportSubmission | ⏳ |

---

## Scripts Available

- `scripts/execute-neon-restore.js` - Main restoration script
- `scripts/download-backup-from-gdrive.js` - Download helper
- `scripts/restore-neon-2026-05-25.ts` - TypeScript version

**Version**: 1.0 | **Date**: 2026-05-26
