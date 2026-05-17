/**
 * Partner Suspension Types
 * 파트너 자동 정지 관련 타입 정의
 */

export type PartnerSuspension = {
  id: string;
  organizationId: string;
  partnerId: string | null;
  partnerName: string;
  partnerRole: string; // MANAGER | SALESPERSON | PRESALES

  suspensionStatus: string; // SUSPENDED | APPEALING | RESOLVED
  suspensionReason: string; // HIGH_REFUND | NO_REVENUE | MANUAL
  reasonDetails: Record<string, unknown> | null; // { refundRate?: number, monthsAffected?: number[], ... }

  suspendedAt: Date;
  suspendedByAdminId: string | null;

  appealedAt: Date | null;
  appealMessage: string | null;

  resolvedAt: Date | null;
  resolutionNotes: string | null;

  contractRef: string | null;

  createdAt: Date;
  updatedAt: Date;
};

export interface SuspensionCandidate {
  organizationId: string;
  partnerId?: string;
  partnerName: string;
  partnerRole: string;
  suspensionReason: 'HIGH_REFUND' | 'NO_REVENUE';
  reasonDetails: {
    refundRate?: number;
    affectedMonths?: number[];
    zeroMonths?: number[];
  };
}

export interface SuspensionAppeals {
  id: string;
  organizationId: string;
  partnerId: string;
  partnerName: string;
  suspensionReason: string;
  appealedAt: Date;
  appealMessage: string;
}

export type SuspensionStatus = 'SUSPENDED' | 'APPEALING' | 'RESOLVED';
export type SuspensionReason = 'HIGH_REFUND' | 'NO_REVENUE' | 'MANUAL';
export type PartnerRole = 'MANAGER' | 'SALESPERSON' | 'PRESALES';
