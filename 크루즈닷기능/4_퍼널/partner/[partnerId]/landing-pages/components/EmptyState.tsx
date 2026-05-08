'use client';

import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {icon && (
        <div className="text-6xl mb-4 opacity-50">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-600 text-sm mb-4 text-center max-w-sm">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2 bg-gold text-navy rounded-lg hover:bg-gold-light font-semibold transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
