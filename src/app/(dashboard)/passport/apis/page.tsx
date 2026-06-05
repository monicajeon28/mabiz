'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Ship, Search, Download, FileSpreadsheet, ArrowLeft, Users, RefreshCw, Loader2, Lock } from 'lucide-react';
import { showError } from '@/components/ui/Toast';
import { useSession } from '@/hooks/useSession';
import type { ApisRow } from '@/app/api/admin/apis/excel/route';

// 실제 판매 상품(CruiseProduct) — /api/products 응답
interface ProductItem {
  id: number;
  code: string;            // productCode
  name: string;            // packageName
  cruiseLine: string;
  shipName: string | null;
  departureDate: string | null;
  saleStatus: string | null;
  isActive: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString('ko-KR'); } catch { return '-'; }
}

export default function ApisPage() {
  const { role } = useSession();
  // APIS 엑셀 엔드포인트가 OWNER/GLOBAL_ADMIN 전용이므로 페이지도 동일 권한으로 가드
  const canManage = role === 'OWNER' || role === 'GLOBAL_ADMIN';

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProductItem | null>(null);
  const [rows, setRows] = useState<ApisRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  // 실제 판매 상품 목록 로드 (/products 와 동일 소스)
  const loadProducts = useCallback(async (q: string) => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set('isActive', 'true');           // 현재 판매중 상품만
      params.set('limit', '200');                // 선택 UI: 판매중 상품을 한 번에 로드
      if (q.trim()) params.set('q', q.trim());   // 선박명·크루즈명·상품코드 검색
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (data.ok) setProducts(data.products ?? []);
      else showError(data.error ?? '상품 목록을 불러오지 못했습니다.');
    } catch { showError('네트워크 오류'); }
    finally { setLoadingProducts(false); }
  }, []);

  useEffect(() => { loadProducts(''); }, [loadProducts]);

  // 상품 선택 → /products 와 동일한 productCode 기준 APIS 미리보기
  const selectProduct = async (product: ProductItem) => {
    setSelected(product);
    setLoadingRows(true);
    setRows([]);
    try {
      const res = await fetch(`/api/admin/apis/excel?productCode=${encodeURIComponent(product.code)}&preview=1`);
      const data = await res.json();
      if (data.ok) setRows(data.rows ?? []);
      else showError(data.error ?? 'APIS 데이터를 불러오지 못했습니다.');
    } catch { showError('네트워크 오류'); }
    finally { setLoadingRows(false); }
  };

  // 엑셀 다운로드 — /products 와 동일 엔드포인트(productCode 기준)
  const downloadExcel = () => {
    if (!selected) return;
    window.open(`/api/admin/apis/excel?productCode=${encodeURIComponent(selected.code)}`, '_blank');
  };

  // 권한 가드: APIS 엑셀이 OWNER/GLOBAL_ADMIN 전용이라 페이지도 동일하게 차단
  if (role && !canManage) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white border border-dashed border-gray-300 rounded-xl">
          <Lock className="w-10 h-10 mb-3 text-gray-300" />
          <p className="text-sm">APIS 관리는 대리점장(OWNER) 이상만 접근할 수 있습니다</p>
          <Link href="/passport" className="mt-3 text-sm text-emerald-600 hover:underline">여권 관리로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/passport" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            상품별 APIS 관리
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">판매 중인 상품을 선택하면 탑승객 APIS(승객정보)를 확인하고 엑셀로 다운로드합니다</p>
        </div>
        <button
          onClick={() => loadProducts(search)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 좌측: 판매 상품 목록 */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadProducts(search)}
              placeholder="선박명·크루즈명·상품코드 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Ship className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                판매 중인 상품이 없습니다
              </div>
            ) : (
              products.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selected?.id === p.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Ship className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-sm text-gray-900 truncate">{p.shipName || p.cruiseLine || '선박미정'}</span>
                  </div>
                  {p.name && <p className="text-xs text-gray-500 truncate mb-1">{p.name}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {p.departureDate && <span>{fmtDate(p.departureDate)} 출발</span>}
                    {p.saleStatus && <span className="text-emerald-600">{p.saleStatus}</span>}
                  </div>
                  {p.code && <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{p.code}</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 우측: APIS 테이블 */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white border border-dashed border-gray-300 rounded-xl">
              <FileSpreadsheet className="w-10 h-10 mb-3 text-gray-300" />
              <p className="text-sm">왼쪽에서 상품을 선택하세요</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900">{selected.shipName || selected.name}</h2>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span>{selected.code}</span>
                    <span className="text-gray-300">·</span>
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />탑승객 {rows.length}명</span>
                  </p>
                </div>
                <button
                  onClick={downloadExcel}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                >
                  <Download className="w-4 h-4" />
                  엑셀 다운로드
                </button>
              </div>

              {loadingRows ? (
                <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : rows.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  아직 제출된 탑승객 APIS 정보가 없습니다 — 빈 양식 엑셀은 위 버튼으로 다운로드할 수 있습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium">예약(RV)</th>
                        <th className="px-2 py-2 text-left font-medium">객실</th>
                        <th className="px-2 py-2 text-left font-medium">성명</th>
                        <th className="px-2 py-2 text-left font-medium">영문</th>
                        <th className="px-2 py-2 text-left font-medium">성별</th>
                        <th className="px-2 py-2 text-left font-medium">생년월일</th>
                        <th className="px-2 py-2 text-left font-medium">여권번호</th>
                        <th className="px-2 py-2 text-left font-medium">만료일</th>
                        <th className="px-2 py-2 text-left font-medium">연락처</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((t, idx) => (
                        <tr key={`${t.rv}-${t.seq}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-2 py-2 text-gray-600">{t.rv || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.cabinType || t.cabin || '-'}</td>
                          <td className="px-2 py-2 font-medium text-gray-900">{t.korName || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{[t.engSurname, t.engGivenName].filter(Boolean).join(' ') || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.gender || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.birthDate || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.passportNo || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.expiryDate || '-'}</td>
                          <td className="px-2 py-2 text-gray-600">{t.phone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
