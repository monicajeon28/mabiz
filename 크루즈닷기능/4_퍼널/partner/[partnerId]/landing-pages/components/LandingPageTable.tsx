'use client';

import React from 'react';
import { FiEdit, FiEye, FiLink, FiGift, FiTrash2, FiCopy } from 'react-icons/fi';
import { showSuccess } from '@/components/ui/Toast';

interface LandingPage {
  id: number;
  title: string;
  category: string | null;
  pageGroup: string | null;
  viewCount: number;
  slug: string;
  shortcutUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  CustomerGroup: {
    id: number;
    name: string;
  } | null;
  _count?: {
    LandingPageRegistration: number;
  };
}

interface LandingPageTableProps {
  pages: LandingPage[];
  quotas: { pageCount: number; remainingQuota: number };
  cloningPageId: number | null;
  onEdit: (id: number) => void;
  onViewDetail: (slug: string) => void;
  onShowData: (page: LandingPage) => void;
  onShare: (page: LandingPage) => void;
  onShowStats: (page: LandingPage) => void;
  onDelete: (id: number) => void;
  onGenerateShortcut: (page: LandingPage) => void;
}

export function LandingPageTable({
  pages,
  quotas,
  cloningPageId,
  onEdit,
  onViewDetail,
  onShowData,
  onShare,
  onShowStats,
  onDelete,
  onGenerateShortcut,
}: LandingPageTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">제목</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">구분</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">조회수</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">숏 URL</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {pages.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                생성된 랜딩페이지가 없습니다.
              </td>
            </tr>
          ) : (
            pages.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {page.title}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {page.category || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-blue-600">
                      <FiEye size={12} />
                      {page.viewCount.toLocaleString()}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1 text-green-600">
                      ✅ {(page._count?.LandingPageRegistration ?? 0).toLocaleString()}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1 text-purple-600">
                      📊 {page.viewCount > 0
                        ? ((page._count?.LandingPageRegistration ?? 0) / page.viewCount * 100).toFixed(1)
                        : '0.0'}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {page.shortcutUrl ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-600 font-mono px-2 py-1 bg-gray-100 rounded truncate max-w-[120px]">
                        {page.shortcutUrl.split('/i/')[1] || page.shortcutUrl}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(page.shortcutUrl || '');
                          showSuccess('URL이 복사되었습니다.');
                        }}
                        className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                        title="복사"
                      >
                        <FiCopy size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onGenerateShortcut(page)}
                      className="px-2 py-1 bg-gold text-navy text-xs rounded hover:bg-gold-light whitespace-nowrap"
                    >
                      신규 생성
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => onEdit(page.id)}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="수정"
                    >
                      <FiEdit size={18} />
                    </button>
                    <button
                      onClick={() => onViewDetail(page.slug)}
                      className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                      title="미리보기"
                    >
                      <FiEye size={18} />
                    </button>
                    <button
                      onClick={() => onShowData(page)}
                      className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded"
                      title="세부 데이터"
                    >
                      <FiLink size={18} />
                    </button>
                    <button
                      onClick={() => onShare(page)}
                      className="p-1.5 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                      title="공유하기"
                    >
                      <FiGift size={18} />
                    </button>
                    <button
                      onClick={() => onShowStats(page)}
                      className="px-2 py-1 bg-gold text-navy text-xs rounded hover:bg-gold-light"
                      title="접속현황"
                    >
                      접속현황
                    </button>
                    <button
                      onClick={() => onDelete(page.id)}
                      className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="삭제"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
