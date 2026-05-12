'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiUpload,
  FiMic,
  FiExternalLink,
  FiAlertCircle,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';

type FinalConfirmStatus = {
  status: 'PENDING' | 'REQUESTED' | 'APPROVED' | 'REJECTED';
  requestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  audioUrl: string | null;
  passportStatus: string | null;
  pnrStatus: string | null;
};

type Props = {
  leadId: number;
  customerName: string;
  onStatusChange?: () => void;
};

export default function FinalConfirmSection({ leadId, customerName, onStatusChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [hasReservation, setHasReservation] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<FinalConfirmStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [note, setNote] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/partner/customers/${leadId}/final-confirm`);
      const data = await res.json();

      if (data.ok) {
        setHasReservation(data.hasReservation);
        setConfirmStatus(data.finalConfirm);
      }
    } catch (error) {
      console.error('[FinalConfirmSection] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 오디오 파일인지 확인
      if (!file.type.startsWith('audio/')) {
        showError('오디오 파일만 업로드할 수 있습니다.');
        return;
      }
      // 50MB 제한
      if (file.size > 50 * 1024 * 1024) {
        showError('파일 크기는 50MB 이하여야 합니다.');
        return;
      }
      setAudioFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!audioFile) {
      showError('콜녹음 파일을 첨부해주세요.');
      return;
    }

    if (!confirm(`${customerName} 고객의 최종확인을 요청하시겠습니까?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('audioFile', audioFile);
      formData.append('note', note);

      const res = await fetch(`/api/partner/customers/${leadId}/final-confirm`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.ok) {
        showSuccess('최종확인 요청이 제출되었습니다.');
        setAudioFile(null);
        setNote('');
        fetchStatus();
        onStatusChange?.();
      } else {
        showError(data.error || '요청 처리에 실패했습니다.');
      }
    } catch (error) {
      showError('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-100 rounded-xl p-4">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
        <div className="h-8 bg-slate-200 rounded w-full"></div>
      </div>
    );
  }

  if (!hasReservation) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-2 text-slate-500">
          <FiAlertCircle />
          <span className="text-sm">예약 정보가 없어 최종확인을 요청할 수 없습니다.</span>
        </div>
      </div>
    );
  }

  // 상태별 렌더링
  const status = confirmStatus?.status || 'PENDING';

  // 상태별 한글 표시
  const getStatusBadge = () => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700 border border-green-200">
            <FiCheckCircle /> 승인완료
          </span>
        );
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-700 border border-orange-200">
            <FiClock /> 본사 확인 대기중
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 border border-red-200">
            <FiXCircle /> 거절됨
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200">
            <FiClock /> 요청 가능
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <h4 className="text-base font-bold text-slate-900">최종확인</h4>
        {getStatusBadge()}
      </div>

      {/* PNR/여권 상태 표시 */}
      {confirmStatus && (
        <div className="flex gap-3 mb-4">
          <div className={`text-xs px-2.5 py-1 rounded-lg ${
            confirmStatus.pnrStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            PNR: {confirmStatus.pnrStatus === 'completed' ? '완료' : '미완료'}
          </div>
          <div className={`text-xs px-2.5 py-1 rounded-lg ${
            confirmStatus.passportStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            여권: {confirmStatus.passportStatus === 'completed' ? '완료' : '미완료'}
          </div>
        </div>
      )}

      {/* 상태별 내용 */}
      {status === 'PENDING' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            고객의 PNR, 여권 등록이 완료되면 콜녹음을 첨부하여 최종확인을 요청해주세요.
          </p>

          {/* 콜녹음 업로드 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              콜녹음 파일 첨부 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
                id="audio-upload"
              />
              <label
                htmlFor="audio-upload"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <FiUpload className="text-slate-400" />
                <span className="text-sm text-slate-600">
                  {audioFile ? audioFile.name : '콜녹음 파일 선택 (MP3, WAV 등)'}
                </span>
              </label>
            </div>
            {audioFile && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <FiMic className="text-blue-500" />
                <span className="text-sm text-blue-700 flex-1 truncate">{audioFile.name}</span>
                <span className="text-xs text-blue-500">
                  ({(audioFile.size / 1024 / 1024).toFixed(1)}MB)
                </span>
                <button
                  onClick={() => setAudioFile(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiXCircle />
                </button>
              </div>
            )}
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">메모 (선택)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="추가 메모가 있으면 입력해주세요."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 제출 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !audioFile}
            className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? '요청 중...' : '최종확인 요청'}
          </button>
        </div>
      )}

      {status === 'REQUESTED' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            최종확인 요청이 제출되었습니다. 본사에서 확인 후 승인/거절 처리됩니다.
          </p>
          <div className="text-xs text-slate-500">
            요청일시: {formatDate(confirmStatus?.requestedAt || null)}
          </div>
          {confirmStatus?.audioUrl && (
            <a
              href={confirmStatus.audioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
            >
              <FiMic /> 제출한 콜녹음 듣기 <FiExternalLink />
            </a>
          )}
        </div>
      )}

      {status === 'APPROVED' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <FiCheckCircle className="text-lg" />
            <span className="font-medium">최종확인이 완료되었습니다.</span>
          </div>
          <div className="text-xs text-slate-500">
            승인일시: {formatDate(confirmStatus?.approvedAt || null)}
          </div>
          {confirmStatus?.audioUrl && (
            <a
              href={confirmStatus.audioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition-colors"
            >
              <FiMic /> 콜녹음 듣기 <FiExternalLink />
            </a>
          )}
        </div>
      )}

      {status === 'REJECTED' && (
        <div className="space-y-4">
          <div className="p-3 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <FiXCircle />
              <span className="font-medium">최종확인이 거절되었습니다.</span>
            </div>
            {confirmStatus?.rejectionReason && (
              <p className="text-sm text-red-600">
                사유: {confirmStatus.rejectionReason}
              </p>
            )}
            <div className="text-xs text-red-500 mt-2">
              거절일시: {formatDate(confirmStatus?.rejectedAt || null)}
            </div>
          </div>

          {/* 재요청 가능 */}
          <div className="pt-3 border-t border-slate-200">
            <p className="text-sm text-slate-600 mb-3">
              문제를 수정한 후 다시 요청할 수 있습니다.
            </p>

            {/* 콜녹음 업로드 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                콜녹음 파일 첨부 <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="w-full text-sm border border-slate-300 rounded-xl p-2"
              />
            </div>

            {audioFile && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <FiMic className="text-blue-500" />
                <span className="text-sm text-blue-700 flex-1 truncate">{audioFile.name}</span>
                <button
                  onClick={() => setAudioFile(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiXCircle />
                </button>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !audioFile}
              className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '요청 중...' : '다시 요청'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
