// components/mall/InquiryForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface InquiryFormProps {
  productCode: string;
  productName: string;
  partnerId?: string; // 어필리에이트 파트너 ID
  partnerPhone?: string; // 파트너 연락처 (계약서 작성 시 입력한 연락처)
}

// Google Apps Script URL - 전화상담 고객 백업용 스프레드시트
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVYYHKLyNfXwO3fSX19jmb7hF3Bh2oyay7lrlw3mJx42eL9kQANxhwxLrQyzbEj29x/exec';

export default function InquiryForm({ productCode, productName, partnerId, partnerPhone }: InquiryFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 입력값 검증
      if (!formData.name.trim() || !formData.phone.trim()) {
        alert('이름과 연락처를 모두 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      // 전화번호 형식 검증
      const phoneRegex = /^01([0|1|6|7|8|9]?)(\d{3,4})(\d{4})$/;
      const phoneValue = formData.phone.replace(/-/g, '');
      if (!phoneRegex.test(phoneValue)) {
        alert('올바른 휴대폰 번호를 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      const nameValue = formData.name.trim();
      const phoneNumber = phoneValue;

      // 데이터베이스에 저장 (구매 문의 관리에 표시되도록)
      // partnerId가 있으면 쿠키에도 저장 (추적 유지)
      if (partnerId) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        document.cookie = `affiliate_mall_user_id=${partnerId}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
      }

      try {
        const dbResponse = await fetch('/api/public/inquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productCode,
            name: 'helpuser', // 전화상담 신청은 helpuser로 고정
            phone: 'helpphone', // 전화상담 신청은 helpphone으로 고정
            passportNumber: null, // 전화상담 문의는 여권번호 불필요
            message: null,
            isPhoneConsultation: true, // 전화상담 신청 플래그
            actualName: nameValue, // 실제 이름은 별도 필드로 전달
            actualPhone: phoneNumber, // 실제 연락처는 별도 필드로 전달
            partnerId: partnerId || null, // 파트너 ID 직접 전달 (쿠키 대신)
          }),
        });

        await dbResponse.json();
        // 데이터베이스 저장 성공/실패 모두 Google 스프래드시트 전송 계속 진행
      } catch {
        // 데이터베이스 저장 실패해도 Google 스프래드시트 전송은 계속 진행
      }

      // Google 스프래드시트 백업 전송
      // 스프레드시트 구조: A열(유입날짜), B열(이름), C열(연락처), D열(유입경로), E열(상품명), F열(채널), G열(담당자)
      const timestamp = new Date().toLocaleString('ko-KR');

      // 채널 및 담당자 정보 결정
      let channel = '본사';
      let manager = '';
      if (partnerId) {
        // partnerId가 있으면 대리점장 또는 판매원 채널
        channel = '파트너';
        manager = partnerId;
      }

      // Google 스프래드시트 전송 (백업용)
      if (GOOGLE_SCRIPT_URL) {
        try {
          const formDataForGoogle = new FormData();
          formDataForGoogle.append('timestamp', timestamp);
          formDataForGoogle.append('name', nameValue);
          formDataForGoogle.append('phone', phoneNumber);
          formDataForGoogle.append('source', '(홈페이지)');
          formDataForGoogle.append('productName', productName);
          formDataForGoogle.append('channel', channel);
          formDataForGoogle.append('manager', manager);

          if (navigator.sendBeacon) {
            navigator.sendBeacon(GOOGLE_SCRIPT_URL, formDataForGoogle);
          } else {
            fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              body: formDataForGoogle,
              mode: 'no-cors',
              keepalive: true
            }).catch(() => {
              // 스프레드시트 전송 실패해도 문의 접수는 성공 처리
            });
          }
        } catch {
          // 스프레드시트 전송 실패해도 문의 접수는 성공 처리
        }
      }

      // 마케팅 픽셀 이벤트 추적
      try {
        const { trackLead } = await import('@/lib/marketing/tracking');
        trackLead({
          contentName: productName,
          currency: 'KRW',
        });
      } catch {
        // 마케팅 픽셀 실패는 문의 접수에 영향 없음
      }

      // 성공 상태로 변경하고 폼 초기화
      setIsSuccess(true);
      setFormData({
        name: '',
        phone: '',
      });
      setIsSubmitting(false);

      // 3초 후 성공 메시지 숨기기 (선택사항)
      // setTimeout(() => {
      //   setIsSuccess(false);
      // }, 5000);

    } catch {
      alert('문의 접수 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // 성공 메시지 표시
  if (isSuccess) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-2">문의 접수가 완료되었습니다!</h3>
            <p className="text-sm text-green-700 mb-4">
              입력해주신 정보로 담당자가 곧 연락드리겠습니다.
            </p>
            <p className="text-xs text-green-600">
              담당자 연락처: {partnerPhone || '010-3289-3800'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setIsSuccess(false);
              setFormData({ name: '', phone: '' });
            }}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            추가 문의하기
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 이름 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="홍길동"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* 연락처 */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          연락처 <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
          placeholder="010-1234-5678 ('-' 제외 가능)"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          상담원이 연락드릴 번호를 입력해주세요.
        </p>
      </div>

      {/* 안내 문구 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📞</div>
          <div>
            <div className="font-semibold text-gray-800 mb-1">해피콜 안내</div>
            <p className="text-sm text-gray-700">
              문의 접수 후 담당자가 연락드려 상세한 안내를 도와드립니다.
              <br />
              <span className="font-semibold">담당자 연락처: {partnerPhone || '010-3289-3800'}</span>
              <br />
              <span className="text-red-600 font-semibold">*담당 매니저님 핸드폰으로 연락이 갈 수 있습니다 문자 확인 잘 해주세요*</span>
            </p>
          </div>
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '접수 중...' : '문의 접수하기'}
        </button>
      </div>
    </form>
  );
}




