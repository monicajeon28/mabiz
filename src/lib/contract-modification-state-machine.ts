/**
 * Contract Modification State Machine
 * 상태 전이: PENDING → [AUTO_APPROVED|MANUAL_APPROVAL_PENDING] → [APPROVED|REJECTED|ALTERNATIVE_PROPOSED] → APPLIED/CLOSED/EXPIRED
 * 심리학 렌즈: L2(중재), L6(손실회피), L7(동반자), L10(긴박감)
 */

export type ModificationStatus =
  | "REQUESTED"          // 초기 상태
  | "AUTO_APPROVED"      // 자동 승인됨
  | "MANUAL_APPROVAL_PENDING" // 수동 승인 대기
  | "APPROVED"           // 승인됨
  | "REJECTED"           // 거절됨
  | "ALTERNATIVE_PROPOSED" // 대안 제시됨
  | "ALTERNATIVE_ACCEPTED" // 대안 수락됨
  | "ALTERNATIVE_DECLINED" // 대안 거절됨
  | "COMPLETED"          // 완료됨
  | "EXPIRED";           // 만료됨

export type ModificationTrigger =
  | "AUTO_APPROVE"
  | "AWAIT_MANUAL"
  | "APPROVE"
  | "REJECT"
  | "PROPOSE_ALTERNATIVE"
  | "ACCEPT_ALTERNATIVE"
  | "DECLINE_ALTERNATIVE"
  | "COMPLETE"
  | "EXPIRE";

export interface StateTransition {
  from: ModificationStatus;
  to: ModificationStatus;
  trigger: ModificationTrigger;
  metadata?: Record<string, any>;
}

export interface StateAction {
  action: ModificationTrigger;
  label: string;
  icon: string;
  color: string;
  requiresApproval?: boolean;
}

export interface StatusBadge {
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
}

export interface TimeRemaining {
  label: string;
  urgency: "green" | "yellow" | "red";
}

/**
 * State Machine 구현
 * - 상태 전이 검증
 * - 사용 가능한 액션 목록 반환
 * - 배지/시간 남은 상태 정보
 */
export class ContractModificationStateMachine {
  /**
   * 허용된 상태 전이 규칙
   * from -> [to1, to2, ...]
   */
  private allowedTransitions: Map<ModificationStatus, ModificationStatus[]> = new Map([
    [
      "REQUESTED",
      ["AUTO_APPROVED", "MANUAL_APPROVAL_PENDING", "EXPIRED"],
    ],
    [
      "AUTO_APPROVED",
      ["COMPLETED", "EXPIRED"],
    ],
    [
      "MANUAL_APPROVAL_PENDING",
      ["APPROVED", "REJECTED", "ALTERNATIVE_PROPOSED", "EXPIRED"],
    ],
    [
      "APPROVED",
      ["COMPLETED", "EXPIRED"],
    ],
    [
      "REJECTED",
      ["EXPIRED"],
    ],
    [
      "ALTERNATIVE_PROPOSED",
      ["ALTERNATIVE_ACCEPTED", "ALTERNATIVE_DECLINED", "EXPIRED"],
    ],
    [
      "ALTERNATIVE_ACCEPTED",
      ["COMPLETED", "EXPIRED"],
    ],
    [
      "ALTERNATIVE_DECLINED",
      ["EXPIRED"],
    ],
    [
      "COMPLETED",
      [],
    ],
    [
      "EXPIRED",
      [],
    ],
  ]);

  /**
   * 상태 전이 검증
   * @returns true if transition is allowed, false otherwise
   */
  canTransitionTo(
    from: ModificationStatus,
    to: ModificationStatus
  ): boolean {
    const allowed = this.allowedTransitions.get(from) || [];
    return allowed.includes(to);
  }

  /**
   * 현재 상태에서 가능한 액션 목록 반환
   */
  getAvailableActions(status: ModificationStatus): StateAction[] {
    const actions: Record<ModificationStatus, StateAction[]> = {
      REQUESTED: [
        {
          action: "AUTO_APPROVE",
          label: "자동 승인 (예정)",
          icon: "⚙️",
          color: "gray",
          requiresApproval: false,
        },
        {
          action: "AWAIT_MANUAL",
          label: "수동 검토 대기",
          icon: "⏳",
          color: "yellow",
          requiresApproval: false,
        },
      ],
      AUTO_APPROVED: [
        {
          action: "COMPLETE",
          label: "완료",
          icon: "✅",
          color: "green",
          requiresApproval: false,
        },
      ],
      MANUAL_APPROVAL_PENDING: [
        {
          action: "APPROVE",
          label: "✅ 승인",
          icon: "✅",
          color: "green",
          requiresApproval: true,
        },
        {
          action: "REJECT",
          label: "❌ 거절",
          icon: "❌",
          color: "red",
          requiresApproval: true,
        },
        {
          action: "PROPOSE_ALTERNATIVE",
          label: "💡 대안 제시",
          icon: "💡",
          color: "purple",
          requiresApproval: true,
        },
      ],
      APPROVED: [
        {
          action: "COMPLETE",
          label: "완료",
          icon: "✅",
          color: "green",
          requiresApproval: false,
        },
      ],
      REJECTED: [],
      ALTERNATIVE_PROPOSED: [
        {
          action: "ACCEPT_ALTERNATIVE",
          label: "대안 수락",
          icon: "✅",
          color: "green",
          requiresApproval: false,
        },
        {
          action: "DECLINE_ALTERNATIVE",
          label: "대안 거절",
          icon: "❌",
          color: "red",
          requiresApproval: false,
        },
      ],
      ALTERNATIVE_ACCEPTED: [
        {
          action: "COMPLETE",
          label: "완료",
          icon: "✅",
          color: "green",
          requiresApproval: false,
        },
      ],
      ALTERNATIVE_DECLINED: [],
      COMPLETED: [],
      EXPIRED: [],
    };

    return actions[status] || [];
  }

  /**
   * 상태별 배지 정보 반환
   * (컴포넌트에서 표시용)
   */
  getStatusBadge(status: ModificationStatus): StatusBadge {
    const badges: Record<ModificationStatus, StatusBadge> = {
      REQUESTED: {
        label: "검토 중",
        icon: "⏳",
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800",
      },
      AUTO_APPROVED: {
        label: "자동 승인됨",
        icon: "⚙️",
        bgColor: "bg-blue-100",
        textColor: "text-blue-800",
      },
      MANUAL_APPROVAL_PENDING: {
        label: "검토 중",
        icon: "👤",
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800",
      },
      APPROVED: {
        label: "승인됨",
        icon: "✅",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
      },
      REJECTED: {
        label: "거절됨",
        icon: "❌",
        bgColor: "bg-red-100",
        textColor: "text-red-800",
      },
      ALTERNATIVE_PROPOSED: {
        label: "대안 제시됨",
        icon: "💡",
        bgColor: "bg-purple-100",
        textColor: "text-purple-800",
      },
      ALTERNATIVE_ACCEPTED: {
        label: "대안 수락",
        icon: "✅",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
      },
      ALTERNATIVE_DECLINED: {
        label: "대안 거절",
        icon: "❌",
        bgColor: "bg-red-100",
        textColor: "text-red-800",
      },
      COMPLETED: {
        label: "완료",
        icon: "✅",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
      },
      EXPIRED: {
        label: "만료됨",
        icon: "⏰",
        bgColor: "bg-gray-100",
        textColor: "text-gray-800",
      },
    };

    return badges[status];
  }

  /**
   * 시간 남은 상태 계산
   * 긴박감(L10) 표시용
   */
  getTimeRemaining(expiresAt: Date): TimeRemaining {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const hours = diff / (1000 * 60 * 60);
    const days = Math.ceil(hours / 24);

    if (days >= 3) {
      return { label: `${days}일 남음`, urgency: "green" };
    } else if (days >= 1) {
      return { label: `${days}일 남음 ⏰`, urgency: "yellow" };
    } else if (hours > 0) {
      return { label: "오늘 중 완료 필요 ⏰", urgency: "red" };
    } else {
      return { label: "만료됨 ⏰", urgency: "red" };
    }
  }

  /**
   * 상태별 다음 예상 상태 반환
   * (UI: "다음 단계" 제시용)
   */
  getNextExpectedStates(status: ModificationStatus): ModificationStatus[] {
    const allowed = this.allowedTransitions.get(status) || [];
    return allowed;
  }

  /**
   * 상태별 설명 반환
   */
  getStatusDescription(status: ModificationStatus): string {
    const descriptions: Record<ModificationStatus, string> = {
      REQUESTED: "고객이 요청한 수정사항을 검토 중입니다.",
      AUTO_APPROVED: "요청사항이 자동으로 승인되었습니다.",
      MANUAL_APPROVAL_PENDING: "관리자의 수동 검토를 대기 중입니다.",
      APPROVED: "요청사항이 승인되었습니다.",
      REJECTED: "요청사항이 거절되었습니다.",
      ALTERNATIVE_PROPOSED: "더 나은 대안을 제안했습니다.",
      ALTERNATIVE_ACCEPTED: "대안이 수락되었습니다.",
      ALTERNATIVE_DECLINED: "대안이 거절되었습니다.",
      COMPLETED: "수정 요청이 완료되었습니다.",
      EXPIRED: "수정 요청의 유효기한이 만료되었습니다.",
    };

    return descriptions[status];
  }
}
