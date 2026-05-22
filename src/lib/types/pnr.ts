/**
 * PNR 관련 타입 정의 (Traveler, Reservation, API 스키마)
 */

/**
 * DB 스키마와 일치하는 Traveler 타입
 */
export interface Traveler {
  id?: number; // DB PK
  korName: string;
  residentNum?: string | null;
  phone?: string | null;
  roomNumber: number;

  // 선택 필드 (여권 등록 시 사용)
  engSurname?: string | null;
  engGivenName?: string | null;
  passportNo?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  expiryDate?: string | null;
  gender?: string | null;
}

/**
 * 클라이언트 폼용 Traveler (UI 필드 포함)
 */
export interface TravelerFormData extends Traveler {
  roomColor?: string; // UI-only: 방 번호별 색상
}

/**
 * API 입력 스키마 (POST /api/pnr/customer/submit)
 */
export interface TravelerInput {
  id?: number;
  korName: string;
  residentNum?: string | null;
  phone?: string | null;
  roomNumber: number;
}

/**
 * 예약 정보 (DB + API 응답용)
 */
export interface Reservation {
  id: number;
  totalPeople: number;
  cabinType: string | null;
  passportStatus?: string;
  paymentStatus?: string;
  paymentStatusNote?: string | null;
  lastPaymentAt?: Date | null;
  lastRefundedAt?: Date | null;

  trip: {
    id: number;
    shipName: string | null;
    departureDate: Date | null;
    endDate?: Date | null;
    productCode?: string | null;
  } | null;

  user: {
    id: number;
    name: string | null;
    email?: string | null;
    phone?: string | null;
  };

  travelers: Traveler[];
}

/**
 * GET /api/pnr/customer/[reservationId] 응답 타입
 */
export interface PnrCustomerResponse {
  ok: boolean;
  reservation?: Reservation;
  error?: string;
  message?: string;
}

/**
 * POST /api/pnr/customer/submit 요청 바디
 */
export interface PnrSubmitBody {
  reservationId: number;
  travelers: TravelerInput[];
}

/**
 * POST /api/pnr/customer/submit 응답 타입
 */
export interface PnrSubmitResponse {
  ok: boolean;
  message?: string;
  error?: string;
  reservation?: any;
}
