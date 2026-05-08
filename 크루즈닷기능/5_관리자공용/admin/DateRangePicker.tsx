'use client';

import { useState, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import { FiCalendar, FiX } from 'react-icons/fi';
import 'react-day-picker/dist/style.css';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onDaysChange?: (days: number) => void;
  className?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onDaysChange,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [firstSelectedDate, setFirstSelectedDate] = useState<Date | null>(null); // 첫 번째 선택된 날짜 추적
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() => {
    if (startDate && endDate) {
      // 타임존 문제 방지를 위해 로컬 날짜로 파싱
      const [fromYear, fromMonth, fromDay] = startDate.split('-').map(Number);
      const [toYear, toMonth, toDay] = endDate.split('-').map(Number);
      
      const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
      const toDate = new Date(toYear, toMonth - 1, toDay);
      
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        return {
          from: fromDate,
          to: toDate,
        };
      }
    } else if (startDate) {
      const [fromYear, fromMonth, fromDay] = startDate.split('-').map(Number);
      const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
      
      if (!isNaN(fromDate.getTime())) {
        return {
          from: fromDate,
          to: undefined,
        };
      }
    }
    return undefined;
  });

  // props가 변경될 때 selectedRange 업데이트
  useEffect(() => {
    if (startDate && endDate) {
      // 타임존 문제 방지를 위해 로컬 날짜로 파싱
      const [fromYear, fromMonth, fromDay] = startDate.split('-').map(Number);
      const [toYear, toMonth, toDay] = endDate.split('-').map(Number);
      
      const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
      const toDate = new Date(toYear, toMonth - 1, toDay);
      
      // 유효한 날짜인지 확인
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        setSelectedRange({
          from: fromDate,
          to: toDate,
        });
      }
    } else if (startDate) {
      // 타임존 문제 방지를 위해 로컬 날짜로 파싱
      const [fromYear, fromMonth, fromDay] = startDate.split('-').map(Number);
      const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
      
      if (!isNaN(fromDate.getTime())) {
        setSelectedRange({
          from: fromDate,
          to: undefined,
        });
      }
    } else {
      setSelectedRange(undefined);
    }
  }, [startDate, endDate]);

  // 캘린더가 열릴 때 첫 번째 선택 날짜 초기화
  useEffect(() => {
    if (isOpen) {
      // 캘린더가 열릴 때 첫 번째 선택 날짜를 초기화
      if (!startDate && !endDate) {
        setFirstSelectedDate(null);
      } else if (startDate && !endDate) {
        // 출발일만 있는 경우, 출발일을 첫 번째 선택으로 설정
        const [fromYear, fromMonth, fromDay] = startDate.split('-').map(Number);
        const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
        setFirstSelectedDate(fromDate);
      } else {
        // 두 날짜 모두 있는 경우 초기화
        setFirstSelectedDate(null);
      }
    }
  }, [isOpen, startDate, endDate]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      // 날짜 선택 해제
      setSelectedRange(undefined);
      setFirstSelectedDate(null);
      onStartDateChange('');
      onEndDateChange('');
      return;
    }

    // 같은 날짜를 다시 클릭한 경우 처리
    if (firstSelectedDate && 
        firstSelectedDate.getTime() === date.getTime() && 
        !selectedRange?.to) {
      // 첫 번째 선택된 날짜를 다시 클릭한 경우: 선택 해제
      setFirstSelectedDate(null);
      setSelectedRange(undefined);
      onStartDateChange('');
      return;
    }
    
    if (selectedRange?.to && 
        selectedRange.to.getTime() === date.getTime()) {
      // 도착일을 다시 클릭한 경우: 선택 해제하고 첫 번째 선택 상태로
      setSelectedRange({ from: firstSelectedDate || date, to: undefined });
      onEndDateChange('');
      return;
    }

    // 날짜 선택 로직: 선택 순서에 따라 출발일/도착일 결정
    if (!firstSelectedDate) {
      // 첫 번째 선택: 출발일로 설정
      setFirstSelectedDate(date);
      setSelectedRange({ from: date, to: undefined });
      
      const fromYear = date.getFullYear();
      const fromMonth = String(date.getMonth() + 1).padStart(2, '0');
      const fromDay = String(date.getDate()).padStart(2, '0');
      const fromDate = `${fromYear}-${fromMonth}-${fromDay}`;
      
      onStartDateChange(fromDate);
      // 도착일이 이미 있으면 초기화 (새로운 출발일 선택 시)
      if (endDate) {
        onEndDateChange('');
      }
    } else {
      // 두 번째 선택: 도착일로 설정
      const toYear = date.getFullYear();
      const toMonth = String(date.getMonth() + 1).padStart(2, '0');
      const toDay = String(date.getDate()).padStart(2, '0');
      const toDate = `${toYear}-${toMonth}-${toDay}`;
      
      // 첫 번째 선택된 날짜를 출발일로, 두 번째 선택된 날짜를 도착일로 설정
      const fromYear = firstSelectedDate.getFullYear();
      const fromMonth = String(firstSelectedDate.getMonth() + 1).padStart(2, '0');
      const fromDay = String(firstSelectedDate.getDate()).padStart(2, '0');
      const fromDate = `${fromYear}-${fromMonth}-${fromDay}`;
      
      setSelectedRange({
        from: firstSelectedDate,
        to: date,
      });
      
      onStartDateChange(fromDate);
      onEndDateChange(toDate);
      
      // 일수 자동 계산
      if (onDaysChange) {
        const days = Math.ceil((date.getTime() - firstSelectedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        onDaysChange(days);
      }
      
      // 두 날짜 모두 선택되면 자동으로 닫기
      setIsOpen(false);
      setFirstSelectedDate(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      // YYYY-MM-DD 형식의 문자열을 Date 객체로 변환할 때 타임존 문제 방지
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      if (isNaN(date.getTime())) {
        return dateString; // 파싱 실패 시 원본 반환
      }
      
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* 날짜 입력 필드 - 하나로 통합 */}
      <div>
        <label className="block text-base md:text-lg font-semibold text-gray-800 mb-3">
          여행 기간 선택 *
        </label>
        <div className="relative">
          <input
            type="text"
            readOnly
            value={
              startDate && endDate
                ? `${formatDate(startDate)} ~ ${formatDate(endDate)}`
                : startDate
                ? `${formatDate(startDate)} ~ 종료일 선택`
                : '출발일과 종료일을 선택하세요'
            }
            onClick={() => setIsOpen(!isOpen)}
            placeholder="출발일과 종료일을 선택하세요"
            className={`w-full px-4 py-3 md:px-5 md:py-4 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base md:text-lg cursor-pointer ${
              !startDate || !endDate ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
            style={{ fontSize: '18px', minHeight: '56px' }}
          />
          <FiCalendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={22} />
        </div>
      </div>

      {/* 캘린더 드롭다운 */}
      {isOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 캘린더 팝업 */}
          <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-200 p-6 w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">날짜 범위 선택</h3>
                <p className="text-sm text-gray-600 mt-1">
                  출발일을 먼저 클릭한 후, 종료일을 클릭하세요
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX size={24} />
              </button>
            </div>
            
            {/* 선택된 날짜 표시 */}
            {(firstSelectedDate || selectedRange?.from || startDate) && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">출발일:</span>{' '}
                    <span className="text-blue-700 font-bold">
                      {firstSelectedDate
                        ? firstSelectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                        : selectedRange?.from
                        ? selectedRange.from.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                        : formatDate(startDate)}
                    </span>
                  </div>
                  {selectedRange?.to && (
                    <>
                      <span className="text-gray-400">→</span>
                      <div>
                        <span className="font-semibold text-gray-700">종료일:</span>{' '}
                        <span className="text-blue-700 font-bold">
                          {selectedRange.to.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                    </>
                  )}
                  {firstSelectedDate && !selectedRange?.to && (
                    <div className="text-gray-500 text-sm">
                      (종료일을 선택하세요)
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DayPicker
              mode="single"
              selected={firstSelectedDate || selectedRange?.from || undefined}
              onSelect={handleSelect}
              numberOfMonths={2}
              locale={ko}
              className="date-picker-custom"
              modifiersClassNames={{
                selected: 'bg-blue-600 text-white',
              }}
            />
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-semibold">
                💡 사용 방법: 출발일을 먼저 클릭한 후, 종료일을 클릭하면 자동으로 저장됩니다.
              </p>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .date-picker-custom {
          --rdp-cell-size: 45px;
          --rdp-accent-color: #2563eb;
          --rdp-background-color: #eff6ff;
        }
        .date-picker-custom .rdp-day {
          border-radius: 0.5rem;
          font-weight: 500;
          font-size: 16px;
          transition: all 0.2s;
        }
        .date-picker-custom .rdp-day:hover:not([disabled]):not(.rdp-day_selected) {
          background-color: #dbeafe;
          transform: scale(1.1);
        }
        .date-picker-custom .rdp-day_selected {
          background-color: #2563eb;
          color: white;
          font-weight: 700;
        }
        .date-picker-custom .rdp-day_range_start {
          border-top-left-radius: 9999px;
          border-bottom-left-radius: 9999px;
          background-color: #2563eb;
          color: white;
          font-weight: 700;
        }
        .date-picker-custom .rdp-day_range_end {
          border-top-right-radius: 9999px;
          border-bottom-right-radius: 9999px;
          background-color: #2563eb;
          color: white;
          font-weight: 700;
        }
        .date-picker-custom .rdp-day_range_middle {
          background-color: #dbeafe;
          color: #1e40af;
          font-weight: 600;
        }
        .date-picker-custom .rdp-head_cell {
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }
        .date-picker-custom .rdp-caption_label {
          font-weight: 700;
          font-size: 1.2rem;
          color: #111827;
        }
        .date-picker-custom .rdp-button {
          transition: all 0.2s;
        }
        .date-picker-custom .rdp-button:hover {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}

