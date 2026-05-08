'use client';

// app/partner/[partnerId]/links/PartnerLinksClient.tsx
// 파트너 링크 관리 클라이언트 컴포넌트

import { useEffect, useState } from 'react';
import {
  FiSearch,
  FiRefreshCw,
  FiCopy,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiExternalLink,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import Link from 'next/link';

type AffiliateLink = {
  id: number;
  code: string;
  title: string | null;
  productCode: string | null;
  status: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
  campaignName: string | null;
  createdAt: string;
  manager: {
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
  } | null;
  agent: {
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
  } | null;
  product: {
    id: number;
    productCode: string;
    title: string;
  } | null;
  issuedBy: {
    id: number;
    name: string | null;
  } | null;
  _count: {
    leads: number;
    sales: number;
  };
  url?: string;
};

type PartnerLinksClientProps = {
  partnerId: string;
};

type ShareLinks = {
  mall: string;
  tracked: string;
  landing: string | null;
};

type ProductLink = {
  id: string | number;
  code: string;
  title: string | null;
  productCode: string;
  status: string;
  url: string;
  product: {
    id: number;
    productCode: string;
    title: string;
  };
  isAutoLink: boolean;
  _count?: {
    leads: number;
    sales: number;
  };
};

export default function PartnerLinksClient({ partnerId }: PartnerLinksClientProps) {
  const [shareLinks, setShareLinks] = useState<ShareLinks | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [productLinks, setProductLinks] = useState<ProductLink[]>([]);
  const [validLinks, setValidLinks] = useState<Set<string>>(new Set()); // 유효한 링크 URL 저장
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  useEffect(() => {
    loadLinks();
  }, [statusFilter]);

  const loadLinks = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/partner/links?${params.toString()}`);
      
      if (!res.ok) {
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`서버 오류 (${res.status}): ${text || '알 수 없는 오류'}`);
        }
        throw new Error(json.message || '링크 목록을 불러오지 못했습니다.');
      }

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || '링크 목록을 불러오지 못했습니다.');
      }

      // 파트너의 기본 판매 링크 설정
      if (json.shareLinks) {
        const fullShareLinks = {
          mall: `${window.location.origin}${json.shareLinks.mall}`,
          tracked: `${window.location.origin}${json.shareLinks.tracked}`,
          landing: json.shareLinks.landing ? `${window.location.origin}${json.shareLinks.landing}` : null,
        };
        setShareLinks(fullShareLinks);
      }

    // 링크 URL에 base URL 추가
    const linksWithFullUrl = (json.links || []).map((link: AffiliateLink) => {
      let fullUrl = link.url;
      if (link.url && link.url.startsWith('/')) {
        fullUrl = `${window.location.origin}${link.url}`;
      }
      return { ...link, url: fullUrl };
    });
    setLinks(linksWithFullUrl);

    // 상품별 자동 링크 설정
    if (json.productLinks) {
      const productLinksWithFullUrl = json.productLinks.map((link: ProductLink) => ({
        ...link,
        url: `${window.location.origin}${link.url}`,
      }));
      setProductLinks(productLinksWithFullUrl);
    }

    // 링크 유효성 검사 (비동기, 백그라운드에서 실행)
    validateLinks(linksWithFullUrl);
    } catch (error: any) {
      console.error('[Partner Links] Load error', error);
      showError(error.message || '링크 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 링크 유효성 검사 함수
  const validateLinks = async (linksToValidate: AffiliateLink[]) => {
    try {
      setIsValidating(true);
      
      // 검사할 링크 목록 준비 (URL이 있는 링크만)
      const linksToCheck = linksToValidate
        .filter(link => link.url)
        .map(link => ({ url: link.url! }));

      if (linksToCheck.length === 0) {
        return;
      }

      // 유효성 검사 API 호출
      const res = await fetch('/api/partner/links/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: linksToCheck }),
      });

      if (!res.ok) {
        console.warn('[Partner Links] Validation API error:', res.status);
        return;
      }

      const json = await res.json();
      if (!json.ok || !json.results) {
        console.warn('[Partner Links] Validation failed:', json);
        return;
      }

      // 유효한 링크만 Set에 추가
      const validUrls = new Set<string>();
      json.results.forEach((result: { url: string; valid: boolean }) => {
        if (result.valid) {
          validUrls.add(result.url);
        }
      });

      setValidLinks(validUrls);
    } catch (error: any) {
      console.warn('[Partner Links] Link validation error:', error);
      // 검사 실패해도 계속 진행 (모든 링크 표시)
    } finally {
      setIsValidating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('링크가 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('[Partner Links] Copy error', error);
      showError('링크 복사에 실패했습니다.');
    }
  };

  const getStatusBadge = (link: AffiliateLink) => {
    const now = new Date();
    const expiresAt = link.expiresAt ? new Date(link.expiresAt) : null;
    const isExpired = expiresAt && expiresAt < now;
    const isExpiringSoon = expiresAt && expiresAt > now && expiresAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;

    switch (link.status) {
      case 'ACTIVE':
        if (isExpired) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              <FiXCircle />
              만료됨
            </span>
          );
        }
        if (isExpiringSoon) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
              <FiClock />
              만료 임박
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <FiCheckCircle />
            활성
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            <FiXCircle />
            만료됨
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            비활성
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            취소됨
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            {link.status}
          </span>
        );
    }
  };

  // 상품 링크 필터링
  const filteredProductLinks = productLinks.filter((link) => {
    if (productSearchTerm) {
      const term = productSearchTerm.toLowerCase();
      return (
        link.productCode?.toLowerCase().includes(term) ||
        link.title?.toLowerCase().includes(term) ||
        link.product?.title?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const filteredLinks = links.filter((link) => {
    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (
        link.code.toLowerCase().includes(term) ||
        link.productCode?.toLowerCase().includes(term) ||
        link.title?.toLowerCase().includes(term) ||
        link.campaignName?.toLowerCase().includes(term) ||
        link.manager?.displayName?.toLowerCase().includes(term) ||
        link.agent?.displayName?.toLowerCase().includes(term)
      );
      if (!matchesSearch) return false;
    }
    
    // 링크 유효성 검사 (검사가 완료된 경우에만 필터링)
    // 검사 중이거나 URL이 없는 링크는 표시
    if (!link.url) return true; // URL이 없으면 표시 (관리자 생성 링크일 수 있음)
    if (isValidating) return true; // 검사 중이면 모두 표시
    
    // 검사가 완료되었고 validLinks가 비어있지 않으면 유효한 링크만 표시
    // validLinks가 비어있으면 검사 실패로 간주하고 모든 링크 표시
    if (validLinks.size > 0) {
      return validLinks.has(link.url);
    }
    
    // 기본적으로 모든 링크 표시
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10 md:px-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">링크 관리</h1>
            <p className="text-sm text-gray-600 mt-2">
              나의 판매 링크를 확인하고 공유할 수 있습니다.
              {isValidating && (
                <span className="ml-2 text-blue-600">링크 유효성 검사 중...</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/partner/${partnerId}/dashboard`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              대시보드로 돌아가기
            </Link>
            <button
              onClick={loadLinks}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <FiRefreshCw />
              새로고침
            </button>
          </div>
        </div>

        {/* 파트너의 기본 판매 링크 */}
        {shareLinks && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">나의 판매 링크</h2>
            <div className="space-y-3">
              {/* 파트너몰 링크 (자동 추적됨) */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-sm font-semibold text-blue-900">파트너몰 링크</div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      <FiCheckCircle className="text-xs" />
                      자동 추적
                    </span>
                  </div>
                  <div className="text-xs text-blue-700 font-mono break-all">{shareLinks.mall}</div>
                  <div className="text-xs text-blue-600 mt-1">
                    이 링크를 통해 접속한 고객은 자동으로 추적됩니다
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => copyToClipboard(shareLinks.mall)}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                    title="링크 복사"
                  >
                    <FiCopy />
                    복사
                  </button>
                  <a
                    href={shareLinks.mall}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-100 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-200"
                  >
                    <FiExternalLink />
                    열기
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 필터 및 검색 */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="링크 코드, 상품코드, 캠페인명으로 검색..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">전체</option>
            <option value="ACTIVE">활성</option>
            <option value="EXPIRED">만료됨</option>
            <option value="INACTIVE">비활성</option>
            <option value="REVOKED">취소됨</option>
          </select>
        </div>

        {/* 특정 상품 링크 목록 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">특정 상품 링크</h2>
            <p className="text-sm text-gray-600 mt-1">관리자가 생성한 특정 상품 판매 링크입니다.</p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : filteredLinks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-2">링크가 없습니다.</p>
              <p className="text-sm text-gray-400">관리자에게 링크 생성을 요청해주세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      링크 코드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      상품
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      담당자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      캠페인
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      만료일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      통계
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{link.code}</div>
                        {link.title && (
                          <div className="text-xs text-gray-500">{link.title}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {link.product?.title || link.productCode || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {link.manager?.displayName && (
                          <div>대리점장: {link.manager.displayName}</div>
                        )}
                        {link.agent?.displayName && (
                          <div className="text-xs text-gray-500">판매원: {link.agent.displayName}</div>
                        )}
                        {!link.manager && !link.agent && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {link.campaignName || '-'}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(link)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {link.expiresAt ? (
                          <div>
                            {new Date(link.expiresAt).toLocaleDateString('ko-KR')}
                            {(() => {
                              const expiresAt = new Date(link.expiresAt!);
                              const now = new Date();
                              const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                              if (daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
                                return (
                                  <div className="text-xs text-yellow-600 mt-1">
                                    {daysUntilExpiry}일 후 만료
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-gray-400">만료일 없음</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>리드: {link._count.leads}</div>
                        <div className="text-xs">판매: {link._count.sales}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {link.url ? (
                            <>
                              <button
                                onClick={() => copyToClipboard(link.url!)}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                title="링크 복사"
                              >
                                <FiCopy />
                                복사
                              </button>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
                                onClick={(e) => {
                                  // 링크 클릭 시 새 창에서 열기
                                  e.preventDefault();
                                  window.open(link.url, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                <FiExternalLink />
                                열기
                              </a>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">링크 없음</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 상품별 자동 판매 링크 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🛍️</span>
                  상품별 판매 링크
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  모든 활성 상품에 대한 나의 판매 링크입니다. 복사하여 고객에게 공유하세요.
                </p>
              </div>
              <div className="text-sm font-medium text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                {productLinks.length}개 상품
              </div>
            </div>
          </div>

          {/* 상품 검색 */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="relative max-w-md">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                placeholder="상품명, 상품코드로 검색..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 text-sm"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : filteredProductLinks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {productSearchTerm ? (
                <p>검색 결과가 없습니다.</p>
              ) : (
                <>
                  <p className="mb-2">활성 상품이 없습니다.</p>
                  <p className="text-sm text-gray-400">새로운 상품이 등록되면 자동으로 나타납니다.</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredProductLinks.map((link) => (
                <div
                  key={link.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <FiCheckCircle className="text-xs" />
                          자동 링크
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {link.productCode}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 truncate mb-1">
                        {link.title || link.product?.title || '상품명 없음'}
                      </h3>
                      <div className="text-xs text-gray-500 font-mono break-all line-clamp-1">
                        {link.url}
                      </div>
                    </div>
                    {/* 통계 표시 (DB 저장된 자동 링크용) */}
                    {(link._count?.leads > 0 || link._count?.sales > 0) && (
                      <div className="flex flex-col items-end text-xs text-gray-600 mr-2">
                        <span>리드: <span className="font-semibold text-blue-600">{link._count?.leads || 0}</span></span>
                        <span>판매: <span className="font-semibold text-emerald-600">{link._count?.sales || 0}</span></span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => copyToClipboard(link.url)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title="링크 복사"
                      >
                        <FiCopy />
                        복사
                      </button>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                        title="상품 페이지 열기"
                      >
                        <FiExternalLink />
                        열기
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 전체 복사 버튼 */}
          {filteredProductLinks.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  const allLinks = filteredProductLinks
                    .map((link) => `[${link.title || link.productCode}]\n${link.url}`)
                    .join('\n\n');
                  copyToClipboard(allLinks);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FiCopy />
                전체 링크 복사 ({filteredProductLinks.length}개)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

