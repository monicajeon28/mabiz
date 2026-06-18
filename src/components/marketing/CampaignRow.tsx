import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Campaign } from '@/types/marketing';

interface CampaignRowProps {
  campaign: Campaign;
  isEven: boolean;
  onDelete: (id: string) => void;
  statusBadgeClassName: string;
}

const STATUS_LABEL_MAP = {
  DRAFT: '임시저장',
  PENDING: '대기',
  SENDING: '발송 중',
  SENT: '발송 완료',
  FAILED: '실패',
  CANCELLED: '취소',
};

export function CampaignRow({
  campaign,
  isEven,
  onDelete,
  statusBadgeClassName,
}: CampaignRowProps) {
  const statusLabel =
    STATUS_LABEL_MAP[campaign.status as keyof typeof STATUS_LABEL_MAP] || '';

  return (
    <tr className={isEven ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-6 py-4">
        <Link
          href={`/marketing/campaigns/${campaign.id}`}
          className="text-blue-600 hover:underline font-medium focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 rounded"
        >
          {campaign.title}
        </Link>
      </td>
      <td className="px-6 py-4 text-sm">{campaign.group.name}</td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 rounded text-sm font-medium ${statusBadgeClassName}`}>
          {statusLabel}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        발송 {campaign.sentCount}/{campaign.totalCount} • 열람 {campaign.openCount} •
        클릭 {campaign.clickCount}
      </td>
      <td className="px-6 py-4 text-sm space-x-2">
        <Link href={`/marketing/campaigns/${campaign.id}`}>
          <Button variant="outline" size="sm">
            보기
          </Button>
        </Link>
        <button
          onClick={() => onDelete(campaign.id)}
          className="text-red-600 hover:text-red-700 text-sm"
          aria-label={`${campaign.title} 캠페인 삭제`}
        >
          삭제
        </button>
      </td>
    </tr>
  );
}
