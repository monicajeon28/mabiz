# PNR Reservation State Machine

## Reservation.pnrStatus
```
PENDING ──→ COMPLETED ──→ CANCELLED
  ↓
  └─→ ERROR (재시도 대기)
```
- **PENDING**: PNR 입력 대기 중
- **COMPLETED**: PNR 및 여행자 정보 입력 완료
- **ERROR**: PNR 검증 실패 (재시도 가능)
- **CANCELLED**: 예약 취소

## Reservation.passportStatus
```
PENDING ──→ SUBMITTED ──→ VERIFIED ──→ APPROVED
  ↓                                      
  └─────────────→ REJECTED ──────────────┘
                    (재제출 필요)
```
- **PENDING**: 여권 미제출
- **SUBMITTED**: 여권 제출됨 (검증 대기)
- **VERIFIED**: 여권 검증 완료
- **APPROVED**: 최종 승인됨
- **REJECTED**: 반려됨 (재제출 필요)

## Reservation.finalConfirmStatus
```
PENDING ──→ REQUESTED ──→ APPROVED ──→ CONFIRMED
  ↓            ↓
  └─→ REJECTED ─┘
      (재요청)
```
- **PENDING**: 최종 확인 미요청
- **REQUESTED**: 최종 확인 요청됨 (승인 대기)
- **APPROVED**: 승인됨 (확인 완료)
- **CONFIRMED**: 최종 확인 완료
- **REJECTED**: 반려됨 (사유: `finalConfirmRejectionReason`)

## Reservation.status
```
PENDING ──→ CONFIRMED ──→ CANCELLED
               ↓
               └─→ COMPLETED (이용 완료)
```
- **PENDING**: 예약 초기 상태
- **CONFIRMED**: 예약 확정
- **COMPLETED**: 여행 이용 완료
- **CANCELLED**: 예약 취소

## Workflow Example
```
1. 예약 생성 (Partner API)
   └─ Reservation.status = "CONFIRMED"
   └─ Reservation.pnrStatus = "PENDING"
   └─ Reservation.passportStatus = "PENDING"
   └─ Reservation.finalConfirmStatus = "PENDING"

2. PNR 정보 입력 (Customer API)
   └─ Traveler[] 생성
   └─ Reservation.pnrStatus = "COMPLETED"

3. 여권 업로드 (Customer API)
   └─ Traveler.passportImage, Traveler.passportDriveUrl 저장
   └─ Reservation.passportStatus = "SUBMITTED"

4. 최종 확인 요청 (Partner/Admin API)
   └─ Reservation.finalConfirmStatus = "REQUESTED"
   └─ Reservation.finalConfirmRequestedAt = now()
   └─ Reservation.finalConfirmRequestedById = userId

5. 최종 확인 승인 (Admin API)
   └─ Reservation.finalConfirmStatus = "APPROVED"
   └─ Reservation.finalConfirmApprovedAt = now()
   └─ Reservation.finalConfirmApprovedById = adminId
   └─ Reservation.finalConfirmAudioUrl 저장 (음성 확인)
```
