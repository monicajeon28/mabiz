'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import DOMPurify from 'dompurify';
import { detectTypos } from '@/lib/spell-check';

interface ReviewTabProps {
  groupId: string;
  message: string;
  dryRunResult: { count: number; sample: string } | null;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

/**
 * 관리자/대리점장용 발송 검수 탭
 * - 메시지 미리보기
 * - 샘플 고객 정보 (전화번호 마스킹 없음)
 * - 오타 감지
 * - 승인/거절 버튼
 */
export function ReviewTab({
  groupId,
  message,
  dryRunResult,
  onApprove,
  onReject,
  approving,
}: ReviewTabProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [typos, setTypos] = useState<string[]>([]);

  useEffect(() => {
    if (!dryRunResult || !groupId) return;

    setLoading(true);

    // 고객 목록 로드 (최대 5명)
    fetch(`/api/groups/${groupId}/customers?limit=5`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.customers)) {
          setCustomers(d.customers);
        }
      })
      .catch(() => {
        // API 실패해도 계속 진행
      })
      .finally(() => setLoading(false));

    // 오타 검사
    const detected = detectTypos(message);
    setTypos(detected);
  }, [groupId, dryRunResult]);

  if (!dryRunResult) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4" role="region" aria-label="관리자 발송 검수">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
        <h3 className="font-semibold text-gray-900">📋 관리자 발송 검수</h3>
      </div>

      {/* 메시지 미리보기 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">메시지 내용</h4>
        <div className="bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words text-sm text-gray-800" role="region" aria-label="검수할 메시지 내용">
          {DOMPurify.sanitize(message, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
          })}
        </div>
      </div>

      {/* 오타 감지 경고 */}
      {typos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-sm text-red-700">
            <span className="font-semibold">⚠️ 오타 감지:</span>
          </p>
          <ul className="text-sm text-red-700 mt-1 space-y-1" aria-label="감지된 오타 목록">
            {typos.map((typo, idx) => (
              <li key={idx}>• {typo}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 고객 샘플 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">
          고객 샘플{' '}
          <span className="text-gray-600">
            (전체 {dryRunResult.count}명 중 처음 {Math.min(5, customers.length)}명)
          </span>
        </h4>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 bg-white rounded border border-gray-200 animate-pulse"
              />
            ))}
          </div>
        ) : customers.length > 0 ? (
          <div className="space-y-2 bg-white rounded-lg border border-gray-200 p-3">
            {customers.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between py-1.5">
                <span className="font-medium text-gray-900">{customer.name}</span>
                <span className="text-sm text-gray-600">{customer.phone}</span>
              </div>
            ))}
            {dryRunResult.count > customers.length && (
              <div className="text-xs text-gray-500 pt-1 border-t border-gray-200">
                … 외 {dryRunResult.count - customers.length}명
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
            고객 목록을 불러올 수 없습니다.
          </div>
        )}
      </div>

      {/* 승인/거절 버튼 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onApprove}
          disabled={approving}
          aria-label="발송 승인하기"
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
          {approving ? '승인 중...' : '✓ 승인 및 발송'}
        </button>
        <button
          onClick={onReject}
          disabled={approving}
          aria-label="발송 거절하기"
          className="flex-1 flex items-center justify-center gap-2 bg-gray-400 text-white py-2.5 rounded-lg font-medium hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <XCircle className="w-4 h-4" aria-hidden="true" />
          ✕ 거절
        </button>
      </div>
    </div>
  );
}
