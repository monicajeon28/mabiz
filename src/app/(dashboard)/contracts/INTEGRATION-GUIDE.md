# Contract Modification Components - Integration Guide

## Quick Start (5 minutes)

### Step 1: Import Components in Your Page

```typescript
// src/app/(dashboard)/contracts/[id]/page.tsx (or wherever you need them)

import { ModificationRequestForm } from './ModificationRequestForm';
import { ModificationRequestList } from './ModificationRequestList';
import { ModificationResponsePanel } from './ModificationResponsePanel';
import { useState, useEffect } from 'react';

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch modification requests on mount
  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/contracts/${params.id}/modifications`
        );
        const data = await res.json();
        if (data.ok) {
          setRequests(data.data || []);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [params.id]);

  // Handle form submission
  const handleSubmitRequest = async (formData: any) => {
    const res = await fetch(
      `/api/contracts/${params.id}/modifications`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create request');
    }

    // Refresh list
    const updated = await fetch(
      `/api/contracts/${params.id}/modifications`
    );
    const data = await updated.json();
    setRequests(data.data || []);
  };

  // Handle admin actions
  const handleApprove = async () => {
    if (!selectedRequest) return;

    const res = await fetch(
      `/api/contracts/modifications/${selectedRequest.id}/approve`,
      { method: 'POST' }
    );

    if (!res.ok) throw new Error('Approval failed');

    // Refresh and close
    const updated = await fetch(
      `/api/contracts/${params.id}/modifications`
    );
    const data = await updated.json();
    setRequests(data.data || []);
    setSelectedRequest(null);
  };

  const handleReject = async (message: string) => {
    if (!selectedRequest) return;

    const res = await fetch(
      `/api/contracts/modifications/${selectedRequest.id}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseMessage: message }),
      }
    );

    if (!res.ok) throw new Error('Rejection failed');

    // Refresh and close
    const updated = await fetch(
      `/api/contracts/${params.id}/modifications`
    );
    const data = await updated.json();
    setRequests(data.data || []);
    setSelectedRequest(null);
  };

  const handleProposeAlternative = async (
    value: string,
    reason: string
  ) => {
    if (!selectedRequest) return;

    const res = await fetch(
      `/api/contracts/modifications/${selectedRequest.id}/alternative`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedValue: value,
          reason: reason,
        }),
      }
    );

    if (!res.ok) throw new Error('Alternative proposal failed');

    // Refresh and close
    const updated = await fetch(
      `/api/contracts/${params.id}/modifications`
    );
    const data = await updated.json();
    setRequests(data.data || []);
    setSelectedRequest(null);
  };

  // Determine user role
  const isAdmin = true; // Replace with actual role check

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">계약서 상세</h1>

      {/* Customer/Agent: Form to request modifications */}
      <ModificationRequestForm
        contractId={params.id}
        onSubmit={handleSubmitRequest}
        onCancel={() => console.log('Form cancelled')}
      />

      {/* All users: List of requests */}
      <ModificationRequestList
        requests={requests}
        onSelectRequest={setSelectedRequest}
        isLoading={isLoading}
      />

      {/* Admin only: Response panel when request selected */}
      {isAdmin && selectedRequest && (
        <ModificationResponsePanel
          requestId={selectedRequest.id}
          fieldName={selectedRequest.fieldName}
          newValue={selectedRequest.newValue}
          reason={selectedRequest.reason}
          status={selectedRequest.status}
          responseMessage={selectedRequest.responseMessage}
          expiresAt={new Date(selectedRequest.expiresAt)}
          onApprove={handleApprove}
          onReject={handleReject}
          onProposeAlternative={handleProposeAlternative}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}
```

---

## Step 2: Create API Routes

### Create `/api/contracts/{contractId}/modifications/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectAllLenses } from '@/lib/contract-modification-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const requests = await prisma.contractModificationRequest.findMany({
      where: { contractId: params.contractId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      data: requests,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const body = await req.json();
    const { fieldName, newValue, reason } = body;

    // Validate modifiable field
    const MODIFIABLE_FIELDS = [
      'tripDate',
      'roomType',
      'roomCategory',
      'price',
      'passengerName',
      'passengerCount',
      'specialRequest',
      'dietaryRestriction',
      'pickupLocation',
      'returnDate',
    ];

    if (!MODIFIABLE_FIELDS.includes(fieldName)) {
      return NextResponse.json(
        { ok: false, error: `Field "${fieldName}" is not modifiable` },
        { status: 400 }
      );
    }

    // Create modification request with lens detection
    const fieldModifications = [{ fieldName, newValue, reason }];
    const lenses = detectAllLenses(fieldModifications);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const modRequest = await prisma.contractModificationRequest.create({
      data: {
        contractId: params.contractId,
        fieldModifications: fieldModifications,
        status: 'REQUESTED',
        expiresAt,
        lensApplied: ['L2', 'L6', 'L7', 'L10'],
        lensDetectionDetails: lenses,
        requestedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: modRequest.id,
        status: modRequest.status,
        expiresAt: modRequest.expiresAt.toISOString(),
        appliedLenses: modRequest.lensApplied,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create request' },
      { status: 500 }
    );
  }
}
```

### Create `/api/contracts/modifications/{requestId}/approve/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    // Update request status
    const updated = await prisma.contractModificationRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'APPROVED',
        respondedAt: new Date(),
        responseMessage: '함께 이 문제를 해결했습니다. 계약이 업데이트되었습니다.',
      },
    });

    // TODO: Send email notification
    // TODO: Update contract with new values

    return NextResponse.json({
      ok: true,
      data: {
        status: updated.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Failed to approve' },
      { status: 500 }
    );
  }
}
```

### Create `/api/contracts/modifications/{requestId}/reject/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const body = await req.json();
    const { responseMessage } = body;

    const updated = await prisma.contractModificationRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
        responseMessage,
      },
    });

    // TODO: Send rejection email

    return NextResponse.json({
      ok: true,
      data: { status: updated.status },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Failed to reject' },
      { status: 500 }
    );
  }
}
```

### Create `/api/contracts/modifications/{requestId}/alternative/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const body = await req.json();
    const { proposedValue, reason } = body;

    // Set alternative expiry to +3 days
    const alternativeExpiresAt = new Date();
    alternativeExpiresAt.setDate(alternativeExpiresAt.getDate() + 3);

    const updated = await prisma.contractModificationRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'ALTERNATIVE_PROPOSED',
        alternativeProposal: {
          proposedValue,
          reason,
        },
        alternativeExpiresAt,
        respondedAt: new Date(),
        responseMessage: `다음과 같이 제안드립니다: ${proposedValue}. ${reason}. 3일 내 검토 부탁드립니다.`,
      },
    });

    // TODO: Send alternative email

    return NextResponse.json({
      ok: true,
      data: {
        status: updated.status,
        alternativeExpiresAt: updated.alternativeExpiresAt?.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Failed to propose alternative' },
      { status: 500 }
    );
  }
}
```

---

## Step 3: Add Email Notifications

Use existing `src/lib/contract-email-sender.ts` to send psychology-optimized emails:

```typescript
// After approval
await sendContractApprovalEmail({
  customerEmail: customer.email,
  contractId: contractId,
  modificationField: fieldName,
  message: '함께 이 문제를 해결했습니다.',
});

// After rejection
await sendContractRejectionEmail({
  customerEmail: customer.email,
  contractId: contractId,
  reason: responseMessage,
});

// After alternative proposed
await sendAlternativeProposalEmail({
  customerEmail: customer.email,
  contractId: contractId,
  proposedValue: proposedValue,
  reason: reason,
  expiresAt: alternativeExpiresAt,
});
```

---

## Step 4: Add Cron Job for Expiry

Create `src/app/api/cron/modification-requests-expiry/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Find all REQUESTED requests older than 7 days
    const expired = await prisma.contractModificationRequest.updateMany({
      where: {
        status: 'REQUESTED',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Expired ${expired.count} requests`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Cron failed' },
      { status: 500 }
    );
  }
}
```

Then add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/modification-requests-expiry",
      "schedule": "0 0 * * *"
    }
  ]
}
```

---

## Testing the Integration

### Manual Test Flow

1. **Create Request:**
   - Open contract page
   - Fill ModificationRequestForm
   - Submit → Should create request in DB
   - List should refresh and show "검토 중" request

2. **Approve Request (Admin):**
   - Click request in list
   - ModificationResponsePanel opens
   - Click "✅ 승인"
   - Should change to "승인됨" status
   - Email sent to customer

3. **Reject Request (Admin):**
   - Click request in list
   - Click "❌ 거절"
   - Enter reason (>= 10 chars)
   - Click "거절 처리"
   - Should change to "거절됨" status

4. **Propose Alternative (Admin):**
   - Click request in list
   - Click "💡 대안 제시"
   - Enter alternative value + reason
   - Click "대안 제시"
   - Should change to "대안 제시" status
   - alternativeExpiresAt = +3 days

### Automated Test (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('Modification request workflow', async ({ page }) => {
  // Navigate to contract
  await page.goto('/contracts/contract-123');

  // Submit request
  await page.selectOption('select', 'tripDate');
  await page.fill('input[type="date"]', '2026-08-15');
  await page.fill('textarea', '가족 일정 변경');
  await page.click('button:has-text("수정 요청 제출")');

  // Wait for success
  await expect(page.locator('text=요청이 제출되었습니다')).toBeVisible();

  // Check list updated
  await expect(page.locator('text=검토 중')).toBeVisible();
  await expect(page.locator('text=📅 여행 날짜')).toBeVisible();

  // Admin: Open request
  await page.click('button:has-text("📅 여행 날짜")');
  await expect(page.locator('text=수정 요청 검토')).toBeVisible();

  // Admin: Approve
  await page.click('button:has-text("✅ 승인")');
  await expect(page.locator('text=승인됨')).toBeVisible();
});
```

---

## Component Props Reference

### ModificationRequestForm

```typescript
interface ModificationRequestFormProps {
  contractId: string;
  onSubmit: (data: {
    fieldName: string;
    newValue: string;
    reason?: string;
  }) => Promise<void>;
  onCancel: () => void;
}
```

### ModificationRequestList

```typescript
interface ModificationRequestListProps {
  requests: Array<{
    id: string;
    fieldName: string;
    newValue: string;
    reason?: string;
    status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'ALTERNATIVE_PROPOSED' | 'EXPIRED';
    requestedAt: Date;
    expiresAt: Date;
    appliedLenses?: string[];
    responseMessage?: string;
  }>;
  onSelectRequest: (requestId: string) => void;
  isLoading?: boolean;
}
```

### ModificationResponsePanel

```typescript
interface ModificationResponsePanelProps {
  requestId: string;
  fieldName: string;
  newValue: string;
  reason?: string;
  status: string;
  responseMessage?: string;
  expiresAt: Date;
  onApprove: () => Promise<void>;
  onReject: (message: string) => Promise<void>;
  onProposeAlternative: (value: string, reason: string) => Promise<void>;
  onClose: () => void;
}
```

---

## Troubleshooting

### "Cannot find module '@/lib/contract-modification-helpers'"
→ The helpers are already defined in `src/lib/contract-modification-helpers.ts`

### "Modifiable field validation error"
→ Only these 10 fields are allowed: tripDate, roomType, roomCategory, price, passengerName, passengerCount, specialRequest, dietaryRestriction, pickupLocation, returnDate

### "API returns 500 error"
→ Check that prisma client is properly initialized. Ensure DB has `ContractModificationRequest` table.

### "Modal doesn't close after action"
→ Check that API returns `{ ok: true }`. The `onClose()` callback should be triggered.

---

## Accessibility Checklist

- [ ] All inputs have labels (visible or aria-label)
- [ ] Form validation errors are announced to screen readers
- [ ] Keyboard navigation works (Tab to navigate, Enter to submit)
- [ ] Color is not the only way to convey status (use icons + text)
- [ ] Modal has proper focus management (focus → modal, Escape → close)
- [ ] Buttons have meaningful labels (not just icons)

---

## Performance Optimization

- **Lazy load ModificationRequestList:** Only show if user has permission
- **Pagination:** If >50 requests, paginate to 20 per page
- **Memoization:** Wrap components in `React.memo()` if re-rendering often
- **Image optimization:** Use Next.js `<Image>` component if adding any

---

**Integration Status:** Ready for API implementation  
**Estimated Implementation Time:** 2-3 hours  
**Dependencies:** Prisma, Contract Email Sender, Auth middleware  

_For questions, refer to `/docs/PHASE5-ModificationComponents-Implementation.md`_
