'use client';

import React, { useState } from 'react';
import {
  Timer, 
  ShieldCheck, 
  Star, 
  MousePointerClick,
  Info,
  PhoneCall,
  Bot
} from 'lucide-react';

export const ConversionSlide: React.FC = () => {
  const [activeElement, setActiveElement] = useState<string | null>(null);

  const elements = {
    offer: {
      title: "거절할 수 없는 오퍼 (Offer)",
      desc: "\"3일 동안 크루즈닷AI와 함께 여행 준비를 시작하세요.\" AI 비서와 함께라면 복잡한 크루즈 여행도 쉽습니다."
    },
    copy: {
      title: "고객 언어 카피라이팅",
      desc: "\"처음 크루즈 여행, 어떻게 해야 할지 막막하신가요?\" 고객의 불안한 마음을 먼저 읽고 해결책을 제시합니다."
    },
    proof: {
      title: "후기와 인증 (Social Proof)",
      desc: "크루즈닷에는 이미 수많은 다녀온 고객들의 후기와 이미지 갤러리가 있습니다. 압도적인 자료로 신뢰를 증명합니다."
    },
    risk: {
      title: "위험 제거 (Risk Reversal)",
      desc: "\"당신의 여행을 준비부터 여행 중, 그 이후까지 함께합니다.\" 여행의 전 과정을 책임진다는 메시지로 불안을 제거합니다."
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-emerald-50 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-emerald-100/40 via-transparent to-transparent opacity-50" />

      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden flex flex-col relative z-10 min-h-[80vh]">
        
        {/* Header */}
        <header className="p-8 pb-4 border-b border-slate-100">
          <div className="inline-flex items-center space-x-2 bg-emerald-50 px-3 py-1 rounded-full mb-3 text-emerald-600 border border-emerald-100">
            <span className="font-bold">Step 04</span>
            <span>Conversion (구매/예약)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">
            고객 만들기 (Conversion)
            <span className="block text-xl md:text-2xl font-normal text-slate-500 mt-1">
              &quot;크루즈닷과 함께라면 예약은 확신이 됩니다&quot;
            </span>
          </h1>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row p-6 md:p-10 gap-8">
          
          {/* Mock Sales Page */}
          <div className="flex-1 bg-slate-100 rounded-xl p-4 md:p-8 border-4 border-slate-200 shadow-inner overflow-y-auto max-h-[500px] scrollbar-hide relative">
             <div className="absolute top-0 left-0 right-0 bg-slate-200 h-6 rounded-t-lg flex items-center px-4 space-x-2 border-b border-slate-300">
               <div className="w-3 h-3 rounded-full bg-red-400"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
               <div className="w-3 h-3 rounded-full bg-green-400"></div>
             </div>

             <div className="mt-6 bg-white shadow-xl min-h-[600px] p-6 md:p-10 space-y-8 animate-slide-up">
               
               {/* Headline Area */}
               <div 
                 onClick={() => setActiveElement('copy')}
                 className="space-y-4 cursor-pointer hover:ring-2 hover:ring-blue-400 rounded-lg p-2 transition-all"
               >
                 <div className="h-4 bg-slate-200 w-1/3 mx-auto rounded"></div>
                 <h2 className="text-2xl md:text-3xl font-black text-center text-slate-900 leading-tight">
                   처음 크루즈 여행,<br/>
                   <span className="bg-yellow-200 px-2">어떻게 해야 할지 막막하신가요?</span>
                 </h2>
                 <p className="text-center text-slate-500">복잡한 준비는 크루즈닷에게 맡기고 설렘만 가져가세요.</p>
               </div>

               {/* Video/Image Placeholder */}
               <div className="w-full aspect-video bg-blue-900 rounded-xl flex items-center justify-center text-white/50 relative overflow-hidden group">
                 <img 
                    src="https://images.unsplash.com/photo-1548574505-5e239809ee19?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
                    alt="Cruise" 
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                 />
                 <div className="absolute inset-0 bg-black/20"></div>
                 <span className="relative z-10 font-bold tracking-widest border-2 border-white px-4 py-2 rounded">CRUISE DOT GALLERY</span>
               </div>

               {/* Social Proof */}
               <div 
                 onClick={() => setActiveElement('proof')}
                 className="flex justify-center space-x-4 py-4 border-y border-slate-100 cursor-pointer hover:ring-2 hover:ring-blue-400 rounded-lg transition-all"
               >
                 <div className="flex items-center text-yellow-400 space-x-1">
                   {[1,2,3,4,5].map(i => <Star key={i} size={20} fill="currentColor" />)}
                 </div>
                 <span className="font-bold text-slate-700">크루즈닷 실제 후기 & 갤러리</span>
               </div>

               {/* The Offer & CTA */}
               <div 
                 onClick={() => setActiveElement('offer')}
                 className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center space-y-6 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
               >
                 <h3 className="text-xl font-bold text-emerald-800">크루즈닷AI와 함께하는 3일의 기적!</h3>
                 <div className="flex justify-center">
                    <Bot size={48} className="text-emerald-500 animate-bounce" />
                 </div>
                 <ul className="text-left text-sm space-y-2 max-w-xs mx-auto text-emerald-700">
                   <li>✅ 내 취향 완벽 분석 AI 코스 추천</li>
                   <li>✅ 3일 동안 무료로 무제한 질문 가능</li>
                   <li>✅ 준비부터 예약까지 원스톱 케어</li>
                 </ul>
                 
                 <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-4 rounded-lg shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2 animate-pulse">
                   <PhoneCall size={24} />
                   AI와 여행 준비 시작하기
                 </button>
               </div>

               {/* Risk Reversal & Urgency */}
               <div className="flex justify-between items-center gap-4 text-xs md:text-sm">
                 <div 
                    onClick={() => setActiveElement('risk')}
                    className="flex items-center gap-2 text-slate-600 cursor-pointer hover:text-blue-600 p-2 rounded hover:bg-slate-50 w-full justify-center"
                  >
                   <ShieldCheck size={20} className="text-emerald-500" />
                   <span className="font-bold">당신의 여행을 처음부터 끝까지 함께합니다</span>
                 </div>
               </div>

             </div>
          </div>

          {/* Tutorial Panel */}
          <div className="lg:w-1/3 flex flex-col justify-center">
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg h-full max-h-[500px] flex flex-col">
                <div className="mb-4 flex items-center gap-2 text-slate-800">
                  <Info className="text-blue-500" />
                  <h3 className="font-bold text-lg">판매 페이지 분석</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                   {Object.entries(elements).map(([key, data]) => (
                     <div 
                       key={key}
                       className={`p-4 rounded-xl border transition-all duration-300 ${activeElement === key ? 'bg-blue-50 border-blue-500 shadow-md transform scale-105' : 'bg-slate-50 border-transparent opacity-60'}`}
                     >
                       <h4 className="font-bold text-slate-800 mb-2">{data.title}</h4>
                       <p className="text-sm text-slate-600">{data.desc}</p>
                     </div>
                   ))}
                   
                   {!activeElement && (
                     <div className="text-center text-slate-400 py-10">
                       <MousePointerClick className="mx-auto mb-2 opacity-50" size={32} />
                       <p>왼쪽 페이지 요소를 클릭하여<br/>숨겨진 의도를 파악해보세요.</p>
                     </div>
                   )}
                </div>
                
                {activeElement && (
                  <button 
                    onClick={() => setActiveElement(null)}
                    className="mt-4 w-full py-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 font-bold text-sm"
                  >
                    전체 보기
                  </button>
                )}
             </div>
          </div>

        </div>

        {/* Footer Hint */}
        <div className="p-4 text-center text-slate-400 text-sm border-t border-slate-100 bg-slate-50/50">
           <p className="flex items-center justify-center gap-2">
             <MousePointerClick size={16} /> 
             <span>페이지의 각 구역을 클릭해보세요!</span>
           </p>
        </div>

      </div>
    </div>
  );
};