'use client';

import React from 'react';
import { FunnelItem } from './types';

interface FunnelSegmentProps {
  item: FunnelItem;
  isActive: boolean;
  onClick: () => void;
  index: number;
}

export const FunnelSegment: React.FC<FunnelSegmentProps> = ({ item, isActive, onClick, index }) => {
  const Icon = item.icon;

  return (
    <div
      onClick={onClick}
      className={`
        relative h-20 md:h-24 mx-auto flex items-center justify-center
        transition-all duration-500 cursor-pointer group
        ${item.widthPercentage}
        ${isActive ? 'scale-105 z-10' : 'scale-100 hover:scale-[1.02] z-0'}
      `}
      style={{
        // Creating the trapezoid shape
        clipPath: 'polygon(0 0, 100% 0, 90% 100%, 10% 100%)',
        marginTop: index === 0 ? 0 : '-4px', // Slight overlap to prevent gaps
      }}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90 shadow-lg`} />
      
      {/* Highlight effect */}
      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
      
      {/* Content inside the funnel segment */}
      <div className="relative z-10 flex flex-col items-center text-white drop-shadow-md">
        <Icon 
          size={isActive ? 32 : 24} 
          className={`transition-all duration-300 ${isActive ? 'mb-1' : 'mb-0'} text-white/90`} 
        />
        {isActive && (
          <span className="text-xs font-bold uppercase tracking-wider animate-slide-up hidden md:block">
            {item.title.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
};