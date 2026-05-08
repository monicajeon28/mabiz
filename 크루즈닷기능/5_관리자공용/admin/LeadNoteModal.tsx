'use client';

import { useState, useEffect } from 'react';
import { FiX, FiSend, FiLock, FiUnlock, FiEdit2, FiTrash2 } from 'react-icons/fi';

interface LeadNote {
  id: number;
  note: string;
  interactionType: string;
  occurredAt: string;
  createdBy: {
    name: string | null;
    affiliateProfile?: {
      type: string | null;
      displayName: string | null;
    } | null;
  } | null;
}

interface Props {
  leadId: number;
  customerName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded?: (note?: string) => void;
}

export default function LeadNoteModal({ leadId, customerName, isOpen, onClose, onNoteAdded }: Props) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lead 기록 로드
  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/partner/customers/${leadId}/interactions`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setNotes(data.interactions || []);
      }
    } catch (error) {
      console.error('Failed to load lead notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 기록 작성
  const handleSubmit = async () => {
    if (!newNote.trim()) {
      alert('기록 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/partner/customers/${leadId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          note: newNote.trim(),
          interactionType: 'NOTE',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.message || '기록 작성에 실패했습니다.');
      }

      // 성공
      const savedNote = newNote.trim();
      setNewNote('');
      setSuccessMessage('기록이 성공적으로 작성되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadNotes();

      // Google 스프레드시트 업데이트를 위해 콜백 호출
      if (onNoteAdded) {
        onNoteAdded(savedNote);
      }
    } catch (error) {
      console.error('Failed to save lead note:', error);
      alert(error instanceof Error ? error.message : '기록 작성에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 작성자 라벨 가져오기
  const getCreatorLabel = (note: LeadNote) => {
    if (note.createdBy?.affiliateProfile) {
      const profile = note.createdBy.affiliateProfile;
      if (profile.type === 'BRANCH_MANAGER') return '대리점장';
      if (profile.type === 'SALES_AGENT') return '판매원';
    }
    return '본사';
  };

  const getCreatorName = (note: LeadNote) => {
    if (note.createdBy?.affiliateProfile?.displayName) {
      return note.createdBy.affiliateProfile.displayName;
    }
    return note.createdBy?.name || '관리자';
  };

  useEffect(() => {
    if (isOpen && leadId) {
      loadNotes();
      setSuccessMessage(null);

      // 실시간 업데이트: 5초마다 새 기록 확인
      const interval = setInterval(() => {
        loadNotes();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isOpen, leadId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">고객 기록</h2>
            <p className="text-sm text-gray-600 mt-1">
              {customerName || `Lead ID: ${leadId}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* 성공 메시지 */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {successMessage}
          </div>
        )}

        {/* 기록 목록 - 대화창 형태 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              아직 기록이 없습니다. 첫 번째 기록을 작성해보세요!
            </div>
          ) : (
            notes.map((note) => {
              const creatorLabel = getCreatorLabel(note);
              const isAdmin = creatorLabel === '본사';
              const isManager = creatorLabel === '대리점장';

              return (
                <div
                  key={note.id}
                  className={`flex ${isAdmin ? 'justify-start' : isManager ? 'justify-center' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] ${isAdmin ? 'items-start' : 'items-end'} flex flex-col`}>
                    <div className="flex items-center gap-2 mb-1 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isAdmin ? 'bg-gray-100 text-gray-700' :
                        isManager ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {creatorLabel}
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {getCreatorName(note)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(note.occurredAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className={`relative rounded-2xl px-4 py-3 shadow-sm ${
                      isAdmin
                        ? 'bg-white border border-gray-200'
                        : isManager
                        ? 'bg-purple-50 border border-purple-200'
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{note.note}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 기록 작성 폼 */}
        <div className="p-6 border-t bg-white">
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="고객에 대한 기록을 작성하세요..."
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmit();
                  }
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={isSaving || !newNote.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <FiSend size={18} />
                {isSaving ? '전송 중...' : '전송'}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              💬 대화창처럼 실시간으로 업데이트됩니다 • Cmd/Ctrl + Enter로 빠른 전송
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
