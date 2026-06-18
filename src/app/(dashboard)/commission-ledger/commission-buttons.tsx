'use client';

import React, { useState } from 'react';
import type { UserRole } from '@/lib/rbac';
import {
  getAllButtonPermissions,
  isButtonVisible,
  isButtonClickable,
  getDisabledButtonTooltip,
  ROLE_DESCRIPTIONS,
  BUTTON_CONFIG,
} from '@/lib/commission-button-permissions';

// ============================================================================
// 타입 정의
// ============================================================================

interface CommissionButtonsProps {
  userRole: UserRole;
  onSettle: () => Promise<void>;
  onDispute: () => Promise<void>;
  onVerify: () => Promise<void>;
  onExcelDownload: () => Promise<void>;
  onRecalculate: () => Promise<void>;
}

// ============================================================================
// 개별 버튼 컴포넌트
// ============================================================================

interface ButtonProps {
  icon: string;
  label: string;
  visible: boolean;
  enabled: boolean;
  reason?: string;
  tooltipMessage?: string;
  onClick: () => Promise<void>;
  isLoading?: boolean;
}

function CommissionButton({
  icon,
  label,
  visible,
  enabled,
  reason,
  tooltipMessage,
  onClick,
  isLoading = false,
}: ButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  if (!visible) {
    return null;
  }

  const handleClick = async () => {
    if (!enabled || isExecuting) return;
    setIsExecuting(true);
    try {
      await onClick();
    } finally {
      setIsExecuting(false);
    }
  };

  const buttonClasses = enabled
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'bg-gray-300 text-gray-600 cursor-not-allowed';

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        disabled={!enabled || isLoading || isExecuting}
        className={`
          h-12 px-6 rounded-lg font-semibold text-sm
          transition-colors duration-200
          flex items-center gap-2
          min-w-max
          ${buttonClasses}
          ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-lg">{icon}</span>
        <span>{label}</span>
        {isExecuting && <span className="ml-1 animate-spin">⏳</span>}
      </button>

      {/* 비활성 버튼 호버 메시지 */}
      {!enabled && reason && showTooltip && (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-orange-50 border-2 border-orange-300 rounded-lg p-3 w-72 text-xs text-gray-700 whitespace-pre-line">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>
              <strong>이 버튼은 사용할 수 없어요</strong>
              <br />
              <br />
              {reason}
            </span>
          </div>
        </div>
      )}

      {/* 활성 버튼 호버 메시지 (엑셀용) */}
      {enabled && tooltipMessage && showTooltip && (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-blue-50 border-2 border-blue-300 rounded-lg p-3 w-72 text-xs text-gray-700">
          <div className="flex items-start gap-2">
            <span className="text-lg">ℹ️</span>
            <span>{tooltipMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 역할 설명 배너
// ============================================================================

interface RoleBannerProps {
  role: UserRole;
}

function RoleBanner({ role }: RoleBannerProps) {
  const { title, description } = ROLE_DESCRIPTIONS[role];

  return (
    <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl">👤</span>
        <div>
          <p className="font-bold text-blue-900">당신은: {title}</p>
          <p className="text-sm text-gray-700 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export function CommissionButtons({
  userRole,
  onSettle,
  onDispute,
  onVerify,
  onExcelDownload,
  onRecalculate,
}: CommissionButtonsProps) {
  const perms = getAllButtonPermissions(userRole);

  const visibleButtons = [
    isButtonVisible(perms.settle.status),
    isButtonVisible(perms.dispute.status),
    isButtonVisible(perms.verify.status),
    isButtonVisible(perms.excel.status),
    isButtonVisible(perms.recalculate.status),
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* 역할 설명 배너 */}
      <RoleBanner role={userRole} />

      {/* 버튼 그룹 */}
      {visibleButtons > 0 ? (
        <div className="flex flex-wrap gap-3">
          {/* 💰 월말정산 */}
          <CommissionButton
            icon={BUTTON_CONFIG.settle.icon}
            label={BUTTON_CONFIG.settle.label}
            visible={isButtonVisible(perms.settle.status)}
            enabled={isButtonClickable(perms.settle.status)}
            reason={getDisabledButtonTooltip(perms.settle.status, perms.settle.reason)}
            onClick={onSettle}
          />

          {/* 🚨 이의제기 */}
          <CommissionButton
            icon={BUTTON_CONFIG.dispute.icon}
            label={BUTTON_CONFIG.dispute.label}
            visible={isButtonVisible(perms.dispute.status)}
            enabled={isButtonClickable(perms.dispute.status)}
            reason={getDisabledButtonTooltip(perms.dispute.status, perms.dispute.reason)}
            onClick={onDispute}
          />

          {/* ✅ 확인 */}
          <CommissionButton
            icon={BUTTON_CONFIG.verify.icon}
            label={BUTTON_CONFIG.verify.label}
            visible={isButtonVisible(perms.verify.status)}
            enabled={isButtonClickable(perms.verify.status)}
            onClick={onVerify}
          />

          {/* 📥 엑셀다운 */}
          <CommissionButton
            icon={BUTTON_CONFIG.excel.icon}
            label={BUTTON_CONFIG.excel.label}
            visible={isButtonVisible(perms.excel.status)}
            enabled={isButtonClickable(perms.excel.status)}
            tooltipMessage={perms.excel.scope?.label}
            onClick={onExcelDownload}
          />

          {/* 🔄 재계산 */}
          <CommissionButton
            icon={BUTTON_CONFIG.recalculate.icon}
            label={BUTTON_CONFIG.recalculate.label}
            visible={isButtonVisible(perms.recalculate.status)}
            enabled={isButtonClickable(perms.recalculate.status)}
            reason={getDisabledButtonTooltip(perms.recalculate.status, perms.recalculate.reason)}
            onClick={onRecalculate}
          />
        </div>
      ) : (
        <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
          사용 가능한 버튼이 없습니다.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 교육용 그리드 (선택사항)
// ============================================================================

interface CommissionButtonPermissionGridProps {
  showDescriptions?: boolean;
}

export function CommissionButtonPermissionGrid({
  showDescriptions = false,
}: CommissionButtonPermissionGridProps) {
  const roles: UserRole[] = ['GLOBAL_ADMIN', 'OWNER', 'AGENT', 'FREE_SALES'];
  const buttons = ['settle', 'dispute', 'verify', 'excel', 'recalculate'] as const;

  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="px-4 py-3 text-left font-bold text-gray-800">버튼</th>
            {roles.map((role) => (
              <th
                key={role}
                className="px-4 py-3 text-center font-bold text-gray-800 whitespace-nowrap"
              >
                {ROLE_DESCRIPTIONS[role].title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buttons.map((button) => {
            const config = BUTTON_CONFIG[button];
            return (
              <tr key={button} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-800">
                  <span className="text-lg">{config.icon}</span>
                  <span className="ml-2">{config.label}</span>
                </td>
                {roles.map((role) => {
                  const perm = getAllButtonPermissions(role)[button];
                  const statusIcon =
                    perm.status === 'enabled'
                      ? '✅'
                      : perm.status === 'disabled'
                        ? '🔒'
                        : '❌';
                  return (
                    <td key={`${button}-${role}`} className="px-4 py-3 text-center">
                      {statusIcon}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {showDescriptions && (
        <div className="mt-6 space-y-2 text-xs text-gray-600">
          <p>
            <strong>✅</strong> = 활성 (클릭 가능)
          </p>
          <p>
            <strong>🔒</strong> = 비활성 (호버하면 이유 표시)
          </p>
          <p>
            <strong>❌</strong> = 숨김 (버튼이 안 보임)
          </p>
        </div>
      )}
    </div>
  );
}
