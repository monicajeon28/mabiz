'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray' | 'indigo' | 'pink';
  gradient?: boolean;
  className?: string;
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    gradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
    icon: 'text-blue-500',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    gradient: 'bg-gradient-to-br from-green-500 to-green-600',
    icon: 'text-green-500',
    text: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    gradient: 'bg-gradient-to-br from-purple-500 to-purple-600',
    icon: 'text-purple-500',
    text: 'text-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    gradient: 'bg-gradient-to-br from-orange-500 to-orange-600',
    icon: 'text-orange-500',
    text: 'text-orange-600',
  },
  red: {
    bg: 'bg-red-50',
    gradient: 'bg-gradient-to-br from-red-500 to-red-600',
    icon: 'text-red-500',
    text: 'text-red-600',
  },
  gray: {
    bg: 'bg-gray-50',
    gradient: 'bg-gradient-to-br from-gray-500 to-gray-600',
    icon: 'text-gray-500',
    text: 'text-gray-600',
  },
  indigo: {
    bg: 'bg-indigo-50',
    gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    icon: 'text-indigo-500',
    text: 'text-indigo-600',
  },
  pink: {
    bg: 'bg-pink-50',
    gradient: 'bg-gradient-to-br from-pink-500 to-pink-600',
    icon: 'text-pink-500',
    text: 'text-pink-600',
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  gradient = false,
  className = '',
  onClick,
}: StatCardProps) {
  const colors = colorClasses[color];
  const isGradient = gradient;

  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl p-5 shadow-sm transition-all duration-200
        ${isGradient ? colors.gradient + ' text-white' : 'bg-white'}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium ${isGradient ? 'text-white/80' : 'text-gray-500'}`}>
            {title}
          </p>
          <p className={`text-2xl font-bold mt-1 ${isGradient ? 'text-white' : 'text-gray-900'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className={`text-xs mt-1 ${isGradient ? 'text-white/70' : 'text-gray-400'}`}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-xs font-medium ${
                  isGradient
                    ? 'text-white/90'
                    : trend.isPositive !== false
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {trend.isPositive !== false ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              {trend.label && (
                <span className={`text-xs ${isGradient ? 'text-white/70' : 'text-gray-400'}`}>
                  {trend.label}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`
              p-3 rounded-lg
              ${isGradient ? 'bg-white/20' : colors.bg}
            `}
          >
            <div className={isGradient ? 'text-white' : colors.icon}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// 여러 StatCard를 그리드로 배치하는 래퍼 컴포넌트
interface StatCardGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function StatCardGrid({ children, columns = 4, className = '' }: StatCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  };

  return <div className={`grid gap-4 ${gridCols[columns]} ${className}`}>{children}</div>;
}
