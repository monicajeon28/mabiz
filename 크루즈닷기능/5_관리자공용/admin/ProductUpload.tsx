'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { ChevronLeft, Copy, Check, AlertCircle, Trash2 } from 'lucide-react'
import { csrfFetch, getCsrfToken } from '@/lib/csrf-client'
import { logger } from '@/lib/logger'
import { showSuccess, showError, showWarning, useToast } from '@/components/ui/Toast'

interface ProductUploadProps {
  productId: number
  onUploadComplete?: () => void | Promise<void>
  maxFiles?: number
  maxSizeMB?: number
  onImagesChanged?: (count: number) => void
}

interface PreviewFile {
  file: File
  preview: string
  uploadedUrl?: string
  error?: string
  retryCount?: number
}

interface UploadStatus {
  fileName: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  retryCount: number
}

interface ProductImageItem {
  id: number
  fileName: string
  fileSize: number
  fullUrl: string
  metadata?: Record<string, unknown>
  createdAt: string
}

interface ProductImagesResponse {
  ok: boolean
  product?: {
    id: number
    productCode: string
    packageName: string
  }
  images?: ProductImageItem[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  error?: string
}

const MAX_RETRIES = 3
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

/**
 * ProductUpload — 상품 이미지 업로드 + 관리 컴포넌트 (Phase 5-2)
 *
 * Features:
 * - 업로드 섹션: 드래그 앤 드롭 + 파일 입력 + 다중 파일
 * - 이미지 목록: GET /api/admin/products/[id]/images/list (페이지네이션)
 * - 이미지 선택/복사: ImageLibrary 패턴 (URL 복사)
 * - 삭제 기능: DELETE /api/admin/products/[id]/images/[imageId]
 * - 동시 업로드 (Promise.all) + 진행률 ("3/10 업로드 중...")
 * - 에러 처리 + 재시도 버튼 (최대 3회)
 * - CSRF 토큰 자동 포함 (POST/DELETE)
 * - 성공/실패 Toast 알림
 * - 업로드 완료 후 이미지 목록 새로고침
 * - 모바일 최적화 (56px 터치 영역, Safe Area)
 *
 * Security:
 * - 파일 크기 검증 (50MB)
 * - MIME 타입 검증 (jpg/png/webp/gif)
 * - 확장자 검증 (이중 확인)
 * - CSRF 토큰 검증 (POST/DELETE)
 * - IDOR 방지: 상품 소유권 확인 (API에서)
 * - 에러 마스킹 (시스템정보 노출 금지)
 */
export function ProductUpload({
  productId,
  onUploadComplete,
  maxFiles = 10,
  maxSizeMB = 50,
  onImagesChanged
}: ProductUploadProps) {
  // 업로드 상태
  const [previews, setPreviews] = useState<PreviewFile[]>([])
  const [uploadingIndices, setUploadingIndices] = useState<Set<number>>(new Set())
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const { toasts, showToast, removeToast } = useToast()

  // 이미지 목록 상태
  const [images, setImages] = useState<ProductImageItem[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [copied, setCopied] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)

  // Race condition 방지
  const abortRef = useRef<AbortController | null>(null)

  const maxSizeBytes = maxSizeMB * 1024 * 1024

  /**
   * 이미지 목록 로드 (페이지네이션 지원)
   */
  const loadProductImages = useCallback(async (page: number = 1) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoadingImages(true)
    setImageError(null)

    try {
      const res = await fetch(
        `/api/admin/products/${productId}/images/list?page=${page}&limit=12`,
        { signal: abortRef.current.signal }
      )

      if (!res.ok) {
        throw new Error(`API 요청 실패: ${res.status}`)
      }

      const data: ProductImagesResponse = await res.json()

      if (data.ok && data.images && data.pagination) {
        setImages(data.images)
        setCurrentPage(data.pagination.page)
        setTotalPages(data.pagination.totalPages)
        logger.log('[ProductUpload] Images loaded:', {
          productId,
          count: data.images.length,
          page: data.pagination.page,
          total: data.pagination.total,
        })
      } else {
        throw new Error(data.error || '이미지를 불러올 수 없습니다.')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setImageError(errorMsg)
      logger.error('[ProductUpload] Failed to load images:', { error: errorMsg })
    } finally {
      setLoadingImages(false)
    }
  }, [productId])

  // 컴포넌트 마운트 시 이미지 로드
  useEffect(() => {
    loadProductImages(1)

    return () => {
      abortRef.current?.abort()
    }
  }, [productId, loadProductImages])

  // 파일 확장자 추출 및 검증
  const getFileExtension = (fileName: string): string => {
    return fileName.split('.').pop()?.toLowerCase() || ''
  }

  // 파일 추가 (검증 포함)
  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    setErrorMessage(null)

    // 개수 검증
    if (previews.length + fileArray.length > maxFiles) {
      const error = `최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`
      setErrorMessage(error)
      showError(error, '파일 개수 초과')
      return
    }

    const newPreviews: PreviewFile[] = []
    let hasError = false

    for (const file of fileArray) {
      // 파일 이름 검증
      if (!file.name) {
        const error = '파일 이름이 없습니다.'
        setErrorMessage(error)
        showError(error)
        hasError = true
        break
      }

      // 확장자 검증
      const ext = getFileExtension(file.name)
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        const error = `지원하지 않는 확장자입니다: ${ext}. 지원: JPG, PNG, WebP, GIF`
        setErrorMessage(error)
        showError(error, '파일 형식 오류')
        hasError = true
        break
      }

      // 크기 검증
      if (file.size === 0) {
        const error = `"${file.name}"은 비어있는 파일입니다.`
        setErrorMessage(error)
        showError(error, '파일 크기 오류')
        hasError = true
        break
      }

      if (file.size > maxSizeBytes) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
        const error = `"${file.name}"은 너무 큽니다 (${fileSizeMB}MB > ${maxSizeMB}MB)`
        setErrorMessage(error)
        showError(error, '파일 크기 초과')
        hasError = true
        break
      }

      // MIME 타입 검증
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        const error = `지원하지 않는 이미지 형식입니다: ${file.type}`
        setErrorMessage(error)
        showError(error, '파일 형식 오류')
        hasError = true
        break
      }

      newPreviews.push({
        file,
        preview: URL.createObjectURL(file),
        retryCount: 0
      })
    }

    if (hasError) {
      // 객체 URL 정리
      newPreviews.forEach(p => URL.revokeObjectURL(p.preview))
      return
    }

    setPreviews(prev => [...prev, ...newPreviews])
    setErrorMessage(null)
  }, [previews.length, maxFiles, maxSizeBytes, maxSizeMB, showToast])

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
    }
    // 같은 파일 다시 선택 가능하도록 초기화
    e.target.value = ''
  }

  const removePreview = (index: number) => {
    setPreviews(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  // 단일 파일 업로드 (재시도 로직 포함)
  const uploadSingleFile = async (file: File, index: number, retryCount: number = 0): Promise<boolean> => {
    const statusIndex = uploadStatuses.findIndex(s => s.fileName === file.name)

    try {
      setUploadingIndices(prev => new Set([...prev, index]))

      if (statusIndex >= 0) {
        setUploadStatuses(prev => {
          const updated = [...prev]
          updated[statusIndex].status = 'uploading'
          return updated
        })
      }

      const csrfToken = getCsrfToken()
      if (!csrfToken) {
        throw new Error('보안 토큰이 없습니다. 페이지를 새로고침하세요.')
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await csrfFetch(`/api/products/${productId}/images`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error || `Upload failed (${response.status})`
        throw new Error(errorMsg)
      }

      const data = await response.json()

      // 성공
      setPreviews(prev => {
        const updated = [...prev]
        updated[index].uploadedUrl = data.url
        updated[index].error = undefined
        updated[index].retryCount = 0
        return updated
      })

      if (statusIndex >= 0) {
        setUploadStatuses(prev => {
          const updated = [...prev]
          updated[statusIndex].status = 'success'
          updated[statusIndex].progress = 100
          return updated
        })
      }

      logger.log('[ProductUpload] Upload success:', {
        fileName: file.name,
        productId,
        publicId: data.publicId,
        productImageId: data.productImageId
      })

      return true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.warn('[ProductUpload] Upload error (attempt %d):', retryCount + 1, {
        fileName: file.name,
        productId,
        error: errorMsg,
        retryCount
      })

      // 재시도 로직
      if (retryCount < MAX_RETRIES) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, backoffDelay))

        return uploadSingleFile(file, index, retryCount + 1)
      }

      // 최대 재시도 초과
      setPreviews(prev => {
        const updated = [...prev]
        updated[index].error = errorMsg
        updated[index].retryCount = retryCount
        return updated
      })

      if (statusIndex >= 0) {
        setUploadStatuses(prev => {
          const updated = [...prev]
          updated[statusIndex].status = 'error'
          updated[statusIndex].error = errorMsg
          updated[statusIndex].retryCount = retryCount
          return updated
        })
      }

      return false
    } finally {
      setUploadingIndices(prev => {
        const updated = new Set(prev)
        updated.delete(index)
        return updated
      })
    }
  }

  // 모든 파일 동시 업로드
  const handleUpload = async () => {
    if (previews.length === 0) {
      setErrorMessage('업로드할 파일을 선택하세요.')
      showError('업로드할 파일을 선택하세요.')
      return
    }

    // 이미 업로드된 파일 필터링
    const filesToUpload = previews.filter(p => !p.uploadedUrl && !p.error)

    if (filesToUpload.length === 0) {
      showWarning('모든 파일이 이미 업로드되었거나 오류 상태입니다.')
      return
    }

    setErrorMessage(null)
    setUploadProgress({ current: 0, total: filesToUpload.length })

    // 업로드 상태 초기화
    const statuses: UploadStatus[] = filesToUpload.map(p => ({
      fileName: p.file.name,
      status: 'pending',
      progress: 0,
      retryCount: p.retryCount || 0
    }))
    setUploadStatuses(statuses)

    try {
      // Promise.all로 동시 업로드
      const uploadPromises = filesToUpload.map((preview, idx) => {
        const originalIndex = previews.findIndex(p => p.file === preview.file)
        return uploadSingleFile(preview.file, originalIndex).then(success => {
          // 진행률 업데이트
          setUploadProgress(prev => ({
            ...prev,
            current: prev.current + 1
          }))
          return success
        })
      })

      const results = await Promise.all(uploadPromises)
      const successCount = results.filter(r => r).length
      const failCount = results.length - successCount

      // 결과 요약
      if (successCount > 0) {
        const msg = failCount > 0
          ? `${successCount}개 업로드 성공, ${failCount}개 실패`
          : `${successCount}개 파일 업로드 완료!`
        showSuccess(msg, '업로드 완료')
        logger.log('[ProductUpload] Batch upload complete:', {
          productId,
          successCount,
          failCount,
          totalCount: filesToUpload.length
        })
      }

      if (failCount > 0) {
        showWarning(`${failCount}개 파일 업로드 실패. 재시도 버튼을 누르세요.`, '부분 실패')
      }

      // 콜백 실행 + 이미지 목록 새로고침
      if (successCount > 0) {
        onUploadComplete?.()
        onImagesChanged?.(successCount)
        // 첫 페이지로 새로고침
        loadProductImages(1)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload error'
      logger.error('[ProductUpload] Unexpected error:', { error: errorMsg, productId })
      showError('업로드 중 예기치 않은 오류가 발생했습니다.', '오류')
    } finally {
      setUploadProgress({ current: 0, total: 0 })
    }
  }

  // 오류 파일 재시도
  const handleRetry = async (index: number) => {
    const preview = previews[index]
    if (!preview.error) return

    setPreviews(prev => {
      const updated = [...prev]
      updated[index].error = undefined
      updated[index].retryCount = (updated[index].retryCount || 0) + 1
      return updated
    })

    const success = await uploadSingleFile(preview.file, index, 0)
    if (success) {
      showSuccess(`"${preview.file.name}" 재업로드 성공!`)
      onUploadComplete?.()
      onImagesChanged?.(1)
    }
  }

  /**
   * 이미지 삭제 (소프트 삭제)
   */
  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) {
      return
    }

    setDeletingImageId(imageId)

    try {
      const csrfToken = getCsrfToken()
      if (!csrfToken) {
        throw new Error('보안 토큰이 없습니다. 페이지를 새로고침하세요.')
      }

      const response = await csrfFetch(
        `/api/admin/products/${productId}/images/${imageId}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Delete failed (${response.status})`)
      }

      // 목록에서 제거
      setImages(prev => prev.filter(img => img.id !== imageId))
      showSuccess('이미지가 삭제되었습니다.')
      logger.log('[ProductUpload] Image deleted:', { imageId, productId })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Delete error'
      logger.error('[ProductUpload] Delete error:', { error: errorMsg, imageId, productId })
      showError(errorMsg, '삭제 실패')
    } finally {
      setDeletingImageId(null)
    }
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
   * 페이지 변경
   */
  const handlePageChange = (newPage: number) => {
    loadProductImages(newPage)
  }

  // 미리보기 정리 (언마운트 시)
  useEffect(() => {
    return () => {
      previews.forEach(p => {
        if (p.preview) URL.revokeObjectURL(p.preview)
      })
    }
  }, [previews])

  const isUploading = uploadingIndices.size > 0
  const uploadedCount = previews.filter(p => p.uploadedUrl).length
  const progressPercent = uploadProgress.total > 0
    ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
    : 0

  return (
    /* B0-D5: Safe Area CSS + B0-D6: 480px 반응형 래퍼 */
    <div
      className="w-full max-w-6xl mx-auto space-y-8 pb-[max(1rem,env(safe-area-inset-bottom))]"
      style={{
        paddingLeft: 'max(0px, env(safe-area-inset-left))',
        paddingRight: 'max(0px, env(safe-area-inset-right))',
      }}
    >
      {/* 이미지 목록 섹션 */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              업로드된 이미지 ({images.length})
            </h2>
          </div>

          {/* 에러 메시지 (B0-D3: 재시도 버튼 + ARIA) */}
          {imageError && (
            <div
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 flex-col sm:flex-row sm:items-start"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex gap-2 flex-1">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-red-800">이미지 로드 실패</p>
                  <p className="text-sm text-red-700">{imageError}</p>
                </div>
              </div>
              <button
                onClick={() => loadProductImages(currentPage)}
                className="h-9 px-4 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors touch-manipulation self-start"
                aria-label="이미지 목록 다시 불러오기"
              >
                재시도
              </button>
            </div>
          )}

          {/* 이미지 그리드 - 56px 터치 영역, B0-D6: @media 480px → 1열 */}
          {loadingImages ? (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden bg-gray-200 animate-pulse">
                  <div className="aspect-square" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {images.map((image) => (
                <div key={image.id} className="relative group cursor-pointer">
                  {/* 이미지 컨테이너 */}
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200 hover:border-blue-400 transition-colors">
                    <Image
                      src={image.fullUrl}
                      alt={image.fileName}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23d1d5db" font-size="16"%3ELoad Failed%3C/text%3E%3C/svg%3E'
                      }}
                    />
                  </div>

                  {/* 파일명 - 텍스트 크기 모바일 최적화 */}
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 truncate" title={image.fileName}>
                    {image.fileName}
                  </p>

                  {/* 호버 액션 - 56px 버튼 높이 (WCAG 2.5.5, B0-D4 ARIA) */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg flex-wrap content-center p-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyUrl(image.fullUrl)
                      }}
                      className="bg-white rounded-lg text-gray-700 hover:bg-yellow-100 h-14 w-14 flex items-center justify-center transition-colors touch-manipulation"
                      title="URL 복사"
                      aria-label={`${image.fileName} URL 복사`}
                    >
                      {copied ? <Check className="w-5 h-5 text-green-500" aria-hidden="true" /> : <Copy className="w-5 h-5" aria-hidden="true" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteImage(image.id)
                      }}
                      disabled={deletingImageId === image.id}
                      className="bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400 h-14 w-14 flex items-center justify-center transition-colors touch-manipulation"
                      title="삭제"
                      aria-label={`${image.fileName} 삭제`}
                    >
                      {deletingImageId === image.id ? (
                        <svg
                          className="w-5 h-5 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 - 56px 버튼 높이 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loadingImages}
                className="px-4 py-2 h-14 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center"
              >
                이전
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loadingImages}
                className="px-4 py-2 h-14 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 구분선 */}
      {images.length > 0 && <div className="border-t border-gray-200" />}

      {/* 업로드 영역 */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center
          transition-colors cursor-pointer
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${isUploading ? 'pointer-events-none opacity-60' : 'hover:border-blue-400'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id="product-image-upload"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
          onChange={handleFileInput}
          disabled={isUploading}
          className="hidden"
        />

        <label
          htmlFor="product-image-upload"
          className="flex flex-col items-center gap-3 cursor-pointer"
        >
          <svg
            className="w-16 h-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div>
            <p className="text-xl font-bold text-gray-700">
              이미지를 드래그하거나 클릭해서 선택
            </p>
            <p className="text-sm text-gray-500 mt-2">
              최대 {maxFiles}개, {maxSizeMB}MB 이하 (JPG, PNG, WebP, GIF)
            </p>
          </div>
        </label>
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
          <p className="font-semibold">오류 발생</p>
          <p className="text-sm mt-1">{errorMessage}</p>
        </div>
      )}

      {/* 미리보기 및 업로드 상태 */}
      {previews.length > 0 && (
        <div className="mt-8">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800">
              선택된 파일 ({previews.length})
            </h3>
            {uploadedCount > 0 && (
              <span className="text-sm text-green-600 font-semibold">
                ✓ {uploadedCount}/{previews.length} 완료
              </span>
            )}
          </div>

          {/* 진행률 바 */}
          {isUploading && uploadProgress.total > 0 && (
            <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold text-gray-700">
                  업로드 진행 중...
                </p>
                <p className="text-sm text-gray-600 font-mono">
                  {uploadProgress.current}/{uploadProgress.total} ({progressPercent}%)
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* 파일 목록 */}
          <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
            {previews.map((preview, i) => {
              const fileName = preview.file.name
              const fileSizeMB = (preview.file.size / 1024 / 1024).toFixed(2)
              const status = preview.uploadedUrl ? 'success' : preview.error ? 'error' : 'pending'

              return (
                <div
                  key={i}
                  className={`
                    flex gap-4 p-3 rounded-lg border-2 transition-colors
                    ${status === 'success' ? 'bg-green-50 border-green-200' : ''}
                    ${status === 'error' ? 'bg-red-50 border-red-200' : ''}
                    ${status === 'pending' ? 'bg-gray-50 border-gray-200' : ''}
                  `}
                >
                  {/* 미리보기 이미지 */}
                  <div className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-gray-100">
                    <Image
                      src={preview.preview}
                      alt={fileName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  {/* 파일 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fileSizeMB} MB
                    </p>

                    {status === 'success' && (
                      <p className="text-xs text-green-600 font-semibold mt-1">
                        ✓ 업로드 완료
                      </p>
                    )}
                    {status === 'error' && (
                      <div className="mt-1">
                        <p className="text-xs text-red-600 font-semibold">
                          ✗ {preview.error}
                        </p>
                        <p className="text-xs text-red-500">
                          ({preview.retryCount || 0}/{MAX_RETRIES} 재시도)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2">
                    {/* B0-D3: 에러 재시도 버튼 (ARIA, 56px 터치 고려) */}
                    {status === 'error' && (
                      <button
                        onClick={() => handleRetry(i)}
                        className="h-9 px-3 text-xs font-semibold bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors touch-manipulation"
                        title="재시도"
                        aria-label={`${fileName} 업로드 재시도`}
                      >
                        재시도
                      </button>
                    )}

                    {!isUploading && status === 'pending' && (
                      <button
                        onClick={() => removePreview(i)}
                        className="h-9 px-3 text-xs font-semibold bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors touch-manipulation"
                        title="제거"
                        aria-label={`${fileName} 파일 목록에서 제거`}
                      >
                        제거
                      </button>
                    )}

                    {/* 상태 아이콘 */}
                    {status === 'success' && (
                      <div className="text-green-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {status === 'error' && !isUploading && (
                      <div className="text-red-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {status === 'pending' && isUploading && uploadingIndices.has(i) && (
                      <div className="text-blue-600 animate-spin">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 업로드 버튼 (56px 최소 높이) */}
          <button
            onClick={handleUpload}
            disabled={isUploading || previews.filter(p => !p.uploadedUrl && !p.error).length === 0}
            className={`
              w-full h-14 rounded-lg font-bold text-white text-lg
              transition-colors flex items-center justify-center gap-3
              ${isUploading || previews.filter(p => !p.uploadedUrl && !p.error).length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }
            `}
          >
            {isUploading ? (
              <>
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                업로드 중 ({uploadProgress.current}/{uploadProgress.total})...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                업로드 시작
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
