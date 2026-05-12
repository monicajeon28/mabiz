# Database Models Documentation

Complete documentation for all core database models in the Cruise Guide App.

## Table of Contents

1. [User & Authentication](#user--authentication)
2. [Products](#products)
3. [Passport Management](#passport-management)
4. [Reservations](#reservations)
5. [Product Inquiries](#product-inquiries)
6. [ChatBot System](#chatbot-system)
7. [Payments](#payments)
8. [Trial Program](#trial-program)
9. [Product Images](#product-images)
10. [Affiliate System](#affiliate-system)
11. [Automation & Logging](#automation--logging)

---

## User & Authentication

### User
Core user model for authentication and customer management.

**Fields:**
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | Int | Primary key | Auto-increment |
| name | String? | Customer full name | Optional |
| email | String? | Email address | Unique, Optional |
| phone | String? | Phone number | Optional |
| role | String | User role (user, admin, affiliate) | Default: 'user' |
| customerStatus | String? | Current status (active, dormant, etc) | Optional |
| password | String | Hashed password | Required |
| isLocked | Boolean | Account lock status | Default: false |
| loginCount | Int | Total login count | Default: 0 |
| createdAt | DateTime | Account creation timestamp | Auto-set |
| updatedAt | DateTime | Last update timestamp | Auto-updated |

**Indexes:**
- `email` (unique lookup)
- `createdAt` (temporal queries)
- `role, isLocked` (admin filtering)

**Relations:**
- One-to-Many: Reservation, ReservationAudit, ProductInquiry
- One-to-Many: Payment, AutomationLog
- One-to-One: Trial (optional), AffiliateProfile (optional)

---

## Products

### CruiseProduct
Main cruise product catalog.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Product name |
| description | String? | Detailed description |
| shipName | String? | Ship/vessel name |
| totalPassengers | Int? | Ship capacity |
| departureDate | DateTime? | Sailing date |
| returnDate | DateTime? | Return date |
| price | Int? | Base price in KRW |
| isActive | Boolean | Active status |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `isActive, departureDate` (active product listing)
- `shipName` (ship filtering)
- `createdAt` (temporal)

**Relations:**
- One-to-Many: Reservation, ProductInquiry, ProductImage

---

## Passport Management

### PassportUploadToken
Secure token for passport upload verification.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| token | String | Unique 64-char token |
| leadId | Int | Affiliate lead reference |
| expiresAt | DateTime | Token expiration |
| createdAt | DateTime | Creation timestamp |

**Indexes:**
- `token, expiresAt` (token lookup + expiry checks)
- `leadId` (lead reference)

**Lifetime:** 24-48 hours
**Security:** Constant-time comparison required

### PassportRequestLog
Log of passport request messages sent to customers.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | Int? | Target user |
| adminId | Int? | Admin who sent |
| messageBody | String | Message content |
| messageChannel | String | SMS/Email/KakaoTalk |
| status | String | PENDING/SENT/FAILED |
| sentAt | DateTime? | Send timestamp |
| createdAt | DateTime | Log creation |

**Indexes:**
- `userId, createdAt` (user message history)
- `status, createdAt` (delivery tracking)

### PassportSubmission
Main passport submission record from customer.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | Int | Submitting user |
| tripId | Int? | Related trip |
| token | String | Unique submission token |
| status | String | PENDING/SUBMITTED/APPROVED |
| submittedAt | DateTime? | Submission timestamp |
| expiresAt | DateTime | Form expiration |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `userId, status` (user submissions)
- `token` (unique lookup)
- `expiresAt` (expiry tracking)

**Relations:**
- One-to-Many: PassportSubmissionGuest (cascade delete)

### PassportSubmissionGuest
Individual guest details within a submission (group members).

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| submissionId | Int | Parent submission |
| groupNumber | Int | Group/cabin number |
| name | String | Guest full name |
| phone | String? | Contact number |
| email | String? | Email address |
| createdAt | DateTime | Creation timestamp |

**Indexes:**
- `submissionId` (submission lookup)
- Unique constraint: `submissionId, groupNumber`

---

## Reservations

### Reservation
Main booking record for cruise reservations.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| tripId | Int | Trip reference |
| mainUserId | Int | Primary booker |
| productId | Int? | Cruise product |
| totalPeople | Int | Party size |
| status | String | PENDING/CONFIRMED/CANCELLED |
| bookingNumber | String? | Confirmation number |
| totalPrice | Int? | Total amount in KRW |
| createdAt | DateTime | Booking timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `mainUserId, createdAt` (user bookings)
- `status, createdAt` (status tracking)
- `productId` (product reference)

**Relations:**
- Many-to-One: User, CruiseProduct
- One-to-Many: Traveler, ReservationAudit (cascade)
- One-to-One: TravelContract (optional)

### ReservationAudit
Audit trail for reservation changes.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| reservationId | Int | Related reservation |
| changedBy | Int | User who made change |
| changedAt | DateTime | Change timestamp |
| fieldName | String | Field modified |
| oldValue | String? | Previous value |
| newValue | String? | New value |

**Indexes:**
- `reservationId, changedAt` (change history)

**Relations:**
- Many-to-One: Reservation (cascade delete)

### Traveler
Individual traveler details in a reservation.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| reservationId | Int | Parent reservation |
| name | String | Traveler full name |
| phone | String? | Contact number |
| email | String? | Email address |
| engSurname | String? | English surname |
| engGivenName | String? | English given name |
| birthDate | String? | Date of birth (YYYY-MM-DD) |
| roomNumber | Int? | Cabin/room assignment |
| isSingleCharge | Boolean | Single occupancy |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `reservationId` (reservation lookup)

**Relations:**
- Many-to-One: Reservation (cascade delete)

### TravelContract
Contract/terms acceptance for travel.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| reservationId | Int | Related reservation |
| status | String | PENDING/SIGNED/EXPIRED |
| signedAt | DateTime? | Signature timestamp |
| expiresAt | DateTime? | Expiration date |
| content | String? | Contract terms |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `status, createdAt` (contract status)

**Relations:**
- One-to-One: Reservation (cascade delete)

---

## Product Inquiries

### ProductInquiry
Customer inquiry about products/services.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | Int? | Inquiring user |
| productId | Int? | Related product |
| name | String | Inquirer name |
| phone | String | Contact number |
| email | String? | Email address |
| message | String? | Inquiry details |
| status | String | PENDING/ANSWERED/CLOSED |
| priority | String? | normal/high/urgent |
| createdAt | DateTime | Inquiry timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `userId, createdAt` (user inquiries)
- `status, priority` (triage)

**Relations:**
- Many-to-One: User (optional, set null on delete)
- Many-to-One: CruiseProduct (optional, set null on delete)
- One-to-Many: InquiryCallLog (cascade delete)

### InquiryCallLog
Call attempts and results for inquiries.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| inquiryId | Int | Related inquiry |
| result | String | CONNECTED/VOICEMAIL/BUSY/etc |
| memo | String? | Call notes |
| duration | Int? | Call duration (seconds) |
| calledAt | DateTime | Call timestamp |
| createdAt | DateTime | Log creation |

**Indexes:**
- `inquiryId, calledAt` (call history)

**Relations:**
- Many-to-One: ProductInquiry (cascade delete)

---

## ChatBot System

### ChatBotFlow
Conversation flow configuration for chatbot.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Flow name (unique) |
| description | String? | Flow purpose |
| isActive | Boolean | Active status |
| flowJson | Json? | Flow configuration |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `isActive` (active flows)

**Relations:**
- One-to-Many: ChatBotQuestion (cascade delete)

### ChatBotQuestion
Individual questions in a flow.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| flowId | Int | Parent flow |
| sequenceNumber | Int | Question order |
| question | String | Question text |
| type | String | text/choice/number |
| isRequired | Boolean | Mandatory |
| metadata | Json? | Additional config |
| createdAt | DateTime | Creation timestamp |

**Indexes:**
- `flowId, sequenceNumber` (sequence lookup)

**Relations:**
- Many-to-One: ChatBotFlow (cascade delete)
- One-to-Many: ChatBotResponse (cascade delete)

### ChatBotResponse
Possible responses for questions.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| questionId | Int | Parent question |
| response | String | Response/option text |
| nextSequence | Int? | Next question number |
| isActive | Boolean | Available status |
| createdAt | DateTime | Creation timestamp |

**Indexes:**
- `questionId` (response lookup)

**Relations:**
- Many-to-One: ChatBotQuestion (cascade delete)

### ChatBotSession
Active chat session for a user.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | Int | Session user |
| flowId | Int? | Flow being used |
| status | String | ACTIVE/COMPLETED/ABANDONED |
| currentQuestion | Int? | Current Q number |
| responses | Json? | Collected responses |
| startedAt | DateTime | Session start |
| endedAt | DateTime? | Session end |

**Indexes:**
- `userId, status` (active sessions)
- `startedAt` (session history)

**Relations:**
- Many-to-One: User (cascade delete)

---

## Payments

### Payment
Main payment record for transactions.

**Fields:**
| Field | Type | Description | Security |
|-------|------|-------------|----------|
| id | Int | Primary key | |
| orderId | String | Unique order ID | Indexed |
| userId | Int? | User | Optional |
| reservationId | Int? | Related booking | Optional |
| amount | Int | Amount in KRW | |
| currency | String | Currency code | Default: KRW |
| status | String | PENDING/COMPLETED/FAILED | Indexed |
| paymentMethod | String? | Card/Bank/etc | |
| buyerName | String? | Customer name | Encrypted |
| buyerEmail | String? | Customer email | Encrypted |
| buyerTel | String? | Customer phone | Encrypted |
| transactionId | String? | PG transaction | Unique |
| failureReason | String? | Error message | |
| paidAt | DateTime? | Payment timestamp | |
| createdAt | DateTime | Creation timestamp | |
| updatedAt | DateTime | Update timestamp | |

**Indexes:**
- `userId, status` (user payments)
- `orderId` (order lookup)
- `createdAt` (temporal)
- `status, paidAt` (reconciliation)

**Security Notes:**
- `buyerEmail`, `buyerTel` stored encrypted
- No raw credit card data (PCI-DSS)
- Failure reasons sanitized (no card digits)

**Relations:**
- Many-to-One: User (optional, set null on delete)
- One-to-Many: PaymentRefund (cascade delete)

### PayAppPayment
PayApp-specific payment tracking.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| orderId | String | Unique order ID |
| mulNo | String? | Multi-payment number |
| landingPageId | Int? | Landing page |
| productName | String? | Product name |
| amount | Int | Amount in KRW |
| status | String | Payment status |
| paymentMethod | String? | Method |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `orderId` (lookup)
- `status` (status tracking)

### PaymentRefund
Refund transactions.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| paymentId | Int | Original payment |
| amount | Int | Refund amount in KRW |
| reason | String? | Refund reason |
| status | String | PENDING/COMPLETED/FAILED |
| requestedAt | DateTime | Request timestamp |
| processedAt | DateTime? | Processing timestamp |

**Indexes:**
- `paymentId, status` (refund tracking)

**Relations:**
- Many-to-One: Payment (cascade delete)

---

## Trial Program

### Trial
User trial account status and lifecycle.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | Int | Trial user |
| code | String | Unique trial code |
| status | String | ACTIVE/EXPIRED/CANCELLED |
| startDate | DateTime | Trial start |
| endDate | DateTime | Trial end |
| notificationSent | Boolean | End warning sent |
| notificationSentAt | DateTime? | Warning timestamp |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `status, endDate` (expiry tracking)
- `userId` (user lookup)

**Relations:**
- One-to-One: User (cascade delete)
- One-to-Many: TrialAuditLog (cascade delete)

**Lifecycle:**
1. ACTIVE: Trial in progress
2. EXPIRED: End date passed
3. CANCELLED: User cancelled early

### TrialAuditLog
Audit log for trial lifecycle events.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| trialId | Int | Related trial |
| userId | Int | Acting user |
| action | String | create/update/cancel |
| details | Json? | Action details |
| createdAt | DateTime | Action timestamp |

**Indexes:**
- `trialId, createdAt` (action history)

**Relations:**
- Many-to-One: Trial (cascade delete)
- Many-to-One: User (cascade delete)

### TrialSignup
Signups for trial program (pre-conversion).

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| email | String | Email address (unique) |
| phone | String? | Phone number |
| name | String? | Full name |
| source | String? | Traffic source |
| status | String | PENDING/CONVERTED |
| convertedAt | DateTime? | Conversion timestamp |
| createdAt | DateTime | Signup timestamp |

**Indexes:**
- `status, createdAt` (funnel tracking)

---

## Product Images

### ProductImage
Product image storage and metadata.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| productId | Int | Related product |
| originalUrl | String? | Original image URL |
| webpUrl | String? | WebP optimized URL |
| thumbUrl | String? | Thumbnail URL |
| width | Int? | Image width (px) |
| height | Int? | Image height (px) |
| size | Int? | File size (bytes) |
| mimeType | String? | Content-Type |
| position | Int | Display order |
| isActive | Boolean | Active status |
| createdAt | DateTime | Upload timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `productId, position` (product listing)
- `isActive` (display status)

**Relations:**
- Many-to-One: CruiseProduct (cascade delete)
- One-to-Many: ImageAccessLog (cascade delete)

**Image Formats:**
- Original: JPEG, PNG, GIF, WebP
- Optimized: WebP (modern browsers)
- Thumbnail: 200x200 px

### ImageAccessLog
Access audit trail for images.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| imageId | Int | Accessed image |
| userId | Int? | Accessing user |
| ipAddress | String? | Client IP |
| userAgent | String? | Browser info |
| referer | String? | HTTP referer |
| createdAt | DateTime | Access timestamp |

**Indexes:**
- `imageId, createdAt` (image stats)
- `userId` (user activity)

**Relations:**
- Many-to-One: ProductImage (cascade delete)

---

## Affiliate System

### AffiliateSale
Individual sale transaction via affiliate.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| saleNumber | String | Unique sale ID |
| profileId | Int | Affiliate profile |
| reservationId | Int? | Resulting booking |
| amount | Int | Sale amount in KRW |
| commission | Int? | Calculated commission |
| status | String | PENDING/APPROVED/PAID |
| approvedAt | DateTime? | Approval timestamp |
| createdAt | DateTime | Sale timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `profileId, createdAt` (affiliate sales)
- `status, createdAt` (settlement)

**Relations:**
- Many-to-One: AffiliateProfile
- One-to-Many: AffiliateLedger (cascade delete)

### AffiliateProfile
Affiliate account and settings.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | Int | Account user |
| companyName | String | Business name |
| businessNumber | String? | Business registration |
| status | String | ACTIVE/INACTIVE/SUSPENDED |
| commissionRate | Decimal | Commission (%,3 decimals) |
| bankName | String? | Payment bank |
| bankAccount | String? | Account number |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `status` (status filtering)

**Relations:**
- One-to-One: User (cascade delete)
- One-to-Many: AffiliateSale, AffiliateLedger

**Commission Calculation:**
- Rate: 0-10% (3 decimal places)
- Applied: Per sale upon approval
- Settlement: Monthly

### AffiliateLedger
Financial ledger for affiliate transactions.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| saleId | Int | Related sale |
| profileId | Int | Affiliate profile |
| type | String | sale/refund/adjustment |
| amount | Int | Transaction amount |
| withholdingAmount | Int | Tax withholding |
| netAmount | Int | Final amount to pay |
| isSettled | Boolean | Payment status |
| settledAt | DateTime? | Payment date |
| description | String? | Notes |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Update timestamp |

**Indexes:**
- `isSettled` (settlement tracking)
- `profileId, createdAt` (ledger history)
- `settledAt` (payment history)

**Relations:**
- Many-to-One: AffiliateSale (cascade delete)
- Many-to-One: AffiliateProfile (cascade delete)

**Settlement Rules:**
1. Calculate: `netAmount = amount - withholdingAmount`
2. Group: By profile and month
3. Settle: Via bank transfer on 5th of month
4. Report: Monthly statement

---

## Automation & Logging

### AutomationLog
Log for automated system actions.

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | Int? | Related user |
| actionType | String | Type of action |
| status | String | PENDING/COMPLETED/FAILED |
| result | String? | Result message |
| errorMessage | String? | Error details |
| metadata | Json? | Action data |
| executedAt | DateTime? | Execution timestamp |
| createdAt | DateTime | Log timestamp |

**Indexes:**
- `userId, createdAt` (user automation)
- `actionType, status` (action tracking)

**Relations:**
- Many-to-One: User (optional, set null on delete)

**Common Actions:**
- `passport-reminder`: Send passport form
- `trial-expiry-warning`: Trial ending notice
- `payment-reminder`: Payment due notice
- `auto-cancel`: Cancel expired booking

---

## Performance Indexes

### Composite Indexes
- `User` (email) - login
- `Reservation` (mainUserId, createdAt) - user history
- `Payment` (userId, status) - user payments
- `AffiliateSale` (profileId, createdAt) - affiliate sales
- `ProductImage` (productId, position) - product gallery
- `PassportSubmission` (userId, status) - submission tracking

### Covering Indexes
- `(status, createdAt)` on Payment, Reservation, Trial
- `(isSettled, settledAt)` on AffiliateLedger
- `(isActive)` on ProductImage, ChatBotFlow

---

## Data Integrity Rules

### Foreign Keys
- All FKs cascade on delete for audit trails
- User references set to NULL on user deletion
- Product references set to NULL on product deletion

### Uniqueness Constraints
- `User.email` - must be unique
- `Payment.orderId` - must be unique
- `CruiseProduct` (name, departureDate) - unique sailing
- `Reservation.bookingNumber` - confirmation reference
- `PassportSubmission.token` - form submission token

### Validation Rules
- Payment amounts: > 0
- Dates: expiresAt > createdAt
- Affiliate commission: 0-10%
- Phone: 10-15 digits
- Email: valid format

---

## Security Notes

### Encryption
- Payment.buyerEmail - encrypted
- Payment.buyerTel - encrypted
- No credit card data stored (PCI-DSS compliance)

### Access Control
- Trial data: User sees only own record
- Payment data: User sees own, admin sees all
- Affiliate data: Affiliate sees own, admin sees all
- Passport: User sees own submission

### Audit Trails
- ReservationAudit: All reservation changes
- TrialAuditLog: Trial lifecycle
- ImageAccessLog: Image views
- AutomationLog: System actions

---

Last updated: 2026-05-11
Generated from: Prisma Schema v4.x
