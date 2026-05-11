'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

interface Traveler {
  id?: number;
  korName: string;
  residentNum: string;
  phone: string;
  roomNumber: number;
  roomColor: string;
}

interface Reservation {
  id: number;
  totalPeople: number;
  cabinType: string | null; // 객실 타입 (발코니, 오션뷰 등)
  trip: {
    id: number;
    shipName: string | null;
    departureDate: Date | null;
    endDate?: Date | null;
    productCode?: string | null;
  } | null;
  user: {
    id: number;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  travelers: Array<{
    id: number;
    korName: string;
    residentNum: string | null;
    phone?: string | null;
    roomNumber?: number;
  }>;
}

// 방 색상 팔레트 (시각적으로 구분하기 쉬운 색상)
const ROOM_COLORS = [
  { name: '빨강', value: '#EF4444', bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-700' },
  { name: '파랑', value: '#3B82F6', bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
  { name: '초록', value: '#22C55E', bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' },
  { name: '노랑', value: '#EAB308', bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700' },
  { name: '보라', value: '#A855F7', bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700' },
  { name: '분홍', value: '#EC4899', bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-700' },
  { name: '하늘', value: '#06B6D4', bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-700' },
  { name: '주황', value: '#F97316', bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
];

export default function CustomerPnrPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = use(params);
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // 본인 확인 처리
  const handleVerifyPhone = async () => {
    if (!verifyPhone || verifyPhone.trim() === '') {
      setError('전화번호를 입력해주세요.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch(`/api/pnr/customer/${reservationId}?phone=${encodeURIComponent(verifyPhone)}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('예약 정보를 찾을 수 없거나 전화번호가 일치하지 않습니다.');
        } else {
          setError('본인 확인 중 오류가 발생했습니다.');
        }
        setIsVerifying(false);
        return;
      }

      const data = await response.json();

      if (data.ok && data.reservation) {
        setReservation(data.reservation);
        initializeTravelers(data.reservation);
        setCurrentStep(1);
        setLoading(false);
      } else {
        setError(data.error || '예약 정보를 불러올 수 없습니다.');
        setIsVerifying(false);
      }
    } catch (err: any) {
      console.error('[Verify Phone] Error:', err);
      setError('본인 확인 중 오류가 발생했습니다.');
      setIsVerifying(false);
    }
  };

  // 여행자 초기화
  const initializeTravelers = (reservationData: Reservation) => {
    const initialTravelers: Traveler[] = [];
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
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (!reservationId) return;

    const checkAuthAndLoad = async () => {
      try {
        setLoading(true);
        setError('');

        const authResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (authResponse.ok) {
          const authData = await authResponse.json();

          if (authData.ok && authData.user &&
            (authData.user.role === 'admin' || authData.user.role === 'partner')) {
            setIsAdminMode(true);

            const response = await fetch(`/api/pnr/customer/${reservationId}`, {
              credentials: 'include',
            });

            if (response.ok) {
              const data = await response.json();

              if (data.ok && data.reservation) {
                setReservation(data.reservation);
                initializeTravelers(data.reservation);
                setCurrentStep(1);
                setLoading(false);
              } else {
                setLoading(false);
              }
            } else {
              setLoading(false);
            }
          } else {
            setCurrentStep(0);
            setLoading(false);
          }
        } else {
          setCurrentStep(0);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[Init] Error:', err);
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [reservationId]);

  // 여행자 정보 업데이트
  const updateTraveler = (index: number, field: keyof Traveler, value: any) => {
    const updatedTravelers = [...travelers];
    updatedTravelers[index] = {
      ...updatedTravelers[index],
      [field]: value,
    };

    // 방 번호가 변경되면 색상도 업데이트
    if (field === 'roomNumber') {
      const roomNum = parseInt(value) || 1;
      updatedTravelers[index].roomColor = ROOM_COLORS[(roomNum - 1) % ROOM_COLORS.length].value;
    }

    setTravelers(updatedTravelers);
  };

  // 동행자 추가
  const addTraveler = () => {
    if (travelers.length >= 20) {
      alert('최대 20명까지 추가 가능합니다.');
      return;
    }

    const nextRoomNumber = Math.max(...travelers.map(t => t.roomNumber), 0) + 1;

    setTravelers([
      ...travelers,
      {
        korName: '',
        residentNum: '',
        phone: '',
        roomNumber: nextRoomNumber > 8 ? 1 : nextRoomNumber,
        roomColor: ROOM_COLORS[(nextRoomNumber - 1) % ROOM_COLORS.length].value,
      },
    ]);
  };

  // 동행자 제거
  const removeTraveler = (index: number) => {
    if (travelers.length <= 1) {
      alert('최소 1명의 여행자가 필요합니다.');
      return;
    }
    setTravelers(travelers.filter((_, i) => i !== index));
  };

  // PNR 정보 제출
  const handleSubmit = async () => {
    setError('');

    // 유효성 검사 - 모든 여행자에게 이름, 주민번호, 연락처 필수
    for (let i = 0; i < travelers.length; i++) {
      const traveler = travelers[i];
      const label = i === 0 ? '대표자' : `동행자 ${i}`;

      if (!traveler.korName || traveler.korName.trim() === '') {
        alert(`${label}의 이름을 입력해주세요.`);
        return;
      }
      if (!traveler.residentNum || traveler.residentNum.trim() === '') {
        alert(`${label}의 주민등록번호를 입력해주세요.`);
        return;
      }
      // 주민번호 형식 검사 (13자리 숫자 또는 6-7자리)
      const cleanResidentNum = traveler.residentNum.replace(/-/g, '');
      if (cleanResidentNum.length !== 13 && cleanResidentNum.length !== 6 && cleanResidentNum.length !== 7) {
        alert(`${label}의 주민등록번호 형식이 올바르지 않습니다. (예: 000000-0000000)`);
        return;
      }
      if (!traveler.phone || traveler.phone.trim() === '') {
        alert(`${label}의 연락처를 입력해주세요.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/pnr/customer/submit', {
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
      });

      const data = await response.json();

      if (data.ok) {
        setIsSuccess(true);
      } else {
        throw new Error(data.message || data.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('[PNR Submit] Error:', err);
      setError(`저장 실패: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 방 번호별로 그룹화
  const getRoomGroups = () => {
    const groups: { [key: number]: Traveler[] } = {};
    travelers.forEach((t, index) => {
      if (!groups[t.roomNumber]) {
        groups[t.roomNumber] = [];
      }
      groups[t.roomNumber].push({ ...t, id: index });
    });
    return groups;
  };

  // 객실 타입 + 번호로 그룹 이름 생성 (발코니1, 발코니2 등)
  const getRoomLabel = (roomNumber: number) => {
    const cabinType = reservation?.cabinType || '객실';
    return `${cabinType}${roomNumber}`;
  };

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
            <div className="mb-8 rounded-lg bg-blue-50 p-4 text-left">
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

  const roomGroups = getRoomGroups();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">PNR 정보 등록</h1>
          <p className="text-gray-600">동행자 정보와 객실 배정</p>
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
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
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
                  onKeyPress={(e) => {
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
