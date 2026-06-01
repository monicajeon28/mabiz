'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getStateLabel,
  getAvailableTransitions,
  type FunnelState,
} from '@/lib/funnel-state-machine';

interface FunnelStateModalProps {
  stateId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function FunnelStateModal({
  stateId,
  isOpen,
  onClose,
}: FunnelStateModalProps) {
  const [selectedState, setSelectedState] = useState<FunnelState | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 상태 정보 조회
  const { data: stateData, isLoading } = useQuery({
    queryKey: ['funnel-state', stateId],
    queryFn: async () => {
      const res = await fetch(`/api/funnel-states/${stateId}`);
      if (!res.ok) throw new Error('조회 실패');
      return res.json();
    },
    enabled: isOpen,
  });

  // 상태 전이 뮤테이션
  const { mutate: transitionState, isPending } = useMutation({
    mutationFn: async (newState: FunnelState) => {
      const payload: any = { newState };
      if (reason) payload.reason = reason;
      if (notes) {
        payload.metadata = { notes };
      }

      const res = await fetch(`/api/funnel-states/${stateId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '상태 변경 실패');
      }

      return res.json();
    },
    onSuccess: (data) => {
      alert(data.message || '상태가 변경되었습니다.');
      setSelectedState(null);
      setReason('');
      setNotes('');
      onClose();
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : '상태 변경 실패');
    },
  });

  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const state = stateData?.data;
  const currentState = state?.status as FunnelState;
  const availableTransitions = currentState
    ? getAvailableTransitions(currentState)
    : [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          퍼널 상태 관리
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          고객의 퍼널 상태를 확인하고 변경합니다
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">로딩 중...</div>
          </div>
        ) : state ? (
          <div className="space-y-6">
            {/* 고객 정보 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">고객명</p>
                <p className="text-sm font-semibold">{state.contact.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">전화번호</p>
                <p className="text-sm font-semibold">{state.contact.phone}</p>
              </div>
              {state.contact.email && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">이메일</p>
                  <p className="text-sm font-semibold">{state.contact.email}</p>
                </div>
              )}
            </div>

            {/* 현재 상태 */}
            <div>
              <p className="text-sm font-semibold mb-3">현재 상태</p>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-500 mb-1">상태</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                      currentState
                    )}`}
                  >
                    {getStateLabel(currentState)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">마지막 변경</p>
                  <p className="text-sm">
                    {new Date(state.updatedAt).toLocaleString('ko-KR')}
                  </p>
                </div>
                {state.metadata?.failureReason && (
                  <div>
                    <p className="text-sm text-gray-500">실패 사유</p>
                    <p className="text-sm text-red-600">
                      {state.metadata.failureReason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 상태 전이 */}
            {availableTransitions.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-3">상태 변경</p>
                <div className="space-y-3">
                  <select
                    value={selectedState || ''}
                    onChange={(e) =>
                      setSelectedState((e.target.value as FunnelState) || null)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">변경할 상태 선택</option>
                    {availableTransitions.map((s) => (
                      <option key={s} value={s}>
                        {getStateLabel(s)}
                      </option>
                    ))}
                  </select>

                  {/* 실패 상태일 때 실패 사유 입력 */}
                  {selectedState === 'FAILED' && (
                    <textarea
                      placeholder="실패 사유를 입력하세요"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  )}

                  {/* 추가 메모 (선택사항) */}
                  <textarea
                    placeholder="추가 메모 (선택사항)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* 메타데이터 */}
            {state.metadata && (
              <div>
                <p className="text-sm font-semibold mb-2">추가 정보</p>
                <pre className="text-sm bg-gray-50 p-2 rounded border max-h-40 overflow-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(state.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            데이터를 로드할 수 없습니다
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 justify-end mt-8 pt-6 border-t">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            닫기
          </button>
          {availableTransitions.length > 0 && selectedState && (
            <button
              onClick={() => transitionState(selectedState)}
              disabled={isPending || !selectedState}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isPending ? '변경 중...' : '상태 변경'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusBadgeClass(status: FunnelState): string {
  const classes: Record<FunnelState, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    ACTIVE: 'bg-blue-100 text-blue-700',
    WAITING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-slate-100 text-slate-700',
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
}
