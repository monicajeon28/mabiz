'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showError, showSuccess } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ContractSection {
  id: string;
  title: string;
  content: string;
}

interface ContractTemplate {
  title: string;
  sections: ContractSection[];
  price?: string;
  description?: string;
  icon?: string;
  isCustom?: boolean;
  updatedAt?: string;
}

interface Templates {
  [key: string]: ContractTemplate;
}

interface NewContractForm {
  typeCode: string;
  title: string;
  price: string;
  icon: string;
  description: string;
}

const DEFAULT_CONTRACT_TYPE_LABELS: Record<string, string> = {
  AFFILIATE: '📜 크루즈닷 어필리에이트 계약서 (공통)',
  BRANCH_MANAGER: '🏢 대리점장 계약서 (750만원)',
  SALES_AGENT: '👤 판매원 계약서 (330만원)',
  CRUISE_STAFF: '🚢 크루즈스탭 계약서 (540만원)',
};

const ICON_OPTIONS = ['📄', '📋', '📜', '📝', '🏢', '👤', '🚢', '💳', '🎯', '✨', '🌟', '💼', '🤝', '📊', '💰'];

export default function ContractTemplatesPage() {
  const router = useRouter();

  // GLOBAL_ADMIN 역할 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.ok || d.role !== 'GLOBAL_ADMIN') router.replace('/contracts');
      })
      .catch(() => router.replace('/contracts'));
  }, [router]);

  const [templates, setTemplates] = useState<Templates>({});
  const [contractTypes, setContractTypes] = useState<string[]>([]);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 새 계약서 추가 모달
  const [showNewModal, setShowNewModal] = useState(false);
  const [newContract, setNewContract] = useState<NewContractForm>({
    typeCode: '',
    title: '',
    price: '',
    icon: '📄',
    description: '',
  });

  // 삭제 확인 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // 복원 확인 모달
  const [showRestoreModal, setShowRestoreModal] = useState(false);


  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/contracts/templates');

      if (res.status === 401) {
        showError('관리자 로그인이 필요합니다.');
        return;
      }

      const data = await res.json();
      if (data.ok) {
        setTemplates(data.templates);
        setContractTypes(data.contractTypes);
        setCustomTypes(data.customTypes || []);
        if (data.contractTypes.length > 0 && !selectedType) {
          setSelectedType(data.contractTypes[0]);
          setEditingTemplate(JSON.parse(JSON.stringify(data.templates[data.contractTypes[0]])));
        }
      } else {
        showError(data.message || '템플릿을 불러오는데 실패했습니다.');
      }
    } catch {
      showError('템플릿을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setEditingTemplate(JSON.parse(JSON.stringify(templates[type])));
  };

  const handleTitleChange = (title: string) => {
    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, title });
    }
  };

  const handleSectionChange = (sectionId: string, field: 'title' | 'content', value: string) => {
    if (editingTemplate) {
      const updatedSections = editingTemplate.sections.map((section) =>
        section.id === sectionId ? { ...section, [field]: value } : section
      );
      setEditingTemplate({ ...editingTemplate, sections: updatedSections });
    }
  };

  const handleAddSection = () => {
    if (editingTemplate) {
      const newSection: ContractSection = {
        id: `section_${Date.now()}`,
        title: '새 섹션',
        content: '내용을 입력하세요.',
      };
      setEditingTemplate({
        ...editingTemplate,
        sections: [...editingTemplate.sections, newSection],
      });
    }
  };

  const handleRemoveSection = (sectionId: string) => {
    if (editingTemplate && editingTemplate.sections.length > 1) {
      const updatedSections = editingTemplate.sections.filter((s) => s.id !== sectionId);
      setEditingTemplate({ ...editingTemplate, sections: updatedSections });
    }
  };

  const handleMoveSection = (sectionId: string, direction: 'up' | 'down') => {
    if (!editingTemplate) return;
    const sections = [...editingTemplate.sections];
    const index = sections.findIndex((s) => s.id === sectionId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const temp = sections[index]!;
    sections[index] = sections[newIndex]!;
    sections[newIndex] = temp;
    setEditingTemplate({ ...editingTemplate, sections });
  };

  const handleSave = async () => {
    if (!editingTemplate || !selectedType) return;

    try {
      setSaving(true);
      const res = await fetch('/api/contracts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractType: selectedType,
          title: editingTemplate.title,
          sections: editingTemplate.sections,
          price: editingTemplate.price,
          description: editingTemplate.description,
          icon: editingTemplate.icon,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('계약서 템플릿이 저장되었습니다.');
        fetchTemplates();
      } else {
        showError(data.message || '저장에 실패했습니다.');
      }
    } catch {
      showError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!selectedType) return;
    const isCustom = customTypes.includes(selectedType);

    if (isCustom) {
      setDeleteTarget(selectedType);
      setShowDeleteModal(true);
      return;
    }

    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    setShowRestoreModal(false);
    try {
      setSaving(true);
      const res = await fetch('/api/contracts/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractType: selectedType }),
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('기본값으로 복원되었습니다.');
        fetchTemplates();
      } else {
        showError(data.message || '복원에 실패했습니다.');
      }
    } catch {
      showError('복원 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomContract = async () => {
    if (!deleteTarget) return;

    try {
      setSaving(true);
      const res = await fetch('/api/contracts/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractType: deleteTarget, permanent: true }),
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('커스텀 계약서가 삭제되었습니다.');
        setShowDeleteModal(false);
        setDeleteTarget(null);
        setSelectedType('');
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        showError(data.message || '삭제에 실패했습니다.');
      }
    } catch {
      showError('삭제 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewContract = async () => {
    if (!newContract.typeCode || !newContract.title) {
      showError('계약서 코드와 제목은 필수입니다.');
      return;
    }

    if (!/^[A-Z][A-Z0-9_]*$/.test(newContract.typeCode)) {
      showError('계약서 코드는 영문 대문자와 언더스코어만 사용 가능합니다. (예: NEW_CONTRACT)');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/contracts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractType: newContract.typeCode,
          title: newContract.title,
          price: newContract.price,
          icon: newContract.icon,
          description: newContract.description,
          isNew: true,
          sections: [
            {
              id: 'intro',
              title: '계약 안내',
              content: '본 계약서의 내용을 입력해주세요.',
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('새 계약서가 추가되었습니다.');
        setShowNewModal(false);
        setNewContract({ typeCode: '', title: '', price: '', icon: '📄', description: '' });
        await fetchTemplates();
        setSelectedType(data.contractType);
      } else {
        showError(data.message || '추가에 실패했습니다.');
      }
    } catch {
      showError('추가 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getContractLabel = useCallback((type: string) => {
    if (DEFAULT_CONTRACT_TYPE_LABELS[type]) {
      return DEFAULT_CONTRACT_TYPE_LABELS[type];
    }
    const template = templates[type];
    if (template) {
      const icon = template.icon || '📄';
      const price = template.price ? ` (${template.price})` : '';
      return `${icon} ${template.title}${price}`;
    }
    return type;
  }, [templates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Header */}
          <div className="px-4 lg:px-6 py-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">📜 계약서 템플릿 관리</h1>
              <p className="mt-1 text-sm text-gray-500">
                계약서별로 텍스트를 수정하면 실제 계약서 페이지에 바로 적용됩니다.
              </p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg hover:from-slate-800 hover:to-slate-700 transition-all shadow-md flex items-center gap-2 justify-center"
            >
              <span className="text-xl">➕</span>
              <span className="font-semibold">새 계약서 추가</span>
            </button>
          </div>

          {/* Contract Type Grid */}
          <div className="px-4 lg:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">계약서 목록 ({contractTypes.length}개)</h3>
              {customTypes.length > 0 && (
                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                  커스텀 {customTypes.length}개 포함
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {contractTypes.map((type) => {
                const isCustom = customTypes.includes(type);
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left relative group ${
                      isSelected
                        ? isCustom
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-blue-600 text-white shadow-md'
                        : isCustom
                        ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block truncate">{getContractLabel(type)}</span>
                    {isCustom && !isSelected && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor */}
          {editingTemplate && (
            <div className="p-4 lg:p-6 space-y-6">
              {/* Title & Meta */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">계약서 제목</label>
                  <input
                    type="text"
                    value={editingTemplate.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {customTypes.includes(selectedType) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">가격 표시</label>
                    <input
                      type="text"
                      value={editingTemplate.price || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, price: e.target.value })}
                      placeholder="예: 500만원"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Sections */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    섹션 목록 ({editingTemplate.sections.length}개)
                  </h3>
                  <button
                    onClick={handleAddSection}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                  >
                    <span>+</span> 섹션 추가
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {editingTemplate.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                            섹션 {index + 1}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMoveSection(section.id, 'up')}
                              disabled={index === 0}
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                              title="위로 이동"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleMoveSection(section.id, 'down')}
                              disabled={index === editingTemplate.sections.length - 1}
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                              title="아래로 이동"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                        {editingTemplate.sections.length > 1 && (
                          <button
                            onClick={() => handleRemoveSection(section.id)}
                            className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                          >
                            🗑️ 삭제
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">섹션 제목</label>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => handleSectionChange(section.id, 'title', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            섹션 내용
                          </label>
                          <textarea
                            value={section.content}
                            onChange={(e) => handleSectionChange(section.id, 'content', e.target.value)}
                            rows={10}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            글자 수: {section.content.length.toLocaleString()}자
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={handleReset}
                  disabled={saving}
                  className={`w-full sm:w-auto px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    customTypes.includes(selectedType)
                      ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {customTypes.includes(selectedType) ? (
                    <>🗑️ 이 계약서 삭제</>
                  ) : (
                    <>↩️ 기본값으로 복원</>
                  )}
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                >
                  {saving && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  💾 저장하기
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {editingTemplate && (
            <div className="p-4 lg:p-6 border-t border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                📋 미리보기
                <span className="text-xs text-gray-500 font-normal">(실제 계약서 페이지에 표시될 모습)</span>
              </h3>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm max-h-96 overflow-y-auto">
                <h2 className="text-xl font-bold text-center mb-6 text-gray-900">{editingTemplate.title}</h2>
                <div className="space-y-6">
                  {editingTemplate.sections.map((section) => (
                    <div key={section.id}>
                      <h4 className="font-semibold text-gray-900 mb-2">{section.title}</h4>
                      <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{section.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 새 계약서 추가 모달 */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">➕ 새 계약서 추가</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계약서 코드 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newContract.typeCode}
                  onChange={(e) => setNewContract({ ...newContract, typeCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                  placeholder="예: VIP_PARTNER"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">영문 대문자와 언더스코어만 사용 (시스템 식별용)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계약서 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newContract.title}
                  onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
                  placeholder="예: VIP 파트너 계약서"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">아이콘</label>
                  <div className="flex flex-wrap gap-1">
                    {ICON_OPTIONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewContract({ ...newContract, icon })}
                        className={`p-2 text-xl rounded-lg transition-all ${
                          newContract.icon === icon
                            ? 'bg-purple-100 ring-2 ring-purple-500'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">가격 표시</label>
                  <input
                    type="text"
                    value={newContract.price}
                    onChange={(e) => setNewContract({ ...newContract, price: e.target.value })}
                    placeholder="예: 1000만원"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                <textarea
                  value={newContract.description}
                  onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
                  placeholder="이 계약서에 대한 간단한 설명"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* 미리보기 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">버튼 미리보기:</p>
                <div className="inline-block px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium">
                  {newContract.icon || '📄'} {newContract.title || '계약서 제목'} {newContract.price && `(${newContract.price})`}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateNewContract}
                disabled={saving || !newContract.typeCode || !newContract.title}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 계약서 삭제 확인 모달 */}
      <ConfirmDialog
        open={showDeleteModal}
        title="계약서 삭제"
        message={`"${getContractLabel(deleteTarget || '')}" 계약서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제하기"
        variant="danger"
        onConfirm={() => {
          setShowDeleteModal(false);
          handleDeleteCustomContract();
        }}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
      />

      {/* 기본값 복원 확인 모달 */}
      <ConfirmDialog
        open={showRestoreModal}
        title="기본값 복원"
        message="정말 기본값으로 복원하시겠습니까? 수정한 내용이 모두 삭제됩니다."
        confirmLabel="복원하기"
        variant="danger"
        onConfirm={handleRestoreConfirm}
        onCancel={() => setShowRestoreModal(false)}
      />
    </>
  );
}
