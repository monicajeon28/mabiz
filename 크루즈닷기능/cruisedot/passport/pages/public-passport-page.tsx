'use client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFilePlus,
  FiPlus,
  FiTrash,
  FiUpload,
  FiUserCheck,
  FiCamera,
  FiUsers,
  FiUser,
} from 'react-icons/fi';

interface PassportFile {
  fileName: string;
  url: string;
  uploadedAt?: string;
}

interface SubmissionInfo {
  id: number;
  token: string;
  expiresAt: string;
  isExpired: boolean;
  isSubmitted: boolean;
  submittedAt: string | null;
  driveFolderUrl: string | null;
  extraData: {
    passportFiles: PassportFile[];
    groups: Array<{
      groupNumber: number;
      guests: Array<GuestPayload>;
    }>;
    remarks: string;
  };
}

interface UserInfo {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface TripInfo {
  id: number;
  cruiseName: string | null;
  startDate: string | null;
  endDate: string | null;
  reservationCode: string | null;
}

interface GuestPayload {
  id: string;
  name: string;
  phone: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  passportExpiryDate: string;
  gender?: string;
  engSurname?: string;
  engGivenName?: string;
}

interface GroupState {
  groupNumber: number;
  guests: GuestPayload[];
}

type Step = 0 | 1 | 2 | 3 | 4;

const MAX_GROUPS = 30;
const MAX_GUESTS_PER_GROUP = 10;

// 그룹별 색상 팔레트 (파스텔 톤)
const GROUP_COLORS = [
  'bg-red-50 border-red-200 text-red-900',
  'bg-orange-50 border-orange-200 text-orange-900',
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-yellow-50 border-yellow-200 text-yellow-900',
  'bg-lime-50 border-lime-200 text-lime-900',
  'bg-green-50 border-green-200 text-green-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-teal-50 border-teal-200 text-teal-900',
  'bg-cyan-50 border-cyan-200 text-cyan-900',
  'bg-sky-50 border-sky-200 text-sky-900',
  'bg-blue-50 border-blue-200 text-blue-900',
  'bg-indigo-50 border-indigo-200 text-indigo-900',
  'bg-violet-50 border-violet-200 text-violet-900',
  'bg-purple-50 border-purple-200 text-purple-900',
  'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900',
  'bg-pink-50 border-pink-200 text-pink-900',
  'bg-rose-50 border-rose-200 text-rose-900',
];

function getGroupColor(groupNumber: number) {
  return GROUP_COLORS[(groupNumber - 1) % GROUP_COLORS.length];
}

function createEmptyGuest(): GuestPayload {
  return {
    id: `guest-${Math.random().toString(36).slice(2)}`,
    name: '',
    phone: '',
    passportNumber: '',
    nationality: '',
    dateOfBirth: '',
    passportExpiryDate: '',
    gender: '',
    engSurname: '',
    engGivenName: '',
  };
}

function createInitialGroups(savedGroups?: Array<{ groupNumber: number; guests: Array<Partial<GuestPayload>> }>): GroupState[] {
  if (savedGroups && savedGroups.length > 0) {
    return savedGroups.slice(0, MAX_GROUPS).map((group, index) => ({
      groupNumber: group.groupNumber ?? index + 1,
      guests:
        group.guests && group.guests.length > 0
          ? group.guests.slice(0, MAX_GUESTS_PER_GROUP).map((guest) => ({
            ...createEmptyGuest(),
            ...guest,
            id: `guest-${Math.random().toString(36).slice(2)}`,
          }))
          : [createEmptyGuest()],
    }));
  }

  return [
    {
      groupNumber: 1,
      guests: [createEmptyGuest()],
    },
  ];
}

export default function PassportSubmissionPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token;
  const mode = searchParams.get('mode') === 'passport' ? 'passport' : 'pnr'; // default to pnr if not specified or 'pnr'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<PassportFile[]>([]);
  const [groups, setGroups] = useState<GroupState[]>(createInitialGroups());
  const [remarks, setRemarks] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSubmission = async () => {
      try {
        const res = await fetch(`/api/passport/${token}`, { signal: controller.signal });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '토큰 확인 중 오류가 발생했습니다.');
        }
        const data = await res.json();
        setSubmission(data.submission);
        setUserInfo(data.user);
        setTripInfo(data.trip);
        setUploadedFiles(data.submission.extraData?.passportFiles ?? []);
        setRemarks(data.submission.extraData?.remarks ?? '');

        // If mode is passport, ensure only 1 group with 1 guest
        if (mode === 'passport') {
          setGroups([{ groupNumber: 1, guests: [createEmptyGuest()] }]);
        } else {
          setGroups(createInitialGroups(data.submission.extraData?.groups));
        }

        if (data.submission.isSubmitted) {
          setStep(4);
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : '토큰 확인 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
    return () => controller.abort();
  }, [token, mode]);

  const expiresInText = useMemo(() => {
    if (!submission) return '';
    const diff = new Date(submission.expiresAt).getTime() - Date.now();
    if (diff <= 0) return '만료됨';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return `${hours}시간 ${minutes}분 남음`;
  }, [submission]);

  const handleNextStep = () => {
    setStep((prev) => (prev >= 3 ? prev : ((prev + 1) as Step)));
  };

  const handlePrevStep = () => {
    setStep((prev) => (prev <= 0 ? prev : ((prev - 1) as Step)));
  };

  // OCR Upload Handler
  const handleOcrUpload = async (event: ChangeEvent<HTMLInputElement>, groupNumber: number, guestId: string) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];

    const formData = new FormData();
    formData.append('file', file);

    try {
      setOcrProcessing(true);
      // 1. Upload for OCR
      const ocrRes = await fetch(`/api/passport/${token}/ocr`, {
        method: 'POST',
        body: formData,
      });
      const ocrData = await ocrRes.json();

      if (!ocrRes.ok || !ocrData.ok) {
        throw new Error(ocrData.error || 'OCR 처리에 실패했습니다.');
      }

      const extracted = ocrData.data;

      // 2. Update Guest Data
      setGroups((prev) =>
        prev.map((group) =>
          group.groupNumber === groupNumber
            ? {
              ...group,
              guests: group.guests.map((guest) =>
                guest.id === guestId
                  ? {
                    ...guest,
                    name: extracted.korName || guest.name,
                    engSurname: extracted.engSurname || guest.engSurname,
                    engGivenName: extracted.engGivenName || guest.engGivenName,
                    passportNumber: extracted.passportNo || guest.passportNumber,
                    nationality: extracted.nationality || guest.nationality,
                    dateOfBirth: extracted.dateOfBirth || guest.dateOfBirth,
                    passportExpiryDate: extracted.passportExpiryDate || guest.passportExpiryDate,
                    gender: extracted.sex || guest.gender,
                  }
                  : guest
              ),
            }
            : group
        )
      );

      // 3. Upload file to storage (for record)
      // Re-create formData because it might have been consumed? (Safe to reuse usually, but let's be sure)
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadRes = await fetch(`/api/passport/${token}/upload`, {
        method: 'POST',
        body: uploadFormData,
      });
      const uploadData = await uploadRes.json();
      if (uploadRes.ok && uploadData.ok) {
        setUploadedFiles(uploadData.files ?? []);
      }

      alert('여권 정보를 성공적으로 인식했습니다! 내용을 확인해주세요.');

    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'OCR 처리 중 오류가 발생했습니다.');
    } finally {
      setOcrProcessing(false);
      event.target.value = '';
    }
  };

  const handleAddGroup = () => {
    if (groups.length >= MAX_GROUPS) {
      alert(`그룹은 최대 ${MAX_GROUPS}개까지 추가할 수 있어요.`);
      return;
    }
    const nextGroupNumber = Math.max(...groups.map((g) => g.groupNumber)) + 1;
    setGroups((prev) => [...prev, { groupNumber: nextGroupNumber, guests: [createEmptyGuest()] }]);
  };

  const handleRemoveGroup = (groupNumber: number) => {
    if (groups.length === 1) {
      alert('최소 1개의 그룹은 유지해야 합니다.');
      return;
    }
    setGroups((prev) => prev.filter((group) => group.groupNumber !== groupNumber));
  };

  const handleAddGuest = (groupNumber: number) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.groupNumber === groupNumber
          ? {
            ...group,
            guests:
              group.guests.length >= MAX_GUESTS_PER_GROUP
                ? group.guests
                : [...group.guests, createEmptyGuest()],
          }
          : group,
      ),
    );
  };

  const handleRemoveGuest = (groupNumber: number, guestId: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.groupNumber === groupNumber
          ? {
            ...group,
            guests:
              group.guests.length <= 1
                ? group.guests
                : group.guests.filter((guest) => guest.id !== guestId),
          }
          : group,
      ),
    );
  };

  const handleGuestChange = (groupNumber: number, guestId: string, field: keyof GuestPayload, value: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.groupNumber === groupNumber
          ? {
            ...group,
            guests: group.guests.map((guest) =>
              guest.id === guestId
                ? {
                  ...guest,
                  [field]: value,
                }
                : guest,
            ),
          }
          : group,
      ),
    );
  };

  const totalGuests = useMemo(
    () => groups.reduce((sum, group) => sum + group.guests.filter((guest) => (guest.name || guest.engSurname || '').trim().length > 0).length, 0),
    [groups],
  );

  const handleSubmit = async () => {
    if (submitting) return;

    const sanitizedGroups = groups.map((group) => ({
      groupNumber: group.groupNumber,
      guests: group.guests.map(({ id, ...rest }) => ({ ...rest })),
    }));

    if (sanitizedGroups.every((group) => group.guests.every((guest) => (guest.name || guest.engSurname || '').trim().length === 0))) {
      alert('탑승자 정보를 최소 한 명 이상 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/passport/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: sanitizedGroups,
          remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '제출에 실패했습니다.');
      }
      setSuccessMessage('정보 제출이 완료되었습니다. 빠르게 확인 후 안내드릴게요!');
      setStep(4);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : '제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="text-lg text-blue-700">정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center">
        <div className="max-w-md bg-white border border-red-200 rounded-2xl shadow-lg p-8 text-center space-y-4">
          <FiAlertCircle className="text-red-500 text-5xl mx-auto" />
          <h1 className="text-2xl font-bold text-red-600">링크를 사용할 수 없습니다</h1>
          <p className="text-gray-600 leading-relaxed">{error ?? '링크가 만료되었거나 잘못된 접근입니다.'}</p>
        </div>
      </div>
    );
  }

  if (step === 4 || submission.isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-green-200 rounded-2xl shadow-xl p-8 space-y-5 text-center">
          <FiCheckCircle className="text-green-500 text-5xl mx-auto" />
          <h1 className="text-3xl font-extrabold text-green-700">제출이 완료되었습니다!</h1>
          <p className="text-gray-600 leading-relaxed">
            {successMessage || '제출해 주신 정보를 담당자가 확인 중입니다.'}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900">
            <p>제출일시: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 bg-white border border-blue-100 shadow-lg rounded-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-blue-800 flex items-center gap-3">
                <span className="text-4xl">{mode === 'passport' ? '🛂' : '👨‍👩‍👧‍👦'}</span>
                {mode === 'passport' ? '여권 간편 등록' : '객실 배정 & 여권 등록'}
              </h1>
              <p className="mt-3 text-base md:text-lg text-gray-600 leading-relaxed">
                {mode === 'passport'
                  ? '여권 사진을 업로드하면 정보가 자동으로 입력됩니다.'
                  : '함께 객실을 사용하는 인원끼리 그룹으로 묶고 여권을 등록해주세요.'}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3 text-blue-900">
              <FiClock className="text-2xl" />
              <div>
                <p className="text-sm font-semibold">만료까지</p>
                <p className="text-lg font-bold">{expiresInText}</p>
              </div>
            </div>
          </div>

          {tripInfo && (
            <div className="mt-6 grid md:grid-cols-2 gap-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div>
                <p className="text-sm text-blue-700 font-semibold">여행 상품</p>
                <p className="text-lg font-bold text-blue-900">{tripInfo.cruiseName ?? '상품명 미확인'}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-semibold">여행 일정</p>
                <p className="text-lg font-bold text-blue-900">
                  {tripInfo.startDate ? new Date(tripInfo.startDate).toLocaleDateString() : '?'} ~{' '}
                  {tripInfo.endDate ? new Date(tripInfo.endDate).toLocaleDateString() : '?'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Steps Indicator */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {['시작하기', '정보 입력', '검토 & 제출'].map((label, index) => {
            const stepIndex = index as Step;
            const isActive = step === stepIndex;
            const isCompleted = step > stepIndex;
            return (
              <div
                key={label}
                className={`rounded-xl border-2 px-3 py-4 text-center text-sm md:text-base font-semibold transition-all ${isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                    : isCompleted
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
              >
                {label}
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
          {/* Step 0: Intro */}
          {step === 0 && (
            <section className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-4">
                <FiCheckCircle className="text-blue-600 text-3xl" />
                <div className="text-sm md:text-base text-blue-900 leading-relaxed">
                  <p className="font-semibold">제출 전 준비해주세요</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>여권 정보면 전체가 잘 나오도록 촬영해주세요.</li>
                    {mode === 'pnr' && <li>각 객실에 함께 머물고 싶은 사람을 그룹으로 묶어 입력하세요.</li>}
                    <li>연락처를 입력하면 크루즈가이드 계정이 자동 생성됩니다.</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={handleNextStep}
                className="w-full px-5 py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                시작하기 <FiChevronRight />
              </button>
            </section>
          )}

          {/* Step 1: Input Form */}
          {step === 1 && (
            <section className="space-y-8">
              {groups.map((group) => (
                <div key={group.groupNumber} className={`rounded-2xl p-5 border-2 ${getGroupColor(group.groupNumber)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {mode === 'pnr' ? <FiUsers /> : <FiUser />}
                      {mode === 'pnr' ? `객실 그룹 ${group.groupNumber}` : '여권 정보'}
                    </h3>
                    {mode === 'pnr' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddGuest(group.groupNumber)}
                          className="px-3 py-1.5 bg-white bg-opacity-50 border border-current rounded-lg text-sm font-semibold hover:bg-opacity-100"
                        >
                          + 인원 추가
                        </button>
                        {groups.length > 1 && (
                          <button
                            onClick={() => handleRemoveGroup(group.groupNumber)}
                            className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-200"
                          >
                            그룹 삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {group.guests.map((guest, index) => (
                      <div key={guest.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 relative">
                        {/* Guest Header & Remove Button */}
                        <div className="flex justify-between items-start mb-4">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600 mr-2">
                            {index + 1}
                          </span>
                          {group.guests.length > 1 && (
                            <button
                              onClick={() => handleRemoveGuest(group.groupNumber, guest.id)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <FiTrash />
                            </button>
                          )}
                        </div>

                        {/* OCR Upload Button */}
                        <div className="mb-6">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {ocrProcessing ? (
                                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                              ) : (
                                <FiCamera className="w-8 h-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                              )}
                              <p className="text-sm text-blue-700 font-semibold">
                                {ocrProcessing ? '인식 중...' : '여권 사진 찍기 / 업로드'}
                              </p>
                              <p className="text-xs text-blue-500 mt-1">정보가 자동으로 입력됩니다</p>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleOcrUpload(e, group.groupNumber, guest.id)}
                              disabled={ocrProcessing}
                            />
                          </label>
                        </div>

                        {/* Form Fields */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">한글 성명</label>
                            <input
                              type="text"
                              value={guest.name}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="홍길동"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">휴대폰 번호 (계정 생성용)</label>
                            <input
                              type="tel"
                              value={guest.phone}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'phone', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="010-1234-5678"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">영문 성 (Surname)</label>
                            <input
                              type="text"
                              value={guest.engSurname || ''}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'engSurname', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="HONG"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">영문 이름 (Given Name)</label>
                            <input
                              type="text"
                              value={guest.engGivenName || ''}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'engGivenName', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="GILDONG"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">여권 번호</label>
                            <input
                              type="text"
                              value={guest.passportNumber}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'passportNumber', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="M12345678"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">생년월일</label>
                            <input
                              type="date"
                              value={guest.dateOfBirth}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'dateOfBirth', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">여권 만료일</label>
                            <input
                              type="date"
                              value={guest.passportExpiryDate}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'passportExpiryDate', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">성별</label>
                            <select
                              value={guest.gender || ''}
                              onChange={(e) => handleGuestChange(group.groupNumber, guest.id, 'gender', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">선택</option>
                              <option value="M">남성 (M)</option>
                              <option value="F">여성 (F)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {mode === 'pnr' && (
                <button
                  onClick={handleAddGroup}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-semibold hover:border-blue-500 hover:text-blue-500 transition-colors"
                >
                  + 새로운 객실 그룹 추가
                </button>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePrevStep}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                >
                  이전
                </button>
                <button
                  onClick={handleNextStep}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                >
                  다음
                </button>
              </div>
            </section>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">입력 내용 확인</h2>

              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.groupNumber} className={`rounded-xl p-4 border ${getGroupColor(group.groupNumber)} bg-opacity-50`}>
                    <h4 className="font-bold mb-2">{mode === 'pnr' ? `객실 그룹 ${group.groupNumber}` : '여권 정보'}</h4>
                    <ul className="space-y-2">
                      {group.guests.map((guest) => (
                        <li key={guest.id} className="text-sm bg-white bg-opacity-60 p-2 rounded">
                          <span className="font-bold">{guest.name || guest.engSurname}</span>
                          {guest.passportNumber && <span className="mx-2 text-gray-500">| {guest.passportNumber}</span>}
                          {guest.phone && <span className="text-blue-600">| {guest.phone}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">추가 전달 사항</label>
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={3}
                  placeholder="요청사항이 있다면 적어주세요."
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePrevStep}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                >
                  수정하기
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '제출 중...' : '제출하기'}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
