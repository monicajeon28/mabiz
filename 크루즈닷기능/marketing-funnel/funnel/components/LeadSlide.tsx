'use client';

import React, { useState } from 'react';
import {
  User, 
  ArrowRightLeft, 
  FileCheck, 
  MousePointerClick, 
  X,
  UserPlus,
  Bot,
  Sparkles
} from 'lucide-react';

interface InfoModalProps {
  title: string;
  content: React.ReactNode;
  onClose: () => void;
  colorClass: string;
}

const InfoModal: React.FC<InfoModalProps> = ({ title, content, onClose, colorClass }) => (
  <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
    <div 
      className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up" 
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`${colorClass} p-4 flex justify-between items-center text-white`}>
        <h3 className="text-xl font-bold">{title}</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-6">
        {content}
      </div>
      <div className="bg-slate-50 p-4 text-center">
        <button 
          onClick={onClose}
          className={`px-6 py-2 rounded-full text-white font-bold shadow-md transition-transform hover:scale-105 ${colorClass}`}
        >
          확인
        </button>
      </div>
    </div>
  </div>
);

export const LeadSlide: React.FC = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const modalContent: Record<string, { title: string, color: string, content: React.ReactNode }> = {
    visitor: {
      title: "방문자 (크루즈 초심자)",
      color: "bg-slate-500",
      content: (
        <div className="space-y-4 text-slate-700">
          <p className="font-medium text-lg">&quot;크루즈 여행, 궁금하긴 한데 너무 비싸지 않을까?&quot;</p>
          <p>아직 우리 서비스를 신뢰하지 않으며, 구경만 하고 나갈 확률이 높은 상태입니다. 이들을 붙잡아야 합니다.</p>
        </div>
      )
    },
    magnet: {
      title: "AI 가이드 크루즈닷 활용 (Lead Magnet)",
      color: "bg-indigo-500",
      content: (
        <div className="space-y-4 text-slate-700">
          <p className="text-lg font-bold text-indigo-600">&quot;크루즈닷AI 3일 체험권&quot;</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
               <div className="p-2 bg-indigo-100 text-indigo-600 rounded"><Bot size={20} /></div>
               <div>
                 <span className="font-bold block">크루즈닷AI</span>
                 <span className="text-sm text-slate-500">&quot;나만의 AI 크루즈 비서를 3일간 무료로 체험해보세요.&quot;</span>
               </div>
            </div>
            <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
               <div className="p-2 bg-indigo-100 text-indigo-600 rounded"><Sparkles size={20} /></div>
               <div>
                 <span className="font-bold block">맞춤형 여행 설계</span>
                 <span className="text-sm text-slate-500">&quot;가고 싶은 여행지를 말하면 AI가 최적의 코스를 추천합니다.&quot;</span>
               </div>
            </div>
          </div>
        </div>
      )
    },
    lead: {
      title: "가망 고객 (DB 확보)",
      color: "bg-blue-600",
      content: (
        <div className="space-y-4 text-slate-700">
          <p>이제 우리는 고객의 <span className="font-bold text-blue-600">연락처</span>를 확보하고 AI 체험을 시작하게 했습니다.</p>
          <p className="text-sm text-slate-500">고객이 AI를 체험하는 동안 우리는 지속적으로 가치를 증명할 수 있습니다.</p>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm mt-2">
            ✅ <strong>결과:</strong> 익명의 방문자가 &apos;크루즈닷 사용자&apos;로 전환됨
          </div>
        </div>
      )
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-indigo-50 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-xl border border-indigo-100 overflow-hidden flex flex-col relative z-10 min-h-[80vh]">
        
        {/* Header */}
        <header className="p-8 pb-4 border-b border-slate-100">
          <div className="inline-flex items-center space-x-2 bg-indigo-50 px-3 py-1 rounded-full mb-3 text-indigo-600 border border-indigo-100">
            <span className="font-bold">Step 02</span>
            <span>Lead Generation (DB확보)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">
            연락처 확보하기
            <span className="block text-xl md:text-2xl font-normal text-slate-500 mt-1">
              &quot;AI 가이드 크루즈닷 3일 체험권 받고 시작하세요&quot;
            </span>
          </h1>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
          
          {/* Interactive Flow Diagram */}
          <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 relative">
            
            {/* Step 1: Visitor */}
            <div 
              onClick={() => setActiveModal('visitor')}
              className="group relative flex flex-col items-center cursor-pointer"
            >
              <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white transition-all duration-300 group-hover:scale-110 group-hover:border-slate-300 z-10">
                <User size={48} className="text-slate-400 group-hover:text-slate-600" />
                <div className="absolute -top-2 -right-2 bg-slate-400 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg border-2 border-white">?</div>
              </div>
              <div className="mt-4 text-center">
                <h3 className="font-bold text-lg text-slate-600 group-hover:text-slate-800">방문자</h3>
                <p className="text-sm text-slate-400">(익명)</p>
              </div>
              <div className="absolute inset-0 bg-slate-200 rounded-full animate-ping opacity-0 group-hover:opacity-20"></div>
            </div>

            {/* Exchange Zone */}
            <div className="flex-1 flex flex-col items-center px-4 relative">
              {/* Connector Lines */}
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -z-10 transform -translate-y-8"></div>
              
              <div 
                onClick={() => setActiveModal('magnet')}
                className="relative cursor-pointer group"
              >
                <div className="flex items-center justify-center gap-4 mb-2 text-indigo-300">
                   <ArrowRightLeft size={32} className="animate-pulse" />
                </div>
                
                {/* Gift Box - The Magnet */}
                <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl shadow-xl flex items-center justify-center text-white transform transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                  <div className="text-center">
                    <Bot size={32} className="mx-auto mb-1 animate-bounce" />
                    <span className="text-xs font-bold">Genie AI<br/>3일 체험</span>
                  </div>
                </div>
                
                {/* Tooltip hint */}
                <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-3 rounded-full whitespace-nowrap z-20">
                  클릭해서 &apos;AI 리드 마그넷&apos; 확인하기
                </div>
              </div>

              <div className="mt-6 text-center">
                <h3 className="font-bold text-indigo-600 text-lg">가치 교환</h3>
                <p className="text-sm text-slate-500">AI 체험 ↔ 연락처</p>
              </div>
            </div>

            {/* Step 3: Lead */}
            <div 
              onClick={() => setActiveModal('lead')}
              className="group relative flex flex-col items-center cursor-pointer"
            >
              <div className="w-24 h-24 md:w-32 md:h-32 bg-blue-50 rounded-full flex items-center justify-center shadow-lg border-4 border-white transition-all duration-300 group-hover:scale-110 group-hover:border-blue-200 z-10">
                <UserPlus size={48} className="text-blue-500 group-hover:text-blue-600" />
                <div className="absolute bottom-0 right-0 bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white">
                  <FileCheck size={16} />
                </div>
              </div>
              <div className="mt-4 text-center">
                <h3 className="font-bold text-lg text-blue-600 group-hover:text-blue-800">잠재 고객</h3>
                <p className="text-sm text-blue-400">(체험 시작)</p>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Hint */}
        <div className="p-6 text-center text-slate-400 text-sm border-t border-slate-100 bg-slate-50/50">
          <p className="flex items-center justify-center gap-2 animate-pulse">
            <MousePointerClick size={16} /> 
            <span>아이콘을 클릭하여 교환 과정을 확인하세요</span>
          </p>
        </div>

        {/* Modal Overlay */}
        {activeModal && modalContent[activeModal] && (
          <InfoModal 
            title={modalContent[activeModal].title}
            content={modalContent[activeModal].content}
            colorClass={modalContent[activeModal].color}
            onClose={() => setActiveModal(null)}
          />
        )}
      </div>
    </div>
  );
};