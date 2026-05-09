'use client';

import { useEffect, useState } from 'react';
import {
  XIcon,
  SearchIcon,
  LoaderIcon,
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
  thumbnailUrl: string;
  driveUrl: string;
}

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: ImageAsset) => void;
  category?: string;
}

export function ImageLibraryModal({
  isOpen,
  onClose,
  onSelect,
  category,
}: ImageLibraryModalProps) {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // 이미지 목록 조회
  const fetchAssets = async () => {
    if (!isOpen) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams();

      if (search) params.append('search', search);
      if (category) params.append('category', category);
      params.append('limit', '100');

      const res = await fetch(`/api/images/list?${params}`);
      const json = await res.json();

      if (json.ok) {
        setAssets(json.data.assets);
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAssets();
    }
  }, [isOpen, search, category]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">이미지 선택</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <XIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* 검색 */}
        <div className="p-4 border-b">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="파일명으로 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 갤러리 */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoaderIcon className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : assets.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    onSelect(asset);
                    onClose();
                  }}
                  className="group relative border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition"
                >
                  {/* 썸네일 */}
                  <div className="bg-gray-100 aspect-square flex items-center justify-center overflow-hidden">
                    <img
                      src={asset.thumbnailUrl}
                      alt={asset.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%23999"%3EImage%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>

                  {/* 오버레이 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                    <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition">
                      선택
                    </span>
                  </div>

                  {/* 정보 */}
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {asset.fileName}
                    </p>
                    {asset.fileSize && (
                      <p className="text-xs text-gray-600">
                        {formatFileSize(Number(asset.fileSize))}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">이미지가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
