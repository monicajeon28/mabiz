'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CloudUploadIcon,
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  PlusIcon,
} from 'lucide-react';

interface ImageAsset {
  id: string;
  title: string;       // 파일명 (API: title)
  driveFileId?: string;
  folder: string;      // 카테고리 (API: folder)
  tags: string[];
  isGif?: boolean;
  source: 'asset' | 'cache';
  thumbnailUrl: string;
  fullUrl: string;     // 공개 URL (API: fullUrl)
}

interface GoogleDriveImage {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailUrl: string;
  downloadUrl: string;
  publicUrl: string;
  category: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;       // API: name
  imageCount: number; // API: imageCount
}

const CATEGORIES = ['배너', '상품', '로고', '기타'];
const GOOGLE_DRIVE_LIMIT = 20;
const UPLOAD_CATEGORIES = ['후기', '크루즈 정보사진', '상품', '배너', '로고', '기타'];

export default function ImageLibraryPage() {
  const [activeTab, setActiveTab] = useState<'local' | 'drive'>('local');

  // 로컬 이미지 상태
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // 업로드 모달 상태
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [uploadCategory, setUploadCategory] = useState('기타');

  // Google Drive 상태
  const [gdFolders, setGdFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedGdFolder, setSelectedGdFolder] = useState<string>('');
  const [gdImages, setGdImages] = useState<GoogleDriveImage[]>([]);
  const [gdPage, setGdPage] = useState(1);
  const [gdPagination, setGdPagination] = useState({ totalPages: 0, total: 0 });
  const [gdLoading, setGdLoading] = useState(false);

  // 폴더 추가 상태
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDriveId, setNewFolderDriveId] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);

  // UI 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [selectedGdAssets, setSelectedGdAssets] = useState<Set<string>>(new Set());
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 로컬 이미지 함수들
  // ═══════════════════════════════════════════════════════════════════════════════

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (selectedCategory) params.append('folder', selectedCategory);
      selectedTags.forEach((tag) => params.append('tags', tag));
      params.append('offset', offset.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/image-library?${params}`, { method: 'GET' });
      const json = await res.json();
      if (json.ok) {
        const imgs = json.images ?? json.data?.assets ?? [];
        setAssets(imgs);
        setTotal(json.total ?? json.data?.total ?? imgs.length);
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategory, selectedTags, offset, limit]);

  useEffect(() => {
    if (activeTab === 'local') {
      fetchAssets();
    }
  }, [fetchAssets, activeTab]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Google Drive 함수들
  // ═══════════════════════════════════════════════════════════════════════════════

  const fetchGdFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/image-library/google-drive?folders=true', { method: 'GET' });
      const json = await res.json();
      if (json.ok && json.folders) {
        setGdFolders(json.folders);
        if (json.folders.length > 0 && !selectedGdFolder) {
          setSelectedGdFolder(json.folders[0].id);
        }
      }
    } catch {
      // silent
    }
  }, [selectedGdFolder]);

  const fetchGdImages = useCallback(async () => {
    if (!selectedGdFolder) return;

    try {
      setGdLoading(true);
      const params = new URLSearchParams({
        folderId: selectedGdFolder,
        page: gdPage.toString(),
        limit: GOOGLE_DRIVE_LIMIT.toString(),
      });

      const res = await fetch(`/api/image-library/google-drive?${params}`, { method: 'GET' });
      const json = await res.json();
      if (json.ok && json.images) {
        setGdImages(json.images);
        setGdPagination(json.pagination || { totalPages: 1, total: json.images.length });
      }
    } catch {
      // silent
    } finally {
      setGdLoading(false);
    }
  }, [selectedGdFolder, gdPage]);

  useEffect(() => {
    if (activeTab === 'drive') {
      if (gdFolders.length === 0) {
        fetchGdFolders();
      } else {
        fetchGdImages();
      }
    }
  }, [activeTab, selectedGdFolder, gdPage, gdFolders.length, fetchGdFolders, fetchGdImages]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 선택 관련
  // ═══════════════════════════════════════════════════════════════════════════════

  const toggleAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const toggleGdAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedGdAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedGdAssets(newSelected);
  };

  const toggleSelectAllLocal = () => {
    if (selectedAssets.size === assets.length && selectedAssets.size > 0) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map((a) => a.id)));
    }
  };

  const toggleSelectAllGd = () => {
    if (selectedGdAssets.size === gdImages.length && selectedGdAssets.size > 0) {
      setSelectedGdAssets(new Set());
    } else {
      setSelectedGdAssets(new Set(gdImages.map((a) => a.id)));
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // 다운로드/복사
  // ═══════════════════════════════════════════════════════════════════════════════

  const downloadLocalAsset = (asset: ImageAsset) => {
    if (!asset.driveFileId) return;
    const url = `/api/image-library/download?id=${asset.driveFileId}&name=${encodeURIComponent(asset.title)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = asset.title.replace(/\.[^.]+$/, '') + '_watermark.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadGdAsset = (image: GoogleDriveImage) => {
    const url = `/api/image-library/download?id=${image.id}&name=${encodeURIComponent(image.name)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = image.name.replace(/\.[^.]+$/, '') + '_watermark.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadSelected = (type: 'local' | 'drive') => {
    const selected = type === 'local' ? selectedAssets : selectedGdAssets;
    if (selected.size === 0) return;

    if (type === 'local') {
      Array.from(selected).forEach((id) => {
        const asset = assets.find((a) => a.id === id);
        if (asset) downloadLocalAsset(asset);
      });
    } else {
      Array.from(selected).forEach((id) => {
        const image = gdImages.find((i) => i.id === id);
        if (image) downloadGdAsset(image);
      });
    }
  };

  const copyLocalImgSrc = (asset: ImageAsset) => {
    const imgSrc = `<img src="${asset.fullUrl}" alt="${asset.title}" />`;
    navigator.clipboard.writeText(imgSrc).then(() => {
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const copyGdImgSrc = (image: GoogleDriveImage) => {
    const imgSrc = `<img src="${image.publicUrl ?? image.downloadUrl}" alt="${image.name}" />`;
    navigator.clipboard.writeText(imgSrc).then(() => {
      setCopiedId(image.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const copyAllImgSrc = (type: 'local' | 'drive') => {
    const selected = type === 'local' ? selectedAssets : selectedGdAssets;
    if (selected.size === 0) return;

    let html = '';
    if (type === 'local') {
      Array.from(selected).forEach((id) => {
        const asset = assets.find((a) => a.id === id);
        if (asset) {
          html += `<img src="${asset.fullUrl}" alt="${asset.title}" />\n`;
        }
      });
    } else {
      Array.from(selected).forEach((id) => {
        const image = gdImages.find((i) => i.id === id);
        if (image) {
          html += `<img src="${image.publicUrl ?? image.downloadUrl}" alt="${image.name}" />\n`;
        }
      });
    }

    navigator.clipboard.writeText(html.trim()).then(() => {
      alert(`${selected.size}개 이미지 HTML이 복사되었습니다`);
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // 업로드 함수들
  // ═══════════════════════════════════════════════════════════════════════════════

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      alert('파일 크기는 100MB 이하여야 합니다');
      return;
    }
    setPendingFiles(files);
    setShowUploadModal(true);
  }

  function doUpload(files: FileList, category: string) {
    const file = files[0];

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', category);
    formData.append('tags', selectedTags.join(','));

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        fetchAssets();
        setUploadProgress(0);
      } else {
        alert('업로드 실패');
      }
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    });

    xhr.addEventListener('error', () => {
      alert('업로드 중 오류가 발생했습니다');
      setIsUploading(false);
    });

    xhr.open('POST', '/api/image-library');
    xhr.send(formData);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    dropZoneRef.current?.classList.add('border-blue-500', 'bg-blue-50');
  }

  function handleDragLeave() {
    dropZoneRef.current?.classList.remove('border-blue-500', 'bg-blue-50');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('border-blue-500', 'bg-blue-50');
    handleUpload(e.dataTransfer.files);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 폴더 추가
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleAddFolder = async () => {
    if (!newFolderName.trim() || !newFolderDriveId.trim()) {
      alert('폴더 이름과 Drive 폴더 ID를 모두 입력하세요');
      return;
    }
    try {
      setAddingFolder(true);
      const res = await fetch('/api/image-library/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_folder',
          name: newFolderName.trim(),
          driveId: newFolderDriveId.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewFolderName('');
        setNewFolderDriveId('');
        setShowAddFolder(false);
        fetchGdFolders();
      } else {
        alert(json.error ?? '폴더 추가에 실패했습니다');
      }
    } catch {
      alert('폴더 추가 중 오류가 발생했습니다');
    } finally {
      setAddingFolder(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // 렌더링
  // ═══════════════════════════════════════════════════════════════════════════════

  const renderLocalTab = () => (
    <div className="space-y-4">
      {/* 드래그앤드롭 영역 */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition"
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">이미지를 드래그하거나 클릭하여 업로드</p>
        {isUploading && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{uploadProgress}%</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">모든 카테고리</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {assets.length > 0 && (
          <button
            onClick={toggleSelectAllLocal}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            {selectedAssets.size === assets.length && selectedAssets.size > 0
              ? '전체 해제'
              : '전체 선택'}
          </button>
        )}
        {selectedAssets.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => downloadSelected('local')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
            >
              <DownloadIcon className="w-4 h-4 inline mr-1" />
              ({selectedAssets.size}개) 다운로드
            </button>
            <button
              onClick={() => copyAllImgSrc('local')}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
            >
              <CopyIcon className="w-4 h-4 inline mr-1" />
              HTML 복사
            </button>
          </div>
        )}
      </div>

      {/* 이미지 그리드 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="relative group">
              <img
                src={asset.thumbnailUrl}
                alt={asset.title}
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <input
                type="checkbox"
                checked={selectedAssets.has(asset.id)}
                onChange={() => toggleAssetSelection(asset.id)}
                className="absolute top-2 left-2 w-4 h-4 cursor-pointer"
              />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => copyLocalImgSrc(asset)}
                  className="p-1 bg-white rounded hover:bg-gray-100"
                  title="IMG 태그 복사"
                >
                  {copiedId === asset.id ? (
                    <CheckIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <CopyIcon className="w-4 h-4 text-gray-600" />
                  )}
                </button>
                <button
                  onClick={() => downloadLocalAsset(asset)}
                  className="p-1 bg-white rounded hover:bg-gray-100"
                  title="다운로드"
                >
                  <DownloadIcon className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-600 truncate">{asset.title}</p>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {total > limit && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {offset + 1} ~ {Math.min(offset + limit, total)} / {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderGdTab = () => (
    <div className="space-y-4">
      {/* 폴더 선택 + 폴더 추가 버튼 */}
      <div className="flex gap-2 flex-wrap items-center">
        {gdFolders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => {
              setSelectedGdFolder(folder.id);
              setGdPage(1);
              setSelectedGdAssets(new Set());
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedGdFolder === folder.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FolderIcon className="w-4 h-4 inline mr-1" />
            {folder.name} ({folder.imageCount})
          </button>
        ))}
        <button
          onClick={() => setShowAddFolder((v) => !v)}
          className="px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50 transition"
        >
          <PlusIcon className="w-4 h-4 inline mr-1" />
          폴더 추가
        </button>
      </div>

      {/* 인라인 폴더 추가 폼 */}
      {showAddFolder && (
        <div className="flex gap-2 items-center flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
          <input
            type="text"
            placeholder="폴더 이름"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
          />
          <input
            type="text"
            placeholder="Drive 폴더 ID"
            value={newFolderDriveId}
            onChange={(e) => setNewFolderDriveId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
          />
          <button
            onClick={handleAddFolder}
            disabled={addingFolder}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {addingFolder ? '추가 중...' : '추가'}
          </button>
          <button
            onClick={() => {
              setShowAddFolder(false);
              setNewFolderName('');
              setNewFolderDriveId('');
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
          >
            취소
          </button>
        </div>
      )}

      {/* 선택 도구 */}
      {gdImages.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={toggleSelectAllGd}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            {selectedGdAssets.size === gdImages.length && selectedGdAssets.size > 0
              ? '전체 해제'
              : '전체 선택'}
          </button>
          {selectedGdAssets.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => downloadSelected('drive')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                <DownloadIcon className="w-4 h-4 inline mr-1" />
                ({selectedGdAssets.size}개) 다운로드
              </button>
              <button
                onClick={() => copyAllImgSrc('drive')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
              >
                <CopyIcon className="w-4 h-4 inline mr-1" />
                HTML 복사
              </button>
            </div>
          )}
        </div>
      )}

      {/* 이미지 그리드 */}
      {gdLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {gdImages.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.thumbnailUrl}
                  alt={image.name}
                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                  loading="lazy"
                />
                <input
                  type="checkbox"
                  checked={selectedGdAssets.has(image.id)}
                  onChange={() => toggleGdAssetSelection(image.id)}
                  className="absolute top-2 left-2 w-4 h-4 cursor-pointer"
                />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => copyGdImgSrc(image)}
                    className="p-1 bg-white rounded hover:bg-gray-100"
                    title="IMG 태그 복사"
                  >
                    {copiedId === image.id ? (
                      <CheckIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <CopyIcon className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                  <button
                    onClick={() => downloadGdAsset(image)}
                    className="p-1 bg-white rounded hover:bg-gray-100"
                    title="다운로드"
                  >
                    <DownloadIcon className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-600 truncate">{image.name}</p>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {gdPagination.totalPages > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                페이지 {gdPage} / {gdPagination.totalPages} (총 {gdPagination.total}개)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setGdPage(Math.max(1, gdPage - 1))}
                  disabled={gdPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setGdPage(gdPage + 1)}
                  disabled={gdPage >= gdPagination.totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">이미지 라이브러리</h1>
        <p className="text-gray-600 mt-2">로컬 또는 구글 드라이브 이미지 관리</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('local')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'local'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          로컬 이미지
        </button>
        <button
          onClick={() => setActiveTab('drive')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'drive'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          구글 드라이브
        </button>
      </div>

      {/* 콘텐츠 */}
      {activeTab === 'local' ? renderLocalTab() : renderGdTab()}

      {/* 업로드 카테고리 선택 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80">
            <h3 className="font-bold text-lg mb-4">저장 폴더 선택</h3>
            <p className="text-sm text-gray-500 mb-3">
              {pendingFiles?.[0]?.name} → WebP로 압축 후 저장됩니다
            </p>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
            >
              {UPLOAD_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setPendingFiles(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (pendingFiles) {
                    setShowUploadModal(false);
                    doUpload(pendingFiles, uploadCategory);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                업로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
