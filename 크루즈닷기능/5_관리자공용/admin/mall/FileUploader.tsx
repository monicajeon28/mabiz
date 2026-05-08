// components/admin/mall/FileUploader.tsx
// 파일 업로드 및 압축 다운로드 컴포넌트

'use client';

import { useState } from 'react';
import { FiDownload, FiImage, FiVideo, FiFile } from 'react-icons/fi';

interface FileUploaderProps {
  type: 'image' | 'video' | 'font';
  onUploadComplete?: (url: string) => void;
}

export default function FileUploader({ type, onUploadComplete }: FileUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    ratio: number;
  } | null>(null);

  // 이미지 압축 함수
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 최대 크기 제한 (1920px)
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 가져올 수 없습니다.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // JPEG 품질 설정 (0.8 = 80% 품질, 용량과 화질의 균형)
          const quality = 0.8;
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('이미지 압축에 실패했습니다.'));
                return;
              }
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('이미지를 로드할 수 없습니다.'));
      };
      reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    });
  };

  // 영상 압축 함수 (간단한 리사이징)
  const compressVideo = async (file: File): Promise<File> => {
    // 브라우저에서 영상 압축은 MediaRecorder API를 사용해야 하지만 복잡함
    // 여기서는 원본 파일을 반환하되, 사용자에게 안내 제공
    // 실제 압축이 필요하면 서버에서 ffmpeg 사용 권장
    return file;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setOriginalFile(file);
    setCompressedFile(null);
    setPreviewUrl(null);
    setCompressionInfo(null);

    try {
      let processedFile: File;
      let preview: string | null = null;

      if (type === 'image') {
        // 이미지 압축
        processedFile = await compressImage(file);
        preview = URL.createObjectURL(processedFile);
        setPreviewUrl(preview);

        // 압축 정보 저장
        const originalSize = file.size;
        const compressedSize = processedFile.size;
        const ratio = ((originalSize - compressedSize) / originalSize) * 100;
        setCompressionInfo({
          originalSize,
          compressedSize,
          ratio,
        });
      } else if (type === 'video') {
        // 영상은 브라우저에서 완전한 압축이 어려우므로 원본 반환
        // 실제 압축은 서버에서 ffmpeg 등을 사용해야 함
        processedFile = file;
        preview = URL.createObjectURL(file);
        setPreviewUrl(preview);

        setCompressionInfo({
          originalSize: file.size,
          compressedSize: file.size,
          ratio: 0,
        });
      } else {
        // 폰트 파일은 압축 없이 그대로
        processedFile = file;
        setCompressionInfo({
          originalSize: file.size,
          compressedSize: file.size,
          ratio: 0,
        });
      }

      setCompressedFile(processedFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      // 파일 입력 초기화
      e.target.value = '';
    }
  };

  const handleDownload = () => {
    if (!compressedFile) return;

    const url = URL.createObjectURL(compressedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = compressedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const KB = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(KB));
    return Math.round((bytes / Math.pow(KB, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const typeLabels = {
    image: '이미지',
    video: '영상',
    font: '폰트',
  };

  const typeIcons = {
    image: FiImage,
    video: FiVideo,
    font: FiFile,
  };

  const typeAccept = {
    image: 'image/jpeg,image/png,image/gif,image/webp',
    video: 'video/mp4,video/webm,video/ogg',
    font: '.ttf,.woff,.woff2',
  };

  const Icon = typeIcons[type];

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
      <label className="block">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Icon size={18} />
          {typeLabels[type]} 선택
        </span>
        <input
          type="file"
          accept={typeAccept[type]}
          onChange={handleFileChange}
          disabled={isProcessing}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </label>

      {isProcessing && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">
            {type === 'image' ? '이미지 압축 중...' : type === 'video' ? '영상 처리 중...' : '파일 처리 중...'}
          </p>
        </div>
      )}

      {compressedFile && compressionInfo && (
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">✅ 파일 처리 완료</p>

            {/* 압축 정보 */}
            {type === 'image' && compressionInfo.ratio > 0 && (
              <div className="text-xs text-green-700 space-y-1 mb-3">
                <div className="flex justify-between">
                  <span>원본 크기:</span>
                  <span className="font-semibold">{formatFileSize(compressionInfo.originalSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>압축 크기:</span>
                  <span className="font-semibold text-blue-700">{formatFileSize(compressionInfo.compressedSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>압축률:</span>
                  <span className="font-semibold text-blue-700">{compressionInfo.ratio.toFixed(1)}% 감소</span>
                </div>
              </div>
            )}

            {type === 'video' && (
              <div className="text-xs text-yellow-700 mb-3 p-2 bg-yellow-50 rounded">
                ⚠️ 영상 압축은 브라우저에서 제한적입니다. 완전한 압축을 원하시면 서버에서 ffmpeg를 사용하세요.
              </div>
            )}

            {/* 다운로드 버튼 */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <FiDownload size={18} />
              압축된 파일 다운로드
            </button>
          </div>

          {/* 미리보기 */}
          {previewUrl && type === 'image' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-medium text-gray-700 mb-2">압축된 이미지 미리보기:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="압축된 이미지"
                className="max-w-full h-auto rounded border border-gray-300"
                onLoad={() => {
                  // 미리보기 로드 완료 후 정리
                }}
              />
            </div>
          )}

          {previewUrl && type === 'video' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-medium text-gray-700 mb-2">영상 미리보기:</p>
              <video
                src={previewUrl}
                controls
                className="max-w-full h-auto rounded border border-gray-300"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">❌ 오류</p>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
