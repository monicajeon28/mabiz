'use client'

import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import { csrfFetch, getCsrfToken } from '@/lib/csrf-client'
import { logger } from '@/lib/logger'

interface ImageUploaderProps {
  imageType: 'promo' | 'cover' | 'featured' | 'profile' | 'product'
  affiliateId?: string
  productId?: string
  onSuccess?: (result: { url: string; publicId?: string; productImageId?: number; images?: Array<{id: number; url: string; size: number}> }) => void
  onError?: (error: string) => void
  maxFiles?: number
  maxSizeMB?: number
}

interface PreviewFile {
  file: File
  preview: string
}

/**
 * ImageUploader — 드래그 앤 드롭 + 진행률 + 미리보기 + CSRF 보호
 *
 * Features:
 * - 드래그 앤 드롭 업로드
 * - 파일 미리보기 (로컬 URL)
 * - 업로드 진행률 표시
 * - CSRF 토큰 자동 포함
 * - 에러 처리 + 마스킹
 * - 모바일 최적화 (터치 영역 56px)
 */
export function ImageUploader({
  imageType,
  affiliateId,
  productId,
  onSuccess,
  onError,
  maxFiles = 10,
  maxSizeMB = 50
}: ImageUploaderProps) {
  const [previews, setPreviews] = useState<PreviewFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const maxSizeBytes = maxSizeMB * 1024 * 1024

  // 파일 추가 (검증 포함)
  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    setErrorMessage(null)

    // 개수 검증
    if (previews.length + fileArray.length > maxFiles) {
      const error = `최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`
      setErrorMessage(error)
      onError?.(error)
      return
    }

    const newPreviews: PreviewFile[] = []
    for (const file of fileArray) {
      // 크기 검증
      if (file.size > maxSizeBytes) {
        const error = `파일 크기는 ${maxSizeMB}MB 이하여야 합니다. (현재: ${(file.size / 1024 / 1024).toFixed(2)}MB)`
        setErrorMessage(error)
        onError?.(error)
        return
      }

      // MIME 타입 검증
      if (!file.type.startsWith('image/')) {
        const error = `이미지 파일만 업로드할 수 있습니다. (${file.type})`
        setErrorMessage(error)
        onError?.(error)
        return
      }

      newPreviews.push({
        file,
        preview: URL.createObjectURL(file)
      })
    }

    setPreviews(prev => [...prev, ...newPreviews])
  }, [previews.length, maxFiles, maxSizeBytes, maxSizeMB, onError])

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
  }

  const removePreview = (index: number) => {
    setPreviews(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  const handleUpload = async () => {
    if (previews.length === 0) {
      setErrorMessage('업로드할 파일을 선택하세요.')
      return
    }

    setUploading(true)
    setProgress(0)
    setErrorMessage(null)

    try {
      const csrfToken = getCsrfToken()
      if (!csrfToken) {
        throw new Error('보안 토큰이 없습니다. 페이지를 새로고침하세요.')
      }

      // 상품 이미지 업로드인 경우: 배치 업로드 (모든 파일을 한 번에)
      if (productId && imageType === 'product') {
        const formData = new FormData()
        previews.forEach(({ file }) => {
          formData.append('file', file)
        })

        const response = await csrfFetch(`/api/admin/products/${productId}/images/upload`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Upload failed with status ${response.status}`)
        }

        const data = await response.json()
        setProgress(100)

        // 배치 업로드 결과 콜백
        if (data.ok && data.images) {
          onSuccess?.({
            url: data.images[0]?.url || '',
            images: data.images,
            productImageId: data.images[0]?.id
          })

          logger.info('[ImageUploader] Batch upload success:', {
            count: data.images.length,
            failed: data.failed?.length || 0
          })
        }

        // 모든 파일 업로드 완료
        setPreviews([])
      } else {
        // 기존 업로드 방식: 개별 업로드
        let uploadedCount = 0

        for (const { file } of previews) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('imageType', imageType)
            if (affiliateId) formData.append('affiliateId', affiliateId)
            if (productId) formData.append('productId', productId)

            const endpoint = affiliateId
              ? '/api/affiliate/images/upload'
              : productId
              ? `/api/products/${productId}/images`
              : '/api/images/upload'

            const response = await csrfFetch(endpoint, {
              method: 'POST',
              body: formData
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `Upload failed with status ${response.status}`)
            }

            const data = await response.json()
            uploadedCount++
            setProgress(Math.round((uploadedCount / previews.length) * 100))

            // 첫 번째 성공 시 콜백
            if (uploadedCount === 1) {
              onSuccess?.({
                url: data.url,
                publicId: data.publicId,
                productImageId: data.productImageId
              })
            }

            logger.info('[ImageUploader] Upload success:', {
              fileName: file.name,
              publicId: data.publicId
            })
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            logger.error('[ImageUploader] Upload error:', {
              fileName: file.name,
              error: errorMsg
            })
            throw error
          }
        }

        // 모든 파일 업로드 완료
        setPreviews([])
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload error'
      setErrorMessage(errorMsg)
      onError?.(errorMsg)
      logger.error('[ImageUploader] Error:', { error: errorMsg })
    } finally {
      setUploading(false)
    }
  }

  return (
    /* B0-D5: Safe Area CSS — iOS 노치 + Android 네비 대응 */
    /* B0-D6: @media 480px — 단일 열 스택 레이아웃 */
    <div
      className="w-full max-w-2xl mx-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      {/* 업로드 영역 */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center
          transition-colors cursor-pointer
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${uploading ? 'pointer-events-none opacity-60' : 'hover:border-blue-400'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="region"
        aria-label="이미지 업로드 영역 — 드래그 앤 드롭 또는 클릭"
      >
        <input
          type="file"
          id="image-upload"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          disabled={uploading}
          className="hidden"
          aria-label="이미지 파일 선택"
        />

        <label
          htmlFor="image-upload"
          className="flex flex-col items-center gap-2 cursor-pointer"
          aria-label="이미지 파일 선택 버튼"
        >
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <p className="text-lg font-medium text-gray-700">
            이미지를 드래그하거나 클릭해서 선택하세요
          </p>
          <p className="text-sm text-gray-500">
            최대 {maxFiles}개, {maxSizeMB}MB 이하
          </p>
        </label>
      </div>

      {/* 에러 메시지 + 재시도 버튼 (B0-D3) */}
      {errorMessage && (
        <div
          className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex flex-col gap-2"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-semibold text-sm">
            {/* 에러 분류 아이콘 */}
            {errorMessage.includes('크기') || errorMessage.includes('MB')
              ? '📁 '
              : errorMessage.includes('형식') || errorMessage.includes('image/')
              ? '🖼 '
              : errorMessage.includes('개') || errorMessage.includes('초과')
              ? '📋 '
              : '⚠️ '}
            {errorMessage}
          </p>
          <button
            onClick={() => setErrorMessage(null)}
            className="self-start h-9 px-4 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation"
            aria-label="에러 메시지 닫기 및 재시도"
          >
            재시도
          </button>
        </div>
      )}

      {/* 미리보기 */}
      {previews.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            선택된 파일 ({previews.length})
          </h3>

          {/* B0-D6: 480px에서 1열, 이상에서 2-4열 반응형 */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
            {previews.map((preview, i) => (
              <div key={i} className="relative group">
                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={preview.preview}
                    alt={`Preview ${i}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* 제거 버튼 (56px 터치 영역 — WCAG 2.5.5) */}
                {!uploading && (
                  <button
                    onClick={() => removePreview(i)}
                    className="
                      absolute -top-2 -right-2
                      w-14 h-14 bg-red-500 text-white rounded-full
                      flex items-center justify-center
                      opacity-0 group-hover:opacity-100
                      transition-opacity
                      text-lg font-bold
                      touch-manipulation
                    "
                    title="이 파일 제거"
                    aria-label={`${preview.file.name} 파일 제거`}
                  >
                    ×
                  </button>
                )}

                <p className="text-xs text-gray-600 mt-1 truncate">
                  {preview.file.name}
                </p>
              </div>
            ))}
          </div>

          {/* 진행률 표시 */}
          {uploading && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                업로드 중... {progress}%
              </p>
            </div>
          )}

          {/* 업로드 버튼 (56px 최소 높이, WCAG 2.5.5, B0-D4 ARIA) */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`
              w-full h-14 rounded-lg font-semibold text-white
              transition-colors flex items-center justify-center gap-2
              touch-manipulation
              ${uploading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
              }
            `}
            aria-label={uploading ? `업로드 진행 중 ${progress}%` : `${previews.length}개 파일 업로드 시작`}
            aria-busy={uploading}
            role="button"
          >
            {uploading ? (
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
                업로드 중...
              </>
            ) : (
              '업로드'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
