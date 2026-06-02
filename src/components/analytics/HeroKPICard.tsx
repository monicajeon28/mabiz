import React from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroKPICardProps {
  title: string;
  icon: React.ReactNode;
  current: number;
  previous: number;
  growth: number;
  target: number;
  format?: 'currency' | 'percent' | 'number';
  unit?: string;
}

export function HeroKPICard({
  title,
  icon,
  current,
  previous,
  growth,
  target,
  format = 'number',
  unit = '',
}: HeroKPICardProps) {
  const isPositive = growth >= 0;
  const progress = (current / target) * 100;

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        if (value >= 1000000) {
          return `₩${(value / 1000000).toFixed(1)}M`;
        }
        if (value >= 10000) {
          return `₩${(value / 10000).toFixed(0)}만`;
        }
        return `₩${value}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return `${value.toLocaleString()}${unit}`;
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="text-slate-400">{icon}</div>
      </div>

      {/* Current Value */}
      <div className="space-y-3">
        <div>
          <div className="text-2xl font-bold text-slate-900">
            {formatValue(current)}
          </div>
          <div
            className={cn(
              'text-sm font-medium flex items-center gap-1 mt-1',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {Math.abs(growth).toFixed(1)}%
            {format === 'percent' ? '%p' : ''}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">목표 진행도</span>
            <span className="text-xs font-semibold text-slate-600">
              {Math.min(progress, 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Target */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">목표값</span>
            <span className="text-sm font-semibold text-slate-700">
              {formatValue(target)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
