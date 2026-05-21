'use client';

interface ReservationStatusBadgeProps {
  status?: string;
  note?: string | null;
  lastRefundedAt?: Date | string | null;
  lastPaymentAt?: Date | string | null;
}

export function ReservationStatusBadge({
  status = 'unknown',
  note,
  lastRefundedAt,
  lastPaymentAt,
}: ReservationStatusBadgeProps) {
  const statusConfig: Record<
    string,
    { bg: string; text: string; label: string; icon: string }
  > = {
    paid: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: '결제됨',
      icon: '✓',
    },
    cancelled: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: '취소됨',
      icon: '✕',
    },
    refunded: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: '환불됨',
      icon: '↻',
    },
    unknown: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: '미확인',
      icon: '?',
    },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const timestamp = status === 'refunded' ? lastRefundedAt : lastPaymentAt;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg border ${config.bg}`}>
      <span className={`text-xl font-bold ${config.text}`}>{config.icon}</span>
      <div>
        <p className={`font-semibold text-sm ${config.text}`}>{config.label}</p>
        {note && (
          <p className={`text-xs ${config.text} opacity-75 mt-1`}>{note}</p>
        )}
        {timestamp && (
          <p className={`text-xs ${config.text} opacity-60 mt-1`}>
            {formatDate(timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
