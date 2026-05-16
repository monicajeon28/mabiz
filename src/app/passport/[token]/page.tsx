'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithRetry, saveTravelersDraft, loadTravelersDraft, clearTravelersDraft } from '@/lib/fetch-utils';

interface Traveler {
  id?: number;
  korName: string;
  engSurname: string;
  engGivenName: string;
  passportNo: string;
  residentNum: string;
  nationality: string;
  dateOfBirth: string; // YYYY-MM-DD
  passportExpiryDate: string; // YYYY-MM-DD
  phone: string;
  isSubmitLater: boolean; // 추후 제출 체크박스
  isScanning: boolean; // OCR 스캔 중
  roomNumber?: number;
  showAdditionalFields?: boolean; // Step 4 추가 정보 펼치기
  scanError?: string; // 스캔 오류 메시지
  showManualInput?: boolean; // 수동 입력 선택지 표시
}

interface Reservation {
  id: number;
  totalPeople: number;
  passportStatus: string | null;
  trip: {
    id: number;
    cruiseName: string | null;
    departureDate: Date | null;
    endDate?: Date | null;
    shipName: string | null;
    productCode?: string | null;
    reservationCode: string | null;
    status: string | null;
    product?: {
      id: number;
      productCode: string;
      cruiseLine: string;
      shipName: string;
      packageName: string;
      nights: number;
      days: number;
      basePrice: number | null;
      description: string | null;
    } | null;
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
    engSurname: string | null;
    engGivenName: string | null;
    passportNo: string | null;
    dateOfBirth?: string | null;
    birthDate?: string | null;
    passportExpiryDate?: string | null;
    expiryDate?: string | null;
  }>;
}

export default function CustomerPassportPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelpMode, setIsHelpMode] = useState(false);
  const [helpName, setHelpName] = useState('');
  const [helpPhone, setHelpPhone] = useState('');
  const [submittingHelp, setSubmittingHelp] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0); // 단계별 입력: 0(본인확인)-5
  const [verifiedPhone, setVerifiedPhone] = useState(''); // 본인 확인된 전화번호
  const [verifyPhone, setVerifyPhone] = useState(''); // 입력 중인 전화번호
  const [isVerifying, setIsVerifying] = useState(false);

  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // localStorage 자동 저장 (30초마다)
  useEffect(() => {
    if (!token || !travelers.length) return;

    const interval = setInterval(() => {
      saveTravelersDraft(token, travelers);
    }, 30000); // 30초

    return () => clearInterval(interval);
  }, [token, travelers]);

  // 여행자 배열 초기화 헬퍼
  const initializeTravelers = (data: any): Traveler[] => {
    const initialTravelers: Traveler[] = [];
    const totalPeople = data.reservation.totalPeople || 1;

    if (data.reservation.travelers && data.reservation.travelers.length > 0) {
      data.reservation.travelers.forEach((t: any, index: number) => {
        initialTravelers.push({
          id: t.id,
          korName: t.korName || '',
          engSurname: t.engSurname || '',
          engGivenName: t.engGivenName || '',
          passportNo: t.passportNo || '',
          residentNum: '',
          nationality: t.nationality || '',
          dateOfBirth: t.birthDate || t.dateOfBirth || '',
          passportExpiryDate: t.expiryDate || t.passportExpiryDate || '',
          phone: index === 0 ? (data.reservation.user?.phone || '') : '',
          isSubmitLater: false,
          isScanning: false,
          roomNumber: t.roomNumber,
          showAdditionalFields: false,
        });
      });
    } else {
      for (let i = 0; i < totalPeople; i++) {
        initialTravelers.push({
          korName: i === 0 ? (data.reservation.user?.name || '') : '',
          engSurname: '',
          engGivenName: '',
          passportNo: '',
          residentNum: '',
          nationality: '',
          dateOfBirth: '',
          passportExpiryDate: '',
          phone: i === 0 ? (data.reservation.user?.phone || '') : '',
          isSubmitLater: false,
          isScanning: false,
          showAdditionalFields: false,
        });
      }
    }

    return initialTravelers;
  };

  // 본인 확인 처리
  const handleVerifyPhone = async () => {
    if (!verifyPhone || verifyPhone.trim() === '') {
      setError('전화번호를 입력해주세요.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch(
        `/api/passport/public/scan?token=${encodeURIComponent(token)}&phone=${encodeURIComponent(verifyPhone)}`
      );

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
        setVerifiedPhone(verifyPhone);
        setReservation(data.reservation);

        const initialTravelers = initializeTravelers(data);
        setTravelers(initialTravelers);

        if (initialTravelers.length >= 10) {
          setIsHelpMode(true);
        }

        setCurrentStep(1); // 본인 확인 완료 후 1단계로
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

  // 초기 데이터 로드 (토큰 기반 공개 페이지)
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        // 토큰 기반 공개 페이지 — 인증 불필요, Step 0 (본인 확인)으로 시작
        setCurrentStep(0);
        setLoading(false);
      } catch (err: any) {
        console.error('[Init] Error:', err);
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  // 여권 스캔 핸들러
  const handlePassportScan = async (travelerIndex: number) => {
    const fileInput = fileInputRefs.current[travelerIndex];
    if (!fileInput) return;

    fileInput.click();
  };

  // 이미지 압축 함수 (큰 파일도 자동 압축 - 5MB 이상도 처리 가능)
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');

          // 파일 크기에 따라 압축률 조절
          let MAX_SIZE = 1600;
          let quality = 0.8;

          if (file.size > 10 * 1024 * 1024) {
            MAX_SIZE = 1200;
            quality = 0.6;
          } else if (file.size > 5 * 1024 * 1024) {
            MAX_SIZE = 1400;
            quality = 0.7;
          }

          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx!.imageSmoothingEnabled = true;
          ctx!.imageSmoothingQuality = 'high';
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                console.log(`[Image Compress] 원본: ${(file.size / 1024 / 1024).toFixed(2)}MB -> 압축: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(compressedFile);
              } else {
                reject(new Error('이미지 압축 실패'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsDataURL(file);
    });
  };

  // 파일 선택 후 OCR 실행
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, travelerIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('JPEG, PNG, WebP 형식의 이미지만 업로드 가능합니다.');
      return;
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert('파일 크기는 20MB를 초과할 수 없습니다. 더 작은 파일을 선택해주세요.');
      return;
    }

    const updatedTravelers = [...travelers];
    updatedTravelers[travelerIndex].isScanning = true;
    setTravelers(updatedTravelers);

    try {
      const compressedFile = await compressImage(file);

      const formData = new FormData();
      formData.append('file', compressedFile);

      const response = await fetchWithRetry(
        `/api/passport/public/scan?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          body: formData,
        },
        { maxRetries: 2, timeoutMs: 30000 } // 스캔은 오래 걸릴 수 있으니 30초
      );

      const data = await response.json();

      if (data.ok && data.data) {
        const passportData = data.data;

        updatedTravelers[travelerIndex] = {
          ...updatedTravelers[travelerIndex],
          korName: passportData.korName || updatedTravelers[travelerIndex].korName,
          engSurname: passportData.engSurname || updatedTravelers[travelerIndex].engSurname,
          engGivenName: passportData.engGivenName || updatedTravelers[travelerIndex].engGivenName,
          passportNo: passportData.passportNo || updatedTravelers[travelerIndex].passportNo,
          dateOfBirth: passportData.dateOfBirth || passportData.birthDate || updatedTravelers[travelerIndex].dateOfBirth,
          passportExpiryDate: passportData.passportExpiryDate || passportData.expiryDate || updatedTravelers[travelerIndex].passportExpiryDate,
          nationality: passportData.nationality || updatedTravelers[travelerIndex].nationality,
          isScanning: false,
        };

        setTravelers(updatedTravelers);

        // 여권 이미지를 구글 드라이브에 백업 (비동기)
        const travelerId = updatedTravelers[travelerIndex].id;
        const uploadParams = new URLSearchParams({ token });
        if (reservation?.id) uploadParams.set('reservationId', String(reservation.id));
        if (travelerId) uploadParams.set('travelerId', String(travelerId));

        fetchWithRetry(
          `/api/passport/customer/upload?${uploadParams.toString()}`,
          {
            method: 'POST',
            body: (() => {
              const uploadFormData = new FormData();
              uploadFormData.append('file', compressedFile);
              return uploadFormData;
            })(),
          },
          { maxRetries: 2, timeoutMs: 15000 }
        ).then((uploadResponse) => {
          if (uploadResponse.ok) {
            console.log('[Passport] 구글 드라이브 백업 완료');
          } else {
            console.error('[Passport] 구글 드라이브 백업 실패');
          }
        }).catch((uploadError) => {
          console.error('[Passport] 구글 드라이브 업로드 에러:', uploadError);
        });
      } else {
        throw new Error(data.error || '여권 정보를 읽을 수 없습니다.');
      }
    } catch (err: any) {
      // 오류 발생 시 수동 입력 옵션 제공
      updatedTravelers[travelerIndex].isScanning = false;
      updatedTravelers[travelerIndex].scanError = err.message || '여권 스캔 중 오류가 발생했습니다.';
      updatedTravelers[travelerIndex].showManualInput = true;
      setTravelers(updatedTravelers);
    } finally {
      if (fileInputRefs.current[travelerIndex]) {
        fileInputRefs.current[travelerIndex]!.value = '';
      }
    }
  };

  // 여행자 정보 업데이트
  const updateTraveler = (index: number, field: keyof Traveler, value: any) => {
    const updatedTravelers = [...travelers];
    updatedTravelers[index] = {
      ...updatedTravelers[index],
      [field]: value,
    };
    setTravelers(updatedTravelers);
  };

  // 동행자 추가
  const addTraveler = () => {
    if (travelers.length >= 10) {
      setIsHelpMode(true);
      return;
    }

    setTravelers([
      ...travelers,
      {
        korName: '',
        engSurname: '',
        engGivenName: '',
        passportNo: '',
        residentNum: '',
        nationality: '',
        dateOfBirth: '',
        passportExpiryDate: '',
        phone: '',
        isSubmitLater: false,
        isScanning: false,
        showAdditionalFields: false,
      },
    ]);
  };

  // 동행자 제거
  const removeTraveler = (index: number) => {
    if (travelers.length <= 1) {
      alert('최소 1명의 여행자가 필요합니다.');
      return;
    }

    const updatedTravelers = travelers.filter((_, i) => i !== index);
    setTravelers(updatedTravelers);

    if (updatedTravelers.length < 10) {
      setIsHelpMode(false);
    }
  };

  // 여권 정보 제출
  const handleSubmit = async () => {
    setError('');

    for (let i = 0; i < travelers.length; i++) {
      const traveler = travelers[i];

      if (!traveler.isSubmitLater) {
        if (!traveler.korName) {
          alert(`${i + 1}번째 여행자의 이름을 입력해주세요.`);
          return;
        }
        if (!traveler.passportNo) {
          alert(`${i + 1}번째 여행자의 여권번호를 입력해주세요.`);
          return;
        }
      } else {
        if (!traveler.korName) {
          alert(`${i + 1}번째 여행자의 이름을 입력해주세요.`);
          return;
        }
      }

      if (i === 0 && !traveler.phone) {
        alert('대표자 연락처는 필수 입력 항목입니다.');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const response = await fetchWithRetry(
        '/api/passport/public/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            reservationId: reservation?.id,
            travelers: travelers.map((t, index) => ({
              id: t.id,
              korName: t.korName,
              engSurname: t.engSurname || null,
              engGivenName: t.engGivenName || null,
              passportNo: t.passportNo || null,
              residentNum: t.residentNum || null,
              nationality: t.nationality || null,
              dateOfBirth: t.dateOfBirth || null,
              passportExpiryDate: t.passportExpiryDate || null,
              phone: t.phone || null,
              isSubmitLater: t.isSubmitLater,
              roomNumber: t.roomNumber || index + 1,
            })),
          }),
        },
        { maxRetries: 3, timeoutMs: 15000 } // 제출은 중요하니까 3회 재시도
      );

      const data = await response.json();

      console.log('[Customer Passport] Submit Response:', data);

      if (data.ok) {
        clearTravelersDraft(token); // 제출 성공 시 localStorage 삭제
        setIsSuccess(true);
      } else {
        const errorMsg = data.message || data.error || '저장에 실패했습니다.';
        console.error('[Customer Passport] Submit Failed:', {
          status: response.status,
          data,
          errorMsg
        });
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error('[Customer Passport] Submit Error:', err);
      const errorMessage = err.message || '여권 정보 저장 중 오류가 발생했습니다.';
      setError(errorMessage);
      alert(`저장 실패: ${errorMessage}\n\n문제가 계속되면 관리자에게 문의하세요.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 도움 요청 제출
  const handleHelpRequest = async () => {
    if (!helpName || !helpPhone) {
      alert('신청자 이름과 연락처를 입력해주세요.');
      return;
    }

    try {
      setSubmittingHelp(true);

      const response = await fetchWithRetry(
        '/api/passport/customer/request',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            userId: reservation?.user.id,
            reservationId: reservation?.id,
            requesterName: helpName,
            requesterPhone: helpPhone,
          }),
        },
        { maxRetries: 2, timeoutMs: 10000 }
      );

      const data = await response.json();

      if (data.ok) {
        alert('도움 요청이 접수되었습니다. 담당자가 곧 연락드리겠습니다.');
        router.push('/');
      } else {
        throw new Error(data.message || '도움 요청에 실패했습니다.');
      }
    } catch (err: any) {
      alert(err.message || '도움 요청 중 오류가 발생했습니다.');
    } finally {
      setSubmittingHelp(false);
    }
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

  // Step 0 (본인 확인)이 아닐 때만 reservation 체크
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
    // 제출 후 PNR 페이지로 자동 리다이렉트
    useEffect(() => {
      const timer = setTimeout(() => {
        if (reservation?.id) {
          router.push(`/pnr/${reservation.id}`);
        } else {
          router.push('/');
        }
      }, 2500);
      return () => clearTimeout(timer);
    }, [reservation?.id, router]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg bg-white p-8 text-center shadow-lg">
            <h1 className="mb-4 text-2xl font-bold text-gray-900">여권 정보 등록 완료</h1>
            <p className="mb-8 text-gray-600">
              입력하신 여권 정보가 성공적으로 저장되었습니다.<br />
              <span className="text-sm text-gray-500">다음 단계(PNR 입력)로 진행 중입니다...</span>
            </p>
            <div className="space-y-3">
              <div className="text-center text-gray-500 text-sm">
                <div className="mb-4">곧 다음 페이지로 이동합니다 (2초 후)</div>
                <div className="flex justify-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce"></div>
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (reservation?.id) {
                    router.push(`/pnr/${reservation.id}`);
                  } else {
                    router.push('/');
                  }
                }}
                className="w-full rounded-lg bg-blue-600 px-8 py-3 text-white hover:bg-blue-700 font-semibold"
              >
                지금 진행하기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 단계별 진행률 계산
  const getStepProgress = () => {
    const totalSteps = 6;
    return (currentStep / totalSteps) * 100;
  };

  // 다음 단계로 이동
  const goToNextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 이전 단계로 이동
  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">여권 정보 등록</h1>
          {reservation?.trip && (
            <p className="text-gray-600">
              {reservation.trip.shipName || '크루즈'} / 출발일:{' '}
              {reservation.trip.departureDate
                ? new Date(reservation.trip.departureDate).toLocaleDateString('ko-KR')
                : '미정'}
            </p>
          )}
        </div>

        {/* 단계별 진행 표시 */}
        {currentStep > 0 && (
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
              <span>진행률</span>
              <span>{currentStep}/5 단계</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${getStepProgress()}%` }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`flex flex-col items-center ${step <= currentStep ? 'text-blue-600' : 'text-gray-400'
                    }`}
                >
                  <div
                    className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 ${step < currentStep
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : step === currentStep
                        ? 'border-blue-600 bg-white text-blue-600'
                        : 'border-gray-300 bg-white text-gray-400'
                      }`}
                  >
                    {step < currentStep ? '>' : step}
                  </div>
                  <span className="text-xs">
                    {step === 1 && '예약 확인'}
                    {step === 2 && '대표자 정보'}
                    {step === 3 && '동행자 정보'}
                    {step === 4 && '여권 정보'}
                    {step === 5 && '최종 확인'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Step 0: 본인 확인 */}
        {currentStep === 0 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-bold text-gray-900">본인 확인</h2>
            <p className="mb-6 text-sm text-gray-600">
              예약하신 분의 정보를 입력해주세요. 보안을 위해 본인 확인이 필요합니다.
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
                <p className="mt-1 text-xs text-gray-500">
                  예약 시 입력하신 전화번호를 입력해주세요.
                </p>
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

            <div className="mt-6 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">보안 안내:</span><br />
                다른 사람의 정보를 보호하기 위해 본인 확인 절차를 거칩니다.
                예약 시 입력하신 전화번호로만 접근 가능합니다.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: 예약 정보 확인 */}
        {currentStep === 1 && reservation && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-bold text-gray-900">1단계: 예약 정보 확인</h2>
            {reservation.trip && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-4">
                  <h3 className="mb-2 font-semibold text-blue-900">여행 정보</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">선박명:</span> {reservation.trip.shipName || '미정'}</p>
                    {reservation.trip.productCode && (
                      <p><span className="font-medium">상품코드:</span> {reservation.trip.productCode}</p>
                    )}
                    <p><span className="font-medium">출발일:</span> {reservation.trip.departureDate ? new Date(reservation.trip.departureDate).toLocaleDateString('ko-KR') : '미정'}</p>
                    {reservation.trip.endDate && (
                      <p><span className="font-medium">종료일:</span> {new Date(reservation.trip.endDate).toLocaleDateString('ko-KR')}</p>
                    )}
                    <p><span className="font-medium">상태:</span> {reservation.trip.status || '확인중'}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 font-semibold text-gray-900">예약 정보</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">예약번호:</span> {reservation.id}</p>
                    <p><span className="font-medium">총 인원:</span> {reservation.totalPeople}명</p>
                    <p><span className="font-medium">예약자:</span> {reservation.user.name || '이름 없음'}</p>
                    <p><span className="font-medium">연락처:</span> {reservation.user.phone || '연락처 없음'}</p>
                    {reservation.passportStatus && (
                      <p><span className="font-medium">여권 상태:</span> {reservation.passportStatus}</p>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={goToNextStep}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 대표자 정보 입력 */}
        {currentStep === 2 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-bold text-gray-900">2단계: 대표자 정보 입력</h2>
            {travelers.length > 0 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      한글 성명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={travelers[0].korName}
                      onChange={(e) => updateTraveler(0, 'korName', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={travelers[0].phone}
                      onChange={(e) => updateTraveler(0, 'phone', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="010-1234-5678"
                      required
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-between">
                  <button
                    onClick={goToPreviousStep}
                    className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
                  >
                    이전 단계
                  </button>
                  <button
                    onClick={goToNextStep}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 동행자 정보 입력 */}
        {currentStep === 3 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-bold text-gray-900">3단계: 동행자 정보 입력</h2>
            <div className="space-y-4">
              {travelers.length > 1 ? (
                <>
                  {travelers.slice(1).map((traveler, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">동행자 {index + 1}</h3>
                        <button
                          onClick={() => removeTraveler(index + 1)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            한글 성명 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={traveler.korName}
                            onChange={(e) => updateTraveler(index + 1, 'korName', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            연락처
                          </label>
                          <input
                            type="tel"
                            value={traveler.phone}
                            onChange={(e) => updateTraveler(index + 1, 'phone', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="010-1234-5678"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <p className="text-sm text-blue-900">
                    동행자가 있으시면 아래 버튼을 눌러 추가해주세요.
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    동행자가 없으시면 &quot;다음 단계로&quot; 버튼을 눌러 진행하세요.
                  </p>
                </div>
              )}

              {travelers.length < 10 && (
                <button
                  type="button"
                  onClick={addTraveler}
                  className="w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-6 py-4 text-blue-700 hover:bg-blue-100"
                >
                  + 동행자 추가하기
                </button>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={goToPreviousStep}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
                >
                  이전 단계
                </button>
                <button
                  onClick={goToNextStep}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                >
                  다음 단계로
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 여권 정보 입력 */}
        {currentStep === 4 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-gray-900">4단계: 여권 정보 입력</h2>
            {!isHelpMode && (
              <div className="space-y-6">
                {travelers.map((traveler, index) => (
                  <div key={index} className="rounded-lg bg-white p-6 shadow-md">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {index === 0 ? '대표자' : `동행자 ${index}`}
                      </h3>
                      {travelers.length > 1 && index > 0 && (
                        <button
                          onClick={() => removeTraveler(index)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    {/* 여권 스캔 버튼 */}
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => handlePassportScan(index)}
                        disabled={traveler.isScanning}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-400"
                      >
                        {traveler.isScanning ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            <span>AI 분석 중... (5~10초 소요)</span>
                          </>
                        ) : (
                          <span>여권 가져오기</span>
                        )}
                      </button>
                      {traveler.isScanning && (
                        <p className="mt-2 text-sm text-blue-600 animate-pulse">
                          여권 이미지를 AI가 분석하고 있습니다. 잠시만 기다려주세요...
                        </p>
                      )}

                      {/* 스캔 오류 발생 시 */}
                      {traveler.scanError && (
                        <div className="mt-3 rounded-lg bg-red-50 p-4 border border-red-200">
                          <p className="text-sm text-red-800 mb-3">
                            <strong>⚠️ 스캔 실패:</strong> {traveler.scanError}
                          </p>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handlePassportScan(index)}
                              className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 font-medium"
                            >
                              🔄 다시 시도하기
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...travelers];
                                updated[index].scanError = '';
                                updated[index].showManualInput = false;
                                setTravelers(updated);
                              }}
                              className="w-full rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 font-medium"
                            >
                              ✏️ 수동으로 입력하기
                            </button>
                          </div>
                        </div>
                      )}

                      <input
                        ref={(el) => {
                          fileInputRefs.current[index] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, index)}
                      />
                    </div>

                    {/* 필수 정보만 (korName, passportNo) */}
                    <div className="mb-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          한글 성명 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={traveler.korName}
                          onChange={(e) => updateTraveler(index, 'korName', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          여권번호 {!traveler.isSubmitLater && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          value={traveler.passportNo}
                          onChange={(e) => updateTraveler(index, 'passportNo', e.target.value.toUpperCase())}
                          disabled={traveler.isSubmitLater}
                          className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${traveler.isSubmitLater ? 'bg-gray-100' : ''
                            }`}
                          placeholder="M12345678"
                        />
                      </div>
                    </div>

                    {/* 추가 정보 (접기/펼치기) */}
                    <div className="border-t border-gray-200 pt-4">
                      <button
                        type="button"
                        onClick={() => updateTraveler(index, 'showAdditionalFields', !traveler.showAdditionalFields)}
                        className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        <span className="text-lg">{traveler.showAdditionalFields ? '▼' : '▶'}</span>
                        <span className="text-sm font-medium">추가 정보 {traveler.showAdditionalFields ? '숨기기' : '보기'}</span>
                      </button>

                      {traveler.showAdditionalFields && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              영문 성
                            </label>
                            <input
                              type="text"
                              value={traveler.engSurname}
                              onChange={(e) => updateTraveler(index, 'engSurname', e.target.value.toUpperCase())}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder="HONG"
                              disabled={traveler.isSubmitLater}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              영문 이름
                            </label>
                            <input
                              type="text"
                              value={traveler.engGivenName}
                              onChange={(e) => updateTraveler(index, 'engGivenName', e.target.value.toUpperCase())}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder="GILDONG"
                              disabled={traveler.isSubmitLater}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              생년월일
                            </label>
                            <input
                              type="date"
                              value={traveler.dateOfBirth}
                              onChange={(e) => updateTraveler(index, 'dateOfBirth', e.target.value)}
                              disabled={traveler.isSubmitLater}
                              className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${traveler.isSubmitLater ? 'bg-gray-100' : ''
                                }`}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              여권 만료일
                            </label>
                            <input
                              type="date"
                              value={traveler.passportExpiryDate}
                              onChange={(e) => updateTraveler(index, 'passportExpiryDate', e.target.value)}
                              disabled={traveler.isSubmitLater}
                              className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${traveler.isSubmitLater ? 'bg-gray-100' : ''
                                }`}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              국적
                            </label>
                            <input
                              type="text"
                              value={traveler.nationality}
                              onChange={(e) => updateTraveler(index, 'nationality', e.target.value)}
                              disabled={traveler.isSubmitLater}
                              className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${traveler.isSubmitLater ? 'bg-gray-100' : ''
                                }`}
                              placeholder="KOR"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              연락처 {index === 0 && <span className="text-red-500">*</span>}
                            </label>
                            <input
                              type="tel"
                              value={traveler.phone}
                              onChange={(e) => updateTraveler(index, 'phone', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder="010-1234-5678"
                              required={index === 0}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 추후 제출 체크박스 */}
                    <div className="mt-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={traveler.isSubmitLater}
                          onChange={(e) => updateTraveler(index, 'isSubmitLater', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">여권 정보 추후 제출</span>
                      </label>
                      {traveler.isSubmitLater && (
                        <p className="mt-1 text-xs text-gray-500">
                          이름만 입력하시면 됩니다. 여권 정보는 나중에 입력하실 수 있습니다.
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* 동행자 추가 버튼 */}
                {travelers.length < 10 && (
                  <button
                    type="button"
                    onClick={addTraveler}
                    className="w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-6 py-4 text-blue-700 hover:bg-blue-100"
                  >
                    + 동행자 추가하기
                  </button>
                )}

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={goToPreviousStep}
                    className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
                  >
                    이전 단계
                  </button>
                  <button
                    onClick={goToNextStep}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                  >
                    다음 단계로
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: 최종 확인 및 제출 */}
        {currentStep === 5 && (
          <div className="mb-8 space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-bold text-gray-900">5단계: 최종 확인 및 제출</h2>

              {/* 제출 후 절차 안내 */}
              <div className="mb-6 rounded-lg bg-blue-50 p-4 border-2 border-blue-200">
                <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-blue-900">
                  <span>제출 후 진행 절차</span>
                </h3>
                <ol className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold">1.</span>
                    <span><strong>여권 정보 저장</strong> - 입력하신 정보가 데이터베이스에 저장됩니다</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold">2.</span>
                    <span><strong>관리자 확인</strong> - 담당자가 여권 정보를 검토합니다</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold">3.</span>
                    <span><strong>크루즈사 등록</strong> - 확인 완료 후 크루즈 운영사에 여권 정보 전달</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold">4.</span>
                    <span><strong>탑승 준비 완료</strong> - 출항일에 탑승권 발급 가능</span>
                  </li>
                </ol>
                <p className="mt-3 text-xs text-blue-700 border-t border-blue-200 pt-3">
                  <strong>참고:</strong> 정보 제출 후에도 출항 전까지는 수정이 가능합니다. 문제가 있으면 담당자에게 연락주세요.
                </p>
              </div>

              <div className="space-y-6">
                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-3 font-semibold text-gray-900">입력하신 정보를 확인해주세요</h3>
                  <div className="space-y-4">
                    {travelers.map((traveler, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
                        <h4 className="mb-2 font-semibold text-gray-900">
                          {index === 0 ? '대표자' : `동행자 ${index}`}
                        </h4>
                        <div className="grid gap-2 text-sm md:grid-cols-2">
                          <p><span className="font-medium">한글 성명:</span> {traveler.korName || '미입력'}</p>
                          <p><span className="font-medium">영문 이름:</span> {traveler.engSurname && traveler.engGivenName ? `${traveler.engSurname} ${traveler.engGivenName}` : '미입력'}</p>
                          <p><span className="font-medium">여권번호:</span> {traveler.passportNo || (traveler.isSubmitLater ? '추후 제출' : '미입력')}</p>
                          <p><span className="font-medium">생년월일:</span> {traveler.dateOfBirth || '미입력'}</p>
                          <p><span className="font-medium">여권 만료일:</span> {traveler.passportExpiryDate || '미입력'}</p>
                          <p><span className="font-medium">국적:</span> {traveler.nationality || '미입력'}</p>
                          <p><span className="font-medium">연락처:</span> {traveler.phone || '미입력'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex justify-between">
                  <button
                    onClick={goToPreviousStep}
                    className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
                  >
                    이전 단계
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="rounded-lg bg-green-600 px-8 py-3 text-white font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? '저장 중...' : '입력 완료 (저장)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 단체 예약 도움 요청 섹션 (10명 이상) */}
        {isHelpMode && currentStep !== 5 && (
          <div className="mb-8 rounded-lg bg-yellow-50 p-6 shadow-md">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              10명 이상의 단체 여행이신가요?
            </h3>
            <p className="mb-6 text-gray-700">
              전담 직원이 입력을 도와드립니다. 아래 정보를 입력해주세요.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  신청자 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={helpName}
                  onChange={(e) => setHelpName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={helpPhone}
                  onChange={(e) => setHelpPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="010-1234-5678"
                />
              </div>

              <button
                onClick={handleHelpRequest}
                disabled={submittingHelp}
                className="w-full rounded-lg bg-yellow-600 px-6 py-3 text-white hover:bg-yellow-700 disabled:bg-gray-400"
              >
                {submittingHelp ? '요청 중...' : '도움 요청하기'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
