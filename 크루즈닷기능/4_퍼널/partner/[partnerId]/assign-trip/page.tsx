'use client';

import { useMemo } from 'react';
import AssignTripForm, { createPartnerAssignTripApi } from '@/components/assign-trip/AssignTripForm';

export default function PartnerAssignTripPage() {
  const api = useMemo(() => createPartnerAssignTripApi(), []);
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <AssignTripForm api={api} />
      </div>
    </div>
  );
}
