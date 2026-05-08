'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, Search, Copy, Check, AlertCircle } from 'lucide-react'
import { useImageFetch } from './useImageFetch'

// Cloudinary URL에 크기 변환 파라미터 삽입 — 원본 대신 최적화된 썸네일 로드
function cloudinaryThumb(url: string, width: number): string {
  if (!url || !url.includes('cloudinary.com')) return url
  const marker = '/image/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url
  const base = url.slice(0, idx + marker.length)
  const rest = url.slice(idx + marker.length)
  // 이미 변환 파라미터가 있으면 교체
  const cleanRest = rest.startsWith('w_') || rest.startsWith('f_') || rest.startsWith('q_')
    ? rest.replace(/^[^/]+\//, '')
    : rest
  return `${base}w_${width},h_${width},c_fill,q_auto,f_auto/${cleanRest}`
}

// 20px blur placeholder용 극소 썸네일
function cloudinaryBlur(url: string): string {
  return cloudinaryThumb(url, 20)
}

/**
 * 크루즈 이미지 타입 정의
 */
interface CruisePhoto {
  id: string
  name: string
  url: string
  folder: string
  size: number | null
}

/**
 * 폴더 그룹 타입 정의
 */
interface FolderGroup {
  folder: string
  count: number
  images: CruisePhoto[]
}

/**
 * API 응답 타입 정의
 */
interface ApiResponse {
  ok: boolean
  data: {
    folders: FolderGroup[]
    stats: {
      totalFolders: number
      totalImages: number
    }
  }
  error?: string
}

interface ImageLibraryProps {
  onSelectImage?: (imageUrl: string, imageName: string) => void
  onClose?: () => void
}

/**
 * ImageLibrary 컴포넌트 - 크루즈 이미지 라이브러리
 *
 * Features:
 * - 폴더 네비게이션 (뒤로가기 포함)
 * - 각 폴더의 이미지 그리드
 * - Cloudinary 이미지 표시
 * - 이미지 선택/복사 기능
 * - 에러 처리 (폴더/이미지 로드 실패 시 표시)
 * - 검색 기능 (폴더명 검색)
 * - 로딩 상태 (skeleton)
 * - 모바일 최적화 (56px 터치 영역)
 */
export function ImageLibrary({ onSelectImage, onClose }: ImageLibraryProps) {
  // 상태 관리
  const [selectedFolder, setSelectedFolder] = useState<FolderGroup | null>(null)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)

  // 공통 fetch 훅 (AbortController + loading/error 상태)
  const { data: apiData, loading, error, fetch: loadCruisePhotos, abort } = useImageFetch<ApiResponse>('[ImageLibrary]')

  // API 응답에서 폴더 목록 추출
  const folders: FolderGroup[] = apiData?.ok ? apiData.data.folders : []

  /**
   * 컴포넌트 마운트 시 이미지 로드
   */
  useEffect(() => {
    loadCruisePhotos('/api/admin/cruise-photos?format=grouped')

    return () => {
      abort()
    }
  }, [loadCruisePhotos, abort])

  /**
   * 폴더 클릭 - 폴더 선택 상태 전환
   */
  const handleFolderClick = (folder: FolderGroup) => {
    setSelectedFolder(folder)
    setSelectedImages(new Set())
    setSearchQuery('')
  }

  /**
   * 뒤로가기 - 폴더 선택 해제
   */
  const handleBackClick = () => {
    setSelectedFolder(null)
    setSelectedImages(new Set())
  }

  /**
   * 이미지 클릭 - 이미지 선택 토글
   */
  const handleImageClick = (imageId: string) => {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId)
    } else {
      newSelected.add(imageId)
    }
    setSelectedImages(newSelected)
  }

  /**
   * 이미지 URL 복사
   */
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * 이미지 선택 - onSelectImage 콜백 호출
   */
  const handleSelectImage = (image: CruisePhoto) => {
    if (onSelectImage) {
      onSelectImage(image.url, image.name)
    }
  }

  /**
   * 폴더 목록 필터링 (검색)
   */
  const filteredFolders = folders.filter((folder) =>
    folder.folder.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 선택된 폴더가 있는 경우 - 이미지 그리드 표시
  if (selectedFolder) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBackClick}
            className="flex items-center justify-center w-14 h-14 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="뒤로가기"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{selectedFolder.folder}</h2>
            <p className="text-sm text-gray-500">{selectedFolder.count}개 이미지</p>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">이미지 로드 실패</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* 이미지 그리드 */}
        {selectedFolder.images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {selectedFolder.images.map((image) => {
              const isSelected = selectedImages.has(image.id)
              return (
                <div
                  key={image.id}
                  className="relative group cursor-pointer"
                  onClick={() => handleImageClick(image.id)}
                >
                  {/* 이미지 컨테이너 */}
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 transition-all" style={{
                    borderColor: isSelected ? '#fbbf24' : '#e5e7eb',
                  }}>
                    <Image
                      src={cloudinaryThumb(image.url, 400)}
                      alt={image.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      className="object-cover"
                      unoptimized
                      loading="lazy"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23d1d5db" font-size="16"%3ELoad Failed%3C/text%3E%3C/svg%3E'
                      }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 파일명 */}
                  <p className="text-xs text-gray-600 mt-2 truncate" title={image.name}>
                    {image.name}
                  </p>

                  {/* 호버 액션 - 56px 버튼 */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyUrl(image.url)
                      }}
                      className="p-2 bg-white rounded-lg text-gray-700 hover:bg-yellow-100 h-10 w-10 flex items-center justify-center"
                      title="URL 복사"
                    >
                      {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectImage(image)
                      }}
                      className="px-3 py-2 bg-yellow-400 text-white rounded-lg text-sm font-medium hover:bg-yellow-500 h-10"
                      title="선택"
                    >
                      선택
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">📷</p>
            <p className="text-gray-500">이 폴더에 이미지가 없습니다</p>
          </div>
        )}

        {/* 선택된 이미지 하단 바 */}
        {selectedImages.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 sm:px-6">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">{selectedImages.size}개 선택됨</p>
              <button
                onClick={handleBackClick}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors h-14 flex items-center"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 기본 폴더 목록 표시
  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">크루즈 이미지 라이브러리</h1>
        <p className="text-sm text-gray-500 mt-1">
          {folders.length}개 폴더 • {folders.reduce((sum, f) => sum + f.count, 0)}개 이미지
        </p>
      </div>

      {/* 검색 */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="폴더명 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20"
        />
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">폴더 로드 실패</p>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
            <button
              onClick={() => loadCruisePhotos('/api/admin/cruise-photos?format=grouped')}
              className="text-sm text-red-600 font-medium hover:underline mt-2"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 로딩 상태 - Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden bg-gray-200 animate-pulse">
              <div className="aspect-square" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4" />
                <div className="h-3 bg-gray-300 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredFolders.length > 0 ? (
        /* 폴더 그리드 */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredFolders.map((folder) => (
            <button
              key={folder.folder}
              onClick={() => handleFolderClick(folder)}
              className="group text-left rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all bg-white"
            >
              {/* 폴더 썸네일 - 첫 이미지 */}
              <div className="relative w-full aspect-square bg-gray-100 overflow-hidden">
                {folder.images.length > 0 ? (
                  <Image
                    src={cloudinaryThumb(folder.images[0].url, 300)}
                    alt={folder.folder}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform"
                    unoptimized
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement
                      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23d1d5db" font-size="20"%3E📁%3C/text%3E%3C/svg%3E'
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-4xl">📁</div>
                )}
              </div>

              {/* 폴더 정보 */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate group-hover:text-yellow-600 transition-colors">
                  {folder.folder.split('/').pop()}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{folder.count}개 이미지</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* 검색 결과 없음 */
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🔍</p>
          <p className="text-gray-500">검색 결과가 없습니다</p>
        </div>
      )}

      {/* 닫기 버튼 (모달 상황에서) */}
      {onClose && (
        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors h-14 flex items-center justify-center"
        >
          닫기
        </button>
      )}
    </div>
  )
}

export default ImageLibrary
