'"'"'use client'"'"';

import { useState, useMemo } from '"'"'react'"'"';
import useSWR from '"'"'swr'"'"';
import { formatDistanceToNow } from '"'"'date-fns'"'"';
import { ko } from '"'"'date-fns/locale'"'"';

interface SmsLogRow {
  id: string;
  phone: string;
  contentPreview: string;
  status: '"'"'SENT'"'"' | '"'"'FAILED'"'"' | '"'"'PENDING'"'"';
  messageType: '"'"'SMS'"'"' | '"'"'KAKAO'"'"' | '"'"'EMAIL'"'"';
  channel: string;
  sentAt: string;
  openedAt: string | null;
  clickedAt: string | null;
  segmentCode: string | null;
  psychologyLens: string | null;
  abTestGroup: string | null;
}

interface SmsLogStats {
  totalCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  averageOpenTime: number;
}

export default function SmsLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">SMS/Kakao/Email Logs</h1>
        <p className="text-gray-600 mt-2">Message delivery and performance analytics</p>
      </div>
    </div>
  );
}
