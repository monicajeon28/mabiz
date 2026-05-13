'use client';

import React, { useState } from 'react';
import {
  Bot, 
  MessageSquare, 
  Heart, 
  MousePointerClick,
  Sparkles,
  Ship
} from 'lucide-react';

export const NurtureSlide: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const steps = [
    {
      id: 1,
      day: "Step 1",
      title: "크루즈닷AI 시작하기",
      icon: Bot,
      content: "고객이 3일 무료 체험을 시작합니다. '환영합니다! 어떤 크루즈 여행을 꿈꾸시나요?' 라고 크루즈닷이 먼저 말을 걺으로써 대화를 유도합니다.",
      trustLevel: 30
    },
    {
      id: 2,
      day: "Step 2",
      title: "실시간 정보 제공",
      icon: Sparkles,
      content: "복잡한 크루즈 상품 정보를 AI가 직관적으로 정리해줍니다. '지중해 코스는 이게 좋아요', '이 배는 가족 여행에 딱이에요' 처럼 맞춤형 정보를 즉시 제공합니다.",
      trustLevel: 70
    },
    {
      id: 3,
      day: "Step 3",
      title: "맞춤형 제안",
      icon: MessageSquare,
      content: "고객의 선호도를 학습한 AI가 최적의 상품을 제안합니다. 고객은 자신이 원하는 것을 정확히 알고 있는 크루즈닷에게 신뢰를 느낍니다.",
      trustLevel: 95
    }
  ];

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-8 bg-violet-50 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-float" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} />

      <div className="max-w-7xl w-full bg-white rounded-3xl shadow-xl border border-violet-100 overflow-hidden flex flex-col relative z-10 min-h-[80vh]">
        
        {/* Header */}
        <header className="p-8 pb-4 border-b border-slate-100">
          <div className="inline-flex items-center space-x-2 bg-violet-50 px-3 py-1 rounded-full mb-3 text-violet-600 border border-violet-100">
            <span className="font-bold">Step 03</span>
            <span>Nurturing (신뢰 구축)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">
            신뢰 쌓기 (Nurturing)
            <span className="block text-xl md:text-2xl font-normal text-slate-500 mt-1">
              &quot;챗봇 크루즈닷AI로 신뢰 형성&quot;
            </span>
          </h1>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center p-6 md:p-12">
          
          <div className="relative">
             {/* Connection Line */}
             <div className="absolute top-1/2 left-0 right-0 h-2 bg-slate-100 -z-10 transform -translate-y-1/2 rounded-full hidden md:block">
               <div className="h-full bg-gradient-to-r from-violet-200 to-cyan-300 w-full opacity-50"></div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
               
               {/* Steps 1, 2, 3 */}
               {steps.map((step) => {
                 const isActive = activeStep === step.id;
                 const Icon = step.icon;
                 
                 return (
                   <div 
                     key={step.id}
                     onClick={() => setActiveStep(isActive ? null : step.id)}
                     className={`
                       relative bg-white border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 transform
                       ${isActive ? 'border-violet-500 scale-105 shadow-xl z-20' : 'border-slate-100 hover:border-violet-300 hover:shadow-md'}
                     `}
                   >
                     <div className="absolute -top-4 left-6 bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">
                       {step.day}
                     </div>
                     
                     <div className="flex flex-col items-center text-center space-y-4">
                       <div className={`p-4 rounded-full ${isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-50 text-slate-400'} transition-colors`}>
                         <Icon size={32} className={isActive ? 'animate-pulse' : ''} />
                       </div>
                       <h3 className={`font-bold text-lg ${isActive ? 'text-violet-800' : 'text-slate-600'}`}>{step.title}</h3>
                       
                       {/* Trust Meter Visual */}
                       <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                         <div 
                           className="bg-cyan-400 h-full transition-all duration-1000" 
                           style={{ width: `${step.trustLevel}%` }} 
                         />
                       </div>
                       <p className="text-xs text-cyan-500 font-bold">신뢰도 {step.trustLevel}%</p>
                     </div>

                     {/* Popover Content */}
                     {isActive && (
                       <div className="absolute top-full left-0 right-0 mt-4 bg-white p-4 rounded-xl shadow-2xl border border-violet-100 z-30 animate-slide-up text-left">
                         <p className="text-slate-600 text-sm leading-relaxed">
                           {step.content}
                         </p>
                       </div>
                     )}
                   </div>
                 );
               })}

               {/* Step 4: Sales */}
               <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg transform transition-transform hover:scale-105 border-4 border-white/50">
                 <div className="bg-white/20 p-4 rounded-full mb-4 backdrop-blur-sm">
                   <Ship size={32} className="text-white" />
                 </div>
                 <h3 className="font-bold text-xl mb-2">상담 예약</h3>
                 <p className="text-sm text-white/90 text-center">AI와 준비 후<br/>최종 결정</p>
                 
                 <div className="mt-4 flex gap-1">
                   {[1,2,3].map(i => <Heart key={i} size={16} className="fill-white text-white animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
                 </div>
               </div>

             </div>
          </div>

          {/* Core Philosophy Box */}
          <div className="mt-16 md:mt-24 bg-violet-50 border border-violet-100 rounded-xl p-6 flex items-start gap-4 max-w-2xl mx-auto">
            <div className="bg-violet-500 text-white p-2 rounded-lg shrink-0">
               <Bot size={24} />
            </div>
            <div>
              <h4 className="font-bold text-violet-800 text-lg mb-1">크루즈닷AI</h4>
              <p className="text-violet-600">
                크루즈닷AI는 고객이 궁금해하는 다양한 크루즈 상품의 특징과 정보를 <span className="font-bold underline">직관적으로</span> 바로 전달합니다.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Hint */}
        <div className="p-6 text-center text-slate-400 text-sm border-t border-slate-100 bg-slate-50/50">
          <p className="flex items-center justify-center gap-2">
            <MousePointerClick size={16} /> 
            <span>각 카드를 클릭하여 AI와의 대화 과정을 확인하세요</span>
          </p>
        </div>

      </div>
    </div>
  );
};