import Link from 'next/link';
import type { TopPage } from '@/types/marketing';

interface TopPagesTableProps {
  topPages: TopPage[];
  loading: boolean;
}

function SkeletonLoadingRow() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  );
}

export function TopPagesTable({ topPages, loading }: TopPagesTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-navy-900 mb-4">
        상위 랜딩페이지 {topPages.length ? `TOP ${topPages.length}` : ''}
      </h2>
      {loading ? (
        <SkeletonLoadingRow />
      ) : topPages.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-100">
                <th scope="col" className="text-left font-medium pb-2 pr-4">
                  페이지명
                </th>
                <th scope="col" className="text-right font-medium pb-2 px-3">
                  방문
                </th>
                <th scope="col" className="text-right font-medium pb-2 px-3">
                  등록
                </th>
                <th scope="col" className="text-right font-medium pb-2 px-3">
                  전환율
                </th>
                <th scope="col" className="text-right font-medium pb-2 pl-3"></th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((page) => (
                <tr
                  key={page.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 pr-4 font-medium text-navy-900 max-w-[200px] truncate">
                    {page.title}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {page.viewCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {page.registrations.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`font-semibold ${
                        page.conversionRate >= 5
                          ? "text-green-600"
                          : page.conversionRate >= 2
                          ? "text-yellow-600"
                          : "text-gray-400"
                      }`}
                    >
                      {page.conversionRate}%
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <Link
                      href={`/landing-pages/${page.id}`}
                      className="text-xs text-navy-600 hover:underline whitespace-nowrap"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">랜딩페이지 데이터가 없습니다.</p>
      )}
    </div>
  );
}
