'use client';

import React, { useState } from 'react';
import {
  Instagram, 
  Youtube, 
  Search, 
  Megaphone, 
  Monitor, 
  MousePointerClick, 
  Target, 
  Lightbulb, 
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Plane,
  Camera,
  Map,
  Globe
} from 'lucide-react';

export const TrafficSlide: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>('channels');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-blue-50 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-float" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-cyan-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-float" style={{ animationDelay: '1.5s' }} />

      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-xl border border-blue-100 overflow-hidden flex flex-col relative z-10 min-h-[80vh]">
        
        {/* Header */}
        <header className="p-8 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-full mb-3 text-blue-600 border border-blue-100">
              <span className="font-bold">Step 01</span>
              <span>Awareness (인지)</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">
              크루즈 여행객 모으기
              <span className="block text-xl md:text-2xl font-normal text-slate-500 mt-1">
                트래픽 만들기 & 깔때기 입구 넓히기
              </span>
            </h1>
          </div>
          <div className="hidden md:block">
            <Plane className="w-12 h-12 text-blue-200 rotate-45" />
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex flex-col lg:flex-row p-6 md:p-10 gap-8 lg:gap-16">
          
          {/* Left Column: Interactive Visual Diagram */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] relative bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <h3 className="absolute top-4 left-6 text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Map size={16} /> Traffic Flow
            </h3>
            
            <div className="relative w-full max-w-lg h-80 flex items-center justify-center">
              
              {/* Central Hub (Landing Page) */}
              <div className="absolute right-0 md:right-10 top-1/2 transform -translate-y-1/2 z-20 flex flex-col items-center">
                <div className="w-24 h-24 bg-white rounded-xl shadow-xl border-2 border-blue-500 flex items-center justify-center relative z-10">
                   <Globe className="w-10 h-10 text-blue-600" />
                </div>
                <span className="mt-3 font-bold text-slate-700 bg-white px-3 py-1 rounded-full shadow-sm text-sm border text-center">크루즈닷<br/>(Cruise Dot)</span>
                {/* Pulse Effect */}
                <div className="absolute inset-0 bg-blue-400 rounded-xl animate-ping opacity-20 z-0"></div>
              </div>

              {/* Sources */}
              <div className="absolute left-0 md:left-4 top-0 bottom-0 flex flex-col justify-between py-4 w-1/2">
                
                {/* Source 1: Social Ads */}
                <div className="flex items-center gap-3 group">
                   <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white shadow-lg transform transition-transform group-hover:scale-110">
                     <Instagram size={24} />
                   </div>
                   <div className="hidden md:block absolute left-16 bg-white border px-2 py-1 rounded text-xs text-slate-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                       인스타그램 / 유튜브 광고
                   </div>
                   <div className="h-0.5 flex-1 bg-slate-200 relative overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400 to-transparent w-1/2 animate-[dash_1s_linear_infinite]" />
                   </div>
                </div>

                {/* Source 2: Organic Search / Branding */}
                <div className="flex items-center gap-3 group ml-8">
                   <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg transform transition-transform group-hover:scale-110">
                     <Search size={24} />
                   </div>
                   <div className="hidden md:block absolute left-24 bg-white border px-2 py-1 rounded text-xs text-slate-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                       SNS 퍼스널 브랜딩 → 검색 유입
                   </div>
                   <div className="h-0.5 flex-1 bg-slate-200 relative overflow-hidden transform rotate-6 origin-left">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400 to-transparent w-1/2 animate-[dash_1.5s_linear_infinite]" />
                   </div>
                </div>

                {/* Source 3: Google Ads */}
                <div className="flex items-center gap-3 group">
                   <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white shadow-lg transform transition-transform group-hover:scale-110">
                     <Megaphone size={24} />
                   </div>
                   <div className="hidden md:block absolute left-16 bg-white border px-2 py-1 rounded text-xs text-slate-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                       구글(Google) 검색 광고
                   </div>
                   <div className="h-0.5 flex-1 bg-slate-200 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400 to-transparent w-1/2 animate-[dash_1.2s_linear_infinite]" />
                   </div>
                </div>

              </div>

              {/* Connecting Lines (SVG overlay for smoother look) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40">
                 <path d="M80 50 C 150 50, 200 150, 300 160" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                 <path d="M110 160 C 180 160, 220 160, 300 160" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                 <path d="M80 270 C 150 270, 200 170, 300 160" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
              </svg>

            </div>
          </div>

          {/* Right Column: Content Cards */}
          <div className="flex-1 space-y-4">
            
            {/* Goal Section */}
            <div 
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-default"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">핵심 목표</h3>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    크루즈 여행을 꿈꾸는 잠재 고객을 우리 <span className="font-bold text-blue-600">&apos;크루즈닷&apos; 페이지</span>로 유입시키는 것
                  </p>
                </div>
              </div>
            </div>

            {/* Channels Section (Expandable) */}
            <div 
              onClick={() => toggleSection('channels')}
              className={`bg-white border rounded-xl overflow-hidden cursor-pointer transition-all duration-300
                ${expandedSection === 'channels' ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'border-slate-200 hover:border-indigo-300'}
              `}
            >
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg transition-colors ${expandedSection === 'channels' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                    <Camera size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">주요 여행 채널 (Channels)</h3>
                </div>
                {expandedSection === 'channels' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </div>
              
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedSection === 'channels' ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-5 pt-0 pl-[5.5rem] space-y-4">
                  <div>
                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded mb-1">Paid (광고)</span>
                    <p className="text-slate-600 text-sm">인스타그램, 유튜브, 구글 광고</p>
                  </div>
                  <div>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded mb-1">Organic (자연유입)</span>
                    <p className="text-slate-600 text-sm">SNS 퍼스널 브랜딩 지원 시스템 전략 → 검색 유입</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategy Section (Expandable) */}
            <div 
              onClick={() => toggleSection('strategy')}
              className={`bg-white border rounded-xl overflow-hidden cursor-pointer transition-all duration-300
                ${expandedSection === 'strategy' ? 'border-amber-500 ring-1 ring-amber-500 shadow-md' : 'border-slate-200 hover:border-amber-300'}
              `}
            >
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg transition-colors ${expandedSection === 'strategy' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'}`}>
                    <Lightbulb size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">크루즈닷의 유입 전략</h3>
                </div>
                {expandedSection === 'strategy' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </div>
              
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedSection === 'strategy' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-5 pt-0 pl-[5.5rem]">
                   <p className="text-slate-700 font-medium">
                     &quot;고객이 스스로 찾아오게 만드는 시스템&quot;
                   </p>
                   <ul className="list-disc list-inside mt-2 text-sm text-slate-500 space-y-1">
                     <li>SNS를 통한 강력한 퍼스널 브랜딩 지원</li>
                     <li>크루즈닷 플랫폼으로의 자연스러운 유입 연결</li>
                   </ul>
                </div>
              </div>
            </div>

          </div>
        </div>
        
        {/* Footer Hint */}
        <div className="p-4 text-center text-slate-400 text-sm border-t border-slate-100 bg-slate-50/50 flex items-center justify-center gap-2">
           <MousePointerClick size={16} /> <span>카드를 클릭하여 상세 채널 전략을 확인하세요</span>
        </div>

      </div>
    </div>
  );
};