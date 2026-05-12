'use client';

/**
 * /affiliate/pre-sales — 프리세일즈 가입 신청 (공개 페이지, 인증 불필요)
 */

import { useState } from 'react';

const COMPANY = {
  name: '마비즈스쿨 원격평생교육원',
  bizNo: '851-67-00338',
  ceo: '전혜선',
  address: '서울특별시 마포구 월드컵로 196, B105-M26호',
  phone: '010-2495-8013',
};

type Step = 'form' | 'success';

export default function PreSalesApplyPage() {
  const [step, setStep] = useState<Step>('form');
  const [resultId, setResultId] = useState<number | null>(null);

  // 신청자 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  // 동의
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const allConsents = consentPrivacy && consentTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || name.trim().length < 2) {
      setErrorMsg('이름을 입력해 주세요.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 9) {
      setErrorMsg('연락처를 입력해 주세요.');
      return;
    }
    if (!allConsents) {
      setErrorMsg('필수 동의 항목을 모두 확인해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          consentPrivacy,
          consentNonCompete: false,
          consentDbUse: false,
          consentPenalty: false,
          consentRefund: false,
          metadata: {
            type: 'PRE_SALES',
            note: note.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrorMsg(data.message || '오류가 발생했습니다.');
        return;
      }
      setResultId(data.data?.contractId ?? null);
      setStep('success');
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">신청 완료!</h1>
            <p className="text-gray-500 mt-2 text-sm">담당자가 확인 후 연락드리겠습니다.</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-sm text-left space-y-2">
            <p className="text-emerald-700 font-semibold">신청 정보</p>
            <div className="text-gray-700 space-y-1">
              <p>• 구분: 프리세일즈 가입 신청</p>
              <p>• 이름: {name}</p>
              {resultId && <p>• 신청번호: #{resultId}</p>}
            </div>
          </div>
          <p className="text-xs text-gray-400">문의: {COMPANY.phone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{COMPANY.name}</h1>
            <p className="text-xs text-gray-500">프리세일즈 가입 신청서</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* 안내 배너 */}
        <div className="bg-emerald-600 rounded-2xl p-5 text-white">
          <h2 className="text-lg font-bold mb-1">프리세일즈 파트너 신청</h2>
          <p className="text-emerald-100 text-sm leading-relaxed">
            마비즈스쿨의 프리세일즈 파트너로 활동하시겠습니까?<br />
            신청서를 작성해 주시면 담당자가 검토 후 연락드립니다.
          </p>
        </div>

        {/* 신청자 정보 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-emerald-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">신청자 정보</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="서울특별시 ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지원 동기 / 한마디
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="간단히 소개해 주세요 (선택 사항)"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
              />
            </div>
          </div>
        </section>

        {/* 프리세일즈 안내 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-700 px-6 py-4">
            <h2 className="text-white font-bold text-base">프리세일즈 활동 안내</h2>
          </div>
          <div className="p-6 space-y-3 text-sm text-gray-700">
            <div className="space-y-2">
              <p className="font-semibold text-gray-800">프리세일즈란?</p>
              <p className="text-gray-600 leading-relaxed">
                정식 계약 체결 전 단계로, 마비즈스쿨의 크루즈 여행 상품 및 서비스를 소개하고
                잠재 고객을 발굴하는 활동을 수행합니다.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
              <p className="font-semibold text-emerald-800 text-sm">활동 혜택</p>
              <ul className="text-emerald-700 text-xs space-y-1">
                <li>• 크루즈 상품 소개 자료 및 마케팅 지원</li>
                <li>• 성과에 따른 인센티브 지급</li>
                <li>• 정식 파트너(직속마케터/직속인솔스탭/대리점장) 전환 우선 검토</li>
                <li>• 교육 및 세미나 참여 기회 제공</li>
              </ul>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-gray-700 text-sm">유의 사항</p>
              <ul className="text-gray-500 text-xs space-y-1">
                <li>• 프리세일즈는 비정규 활동으로 고정 보수가 없습니다.</li>
                <li>• 활동 내용 및 범위는 담당자와 협의하여 결정합니다.</li>
                <li>• 개인정보 및 영업 자료는 계약 목적 외 사용을 금합니다.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 동의 항목 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-orange-500 px-6 py-4">
            <h2 className="text-white font-bold text-base">필수 동의</h2>
          </div>
          <div className="p-6 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
              <input
                type="checkbox"
                checked={consentPrivacy}
                onChange={(e) => setConsentPrivacy(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">개인정보 처리 동의 (필수)</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  수집 항목: 이름, 연락처, 이메일, 주소 · 목적: 프리세일즈 파트너 신청 처리 · 보유: 처리 완료 후 6개월
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
              <input
                type="checkbox"
                checked={consentTerms}
                onChange={(e) => setConsentTerms(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">활동 안내 및 유의 사항 확인 (필수)</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  위 프리세일즈 활동 안내 및 유의 사항을 모두 읽고 이해하였습니다.
                </p>
              </div>
            </label>
          </div>
        </section>

        {/* 에러 */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* 제출 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-200"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              제출 중...
            </span>
          ) : (
            '프리세일즈 가입 신청'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          제출 후 담당자가 확인하여 연락드립니다 · {COMPANY.phone}
        </p>
      </form>
    </div>
  );
}
