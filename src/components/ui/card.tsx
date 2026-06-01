import { ReactNode } from 'react';

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className || ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-b border-gray-200 px-6 py-4 ${className || ''}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-lg font-semibold text-gray-900 ${className || ''}`}>
      {children}
    </h2>
  );
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-gray-600 ${className || ''}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 ${className || ''}`}>
      {children}
    </div>
  );
}
