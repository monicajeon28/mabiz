// ============================================================================
// PNR & Reservation Type Definitions
// ============================================================================

export interface ReservationWithTravelers {
  id: number;
  tripId: number;
  mainUserId: number;
  totalPeople: number;
  cabinType?: string | null;
  paymentDate?: Date | null;
  paymentMethod?: string | null;
  paymentAmount?: number | null;
  pnrStatus: string;
  passportStatus: string;
  finalConfirmStatus: string;
  status: string;
  pnrNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
  Traveler: TravelerRecord[];
}

export interface TravelerRecord {
  id: number;
  reservationId: number;
  roomNumber: number;
  korName?: string | null;
  engSurname?: string | null;
  engGivenName?: string | null;
  residentNum?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  passportNo?: string | null;
  expiryDate?: string | null;
  passportImage?: string | null;
  nationality?: string | null;
  phone?: string | null;
  userId?: number | null;
  updatedAt: Date;
}

export enum PnrStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
}

export enum PassportStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum FinalConfirmStatus {
  PENDING = 'PENDING',
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
