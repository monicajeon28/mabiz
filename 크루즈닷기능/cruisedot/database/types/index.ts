/**
 * Generated TypeScript Types for Cruise Guide App Database
 * Auto-generated from Prisma Schema
 *
 * This file provides TypeScript type definitions for all core database models
 * related to passport submission, reservations, payments, trials, and affiliates.
 */

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface User {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  customerStatus?: string | null;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  isLocked: boolean;
  loginCount: number;
}

export interface UserWithRelations extends User {
  Reservation?: Reservation[];
  ProductInquiry?: ProductInquiry[];
  Payment?: Payment[];
  Trial?: Trial | null;
  AffiliateProfile?: AffiliateProfile | null;
}

// ============================================================================
// Product Types
// ============================================================================

export interface CruiseProduct {
  id: number;
  name: string;
  description?: string | null;
  shipName?: string | null;
  totalPassengers?: number | null;
  departureDate?: Date | null;
  returnDate?: Date | null;
  price?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Passport Types (여권 정보)
// ============================================================================

export interface PassportUploadToken {
  id: number;
  token: string;
  leadId: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface PassportRequestLog {
  id: number;
  userId?: number | null;
  adminId?: number | null;
  templateId?: number | null;
  messageBody: string;
  messageChannel: string;
  status: string;
  sentAt?: Date | null;
  createdAt: Date;
}

export interface PassportRequestTemplate {
  id: number;
  name: string;
  messageTemplate: string;
  messageChannel: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PassportSubmission {
  id: number;
  userId: number;
  tripId?: number | null;
  token: string;
  status: string;
  submittedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PassportSubmissionGuest {
  id: number;
  submissionId: number;
  groupNumber: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  createdAt: Date;
}

export interface PassportSubmissionWithGuests extends PassportSubmission {
  PassportSubmissionGuest?: PassportSubmissionGuest[];
}

// ============================================================================
// Reservation Types (예약 정보)
// ============================================================================

export interface Reservation {
  id: number;
  tripId: number;
  mainUserId: number;
  productId?: number | null;
  totalPeople: number;
  status: string;
  bookingNumber?: string | null;
  totalPrice?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReservationWithDetails extends Reservation {
  User?: User;
  CruiseProduct?: CruiseProduct | null;
  Traveler?: Traveler[];
  TravelContract?: TravelContract | null;
}

export interface ReservationAudit {
  id: number;
  reservationId: number;
  changedBy: number;
  changedAt: Date;
  fieldName: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export interface Traveler {
  id: number;
  reservationId: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  engSurname?: string | null;
  engGivenName?: string | null;
  birthDate?: string | null;
  roomNumber?: number | null;
  isSingleCharge: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TravelContract {
  id: number;
  reservationId: number;
  status: string;
  signedAt?: Date | null;
  expiresAt?: Date | null;
  content?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Product Inquiry Types (상품 문의)
// ============================================================================

export interface ProductInquiry {
  id: number;
  userId?: number | null;
  productId?: number | null;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  status: string;
  priority?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInquiryWithLogs extends ProductInquiry {
  InquiryCallLog?: InquiryCallLog[];
}

export interface InquiryCallLog {
  id: number;
  inquiryId: number;
  result: string;
  memo?: string | null;
  duration?: number | null;
  calledAt: Date;
  createdAt: Date;
}

// ============================================================================
// ChatBot Types (챗봇 설정)
// ============================================================================

export interface ChatBotFlow {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  flowJson?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatBotQuestion {
  id: number;
  flowId: number;
  sequenceNumber: number;
  question: string;
  type: string;
  isRequired: boolean;
  metadata?: any;
  createdAt: Date;
}

export interface ChatBotResponse {
  id: number;
  questionId: number;
  response: string;
  nextSequence?: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ChatBotSession {
  id: number;
  userId: number;
  flowId?: number | null;
  status: string;
  currentQuestion?: number | null;
  responses?: any;
  startedAt: Date;
  endedAt?: Date | null;
}

// ============================================================================
// Payment Types (결제 정보)
// ============================================================================

export interface Payment {
  id: number;
  orderId: string;
  userId?: number | null;
  reservationId?: number | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerTel?: string | null;
  transactionId?: string | null;
  failureReason?: string | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentWithRefunds extends Payment {
  PaymentRefund?: PaymentRefund[];
}

export interface PayAppPayment {
  id: number;
  orderId: string;
  mulNo?: string | null;
  landingPageId?: number | null;
  productName?: string | null;
  amount: number;
  status: string;
  paymentMethod?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRefund {
  id: number;
  paymentId: number;
  amount: number;
  reason?: string | null;
  status: string;
  requestedAt: Date;
  processedAt?: Date | null;
}

// ============================================================================
// Trial Types (체험 프로그램)
// ============================================================================

export interface Trial {
  id: number;
  userId: number;
  code: string;
  status: string;
  startDate: Date;
  endDate: Date;
  notificationSent: boolean;
  notificationSentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrialWithAudit extends Trial {
  TrialAuditLog?: TrialAuditLog[];
}

export interface TrialAuditLog {
  id: number;
  trialId: number;
  userId: number;
  action: string;
  details?: any;
  createdAt: Date;
}

export interface TrialSignup {
  id: number;
  email: string;
  phone?: string | null;
  name?: string | null;
  source?: string | null;
  status: string;
  convertedAt?: Date | null;
  createdAt: Date;
}

// ============================================================================
// Product Image Types (상품 이미지)
// ============================================================================

export interface ProductImage {
  id: number;
  productId: number;
  originalUrl?: string | null;
  webpUrl?: string | null;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mimeType?: string | null;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImageWithLogs extends ProductImage {
  ImageAccessLog?: ImageAccessLog[];
}

export interface ImageAccessLog {
  id: number;
  imageId: number;
  userId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  createdAt: Date;
}

// ============================================================================
// Affiliate Types (제휴 시스템)
// ============================================================================

export interface AffiliateSale {
  id: number;
  saleNumber: string;
  profileId: number;
  reservationId?: number | null;
  amount: number;
  commission?: number | null;
  status: string;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateSaleWithLedger extends AffiliateSale {
  AffiliateProfile?: AffiliateProfile;
  AffiliateLedger?: AffiliateLedger[];
}

export interface AffiliateProfile {
  id: number;
  userId: number;
  companyName: string;
  businessNumber?: string | null;
  status: string;
  commissionRate: number;
  bankName?: string | null;
  bankAccount?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateProfileWithSales extends AffiliateProfile {
  User?: User;
  AffiliateSale?: AffiliateSale[];
  AffiliateLedger?: AffiliateLedger[];
}

export interface AffiliateLedger {
  id: number;
  saleId: number;
  profileId: number;
  type: string;
  amount: number;
  withholdingAmount: number;
  netAmount: number;
  isSettled: boolean;
  settledAt?: Date | null;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Automation & Logging Types
// ============================================================================

export interface AutomationLog {
  id: number;
  userId?: number | null;
  actionType: string;
  status: string;
  result?: string | null;
  errorMessage?: string | null;
  metadata?: any;
  executedAt?: Date | null;
  createdAt: Date;
}

// ============================================================================
// Request/Response Types for API
// ============================================================================

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  buyerTel: string;
  paymentMethod?: string;
}

export interface CreateTrialRequest {
  userId: number;
  code: string;
  endDate: Date;
}

export interface CreateReservationRequest {
  tripId: number;
  mainUserId: number;
  productId?: number;
  totalPeople: number;
  travelers: Omit<Traveler, 'id' | 'reservationId' | 'createdAt' | 'updatedAt'>[];
}

export interface CreateProductInquiryRequest {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  userId?: number;
  productId?: number;
}

export interface CreatePassportSubmissionRequest {
  userId: number;
  token: string;
  expiresAt: Date;
  guests: Omit<PassportSubmissionGuest, 'id' | 'submissionId' | 'createdAt'>[];
}

// ============================================================================
// Status Enums
// ============================================================================

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum TrialStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum ProductInquiryStatus {
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  CLOSED = 'CLOSED',
}

export enum PassportSubmissionStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum AffiliateStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}
