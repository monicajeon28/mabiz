'use client';

import { useState, useEffect, use, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithRetry } from '@/lib/fetch-utils';
import { logger } from '@/lib/logger';
import { ReservationStatusBadge } from './components/ReservationStatusBadge';
import { AlertBox } from '@/components/pnr/AlertBox';
import {
  ROOM_COLORS,
  getRoomColor,
  getRoomLabel as utilGetRoomLabel,
  formatTravelerNames,
  groupTravelersByRoom,
  getNextRoomNumber,
} from '@/lib/pnr-utils';
import { validateAllTravelers, validateTravelerCount } from '@/lib/pnr-validators';
import type { Traveler, Reservation, TravelerFormData } from '@/src/lib/types/pnr';

// 확장 타입: roomColor 추가 (로컬 상태용)
interface TravelerWithColor extends Traveler {
  roomColor: string;
}

export default function CustomerPnrPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = use(params);
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [travelers, setTravelers] = useState<TravelerWithColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // 여행자 초기화
  const initializeTravelers = useCallback(
    (reservationData: Reservation) => {
      const initialTravelers: TravelerWithColor[] = [];
      const totalPeople = reservationData.totalPeople || 1;

      if (reservationData.travelers && reservationData.travelers.length > 0) {
        reservationData.travelers.forEach((t: any, index: number) => {
          initialTravelers.push({
            id: t.id,
            korName: t.korName || '',
            residentNum: t.residentNum || '',
            phone: index === 0 ? (reservationData.user?.phone || '') : (t.phone || ''),
            roomNumber: t.roomNumber || 1,
            roomColor: ROOM_COLORS[(t.roomNumber || 1) - 1]?.value || ROOM_COLORS[0].value,
          });
        });
      } else {
        for (let i = 0; i < totalPeople; i++) {
          initialTravelers.push({
            korName: i === 0 ? (reservationData.user?.name || '') : '',
            residentNum: '',
            phone: i === 0 ? (reservationData.user?.phone || '') : '',
            roomNumber: 1,
            roomColor: ROOM_COLORS[0].value,
          });
        }
      }

      setTravelers(initialTravelers);
    },
    []
  );

  // 본인 확인 처리
  const handleVerifyPhone = useCallback(async () => {
    if (!verifyPhone || verifyPhone.trim() === '') {
      setError('전화번호를 입력해주세요.');
      return;
    }

    if (isVerifying) return; // 동시 제출 방지

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetchWithRetry(
        `/api/pnr/customer/${reservationId}?phone=${encodeURIComponent(verifyPhone)}`,
        { credentials: 'include' },
        { maxRetries: 3, timeoutMs: 10000 }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message ||
          (response.status === 404 ? '예약 정보를 찾을 수 없거나 전화번호가 일치하지 않습니다.' : '확인 실패');
        setError(message);
        setIsVerifying(false);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        logger.error('[PNR Verify Phone] JSON Parse Error:', parseErr);
        setError('응답 데이터 처리 중 오류가 발생했습니다.');
        setIsVerifying(false);
        return;
      }

      if (data.ok && data.reservation) {
        setReservation(data.reservation);
        initializeTravelers(data.reservation);
        setCurrentStep(1);
        setLoading(false);
      } else {
        setError(data.message || data.error || '예약 정보를 불러올 수 없습니다.');
      }
    } catch (err: unknown) {
      logger.error('[PNR Verify Phone] Error:', err);
      const message = err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.';
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  }, [verifyPhone, isVerifying, reservationId, initializeTravelers]);


  // 초기 데이터 로드
  useEffect(() => {
    if (!reservationId) return;

    const checkAuthAndLoad = async () => {
      try {
        setLoading(true);
        setError('');

        // Step 1: Auth check
        let authData;
        try {
          const authResponse = await fetchWithRetry(
            '/api/auth/me',
            { credentials: 'include' },
            { maxRetries: 3, timeoutMs: 10000 }
          );

          if (!authResponse.ok) {
            setCurrentStep(0);
            setLoading(false);
            return;
          }

          authData = await authResponse.json();
        } catch (authErr) {
          logger.error('[PNR Auth Check] Error:', authErr);
          setError('인증 중 오류가 발생했습니다.');
          setCurrentStep(0);
          setLoading(false);
          return;
        }

        // Step 2: Check role
        if (!authData.ok || !authData.user) {
          setCurrentStep(0);
          setLoading(false);
          return;
        }

        const isAdmin = authData.user.role === 'admin' || authData.user.role === 'partner';
        if (!isAdmin) {
          setCurrentStep(0);
          setLoading(false);
          return;
        }

        // Step 3: Load reservation (admin only)
        setIsAdminMode(true);

        try {
          const response = await fetchWithRetry(
            `/api/pnr/customer/${reservationId}`,
            { credentials: 'include' },
            { maxRetries: 3, timeoutMs: 10000 }
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || '예약 정보를 불러올 수 없습니다.');
          }

          const data = await response.json();
          if (data.ok && data.reservation) {
            setReservation(data.reservation);
            initializeTravelers(data.reservation);
            setCurrentStep(1);
          } else {
            setError(data.message || '예약 정보를 불러올 수 없습니다.');
          }
        } catch (loadErr) {
          logger.error('[PNR Load Reservation] Error:', loadErr);
          const message = loadErr instanceof Error ? loadErr.message : '예약 정보를 불러오는 중 오류가 발생했습니다.';
          setError(message);
          setCurrentStep(0);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [reservationId]);

  // 여행자 정보 업데이트
  const updateTraveler = useCallback(
    (index: number, field: keyof Traveler, value: any) => {
      const updatedTravelers = [...travelers];
      updatedTravelers[index] = {
        ...updatedTravelers[index],
        [field]: value,
      } as TravelerWithColor;

      // 방 번호가 변경되면 색상도 업데이트
      if (field === 'roomNumber') {
        const roomNum = parseInt(value) || 1;
        updatedTravelers[index].roomColor = getRoomColor(roomNum).value;
      }

      setTravelers(updatedTravelers);
    },
    [travelers]
  );

  // 동행자 추가
  const addTraveler = useCallback(() => {
    // 인원 수 검증
    const countError = validateTravelerCount([...travelers, { korName: '', residentNum: '', phone: '', roomNumber: 1 }]);
    if (countError) {
      alert(countError.message);
      return;
    }

    const roomNumbers = travelers.map((t) => t.roomNumber);
    const nextRoomNumber = getNextRoomNumber(roomNumbers);

    setTravelers([
      ...travelers,
      {
        korName: '',
        residentNum: '',
        phone: '',
        roomNumber: nextRoomNumber,
        roomColor: getRoomColor(nextRoomNumber).value,
      },
    ]);
  }, [travelers]);

  // 동행자 제거
  const removeTraveler = useCallback(
    (index: number) => {
      if (travelers.length <= 1) {
        alert('최소 1명의 여행자가 필요합니다.');
        return;
      }
      setTravelers(travelers.filter((_, i) => i !== index));
    },
    [travelers]
  );

  // PNR 정보 제출
  const handleSubmit = useCallback(async () => {
    setError('');

    // 유효성 검사 - validateAllTravelers 사용
    const validationError = validateAllTravelers(travelers);
    if (validationError) {
      alert(validationError.message);
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetchWithRetry(
        '/api/pnr/customer/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            reservationId: parseInt(reservationId),
            travelers: travelers.map((t) => ({
              id: t.id,
              korName: t.korName,
              residentNum: t.residentNum || null,
              phone: t.phone || null,
              roomNumber: t.roomNumber,
            })),
          }),
        },
        { maxRetries: 3, timeoutMs: 15000 }
      );

      const data = await response.json();

      if (data.ok) {
        setIsSuccess(true);
      } else {
        throw new Error(data.message || data.error || '저장에 실패했습니다.');
      }
    } catch (err: unknown) {
      logger.error('[PNR Submit] Error:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : '저장 중 오류가 발생했습니다.';
      setError(`저장 실패: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [travelers, reservationId]);

  // 방 번호별로 그룹화 (메모이제이션)
  const roomGroups = useMemo(() => {
    return groupTravelersByRoom(travelers);
  }, [travelers]);

  // 객실 라벨 생성 함수 (메모이제이션)
  const getRoomLabel = useCallback(
    (roomNumber: number) => {
      const cabinType = reservation?.cabinType || '객실';
      return utilGetRoomLabel(roomNumber, cabinType);
    },
    [reservation?.cabinType]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">예약 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!reservation && currentStep > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">예약 정보를 찾을 수 없습니다.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg bg-white p-8 text-center shadow-lg">
            <div className="mb-4 text-6xl">✅</div>
            <h1 className="mb-4 text-2xl font-bold text-gray-900">PNR 정보 등록 완료</h1>
            <p className="mb-4 text-gray-600">
              동행자 및 방 배정 정보가 성공적으로 저장되었습니다.
            </p>
            <div className="mb-4 rounded-lg bg-green-50 p-4 text-left border border-green-200">
              <p className="text-sm text-green-800">
                <strong>✓ 자동 처리 완료:</strong> PNR 정보가 APIS 시스템에 자동으로 등록되었습니다.
              </p>
            </div>
            <div className="mb-8 rounded-lg bg-blue-50 p-4 text-left border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>다음 단계:</strong> 여권 정보 등록이 필요합니다.<br />
                담당자가 별도로 여권 등록 링크를 발송해드립니다.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => router.push(`/passport/${reservationId}`)}
                className="w-full rounded-lg bg-green-600 px-8 py-3 text-white hover:bg-green-700 font-semibold"
              >
                여권 정보 등록하러 가기
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full rounded-lg bg-gray-100 px-8 py-3 text-gray-700 hover:bg-gray-200"
              >
                홈으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">PNR 정보 등록</h1>
          <p className="text-gray-600">동행자 정보와 객실 배정</p>

          {/* 결제상태 배지 */}
          {reservation && reservation.paymentStatus && reservation.paymentStatus !== 'unknown' && (
            <div className="mt-4 flex justify-center">
              <ReservationStatusBadge
                status={reservation.paymentStatus}
                note={reservation.paymentStatusNote}
                lastPaymentAt={reservation.lastPaymentAt}
                lastRefundedAt={reservation.lastRefundedAt}
              />
            </div>
          )}

          {reservation?.trip && (
            <p className="mt-2 text-sm text-gray-500">
              {reservation.trip.shipName || '크루즈'} | 출발일:{' '}
              {reservation.trip.departureDate
                ? new Date(reservation.trip.departureDate).toLocaleDateString('ko-KR')
                : '미정'}
            </p>
          )}
        </div>

        {error && (
          <AlertBox
            type="error"
            message={error}
            onDismiss={() => setError('')}
          />
        )}

        {/* Step 0: 본인 확인 */}
        {currentStep === 0 && !isAdminMode && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-bold text-gray-900">본인 확인</h2>
            <p className="mb-6 text-sm text-gray-600">
              예약하신 분의 전화번호를 입력해주세요.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  예약자 전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={verifyPhone}
                  onChange={(e) => setVerifyPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleVerifyPhone();
                    }
                  }}
                  placeholder="010-1234-5678"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleVerifyPhone}
                  disabled={isVerifying || !verifyPhone}
                  className="rounded-lg bg-blue-600 px-8 py-3 text-white font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {isVerifying ? '확인 중...' : '본인 확인'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: 동행자 및 방 배정 */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* 안내 */}
            <div className="rounded-lg bg-blue-50 p-4 border-2 border-blue-200">
              <h3 className="mb-2 font-semibold text-blue-900">PNR 등록 안내</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>- <strong>이름, 주민등록번호, 연락처</strong>는 모든 여행자 필수 입력입니다</li>
                <li>- <strong>영문이름</strong>은 여권 등록 시 자동으로 입력됩니다 (별도 입력 불필요)</li>
                <li>- 같은 객실을 사용할 분들은 <strong>같은 방 번호</strong>를 선택해주세요</li>
                <li>- 방 번호별로 <strong>색상이 다르게</strong> 표시됩니다</li>
              </ul>
            </div>

            {/* 방 배정 현황 미리보기 */}
            <div className="rounded-lg bg-white p-4 shadow-md">
              <h3 className="mb-3 font-semibold text-gray-900">방 배정 현황</h3>
              <p className="mb-3 text-sm text-gray-600">
                같은 색깔 = 같은 방을 사용하는 분들입니다. 방을 함께 쓸 분들끼리 같은 번호를 선택해주세요.
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(roomGroups).map(([roomNum, members]) => {
                  const colorIndex = (parseInt(roomNum) - 1) % ROOM_COLORS.length;
                  const color = ROOM_COLORS[colorIndex];
                  return (
                    <div
                      key={roomNum}
                      className={`rounded-lg px-3 py-2 ${color.bg} ${color.border} border-2`}
                    >
                      <span className={`font-semibold ${color.text}`}>
                        {getRoomLabel(parseInt(roomNum))}: {members.length}명
                      </span>
                      <div className="text-xs text-gray-600">
                        {members.map((m: any) => m.korName || '미입력').join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 여행자 목록 */}
            <div className="space-y-4">
              {travelers.map((traveler, index) => {
                const colorIndex = (traveler.roomNumber - 1) % ROOM_COLORS.length;
                const color = ROOM_COLORS[colorIndex];

                return (
                  <div
                    key={index}
                    className={`rounded-lg bg-white p-6 shadow-md border-l-4`}
                    style={{ borderLeftColor: traveler.roomColor }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${color.bg} ${color.text}`}
                        >
                          {getRoomLabel(traveler.roomNumber)}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {index === 0 ? '대표자' : `동행자 ${index}`}
                        </h3>
                      </div>
                      {index > 0 && (
                        <button
                          onClick={() => removeTraveler(index)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          이름 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={traveler.korName}
                          onChange={(e) => updateTraveler(index, 'korName', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          placeholder="홍길동"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          주민등록번호 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={traveler.residentNum}
                          onChange={(e) => {
                            // 숫자와 하이픈만 허용, 자동 하이픈 추가
                            let value = e.target.value.replace(/[^0-9-]/g, '');
                            // 6자리 입력 후 하이픈 자동 추가
                            if (value.length === 6 && !value.includes('-')) {
                              value = value + '-';
                            }
                            // 최대 14자리 (000000-0000000)
                            if (value.length <= 14) {
                              updateTraveler(index, 'residentNum', value);
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          placeholder="000000-0000000"
                          maxLength={14}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          영문이름은 여권 등록 시 자동으로 입력됩니다
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          연락처 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={traveler.phone}
                          onChange={(e) => updateTraveler(index, 'phone', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          placeholder="010-1234-5678"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          객실 그룹 <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={traveler.roomNumber}
                          onChange={(e) => updateTraveler(index, 'roomNumber', parseInt(e.target.value))}
                          className={`w-full rounded-lg border-2 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 ${color.border} ${color.bg}`}
                        >
                          {ROOM_COLORS.map((c, i) => (
                            <option key={i + 1} value={i + 1}>
                              {getRoomLabel(i + 1)} ({c.name})
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          같은 방을 쓸 분들은 같은 그룹을 선택하세요
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 동행자 추가 버튼 */}
              <button
                type="button"
                onClick={addTraveler}
                className="w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-6 py-4 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                + 동행자 추가하기
              </button>
            </div>

            {/* 제출 버튼 */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded-lg bg-green-600 px-12 py-4 text-lg text-white font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? '저장 중...' : 'PNR 정보 저장하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
