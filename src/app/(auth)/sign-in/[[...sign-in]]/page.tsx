'use client';

import dynamic from 'next/dynamic';

const SignInContent = dynamic(
  () => import('./sign-in-form'),
  {
    loading: () => <div className="min-h-screen flex items-center justify-center">로딩 중...</div>,
    ssr: false,
  }
);

export default function SignInPage() {
  return <SignInContent />;
}
