// components/admin/mall/FileGallery.tsx
// 업로드된 파일 갤러리 컴포넌트

'use client';

import { useState, useEffect } from 'react';
import { FiImage, FiVideo, FiX, FiRefreshCw, FiUpload, FiTrash2 } from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface FileItem {
  url: string;
  filename: string;
  size: number;
  type: 'image' | 'video';
  uploadedAt: number;
}

interface FileGalleryProps {
  type: 'image' | 'video' | 'all'; // 표시할 파일 타입
  onSelect: (url: string) => void; // 파일 선택 시 호출
  onClose: () => void; // 갤러리 닫기
  currentUrl?: string; // 현재 선택된 URL
}

export default function FileGallery({ type, onSelect, onClose, currentUrl }: FileGalleryProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(currentUrl);
  const [uploading, setUploading] = useState(false);

  // 파일 목록 불러오기
  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/mall/files?type=${type}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok && data.files) {
        // 중복 제거 (URL 기준)
        const files = data.files as FileItem[];
        const uniqueFiles: FileItem[] = Array.from(
          new Map(files.map((file: FileItem) => [file.url, file])).values()
        );
        setFiles(uniqueFiles);
      } else {
        showError(data.error || '파일 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      logger.error('파일 목록 불러오기 실패', { error });
      showError('파일 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type === 'all' ? (file.type.startsWith('image/') ? 'image' : 'video') : type);

      const response = await fetch('/api/admin/mall/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      if (data.ok && data.url) {
        // 새로 업로드된 파일을 목록에 추가
        await loadFiles();
        // 자동으로 선택
        setSelectedUrl(data.url);
        onSelect(data.url);
      } else {
        showError(data.error || '파일 업로드에 실패했습니다.');
      }
    } catch (error) {
      logger.error('파일 업로드 실패', { error });
      showError('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      // input 초기화
      e.target.value = '';
    }
  };

  // 파일 선택
  const handleSelect = (url: string) => {
    setSelectedUrl(url);
    onSelect(url);
  };

  // 파일 삭제
  const handleDelete = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 클릭 이벤트 전파 방지

    if (!confirm('이 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/mall/files?url=${encodeURIComponent(url)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.ok) {
        showSuccess('파일이 삭제되었습니다.');
        // 삭제된 파일이 선택된 파일이면 선택 해제
        if (selectedUrl === url) {
          setSelectedUrl(undefined);
        }
        // 목록 새로고침
        await loadFiles();
      } else {
        showError(data.error || '파일 삭제에 실패했습니다.');
      }
    } catch (error) {
      logger.error('파일 삭제 실패', { error });
      showError('파일 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {type === 'image' && <FiImage size={24} className="text-blue-600" />}
            {type === 'video' && <FiVideo size={24} className="text-purple-600" />}
            <h2 className="text-xl font-bold text-gray-800">
              {type === 'image' ? '이미지 불러오기' : type === 'video' ? '영상 불러오기' : '파일 불러오기'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <FiRefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <label className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <input
                type="file"
                accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*'}
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <FiUpload size={20} />
            </label>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* 파일 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">업로드된 파일이 없습니다.</p>
              <p className="text-sm">위의 업로드 버튼을 클릭하여 파일을 업로드하세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => (
                <div
                  key={file.url}
                  onClick={() => handleSelect(file.url)}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedUrl === file.url
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                  {file.type === 'image' ? (
                    <div className="aspect-square relative bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {selectedUrl === file.url && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-600 text-white rounded-full p-2">
                            <FiImage size={24} />
                          </div>
                        </div>
                      )}
                      {/* 삭제 버튼 - 항상 표시 */}
                      <button
                        onClick={(e) => handleDelete(file.url, e)}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors z-10 flex items-center justify-center"
                        title="삭제"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="aspect-square relative bg-gray-900 flex items-center justify-center">
                      <FiVideo size={48} className="text-white" />
                      {selectedUrl === file.url && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-600 text-white rounded-full p-2">
                            <FiVideo size={24} />
                          </div>
                        </div>
                      )}
                      {/* 삭제 버튼 - 항상 표시 */}
                      <button
                        onClick={(e) => handleDelete(file.url, e)}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors z-10 flex items-center justify-center"
                        title="삭제"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  )}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-2">압축된 이미지 미리보기:</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.url}
                      alt="Compressed preview"
                      className="w-full h-auto rounded-md"
                    />
                  </div>
                  <div className="p-2 bg-white">
                    <p className="text-xs font-semibold text-gray-800 truncate" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            총 {files.length}개의 파일
            {selectedUrl && (
              <span className="ml-2 text-blue-600 font-semibold">선택됨</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              닫기
            </button>
            {selectedUrl && (
              <button
                onClick={() => {
                  onSelect(selectedUrl);
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                선택하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



