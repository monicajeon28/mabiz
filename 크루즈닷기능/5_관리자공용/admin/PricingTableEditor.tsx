// components/admin/PricingTableEditor.tsx
// 요금표 에디터 (도착일 기준 자동 계산)

'use client';

import { logger } from '@/lib/logger';
import { useState, useMemo } from 'react';
import { FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiEdit2, FiX, FiSave } from 'react-icons/fi';
import AutocompleteInput from './AutocompleteInput';
import roomTypesData from '@/data/room-types.json';

export interface PricingRow {
  id: string;
  roomType: string; // 객실타입
  adult?: number; // 성인 가격
  adult3rd?: number; // 성인3번째(만12세이상) 가격
  child2to11?: number; // 만2-11세 가격
  infantUnder2?: number; // 만2세미만 가격
}

interface PricingTableEditorProps {
  rows: PricingRow[];
  onChange: (rows: PricingRow[]) => void;
  departureDate?: string; // 출발일 (YYYY-MM-DD 형식)
  nights?: number; // 박 수 (도착일 계산용)
}

export default function PricingTableEditor({
  rows,
  onChange,
  departureDate,
  nights = 0
}: PricingTableEditorProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingRowInModal, setEditingRowInModal] = useState<PricingRow | null>(null);
  const [modalRowData, setModalRowData] = useState<PricingRow | null>(null);

  // 도착일 기준 만나이 계산 및 범위 표시
  const calculateAgeRange = (minAge: number, maxAge: number | null) => {
    if (!departureDate) return null;

    try {
      // 도착일 계산: 출발일 + nights
      const departure = new Date(departureDate + 'T00:00:00');

      // 유효한 날짜인지 확인
      if (isNaN(departure.getTime())) {
        logger.warn('[PricingTableEditor] Invalid departure date:', departureDate);
        return null;
      }

      const arrival = new Date(departure);
      // nights가 유효한 숫자인지 확인
      const validNights = typeof nights === 'number' && !isNaN(nights) ? nights : 0;
      arrival.setDate(arrival.getDate() + validNights);

      // 도착일이 유효한지 확인
      if (isNaN(arrival.getTime())) {
        logger.warn('[PricingTableEditor] Invalid arrival date calculation');
        return null;
      }

      const arrivalYear = arrival.getFullYear();
      const arrivalMonth = arrival.getMonth();
      const arrivalDay = arrival.getDate();

      const formatDate = (date: Date) => {
        if (isNaN(date.getTime())) return '날짜오류';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
      };

      if (maxAge !== null) {
        // 만 minAge세 이상 만 maxAge세 이하
        // 도착일 기준으로 만 maxAge세가 되는 마지막 날짜 (생년월일의 최대값)
        const maxBirthYear = arrivalYear - maxAge;
        const maxBirthDate = new Date(maxBirthYear, arrivalMonth, arrivalDay);

        // 도착일 기준으로 만 minAge세가 되는 첫 날짜 (생년월일의 최소값)
        // 만 minAge세가 되려면 도착일 기준으로 minAge년 전에 태어나야 함
        const minBirthYear = arrivalYear - minAge - 1;
        const minBirthDate = new Date(minBirthYear, arrivalMonth, arrivalDay);
        minBirthDate.setDate(minBirthDate.getDate() + 1); // 다음날부터 만 minAge세

        return `${formatDate(minBirthDate)} ~ ${formatDate(maxBirthDate)}`;
      } else {
        // 만 minAge세 미만 (만2세 미만의 경우)
        // 도착일 기준으로 만 2세가 되는 첫 날짜 이전에 태어난 사람
        const minBirthYear = arrivalYear - 2;
        const maxBirthDate = new Date(minBirthYear, arrivalMonth, arrivalDay);

        // 최소값은 없음 (과거로 무한대)
        return `${formatDate(maxBirthDate)} 이전`;
      }
    } catch (error) {
      logger.error('Failed to calculate age range:', error);
      return null;
    }
  };

  // 가격 포맷팅 (천단위 구분 표시: 1,000 형식)
  const formatPrice = (price: number | undefined) => {
    if (!price) return '';
    // 천단위 구분 표시 (예: 1,000원, 10,000원)
    return `${price.toLocaleString()}원`;
  };

  // 월 할부 계산
  const calculateMonthly = (price: number | undefined) => {
    if (!price) return '';
    const monthly = Math.floor(price / 24);
    return `${monthly.toLocaleString()}원`;
  };

  const addRow = () => {
    const newRow: PricingRow = {
      id: `row-${Date.now()}`,
      roomType: ''
    };
    onChange([...rows, newRow]);
    setExpandedRow(newRow.id);
  };

  const removeRow = (id: string) => {
    if (!confirm('이 행을 삭제하시겠습니까?')) return;
    onChange(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, updates: Partial<PricingRow>) => {
    const updated = rows.map(r => r.id === id ? { ...r, ...updates } : r);
    onChange(updated);
  };

  // 모달에서 행 편집
  const openEditModal = (row: PricingRow) => {
    setModalRowData({ ...row });
    setEditingRowInModal(row);
  };

  const closeEditModal = () => {
    setEditingRowInModal(null);
    setModalRowData(null);
  };

  const saveModalRow = () => {
    if (!editingRowInModal || !modalRowData) return;
    updateRow(editingRowInModal.id, modalRowData);
    closeEditModal();
  };

  const moveRow = (id: string, direction: 'up' | 'down') => {
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
      const newRows = [...rows];
      [newRows[index], newRows[index - 1]] = [newRows[index - 1], newRows[index]];
      onChange(newRows);
    } else if (direction === 'down' && index < rows.length - 1) {
      const newRows = [...rows];
      [newRows[index], newRows[index + 1]] = [newRows[index + 1], newRows[index]];
      onChange(newRows);
    }
  };

  // 표시할 열 결정 (모든 열 항상 표시)
  const visibleColumns = useMemo(() => {
    return {
      roomType: true, // 객실타입은 항상 표시
      adult: true, // 1,2번째 성인 항상 표시
      adult3rd: true, // 만 12세 이상 항상 표시
      child2to11: true, // 만 2-11세 항상 표시
      infantUnder2: true // 만 2세 미만 항상 표시
    };
  }, []);

  // 행이 비어있는지 확인 (객실타입만 있고 다른 값이 없으면 숨김)
  const isRowEmpty = (row: PricingRow) => {
    return !row.roomType && 
           !row.adult && 
           !row.adult3rd && 
           !row.child2to11 && 
           !row.infantUnder2;
  };

  // 표시할 행만 필터링 (편집 중인 행은 항상 표시)
  const visibleRows = rows.filter(row => {
    // 편집 중인 행은 항상 표시
    if (expandedRow === row.id) return true;
    // 그 외는 비어있지 않은 행만 표시
    return !isRowEmpty(row);
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">요금표</h3>
          {departureDate && (
            <p className="text-sm text-gray-600 mt-1">
              도착일 기준: {(() => {
                const departure = new Date(departureDate + 'T00:00:00');
                if (isNaN(departure.getTime())) return '날짜오류';
                const arrival = new Date(departure);
                const validNights = typeof nights === 'number' && !isNaN(nights) ? nights : 0;
                arrival.setDate(arrival.getDate() + validNights);
                if (isNaN(arrival.getTime())) return '날짜오류';
                return arrival.toLocaleDateString('ko-KR');
              })()}
              <span className="text-gray-400 ml-2">
                {(() => {
                  const departure = new Date(departureDate + 'T00:00:00');
                  if (isNaN(departure.getTime())) return '(출발일 오류)';
                  const validNights = typeof nights === 'number' && !isNaN(nights) ? nights : 0;
                  return `(출발 ${departure.toLocaleDateString('ko-KR')} + ${validNights}박)`;
                })()}
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!departureDate && (
            <div className="text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
              ⚠️ 출발일을 설정하면 연령 범위가 도착일 기준으로 자동 계산됩니다
            </div>
          )}
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus size={18} />
            행 추가
          </button>
        </div>
      </div>

      {/* 요금표 */}
      {visibleRows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">요금표 행을 추가하세요</p>
          <button
            onClick={addRow}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            첫 행 추가하기 →
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                  객실 타입
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-300">
                  <span className="text-red-600 font-bold">1,2번째 성인</span>
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-300">
                  만 12세 이상
                  <div className="text-xs font-normal text-gray-500 mt-1">
                    (3번째)
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-300">
                  만 2-11세
                  {departureDate && (
                    <div className="text-xs font-normal text-blue-600 mt-1">
                      {calculateAgeRange(2, 11)}
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  만 2세 미만
                  {departureDate && (
                    <div className="text-xs font-normal text-blue-600 mt-1">
                      {calculateAgeRange(0, 1)}
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-24">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const isExpanded = expandedRow === row.id;

                return (
                  <tr
                    key={row.id}
                    className="border-b border-gray-200 hover:bg-gray-50"
                  >
                    {/* 객실타입 */}
                    <td className="px-4 py-3 border-r border-gray-200">
                      {isExpanded ? (
                        <AutocompleteInput
                          value={row.roomType}
                          onChange={(value) => updateRow(row.id, { roomType: value })}
                          options={roomTypesData as string[]}
                          placeholder="객실 타입 선택 또는 직접 입력"
                        />
                      ) : (
                        <span className="font-medium text-gray-800">
                          {row.roomType || '객실타입 미설정'}
                        </span>
                      )}
                    </td>

                    {/* 1,2번째 성인 */}
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      {isExpanded ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            value={row.adult || ''}
                            onChange={(e) => updateRow(row.id, { 
                              adult: e.target.value ? parseInt(e.target.value) : undefined 
                            })}
                            placeholder="원 단위 입력 (예: 550000 또는 1000)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                            step="1000"
                          />
                          {(row.adult || 0) > 0 && (
                            <div className="text-xs text-gray-600">
                              {formatPrice(row.adult)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {row.adult ? (
                            <div className="font-semibold text-red-600 text-lg">
                              {formatPrice(row.adult)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 만 12세 이상 (3번째) */}
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      {isExpanded ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            value={row.adult3rd || ''}
                            onChange={(e) => updateRow(row.id, { 
                              adult3rd: e.target.value ? parseInt(e.target.value) : undefined 
                            })}
                            placeholder="원 단위 입력 (예: 550000 또는 1000)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                            step="1000"
                          />
                          {(row.adult3rd || 0) > 0 && (
                            <div className="text-xs text-gray-600">
                              {formatPrice(row.adult3rd)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {row.adult3rd ? (
                            <div className="font-semibold text-gray-800">
                              {formatPrice(row.adult3rd)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 만 2-11세 */}
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      {isExpanded ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            value={row.child2to11 || ''}
                            onChange={(e) => updateRow(row.id, { 
                              child2to11: e.target.value ? parseInt(e.target.value) : undefined 
                            })}
                            placeholder="원 단위 입력 (예: 550000 또는 1000)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                            step="1000"
                          />
                          {(row.child2to11 || 0) > 0 && (
                            <div className="text-xs text-gray-600">
                              {formatPrice(row.child2to11)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {row.child2to11 ? (
                            <div className="font-semibold text-gray-800">
                              {formatPrice(row.child2to11)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 만 2세 미만 */}
                    <td className="px-4 py-3 text-center">
                      {isExpanded ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            value={row.infantUnder2 || ''}
                            onChange={(e) => updateRow(row.id, { 
                              infantUnder2: e.target.value ? parseInt(e.target.value) : undefined 
                            })}
                            placeholder="원 단위 입력 (예: 550000 또는 1000)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                            step="1000"
                          />
                          {(row.infantUnder2 || 0) > 0 && (
                            <div className="text-xs text-gray-600">
                              {formatPrice(row.infantUnder2)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {row.infantUnder2 ? (
                            <div className="font-semibold text-gray-800">
                              {formatPrice(row.infantUnder2)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 관리 버튼 */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => moveRow(row.id, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="위로"
                        >
                          <FiChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => moveRow(row.id, 'down')}
                          disabled={index === visibleRows.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="아래로"
                        >
                          <FiChevronDown size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(row)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <FiEdit2 size={14} />
                          모달 편집
                        </button>
                        <button
                          onClick={() => removeRow(row.id)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="삭제"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>사용 방법:</strong> 행 추가 버튼을 클릭하여 객실 타입을 추가하고, 모달 편집 버튼을 클릭하여 각 연령대별 요금을 입력하세요.
          금액은 원 단위로 입력하세요 (예: 550000원 또는 1000원). 천원 단위와 만원 단위 모두 입력 가능합니다.
          출발일을 설정하면 연령 범위가 <strong>도착일 기준</strong>으로 자동 계산되어 표시됩니다.
        </p>
      </div>

      {/* 요금표 편집 모달 */}
      {editingRowInModal && modalRowData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold text-gray-900">요금표 편집</h3>
              <button
                onClick={closeEditModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* 객실 타입 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  객실 타입 *
                </label>
                <AutocompleteInput
                  value={modalRowData.roomType}
                  onChange={(value) => setModalRowData({ ...modalRowData, roomType: value })}
                  options={roomTypesData}
                  placeholder="객실 타입을 선택하거나 입력하세요"
                  className="w-full"
                />
                <p className="mt-2 text-xs text-gray-500">
                  💡 드롭다운에서 선택하거나 직접 입력할 수 있습니다.
                </p>
              </div>

              {/* 가격 입력 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                  <label className="block text-sm font-semibold text-red-700 mb-2">
                    1,2번째 성인 가격 *
                  </label>
                  <input
                    type="number"
                    value={modalRowData.adult || ''}
                    onChange={(e) => setModalRowData({ 
                      ...modalRowData, 
                      adult: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    placeholder="원 단위 입력 (예: 550000)"
                    className="w-full px-4 py-3 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-base"
                    min="0"
                    step="1000"
                  />
                  {modalRowData.adult && (
                    <p className="mt-2 text-lg font-bold text-red-600">
                      {formatPrice(modalRowData.adult)}
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <label className="block text-sm font-semibold text-blue-700 mb-2">
                    만 12세 이상 (3번째)
                  </label>
                  <input
                    type="number"
                    value={modalRowData.adult3rd || ''}
                    onChange={(e) => setModalRowData({ 
                      ...modalRowData, 
                      adult3rd: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    placeholder="원 단위 입력 (예: 450000)"
                    className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    min="0"
                    step="1000"
                  />
                  {modalRowData.adult3rd && (
                    <p className="mt-2 text-lg font-bold text-blue-600">
                      {formatPrice(modalRowData.adult3rd)}
                    </p>
                  )}
                </div>

                <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                  <label className="block text-sm font-semibold text-green-700 mb-2">
                    만 2-11세
                    {departureDate && (
                      <span className="text-xs font-normal text-green-600 ml-2">
                        ({calculateAgeRange(2, 11)})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={modalRowData.child2to11 || ''}
                    onChange={(e) => setModalRowData({ 
                      ...modalRowData, 
                      child2to11: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    placeholder="원 단위 입력 (예: 350000)"
                    className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base"
                    min="0"
                    step="1000"
                  />
                  {modalRowData.child2to11 && (
                    <p className="mt-2 text-lg font-bold text-green-600">
                      {formatPrice(modalRowData.child2to11)}
                    </p>
                  )}
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                  <label className="block text-sm font-semibold text-purple-700 mb-2">
                    만 2세 미만
                    {departureDate && (
                      <span className="text-xs font-normal text-purple-600 ml-2">
                        ({calculateAgeRange(0, 1)})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={modalRowData.infantUnder2 || ''}
                    onChange={(e) => setModalRowData({ 
                      ...modalRowData, 
                      infantUnder2: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    placeholder="원 단위 입력 (예: 100000)"
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base"
                    min="0"
                    step="1000"
                  />
                  {modalRowData.infantUnder2 && (
                    <p className="mt-2 text-lg font-bold text-purple-600">
                      {formatPrice(modalRowData.infantUnder2)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                취소
              </button>
              <button
                onClick={saveModalRow}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
              >
                <FiSave size={18} />
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

