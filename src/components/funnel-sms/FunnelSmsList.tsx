'use client';

import React from 'react';
import { Copy, Trash2 } from 'lucide-react';

interface ListItem {
  id: string;
  title: string;
  category?: string;
  sendHour: number;
  sendMinute: number;
  createdAt: Date;
  _count: { messages: number };
  groups: Array<{ id: string; name: string }>;
  sentCount?: number;
}

interface Props {
  items: ListItem[];
  onCopyUrl: (id: string, groupId: string) => void;
  onDelete?: (id: string) => void;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function FunnelSmsList({ items, onCopyUrl, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg
          className="w-12 h-12 mb-3 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        <p className="text-sm">등록된 퍼널문자가 없습니다.</p>
        <p className="text-xs mt-1">상단의 &quot;퍼널문자 만들기&quot; 버튼으로 추가하세요.</p>
      </div>
    );
  }

  /** 각 item을 그룹별 행으로 펼침 */
  type Row = {
    item: ListItem;
    group: { id: string; name: string } | null;
    rowIndex: number;
    isFirst: boolean;
    rowSpan: number;
  };

  const rows: Row[] = [];
  let rowIndex = 0;

  items.forEach((item) => {
    if (item.groups.length === 0) {
      rows.push({ item, group: null, rowIndex: ++rowIndex, isFirst: true, rowSpan: 1 });
    } else {
      item.groups.forEach((group, gi) => {
        rows.push({
          item,
          group,
          rowIndex: gi === 0 ? ++rowIndex : rowIndex,
          isFirst: gi === 0,
          rowSpan: item.groups.length,
        });
      });
    }
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
              NO
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              제목 / 그룹
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
              발송시간
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
              총회차
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
              발송건수
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
              등록일
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
              URL 복사
            </th>
            {onDelete && (
              <th className="px-4 py-3 w-12" />
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => {
            const { item, group, rowIndex: no, isFirst, rowSpan } = row;
            const timeStr = `${String(item.sendHour).padStart(2, '0')}:${String(item.sendMinute).padStart(2, '0')}`;

            return (
              <tr
                key={`${item.id}-${group?.id ?? 'none'}`}
                className={`hover:bg-gray-50 transition-colors ${
                  !isFirst ? 'border-t border-dashed border-gray-100' : ''
                }`}
              >
                {/* NO - 첫 행에만 */}
                {isFirst && (
                  <td
                    className="px-4 py-3 text-gray-400 font-mono text-xs align-top"
                    rowSpan={rowSpan}
                  >
                    {no}
                  </td>
                )}

                {/* 제목 + 그룹 */}
                <td className="px-4 py-3">
                  {isFirst && (
                    <p className="font-semibold text-gray-900">
                      {item.title}
                      {item.category && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {item.category}
                        </span>
                      )}
                    </p>
                  )}
                  {group ? (
                    <p className={`text-xs text-gray-500 ${isFirst ? 'mt-0.5' : ''}`}>
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {group.name}
                      </span>
                    </p>
                  ) : (
                    isFirst && (
                      <p className="text-xs text-gray-400 mt-0.5">연결된 그룹 없음</p>
                    )
                  )}
                </td>

                {/* 발송시간 - 첫 행에만 */}
                {isFirst && (
                  <td
                    className="px-4 py-3 text-gray-700 text-xs font-mono align-top"
                    rowSpan={rowSpan}
                  >
                    {timeStr}
                  </td>
                )}

                {/* 총회차 - 첫 행에만 */}
                {isFirst && (
                  <td
                    className="px-4 py-3 text-center align-top"
                    rowSpan={rowSpan}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                      {item._count.messages}
                    </span>
                  </td>
                )}

                {/* 발송건수 - 첫 행에만 */}
                {isFirst && (
                  <td
                    className="px-4 py-3 text-center align-top"
                    rowSpan={rowSpan}
                  >
                    <span className="text-gray-700 text-xs font-medium">
                      {(item.sentCount ?? 0).toLocaleString()}건
                    </span>
                  </td>
                )}

                {/* 등록일 - 첫 행에만 */}
                {isFirst && (
                  <td
                    className="px-4 py-3 text-xs text-gray-500 align-top"
                    rowSpan={rowSpan}
                  >
                    {formatDate(item.createdAt)}
                  </td>
                )}

                {/* URL 복사 - 그룹별로 1개씩 */}
                <td className="px-4 py-3 text-center">
                  {group ? (
                    <button
                      type="button"
                      onClick={() => onCopyUrl(item.id, group.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                      title={`${group.name} URL 복사`}
                    >
                      <Copy className="w-3 h-3" />
                      복사
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* 삭제 - 첫 행에만 */}
                {onDelete && isFirst && (
                  <td
                    className="px-2 py-3 text-center align-top"
                    rowSpan={rowSpan}
                  >
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
                {onDelete && !isFirst && <td />}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
