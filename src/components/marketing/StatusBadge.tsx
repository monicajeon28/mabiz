interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-600',
  refunded: 'bg-orange-100 text-orange-600',
  default: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  paid: '결제완료',
  cancelled: '환불',
  pending: '처리중',
  failed: '실패',
  refunded: '환불완료',
  default: '대기중',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status as keyof typeof STATUS_STYLES] || STATUS_STYLES.default;
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || STATUS_LABELS.default;

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-medium ${style}`}>
      {label}
    </span>
  );
}
