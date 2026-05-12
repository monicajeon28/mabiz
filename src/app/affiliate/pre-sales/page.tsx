'use client';

/**
 * /affiliate/pre-sales — 크루즈닷 파트너스 가입 신청 (공개 페이지, 인증 불필요)
 * 프리랜서 용역계약서 형식
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';

const COMPANY = {
  name: '크루즈닷',
  ceo: '배연성',
  phone: '010-3289-3800',
  logo: '/크루즈닷파트너스투명배경.png',
  stamp: '/baeyeonseong-stamp.png',
  cruiseStamp: '/cruise-stamp.png',
};

type Step = 'form' | 'success';

// ── 계약서 본문 ───────────────────────────────────────────────────────

function getContractBody(params: {
  name: string;
  phone: string;
  address: string;
  residentId: string;
  supervisorName: string;
  supervisorAgency: string;
  supervisorPhone: string;
  useSupervisor: boolean;
}) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const {
    name, phone, address, residentId,
    supervisorName, supervisorAgency, supervisorPhone, useSupervisor,
  } = params;

  const supervisorSection = useSupervisor && supervisorName
    ? `담당 대리점장: ${supervisorName} (${supervisorAgency}) / ${supervisorPhone}`
    : `담당: 본사 직속 (${COMPANY.phone})`;

  return `크루즈닷 파트너스 프리랜서 용역계약서

본 계약은 크루즈닷(이하 "갑")과 아래의 "을" 사이에 크루즈 상품 홍보 및 판매 용역에 관하여 다음과 같이 체결한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
계약 당사자
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【 갑 】
  회사명  : 크루즈닷
  대표자  : 배연성
  연락처  : ${COMPANY.phone}

【 을 】
  성  명  : ${name || '                    '}
  연락처  : ${phone || '                    '}
  주  소  : ${address || '                    '}
  주민번호: ${residentId ? residentId.replace(/(\d{6})-?(\d{7})/, '$1-$2') : '              -              '}
  ${supervisorSection}

계약 체결일 : ${dateStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제1조 (목적)
본 계약은 갑이 운영하는 크루즈 여행 상품 및 서비스를 을이 홍보·소개하고, 성과에 따른 용역 보수를 지급받는 프리랜서 파트너십 관계를 규율하기 위한 것이다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제2조 (용역의 범위)
① 을은 갑의 크루즈 상품을 잠재 고객에게 소개·홍보하는 활동을 수행한다.
② 을은 갑이 제공하는 마케팅 자료 및 정보를 활용하여 영업 활동을 전개한다.
③ 을은 갑의 영업 시스템(CRM 등)에 등록된 고객 정보를 용역 목적 외에 사용하지 않는다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제3조 (보수 및 정산)
① 갑은 을의 영업 성과에 따라 다음의 기준으로 용역 보수를 지급한다.
   - 기본 수수료 : 판매 금액의 1% ~ 5% (성과 및 등급에 따라 차등 적용)
   - 수수료율은 갑과 을이 별도 협의하여 결정하며, 갑의 내부 정책에 따라 조정될 수 있다.
② 정산은 매월 말일 기준으로 익월 15일 이내에 지급한다.
③ 을이 제공한 정산 계좌 정보가 불일치하는 경우 지급이 보류될 수 있다.
④ 가입비·보증금 등 선납 비용은 없다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제4조 (타사 영업 허용)
① 을은 본 계약과 동시에 타 회사 또는 타 브랜드의 용역 활동을 병행할 수 있다.
② 단, 갑의 고객 정보·영업 자료·마케팅 콘텐츠를 타사 활동에 활용하는 것은 엄격히 금지한다.
③ 갑의 상표·로고·브랜드명을 타사 영업에 사용하거나 혼동을 일으키는 행위는 금지한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제5조 (콘텐츠 보호 및 무단도용 금지)
① 갑이 제공하는 모든 마케팅 자료, 이미지, 영상, 텍스트, 교육 자료 등의 저작권은 갑에게 귀속된다.
② 을은 갑의 콘텐츠를 갑의 사전 서면 동의 없이 복제·수정·배포·판매하거나 타 플랫폼에 게시할 수 없다.
③ 을이 본 조를 위반할 경우, 갑은 을에 대해 즉시 계약을 해지하고, 손해배상 및 위약벌을 청구할 수 있다.
   - 위약벌 : 위반 행위 1건당 금 삼백만 원(₩3,000,000) 이상
④ 계약 해지 이후에도 취득한 콘텐츠의 무단사용 금지 의무는 유효하다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제6조 (자동 해지 조건)
① 다음 각 호에 해당하는 경우, 별도 통보 없이 본 계약은 자동으로 해지된다.
   1. 을의 판매 실적이 계약 체결일 또는 최종 판매일로부터 연속 5개월간 0건인 경우
   2. 을이 갑의 브랜드 또는 상품에 대한 허위 정보를 유포하거나 명예를 훼손한 경우
   3. 을이 경쟁사의 편의를 위해 갑의 내부 정보를 제공하거나 활동한 경우
② 자동 해지 시 갑은 을에게 이메일 또는 문자로 해지 사실을 통보하여야 한다.
③ 자동 해지 이전의 정산 미지급 보수는 통상적인 절차에 따라 지급한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제7조 (계약 해지 후 브랜드 보호 의무)
① 계약이 해지된 날로부터 2년간, 을은 다음 각 호의 행위를 할 수 없다.
   1. 갑의 상표·로고·브랜드명 및 이와 유사한 명칭을 사용하는 행위
   2. "크루즈닷 파트너스 출신" 또는 유사한 표현으로 마케팅·홍보하는 행위
   3. 갑의 상품과 동일하거나 유사한 상품을 갑의 고객에게 판매하는 행위
② 을이 제1항을 위반할 경우, 갑은 손해배상 외에 위반 기간 동안의 부당 이익에 해당하는 금액을 추가로 청구할 수 있다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제8조 (개인정보 보호)
① 갑과 을은 용역 수행 과정에서 취득한 고객 개인정보를 「개인정보 보호법」에 따라 처리하여야 한다.
② 을은 갑의 고객 정보를 계약 목적 이외의 용도로 이용하거나 제3자에게 제공할 수 없다.
③ 을이 본 조를 위반할 경우, 관계 법령에 따른 민·형사상 책임을 진다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제9조 (일반 조항)
① 본 계약에 명시되지 않은 사항은 갑과 을이 협의하여 결정한다.
② 본 계약과 관련한 분쟁이 발생할 경우, 갑의 주소지를 관할하는 법원을 제1심 법원으로 한다.
③ 본 계약은 전자적 방식(전자서명, 온라인 동의)으로 체결될 수 있으며 이는 서면 계약과 동일한 효력을 갖는다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 계약 내용을 확인하고 동의합니다.

${dateStr}

갑 : 크루즈닷         대표 배연성  (인)
을 : ${name || '          '}          (서명)
`;
}

// ── 서명 캔버스 ──────────────────────────────────────────────────────

interface SignatureCanvasProps {
  onSigned: (dataUrl: string | null) => void;
}

function SignatureCanvas({ onSigned }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }, []);

  const endDraw = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current!;
    onSigned(canvas.toDataURL('image/png'));
  }, [onSigned]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('mouseleave', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', endDraw);
    };
  }, [startDraw, draw, endDraw]);

  const handleClear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSigned(null);
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          width={520}
          height={120}
          className="w-full touch-none cursor-crosshair"
          style={{ display: 'block' }}
        />
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-300 pointer-events-none select-none">
          서명란
        </div>
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        지우기
      </button>
    </div>
  );
}

// ── 파일 업로드 컴포넌트 ─────────────────────────────────────────────

interface FileUploadProps {
  label: string;
  required?: boolean;
  hint?: string;
  onChange: (dataUrl: string | null) => void;
  preview: string | null;
}

function FileUpload({ label, required, hint, onChange, preview }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      alert('이미지 파일만 업로드할 수 있습니다 (JPG, PNG, WEBP, HEIC).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onChange(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {preview ? (
        <div className="relative border border-gray-200 rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full max-h-40 object-contain bg-gray-50" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 bg-white border border-gray-200 rounded-full w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-300 text-xs shadow-sm transition"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-all group"
        >
          <div className="w-10 h-10 bg-gray-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 transition">
            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 group-hover:text-blue-600">사진을 선택하거나 촬영하세요</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP, HEIC · 최대 10MB</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────

export default function CruiseDotPartnersPage() {
  const [step, setStep] = useState<Step>('form');
  const [resultId, setResultId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [contractExpanded, setContractExpanded] = useState(false);
  const [contractRead, setContractRead] = useState(false);

  // 신청자 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [residentId, setResidentId] = useState('');

  // 정산 계좌
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankBookPhoto, setBankBookPhoto] = useState<string | null>(null);

  // 신분증
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  // 담당 대리점장
  const [useSupervisor, setUseSupervisor] = useState(false);
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorAgency, setSupervisorAgency] = useState('');
  const [supervisorPhone, setSupervisorPhone] = useState('');

  // 서명
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signName, setSignName] = useState('');

  // 동의
  const [consents, setConsents] = useState({
    privacy: false,      // 개인정보 처리 동의
    contract: false,     // 계약서 전체 내용 확인 및 동의
    commission: false,   // 수수료 및 정산 조건 동의
    autoTerminate: false, // 자동해지 조건 동의
    brandProtect: false, // 해지 후 브랜드보호 / 콘텐츠보호 동의
  });

  const allConsents = Object.values(consents).every(Boolean);
  const contractBody = getContractBody({
    name, phone, address, residentId,
    supervisorName, supervisorAgency, supervisorPhone, useSupervisor,
  });

  const setConsent = (key: keyof typeof consents) => (checked: boolean) => {
    setConsents((prev) => ({ ...prev, [key]: checked }));
  };

  const handleAllConsent = (checked: boolean) => {
    setConsents({
      privacy: checked,
      contract: checked,
      commission: checked,
      autoTerminate: checked,
      brandProtect: checked,
    });
  };

  const handleContractScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      setContractRead(true);
    }
  };

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
    if (!signatureDataUrl && !signName.trim()) {
      setErrorMsg('서명 또는 성명을 입력해 주세요.');
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
          residentId: residentId.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankAccount: bankAccount.trim() || undefined,
          bankAccountHolder: bankAccountHolder.trim() || undefined,
          signatureImageUrl: signatureDataUrl || undefined,
          consentPrivacy: true,
          consentNonCompete: true,
          consentDbUse: true,
          consentPenalty: true,
          consentRefund: true,
          metadata: {
            type: 'CRUISE_PARTNER',
            signName: signName.trim() || undefined,
            idPhotoUrl: idPhoto || undefined,
            bankBookUrl: bankBookPhoto || undefined,
            supervisorName: useSupervisor ? supervisorName.trim() : undefined,
            supervisorAgency: useSupervisor ? supervisorAgency.trim() : undefined,
            supervisorPhone: useSupervisor ? supervisorPhone.trim() : undefined,
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

  // ── 완료 화면 ───────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">신청 완료!</h1>
            <p className="text-gray-500 mt-2 text-sm">담당자가 확인 후 연락드리겠습니다.</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-left space-y-2">
            <p className="text-blue-700 font-semibold">신청 정보</p>
            <div className="text-gray-700 space-y-1">
              <p>• 구분: 크루즈닷 파트너스 가입 신청</p>
              <p>• 이름: {name}</p>
              {resultId && <p>• 신청번호: #{resultId}</p>}
            </div>
          </div>
          <p className="text-xs text-gray-400">문의: {COMPANY.phone}</p>
        </div>
      </div>
    );
  }

  // ── 신청서 폼 ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image
              src={COMPANY.logo}
              alt="크루즈닷 파트너스"
              fill
              className="object-contain"
              onError={() => {}}
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">크루즈닷 파트너스</h1>
            <p className="text-xs text-gray-500">프리랜서 용역 계약 신청서</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-6 space-y-5">

        {/* 안내 배너 */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 relative flex-shrink-0 mt-0.5">
              <Image
                src={COMPANY.logo}
                alt="크루즈닷"
                fill
                className="object-contain brightness-200"
                onError={() => {}}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">크루즈닷 파트너스 신청</h2>
              <p className="text-blue-100 text-sm leading-relaxed">
                크루즈닷 파트너스로 활동하시면 크루즈 상품 홍보·판매 수수료(1~5%)를 받으실 수 있습니다.<br />
                가입비·보증금 없음. 타사 영업 가능.
              </p>
            </div>
          </div>
        </div>

        {/* ① 신청자 정보 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-700 px-6 py-4">
            <h2 className="text-white font-bold text-base">① 신청자 정보</h2>
          </div>
          <div className="p-5 space-y-4">
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="서울특별시 ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주민등록번호</label>
              <input
                type="text"
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                placeholder="000000-0000000"
                maxLength={14}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">정산 및 프리랜서 용역 소득세 신고 목적으로만 사용됩니다.</p>
            </div>
          </div>
        </section>

        {/* ② 정산 계좌 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-indigo-700 px-6 py-4">
            <h2 className="text-white font-bold text-base">② 정산 계좌</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">은행명</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="국민은행"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="000000-00-000000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
              />
            </div>
            <FileUpload
              label="통장 사본 사진"
              hint="통장 앞면 전체가 보이도록 촬영해 주세요"
              onChange={setBankBookPhoto}
              preview={bankBookPhoto}
            />
          </div>
        </section>

        {/* ③ 신분증 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-slate-700 px-6 py-4">
            <h2 className="text-white font-bold text-base">③ 본인 확인</h2>
          </div>
          <div className="p-5">
            <FileUpload
              label="신분증 사진"
              hint="주민등록증 또는 운전면허증 · 이름·주민번호·사진이 모두 보이도록 촬영해 주세요"
              onChange={setIdPhoto}
              preview={idPhoto}
            />
          </div>
        </section>

        {/* ④ 담당 대리점장 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-teal-700 px-6 py-4">
            <h2 className="text-white font-bold text-base">④ 담당 대리점장</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUseSupervisor(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  !useSupervisor
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                }`}
              >
                본사 직속
              </button>
              <button
                type="button"
                onClick={() => setUseSupervisor(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  useSupervisor
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                }`}
              >
                대리점장 소개
              </button>
            </div>

            {!useSupervisor && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800">
                <p className="font-medium">본사 직속으로 가입됩니다.</p>
                <p className="text-teal-600 text-xs mt-1">문의: {COMPANY.phone}</p>
              </div>
            )}

            {useSupervisor && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">대리점장 이름</label>
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">대리점명</label>
                  <input
                    type="text"
                    value={supervisorAgency}
                    onChange={(e) => setSupervisorAgency(e.target.value)}
                    placeholder="OO 대리점"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">대리점장 연락처</label>
                  <input
                    type="tel"
                    value={supervisorPhone}
                    onChange={(e) => setSupervisorPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ⑤ 계약서 확인 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
            <h2 className="text-white font-bold text-base">⑤ 계약서 확인</h2>
            {contractRead && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">확인 완료</span>
            )}
          </div>

          {!contractExpanded ? (
            <div className="p-5">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-2">
                <p className="font-semibold text-gray-800">크루즈닷 파트너스 프리랜서 용역계약서</p>
                <ul className="text-xs space-y-1 text-gray-500">
                  <li>• 제3조 타사 영업 허용</li>
                  <li>• 제4조 콘텐츠 보호 및 무단도용 금지 (위약벌 건당 300만원~)</li>
                  <li>• 제5조 5개월 무매출 시 자동 해지</li>
                  <li>• 제6조 수수료 1~5%</li>
                  <li>• 제7조 해지 후 2년 브랜드보호 의무</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setContractExpanded(true)}
                className="mt-4 w-full py-3 bg-gray-800 text-white rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors"
              >
                계약서 전체 내용 확인하기
              </button>
            </div>
          ) : (
            <div className="p-4">
              {/* 계약서 본문 */}
              <div
                className="h-80 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-4"
                onScroll={handleContractScroll}
              >
                {/* 로고 + 도장 영역 */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="relative w-24 h-12">
                    <Image
                      src={COMPANY.logo}
                      alt="크루즈닷 파트너스"
                      fill
                      className="object-contain"
                      onError={() => {}}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="relative w-14 h-14 opacity-70">
                      <Image
                        src={COMPANY.cruiseStamp}
                        alt="크루즈닷 도장"
                        fill
                        className="object-contain"
                        onError={() => {}}
                      />
                    </div>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono leading-relaxed">
                  {contractBody}
                </pre>
                {/* 서명 미리보기 영역 */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-end">
                  <div className="text-xs text-gray-500">
                    <p>갑: 크루즈닷 배연성</p>
                    <div className="relative w-16 h-16 mt-1 opacity-80">
                      <Image
                        src={COMPANY.stamp}
                        alt="배연성 도장"
                        fill
                        className="object-contain"
                        onError={() => {}}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <p>을: {name || '___________'}</p>
                    {signatureDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signatureDataUrl} alt="서명" className="w-20 h-10 object-contain mt-1 border border-dashed border-gray-300 rounded" />
                    )}
                  </div>
                </div>
              </div>
              {!contractRead && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  스크롤하여 계약서 전체를 읽어주세요
                </p>
              )}
              {contractRead && (
                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer p-3 bg-green-50 border border-green-200 rounded-xl">
                    <input
                      type="checkbox"
                      checked={consents.contract}
                      onChange={(e) => setConsent('contract')(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-green-800">
                      계약서 전체 내용을 읽고 이해하였으며 동의합니다.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ⑥ 필수 동의 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-orange-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">⑥ 필수 동의</h2>
          </div>
          <div className="p-5 space-y-3">
            {/* 전체 동의 */}
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <input
                type="checkbox"
                checked={allConsents}
                onChange={(e) => handleAllConsent(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
              <span className="text-sm font-bold text-orange-800">전체 동의</span>
            </label>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {[
                {
                  key: 'privacy' as const,
                  title: '개인정보 처리 동의 (필수)',
                  desc: '수집 항목: 이름·연락처·주민번호·계좌·사진 · 목적: 파트너 계약 및 정산 · 보유: 계약 종료 후 5년',
                },
                {
                  key: 'commission' as const,
                  title: '수수료 및 정산 조건 동의 (필수)',
                  desc: '판매 금액의 1~5% 수수료, 익월 15일 이내 정산 조건에 동의합니다.',
                },
                {
                  key: 'autoTerminate' as const,
                  title: '자동해지 조건 동의 (필수)',
                  desc: '연속 5개월 무매출 시 별도 통보 없이 계약이 자동 해지됨에 동의합니다.',
                },
                {
                  key: 'brandProtect' as const,
                  title: '브랜드보호 및 콘텐츠 보호 동의 (필수)',
                  desc: '계약 해지 후 2년간 브랜드 보호 의무 준수, 콘텐츠 무단 도용 시 건당 300만원 위약벌에 동의합니다.',
                },
              ].map((item) => (
                <label key={item.key} className="flex items-start gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={consents[item.key]}
                    onChange={(e) => setConsent(item.key)(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* ⑦ 서명 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-purple-700 px-6 py-4">
            <h2 className="text-white font-bold text-base">⑦ 서명</h2>
          </div>
          <div className="p-5 space-y-5">
            {/* 서명 캔버스 */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">직접 서명</p>
              <SignatureCanvas onSigned={setSignatureDataUrl} />
            </div>

            {/* 성명 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성명 (인쇄체)</label>
              <input
                type="text"
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
                placeholder="홍길동"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>

            {/* 도장 미리보기 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">갑 (크루즈닷)</p>
                <div className="relative w-16 h-16 mx-auto">
                  <Image
                    src={COMPANY.stamp}
                    alt="배연성 도장"
                    fill
                    className="object-contain"
                    onError={() => {}}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">갑 (회사 도장)</p>
                <div className="relative w-16 h-16 mx-auto">
                  <Image
                    src={COMPANY.cruiseStamp}
                    alt="크루즈닷 도장"
                    fill
                    className="object-contain"
                    onError={() => {}}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">을 (신청자)</p>
                {signatureDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureDataUrl} alt="서명" className="w-20 h-16 object-contain border border-dashed border-gray-300 rounded mx-auto" />
                ) : (
                  <div className="w-20 h-16 border-2 border-dashed border-gray-300 rounded mx-auto flex items-center justify-center">
                    <span className="text-xs text-gray-300">서명란</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-blue-700 text-white rounded-2xl font-bold text-base hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
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
            '크루즈닷 파트너스 가입 신청'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          제출 후 담당자가 확인하여 연락드립니다 · {COMPANY.phone}
        </p>
      </form>
    </div>
  );
}
