'use client';

import React, { useState } from 'react';
import { FunnelSlide } from './FunnelSlide';
import { TrafficSlide } from './TrafficSlide';
import { LeadSlide } from './LeadSlide';
import { NurtureSlide } from './NurtureSlide';
import { ConversionSlide } from './ConversionSlide';
import { RetentionSlide } from './RetentionSlide';
import { ChevronLeft, ChevronRight, Anchor, LayoutDashboard, HelpCircle, Bell } from 'lucide-react';

interface FunnelVisualizerProps {
  showHeader?: boolean;
  showSidebar?: boolean;
  initialSlide?: number;
}

const FunnelVisualizer: React.FC<FunnelVisualizerProps> = ({
  showHeader = true,
  showSidebar = true,
  initialSlide = 1,
}) => {
  const [currentSlide, setCurrentSlide] = useState(initialSlide);
  const totalSlides = 6;

  const nextSlide = () => {
    if (currentSlide < totalSlides) setCurrentSlide(curr => curr + 1);
  };

  const prevSlide = () => {
    if (currentSlide > 1) setCurrentSlide(curr => curr - 1);
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col">

      {/* Mock Dashboard Header */}
      {showHeader && (
        <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between shadow-sm flex-shrink-0 z-50">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Anchor size={20} />
            </div>
            <span className="font-black text-xl text-slate-800 tracking-tight">Cruise Guide Genie</span>
            <span className="hidden md:inline-block ml-4 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
              Education Mode
            </span>
          </div>
          <div className="flex items-center gap-6 text-slate-400">
             <div className="hidden md:flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
               <LayoutDashboard size={18} />
               <span className="text-sm font-medium">Dashboard</span>
             </div>
             <div className="hidden md:flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
               <HelpCircle size={18} />
               <span className="text-sm font-medium">Support</span>
             </div>
             <div className="relative hover:text-blue-600 cursor-pointer transition-colors">
               <Bell size={18} />
               <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white transform translate-x-1/2 -translate-y-1/3"></span>
             </div>
             <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Captain" alt="User" />
             </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Mockup */}
        {showSidebar && (
          <div className="hidden lg:block w-64 bg-slate-900 text-slate-300 p-4 flex-shrink-0">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Main Menu</div>
            <div className="space-y-1">
              {['Overview', 'Campaigns', 'Leads', 'Analytics', 'Settings'].map((item, idx) => (
                <div key={item} className={`px-4 py-3 rounded-lg cursor-pointer flex items-center justify-between ${idx === 1 ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
                  <span>{item}</span>
                  {idx === 1 && <span className="w-2 h-2 bg-white rounded-full"></span>}
                </div>
              ))}
            </div>

            <div className="mt-8 bg-slate-800 rounded-xl p-4">
              <h4 className="text-white font-bold mb-2 text-sm">마케팅 교육 진행중</h4>
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
                 <div className="bg-blue-400 h-full transition-all duration-500" style={{ width: `${(currentSlide / totalSlides) * 100}%` }}></div>
              </div>
              <p className="text-xs text-slate-400">{Math.round((currentSlide / totalSlides) * 100)}% 완료</p>
            </div>
          </div>
        )}

        {/* Slide Content */}
        <div className="flex-1 relative bg-slate-100 overflow-y-auto overflow-x-hidden">
           {currentSlide === 1 && <FunnelSlide />}
           {currentSlide === 2 && <TrafficSlide />}
           {currentSlide === 3 && <LeadSlide />}
           {currentSlide === 4 && <NurtureSlide />}
           {currentSlide === 5 && <ConversionSlide />}
           {currentSlide === 6 && <RetentionSlide />}

           {/* Navigation Controls (Floating) */}
          <div className={`fixed bottom-8 ${showSidebar ? 'left-0 lg:left-64' : 'left-0'} right-0 flex items-center justify-center gap-6 z-40 pointer-events-none`}>
            <button
              onClick={prevSlide}
              disabled={currentSlide === 1}
              className={`p-3 rounded-full shadow-lg bg-white/90 backdrop-blur text-slate-700 transition-all pointer-events-auto border border-slate-200
                ${currentSlide === 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:bg-blue-50 hover:text-blue-600 hover:scale-110'}
              `}
            >
              <ChevronLeft size={24} />
            </button>

            <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-sm font-bold text-slate-600 pointer-events-auto border border-slate-200 flex flex-col items-center">
              <span>Class {currentSlide} / {totalSlides}</span>
            </div>

            <button
              onClick={nextSlide}
              disabled={currentSlide === totalSlides}
              className={`p-3 rounded-full shadow-lg bg-white/90 backdrop-blur text-slate-700 transition-all pointer-events-auto border border-slate-200
                ${currentSlide === totalSlides ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:bg-blue-50 hover:text-blue-600 hover:scale-110'}
              `}
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FunnelVisualizer;
export { FunnelSlide, TrafficSlide, LeadSlide, NurtureSlide, ConversionSlide, RetentionSlide };
