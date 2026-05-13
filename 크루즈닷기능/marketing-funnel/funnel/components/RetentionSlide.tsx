'use client';

import React, { useState } from 'react';
import {
  RefreshCw, 
  Gift, 
  Users, 
  TrendingUp,
  Heart,
  MousePointerClick,
  Sparkles,
  Plane
} from 'lucide-react';

export const RetentionSlide: React.FC = () => {
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const stages = {
    retention: {
      id: 'retention',
      title: "여행 후 경험 관리 (Onboarding)",
      icon: Heart,
      color: "text-rose-500",
      desc: "여행은 돌아온 후가 진짜입니다. '다녀오시느라 고생하셨습니다' 메시지와 함께 여행 사진 정리를 돕거나 설문조사를 보냅니다."
    },
    upsell: {
      id: 'upsell',
      title: "다음 여행 제안 (Cross-sell)",
      icon: TrendingUp,
      color: "text-blue-500",
      desc: "크루즈에 만족한 고객에게 '내년 얼리버드 혜택'이나 '다른 지역 크루즈'를 제안합니다. 한 번 간 사람은 또 갑니다."
    },
    referral: {
      id: 'referral',
      title: "여행 친구 추천 (Referral)",
      icon: Users,
      color: "text-purple-500",
      desc: "\"친구에게 10만원 할인 쿠폰을 선물하세요.\" 만족한 고객을 우리 크루즈닷의 홍보대사로 만듭니다."
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-slate-50 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>

      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative z-10 min-h-[80vh]">
        
        {/* Header */}
        <header className="p-8 pb-4 border-b border-slate-100">
          <div className="inline-flex items-center space-x-2 bg-rose-50 px-3 py-1 rounded-full mb-3 text-rose-600 border border-rose-100">
            <span className="font-bold">Step 05</span>
            <span>Retention & Referral</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">
            퍼널의 완성: 끝이 아닌 새로운 여행
            <span className="block text-xl md:text-2xl font-normal text-slate-500 mt-1">
              &quot;한 번 고객을 평생 여행 친구로&quot;
            </span>
          </h1>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
          
          <div className="relative w-full max-w-3xl aspect-square md:aspect-video flex items-center justify-center">
            
            {/* Central Core */}
            <div className="absolute z-20 flex flex-col items-center justify-center text-center p-8 bg-white rounded-full shadow-2xl w-48 h-48 md:w-64 md:h-64 border-8 border-slate-50 animate-heartbeat">
              <Plane size={48} className="text-blue-500 mb-2 transform -rotate-45" />
              <h3 className="font-black text-2xl text-slate-800">Happy<br/>Traveler</h3>
              <p className="text-xs text-slate-400 mt-2">여행은 계속됩니다</p>
            </div>

            {/* Orbiting Planets (Interactive) */}
            <div className="absolute inset-0 animate-spin-slow">
               {/* Node 1: Retention */}
               <div 
                 onClick={(e) => { e.stopPropagation(); setActiveStage('retention'); }}
                 className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
               >
                 <div className={`w-20 h-20 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center shadow-lg border-4 transition-all hover:scale-125 ${activeStage === 'retention' ? 'border-rose-500 scale-125 ring-4 ring-rose-200' : 'border-rose-200'}`}>
                   <Heart size={32} className="text-rose-500 group-hover:animate-bounce" />
                 </div>
                 <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 font-bold text-slate-700 whitespace-nowrap bg-white/80 px-2 rounded backdrop-blur-sm">다녀온 후 관리</div>
               </div>

               {/* Node 2: Upsell */}
               <div 
                 onClick={(e) => { e.stopPropagation(); setActiveStage('upsell'); }}
                 className="absolute bottom-1/4 right-0 transform translate-x-1/2 cursor-pointer group"
               >
                 <div className={`w-20 h-20 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center shadow-lg border-4 transition-all hover:scale-125 ${activeStage === 'upsell' ? 'border-blue-500 scale-125 ring-4 ring-blue-200' : 'border-blue-200'}`}>
                   <TrendingUp size={32} className="text-blue-500 group-hover:animate-bounce" />
                 </div>
                 <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 font-bold text-slate-700 whitespace-nowrap bg-white/80 px-2 rounded backdrop-blur-sm">다음 여행 제안</div>
               </div>

               {/* Node 3: Referral */}
               <div 
                 onClick={(e) => { e.stopPropagation(); setActiveStage('referral'); }}
                 className="absolute bottom-1/4 left-0 transform -translate-x-1/2 cursor-pointer group"
               >
                 <div className={`w-20 h-20 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center shadow-lg border-4 transition-all hover:scale-125 ${activeStage === 'referral' ? 'border-purple-500 scale-125 ring-4 ring-purple-200' : 'border-purple-200'}`}>
                   <Users size={32} className="text-purple-500 group-hover:animate-bounce" />
                 </div>
                 <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 font-bold text-slate-700 whitespace-nowrap bg-white/80 px-2 rounded backdrop-blur-sm">친구 추천</div>
               </div>
            </div>
            
            {/* Orbit Path Visual */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-300 pointer-events-none scale-75 md:scale-90"></div>

          </div>

          {/* Info Card Overlay */}
          <div className={`
            absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-xl transition-all duration-500
            ${activeStage ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}
          `}>
            {activeStage && stages[activeStage as keyof typeof stages] && (
              <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-2xl border border-slate-200 flex items-start gap-5">
                <div className={`p-4 rounded-xl bg-slate-50 ${stages[activeStage as keyof typeof stages].color}`}>
                   {React.createElement(stages[activeStage as keyof typeof stages].icon, { size: 32 })}
                </div>
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className={`text-xl font-bold mb-2 ${stages[activeStage as keyof typeof stages].color}`}>
                      {stages[activeStage as keyof typeof stages].title}
                    </h3>
                    <Sparkles size={20} className="text-yellow-400 animate-spin" />
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {stages[activeStage as keyof typeof stages].desc}
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Hint */}
        {!activeStage && (
          <div className="p-6 text-center text-slate-400 text-sm border-t border-slate-100 bg-slate-50/50">
            <p className="flex items-center justify-center gap-2 animate-bounce">
              <MousePointerClick size={16} /> 
              <span>순환하는 아이콘들을 클릭해보세요</span>
            </p>
          </div>
        )}

      </div>
    </div>
  );
};