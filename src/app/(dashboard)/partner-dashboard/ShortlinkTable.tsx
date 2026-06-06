'use client';

import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/lib/api/use-toast';

type ShortLink = {
  id: string;
  title: string;
  shortCode: string;
  clickCount: number;
  createdAt: string;
};

export function ShortlinkTable({ shortLinks }: { shortLinks: ShortLink[] }) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (code: string, title: string) => {
    const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${code}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(code);
      toast({
        title: '복사 완료',
        description: `"${title}" 링크가 복사되었습니다.`,
      });
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      toast({
        title: '복사 실패',
        description: '링크 복사에 실패했습니다.',
        variant: 'destructive',
      });
    });
  };

  if (shortLinks.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <p className="text-sm">생성된 숏링크가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">숏링크 목록</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3 text-left">링크명</th>
              <th className="px-4 py-3 text-left">숏코드</th>
              <th className="px-4 py-3 text-right">클릭</th>
              <th className="px-4 py-3 text-right">생성일</th>
              <th className="px-4 py-3 text-center">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shortLinks.map((link) => {
              const createdDate = new Date(link.createdAt);
              const dateStr = createdDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              });

              return (
                <tr key={link.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate">
                    {link.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                      {link.shortCode}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-semibold">
                    {link.clickCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {dateStr}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleCopyLink(link.shortCode, link.title)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          copiedId === link.shortCode
                            ? 'bg-green-100 text-green-600'
                            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                        }`}
                        title="링크 복사"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`/s/${link.shortCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                        title="링크 열기"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
