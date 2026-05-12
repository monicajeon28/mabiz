# PNR & Reservation System - Dependency Graph

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Customer (Front-end)                           │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │  PNR Page       │  │  Passport Page   │  │  Reservation Page  │   │
│  │  [reservation   │  │  [reservation    │  │  (Partner View)    │   │
│  │   Id]           │  │   Id]            │  │                    │   │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬───────────┘   │
│           │                    │                     │               │
└───────────┼────────────────────┼─────────────────────┼───────────────┘
            │                    │                     │
            ▼                    ▼                     ▼
   ┌────────────────────────────────────────────────────────────┐
   │           API Layer (Next.js App Router)                  │
   │                                                            │
   │  ┌─────────────────────────┐ ┌──────────────────────────┐ │
   │  │  /api/customer/pnr/     │ │ /api/customer/           │ │
   │  │  - submit/route.ts      │ │ reservation/             │ │
   │  │                         │ │ [reservationId]/route.ts │ │
   │  └─────────────────────────┘ └──────────────────────────┘ │
   │                                                            │
   │  ┌─────────────────────────┐ ┌──────────────────────────┐ │
   │  │  /api/partner/          │ │ /api/partner/            │ │
   │  │  reservation/           │ │ reservations/route.ts    │ │
   │  │  create/route.ts        │ │ (list, filter)           │ │
   │  └─────────────────────────┘ └──────────────────────────┘ │
   │                                                            │
   │  ┌─────────────────────────┐ ┌──────────────────────────┐ │
   │  │  /api/admin/pnr-        │ │ /api/reservations/       │ │
   │  │  request/send/route.ts  │ │ [id]/route.ts (public)   │ │
   │  └─────────────────────────┘ └──────────────────────────┘ │
   │                                                            │
   └────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │         Data Layer (Prisma + PostgreSQL)                │
   │                                                          │
   │  ┌─────────────────────────────────────────────────┐   │
   │  │  Reservation Model                              │   │
   │  │  - id, tripId, mainUserId, totalPeople          │   │
   │  │  - pnrStatus, passportStatus, finalConfirmStatus│  │
   │  │  - paymentInfo, agentInfo                       │   │
   │  └─────────────┬───────────────────────────────────┘   │
   │               │                                         │
   │  ┌────────────▼───────────────────────────────────┐    │
   │  │  Traveler Model (1:N with Reservation)         │    │
   │  │  - korName, residentNum, passportNo             │    │
   │  │  - roomNumber, nationality, gender              │    │
   │  └─────────────────────────────────────────────────┘    │
   │                                                          │
   │  ┌─────────────────────────────────────────────────┐    │
   │  │  ReservationAudit Model (audit trail)           │    │
   │  │  - action, fieldChanged, oldValue, newValue      │    │
   │  └─────────────────────────────────────────────────┘    │
   │                                                          │
   │  ┌─────────────────────────────────────────────────┐    │
   │  │  TravelContract Model                           │    │
   │  │  - status, signedAt, contractUrl                │    │
   │  └─────────────────────────────────────────────────┘    │
   │                                                          │
   └──────────────────────────────────────────────────────────┘
```

## API Dependency Matrix

```
┌──────────────────────┬───────────────┬──────────────────┬────────────────┐
│ API Endpoint         │ DB Models     │ Zod Schema       │ UI Component   │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ POST /pnr/submit     │ Traveler      │ -                │ -              │
│ (basic PNR update)   │               │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ POST /customer/pnr   │ Reservation   │ PnrSubmit        │ PNR Page       │
│ /submit              │ Traveler      │ Schema           │ [reservationId]│
│ (customer PNR form)  │ ReservationAdt│                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ GET /customer/       │ Reservation   │ -                │ -              │
│ reservation/[id]     │ Traveler      │                  │                │
│ (get reservation)    │               │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ POST /partner/       │ Reservation   │ Reservation      │ Reservation    │
│ reservation/create   │ Traveler      │ Create Schema    │ Form           │
│ (create reservation) │ User          │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ GET /partner/        │ Reservation   │ -                │ -              │
│ reservations         │ Traveler      │                  │                │
│ (list reservations)  │              │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ GET /partner/        │ Reservation   │ -                │ -              │
│ reservations/[id]    │ Traveler      │                  │                │
│ (get reservation)    │              │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ POST /partner/       │ Reservation   │ Reservation      │ Final Confirm  │
│ reservations/[id]    │ ReservationAdt│ Update Schema    │ Section        │
│ (update reservation) │               │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ GET /reservations/   │ Reservation   │ -                │ -              │
│ [id] (public)        │ Traveler      │                  │                │
│ (guest access)       │              │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ GET /reservations/   │ Reservation   │ Passport         │ Passport       │
│ [id]/passport-status │ Traveler      │ Status Schema    │ Status Page    │
│ (passport tracking)  │              │                  │                │
├──────────────────────┼───────────────┼──────────────────┼────────────────┤
│ POST /admin/pnr-     │ Reservation   │ Final Confirm    │ Admin Panel    │
│ request/send         │ ReservationAdt│ Request Schema   │                │
│ (send PNR request)   │               │                  │                │
└──────────────────────┴───────────────┴──────────────────┴────────────────┘
```

## Data Flow

### 1. Reservation Creation Flow
```
Partner UI
    ↓
POST /api/partner/reservation/create
    ↓ (Zod validation)
Create User (if needed)
    ↓
Create Reservation
    ↓
Create Travelers (1:N)
    ↓
Record ReservationAudit
    ↓
Return Reservation + Travelers
```

### 2. PNR Submission Flow
```
Customer UI (PNR Page)
    ↓
POST /api/customer/pnr/submit
    ↓ (Zod validation)
Fetch Reservation
    ↓
Update/Create Travelers
    ↓
Update Reservation.pnrStatus = "COMPLETED"
    ↓
Record ReservationAudit
    ↓
Return updated Reservation
```

### 3. Passport Upload Flow
```
Customer UI (Passport Page)
    ↓
Upload passport image to Google Drive
    ↓
Update Traveler.passportImage, passportDriveUrl
    ↓
Update Reservation.passportStatus = "SUBMITTED"
    ↓
GET /api/reservations/[id]/passport-status
    ↓
Display passport status for all travelers
```

### 4. Final Confirmation Flow
```
Partner/Admin UI
    ↓
POST /api/admin/pnr-request/send
    ↓ (Final Confirm Request)
Update Reservation.finalConfirmStatus = "REQUESTED"
    ↓
Record ReservationAudit
    ↓
Admin approves
    ↓
Update Reservation.finalConfirmStatus = "APPROVED"
    ↓
Record audio URL
    ↓
Mark as "CONFIRMED"
```

## File Size & Complexity Analysis

```
Total Files: 17
Total Lines of Code: ~7,000

By Type:
  API Routes:      11 files, ~2,400 LOC (34%)
  Pages:           4 files, ~2,300 LOC (33%)
  Components:      2 files, ~3,700 LOC (53%)
  Schemas:         2 files, ~200 LOC (3%)
  Types:           1 file, ~70 LOC (1%)
  Config:          2 files (README, STATE_MACHINE)

By Folder:
  api/             13 files, ~2,400 LOC
  pages/           4 files, ~2,300 LOC
  components/      2 files, ~3,700 LOC
  lib/             3 files, ~270 LOC
  schema/          2 files, ~STATE_MACHINE diagrams
```

## External Dependencies

### From Main App
- `@/lib/prisma` - Prisma client
- `@/lib/google-sheets` - Google Sheets sync
- `@/lib/customer-journey` - Customer journey tracking
- `@/lib/auth` - Authentication helpers
- `bcryptjs` - Password hashing
- `zod` - Schema validation
- `next/server` - Next.js server utilities

### Database Relations
- `Trip` (parent) ← many Reservation
- `User` (parent) ← many Reservation
- `Reservation` (parent) ← many Traveler
- `User` (parent) ← many Traveler (userId link)
- `AffiliateSale` (parent) ← many Reservation (optional)

## Validation Pipeline

```
Request
    ↓
NextRequest parsing (JSON)
    ↓
Zod schema validation
    ↓
Database constraints (Prisma)
    ↓
Business logic validation
    ├─ Ownership verification
    ├─ Status transition validation
    └─ Data consistency checks
    ↓
Response/Error
```
