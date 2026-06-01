'use client';

import { Loader2 } from 'lucide-react';

interface BlastPreview {
  willSend: number;
  isOverLimit: boolean;
  overLimitMsg: string | null;
}

interface BlastResult {
  sentCount: number;
  blockedCount: number;
  failedCount: number;
}

interface BlastPanelProps {
  blastMsg: string;
  onMsgChange: (msg: string) => void;
  blastPreview: BlastPreview | null;
  blastError: string | null;
  blastConfirm: boolean;
  onConfirmChange: (confirm: boolean) => void;
  onCheckBlast: () => void;
  checkingBlast: boolean;
  onSendBlast: () => void;
  blasting: boolean;
  blastResult: BlastResult | null;
  onClose: () => void;
}

export function BlastPanel({
  blastMsg,
  onMsgChange,
  blastPreview,
  blastError,
  blastConfirm,
  onConfirmChange,
  onCheckBlast,
  checkingBlast,
  onSendBlast,
  blasting,
  blastResult,
  onClose,
}: BlastPanelProps) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      {blastResult ? (
        <div className="bg-green-50 rounded-lg p-3 text-sm" role="status" aria-live="polite">
          <p className="font-semibold text-green-700">✅ 발송 완료</p>
          <p className="text-green-700 mt-1">
            성공 {blastResult.sentCount}명 · 차단 {blastResult.blockedCount}명
            {blastResult.failedCount > 0 && ` · 실패 ${blastResult.failedCount}명`}
          </p>
          <button onClick={onClose} className="text-sm text-gray-500 mt-2 underline">
            닫기
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={blastMsg}
            onChange={(e) => {
              onMsgChange(e.target.value);
            }}
            placeholder={
              '크루즈닷 입니다 😊\n[고객명]님, 이번 주 특가 소식이에요!\n→ cruisedot.co.kr'
            }
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 resize-none"
            aria-label="발송 메시지"
          />
          <p className="text-sm text-gray-600">[고객명] 자동 치환됩니다</p>

          {blastError && (
            <p className="text-base text-red-700 font-medium bg-red-50 p-3 rounded" role="alert">⚠️ {blastError}</p>
          )}

          {blastPreview && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-3 text-sm" role="region" aria-label="발송 최종 확인">
              <div>
                <h3 className="font-semibold text-yellow-800">📢 발송 최종 확인</h3>
                <div className="mt-2 space-y-1 text-yellow-700">
                  <p>
                    ✓ <span className="font-medium">대상:</span> {blastPreview.willSend}명
                  </p>
                  <div>
                    <p className="font-medium">✓ 메시지:</p>
                    {/* W3-5: 전체 메시지 표시 (스크롤 가능) */}
                    <div className="bg-white border border-yellow-200 rounded-lg p-2 max-h-20 overflow-y-auto mt-1">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {blastMsg}
                      </p>
                    </div>
                    {/* W3-5: 문자 수 표시 */}
                    <p className="text-sm text-gray-600 mt-1">
                      {blastMsg.length}자 {blastMsg.length > 80 && '(LMS 2건)'}
                    </p>
                  </div>
                </div>
                {blastPreview.isOverLimit && (
                  <p className="text-sm text-orange-600 mt-2">⚠️ 200명 초과 — 첫 200명만 발송됩니다</p>
                )}
              </div>

              <label className="flex items-start gap-2 pt-2 border-t border-yellow-200 cursor-pointer hover:bg-yellow-100/50 p-2 -mx-2 rounded">
                <input
                  type="checkbox"
                  checked={blastConfirm}
                  onChange={(e) => onConfirmChange(e.target.checked)}
                  className="w-5 h-5 rounded border-yellow-300 text-yellow-600 mt-1"
                  aria-label="발송 최종 확인"
                />
                <span className="text-sm text-yellow-900 font-medium">
                  정말로 <span className="font-bold text-red-600">{blastPreview.willSend}명</span>
                  에게 발송하겠습니다.
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-2">
            {!blastPreview ? (
              <button
                onClick={onCheckBlast}
                disabled={!blastMsg.trim() || checkingBlast}
                className="flex-1 border border-blue-300 text-blue-700 py-2 rounded-lg text-base font-medium hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkingBlast && <Loader2 className="w-4 h-4 animate-spin" />}
                {checkingBlast ? '확인 중...' : '대상 확인'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    onMsgChange('');
                    onConfirmChange(false);
                  }}
                  className="flex-1 border border-gray-300 text-gray-600 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                >
                  수정
                </button>
                <button
                  onClick={onSendBlast}
                  disabled={blasting || !blastConfirm}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all text-base flex items-center justify-center gap-2 ${
                    blastConfirm && !blasting
                      ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                  }`}
                  title={!blastConfirm ? '체크박스를 체크해주세요' : '발송하기'}
                >
                  {blasting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {blasting ? '발송 중...' : `✓ 발송 (${blastPreview.willSend}명)`}
                </button>
              </>
            )}
            {!blastPreview && (
              <button
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-sm"
              >
                취소
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
