'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Anchor, Star, User, GraduationCap, Sparkles } from 'lucide-react';

// 후기 타입
interface Review {
  id: number;
  authorName: string;
  title: string;
  content: string;
  images: string[];
  rating: number;
  cruiseLine: string;
  shipName: string;
}

// 슬라이드 데이터
const SLIDES = [
  {
    id: 1,
    step: 'Class 1',
    title: '퍼널 마케팅 구조',
    subtitle: '크루즈 잠재고객을 탑승객으로',
    color: 'from-blue-500 to-cyan-500',
    showFunnel: true,
    funnelStages: [
      { label: '유입', width: 100, color: 'bg-blue-400', desc: '모르는 사람들에게 알리기' },
      { label: '리드 확보', width: 80, color: 'bg-indigo-400', desc: 'AI 체험권으로 연락처 확보' },
      { label: '육성/설득', width: 60, color: 'bg-violet-400', desc: '챗봇으로 맞춤 정보 제공' },
      { label: '구매 전환', width: 40, color: 'bg-fuchsia-500', desc: '고객으로 만들기' },
    ],
    videoUrl: 'https://www.youtube.com/embed/a2M1OQIPAv8?si=zgfIjTDsI0FzuFTK',
  },
  {
    id: 2,
    step: 'Class 2',
    title: '크루즈 여행객 모으기',
    subtitle: '트래픽 만들기 & 깔때기 입구 넓히기',
    color: 'from-blue-400 to-indigo-500',
    content: [
      { stage: 'Paid 광고', desc: '인스타그램, 유튜브, 구글 광고', color: 'bg-red-400', icon: '📢' },
      { stage: 'Organic 유입', desc: 'SNS 퍼스널 브랜딩 → 검색 유입', color: 'bg-green-400', icon: '🌱' },
    ],
    highlight: '고객이 스스로 찾아오게 만드는 시스템',
    videoUrl: 'https://www.youtube.com/embed/acYl4x4E6uw?si=I-I390GGrj-WdfRR',
  },
  {
    id: 3,
    step: 'Class 3',
    title: '연락처 확보하기',
    subtitle: 'AI 가이드 크루즈닷 3일 체험권 받고 시작하세요',
    color: 'from-indigo-400 to-purple-500',
    showFlow: true,
    flowSteps: [
      { label: '방문자', icon: '👤', color: 'bg-slate-500' },
      { label: '가치 교환', icon: '🔄', color: 'bg-indigo-500', isMain: true },
      { label: '잠재고객', icon: '📋', color: 'bg-blue-500' },
    ],
    videoUrl: 'https://www.youtube.com/embed/-p_6G69MgyQ?si=ZkPQIXJbBuylXFQB',
  },
  {
    id: 4,
    step: 'Class 4',
    title: '신뢰 쌓기 (Nurturing)',
    subtitle: '챗봇 크루즈닷AI로 신뢰 형성',
    color: 'from-violet-400 to-purple-500',
    showTrustMeter: true,
    trustSteps: [
      { label: 'Step 1', desc: '크루즈닷AI 시작하기', trust: 30, color: 'from-violet-300 to-violet-400' },
      { label: 'Step 2', desc: '실시간 맞춤 정보', trust: 70, color: 'from-violet-400 to-violet-500' },
      { label: 'Step 3', desc: '최적의 상품 제안', trust: 95, color: 'from-violet-500 to-purple-500' },
    ],
    videoUrl: 'https://www.youtube.com/embed/BIsNfX0-5UI?si=CWLNINzrVTdiAqnj',
  },
  {
    id: 5,
    step: 'Class 5',
    title: '고객 만들기 (Conversion)',
    subtitle: '크루즈닷과 함께라면 예약은 확신이 됩니다',
    color: 'from-emerald-400 to-teal-500',
    content: [
      { stage: '거절할 수 없는 오퍼', desc: 'AI 비서와 함께하는 여행 준비', color: 'bg-emerald-400', icon: '🎁' },
      { stage: '고객 언어 카피', desc: '고객의 불안을 먼저 읽고 해결', color: 'bg-teal-400', icon: '💬' },
      { stage: '후기와 인증', desc: '압도적인 자료로 신뢰 증명', color: 'bg-cyan-400', icon: '⭐' },
    ],
    videoUrl: 'https://www.youtube.com/embed/OIGkqQHfLgw?si=DnItf27IR0-sZ9P3',
  },
  {
    id: 6,
    step: 'Class 6',
    title: '재구매/추천 (Retention)',
    subtitle: '실제 고객 후기로 신뢰를 증명합니다',
    color: 'from-rose-400 to-pink-500',
    content: [
      { stage: '여행 후 관리', desc: '다녀온 후 경험 관리', color: 'bg-rose-400', icon: '📸' },
      { stage: '다음 여행 제안', desc: '얼리버드 혜택, 다른 지역 크루즈', color: 'bg-blue-400', icon: '🚢' },
      { stage: '친구 추천', desc: '할인 쿠폰 선물, 홍보대사화', color: 'bg-purple-400', icon: '👥' },
    ],
    highlight: '한 번 간 사람은 또 갑니다',
    showReviews: true,
  },
];

interface MiniClassViewerProps {
  className?: string;
}

export default function MiniClassViewer({ className = '' }: MiniClassViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const slide = SLIDES[currentSlide];

  // 후기 데이터 가져오기
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch('/api/public/reviews?limit=10');
        const data = await res.json();
        if (data.ok && data.reviews) {
          setReviews(data.reviews);
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      }
    };
    fetchReviews();
  }, []);

  const nextSlide = () => {
    setShowVideo(false);
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  };

  const prevSlide = () => {
    setShowVideo(false);
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  // 퍼널 도형 렌더링
  const renderFunnel = () => {
    if (!slide.funnelStages) return null;
    return (
      <div className="flex flex-col items-center gap-1 md:gap-2 py-2">
        {slide.funnelStages.map((stage, idx) => (
          <div
            key={idx}
            className="relative group"
            style={{ width: `${stage.width}%` }}
          >
            <div className={`${stage.color} py-2 md:py-3 px-3 md:px-4 rounded-lg md:rounded-xl text-center transition-all hover:scale-105 cursor-default`}>
              <div className="text-white font-bold text-xs md:text-sm">{stage.label}</div>
              <div className="text-white/70 text-[10px] md:text-xs mt-0.5">{stage.desc}</div>
            </div>
            {idx < slide.funnelStages.length - 1 && (
              <div className="flex justify-center my-1">
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-500/50"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 플로우 도형 렌더링 (Class 3)
  const renderFlow = () => {
    if (!slide.flowSteps) return null;
    return (
      <div className="flex items-center justify-center gap-2 md:gap-4 py-4">
        {slide.flowSteps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div className={`${step.color} ${step.isMain ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-900 scale-110' : ''}
              w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl flex flex-col items-center justify-center transition-all hover:scale-105`}>
              <span className="text-xl md:text-2xl">{step.icon}</span>
              <span className="text-white text-[10px] md:text-xs font-medium mt-1">{step.label}</span>
            </div>
            {idx < slide.flowSteps.length - 1 && (
              <div className="text-cyan-400 text-xl md:text-2xl animate-pulse">→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // 신뢰도 미터 렌더링 (Class 4)
  const renderTrustMeter = () => {
    if (!slide.trustSteps) return null;
    return (
      <div className="space-y-3 md:space-y-4 py-2">
        {slide.trustSteps.map((step, idx) => (
          <div key={idx} className="bg-gray-800/50 rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-cyan-400 text-xs font-bold">{step.label}</span>
                <h4 className="text-white font-bold text-sm md:text-base">{step.desc}</h4>
              </div>
              <div className="text-cyan-400 font-bold text-lg md:text-xl">{step.trust}%</div>
            </div>
            <div className="h-3 md:h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${step.color} rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${step.trust}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 일반 콘텐츠 렌더링
  const renderContent = () => {
    if (!slide.content) return null;
    return (
      <div className="space-y-2 md:space-y-3">
        {slide.content.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 md:gap-3 bg-gray-800/50 rounded-lg md:rounded-xl p-2.5 md:p-3 border border-gray-700/50 hover:border-gray-600 transition-colors"
          >
            <div className={`${item.color} w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-xl flex-shrink-0`}>
              {item.icon || idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-xs md:text-sm">{item.stage}</h4>
              <p className="text-gray-400 text-[11px] md:text-xs mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}

        {slide.highlight && (
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg md:rounded-xl p-2.5 md:p-3 mt-2 md:mt-3">
            <p className="text-cyan-400 font-bold text-center text-xs md:text-sm">
              💡 {slide.highlight}
            </p>
          </div>
        )}
      </div>
    );
  };

  // 후기 렌더링 (Class 6)
  const renderReviews = () => {
    if (!reviews.length) return renderContent();
    return (
      <div className="space-y-3">
        <div className="bg-gray-800/50 rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-700/50">
          <div className="flex items-start gap-3">
            {reviews[reviewIndex]?.images?.[0] && (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-700">
                <img
                  src={reviews[reviewIndex].images[0]}
                  alt="후기 이미지"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={i < (reviews[reviewIndex]?.rating || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
                  />
                ))}
                <span className="text-gray-400 text-[10px] ml-1">
                  {reviews[reviewIndex]?.cruiseLine} {reviews[reviewIndex]?.shipName}
                </span>
              </div>
              <h4 className="text-white font-bold text-xs md:text-sm line-clamp-1">
                {reviews[reviewIndex]?.title}
              </h4>
              <p className="text-gray-400 text-[11px] md:text-xs mt-1 leading-relaxed line-clamp-2">
                {reviews[reviewIndex]?.content}
              </p>
              <div className="flex items-center gap-1 mt-2 text-gray-500 text-[10px]">
                <User size={10} />
                <span>{reviews[reviewIndex]?.authorName}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setReviewIndex((prev) => (prev - 1 + reviews.length) % reviews.length)}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <ChevronLeft size={14} className="text-white" />
          </button>
          <span className="text-gray-400 text-xs">
            {reviewIndex + 1} / {reviews.length}
          </span>
          <button
            onClick={() => setReviewIndex((prev) => (prev + 1) % reviews.length)}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <ChevronRight size={14} className="text-white" />
          </button>
        </div>

        {slide.highlight && (
          <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/30 rounded-lg md:rounded-xl p-2.5 md:p-3">
            <p className="text-rose-400 font-bold text-center text-xs md:text-sm">
              💡 {slide.highlight}
            </p>
          </div>
        )}
      </div>
    );
  };

  // 비디오 썸네일 렌더링 (클릭하면 재생)
  const renderVideoThumbnail = () => {
    if (!slide.videoUrl) return null;

    // YouTube URL에서 비디오 ID 추출
    const videoIdMatch = slide.videoUrl.match(/embed\/([^?]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return (
      <div className="mb-4">
        {showVideo ? (
          <div className="relative w-full pb-[56.25%] bg-black rounded-lg md:rounded-xl overflow-hidden">
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`${slide.videoUrl}&autoplay=1`}
              title={slide.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div
            className="relative w-full pb-[56.25%] bg-gray-800 rounded-lg md:rounded-xl overflow-hidden cursor-pointer group"
            onClick={() => setShowVideo(true)}
          >
            {/* 썸네일 이미지 */}
            <img
              src={thumbnailUrl}
              alt={slide.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // 고해상도 썸네일 실패 시 기본 썸네일 사용
                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              }}
            />
            {/* 오버레이 */}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
            {/* 재생 버튼 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-all">
                <Play size={32} className="text-white fill-white ml-1 md:w-10 md:h-10" />
              </div>
            </div>
            {/* 클릭 안내 */}
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="bg-black/70 text-white text-xs md:text-sm px-3 py-1 rounded-full">
                클릭하여 영상 보기
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      {/* 주의 집중 배너 */}
      <div className="relative mb-4 md:mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-xl md:rounded-2xl blur-lg opacity-30 animate-pulse"></div>
        <div className="relative bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-xl md:rounded-2xl p-3 md:p-4 shadow-2xl">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            <div className="bg-white/20 p-2 rounded-full animate-bounce">
              <GraduationCap className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-black text-base md:text-xl">
                마케팅 미니 클래스
              </h3>
              <p className="text-white/90 text-[10px] md:text-sm mt-0.5">
                6개 클래스 | 좌우 버튼으로 이동 | <span className="font-bold underline">영상 클릭시 강의 재생</span>
              </p>
            </div>
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-yellow-200 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
      </div>

      {/* 메인 컨테이너 */}
      <div className="bg-gray-900 rounded-xl md:rounded-2xl overflow-hidden border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20">

        {/* 헤더 */}
        <div className={`bg-gradient-to-r ${slide.color} p-3 md:p-4`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-white/20 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                <Anchor size={16} className="text-white md:w-5 md:h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-white/80 text-[10px] md:text-xs font-medium">{slide.step}</span>
                <h3 className="text-white font-bold text-sm md:text-lg leading-tight truncate">{slide.title}</h3>
              </div>
            </div>
            <div className="text-white/90 text-xs font-medium bg-white/20 px-2 py-0.5 md:px-3 md:py-1 rounded-full flex-shrink-0">
              {currentSlide + 1}/{SLIDES.length}
            </div>
          </div>
          <p className="text-white/80 text-xs md:text-sm mt-1.5 md:mt-2 pl-8 md:pl-11 line-clamp-1">{slide.subtitle}</p>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="p-3 md:p-5">
          {/* 영상 썸네일 (상단에 표시) */}
          {slide.videoUrl && renderVideoThumbnail()}

          {/* 도형/콘텐츠 (영상 아래에 표시) */}
          {!showVideo && (
            <>
              {slide.showFunnel ? (
                renderFunnel()
              ) : slide.showFlow ? (
                renderFlow()
              ) : slide.showTrustMeter ? (
                renderTrustMeter()
              ) : slide.showReviews && reviews.length > 0 ? (
                renderReviews()
              ) : (
                renderContent()
              )}
            </>
          )}
        </div>

        {/* 네비게이션 */}
        <div className="bg-gray-800/50 p-3 md:p-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            {/* 이전 버튼 */}
            <button
              onClick={prevSlide}
              className="flex items-center justify-center gap-1 px-4 py-2.5 md:px-6 md:py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg md:rounded-xl transition-colors text-sm md:text-base font-medium"
            >
              <ChevronLeft size={18} className="md:w-5 md:h-5" />
              <span>이전</span>
            </button>

            {/* 다음 버튼 */}
            <button
              onClick={nextSlide}
              className="flex items-center justify-center gap-1 px-4 py-2.5 md:px-6 md:py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg md:rounded-xl transition-colors text-sm md:text-base font-medium"
            >
              <span>다음</span>
              <ChevronRight size={18} className="md:w-5 md:h-5" />
            </button>
          </div>

          {/* 진행률 표시 */}
          <div className="flex gap-1.5 md:gap-2 mt-3 md:mt-4 justify-center">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setShowVideo(false);
                  setCurrentSlide(idx);
                }}
                className={`h-2 md:h-2.5 rounded-full transition-all ${
                  idx === currentSlide
                    ? 'w-8 md:w-10 bg-cyan-400'
                    : 'w-2 md:w-2.5 bg-gray-600 hover:bg-gray-500'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 하단 안내 */}
      <div className="mt-3 md:mt-4 text-center">
        <p className="text-gray-400 text-[10px] md:text-xs">
          ← → 버튼으로 클래스 이동 | <span className="text-red-400 font-medium">영상을 클릭</span>하여 강의를 시청하세요
        </p>
      </div>
    </div>
  );
}
