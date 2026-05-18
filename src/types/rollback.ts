/**
 * 롤백 타입 정의
 */

export interface RollbackEvent {
  timestamp: string; // ISO 8601
  reason: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  details?: any;
  duration?: number; // ms
}

export interface RollbackState {
  triggeredAt: string; // ISO 8601
  reason: string;
  recoveryTarget: "SENDING_HISTORY" | "EXECUTION_LOG";
}

export interface ValidationResult {
  valid: boolean;
  totalRecords: number;
  nullPhoneCount: number;
  nullEmailCount: number;
}

export interface RollbackResult {
  success: boolean;
  duration: number; // ms
  details: {
    validationResult?: ValidationResult;
    featureFlagDisabled?: boolean;
    cacheInvalidated?: boolean;
    rollbackCompleted?: boolean;
    targetedAt?: string;
  };
  error?: string;
}

export interface RollbackStatus {
  isExecutionLogEnabled: boolean;
  rollbackState: RollbackState | null;
  lastRollbackAt?: string;
  recoveryInProgress: boolean;
}
