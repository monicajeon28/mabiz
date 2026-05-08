// components/admin/FlightInfoEditor.tsx
// 항공 정보 입력 컴포넌트

'use client';

import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import AirlineSelector, { type AirlineSelection } from './AirlineSelector';
import { type SeatClass, getAirportTimezone } from '@/lib/data/airlines';
import { TERMINALS } from '@/lib/terminals';


// TODO(P0): product-detail.ts의 FlightInfo(canonical)와 통일 필요 — departure/return optional vs required 차이
// 현재 빌드 통과, 런타임 버그 없음 — Wave 2 리팩토링 시 re-export로 교체
export interface FlightInfo {
  travelPeriod: {
    startDate: string;
    endDate: string;
    nights: number;
    days: number;
  };
  departure: {
    from: string;
    to: string;
    date: string;
    time: string;
    arrivalTime?: string;
    flightNumber: string;
    duration: string;
    type: '직항' | '경유';
    airline?: string;
    airlineName?: string;
    seatClass?: SeatClass;
    baggageAllowance?: string;
  };
  return: {
    from: string;
    to: string;
    date: string;
    time: string;
    arrivalTime?: string;
    flightNumber: string;
    duration: string;
    type: '직항' | '경유';
    airline?: string;
    airlineName?: string;
    seatClass?: SeatClass;
    baggageAllowance?: string;
  };
  aircraftType?: string; // 비행기 정보 (추가)
  // 항공 유형 (기본값: 'roundtrip', 하위 호환성 유지)
  // none_domestic: 크루즈 국내출도착 (항공권 없음), none_local: 현지 크루즈 탑승 (항공권 미포함)
  // oneway: 출발 항공만 (귀국은 크루즈/기타)
  // oneway_return: 크루즈로 출발 → 귀국 항공만
  flightType?: 'roundtrip' | 'oneway' | 'oneway_return' | 'none' | 'none_domestic' | 'none_local' | 'pending_info' | 'ticket_only';
  // flightType === 'none_domestic' | 'none_local' 전용 — 크루즈 탑승 정보
  cruiseEmbarkPort?: string;
  cruiseDisembarkPort?: string;
  selfArrangeNote?: string;
}

interface FlightInfoEditorProps {
  flightInfo: FlightInfo | null;
  onChange: (flightInfo: FlightInfo | null) => void;
  startDate?: string;
  endDate?: string;
  nights?: number;
  days?: number;
}

export default function FlightInfoEditor({
  flightInfo,
  onChange,
  startDate,
  endDate,
  nights,
  days,
}: FlightInfoEditorProps) {
  const [localFlightInfo, setLocalFlightInfo] = useState<FlightInfo>(
    flightInfo || {
      travelPeriod: {
        startDate: startDate || '',
        endDate: endDate || '',
        nights: nights || 0,
        days: days || 0,
      },
      departure: {
        from: '',
        to: '',
        date: startDate || '',
        time: '',
        arrivalTime: '',
        flightNumber: '',
        duration: '',
        type: '직항',
      },
      return: {
        from: '',
        to: '',
        date: endDate || '',
        time: '',
        arrivalTime: '',
        flightNumber: '',
        duration: '',
        type: '직항',
      },
      aircraftType: '',
    }
  );

  // 외부 flightInfo prop 변경 시 localFlightInfo 동기화 (데이터 로드 후 반영)
  useEffect(() => {
    if (flightInfo) {
      setLocalFlightInfo(prev => ({
        ...prev,
        ...flightInfo,
        travelPeriod: {
          ...prev.travelPeriod,
          ...flightInfo.travelPeriod,
        },
        departure: {
          ...prev.departure,
          ...flightInfo.departure,
        },
        return: {
          ...prev.return,
          ...flightInfo.return,
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightInfo]);

  // startDate, endDate, nights, days 변경 시 travelPeriod 자동 업데이트
  useEffect(() => {
    if (!startDate || !endDate) return;
    // P0-4: updatedRef로 최신 값 캡처 후 cleanup 가능한 setTimeout 사용
    let updated: FlightInfo | null = null;
    setLocalFlightInfo(prev => {
      updated = {
        ...prev,
        travelPeriod: {
          startDate,
          endDate,
          nights: nights || prev.travelPeriod.nights,
          days: days || prev.travelPeriod.days,
        },
        departure: { ...prev.departure, date: startDate },
      };
      return updated;
    });
    const tid = setTimeout(() => {
      if (updated) onChange(updated);
    }, 0);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, nights, days]);

  const updateFlightInfo = (updates: Partial<FlightInfo>) => {
    const newInfo = { ...localFlightInfo, ...updates };
    setLocalFlightInfo(newInfo);
    onChange(newInfo);
  };

  // 항공 유형 (기존 데이터 하위 호환: flightType 없으면 'roundtrip', 레거시 'none'은 'none_local'로 자동 마이그레이션)
  const flightType = localFlightInfo.flightType === 'none'
    ? 'none_local'
    : (localFlightInfo.flightType || 'roundtrip');

  // 출국 섹션 표시 여부: 왕복 + 편도 출발만 표시 (편도 귀국/항공없음 제외)
  const showDeparture = flightType === 'roundtrip' || flightType === 'oneway';
  // 귀국 섹션 표시 여부: 왕복 + 편도 귀국만 표시
  const showReturn = flightType === 'roundtrip' || flightType === 'oneway_return';

  // 항공 유형 변경 — 유형에 따른 관련 항공 정보 초기화 (고객 혼란 방지)
  const handleFlightTypeChange = (newType: 'roundtrip' | 'oneway' | 'oneway_return' | 'none' | 'none_domestic' | 'none_local' | 'pending_info' | 'ticket_only') => {
    const emptyFlight = { from: '', to: '', date: '', time: '', arrivalTime: '', flightNumber: '', duration: '', type: '직항' as const, airline: '', airlineName: '', seatClass: undefined, baggageAllowance: '' };
    if (newType === 'none_domestic' || newType === 'none_local' || newType === 'pending_info' || newType === 'ticket_only') {
      // 항공없음/미정: 출발/귀국 모든 필드 초기화
      const updated: FlightInfo = {
        ...localFlightInfo,
        flightType: newType,
        departure: { ...localFlightInfo.departure, ...emptyFlight },
        return: { ...localFlightInfo.return, ...emptyFlight },
      };
      setLocalFlightInfo(updated);
      onChange(updated);
    } else if (newType === 'oneway') {
      // 편도 출발: 귀국 필드 초기화
      const updated: FlightInfo = {
        ...localFlightInfo,
        flightType: 'oneway',
        return: { ...localFlightInfo.return, ...emptyFlight },
      };
      setLocalFlightInfo(updated);
      onChange(updated);
    } else if (newType === 'oneway_return') {
      // 편도 귀국: 출발 필드 초기화 (크루즈로 출발, 귀국편 항공만)
      const updated: FlightInfo = {
        ...localFlightInfo,
        flightType: 'oneway_return',
        departure: { ...localFlightInfo.departure, ...emptyFlight },
      };
      setLocalFlightInfo(updated);
      onChange(updated);
    } else {
      updateFlightInfo({ flightType: newType });
    }
  };

  // 시간 차이 계산 함수 (시차 고려)
  const calculateDuration = (departureTime: string, arrivalTime: string, departureDate: string, departureAirport: string, arrivalAirport: string, arrivalDate?: string): string => {
    if (!departureTime || !arrivalTime || !departureAirport || !arrivalAirport || !departureDate) return '';
    
    try {
      // 출발지와 도착지의 UTC 오프셋 가져오기
      const depOffset = getAirportTimezone(departureAirport);
      const arrOffset = getAirportTimezone(arrivalAirport);
      
      // 시간 파싱 (HH:MM)
      const [depHours, depMinutes] = departureTime.split(':').map(Number);
      const [arrHours, arrMinutes] = arrivalTime.split(':').map(Number);
      
      // 유효성 검사
      if (isNaN(depHours) || isNaN(depMinutes) || isNaN(arrHours) || isNaN(arrMinutes)) {
        return '';
      }
      
      // 날짜 파싱 및 유효성 검사
      const depDate = new Date(departureDate + 'T00:00:00');
      if (isNaN(depDate.getTime())) {
        return '';
      }
      
      let arrDate: Date;
      if (arrivalDate) {
        arrDate = new Date(arrivalDate + 'T00:00:00');
        if (isNaN(arrDate.getTime())) {
          // arrivalDate가 유효하지 않으면 departureDate 사용
          arrDate = new Date(depDate);
        }
      } else {
        arrDate = new Date(depDate);
      }
      
      // 출발 시간이 오후(12시 이후)이고 도착 시간이 오전(12시 이전)이면 하루 추가
      // 이는 일반적으로 다음날 도착을 의미함
      if (depHours >= 12 && arrHours < 12 && !arrivalDate) {
        arrDate = new Date(arrDate);
        arrDate.setDate(arrDate.getDate() + 1);
      }
      
      // 날짜가 같은 경우에도 시간 차이를 확인하여 하루 추가 필요 여부 판단
      // UTC로 변환했을 때 음수가 나오면 하루 추가 필요
      const testDepUTC = new Date(Date.UTC(
        depDate.getFullYear(),
        depDate.getMonth(),
        depDate.getDate(),
        depHours - depOffset,
        depMinutes,
        0,
        0
      ));
      const testArrUTC = new Date(Date.UTC(
        arrDate.getFullYear(),
        arrDate.getMonth(),
        arrDate.getDate(),
        arrHours - arrOffset,
        arrMinutes,
        0,
        0
      ));
      
      // 유효성 검사
      if (isNaN(testDepUTC.getTime()) || isNaN(testArrUTC.getTime())) {
        return '';
      }
      
      // 테스트 계산으로 음수가 나오면 하루 추가
      if (testArrUTC.getTime() < testDepUTC.getTime()) {
        arrDate = new Date(arrDate);
        arrDate.setDate(arrDate.getDate() + 1);
      }
      
      // 출발지 현지시간을 UTC로 변환
      // 예: 인천 16:40 (UTC+9) -> UTC 07:40
      const depUTC = new Date(Date.UTC(
        depDate.getFullYear(),
        depDate.getMonth(),
        depDate.getDate(),
        depHours - depOffset,
        depMinutes,
        0,
        0
      ));
      
      // 도착지 현지시간을 UTC로 변환
      // 예: 시애틀 01:58 (UTC-8) -> UTC 09:58
      // arrDate가 하루 추가되었는지 확인하여 올바른 날짜 사용
      const arrUTC = new Date(Date.UTC(
        arrDate.getFullYear(),
        arrDate.getMonth(),
        arrDate.getDate(),
        arrHours - arrOffset,
        arrMinutes,
        0,
        0
      ));
      
      // 유효성 검사
      if (isNaN(depUTC.getTime()) || isNaN(arrUTC.getTime())) {
        return '';
      }
      
      // UTC 기준 시간 차이 계산 (밀리초)
      let diffMs = arrUTC.getTime() - depUTC.getTime();
      
      // 음수면 날짜가 넘어간 경우 (도착이 출발보다 이전인 경우)
      // 이 경우는 일반적으로 발생하지 않지만, 안전장치로 처리
      if (diffMs < 0) {
        // 하루 추가
        arrUTC.setUTCDate(arrUTC.getUTCDate() + 1);
        diffMs = arrUTC.getTime() - depUTC.getTime();
        
        // 여전히 유효하지 않으면 빈 문자열 반환
        if (diffMs < 0 || isNaN(arrUTC.getTime())) {
          return '';
        }
      }
      
      // 분 단위로 변환
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      if (totalMinutes < 0) {
        return '';
      }
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      // 디버깅 로그 (개발 중에만)
      if (process.env.NODE_ENV === 'development') {
        logger.log('[Flight Duration Calculation]', {
          departure: `${departureAirport} ${depHours}:${depMinutes.toString().padStart(2, '0')} (UTC${depOffset >= 0 ? '+' : ''}${depOffset})`,
          arrival: `${arrivalAirport} ${arrHours}:${arrMinutes.toString().padStart(2, '0')} (UTC${arrOffset >= 0 ? '+' : ''}${arrOffset})`,
          depUTC: depUTC.toISOString(),
          arrUTC: arrUTC.toISOString(),
          diffMs,
          result: `${hours}시간 ${minutes}분`
        });
      }
      
      return `${hours}시간 ${minutes}분`;
    } catch (error) {
      logger.error('Duration calculation error:', error);
      return '';
    }
  };

  // 날짜 포맷팅 (요일 포함)
  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = days[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  // 항공없음 - 국내출발 (출국만)
  const setNoFlightDeparture = () => {
    const updated = {
      ...localFlightInfo,
      departure: {
        ...localFlightInfo.departure,
        from: '국내항',
        to: '국내항',
        flightNumber: '🚢 항공없음',
        duration: '-',
        type: '직항' as const,
      },
    };
    setLocalFlightInfo(updated);
    onChange(updated);
  };

  // 항공없음 - 국내도착 (귀국만)
  const setNoFlightReturn = () => {
    const updated = {
      ...localFlightInfo,
      return: {
        ...localFlightInfo.return,
        from: '국내항',
        to: '국내항',
        flightNumber: '🚢 항공없음',
        duration: '-',
        type: '직항' as const,
      },
    };
    setLocalFlightInfo(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✈️</span>
          <h3 className="text-lg font-bold text-gray-800">항공 정보</h3>
        </div>
      </div>

      {/* 항공 유형 선택 드롭다운 */}
      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          항공 유형 <span className="text-red-500">*</span>
        </label>
        <select
          value={flightType}
          onChange={(e) => handleFlightTypeChange(e.target.value as 'roundtrip' | 'oneway' | 'oneway_return' | 'none' | 'none_domestic' | 'none_local' | 'pending_info' | 'ticket_only')}
          className="w-full border border-gray-300 rounded-lg px-3 py-3.5 text-base h-14 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="roundtrip">✈️ 왕복 — 출발 항공 + 귀국 항공</option>
          <option value="oneway">✈️ 편도 출발 — 출발 항공 → 현지 크루즈 탑승</option>
          <option value="oneway_return">🚢✈️ 편도 귀국 — 크루즈 출발 → 귀국 항공</option>
          <option value="ticket_only">🎟️ 자유여행 크루즈티켓 — 항공 미포함, 티켓만 판매</option>
          <option value="none_domestic">🚢 국내출발 크루즈 — 항공 없음</option>
          <option value="none_local">✈️ 항공미포함 — 항공 개별 준비 후 현지 탑승</option>
          <option value="pending_info">⏳ 미정 — 비행기 추후 안내</option>
        </select>
        {/* 선택된 유형 설명 */}
        <p className="text-xs text-gray-500 mt-1.5">
          {flightType === 'roundtrip' && '출발편과 귀국편 항공을 모두 입력합니다.'}
          {flightType === 'oneway' && '출발 항공만 입력합니다. 귀국은 크루즈 또는 별도 안내.'}
          {flightType === 'oneway_return' && '크루즈로 출발 후, 귀국편 항공만 입력합니다.'}
          {flightType === 'ticket_only' && '크루즈 티켓만 판매합니다. 항공은 고객이 개별 준비합니다.'}
          {flightType === 'none_domestic' && '국내 항구에서 직접 크루즈 탑승. 항공권 없음.'}
          {flightType === 'none_local' && '고객이 항공을 개별 준비하고 현지에서 탑승합니다.'}
          {flightType === 'pending_info' && '비행기 정보를 추후에 안내할 예정입니다.'}
        </p>

        {/* 자유여행 티켓 전용 — 항공 자유 티켓팅 안내 영상 */}
        {flightType === 'ticket_only' && (
          <div className="mt-3 rounded-lg overflow-hidden border border-blue-200 bg-blue-50">
            <div className="px-3 pt-3 pb-2 space-y-1">
              <p className="text-sm font-semibold text-blue-800">
                🎬 자유여행 비행기 티켓은 이 영상을 참고하세요!
              </p>
              <p className="text-xs text-blue-600">
                *도움이 필요할 시 본사 문의 혹은 매니저님 문의 주세요*
              </p>
            </div>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/EnKJo9Ax6ys?autoplay=1&mute=1&rel=0&modestbranding=1"
                title="비행기 자유 티켓팅 방법"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>

      {/* 항공권 없음 전용 — 현지 크루즈 탑승 정보 */}
      {(flightType === 'none_domestic' || flightType === 'none_local') && (
        <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg space-y-3">
          <p className="text-sm font-bold text-amber-800">
            {flightType === 'none_domestic'
              ? '🚢 국내출발 크루즈 — 국내에서 직접 출발하여 현지 크루즈 터미널에서 탑승합니다'
              : '✈️ 항공미포함 현지 크루즈 탑승 — 고객이 항공을 개별 준비하고 현지 크루즈 터미널에서 탑승합니다'}
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">크루즈 탑승 항구</label>
            {(() => {
              const cruisePorts = TERMINALS.filter(t =>
                t.id.includes('cruise') || t.id.includes('terminal') || t.id.includes('port')
              );
              const currentEmbark = localFlightInfo.cruiseEmbarkPort || '';
              const matchedEmbark = cruisePorts.some(t => t.name_ko === currentEmbark || t.name === currentEmbark);
              return (
                <select
                  value={currentEmbark}
                  onChange={(e) => updateFlightInfo({ cruiseEmbarkPort: e.target.value })}
                  className="w-full border border-amber-300 rounded px-3 py-3 text-base h-14 focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="">항구 선택</option>
                  {!matchedEmbark && currentEmbark && (
                    <option value={currentEmbark} disabled>{currentEmbark}</option>
                  )}
                  {cruisePorts.map(t => (
                    <option key={t.id} value={t.name_ko}>{t.name_ko} ({t.city})</option>
                  ))}
                </select>
              );
            })()}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">크루즈 하선 항구</label>
            {(() => {
              const cruisePorts = TERMINALS.filter(t =>
                t.id.includes('cruise') || t.id.includes('terminal') || t.id.includes('port')
              );
              const currentDisembark = localFlightInfo.cruiseDisembarkPort || '';
              const matchedDisembark = cruisePorts.some(t => t.name_ko === currentDisembark || t.name === currentDisembark);
              return (
                <select
                  value={currentDisembark}
                  onChange={(e) => updateFlightInfo({ cruiseDisembarkPort: e.target.value })}
                  className="w-full border border-amber-300 rounded px-3 py-3 text-base h-14 focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="">항구 선택</option>
                  {!matchedDisembark && currentDisembark && (
                    <option value={currentDisembark} disabled>{currentDisembark}</option>
                  )}
                  {cruisePorts.map(t => (
                    <option key={t.id} value={t.name_ko}>{t.name_ko} ({t.city})</option>
                  ))}
                </select>
              );
            })()}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">고객 안내 문구</label>
            <textarea
              placeholder="예: 항공은 개별 준비. 홍콩 카이탁 크루즈 터미널 09:00 집합 예정"
              value={localFlightInfo.selfArrangeNote || ''}
              onChange={(e) => updateFlightInfo({ selfArrangeNote: e.target.value })}
              className="w-full border border-amber-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400"
              rows={3}
            />
          </div>
        </div>
      )}

      {/* 여행기간 */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          여행기간
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">출발일</label>
            <input
              type="date"
              value={localFlightInfo.travelPeriod.startDate}
              onChange={(e) => {
                updateFlightInfo({
                  travelPeriod: { ...localFlightInfo.travelPeriod, startDate: e.target.value },
                  departure: { ...localFlightInfo.departure, date: e.target.value },
                });
              }}
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">종료일</label>
            <input
              type="date"
              value={localFlightInfo.travelPeriod.endDate}
              onChange={(e) => {
                const newPeriod = {
                  ...localFlightInfo.travelPeriod,
                  endDate: e.target.value,
                };
                updateFlightInfo({ travelPeriod: newPeriod });
              }}
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          {localFlightInfo.travelPeriod.startDate && localFlightInfo.travelPeriod.endDate && (
            <span>
              {formatDateWithDay(localFlightInfo.travelPeriod.startDate)} ~{' '}
              {formatDateWithDay(localFlightInfo.travelPeriod.endDate)} /{' '}
              {localFlightInfo.travelPeriod.nights}박 {localFlightInfo.travelPeriod.days}일
            </span>
          )}
        </div>
      </div>

      {/* 출국 — 왕복/편도 출발만 표시 */}
      {showDeparture && <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-md font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">✈️</span>
            출국
          </h4>
          <div className="flex flex-wrap gap-2">
            {localFlightInfo.departure.flightNumber?.includes('항공없음') && (
              <button
                type="button"
                onClick={() => {
                  const updated = {
                    ...localFlightInfo,
                    departure: {
                      ...localFlightInfo.departure,
                      from: '',
                      to: '',
                      flightNumber: '',
                      duration: '',
                    },
                  };
                  setLocalFlightInfo(updated);
                  onChange(updated);
                }}
                className="px-4 py-3 h-12 min-h-[48px] bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all shadow-sm text-sm font-semibold"
              >
                항공 입력하기
              </button>
            )}
            <button
              type="button"
              onClick={setNoFlightDeparture}
              className="px-4 py-3 h-12 min-h-[48px] bg-gradient-to-r from-teal-400 to-cyan-500 text-white rounded-lg hover:from-teal-500 hover:to-cyan-600 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm font-semibold"
            >
              <span>🚢</span>
              항공없음 국내출발
            </button>
          </div>
        </div>

        {/* 항공없음 선택 시 간단 메시지만 표시 */}
        {localFlightInfo.departure.flightNumber?.includes('항공없음') ? (
          <div className="bg-cyan-50 border-2 border-cyan-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-2">🚢</div>
            <p className="text-lg font-semibold text-cyan-700">항공 미포함 - 국내출발</p>
            <p className="text-sm text-cyan-600 mt-1">크루즈 국내항 출발 (항공 미포함)</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">출발지</label>
            <input
              type="text"
              value={localFlightInfo.departure.from}
              onChange={(e) =>
                updateFlightInfo({
                  departure: { ...localFlightInfo.departure, from: e.target.value },
                })
              }
              placeholder="예: 인천"
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">도착지</label>
            <input
              type="text"
              value={localFlightInfo.departure.to}
              onChange={(e) =>
                updateFlightInfo({
                  departure: { ...localFlightInfo.departure, to: e.target.value },
                })
              }
              placeholder="예: 시애틀"
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">출발일</label>
            <input
              type="date"
              value={localFlightInfo.departure.date}
              onChange={(e) =>
                updateFlightInfo({
                  departure: { ...localFlightInfo.departure, date: e.target.value },
                })
              }
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">출발시간</label>
            <input
              type="time"
              value={localFlightInfo.departure.time}
              onChange={(e) => {
                const updated = {
                  ...localFlightInfo.departure,
                  time: e.target.value,
                };
                // 도착시간이 있으면 소요시간 자동 계산
                if (localFlightInfo.departure.arrivalTime) {
                  // 출발 시간이 오후이고 도착 시간이 오전이면 하루 추가
                  const depHours = parseInt(e.target.value.split(':')[0]);
                  const arrHours = parseInt(localFlightInfo.departure.arrivalTime.split(':')[0]);
                  const arrivalDate = (depHours >= 12 && arrHours < 12)
                    ? new Date(new Date(localFlightInfo.departure.date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : localFlightInfo.departure.date;

                  updated.duration = calculateDuration(
                    e.target.value,
                    localFlightInfo.departure.arrivalTime,
                    localFlightInfo.departure.date,
                    localFlightInfo.departure.from,
                    localFlightInfo.departure.to,
                    arrivalDate
                  );
                }
                updateFlightInfo({ departure: updated });
              }}
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">도착시간</label>
            <input
              type="time"
              value={localFlightInfo.departure.arrivalTime || ''}
              onChange={(e) => {
                const updated = {
                  ...localFlightInfo.departure,
                  arrivalTime: e.target.value,
                };
                // 출발시간이 있으면 소요시간 자동 계산
                if (localFlightInfo.departure.time) {
                  // 출발 시간이 오후이고 도착 시간이 오전이면 하루 추가
                  const depHours = parseInt(localFlightInfo.departure.time.split(':')[0]);
                  const arrHours = parseInt(e.target.value.split(':')[0]);
                  const arrivalDate = (depHours >= 12 && arrHours < 12)
                    ? new Date(new Date(localFlightInfo.departure.date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : localFlightInfo.departure.date;

                  updated.duration = calculateDuration(
                    localFlightInfo.departure.time,
                    e.target.value,
                    localFlightInfo.departure.date,
                    localFlightInfo.departure.from,
                    localFlightInfo.departure.to,
                    arrivalDate
                  );
                }
                updateFlightInfo({ departure: updated });
              }}
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">항공편명</label>
            <input
              type="text"
              value={localFlightInfo.departure.flightNumber}
              onChange={(e) =>
                updateFlightInfo({
                  departure: { ...localFlightInfo.departure, flightNumber: e.target.value },
                })
              }
              placeholder="예: KE041 (입력 시 항공사 자동 감지)"
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">소요시간</label>
            <input
              type="text"
              value={localFlightInfo.departure.duration}
              onChange={(e) =>
                updateFlightInfo({
                  departure: { ...localFlightInfo.departure, duration: e.target.value },
                })
              }
              placeholder="출발시간과 도착시간 입력 시 자동 계산"
              readOnly={!!(localFlightInfo.departure.time && localFlightInfo.departure.arrivalTime)}
              className={`w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                localFlightInfo.departure.time && localFlightInfo.departure.arrivalTime
                  ? 'bg-gray-50 cursor-not-allowed'
                  : ''
              }`}
            />
            {localFlightInfo.departure.time && localFlightInfo.departure.arrivalTime && (
              <p className="text-xs text-green-600 mt-1">✓ 자동 계산됨</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">항공편 종류</label>
            <select
              value={localFlightInfo.departure.type}
              onChange={(e) =>
                updateFlightInfo({
                  departure: {
                    ...localFlightInfo.departure,
                    type: e.target.value as '직항' | '경유',
                  },
                })
              }
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="직항">직항</option>
              <option value="경유">경유</option>
            </select>
          </div>
          {/* 항공사 자동완성 — 항공편명 입력 시 자동 감지 */}
          <div className="col-span-1 sm:col-span-2">
            <AirlineSelector
              airline={localFlightInfo.departure.airline}
              airlineName={localFlightInfo.departure.airlineName}
              seatClass={localFlightInfo.departure.seatClass}
              flightNumber={localFlightInfo.departure.flightNumber}
              onChange={(sel: AirlineSelection) =>
                updateFlightInfo({
                  departure: { ...localFlightInfo.departure, ...sel },
                })
              }
            />
          </div>
        </div>
        )}
      </div>}

      {/* 귀국 — 왕복/편도 귀국만 표시 */}
      {showReturn && <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-md font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-lg">✈️</span>
              귀국
            </h4>
            {/* 귀국편도 동일 항공사 체크박스 — 왕복만 */}
            {flightType === 'roundtrip' && localFlightInfo.departure.airline && (
              <label className="flex items-center gap-1.5 text-xs text-blue-700 cursor-pointer select-none bg-blue-50 px-3 py-2 min-h-[44px] rounded-lg border border-blue-200 hover:bg-blue-100">
                <input
                  type="checkbox"
                  checked={
                    localFlightInfo.return.airline === localFlightInfo.departure.airline &&
                    localFlightInfo.return.seatClass === localFlightInfo.departure.seatClass
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateFlightInfo({
                        return: {
                          ...localFlightInfo.return,
                          airline: localFlightInfo.departure.airline,
                          airlineName: localFlightInfo.departure.airlineName,
                          seatClass: localFlightInfo.departure.seatClass,
                          baggageAllowance: localFlightInfo.departure.baggageAllowance,
                        },
                      });
                    } else {
                      updateFlightInfo({
                        return: {
                          ...localFlightInfo.return,
                          airline: '',
                          airlineName: '',
                          seatClass: undefined,
                          baggageAllowance: '',
                        },
                      });
                    }
                  }}
                  className="w-4 h-4 rounded"
                />
                <span>출국과 동일 항공사 ({localFlightInfo.departure.airlineName})</span>
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {localFlightInfo.return.flightNumber?.includes('항공없음') && (
              <button
                type="button"
                onClick={() => {
                  const updated = {
                    ...localFlightInfo,
                    return: {
                      ...localFlightInfo.return,
                      from: '',
                      to: '',
                      flightNumber: '',
                      duration: '',
                    },
                  };
                  setLocalFlightInfo(updated);
                  onChange(updated);
                }}
                className="px-4 py-3 h-12 min-h-[48px] bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all shadow-sm text-sm font-semibold"
              >
                항공 입력하기
              </button>
            )}
            <button
              type="button"
              onClick={setNoFlightReturn}
              className="px-4 py-3 h-12 min-h-[48px] bg-gradient-to-r from-indigo-400 to-purple-500 text-white rounded-lg hover:from-indigo-500 hover:to-purple-600 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm font-semibold"
            >
              <span>🚢</span>
              항공없음 국내도착
            </button>
          </div>
        </div>

        {/* 항공없음 선택 시 간단 메시지만 표시 */}
        {localFlightInfo.return.flightNumber?.includes('항공없음') ? (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-2">🚢</div>
            <p className="text-lg font-semibold text-purple-700">항공 미포함 - 국내도착</p>
            <p className="text-sm text-purple-600 mt-1">크루즈 국내항 도착 (항공 미포함)</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">출발지</label>
            <input
              type="text"
              value={localFlightInfo.return.from}
              onChange={(e) =>
                updateFlightInfo({
                  return: { ...localFlightInfo.return, from: e.target.value },
                })
              }
              placeholder="예: 시애틀"
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">도착지</label>
            <input
              type="text"
              value={localFlightInfo.return.to}
              onChange={(e) =>
                updateFlightInfo({
                  return: { ...localFlightInfo.return, to: e.target.value },
                })
              }
              placeholder="예: 인천"
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">출발일</label>
            <input
              type="date"
              value={localFlightInfo.return.date}
              onChange={(e) =>
                updateFlightInfo({
                  return: { ...localFlightInfo.return, date: e.target.value },
                })
              }
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">출발시간</label>
            <input
              type="time"
              value={localFlightInfo.return.time}
              onChange={(e) => {
                const updated = {
                  ...localFlightInfo.return,
                  time: e.target.value,
                };
                // 도착시간이 있으면 소요시간 자동 계산
                if (localFlightInfo.return.arrivalTime) {
                  // 출발 시간이 오후이고 도착 시간이 오전이면 하루 추가
                  const depHours = parseInt(e.target.value.split(':')[0]);
                  const arrHours = parseInt(localFlightInfo.return.arrivalTime.split(':')[0]);
                  const arrivalDate = (depHours >= 12 && arrHours < 12)
                    ? new Date(new Date(localFlightInfo.return.date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : localFlightInfo.return.date;

                  updated.duration = calculateDuration(
                    e.target.value,
                    localFlightInfo.return.arrivalTime,
                    localFlightInfo.return.date,
                    localFlightInfo.return.from,
                    localFlightInfo.return.to,
                    arrivalDate
                  );
                }
                updateFlightInfo({ return: updated });
              }}
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">도착시간</label>
            <input
              type="time"
              value={localFlightInfo.return.arrivalTime || ''}
              onChange={(e) => {
                const updated = {
                  ...localFlightInfo.return,
                  arrivalTime: e.target.value,
                };
                // 출발시간이 있으면 소요시간 자동 계산
                if (localFlightInfo.return.time) {
                  // 출발 시간이 오후이고 도착 시간이 오전이면 하루 추가
                  const depHours = parseInt(localFlightInfo.return.time.split(':')[0]);
                  const arrHours = parseInt(e.target.value.split(':')[0]);
                  const arrivalDate = (depHours >= 12 && arrHours < 12)
                    ? new Date(new Date(localFlightInfo.return.date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : localFlightInfo.return.date;

                  updated.duration = calculateDuration(
                    localFlightInfo.return.time,
                    e.target.value,
                    localFlightInfo.return.date,
                    localFlightInfo.return.from,
                    localFlightInfo.return.to,
                    arrivalDate
                  );
                }
                updateFlightInfo({ return: updated });
              }}
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">항공편명</label>
            <input
              type="text"
              value={localFlightInfo.return.flightNumber}
              onChange={(e) =>
                updateFlightInfo({
                  return: { ...localFlightInfo.return, flightNumber: e.target.value },
                })
              }
              placeholder="예: KE042 (입력 시 항공사 자동 감지)"
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">소요시간</label>
            <input
              type="text"
              value={localFlightInfo.return.duration}
              onChange={(e) =>
                updateFlightInfo({
                  return: { ...localFlightInfo.return, duration: e.target.value },
                })
              }
              placeholder="출발시간과 도착시간 입력 시 자동 계산"
              readOnly={!!(localFlightInfo.return.time && localFlightInfo.return.arrivalTime)}
              className={`w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                localFlightInfo.return.time && localFlightInfo.return.arrivalTime
                  ? 'bg-gray-50 cursor-not-allowed'
                  : ''
              }`}
            />
            {localFlightInfo.return.time && localFlightInfo.return.arrivalTime && (
              <p className="text-xs text-green-600 mt-1">✓ 자동 계산됨</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">항공편 종류</label>
            <select
              value={localFlightInfo.return.type}
              onChange={(e) =>
                updateFlightInfo({
                  return: {
                    ...localFlightInfo.return,
                    type: e.target.value as '직항' | '경유',
                  },
                })
              }
              className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="직항">직항</option>
              <option value="경유">경유</option>
            </select>
          </div>
          {/* 항공사 자동완성 */}
          <div className="col-span-1 sm:col-span-2">
            <AirlineSelector
              airline={localFlightInfo.return.airline}
              airlineName={localFlightInfo.return.airlineName}
              seatClass={localFlightInfo.return.seatClass}
              flightNumber={localFlightInfo.return.flightNumber}
              onChange={(sel: AirlineSelection) =>
                updateFlightInfo({
                  return: { ...localFlightInfo.return, ...sel },
                })
              }
            />
          </div>
        </div>
        )}
      </div>}

      {/* 비행기 구매 영상 */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <span className="text-lg">✈️</span>
          비행기 구매 영상
        </label>
        <input
          type="text"
          value={localFlightInfo.aircraftType || ''}
          onChange={(e) =>
            updateFlightInfo({ aircraftType: e.target.value })
          }
          placeholder="예: 보잉 777-300ER, 에어버스 A350-900 등"
          className="w-full px-3 py-3 text-base h-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-2">
          사용되는 비행기 기종을 입력하세요
        </p>
      </div>
    </div>
  );
}

