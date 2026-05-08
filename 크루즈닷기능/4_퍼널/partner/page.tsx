import { Suspense } from 'react';
import PartnerLogin from './PartnerLogin';

function PartnerLoginWrapper() {
  return <PartnerLogin />;
}

export default function PartnerRootPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <PartnerLoginWrapper />
    </Suspense>
  );
}
