'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  ChevronDown,
  Trash2,
  Eye,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';

type DocStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

interface DocumentVersion {
  id: string;
  versionNumber: number;
  driveFileId: string;
  description?: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface DocumentApproval {
  id: string;
  approvedBy: string;
  status: string;
  comment?: string;
  createdAt: string;
}

interface Document {
  id: string;
  organizationId: string;
  contactId?: string;
  title: string;
  description?: string;
  category?: string;
  status: DocStatus;
  driveFileId?: string;
  fileSize?: number;
  mimeType?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  versions?: DocumentVersion[];
  approvals?: DocumentApproval[];
}

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: '초안', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  SUBMITTED: { label: '승인대기', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  APPROVED: { label: '승인됨', color: 'text-green-600', bgColor: 'bg-green-100' },
  REJECTED: { label: '거절됨', color: 'text-red-600', bgColor: 'bg-red-100' },
  ARCHIVED: { label: '보관됨', color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

const CATEGORY_OPTIONS = ['계약', '영수증', '신원증명', '기타'];

export default function DocumentsApprovalPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<DocStatus | 'ALL'>('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [approvalComment, setApprovalComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 문서 목록 로드
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const query = filterStatus !== 'ALL' ? `?status=${filterStatus}` : '';
      const res = await fetch(`/api/documents/upload${query}`);
      const data = await res.json();

      if (data.ok) {
        setDocuments(data.data || []);
      } else {
        showError(data.message || '로드 실패');
      }
    } catch (err) {
      showError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // 문서 업로드
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;

    if (!file) {
      showError('파일을 선택하세요');
      return;
    }

    setSubmitting(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('title', formData.get('title') as string);
      uploadFormData.append('category', formData.get('category') as string);
      uploadFormData.append('description', formData.get('description') as string);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: uploadFormData,
      });
      const data = await res.json();

      if (data.ok) {
        showSuccess('문서가 업로드되었습니다');
        setShowUploadModal(false);
        e.currentTarget.reset();
        loadDocuments();
      } else {
        showError(data.message || '업로드 실패');
      }
    } catch (err) {
      showError('업로드 중 오류 발생');
    } finally {
      setSubmitting(false);
    }
  };

  // 문서 제출 (승인 요청)
  const handleSubmit = async (docId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/documents/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });
      const data = await res.json();

      if (data.ok) {
        showSuccess('승인 요청이 제출되었습니다');
        loadDocuments();
      } else {
        showError(data.message || '제출 실패');
      }
    } catch (err) {
      showError('제출 중 오류 발생');
    } finally {
      setSubmitting(false);
    }
  };

  // 문서 승인/거부
  const handleApproval = async (docId: string, action: 'approve' | 'reject') => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/documents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docId,
          action,
          comment: approvalComment,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        showSuccess(action === 'approve' ? '승인되었습니다' : '거부되었습니다');
        setApprovalComment('');
        setSelectedDoc(null);
        loadDocuments();
      } else {
        showError(data.message || '처리 실패');
      }
    } catch (err) {
      showError('처리 중 오류 발생');
    } finally {
      setSubmitting(false);
    }
  };

  // 문서 삭제
  const handleDelete = async (docId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.ok) {
        showSuccess('문서가 삭제되었습니다');
        loadDocuments();
      } else {
        showError(data.message || '삭제 실패');
      }
    } catch (err) {
      showError('삭제 중 오류 발생');
    }
  };

  // 필터링된 문서
  const filteredDocs = filterStatus === 'ALL'
    ? documents
    : documents.filter(d => d.status === filterStatus);

  const toggleExpand = (docId: string) => {
    const newSet = new Set(expandedDocs);
    if (newSet.has(docId)) {
      newSet.delete(docId);
    } else {
      newSet.add(docId);
    }
    setExpandedDocs(newSet);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">로드 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">문서 관리</h1>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            문서 업로드
          </button>
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map(
            status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'ALL' ? '전체' : STATUS_CONFIG[status]?.label || status}
              </button>
            )
          )}
        </div>
      </div>

      {/* 문서 목록 */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          문서가 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map(doc => {
            const isExpanded = expandedDocs.has(doc.id);
            const statusConfig = STATUS_CONFIG[doc.status];

            return (
              <div
                key={doc.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* 문서 헤더 */}
                <div className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(doc.id)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                      <p className="text-sm text-gray-500">
                        {doc.category} • {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* 확장 콘텐츠 */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-200 space-y-4">
                    {/* 기본 정보 */}
                    {doc.description && (
                      <div>
                        <p className="text-sm text-gray-500">설명</p>
                        <p className="text-sm text-gray-900">{doc.description}</p>
                      </div>
                    )}

                    {/* 버전 히스토리 */}
                    {doc.versions && doc.versions.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">버전 히스토리</p>
                        <div className="space-y-2">
                          {doc.versions.map(v => (
                            <div key={v.id} className="text-sm bg-gray-50 p-2 rounded">
                              <p className="font-medium">
                                v{v.versionNumber} • {new Date(v.uploadedAt).toLocaleDateString('ko-KR')}
                              </p>
                              {v.description && (
                                <p className="text-gray-600">{v.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 승인 이력 */}
                    {doc.approvals && doc.approvals.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">승인 이력</p>
                        <div className="space-y-2">
                          {doc.approvals.map(a => (
                            <div key={a.id} className="text-sm bg-gray-50 p-2 rounded">
                              <div className="flex items-center gap-2">
                                {a.status === 'APPROVED' ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : a.status === 'REJECTED' ? (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                ) : (
                                  <Clock className="w-4 h-4 text-yellow-600" />
                                )}
                                <span className="font-medium">{a.approvedBy}</span>
                                <span className="text-gray-500">
                                  {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                              {a.comment && (
                                <p className="text-gray-600 ml-6">{a.comment}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      {doc.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => handleSubmit(doc.id)}
                            disabled={submitting}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            제출
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {doc.status === 'SUBMITTED' && (
                        <>
                          <button
                            onClick={() => setSelectedDoc(doc)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            상세보기
                          </button>
                        </>
                      )}
                      {doc.driveFileId && (
                        <a
                          href={`https://drive.google.com/file/d/${doc.driveFileId}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Drive 보기
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">문서 업로드</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">제목</label>
                <input
                  name="title"
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="문서 제목"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">분류</label>
                <select
                  name="category"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">선택하세요</option>
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">설명</label>
                <textarea
                  name="description"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="문서 설명 (선택)"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">파일</label>
                <input
                  name="file"
                  type="file"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  업로드
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 상세보기 모달 (승인자용) */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold mb-4">문서 승인</h2>
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">제목</p>
                <p className="text-lg font-semibold">{selectedDoc.title}</p>
              </div>
              {selectedDoc.description && (
                <div>
                  <p className="text-sm text-gray-600">설명</p>
                  <p>{selectedDoc.description}</p>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium mb-2">승인 의견</label>
                <textarea
                  value={approvalComment}
                  onChange={e => setApprovalComment(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="승인 또는 거부 사유"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={() => handleApproval(selectedDoc.id, 'reject')}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  거부
                </button>
                <button
                  onClick={() => handleApproval(selectedDoc.id, 'approve')}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  승인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
