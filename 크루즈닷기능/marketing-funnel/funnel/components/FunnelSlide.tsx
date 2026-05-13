'use client';

import React, { useState, useEffect } from 'react';
import { FUNNEL_DATA, RETENTION_DATA } from './constants';
import { FunnelSegment } from './FunnelSegment';
import { ArrowRight, Sparkles, MessageCircleHeart, Anchor, X, ExternalLink, PlayCircle } from 'lucide-react';
import { FunnelStageId } from './types';

// Helper to construct YouTube embed URL with autoplay and mute (required for browser policy)
const getAutoPlayUrl = (baseUrl: string) => {
  if (!baseUrl) return '';
  const separator = baseUrl.includes('?') ? '&' : '?';
  // mute=1 is essential for autoplay to work in most modern browsers (Chrome/Safari) without user interaction on the frame itself
  return `${baseUrl}${separator}autoplay=1&mute=1`;
};

// Content mapping for videos and links using exact user-provided URLs
const CONTENT_MAP: Record<string, { type: 'video' | 'website'; url: string; title: string; description?: string }> = {
  [FunnelStageId.AWARENESS]: {
    type: 'video',
    url: 'https://www.youtube.com/embed/acYl4x4E6uw?si=I-I390GGrj-WdfRR',
    title: '1단계: 유입 (Traffic)',
    description: '크루즈 여행을 꿈꾸는 사람들을 모으는 유입 전략'
  },
  [FunnelStageId.LEAD]: {
    type: 'video',
    url: 'https://www.youtube.com/embed/-p_6G69MgyQ?si=ZkPQIXJbBuylXFQB',
    title: '2단계: 리드 확보 (Lead Gen)',
    description: 'AI 가이드 크루즈닷 3일 체험권으로 연락처 확보하기'
  },
  [FunnelStageId.NURTURE]: {
    type: 'video',
    url: 'https://www.youtube.com/embed/AJmcUkNYaTE?si=CVxJLvEy7e45oX6C',
    title: '3단계: 육성 (Nurturing)',
    description: '크루즈닷 회원 전용 라이브 방송 쇼핑지원 및 정보 제공'
  },
  [FunnelStageId.CONVERSION]: {
    type: 'video',
    url: 'https://www.youtube.com/embed/EnKJo9Ax6ys?si=tU58ixDOEZAuh9dM',
    title: '4단계: 구매 전환 (Conversion)',
    description: '구매를 유도하는 결정적인 제안'
  },
  [FunnelStageId.RETENTION]: {
    type: 'website',
    url: 'https://www.cruisedot.co.kr/community',
    title: '재구매/추천 (Retention)',
    description: '실제 고객들의 생생한 여행 후기'
  }
};

export const FunnelSlide: React.FC = () => {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auto-select first stage after animation
    const timer = setTimeout(() => setActiveStage(FUNNEL_DATA[0].id), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleStageClick = (id: string) => {
    setActiveStage(id);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const currentContent = activeStage ? CONTENT_MAP[activeStage] : null;

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-slate-50 relative overflow-hidden">
      {/* Decorative Background Elements - Ocean Theme */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-cyan-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{ animationDelay: '1s' }} />

      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative z-10 min-h-[80vh]">
        
        {/* Header */}
        <header className="p-8 pb-4 text-center border-b border-slate-100">
          <div className="inline-flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-full mb-4 border border-blue-100">
            <Anchor size={14} className="text-blue-600 animate-pulse" />
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Cruise Guide Genie Strategy</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight">
            퍼널 마케팅 구조 <span className="text-blue-300 font-light hidden md:inline">|</span> 
            <span className="block md:inline mt-2 md:mt-0 text-xl md:text-3xl font-medium text-slate-600 md:ml-4">
               크루즈 잠재고객을 <span className="text-blue-600">탑승객</span>으로
            </span>
          </h1>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row p-6 md:p-12 items-center justify-center gap-12">
          
          {/* Left Column: Visual Funnel */}
          <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <div className="relative w-full max-w-md flex flex-col items-center">
              
              {/* Funnel Stack */}
              <div className="w-full filter drop-shadow-xl space-y-0.5">
                {FUNNEL_DATA.map((item, index) => (
                  <FunnelSegment
                    key={item.id}
                    item={item}
                    index={index}
                    isActive={activeStage === item.id}
                    onClick={() => handleStageClick(item.id)}
                  />
                ))}
              </div>

              {/* Spout / Arrow down */}
              <div className="h-8 w-2 bg-slate-300 mb-2 mt-[-4px] rounded-b-full"></div>

              {/* Retention Loop Visual */}
              <div 
                className={`relative mt-2 p-4 rounded-full border-4 border-dashed border-cyan-300 bg-cyan-50 cursor-pointer transition-all duration-500 group
                  ${activeStage === RETENTION_DATA.id ? 'scale-110 shadow-cyan-200 shadow-xl border-solid' : 'hover:scale-105 hover:border-cyan-400'}
                `}
                onClick={() => handleStageClick(RETENTION_DATA.id)}
              >
                <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin-slow opacity-50"></div>
                <div className="flex items-center space-x-2 text-cyan-700 font-bold px-4 py-2">
                  <RETENTION_DATA.icon className={`w-6 h-6 ${activeStage === RETENTION_DATA.id ? 'animate-spin' : ''}`} />
                  <span>재구매/추천</span>
                </div>
                {activeStage === RETENTION_DATA.id && (
                   <div className="absolute -right-2 -top-2">
                     <Sparkles className="text-yellow-400 w-6 h-6 animate-bounce" />
                   </div>
                )}
              </div>
              
            </div>
          </div>

          {/* Right Column: Descriptions */}
          <div className="flex-1 w-full max-w-xl h-full flex flex-col justify-center">
             <div className="space-y-4 relative min-h-[400px]">
                {/* Background line connecting items */}
                <div className="absolute left-[28px] top-8 bottom-8 w-0.5 bg-slate-200 hidden md:block"></div>

                {[...FUNNEL_DATA, RETENTION_DATA].map((item, idx) => {
                  const isActive = activeStage === item.id;
                  const Icon = item.icon;
                  
                  // Contextual descriptions for Cruise Guide Genie
                  let contextualTitle = item.title;
                  let contextualDesc = item.description;

                  if (item.id === 'awareness') {
                    contextualDesc = "여행을 꿈꾸는 사람들을 '크루즈닷' 페이지로 유입시키기";
                  } else if (item.id === 'lead') {
                    contextualDesc = "크루즈닷AI 3일 체험을 제공하고 연락처 확보";
                  } else if (item.id === 'nurture') {
                    contextualDesc = "챗봇 크루즈닷AI로 궁금한 정보를 직관적으로 해결해주며 신뢰 쌓기";
                  } else if (item.id === 'conversion') {
                    contextualDesc = "3일간 AI와 함께 여행을 준비하며 예약 유도하기";
                  } else if (item.id === 'retention') {
                    contextualDesc = "다녀온 고객의 후기 공유 및 재예약 유도";
                  }

                  return (
                    <div 
                      key={item.id}
                      onClick={() => handleStageClick(item.id)}
                      className={`
                        relative flex items-center p-4 rounded-xl transition-all duration-500 cursor-pointer border group
                        ${isActive 
                          ? 'bg-white shadow-xl border-blue-200 scale-100 md:scale-105 z-10' 
                          : 'bg-transparent border-transparent hover:bg-slate-50 opacity-60 hover:opacity-100'
                        }
                      `}
                    >
                      {/* Connector Dot */}
                      <div className={`hidden md:flex absolute left-[20px] w-4 h-4 rounded-full border-2 border-white shadow-sm transition-colors duration-300 z-10
                        ${isActive ? item.color.replace('bg-', 'bg-') : 'bg-slate-300'}
                      `} />

                      {/* Icon Box */}
                      <div className={`
                        flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mr-5 shadow-inner text-white transition-all duration-300
                        ${isActive ? `bg-gradient-to-br ${item.gradient}` : 'bg-slate-200 text-slate-400'}
                      `}>
                        <Icon size={24} />
                      </div>

                      {/* Text Content */}
                      <div className="flex-1">
                        <h3 className={`text-lg md:text-xl font-bold transition-colors ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                          {contextualTitle}
                        </h3>
                        <p className={`text-sm md:text-base transition-colors ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                          {contextualDesc}
                        </p>
                      </div>

                      {/* Active Indicator / Play Button */}
                      <div className={`transition-all duration-300 transform ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200">
                           <PlayCircle size={20} className="fill-current" />
                        </div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 text-center text-slate-400 text-sm border-t border-slate-100 bg-slate-50/50">
          <p className="flex items-center justify-center gap-2">
            <MessageCircleHeart size={16} /> 
            <span>단계를 클릭하여 크루즈닷 교육 영상을 시청하세요.</span>
          </p>
        </div>

        {/* Video/Web Content Modal */}
        {modalOpen && currentContent && (
          <div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={closeModal}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    {currentContent.type === 'video' ? <PlayCircle size={20} /> : <MessageCircleHeart size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{currentContent.title}</h3>
                    {currentContent.description && <p className="text-slate-400 text-xs">{currentContent.description}</p>}
                  </div>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 bg-black relative">
                {currentContent.type === 'video' ? (
                  <div className="relative w-full h-0 pb-[56.25%]"> {/* 16:9 Aspect Ratio */}
                    <iframe 
                      className="absolute top-0 left-0 w-full h-full"
                      src={getAutoPlayUrl(currentContent.url)}
                      title={currentContent.title}
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div className="w-full h-[70vh] bg-white relative">
                     <iframe 
                       src={currentContent.url} 
                       className="w-full h-full border-0"
                       title="Cruisedot Community"
                     />
                     {/* Overlay button in case iframe is blocked or for better UX */}
                     <div className="absolute bottom-6 right-6 flex gap-2">
                        <a 
                          href={currentContent.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg font-bold transition-transform hover:scale-105"
                        >
                          <ExternalLink size={18} />
                          새 창에서 열기
                        </a>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
