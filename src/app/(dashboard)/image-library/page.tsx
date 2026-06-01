'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CloudUploadIcon,
  SearchIcon,
  FilterIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  Check,
} from 'lucide-react';
import { formatFileSize } from '@/lib/image-metadata';

interface ImageAsset {
  id: string;
  fileName: string;
  driveFileId: string;
  category: string;
  tags: string[];
  mimeType: string;
  fileSize?: string;
  width?: number;
  height?: number;
  uploadedAt: string;
  lastAccessedAt?: string;
  thumbnailUrl: string;
  driveUrl: string;
  webpDriveFileId?: string;
  processingStatus: string; // PENDING | DONE | FAILED
  processedAt?: string;
}

const CATEGORIES = ['배너', '상품', '로고', '기타'];

export default function ImageLibraryPage() {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 필터 & 검색
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // UI 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 권한 체크는 layout에서 처리 (GLOBAL_ADMIN만 접근 가능)
  const isAdmin = true;

  /**
   * 이미지 목록 조회
   */
  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();

      if (search) params.append('search', search);
      if (selectedCategory) params.append('category', selectedCategory);
      selectedTags.forEach((tag) => params.append('tags', tag));
      params.append('offset', offset.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/image-library?${params}`, {
        method: 'GET',
      });

      const json = await res.json();
      if (json.ok && json.data) {
        setAssets(json.data.assets ?? []);
        setTotal(json.data.total ?? 0);
      } else if (!res.ok) {
        console.error('Failed to fetch assets: HTTP', res.status, json.message ?? '');
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategory, selectedTags, offset, limit]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  /**
   * 파일 업로드 처리
   */
  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];

      // 파일 검증
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다');
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        alert('파일 크기는 100MB 이하여야 합니다');
        return;
      }

      try {
        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', selectedCategory || 'Other');
        formData.append('tags', selectedTags.join(','));

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        await new Promise((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              resolve(xhr.response);
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Upload error')));

          xhr.open('POST', '/api/image-library');
          xhr.send(formData);
        });

        // 업로드 성공 후 목록 새로고침
        await fetchAssets();
        setUploadProgress(0);
      } catch (err) {
        console.error('Upload failed:', err);
        alert('업로드 중 오류가 발생했습니다');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [selectedCategory, selectedTags, fetchAssets]
  );

  /**
   * 드래그앤드롭
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = () => {
    dropZoneRef.current?.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('border-blue-500', 'bg-blue-50');
    handleUpload(e.dataTransfer.files);
  };

  /**
   * 이미지 선택/해제 토글
   */
  const toggleAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  /**
   * 전체 선택/해제
   */
  const toggleSelectAll = () => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map((a) => a.id)));
    }
  };

  /**
   * Drive 링크 복사
   */
  const copyLink = (url: string, assetId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(assetId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /**
   * Drive 폴더 동기화
   */
  const handleSync = async () => {
    if (!selectedCategory) {
      alert('카테고리를 선택해주세요');
      return;
    }

    try {
      setIsSyncing(true);
      const res = await fetch('/api/images/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory }),
      });

      const json = await res.json();
      if (json.ok) {
        setLastSyncTime(new Date().toLocaleString('ko-KR'));
        await fetchAssets();
        alert(`${json.data.syncedCount}개의 이미지가 동기화되었습니다`);
      } else {
        alert('동기화 실패: ' + (json.message || '알 수 없는 오류'));
      }
    } catch (err) {
      console.error('Sync failed:', err);
      alert('동기화 중 오류가 발생했습니다');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">이미지 라이브러리</h1>
          <p className="text-gray-600 mt-2">Google Drive와 통합된 이미지 자산 관리</p>
        </div>

        {/* 업로드 영역 */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 transition"
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUploadIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-900 mb-2">
              이미지를 여기에 드래그하거나 클릭하여 선택
            </p>
            <p className="text-gray-600">
              JPEG, PNG, GIF, WebP, SVG (최대 100MB)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={isUploading}
            />
          </div>

          {isUploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">업로드 중...</span>
                <span className="text-sm font-semibold text-gray-700">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* 카테고리 & 태그 선택 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setOffset(0);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                태그 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={selectedTags.join(', ')}
                onChange={(e) =>
                  setSelectedTags(
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setOffset(0);
                  }
                }}
                placeholder="태그1, 태그2, ..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={handleSync}
              disabled={isSyncing || !selectedCategory}
              className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-400 flex items-center gap-2"
            >
              <RefreshCwIcon className="w-4 h-4" />
              {isSyncing ? '동기화 중...' : 'Drive 폴더 동기화'}
            </button>
          )}

          {lastSyncTime && (
            <p className="text-sm text-gray-600 mt-2">
              마지막 동기화: {lastSyncTime}
            </p>
          )}
        </div>

        {/* 검색 & 필터 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-3 w-5 h-5 text-gray-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
                placeholder="파일명으로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <FilterIcon className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        {/* 이미지 갤러리 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin">
                <RefreshCwIcon className="w-8 h-8 text-blue-500" />
              </div>
              <p className="mt-4 text-gray-600">이미지를 로드 중입니다...</p>
            </div>
          ) : assets.length > 0 ? (
            <>
              {/* 선택 UI */}
              {assets.length > 0 && (
                <div className="mb-6 flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      ref={(el) => {
                        if (el) el.indeterminate = selectedAssets.size > 0 && selectedAssets.size < assets.length;
                      }}
                      checked={selectedAssets.size === assets.length && assets.length > 0}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {selectedAssets.size > 0 ? (
                        <>
                          <span className="text-blue-600 font-semibold">{selectedAssets.size}개</span> 선택됨
                        </>
                      ) : (
                        '선택 없음'
                      )}
                    </span>
                  </div>
                  {selectedAssets.size > 0 && (
                    <button
                      onClick={() => setSelectedAssets(new Set())}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      선택 해제
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {assets.map((asset) => {
                  const isSelected = selectedAssets.has(asset.id);
                  return (
                  <div
                    key={asset.id}
                    className={`border rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleAssetSelection(asset.id)}
                  >
                    {/* 썸네일 + 체크박스 */}
                    <div className="bg-gray-100 h-48 flex items-center justify-center overflow-hidden relative">
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.fileName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23999"%3EImage%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      {/* 체크박스 오버레이 */}
                      <div className="absolute top-3 right-3">
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-white border-gray-400 hover:border-blue-400'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>

                    {/* 정보 */}
                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-gray-900 truncate mb-2">
                        {asset.fileName}
                      </h3>

                      <div className="flex items-center gap-2 mb-2">
                        {asset.category && (
                          <span className="inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-2 py-1 rounded">
                            {asset.category}
                          </span>
                        )}
                        {asset.processingStatus === 'PENDING' && (
                          <span className="inline-block bg-yellow-100 text-yellow-800 text-sm font-semibold px-2 py-1 rounded">
                            처리중
                          </span>
                        )}
                        {asset.processingStatus === 'DONE' && asset.webpDriveFileId && (
                          <span className="inline-block bg-green-100 text-green-800 text-sm font-semibold px-2 py-1 rounded">
                            WM완료
                          </span>
                        )}
                        {asset.processingStatus === 'FAILED' && (
                          <span className="inline-block bg-red-100 text-red-800 text-sm font-semibold px-2 py-1 rounded">
                            처리실패
                          </span>
                        )}
                      </div>

                      {asset.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {asset.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="bg-gray-200 text-gray-700 text-sm px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {asset.tags.length > 2 && (
                            <span className="text-sm text-gray-600">
                              +{asset.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-gray-600 mb-3">
                        {asset.fileSize && formatFileSize(Number(asset.fileSize))}
                        {asset.width && ` • ${asset.width}x${asset.height}`}
                      </p>

                      {/* 버튼 */}
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(asset.driveUrl, asset.id);
                          }}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded font-medium hover:bg-blue-600 flex items-center justify-center gap-1"
                        >
                          {copiedId === asset.id ? (
                            <>
                              <CheckIcon className="w-4 h-4" />
                              복사됨
                            </>
                          ) : (
                            <>
                              <CopyIcon className="w-4 h-4" />
                              복사
                            </>
                          )}
                        </button>
                        <a
                          href={`/api/images/${asset.id}/download`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-2 bg-gray-500 text-white text-sm rounded font-medium hover:bg-gray-600 flex items-center gap-1"
                          title="원본 다운로드"
                        >
                          <DownloadIcon className="w-4 h-4" />
                        </a>
                        {asset.webpDriveFileId && (
                          <a
                            href={`https://drive.google.com/file/d/${asset.webpDriveFileId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-2 bg-green-500 text-white text-sm rounded font-medium hover:bg-green-600 flex items-center gap-1"
                            title="워터마크 WebP 보기"
                          >
                            WM
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between border-t pt-6">
                <p className="text-sm text-gray-600">
                  전체 {total}개 중 {offset + 1}-{Math.min(offset + limit, total)}개 표시
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">이미지가 없습니다</p>
              <p className="text-sm text-gray-500 mt-2">
                위의 업로드 영역에서 이미지를 추가해보세요
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
