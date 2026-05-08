'use client';

import React from 'react';
import { FiEye, FiDownload, FiLink, FiCopy } from 'react-icons/fi';
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

interface SharedLandingPage extends LandingPage {
  sharedCategory?: string;
  sharedAt?: string;
}

interface SharedPagesSectionProps {
  sharedPages: SharedLandingPage[];
  cloningPageId: number | null;
  onClone: (pageId: number) => void;
  onViewDetail: (slug: string) => void;
}

export function SharedPagesSection({
  sharedPages,
  cloningPageId,
  onClone,
  onViewDetail,
}: SharedPagesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">관리자 보너스 랜딩페이지</h2>
        <span className="text-sm text-gray-500">총 {sharedPages.length}개</span>
      </div>
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">제목</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">원본 구분</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">보너스 카테고리</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">숏 URL</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sharedPages.map((page) => (
              <tr key={`shared-${page.id}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <span>{page.title}</span>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                      관리자 공유
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {page.category || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {page.sharedCategory || '관리자 보너스'}
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
                    <span className="text-xs text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewDetail(page.slug)}
                      className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                      title="미리보기"
                    >
                      <FiEye size={18} />
                    </button>
                    <button
                      onClick={() => onClone(page.id)}
                      disabled={cloningPageId === page.id}
                      className={`p-1.5 rounded flex items-center gap-1 text-sm ${
                        cloningPageId === page.id
                          ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      title="내 랜딩페이지로 복사"
                    >
                      <FiDownload size={18} />
                      <span className="text-xs hidden sm:inline">
                        {cloningPageId === page.id ? '복사 중…' : '내 페이지로 복사'}
                      </span>
                    </button>
                    {page.shortcutUrl && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(page.shortcutUrl || '');
                          showSuccess('URL이 복사되었습니다.');
                        }}
                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="URL 복사"
                      >
                        <FiLink size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
