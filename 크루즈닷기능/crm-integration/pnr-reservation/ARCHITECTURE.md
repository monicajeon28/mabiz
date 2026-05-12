# PNR Reservation System - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        🎯 USER INTERFACES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Customer Portal              Partner Portal         Admin Panel    │
│  ┌──────────────────┐        ┌───────────────┐     ┌────────────┐ │
│  │ PNR Page         │        │ Create        │     │ Final      │ │
│  │ - 여행자명 입력  │        │ Reservation   │     │ Confirm    │ │
│  │ - 주민등록번호   │        │ - Trip 선택   │     │ - Approve  │ │
│  │ - 객실번호       │        │ - 대표자정보  │     │ - Reject   │ │
│  │ - 동행자추가     │        │ - 여행자입력  │     │            │ │
│  └──────────┬───────┘        └───────┬───────┘     └────┬───────┘ │
│             │                        │                  │         │
│  Passport Page                Reservation List      Admin PNR    │
│  ┌──────────────────┐        ┌───────────────┐     Request      │
│  │ - 여권 업로드    │        │ - 필터링      │     ┌────────────┐ │
│  │ - 이미지 미리보기│        │ - 정렬        │     │ - 음성수집 │ │
│  │ - 상태 추적      │        │ - 페이지      │     │ - 저장     │ │
│  │ - 만료일 경고    │        │              │     │            │ │
│  └──────────┬───────┘        └───────┬───────┘     └────┬───────┘ │
│             │                        │                  │         │
└─────────────┼────────────────────────┼──────────────────┼─────────┘
              │                        │                  │
              ▼                        ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   🌐 API GATEWAY LAYER (Next.js)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐    ┌──────────────────────┐               │
│  │  Customer APIs      │    │  Partner APIs        │               │
│  ├─────────────────────┤    ├──────────────────────┤               │
│  │ POST /pnr/submit    │    │ POST /reservation/   │               │
│  │                     │    │ create               │               │
│  │ GET /reservation/   │    │                      │               │
│  │ [id]                │    │ GET /reservations    │               │
│  │                     │    │ (list, filter)       │               │
│  │                     │    │                      │               │
│  │ Validation:         │    │ PATCH /reservations/ │               │
│  │ - Zod schemas       │    │ [id]                 │               │
│  │ - Input sanitize    │    │                      │               │
│  │ - CSRF check        │    │ POST /sync-apis      │               │
│  │ - Auth check        │    │ POST /verify-status  │               │
│  └─────────────────────┘    │                      │               │
│                             │ GET /by-payment/[id] │               │
│  ┌─────────────────────┐    └──────────────────────┘               │
│  │  Public APIs        │                                           │
│  ├─────────────────────┤    ┌──────────────────────┐               │
│  │ GET /reservations/  │    │  Admin APIs          │               │
│  │ [id]                │    ├──────────────────────┤               │
│  │ (no auth)           │    │ POST /pnr-request/   │               │
│  │                     │    │ send                 │               │
│  │ GET /passport-      │    │ (final confirm)      │               │
│  │ status/[id]         │    │                      │               │
│  │ (guest access)      │    │ POST /affiliate/     │               │
│  │                     │    │ sales-confirmation   │               │
│  └─────────────────────┘    └──────────────────────┘               │
│                                                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│               ⚙️ BUSINESS LOGIC LAYER (Services)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Validation Service          Transaction Service                   │
│  ┌──────────────────────┐    ┌──────────────────────┐             │
│  │ Zod parsing          │    │ Prisma $transaction  │             │
│  │ Business rules       │    │ Atomic operations    │             │
│  │ Status validation    │    │ Rollback on error    │             │
│  │ Traveler checks      │    │ Data consistency     │             │
│  └──────────────────────┘    └──────────────────────┘             │
│                                                                     │
│  Audit Service                 Integration Service                 │
│  ┌──────────────────────┐    ┌──────────────────────┐             │
│  │ Log all changes      │    │ Google Sheets sync   │             │
│  │ Track field diffs    │    │ Notifications        │             │
│  │ User attribution     │    │ Payment gateway      │             │
│  │ Timestamp recording  │    │ Customer journey     │             │
│  └──────────────────────┘    └──────────────────────┘             │
│                                                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│             💾 DATA ACCESS LAYER (Prisma ORM)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Query Builder & Transaction Handler                        │  │
│  │  - Connection pooling                                       │  │
│  │  - Query optimization                                       │  │
│  │  - Index usage                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│            🗄️ DATABASE LAYER (PostgreSQL on Neon)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Reservation Table                                         │   │
│  │  ┌──────────────────────────────────┐                     │   │
│  │  │ id | tripId | mainUserId | ...   │                     │   │
│  │  │ pnrStatus | passportStatus       │   Indexes:          │   │
│  │  │ finalConfirmStatus | status      │   - tripId          │   │
│  │  │ createdAt | updatedAt            │   - mainUserId      │   │
│  │  │ Travelers: (1:N relation)        │   - pnrStatus       │   │
│  │  └──────────────────────────────────┘   - passportStatus  │   │
│  │                                                            │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │  Traveler Table                                            │   │
│  │  ┌──────────────────────────────────┐                     │   │
│  │  │ id | reservationId | roomNumber  │   Indexes:          │   │
│  │  │ korName | residentNum | phone    │   - reservationId   │   │
│  │  │ passportNo | expiryDate          │   - userId          │   │
│  │  │ userId | nationality             │   - residentNum     │   │
│  │  │ passportImage | passportDriveUrl │                     │   │
│  │  └──────────────────────────────────┘                     │   │
│  │                                                            │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │  ReservationAudit Table                                    │   │
│  │  ┌──────────────────────────────────┐                     │   │
│  │  │ id | reservationId | action      │   Indexes:          │   │
│  │  │ fieldChanged | oldValue | newVal │   - reservationId   │   │
│  │  │ userId | ipAddress               │   - action          │   │
│  │  │ createdAt                        │   - createdAt       │   │
│  │  └──────────────────────────────────┘                     │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
📱 Customer PNR Page ([reservationId])
├─ PNR Form Component
│  ├─ Traveler List (Dynamic)
│  │  ├─ Traveler Card
│  │  │  ├─ Name Input
│  │  │  ├─ ResidentNum Input
│  │  │  ├─ Phone Input
│  │  │  └─ RoomNumber Input
│  │  ├─ Add Traveler Button
│  │  └─ Delete Traveler Button
│  ├─ Form Validation (Zod)
│  ├─ Error Messages
│  └─ Submit Button
├─ Status Display
│  ├─ PNR Status Badge
│  ├─ Passport Status Badge
│  └─ Final Confirm Status Badge
└─ Loading Skeleton

📱 Passport Upload Page ([reservationId])
├─ File Upload Component
│  ├─ Drag & Drop Zone
│  ├─ File Input
│  ├─ Image Preview
│  ├─ Upload Progress
│  └─ Google Drive Integration
├─ Traveler Passport List
│  ├─ Traveler Card
│  │  ├─ Photo
│  │  ├─ Status Badge
│  │  ├─ Expiration Date
│  │  └─ Download Link
│  └─ Bulk Upload Button
└─ Status Timeline

📊 Partner Reservation List
├─ Filter Bar
│  ├─ Trip Selector
│  ├─ Status Filter
│  ├─ PNR Status Filter
│  └─ Date Range Picker
├─ Reservation Table
│  ├─ Pagination Controls
│  ├─ Reservation Row
│  │  ├─ ID Link
│  │  ├─ Trip Name
│  │  ├─ Main User
│  │  ├─ PNR Status
│  │  ├─ Passport Status
│  │  ├─ Final Confirm Status
│  │  ├─ Created Date
│  │  └─ Action Buttons (View/Edit/Delete)
│  └─ Bulk Actions
└─ Export Button

📋 Reservation Creation Form ([partnerId]/reservation/new)
├─ Trip Selection
│  ├─ Dropdown
│  └─ Trip Details Display
├─ Main User Form
│  ├─ Name Input
│  ├─ Phone Input
│  ├─ Email Input
│  └─ Lookup Existing User Button
├─ Dynamic Traveler Form (ReservationForm Component)
│  └─ (See ReservationForm description)
├─ Cabin Type Selector
├─ Form Validation
└─ Submit & Preview

🎛️ Final Confirm Section (Admin)
├─ Status Display
├─ Request Button (if PENDING)
├─ Audio Upload (if REQUESTED)
├─ Approve Button (if REQUESTED)
├─ Reject Form (if REQUESTED)
│  ├─ Reason Text Area
│  └─ Submit Button
├─ Confirmation Display (if CONFIRMED)
└─ Timeline View
   ├─ Request Entry
   ├─ Approval Entry
   └─ Confirmation Entry
```

## Data Flow - Complete Reservation Journey

```
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 1: CREATION (Day 1, Morning)                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Partner Portal → Create Reservation Form                            │
│       ↓                                                              │
│ POST /api/partner/reservation/create                                │
│       ↓                                                              │
│ Validation:                                                         │
│   ✓ tripId exists (Trip table)                                     │
│   ✓ mainUser phone/name provided                                   │
│   ✓ travelers array not empty                                      │
│       ↓                                                              │
│ Create/Link User (mainUser)                                        │
│       ↓                                                              │
│ Create Reservation                                                  │
│   status = "CONFIRMED"                                              │
│   pnrStatus = "PENDING"                                             │
│   passportStatus = "PENDING"                                        │
│   finalConfirmStatus = "PENDING"                                    │
│       ↓                                                              │
│ Create Travelers (1:N)                                             │
│       ↓                                                              │
│ Record ReservationAudit ("CREATED")                                │
│       ↓                                                              │
│ Response: Reservation + Travelers                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 2: PNR SUBMISSION (Day 1, Evening)                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Customer Portal → PNR Page                                          │
│       ↓                                                              │
│ Display: Existing Travelers (read from DB)                          │
│       ↓                                                              │
│ Customer input: Korean Name, ResidentNum, Phone, RoomNumber        │
│       ↓                                                              │
│ POST /api/customer/pnr/submit                                       │
│       ↓                                                              │
│ Validation (Zod):                                                   │
│   ✓ korName (1-100 chars)                                           │
│   ✓ residentNum (YYMMDD-XXXXXXX format)                            │
│   ✓ phone (11 chars)                                               │
│   ✓ roomNumber (positive int)                                       │
│       ↓                                                              │
│ Database Transaction:                                               │
│   1. Update/Create Travelers (korName, residentNum, phone, room)   │
│   2. Delete removed Travelers                                       │
│   3. Update Reservation.pnrStatus = "COMPLETED"                    │
│   4. Update Reservation.totalPeople                                │
│       ↓                                                              │
│ Record ReservationAudit ("PNR_UPDATED")                            │
│       ↓                                                              │
│ Response: Updated Reservation + Travelers (sorted by roomNumber)   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PASSPORT UPLOAD (Days 2-3)                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Customer Portal → Passport Upload Page                              │
│       ↓                                                              │
│ Display: Traveler List with Status                                  │
│       ↓                                                              │
│ Customer upload: Passport image per Traveler                       │
│       ↓                                                              │
│ File validation:                                                    │
│   ✓ Format: JPEG/PNG/PDF                                           │
│   ✓ Size: < 10MB                                                   │
│   ✓ Dimensions: > 100x100px                                         │
│       ↓                                                              │
│ Upload to Google Drive                                              │
│       ↓                                                              │
│ PATCH /api/partner/reservations/[id]                               │
│ {                                                                   │
│   "travelers": [                                                    │
│     { "id": 1, "passportNo": "A12345678", "expiryDate": "2030..." } │
│   ]                                                                 │
│ }                                                                   │
│       ↓                                                              │
│ Update Traveler:                                                    │
│   - passportNo                                                      │
│   - expiryDate                                                      │
│   - passportImage (url)                                             │
│   - passportDriveUrl (Google Drive url)                            │
│       ↓                                                              │
│ Update Reservation.passportStatus = "SUBMITTED"                    │
│       ↓                                                              │
│ Record ReservationAudit ("PASSPORT_SUBMITTED")                     │
│       ↓                                                              │
│ [Optional] GET /api/reservations/[id]/passport-status              │
│   └─ Display status to guest                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 4: FINAL CONFIRMATION (Day 5-6)                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Admin Panel → Request Final Confirmation                            │
│       ↓                                                              │
│ POST /api/admin/pnr-request/send                                    │
│ {                                                                   │
│   "reservationId": 123,                                             │
│   "requestedById": 999,                                             │
│   "remarks": "최종 확인 필요"                                         │
│ }                                                                   │
│       ↓                                                              │
│ Update Reservation:                                                 │
│   finalConfirmStatus = "REQUESTED"                                  │
│   finalConfirmRequestedAt = now()                                   │
│   finalConfirmRequestedById = 999                                   │
│       ↓                                                              │
│ Record ReservationAudit ("FINAL_CONFIRM_REQUESTED")               │
│       ↓                                                              │
│ Send Notification (SMS/Email/KakaoTalk)                            │
│                                                                      │
│ [Admin collects voice confirmation]                                 │
│       ↓                                                              │
│ PATCH /api/admin/pnr-request/approve                               │
│ {                                                                   │
│   "reservationId": 123,                                             │
│   "approvedById": 999,                                              │
│   "audioUrl": "https://drive.google.com/.../voice_confirm.m4a"    │
│ }                                                                   │
│       ↓                                                              │
│ Update Reservation:                                                 │
│   finalConfirmStatus = "APPROVED"                                   │
│   finalConfirmApprovedAt = now()                                    │
│   finalConfirmApprovedById = 999                                    │
│   finalConfirmAudioUrl = (url)                                      │
│   finalConfirmAudioDriveUrl = (Google Drive url)                   │
│       ↓                                                              │
│ Record ReservationAudit ("FINAL_CONFIRM_APPROVED")                 │
│       ↓                                                              │
│ [Final confirmation complete]                                       │
│       ↓                                                              │
│ Update Reservation.finalConfirmStatus = "CONFIRMED"                │
│ Update Reservation.status = "CONFIRMED"                            │
│       ↓                                                              │
│ Send Notification to Customer (예약 확정됨)                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
Request
  ↓
Zod Validation
  ├─ ❌ FAIL → 400 Bad Request
  │           (invalid input format)
  │
  ✓ PASS
  ├─ Database Query
  │  ├─ ❌ Record not found → 404 Not Found
  │  ├─ ❌ Duplicate key → 409 Conflict
  │  │
  │  ✓ PASS
  │  └─ Business Logic
  │     ├─ ❌ Invalid state transition → 422 Unprocessable Entity
  │     ├─ ❌ Ownership check failed → 403 Forbidden
  │     │
  │     ✓ PASS
  │     └─ Transaction
  │        ├─ ❌ Deadlock detected → 500 Internal Server Error (retry)
  │        ├─ ❌ Constraint violation → 400 Bad Request
  │        │
  │        ✓ PASS
  │        └─ Success Response (200/201)
  │
  ❌ CATCH Block
     └─ 500 Internal Server Error
        (masked error message)
        + ReservationAudit log (full error details)
        + Alert admin
```

---

## Technology Stack

```
Frontend:
  - React (hooks, context, suspense)
  - Next.js (App Router, Server Components)
  - TypeScript (strict mode)
  - Tailwind CSS
  - React Hook Form
  - Zod (validation)

Backend:
  - Node.js runtime (Vercel)
  - Next.js API Routes
  - Prisma ORM
  - bcryptjs (password hashing)
  - Zod (runtime validation)

Database:
  - PostgreSQL 15+ (Neon)
  - Connection pooling
  - 20+ indexes
  - Transactions support

External Services:
  - Google Drive API (file storage)
  - Google Sheets API (APIS sync)
  - SendGrid/Twilio (notifications)
  - Stripe/PayPal (payments)
```

---

**Generated:** 2026-05-11
**Status:** ✅ Production Ready
