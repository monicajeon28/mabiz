/**
 * Commission Button Permissions
 *
 * 수당 대장 페이지의 5개 버튼에 대한 권한 관리
 * Phase 3: UI 권한 설계 (버튼 표시/숨김/활성/비활성)
 *
 * 역할:
 * - GLOBAL_ADMIN: 관리자 (모든 버튼 활성)
 * - OWNER: 지사장 (정산/재계산 제외)
 * - AGENT: 대리점장 (확인/엑셀만)
 * - FREE_SALES: 일반사용자 (모든 버튼 숨김)
 */

import type { UserRole } from '@/lib/rbac';

// ============================================================================
// 타입 정의
// ============================================================================

export type ButtonStatus = 'enabled' | 'disabled' | 'hidden';

export interface ExcelDownloadScope {
  label: string;                 // 호버 메시지
  scope: 'all' | 'team' | 'self'; // 다운로드 범위
  fileName: string;              // 파일명
}

export interface ButtonPermission {
  status: ButtonStatus;          // 활성/비활성/숨김
  reason?: string;               // 비활성 이유 (초등학생 수준)
  action?: string;               // 수행할 액션
  scope?: ExcelDownloadScope;    // 엑셀 다운로드 범위
}

export interface AllButtonPermissions {
  settle: ButtonPermission;      // 💰 월말정산
  dispute: ButtonPermission;     // 🚨 이의제기
  verify: ButtonPermission;      // ✅ 확인
  excel: ButtonPermission;       // 📥 엑셀다운
  recalculate: ButtonPermission; // 🔄 재계산
}

// ============================================================================
// 역할 설명 (초등학생 수준)
// ============================================================================

export const ROLE_DESCRIPTIONS: Record<UserRole, { title: string; description: string }> = {
  GLOBAL_ADMIN: {
    title: '본사 관리자',
    description: '마비즈 전체를 관리하는 사람. 모든 팀의 수당을 보고 정산할 수 있어요.',
  },
  OWNER: {
    title: '지사장',
    description: '자기 팀 대리점장들을 관리하는 사람. 자기 팀의 수당만 보고 관리할 수 있어요.',
  },
  AGENT: {
    title: '대리점장',
    description: '여행을 파는 대리점장. 자기 수당만 보고 확인할 수 있어요.',
  },
  FREE_SALES: {
    title: '일반 사용자',
    description: '수당 시스템을 사용하지 않는 사용자.',
  },
};

// ============================================================================
// 권한 함수 1: 월말정산 (관리자만)
// ============================================================================

export function canClickSettleButton(role: UserRole): ButtonPermission {
  switch (role) {
    case 'GLOBAL_ADMIN':
      return {
        status: 'enabled',
        action: 'openSettleModal',
      };
    case 'OWNER':
      return {
        status: 'disabled',
        reason: '정산은 본사 관리자만 처리할 수 있어요.\n본사에 정산 요청을 해주세요.',
      };
    case 'AGENT':
    case 'FREE_SALES':
      return {
        status: 'hidden',
      };
    default:
      return { status: 'hidden' };
  }
}

// ============================================================================
// 권한 함수 2: 이의제기 (관리자 + 지사장)
// ============================================================================

export function canClickDisputeButton(role: UserRole): ButtonPermission {
  switch (role) {
    case 'GLOBAL_ADMIN':
      return {
        status: 'enabled',
        action: 'openDisputeModal',
      };
    case 'OWNER':
      return {
        status: 'enabled',
        action: 'openDisputeModal',
      };
    case 'AGENT':
    case 'FREE_SALES':
      return {
        status: 'hidden',
      };
    default:
      return { status: 'hidden' };
  }
}

// ============================================================================
// 권한 함수 3: 확인 (모든 사용자, 일반사용자 제외)
// ============================================================================

export function canClickVerifyButton(role: UserRole): ButtonPermission {
  switch (role) {
    case 'GLOBAL_ADMIN':
    case 'OWNER':
    case 'AGENT':
      return {
        status: 'enabled',
        action: 'openVerifyModal',
      };
    case 'FREE_SALES':
      return {
        status: 'hidden',
      };
    default:
      return { status: 'hidden' };
  }
}

// ============================================================================
// 권한 함수 4: 엑셀 다운로드 (범위는 역할에 따라)
// ============================================================================

export function getExcelDownloadScope(role: UserRole): ButtonPermission {
  switch (role) {
    case 'GLOBAL_ADMIN':
      return {
        status: 'enabled',
        scope: {
          label: '전체 팀 원의 수당 기록을 다운로드합니다.',
          scope: 'all',
          fileName: '[마비즈] 전체 수당 기록.xlsx',
        },
      };
    case 'OWNER':
      return {
        status: 'enabled',
        scope: {
          label: '당신 팀 대리점장의 수당만 다운로드합니다.',
          scope: 'team',
          fileName: '[마비즈] 우리 팀 수당 기록.xlsx',
        },
      };
    case 'AGENT':
      return {
        status: 'enabled',
        scope: {
          label: '당신의 수당 기록을 다운로드합니다.',
          scope: 'self',
          fileName: '[마비즈] 내 수당 기록.xlsx',
        },
      };
    case 'FREE_SALES':
      return {
        status: 'hidden',
      };
    default:
      return { status: 'hidden' };
  }
}

// ============================================================================
// 권한 함수 5: 재계산 (관리자만)
// ============================================================================

export function canClickRecalculateButton(role: UserRole): ButtonPermission {
  switch (role) {
    case 'GLOBAL_ADMIN':
      return {
        status: 'enabled',
        action: 'openRecalculateModal',
      };
    case 'OWNER':
      return {
        status: 'disabled',
        reason: '재계산은 본사 관리자만 처리할 수 있어요.\n본사에 재계산을 요청해주세요.',
      };
    case 'AGENT':
    case 'FREE_SALES':
      return {
        status: 'hidden',
      };
    default:
      return { status: 'hidden' };
  }
}

// ============================================================================
// 통합 헬퍼: 모든 버튼 권한 한번에 조회
// ============================================================================

export function getAllButtonPermissions(role: UserRole): AllButtonPermissions {
  return {
    settle: canClickSettleButton(role),
    dispute: canClickDisputeButton(role),
    verify: canClickVerifyButton(role),
    excel: getExcelDownloadScope(role),
    recalculate: canClickRecalculateButton(role),
  };
}

// ============================================================================
// 상태 판단 헬퍼
// ============================================================================

export function isButtonVisible(status: ButtonStatus): boolean {
  return status !== 'hidden';
}

export function isButtonClickable(status: ButtonStatus): boolean {
  return status === 'enabled';
}

// ============================================================================
// CSS 클래스 생성
// ============================================================================

export function getButtonClassName(status: ButtonStatus): string {
  switch (status) {
    case 'enabled':
      return 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:false';
    case 'disabled':
      return 'bg-gray-300 hover:bg-gray-400 text-gray-600 cursor-not-allowed';
    case 'hidden':
      return 'hidden';
    default:
      return '';
  }
}

// ============================================================================
// 호버 메시지
// ============================================================================

export function getDisabledButtonTooltip(status: ButtonStatus, reason?: string): string | undefined {
  if (status === 'disabled' && reason) {
    return reason;
  }
  return undefined;
}

// ============================================================================
// 버튼별 라벨 및 아이콘
// ============================================================================

export const BUTTON_CONFIG = {
  settle: {
    icon: '💰',
    label: '월말정산',
    description: '모든 대리점장의 수당을 계산해서 돈을 주는 거예요.',
  },
  dispute: {
    icon: '🚨',
    label: '이의제기',
    description: '이 수당이 잘못된 것 같아요 라고 말하는 거예요.',
  },
  verify: {
    icon: '✅',
    label: '확인',
    description: '이 수당이 뭐에서 나온 거야 라고 자세히 보는 거예요.',
  },
  excel: {
    icon: '📥',
    label: '엑셀다운',
    description: '수당 기록을 컴퓨터에 저장하는 거예요.',
  },
  recalculate: {
    icon: '🔄',
    label: '재계산',
    description: '수당을 처음부터 다시 계산하는 거예요.',
  },
} as const;
