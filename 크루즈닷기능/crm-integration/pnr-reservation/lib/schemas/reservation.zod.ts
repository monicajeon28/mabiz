import { z } from 'zod';

// ============================================================================
// Traveler Zod Schema
// ============================================================================
export const TravelerCreateSchema = z.object({
  reservationId: z.number().int().positive(),
  roomNumber: z.number().int().positive(),
  isSingleCharge: z.boolean().default(false),
  korName: z.string().min(1, '한국이름은 필수입니다').max(100),
  engSurname: z.string().optional(),
  engGivenName: z.string().optional(),
  residentNum: z.string().optional(),
  gender: z.enum(['M', 'F', 'OTHER']).optional(),
  birthDate: z.string().optional(), // YYYY-MM-DD
  passportNo: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  nationality: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const TravelerUpdateSchema = TravelerCreateSchema.partial().required({
  reservationId: true,
  roomNumber: true,
});

export type Traveler = z.infer<typeof TravelerCreateSchema>;

// ============================================================================
// Reservation Zod Schema
// ============================================================================
export const ReservationCreateSchema = z.object({
  tripId: z.number().int().positive(),
  mainUserId: z.number().int().positive(),
  totalPeople: z.number().int().positive().min(1),
  cabinType: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentAmount: z.number().int().nonnegative().optional(),
  agentName: z.string().optional(),
  remarks: z.string().optional(),
});

export const ReservationUpdateSchema = z.object({
  pnrStatus: z.enum(['PENDING', 'COMPLETED', 'ERROR', 'CANCELLED']).optional(),
  passportStatus: z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED']).optional(),
  finalConfirmStatus: z.enum(['PENDING', 'REQUESTED', 'APPROVED', 'CONFIRMED', 'REJECTED']).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  totalPeople: z.number().int().positive().optional(),
  cabinType: z.string().optional(),
});

export type Reservation = z.infer<typeof ReservationCreateSchema>;

// ============================================================================
// PNR Submit Schema (Customer API)
// ============================================================================
export const PnrSubmitSchema = z.object({
  reservationId: z.number().int().positive(),
  travelers: z.array(
    z.object({
      id: z.number().int().optional(),
      korName: z.string().min(1, '한국이름은 필수입니다').max(100),
      residentNum: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      roomNumber: z.number().int().positive(),
    })
  ).min(1, '최소 1명의 여행자가 필요합니다'),
});

export type PnrSubmit = z.infer<typeof PnrSubmitSchema>;

// ============================================================================
// Final Confirm Schema
// ============================================================================
export const FinalConfirmRequestSchema = z.object({
  reservationId: z.number().int().positive(),
  requestedById: z.number().int().positive(),
  remarks: z.string().optional(),
});

export const FinalConfirmApproveSchema = z.object({
  reservationId: z.number().int().positive(),
  approvedById: z.number().int().positive(),
  audioUrl: z.string().url().optional(),
  remarks: z.string().optional(),
});

export const FinalConfirmRejectSchema = z.object({
  reservationId: z.number().int().positive(),
  rejectedById: z.number().int().positive(),
  reason: z.string().min(5, '반려 사유는 최소 5자 이상이어야 합니다').max(500),
});

// ============================================================================
// Passport Status Schema
// ============================================================================
export const PassportStatusUpdateSchema = z.object({
  travelerId: z.number().int().positive(),
  status: z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED']),
  passportNo: z.string().optional(),
  expiryDate: z.string().optional(), // YYYY-MM-DD
  remarks: z.string().optional(),
});
