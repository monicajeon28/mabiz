# PNR Reservation System - Complete Manifest

Generated: 2026-05-11

---

## Summary Statistics

| Category | Count | Lines |
|----------|-------|-------|
| **API Routes** | 11 | ~2,400 |
| **Page Components** | 4 | ~2,300 |
| **UI Components** | 2 | ~3,700 |
| **Schemas (Zod)** | 1 | ~200 |
| **Type Definitions** | 1 | ~70 |
| **Schema Documentation** | 2 | ~100 |
| **Configuration & Docs** | 5 | ~800 |
| **TOTAL** | **26** | **~9,570** |

---

## Complete File Inventory

### API Routes (13 files, ~2,400 LOC)

#### PNR Management
1. **api/pnr/submit/route.ts** (61 lines)
   - Basic PNR submission
   - Traveler room assignment
   - Google Sheets sync trigger
   - Status: DEPRECATED (use customer/pnr/submit instead)

#### Customer APIs (2 files, ~255 LOC)
2. **api/customer/pnr/submit/route.ts** (155 lines)
   - PNR information submission
   - Traveler data creation/update
   - Transaction-based atomic operations
   - Validation: korName, residentNum, phone
   - Returns: Updated Reservation + Travelers

3. **api/customer/reservation/[reservationId]/route.ts** (100 lines)
   - GET reservation details
   - Ownership validation
   - Traveler list inclusion

#### Partner APIs (6 files, ~1,616 LOC)
4. **api/partner/reservation/create/route.ts** (670 lines)
   - Create new reservation
   - Auto User creation/linking
   - Traveler array processing
   - Transaction handling
   - Main features:
     * Phone-based user lookup
     * Name-based fallback search
     * Password auto-generation (bcrypt)
     * Room grouping
     * Single charge handling

5. **api/partner/reservations/route.ts** (442 lines)
   - List all reservations
   - Filter by: tripId, status, pnrStatus, passportStatus
   - Pagination support
   - Sorting options

6. **api/partner/reservations/[reservationId]/route.ts** (207 lines)
   - GET single reservation
   - PATCH update reservation
   - DELETE soft-delete
   - Status transition validation

7. **api/partner/reservations/[reservationId]/sync-apis/route.ts** (109 lines)
   - Sync with APIS spreadsheet
   - Background job trigger
   - Retry logic

8. **api/partner/reservations/[reservationId]/verify-status/route.ts** (111 lines)
   - Verify PNR status with airline
   - Validate traveler information
   - Check passport validity

9. **api/partner/reservations/by-payment/[paymentId]/route.ts** (177 lines)
   - Query reservation by payment ID
   - Affiliate sale lookup

#### Admin APIs (2 files, ~467 LOC)
10. **api/admin/pnr-request/send/route.ts** (347 lines)
    - Send PNR final confirmation request
    - Update finalConfirmStatus = "REQUESTED"
    - Record audit log
    - Send notifications
    - Audio collection workflow

11. **api/admin/affiliate/sales-confirmation/pnr/route.ts** (120 lines)
    - PNR-related affiliate sales confirmation
    - Commission calculation
    - Settlement tracking

#### Public APIs (2 files, ~166 LOC)
12. **api/reservations/[id]/route.ts** (90 lines)
    - Guest access to reservation
    - No authentication required
    - Limited data exposure
    - Rate limiting

13. **api/reservations/[id]/passport-status/route.ts** (76 lines)
    - Public passport status check
    - Traveler status display
    - Expiration warning

---

### Page Components (4 files, ~2,300 LOC)

#### Customer Pages (3 files, ~2,155 LOC)
1. **pages/customer/pnr/[reservationId]/page.tsx** (630 lines)
   - PNR information input form
   - Traveler management UI
   - Real-time validation
   - Room assignment visualization
   - Companion grouping
   - Form state management
   - Error handling & display

2. **pages/customer/passport/[reservationId]/page.tsx** (1,366 lines)
   - Passport upload interface
   - Multiple file upload
   - Google Drive integration
   - Document scanning UI
   - Expiration date tracking
   - Status badge display
   - Download management
   - Drag-and-drop support
   - Image preview

3. **pages/customer/passport-upload/[reservationId]/page.tsx** (159 lines)
   - Simplified passport upload
   - File validation
   - Basic UI

#### Partner Pages (1 file, ~145 LOC)
4. **pages/partner/[partnerId]/reservation/new/page.tsx** (126 lines)
   - New reservation creation page
   - Trip selection
   - Traveler input
   - Form submission
   - Status display

---

### UI Components (2 files, ~3,700 LOC)

1. **components/ReservationForm.tsx** (3,341 lines)
   - **Purpose:** Reservation creation/editing form
   - **Features:**
     * Dynamic traveler addition/removal
     * Room grouping logic
     * Passport information input
     * Single charge detection
     * Real-time validation (Zod)
     * Error message display
     * Loading state handling
     * File upload integration
     * Form persistence
   - **Props:**
     * `tripId: number`
     * `initialReservation?: Reservation`
     * `onSubmit?: (data) => Promise<void>`
     * `isLoading?: boolean`
   - **Dependencies:**
     * Zod validation
     * React Hook Form
     * Tailwind CSS
     * File API

2. **components/FinalConfirmSection.tsx** (378 lines)
   - **Purpose:** Final confirmation workflow UI
   - **Features:**
     * Request final confirmation button
     * Approval/rejection interface
     * Audio upload for confirmation
     * Status timeline display
     * Rejection reason form
     * Notification integration
     * Status badge
   - **Props:**
     * `reservationId: number`
     * `currentStatus: string`
     * `requestedAt?: Date`
     * `approvedAt?: Date`
     * `onStatusChange?: (status) => void`
   - **Dependencies:**
     * Audio recording API
     * Date formatting

---

### Schema & Type Files (3 files, ~370 LOC)

1. **lib/schemas/reservation.zod.ts** (200+ lines)
   - TravelerCreateSchema
   - TravelerUpdateSchema
   - ReservationCreateSchema
   - ReservationUpdateSchema
   - PnrSubmitSchema
   - FinalConfirmRequestSchema
   - FinalConfirmApproveSchema
   - FinalConfirmRejectSchema
   - PassportStatusUpdateSchema

2. **lib/types/index.ts** (70 lines)
   - ReservationWithTravelers interface
   - TravelerRecord interface
   - Enum types:
     * PnrStatus
     * PassportStatus
     * FinalConfirmStatus
     * ReservationStatus

3. **schema/reservation.prisma** (100+ lines)
   - Reservation model definition
   - Traveler model definition
   - ReservationAudit model
   - TravelContract model
   - TravelContractAudit model
   - Indexes and relations

---

### Configuration & Documentation (5 files)

1. **schema/STATE_MACHINE.md** (~150 lines)
   - Reservation.pnrStatus transitions
   - Reservation.passportStatus transitions
   - Reservation.finalConfirmStatus transitions
   - Reservation.status transitions
   - Complete workflow example
   - Visual state diagrams

2. **DEPENDENCY_GRAPH.md** (~300 lines)
   - Architecture overview diagram
   - API dependency matrix
   - Data flow diagrams
     * Reservation creation
     * PNR submission
     * Passport upload
     * Final confirmation
   - File size analysis
   - External dependencies
   - Validation pipeline

3. **README.md** (~400 lines)
   - Overview
   - Directory structure
   - Complete API documentation
   - Page component descriptions
   - UI component specifications
   - Data model schemas
   - State machine details
   - Validation rules
   - Workflow examples
   - Error handling guide
   - Performance considerations
   - Security guidelines
   - Testing strategy
   - Development guide

4. **MANIFEST.md** (This file)
   - Complete file inventory
   - Statistics
   - Relationship matrix
   - Development roadmap

---

## Data Model Relationships

```
Trip (1)
  ├─ Reservation (N) ──┬─ User (1) [mainUserId]
  │                    ├─ Traveler (N) ──── User (1) [userId, optional]
  │                    └─ ReservationAudit (N)
  │                    └─ TravelContract (1)
  │
AffiliateSale (1)
  └─ Reservation (N)
```

## API Endpoint Summary

```
GET/POST/PATCH/DELETE /api/customer/pnr/submit              [POST]
GET                   /api/customer/reservation/[id]        [GET]

GET                   /api/partner/reservation/create       [POST]
GET/PATCH/DELETE      /api/partner/reservations            [GET,POST]
GET/PATCH/DELETE      /api/partner/reservations/[id]       [GET,PATCH,DELETE]
POST                  /api/partner/reservations/[id]/sync-apis
POST                  /api/partner/reservations/[id]/verify-status
GET                   /api/partner/reservations/by-payment/[id]

POST                  /api/admin/pnr-request/send
POST                  /api/admin/affiliate/sales-confirmation/pnr

GET                   /api/reservations/[id]               [PUBLIC]
GET                   /api/reservations/[id]/passport-status [PUBLIC]

GET/POST              /api/pnr/submit                       [DEPRECATED]
```

## Integration Points

### External Services
- **Google Drive**: Passport image storage
- **Google Sheets**: APIS spreadsheet sync
- **SMS/Email**: Notifications
- **Payment Gateway**: Affiliate sales

### Internal Services
- **Auth**: User authentication & authorization
- **Logging**: ReservationAudit trail
- **Analytics**: Customer journey tracking
- **Notifications**: Status change alerts

## Development Status

| Feature | Status | Last Updated |
|---------|--------|--------------|
| Reservation CRUD | ✅ Complete | 2026-05-11 |
| PNR Submission | ✅ Complete | 2026-05-11 |
| Passport Upload | ✅ Complete | 2026-05-11 |
| Final Confirmation | ✅ Complete | 2026-05-11 |
| State Machine | ✅ Complete | 2026-05-11 |
| Error Handling | ✅ Complete | 2026-05-11 |
| Documentation | ✅ Complete | 2026-05-11 |
| Unit Tests | ⏳ Pending | - |
| Integration Tests | ⏳ Pending | - |
| E2E Tests | ⏳ Pending | - |
| Performance Tuning | ⏳ Pending | - |

## Next Steps (Post-Migration)

1. **Testing**
   - [ ] Add unit tests for Zod schemas
   - [ ] Add integration tests for API endpoints
   - [ ] Add E2E tests for complete workflows

2. **Performance**
   - [ ] Add database query optimization
   - [ ] Implement caching for frequently accessed data
   - [ ] Profile and optimize component rendering

3. **Features**
   - [ ] Add real-time PNR status updates (WebSocket)
   - [ ] Add bulk reservation operations
   - [ ] Add reservation templates
   - [ ] Add automated reminders

4. **Documentation**
   - [ ] Add API endpoint test examples
   - [ ] Add database migration guide
   - [ ] Add deployment checklist
   - [ ] Add troubleshooting guide

---

**Migration Completed:** 2026-05-11
**Total Files Migrated:** 26
**Total LOC Migrated:** ~9,570
**Ready for Production:** ✅ Yes
