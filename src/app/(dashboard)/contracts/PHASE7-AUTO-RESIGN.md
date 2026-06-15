# Phase 7: Auto Re-Signature UI Components

**Status:** ✅ Complete | **Files Created:** 2 | **Lines:** 650+ | **TypeScript:** ✅ 0 Errors

---

## Overview

Two new React client components for **Phase 7** of the contract modification system:

1. **ModificationSummary.tsx** (250 lines) — Display change details with psychology cues
2. **AutoReSignModal.tsx** (400 lines) — 4-step modal with signature capture

**Psychology Framework Applied:**
- Russell Brunson: Objection handling + deal re-closing
- Grant Cardone: L6 (Loss Aversion) + L10 (Urgency/Immediacy)
- Steve Jobs: Simplicity + clarity (1 change per summary)
- PASONA: Problem → Solution → Offer → Action

---

## Component 1: ModificationSummary.tsx

### Purpose
Display a single contract modification clearly with:
- Current value vs new value comparison
- Change reason (context)
- Applied psychology lenses
- PDF preview buttons (optional)
- Pre-signing checklist

### Props
```typescript
interface ModificationSummaryProps {
  modification: {
    id: string;
    fieldName: string;
    currentValue: string;
    newValue: string;
    reason?: string;
    appliedLenses: string[];
  };
  contractData?: {
    currentPdf?: string;    // URL or base64
    amendedPdf?: string;    // URL or base64
  };
  onViewPdf?: (type: "current" | "amended") => void;
}
```

### Features
- **Field Emoji Mapping:** Trip date 📅 | Room type 🏨 | Price 💰 | etc.
- **Current → New Visualization:** Color-coded (white → green)
- **Change Reason Display:** Italicized context for understanding
- **Psychology Lens Display:** Shows which Grant Cardone lens triggered
- **PDF Comparison Buttons:** Side-by-side view (if PDFs provided)
- **Pre-Signing Checklist:** 3-point validation (L10 confidence)
- **Expiry Warning Banner:** "7일간 유효" (loss aversion trigger)

### Supported Fields (10 total)
- `tripDate` — 📅 여행 날짜
- `roomType` — 🏨 객실 타입
- `roomCategory` — 🛏️ 객실 카테고리
- `price` — 💰 가격
- `passengerName` — 👤 탑승자명
- `passengerCount` — 👥 탑승자 수
- `specialRequest` — 💬 특별 요청
- `dietaryRestriction` — 🍽️ 식이 제한
- `pickupLocation` — 📍 픽업 위치
- `returnDate` — 🔄 복귀 날짜

### Applied Lenses
```typescript
L2_LOW_COMPLEXITY:    "복잡도 낮음 (간단한 변경)"
L6_LOSS_AVERSION:     "신중한 결정 필요"
L7_COMPANION:         "함께 결정하는 순간"
L10_URGENCY:          "시간이 중요합니다"
```

### Example Usage
```typescript
<ModificationSummary
  modification={{
    id: "mod-123",
    fieldName: "price",
    currentValue: "3,500,000",
    newValue: "3,200,000",
    reason: "Group booking discount applied",
    appliedLenses: ["L6_LOSS_AVERSION", "L10_URGENCY"],
  }}
  contractData={{
    currentPdf: "blob:...",
    amendedPdf: "blob:...",
  }}
  onViewPdf={(type) => window.open(type === "current" ? ... : ...)}
/>
```

### UI Layout
```
┌─────────────────────────────────────────────┐
│ ✏️ 변경 사항 확인                              │
│ 다음 항목이 수정되었습니다...                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 💰                                          │
│ 💰 가격                                     │
│ 현재 값: 3,500,000                        │
│          ↓                                  │
│ 새로운 값: 3,200,000                       │
│ 변경 이유: Group booking...                │
└─────────────────────────────────────────────┘

🎯 이 변경의 의미:
  [신중한 결정 필요] [시간이 중요합니다]

📄 계약서 비교:
  [현재 계약서] [수정된 계약서]

✅ 재서명 전 확인:
  ✓ 위의 변경 사항이 맞습니다
  ✓ 다른 변경 사항은 없습니다
  ✓ 재서명할 준비가 되었습니다

⏰ 중요: 이 재서명 요청은 7일간 유효합니다.
```

---

## Component 2: AutoReSignModal.tsx

### Purpose
4-step modal flow for secure signature capture:
1. **Review** — Confirm changes + agree to terms
2. **Signature** — Draw signature on canvas
3. **Confirming** — Processing state
4. **Success** — Completion confirmation

### Props
```typescript
interface AutoReSignModalProps {
  isOpen: boolean;
  modification: { /* same as ModificationSummary */ };
  contractData?: { /* same as ModificationSummary */ };
  onConfirm: (signature: string) => Promise<void>;
  onCancel: () => void;
  timeRemaining?: number; // seconds (default: 604800 = 7 days)
}
```

### Features

#### Step 1: Review
- Embeds `<ModificationSummary />` for detail view
- Checkbox: "위 변경 사항이 정확하며, 이를 인정하고 재서명하는 것을 동의합니다"
- "취소" button (soft exit)
- "재서명하기" button (disabled until checkbox checked)
- **Psychology:** Explicit consent (SPIN Implication stage)

#### Step 2: Signature
- HTML5 Canvas for drawing (mouse + touch support)
- Signature state validation (`hasSignature` flag)
- "지우기" button to clear canvas
- Visual feedback: "✓ 서명이 입력되었습니다" once drawn
- Error messages (validation)
- "이전" button (back to review)
- "서명 완료" button (disabled if no signature)
- **Psychology:** Friction reduction (canvas pre-focused, clear instructions)

#### Step 3: Confirming
- Loading spinner animation
- Message: "재서명 처리 중... 잠시만 기다려주세요."
- Non-interactive (no user action needed)

#### Step 4: Success
- ✅ Large green checkmark icon
- Confirmation message: "✅ 재서명 완료!"
- Detail: "변경된 계약서가 확정되었습니다. 최종 계약서는 이메일로 발송되었습니다."
- "닫기" button
- **Psychology:** Celebration (endowment effect) + reward messaging

### Signature Canvas Implementation
```typescript
// Multi-platform support (mouse + touch)
- Canvas width: dynamically set to parent width
- Canvas height: min 150px
- Stroke color: black (#000)
- Line width: 2.5px
- Line cap: round (smooth edges)
- Line join: round (smooth curves)

// Event handlers:
- mousedown/mouseup: draw on mouse
- mousemove: stroke path
- touchstart/touchend: draw on touch
- touchmove: stroke path
- mouseout: prevent drawing outside canvas
```

### Time Remaining Display
```typescript
// Format: "N일 H시간" or "H시간"
const formatTimeRemaining = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}일 ${hours}시간`;
  return `${hours}시간`;
};

// Default: 604800 seconds = 7 days
// Sticky header shows: "⏰ 유효기한 7일 0시간"
```

### Example Usage
```typescript
import { AutoReSignModal } from '@/app/(dashboard)/contracts/AutoReSignModal';

export function ContractPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        재서명 필요
      </button>

      <AutoReSignModal
        isOpen={showModal}
        modification={{
          id: "mod-456",
          fieldName: "price",
          currentValue: "3,500,000",
          newValue: "3,200,000",
          reason: "오타 수정",
          appliedLenses: ["L10_URGENCY"],
        }}
        onConfirm={async (signatureImage: string) => {
          // signatureImage is base64 PNG
          const res = await fetch(`/api/contracts/sign`, {
            method: 'POST',
            body: JSON.stringify({
              modificationId: modification.id,
              signature: signatureImage,
            }),
          });
          if (!res.ok) throw new Error('Signing failed');
        }}
        onCancel={() => setShowModal(false)}
        timeRemaining={604800} // 7 days
      />
    </>
  );
}
```

### Modal State Machine
```
Review
  ├─ Check "동의합니다" → "재서명하기" enabled
  ├─ Click "재서명하기" → Step 2: Signature
  └─ Click "취소" → onCancel() called

Signature
  ├─ Draw on canvas → hasSignature = true, "완료" enabled
  ├─ Click "지우기" → canvas cleared, hasSignature = false
  ├─ Click "이전" → Step 1: Review
  ├─ Click "서명 완료" → Step 3: Confirming
  └─ Error → remain on Step 2, show error message

Confirming
  ├─ API call in progress (non-interactive)
  ├─ Success → Step 4: Success
  └─ Error → back to Step 2: Signature, show error

Success
  ├─ Click "닫기" → onCancel() called
  └─ (modal closes)
```

### Styling Details
- **Header:** Blue gradient (`from-blue-600 to-blue-700`)
- **Buttons:** Blue (primary), Gray (secondary), Green (success)
- **Backgrounds:** Blue-50 (info), Green-50 (success), Yellow-50 (warning), Red-50 (error)
- **Borders:** 1-2px gray/blue/green/yellow depending on context
- **Icons:** Lucide React (CheckCircle, AlertCircle, Loader, Eye)
- **Responsive:** Max-width 2xl, full width on mobile, padding 4

---

## Psychology Framework Applied

### Russell Brunson (Objection Handling)
- **Modification Summary:** "Story" phase (explaining the change)
- **Step 2 (Signature):** "Objection" phase (customer validates they agree)
- **Step 4 (Success):** "Close" phase (celebration + next steps)

### Grant Cardone Lenses
- **L2 (Complexity):** Simple 1-field changes (visual breakdown)
- **L6 (Loss Aversion):** "신중한 결정" message + expiry countdown
- **L7 (Companion):** "함께 결정" tone + collaborative language
- **L10 (Urgency):** "7일간 유효" + countdown timer in header

### Steve Jobs (Simplicity)
- **1 Change at a Time:** ModificationSummary shows single field only
- **Clear Visual Hierarchy:** Emoji + field name + current→new
- **Minimal Options:** 3-4 actions per step max
- **Celebration:** Large success icon + positive messaging

### PASONA Framework (SMS + Email Cues)
- **Problem:** Change request received
- **Agitation:** "변경 사항 확인 필요" (creates tension)
- **Solution:** "재서명하세요" (relief mechanism)
- **Offer:** "7일간 유효" (deadline)
- **Narrow:** 4-step flow (reduces choice paralysis)
- **Action:** "서명 완료" button + final success

---

## Data Flow

```
1. Customer receives email: "계약서 수정 완료 - 재서명 필요"
   ├─ Email contains: Modification ID + Link to dashboard

2. Customer clicks link → AutoReSignModal opens
   ├─ Step 1: Review → sees ModificationSummary
   ├─ Agrees to terms → "재서명하기" button enabled

3. Step 2: Signature → Canvas opens
   ├─ Customer draws signature
   ├─ Triggers hasSignature = true

4. Step 3: Confirming
   ├─ Sends: POST /api/contracts/{modId}/resign
   ├─ Body: { signature: base64PNG, timestamp, userAgent }

5. Backend processes:
   ├─ Validates signature (not blank)
   ├─ Saves to S3/CDN (PII-secure)
   ├─ Updates DB: ContractModification.resignedAt = now()
   ├─ Triggers email: Final contract PDF attached
   ├─ Updates contact CRM: signature_date field

6. Step 4: Success
   ├─ Shows confirmation badge
   ├─ Email sent with final contract
   ├─ Customer clicks "닫기"
```

---

## Integration Checklist

### ✅ Done
- [x] ModificationSummary.tsx (250 lines, fully typed)
- [x] AutoReSignModal.tsx (400 lines, fully typed)
- [x] Canvas signature capture (mouse + touch)
- [x] 4-step state machine
- [x] Psychology framework embedded
- [x] TypeScript 0 errors
- [x] Responsive design (mobile-first)
- [x] Tailwind CSS styling
- [x] Lucide icons integrated

### 📋 Next Steps (Backend)

1. **Create API Route:**
   ```
   POST /api/contracts/{modificationId}/resign
   
   Body: {
     signature: string;        // base64 PNG
     timestamp?: string;       // ISO 8601
     userAgent?: string;       // browser info
   }
   
   Response: {
     ok: boolean;
     data?: {
       status: "RESIGNED";
       signedAt: string;       // ISO 8601
       contractPdfUrl?: string;
     };
     error?: string;
   }
   ```

2. **Update Prisma Schema:**
   ```prisma
   model ContractModificationRequest {
     // ... existing fields
     
     // Phase 7: Resignation
     resignedAt          DateTime?
     signatureImage      String?        // S3 URL
     signatureTimestamp  DateTime?
     resignedByUserId    String?
     
     @@index([resignedAt])
   }
   ```

3. **Email Template:**
   - Subject: "✅ 계약서 재서명 완료"
   - Body: Includes final PDF + confirmation details
   - CTA: Link to download (or view in portal)

4. **Cron Job (Optional):**
   - Check `expiresAt < now()` and `resignedAt == null`
   - Set status = "EXPIRED"
   - Send reminder email: "7일 만료되었습니다"

---

## Testing Checklist

### Unit Tests
- [ ] ModificationSummary renders with all 10 field types
- [ ] AutoReSignModal state transitions (Review→Signature→Success)
- [ ] Canvas signature detection (`hasSignature` flag)
- [ ] Time formatting (seconds → "N일 H시간")
- [ ] Error messages display correctly

### Integration Tests
- [ ] Modal opens/closes via `isOpen` prop
- [ ] Signature submission calls `onConfirm` with base64 PNG
- [ ] Cancel button calls `onCancel` from any step
- [ ] Agree checkbox enables "재서명하기" button
- [ ] Canvas clears when "지우기" clicked

### E2E Tests (Playwright)
- [ ] User can complete full 4-step flow
- [ ] Signature is captured and sent to API
- [ ] Success message displays after API response
- [ ] PDF preview buttons work (if contractData provided)
- [ ] Modal is responsive on mobile (phone + tablet)

### Accessibility Tests
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Color contrast (WCAG AA minimum)
- [ ] Screen reader labels (aria-label on buttons)
- [ ] Canvas has proper role/aria attributes
- [ ] Focus management (trap inside modal)

### Performance
- [ ] Modal renders in <100ms
- [ ] Canvas initialization <50ms
- [ ] Signature image (base64) <500KB
- [ ] No memory leaks on unmount

---

## File Locations
- `D:\mabiz-crm\src\app\(dashboard)\contracts\ModificationSummary.tsx` (250 lines)
- `D:\mabiz-crm\src\app\(dashboard)\contracts\AutoReSignModal.tsx` (400 lines)

---

## Version History
- **v1.0 (2026-06-15):** Initial Phase 7 components created
  - ModificationSummary: Field display + psychology lenses
  - AutoReSignModal: 4-step modal + canvas signature
  - Both components: TypeScript 0 errors, Tailwind CSS, Lucide icons

---

## References
- **Russell Brunson:** Funnel stages (Story → Objection → Close)
- **Grant Cardone:** 10-Lens framework (L2, L6, L7, L10)
- **Steve Jobs:** Simplicity + clarity principle
- **PASONA:** Marketing psychology framework (Problem → Action)
- **Previous Phase 5-6 Components:**
  - ModificationRequestForm.tsx
  - ModificationRequestList.tsx
  - ModificationResponsePanel.tsx

---

**Status: Phase 7 Complete ✅**

Awaiting backend API route implementation (Phase 8).
