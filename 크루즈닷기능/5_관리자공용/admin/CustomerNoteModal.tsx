'use client';

import { useState, useEffect } from 'react';
import { FiX, FiSend, FiLock, FiUnlock, FiEdit2, FiTrash2 } from 'react-icons/fi';

interface CustomerNote {
  id: number;
  content: string;
  isInternal: boolean;
  createdByLabel: string;
  createdByName: string;
  createdAt: string;
}

interface Props {
  customerId: number;
  customerName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded?: (note?: string) => void;
}

export default function CustomerNoteModal({ customerId, customerName, isOpen, onClose, onNoteAdded }: Props) {
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  // 고객 기록 로드
  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/customers/${customerId}/notes`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
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
      const response = await fetch(`/api/admin/customers/${customerId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: newNote.trim(),
          isInternal,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '기록 작성에 실패했습니다.');
      }

      // 성공 - 새로고침 없이 메시지만 표시
      const savedNote = newNote.trim();
      setNewNote('');
      setIsInternal(false);
      setSuccessMessage('기록이 성공적으로 작성되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000); // 3초 후 메시지 제거
      await loadNotes(); // 목록만 새로고침

      // Google 스프레드시트 업데이트를 위해 콜백 호출
      if (onNoteAdded) {
        onNoteAdded(savedNote);
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      alert(error instanceof Error ? error.message : '기록 작성에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 기록 수정
  const handleEdit = (note: CustomerNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const handleSaveEdit = async (noteId: number) => {
    if (!editingContent.trim()) {
      alert('기록 내용을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/customers/${customerId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: editingContent.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '기록 수정에 실패했습니다.');
      }

      setEditingNoteId(null);
      setEditingContent('');
      setSuccessMessage('기록이 성공적으로 수정되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadNotes();
    } catch (error) {
      console.error('Failed to update note:', error);
      alert(error instanceof Error ? error.message : '기록 수정에 실패했습니다.');
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  // 기록 삭제
  const handleDelete = async (noteId: number) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setDeletingNoteId(noteId);
      const response = await fetch(`/api/admin/customers/${customerId}/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '기록 삭제에 실패했습니다.');
      }

      setSuccessMessage('기록이 성공적으로 삭제되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert(error instanceof Error ? error.message : '기록 삭제에 실패했습니다.');
    } finally {
      setDeletingNoteId(null);
    }
  };

  useEffect(() => {
    if (isOpen && customerId) {
      loadNotes();
      setSuccessMessage(null); // 모달 열 때 메시지 초기화
      
      // 실시간 업데이트: 5초마다 새 기록 확인 (대화창처럼)
      const interval = setInterval(() => {
        loadNotes();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen, customerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">고객 기록</h2>
            <p className="text-sm text-gray-600 mt-1">
              {customerName || `고객 ID: ${customerId}`}
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
              // 작성자 타입에 따라 메시지 위치 결정 (대화창처럼)
              const isAdmin = note.createdByLabel === '본사';
              const isManager = note.createdByLabel === '대리점장';
              const isAgent = note.createdByLabel === '판매원';
              
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
                        {note.createdByLabel}
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {note.createdByName}
                      </span>
                      {note.isInternal && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                          🔒 내부
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(note.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={`relative rounded-2xl px-4 py-3 shadow-sm ${
                      note.isInternal
                        ? 'bg-yellow-50 border-2 border-yellow-200'
                        : isAdmin
                        ? 'bg-white border border-gray-200'
                        : isManager
                        ? 'bg-purple-50 border border-purple-200'
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(note.id)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                            >
                              저장
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded text-sm font-medium transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                            <button
                              onClick={() => handleEdit(note)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="수정"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(note.id)}
                              disabled={deletingNoteId === note.id}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="삭제"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 기록 작성 폼 */}
        <div className="p-6 border-t bg-white">
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
        </div>
      </div>
    </div>
  );
}

