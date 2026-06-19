import { InputHTMLAttributes } from 'react';

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full h-12 min-h-12 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${className || ''}`}
      {...props}
    />
  );
}
