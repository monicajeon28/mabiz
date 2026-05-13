// components/mall/product-detail/ImageGallery.tsx
'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

// SSRF 방어: hostname으로 정확히 체크 (includes() 우회 불가)
// function 선언으로 호이스팅 보장 — ImageGallery 컴포넌트 인라인 iframe에도 적용
function isAllowedVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'youtu.be' ||
      parsed.hostname === 'www.youtu.be'
    );
  } catch {
    return false;
  }
}

interface ImageGalleryProps {
  thumbnail: string | null | undefined;
  images: string[];
  videos: string[];
  detailBlocksCount: number;
  koreanShipName: string;
  displayCruiseLine: string;
  cruiseLine: string;
  shipName: string;
  packageName: string;
  getProxyImageUrl: (url: string | null | undefined) => string;
  // 외부에서 이미지/동영상 모달 제어를 위한 콜백
  onOpenImageModal: (url: string) => void;
  onOpenVideoModal: (url: string) => void;
  // 현재 선택된 인덱스 (부모에서 관리)
  selectedImageIndex: number;
  selectedVideoIndex: number;
  onSelectImage: (index: number) => void;
  onSelectVideo: (index: number) => void;
}

export function ImageGallery({
  thumbnail,
  images,
  videos,
  detailBlocksCount,
  koreanShipName,
  displayCruiseLine,
  cruiseLine,
  shipName,
  packageName,
  getProxyImageUrl,
  onOpenImageModal,
  onOpenVideoModal,
  selectedImageIndex,
  selectedVideoIndex,
  onSelectImage,
  onSelectVideo,
}: ImageGalleryProps) {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const totalSlides = images.length;
  const canSwipe = totalSlides > 1 && !thumbnail;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0]?.clientX ?? 0;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) {
      // 왼쪽 스와이프 → 다음
      onSelectImage(Math.min(selectedImageIndex + 1, totalSlides - 1));
    } else {
      // 오른쪽 스와이프 → 이전
      onSelectImage(Math.max(selectedImageIndex - 1, 0));
    }
    onSelectVideo(-1);
  };

  return (
    <div className="mb-6">
      {/* 메인 이미지/비디오 - 썸네일 우선 표시 */}
      <div
        className="relative aspect-[4/3] sm:aspect-auto sm:h-80 md:h-[500px] bg-gradient-to-br from-[#051C2C] to-[#0A2E46] md:rounded-2xl overflow-hidden mb-4 md:mb-6 md:shadow-2xl -mx-3 md:mx-0"
        onTouchStart={canSwipe ? handleTouchStart : undefined}
        onTouchEnd={canSwipe ? handleTouchEnd : undefined}
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getProxyImageUrl(thumbnail)}
            alt={`${cruiseLine} ${shipName} - ${packageName} 크루즈 여행 상품 썸네일`}
            className="w-full h-full object-contain cursor-zoom-in active:opacity-80 transition-opacity"
            onClick={() => thumbnail && onOpenImageModal(getProxyImageUrl(thumbnail))}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : videos.length > 0 && selectedVideoIndex >= 0 && selectedVideoIndex < videos.length ? (
          isAllowedVideoUrl(videos[selectedVideoIndex] ?? '') ? (
            <iframe
              src={videos[selectedVideoIndex] ?? ''}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (videos[selectedVideoIndex] ?? '').startsWith('http') ? (
            <video
              src={videos[selectedVideoIndex] ?? ''}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white text-sm">
              유효하지 않은 동영상 링크입니다.
            </div>
          )
        ) : images.length > 0 && selectedImageIndex >= 0 && selectedImageIndex < images.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getProxyImageUrl(images[selectedImageIndex])}
            alt={`${cruiseLine} ${shipName} - ${packageName} 크루즈 여행 상품 썸네일`}
            className="w-full h-full object-contain cursor-zoom-in active:opacity-80 transition-opacity"
            onClick={() => onOpenImageModal(getProxyImageUrl(images[selectedImageIndex]))}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              <p className="text-4xl font-bold">{koreanShipName}</p>
              <p className="text-lg mt-2">{displayCruiseLine}</p>
            </div>
          </div>
        )}

        {/* 모바일 화살표 버튼 — 이미지 2장 이상, 썸네일 없을 때 */}
        {canSwipe && (
          <>
            <button
              onClick={() => { onSelectImage(Math.max(selectedImageIndex - 1, 0)); onSelectVideo(-1); }}
              disabled={selectedImageIndex <= 0}
              aria-disabled={selectedImageIndex <= 0}
              className="absolute left-1 top-1/2 -translate-y-1/2 md:hidden z-10 w-11 h-11 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-20 active:bg-black/60 transition"
              aria-label="이전 이미지"
            >
              <FiChevronLeft size={20} />
            </button>
            <button
              onClick={() => { onSelectImage(Math.min(selectedImageIndex + 1, totalSlides - 1)); onSelectVideo(-1); }}
              disabled={selectedImageIndex >= totalSlides - 1}
              aria-disabled={selectedImageIndex >= totalSlides - 1}
              className="absolute right-1 top-1/2 -translate-y-1/2 md:hidden z-10 w-11 h-11 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-20 active:bg-black/60 transition"
              aria-label="다음 이미지"
            >
              <FiChevronRight size={20} />
            </button>
            {/* 도트 인디케이터 */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 md:hidden z-10">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { onSelectImage(i); onSelectVideo(-1); }}
                  className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={`이미지 ${i + 1}`}
                >
                  <span className={`block w-2 h-2 rounded-full transition-all ${i === selectedImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 썸네일 갤러리 - detailBlocks가 없을 때만 표시 (하위 호환성) */}
      {detailBlocksCount === 0 && (images.length > 1 || videos.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {videos.map((video: string, index: number) => (
            <button
              key={`video-${index}`}
              onClick={() => {
                onSelectVideo(index);
                onSelectImage(-1);
              }}
              className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border transition-all ${
                selectedVideoIndex === index ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                <span className="text-xs md:text-sm">🎥 {index + 1}</span>
              </div>
            </button>
          ))}
          {images.map((image: string, index: number) => (
            <button
              key={`image-${index}`}
              onClick={() => {
                onSelectImage(index);
                onSelectVideo(-1);
              }}
              className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border transition-all ${
                selectedImageIndex === index ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getProxyImageUrl(image)}
                alt={`${cruiseLine} ${shipName} - ${packageName} 크루즈 여행 상세 이미지 ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 이미지 확대 모달
interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  if (typeof window === 'undefined' || !imageUrl) return null;
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-7xl w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full z-10"
        >
          <FiX size={24} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="확대 이미지"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>,
    document.body
  );
}

// 동영상 확대 모달
interface VideoModalProps {
  videoUrl: string | null;
  onClose: () => void;
}

export function VideoModal({ videoUrl, onClose }: VideoModalProps) {
  if (typeof window === 'undefined' || !videoUrl) return null;
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-7xl w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full z-10"
        >
          <FiX size={24} />
        </button>
        <div className="w-full max-w-5xl" style={{ aspectRatio: '16/9' }}>
          {isAllowedVideoUrl(videoUrl) ? (
            <iframe
              src={videoUrl}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white text-sm">
              허용되지 않는 URL입니다.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
