// components/admin/PeriodPricingEditor.tsx
// 기간별 가격 편집 컴포넌트

'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiCalendar,
  FiSave,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiDollarSign,
} from 'react-icons/fi';

interface CabinPrice {
  cabinType: string;
  fareCategory: string;
  fareLabel?: string;
  saleAmount: number;
  costAmount: number;
  netRevenue?: number;
}

interface PricePeriod {
  id?: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  cabinPrices: CabinPrice[];
}

interface MaxPrice {
  cabinType: string;
  maxPrice: number;
}

interface PeriodPricingEditorProps {
  productCode: string;
  onSave?: () => void;
}

const CABIN_TYPES = [
  '발코니',
  '오션뷰',
  '인사이드',
  '스위트',
  '미니스위트',
  '디럭스발코니',
  '프리미엄발코니',
];

const FARE_CATEGORIES = [
  { value: 'adult', label: '1,2번째 성인' },
  { value: 'adult3rd', label: '만 12세 이상 (3번째)' },
  { value: 'child2to11', label: '만 2-11세' },
  { value: 'infantUnder2', label: '만 2세 미만' },
];

export default function PeriodPricingEditor({
  productCode,
  onSave,
}: PeriodPricingEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periods, setPeriods] = useState<PricePeriod[]>([]);
  const [maxPrices, setMaxPrices] = useState<MaxPrice[]>([]);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PricePeriod | null>(null);
  const [showMaxPriceModal, setShowMaxPriceModal] = useState(false);

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/products/${productCode}/price-periods`);
      if (res.ok) {
        const data = await res.json();
        setPeriods(
          data.periods.map((p: any) => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate.split('T')[0],
            endDate: p.endDate.split('T')[0],
            isActive: p.isActive,
            cabinPrices: p.ProductCabinPrice || [],
          }))
        );
        setMaxPrices(data.maxPrices || []);
      }
    } catch (error) {
      logger.error('Failed to fetch pricing data:', error);
    } finally {
      setLoading(false);
    }
  }, [productCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 새 기간 추가
  const handleAddPeriod = () => {
    setEditingPeriod({
      name: '',
      startDate: '',
      endDate: '',
      isActive: true,
      cabinPrices: [],
    });
    setShowAddModal(true);
  };

  // 기간 저장
  const handleSavePeriod = async () => {
    if (!editingPeriod) return;

    try {
      setSaving(true);
      const isNew = !editingPeriod.id;
      const url = isNew
        ? `/api/admin/products/${productCode}/price-periods`
        : `/api/admin/products/${productCode}/price-periods/${editingPeriod.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPeriod.name,
          startDate: editingPeriod.startDate,
          endDate: editingPeriod.endDate,
          isActive: editingPeriod.isActive,
          cabinPrices: editingPeriod.cabinPrices,
        }),
      });

      if (res.ok) {
        await fetchData();
        setShowAddModal(false);
        setEditingPeriod(null);
        onSave?.();
      } else {
        const error = await res.json();
        alert(error.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to save period:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 기간 삭제
  const handleDeletePeriod = async (periodId: number) => {
    if (!confirm('이 가격 기간을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(
        `/api/admin/products/${productCode}/price-periods/${periodId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        await fetchData();
        onSave?.();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to delete period:', error);
    }
  };

  // 기간 편집
  const handleEditPeriod = (period: PricePeriod) => {
    setEditingPeriod({ ...period });
    setShowAddModal(true);
  };

  // 최고가 저장
  const handleSaveMaxPrices = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/products/${productCode}/max-prices`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPrices }),
      });

      if (res.ok) {
        setShowMaxPriceModal(false);
        onSave?.();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to save max prices:', error);
    } finally {
      setSaving(false);
    }
  };

  // 객실 가격 추가
  const addCabinPrice = () => {
    if (!editingPeriod) return;
    setEditingPeriod({
      ...editingPeriod,
      cabinPrices: [
        ...editingPeriod.cabinPrices,
        {
          cabinType: CABIN_TYPES[0],
          fareCategory: FARE_CATEGORIES[0].value,
          saleAmount: 0,
          costAmount: 0,
        },
      ],
    });
  };

  // 객실 가격 업데이트
  const updateCabinPrice = (index: number, updates: Partial<CabinPrice>) => {
    if (!editingPeriod) return;
    const newPrices = [...editingPeriod.cabinPrices];
    newPrices[index] = { ...newPrices[index], ...updates };
    setEditingPeriod({ ...editingPeriod, cabinPrices: newPrices });
  };

  // 객실 가격 삭제
  const removeCabinPrice = (index: number) => {
    if (!editingPeriod) return;
    setEditingPeriod({
      ...editingPeriod,
      cabinPrices: editingPeriod.cabinPrices.filter((_, i) => i !== index),
    });
  };

  // 최고가 업데이트
  const updateMaxPrice = (cabinType: string, maxPrice: number) => {
    const existing = maxPrices.find((mp) => mp.cabinType === cabinType);
    if (existing) {
      setMaxPrices(
        maxPrices.map((mp) =>
          mp.cabinType === cabinType ? { ...mp, maxPrice } : mp
        )
      );
    } else {
      setMaxPrices([...maxPrices, { cabinType, maxPrice }]);
    }
  };

  // 할인율 계산
  const getDiscountRate = (cabinType: string, saleAmount: number) => {
    const max = maxPrices.find((mp) => mp.cabinType === cabinType)?.maxPrice;
    if (!max || max <= 0 || saleAmount >= max) return 0;
    return Math.round(((max - saleAmount) / max) * 100);
  };

  // 기간 상태 표시
  const getPeriodStatus = (period: PricePeriod) => {
    const now = new Date();
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);

    if (!period.isActive) {
      return { label: '비활성', color: 'bg-gray-100 text-gray-600' };
    }
    if (now < start) {
      return { label: '예정', color: 'bg-blue-100 text-blue-600' };
    }
    if (now > end) {
      return { label: '종료', color: 'bg-gray-100 text-gray-600' };
    }
    return { label: '진행중', color: 'bg-green-100 text-green-600' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">기간별 가격 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            판매 기간에 따라 다른 가격을 설정할 수 있습니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMaxPriceModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <FiDollarSign size={18} />
            최고가 설정
          </button>
          <button
            onClick={handleAddPeriod}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus size={18} />
            기간 추가
          </button>
        </div>
      </div>

      {/* 최고가 요약 */}
      {maxPrices.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-800 mb-2">최고가 (정가)</h4>
          <div className="flex flex-wrap gap-4">
            {maxPrices.map((mp) => (
              <div key={mp.cabinType} className="text-sm">
                <span className="text-gray-600">{mp.cabinType}:</span>{' '}
                <span className="font-semibold text-purple-700">
                  {mp.maxPrice.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기간 목록 */}
      {periods.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FiCalendar className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500 mb-4">등록된 가격 기간이 없습니다</p>
          <button
            onClick={handleAddPeriod}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            첫 가격 기간 추가하기 →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {periods.map((period) => {
            const status = getPeriodStatus(period);
            const isExpanded = expandedPeriodId === period.id;

            return (
              <div
                key={period.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* 기간 헤더 */}
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() =>
                    setExpandedPeriodId(isExpanded ? null : period.id || null)
                  }
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${status.color}`}
                    >
                      {status.label}
                    </span>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {period.name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {new Date(period.startDate).toLocaleDateString('ko-KR')} ~{' '}
                        {new Date(period.endDate).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {period.cabinPrices.length}개 가격
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPeriod(period);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (period.id) handleDeletePeriod(period.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <FiTrash2 size={16} />
                    </button>
                    {isExpanded ? (
                      <FiChevronUp className="text-gray-400" />
                    ) : (
                      <FiChevronDown className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* 가격 상세 */}
                {isExpanded && (
                  <div className="p-4 bg-white">
                    {period.cabinPrices.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        등록된 가격이 없습니다
                      </p>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 text-sm font-semibold text-gray-600">
                              객실 타입
                            </th>
                            <th className="text-left py-2 text-sm font-semibold text-gray-600">
                              요금 구분
                            </th>
                            <th className="text-right py-2 text-sm font-semibold text-gray-600">
                              판매가
                            </th>
                            <th className="text-right py-2 text-sm font-semibold text-gray-600">
                              입금가
                            </th>
                            <th className="text-right py-2 text-sm font-semibold text-gray-600">
                              순매출
                            </th>
                            <th className="text-right py-2 text-sm font-semibold text-gray-600">
                              할인율
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {period.cabinPrices.map((price, idx) => {
                            const discountRate = getDiscountRate(
                              price.cabinType,
                              price.saleAmount
                            );
                            const netRevenue = price.saleAmount - price.costAmount;

                            return (
                              <tr
                                key={idx}
                                className="border-b border-gray-100 last:border-0"
                              >
                                <td className="py-2 text-sm">{price.cabinType}</td>
                                <td className="py-2 text-sm">
                                  {FARE_CATEGORIES.find(
                                    (f) => f.value === price.fareCategory
                                  )?.label || price.fareCategory}
                                </td>
                                <td className="py-2 text-sm text-right font-semibold text-red-600">
                                  {price.saleAmount.toLocaleString()}원
                                </td>
                                <td className="py-2 text-sm text-right text-gray-600">
                                  {price.costAmount.toLocaleString()}원
                                </td>
                                <td className="py-2 text-sm text-right font-semibold text-green-600">
                                  {netRevenue.toLocaleString()}원
                                </td>
                                <td className="py-2 text-sm text-right">
                                  {discountRate > 0 && (
                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold">
                                      {discountRate}% OFF
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 기간 추가/편집 모달 */}
      {showAddModal && editingPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold text-gray-900">
                {editingPeriod.id ? '가격 기간 편집' : '새 가격 기간 추가'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPeriod(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    기간명 *
                  </label>
                  <input
                    type="text"
                    value={editingPeriod.name}
                    onChange={(e) =>
                      setEditingPeriod({ ...editingPeriod, name: e.target.value })
                    }
                    placeholder="예: 조기예약 할인"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    시작일 *
                  </label>
                  <input
                    type="date"
                    value={editingPeriod.startDate}
                    onChange={(e) =>
                      setEditingPeriod({
                        ...editingPeriod,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    종료일 *
                  </label>
                  <input
                    type="date"
                    value={editingPeriod.endDate}
                    onChange={(e) =>
                      setEditingPeriod({
                        ...editingPeriod,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 객실 가격 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-gray-700">
                    객실별 가격
                  </label>
                  <button
                    onClick={addCabinPrice}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    <FiPlus size={14} />
                    가격 추가
                  </button>
                </div>

                {editingPeriod.cabinPrices.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500 mb-2">등록된 가격이 없습니다</p>
                    <button
                      onClick={addCabinPrice}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      가격 추가하기 →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editingPeriod.cabinPrices.map((price, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            객실 타입
                          </label>
                          <select
                            value={price.cabinType}
                            onChange={(e) =>
                              updateCabinPrice(idx, { cabinType: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            {CABIN_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            요금 구분
                          </label>
                          <select
                            value={price.fareCategory}
                            onChange={(e) =>
                              updateCabinPrice(idx, {
                                fareCategory: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            {FARE_CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            판매가 (원)
                          </label>
                          <input
                            type="number"
                            value={price.saleAmount || ''}
                            onChange={(e) =>
                              updateCabinPrice(idx, {
                                saleAmount: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            입금가 (원)
                          </label>
                          <input
                            type="number"
                            value={price.costAmount || ''}
                            onChange={(e) =>
                              updateCabinPrice(idx, {
                                costAmount: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => removeCabinPrice(idx)}
                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <FiTrash2 size={16} />
                          </button>
                          {price.saleAmount > 0 && price.costAmount > 0 && (
                            <div className="text-xs text-gray-500 ml-2">
                              순매출:{' '}
                              <span className="font-semibold text-green-600">
                                {(price.saleAmount - price.costAmount).toLocaleString()}원
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPeriod(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                취소
              </button>
              <button
                onClick={handleSavePeriod}
                disabled={saving || !editingPeriod.name || !editingPeriod.startDate || !editingPeriod.endDate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <FiSave size={18} />
                )}
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 최고가 설정 모달 */}
      {showMaxPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">최고가 (정가) 설정</h3>
              <button
                onClick={() => setShowMaxPriceModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                최고가는 할인율 계산의 기준이 됩니다. 객실 타입별로 설정하세요.
              </p>

              {CABIN_TYPES.map((cabinType) => {
                const existing = maxPrices.find(
                  (mp) => mp.cabinType === cabinType
                );
                return (
                  <div key={cabinType} className="flex items-center gap-4">
                    <label className="w-32 text-sm font-medium text-gray-700">
                      {cabinType}
                    </label>
                    <input
                      type="number"
                      value={existing?.maxPrice || ''}
                      onChange={(e) =>
                        updateMaxPrice(cabinType, parseInt(e.target.value) || 0)
                      }
                      placeholder="최고가 입력"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-500">원</span>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowMaxPriceModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                취소
              </button>
              <button
                onClick={handleSaveMaxPrices}
                disabled={saving}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <FiSave size={18} />
                )}
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
