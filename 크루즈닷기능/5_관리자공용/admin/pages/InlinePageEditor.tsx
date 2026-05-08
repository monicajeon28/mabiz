// components/admin/pages/InlinePageEditor.tsx
// 인라인 편집 가능한 페이지 뷰어

'use client';

import { useState, useEffect, useRef } from 'react';
import { FiEdit, FiSave, FiX, FiImage, FiSmile, FiType } from 'react-icons/fi';
import EmojiPicker from './EmojiPicker';

interface PageContent {
  id: number;
  pagePath: string;
  section: string;
  itemId: string | null;
  contentType: string;
  content: any;
  order: number;
  isActive: boolean;
}

interface InlinePageEditorProps {
  pagePath: string;
  contents: PageContent[];
  onSave: (id: number, data: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAdd: (section: string, contentType: string) => Promise<void>;
}

export default function InlinePageEditor({
  pagePath,
  contents,
  onSave,
  onDelete,
  onAdd,
}: InlinePageEditorProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const startEdit = (content: PageContent) => {
    setEditingId(content.id);
    setEditData({
      contentType: content.contentType,
      content: { ...content.content },
      order: content.order,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
    setShowEmojiPicker(null);
  };

  const handleSave = async () => {
    if (!editingId) return;
    await onSave(editingId, editData);
    cancelEdit();
  };

  const renderEditableContent = (content: PageContent) => {
    const isEditing = editingId === content.id;
    const isHovered = hoveredId === content.id;

    if (isEditing) {
      return renderEditor(content);
    }

    return (
      <div
        className="relative group"
        onMouseEnter={() => setHoveredId(content.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        {renderPreview(content)}
        {isHovered && (
          <div className="absolute top-0 right-0 flex gap-1 bg-white border border-gray-300 rounded shadow-lg p-1 z-10">
            <button
              onClick={() => startEdit(content)}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
              title="편집"
            >
              <FiEdit size={16} />
            </button>
            <button
              onClick={() => {
                if (confirm('정말 삭제하시겠습니까?')) {
                  onDelete(content.id);
                }
              }}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="삭제"
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPreview = (content: PageContent) => {
    const c = content.content;

    switch (content.contentType) {
      case 'text':
        return (
          <div className="p-2 border-2 border-dashed border-transparent group-hover:border-blue-300 rounded cursor-pointer">
            <p className="text-gray-700">{c.text || '(텍스트 없음)'}</p>
          </div>
        );
      case 'emoji':
        return (
          <div className="p-2 border-2 border-dashed border-transparent group-hover:border-blue-300 rounded cursor-pointer inline-block">
            <span className="text-4xl">{c.emoji || '✨'}</span>
          </div>
        );
      case 'image':
        return (
          <div className="p-2 border-2 border-dashed border-transparent group-hover:border-blue-300 rounded cursor-pointer inline-block">
            {c.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={c.image} alt="Content" className="max-w-xs rounded-lg" />
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                이미지 없음
              </div>
            )}
          </div>
        );
      case 'button':
        return (
          <div className="p-2 border-2 border-dashed border-transparent group-hover:border-blue-300 rounded cursor-pointer inline-block">
            <a
              href={c.link || '#'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg inline-block"
              onClick={(e) => {
                e.preventDefault();
                startEdit(content);
              }}
            >
              {c.title || '버튼'}
            </a>
          </div>
        );
      case 'link':
        return (
          <div className="p-2 border-2 border-dashed border-transparent group-hover:border-blue-300 rounded cursor-pointer inline-block">
            <a
              href={c.link || '#'}
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                startEdit(content);
              }}
            >
              {c.text || '링크'}
            </a>
          </div>
        );
      case 'list':
        return (
          <div className="p-2 border-2 border-dashed border-transparent group-hover:border-blue-300 rounded cursor-pointer">
            <ul className="list-disc list-inside space-y-1">
              {Array.isArray(c.items) && c.items.length > 0 ? (
                c.items.map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))
              ) : (
                <li className="text-gray-400">(리스트 없음)</li>
              )}
            </ul>
          </div>
        );
      default:
        return <div className="p-2 text-gray-400">알 수 없는 타입</div>;
    }
  };

  const renderEditor = (content: PageContent) => {
    return (
      <div className="p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            편집 중: {content.contentType}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
            >
              <FiSave size={14} /> 저장
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 flex items-center gap-1 text-sm"
            >
              <FiX size={14} /> 취소
            </button>
          </div>
        </div>

        {/* 콘텐츠 타입 선택 */}
        <div>
          <label className="block text-sm font-semibold mb-1">콘텐츠 타입</label>
          <select
            value={editData.contentType}
            onChange={(e) => {
              const newType = e.target.value;
              const defaultContent: any = {
                text: { text: '' },
                emoji: { emoji: '✨' },
                image: { image: '' },
                button: { title: '', link: '#' },
                link: { text: '', link: '#' },
                list: { items: [] },
              };
              setEditData({
                ...editData,
                contentType: newType,
                content: defaultContent[newType] || {},
              });
            }}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="text">텍스트</option>
            <option value="emoji">이모티콘</option>
            <option value="image">이미지</option>
            <option value="button">버튼</option>
            <option value="link">링크</option>
            <option value="list">리스트</option>
          </select>
        </div>

        {/* 텍스트 편집 */}
        {editData.contentType === 'text' && (
          <div>
            <label className="block text-sm font-semibold mb-1">텍스트</label>
            <textarea
              value={editData.content.text || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  content: { ...editData.content, text: e.target.value },
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
            />
          </div>
        )}

        {/* 이모티콘 편집 */}
        {editData.contentType === 'emoji' && (
          <div className="relative">
            <label className="block text-sm font-semibold mb-1">이모티콘</label>
            <div className="flex items-center gap-2">
              <div className="text-4xl p-2 border rounded-lg bg-white">
                {editData.content.emoji || '✨'}
              </div>
              <button
                onClick={() => setShowEmojiPicker(showEmojiPicker === content.id ? null : content.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <FiSmile /> 이모티콘 선택 (100개 추천)
              </button>
              <input
                type="text"
                value={editData.content.emoji || ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    content: { ...editData.content, emoji: e.target.value },
                  })
                }
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder="이모티콘 직접 입력"
              />
            </div>
            {showEmojiPicker === content.id && (
              <EmojiPicker
                value={editData.content.emoji || ''}
                onChange={(emoji) => {
                  setEditData({
                    ...editData,
                    content: { ...editData.content, emoji },
                  });
                  setShowEmojiPicker(null);
                }}
                onClose={() => setShowEmojiPicker(null)}
              />
            )}
          </div>
        )}

        {/* 이미지 편집 */}
        {editData.contentType === 'image' && (
          <div>
            <label className="block text-sm font-semibold mb-1">이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                  const formData = new FormData();
                  formData.append('file', file);

                  const res = await fetch('/api/admin/pages/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                  });

                  const data = await res.json();
                  if (data.ok) {
                    setEditData({
                      ...editData,
                      content: { ...editData.content, image: data.url },
                    });
                  } else {
                    alert('업로드 실패: ' + data.error);
                  }
                } catch (error) {
                  console.error('Upload error:', error);
                  alert('업로드 중 오류가 발생했습니다.');
                }
              }}
              className="w-full px-3 py-2 border rounded-lg mb-2"
            />
            <input
              type="text"
              value={editData.content.image || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  content: { ...editData.content, image: e.target.value },
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="또는 이미지 URL 직접 입력"
            />
            {editData.content.image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={editData.content.image}
                alt="Preview"
                className="mt-2 max-w-xs rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        )}

        {/* 버튼 편집 */}
        {editData.contentType === 'button' && (
          <>
            <div>
              <label className="block text-sm font-semibold mb-1">버튼 텍스트</label>
              <input
                type="text"
                value={editData.content.title || ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    content: { ...editData.content, title: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">링크 URL</label>
              <input
                type="text"
                value={editData.content.link || ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    content: { ...editData.content, link: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </>
        )}

        {/* 링크 편집 */}
        {editData.contentType === 'link' && (
          <>
            <div>
              <label className="block text-sm font-semibold mb-1">링크 텍스트</label>
              <input
                type="text"
                value={editData.content.text || ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    content: { ...editData.content, text: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">링크 URL</label>
              <input
                type="text"
                value={editData.content.link || ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    content: { ...editData.content, link: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </>
        )}

        {/* 리스트 편집 */}
        {editData.contentType === 'list' && (
          <div>
            <label className="block text-sm font-semibold mb-1">
              리스트 항목 (줄바꿈으로 구분)
            </label>
            <textarea
              value={
                Array.isArray(editData.content.items)
                  ? editData.content.items.join('\n')
                  : ''
              }
              onChange={(e) =>
                setEditData({
                  ...editData,
                  content: {
                    ...editData.content,
                    items: e.target.value.split('\n').filter((i: string) => i.trim()),
                  },
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
              rows={6}
            />
          </div>
        )}
      </div>
    );
  };

  const groupedContents = contents.reduce((acc: any, content) => {
    if (!acc[content.section]) {
      acc[content.section] = [];
    }
    acc[content.section].push(content);
    return acc;
  }, {});

  // 기본 섹션들 (콘텐츠가 없어도 표시)
  const defaultSections = ['header', 'services', 'notices', 'faqs', 'events', 'highlight'];
  const allSections = new Set([...Object.keys(groupedContents), ...defaultSections]);

  return (
    <div className="space-y-6">
      {contents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500 mb-4 text-center">아직 콘텐츠가 없습니다.</p>
          <p className="text-sm text-gray-400 text-center mb-6">
            아래에서 섹션을 선택하여 콘텐츠를 추가하세요.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {defaultSections.map((section) => (
              <div key={section} className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
                <h4 className="font-semibold text-gray-700 mb-2">{section}</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onAdd(section, 'text')}
                    className="px-2 py-1 text-xs bg-white hover:bg-gray-100 rounded border flex items-center gap-1"
                  >
                    <FiType /> 텍스트
                  </button>
                  <button
                    onClick={() => onAdd(section, 'emoji')}
                    className="px-2 py-1 text-xs bg-white hover:bg-gray-100 rounded border flex items-center gap-1"
                  >
                    <FiSmile /> 이모티콘
                  </button>
                  <button
                    onClick={() => onAdd(section, 'image')}
                    className="px-2 py-1 text-xs bg-white hover:bg-gray-100 rounded border flex items-center gap-1"
                  >
                    <FiImage /> 이미지
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        Array.from(allSections).map((section) => {
          const sectionContents = groupedContents[section] || [];
          return (
            <div key={section} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">섹션: {section}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAdd(section, 'text')}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                    title="텍스트 추가"
                  >
                    <FiType /> 텍스트
                  </button>
                  <button
                    onClick={() => onAdd(section, 'emoji')}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                    title="이모티콘 추가"
                  >
                    <FiSmile /> 이모티콘
                  </button>
                  <button
                    onClick={() => onAdd(section, 'image')}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                    title="이미지 추가"
                  >
                    <FiImage /> 이미지
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {sectionContents.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-400">
                    <p className="text-sm mb-2">이 섹션에 콘텐츠가 없습니다.</p>
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onAdd(section, 'text')}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        텍스트 추가
                      </button>
                      <button
                        onClick={() => onAdd(section, 'emoji')}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        이모티콘 추가
                      </button>
                      <button
                        onClick={() => onAdd(section, 'image')}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        이미지 추가
                      </button>
                    </div>
                  </div>
                ) : (
                  sectionContents
                    .sort((a: PageContent, b: PageContent) => a.order - b.order)
                    .map((content: PageContent) => (
                      <div key={content.id}>{renderEditableContent(content)}</div>
                    ))
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

