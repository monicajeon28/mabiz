# P1: Contact 결제상태 UI - PNR 페이지 연동

**Status:** 🟢 Ready for Implementation  
**Date:** 2026-05-21  
**Task ID:** #2  
**Priority:** P1  

---

## 📋 개요

PNR(여행 상세) 페이지에서 Contact의 결제상태(paid/cancelled/refunded)를 실시간으로 표시

### 변경 범위

```
1. API: /api/pnr/customer/[reservationId]
   - Contact를 전화번호로 찾기
   - paymentStatus, amounts, dates 응답에 추가

2. UI: src/app/pnr/[reservationId]/page.tsx
   - ReservationStatusBadge 컴포넌트 추가
   - 결제상태, 환불액, 마지막 갱신 시간 표시
```

---

## 🛠️ 1단계: API 수정

### 파일: `src/app/api/pnr/customer/[reservationId]/route.ts`

#### A. Contact 조회 로직 추가 (Line 65 이후)

```typescript
// Contact 조회 (전화번호 기준)
const contact = phone 
  ? await prisma.contact.findFirst({
      where: { 
        phone,
        deletedAt: null,
      },
      select: {
        id: true,
        lastPaymentStatus: true,
        lastPaymentAt: true,
        lastRefundedAt: true,
        paymentStatusNote: true,
      },
    })
  : null;
```

#### B. 응답에 paymentStatus 추가 (Line 72-90)

```typescript
return NextResponse.json({
  ok: true,
  reservation: {
    id: reservation.id,
    totalPeople: reservation.totalPeople,
    passportStatus: reservation.passportStatus,
    cabinType: reservation.cabinType,
    trip: reservation.trip || null,
    user: reservation.user,
    travelers: reservation.travelers,
    // ★ NEW: Contact 결제상태 정보
    paymentStatus: contact?.lastPaymentStatus || 'unknown',
    paymentStatusNote: contact?.paymentStatusNote || null,
    lastPaymentAt: contact?.lastPaymentAt || null,
    lastRefundedAt: contact?.lastRefundedAt || null,
  },
});
```

---

## 🛠️ 2단계: UI 타입 수정

### 파일: `src/app/pnr/[reservationId]/page.tsx`

#### A. Reservation 인터페이스 확장 (Line 16)

```typescript
interface Reservation {
  id: number;
  totalPeople: number;
  cabinType: string | null;
  trip: { /* ... */ } | null;
  user: { /* ... */ };
  travelers: Array<{ /* ... */ }>;
  
  // ★ NEW: Payment Status
  paymentStatus?: string;
  paymentStatusNote?: string | null;
  lastPaymentAt?: Date | null;
  lastRefundedAt?: Date | null;
}
```

#### B. 렌더링 부분에 배지 추가

결제상태를 표시할 위치 (대략 헤더 또는 예약 정보 상단):

```typescript
{reservation && (
  <div className="mb-4 flex items-center gap-2">
    <ReservationStatusBadge 
      status={reservation.paymentStatus}
      note={reservation.paymentStatusNote}
      lastRefundedAt={reservation.lastRefundedAt}
      lastPaymentAt={reservation.lastPaymentAt}
    />
  </div>
)}
```

---

## 🛠️ 3단계: 배지 컴포넌트 생성

### 파일: `src/app/pnr/[reservationId]/components/ReservationStatusBadge.tsx` (신규)

```typescript
'use client';

interface ReservationStatusBadgeProps {
  status?: string;
  note?: string | null;
  lastRefundedAt?: Date | null;
  lastPaymentAt?: Date | null;
}

export function ReservationStatusBadge({
  status = 'unknown',
  note,
  lastRefundedAt,
  lastPaymentAt,
}: ReservationStatusBadgeProps) {
  // 상태별 스타일
  const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    paid: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: '결제됨',
      icon: '✓',
    },
    cancelled: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: '취소됨',
      icon: '✕',
    },
    refunded: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: '환불됨',
      icon: '↻',
    },
    unknown: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: '미확인',
      icon: '?',
    },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const timestamp = status === 'refunded' ? lastRefundedAt : lastPaymentAt;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg}`}>
      <span className={`text-lg ${config.text}`}>{config.icon}</span>
      <div>
        <p className={`font-semibold ${config.text}`}>{config.label}</p>
        {note && <p className={`text-xs ${config.text} opacity-75`}>{note}</p>}
        {timestamp && (
          <p className={`text-xs ${config.text} opacity-50`}>
            {new Date(timestamp).toLocaleString('ko-KR')}
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## 📊 4단계: 체크리스트

- [ ] API `src/app/api/pnr/customer/[reservationId]/route.ts` 수정
  - [ ] Contact 조회 로직 추가
  - [ ] 응답에 paymentStatus 필드 추가

- [ ] UI `src/app/pnr/[reservationId]/page.tsx` 수정
  - [ ] Reservation 인터페이스 확장
  - [ ] 렌더링에 ReservationStatusBadge 추가

- [ ] 컴포넌트 생성
  - [ ] ReservationStatusBadge.tsx 구현

- [ ] 로컬 테스트
  - [ ] Contact 있는 경우 (paid/refunded/cancelled)
  - [ ] Contact 없는 경우 (unknown)
  - [ ] 스타일 검증

---

## 📅 일정

- **2026-05-21 (Day 1)**: API + UI 컴포넌트 구현
- **2026-05-22 (Day 2)**: 로컬 테스트 + 코드 리뷰
- **2026-05-23 (Day 3)**: 크루즈닷몰 웹훅 테스트와 통합 검증

---

## ⚠️ 주의사항

1. **Phone 매칭**
   - 양쪽 번호가 정규화되어야 함
   - normalizePhone() 함수 사용 권장

2. **Unknown 상태**
   - Contact가 없거나 paymentStatus가 null인 경우 'unknown' 처리

3. **타임스탐프**
   - refunded: lastRefundedAt 표시
   - paid: lastPaymentAt 표시
   - cancelled: lastPaymentAt 표시 (기존 결제 시간)

4. **성능**
   - Contact 조회 시 deleted 제외 필터링 필수

---

**다음 단계:** Step 4단계부터 구현 시작!
