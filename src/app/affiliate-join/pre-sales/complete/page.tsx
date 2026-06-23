'use client';

/**
 * /affiliate/pre-sales/complete?token=XXXXX
 * 승인 후 이메일 링크로 접속 → 주민번호/통장/신분증/서명 수집 (2단계)
 */

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

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
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-sm text-gray-300 pointer-events-none select-none">
          서명란
        </div>
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="text-sm text-gray-600 hover:text-red-500 transition-colors"
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
  securityNote?: string;
  onChange: (dataUrl: string | null) => void;
  preview: string | null;
}

function FileUpload({ label, required, hint, securityNote, onChange, preview }: FileUploadProps) {
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
      {hint && <p className="text-sm text-gray-500 mb-1.5">{hint}</p>}
      {preview ? (
        <div className="relative border border-gray-200 rounded-xl overflow-hidden">
          <Image src={preview} alt={label} width={600} height={160} className="w-full max-h-40 object-contain bg-gray-50" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 bg-white border border-gray-200 rounded-full w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-300 text-sm shadow-sm transition"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-5 text-center hover:border-blue-400 hover:bg-blue-50 transition-all group"
        >
          <div className="w-10 h-10 bg-gray-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 transition">
            <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 group-hover:text-blue-600">사진을 선택하거나 촬영하세요</p>
          <p className="text-sm text-gray-600 mt-1">JPG, PNG, WEBP, HEIC · 최대 10MB</p>
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
      {securityNote && (
        <div className="mt-2 flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm text-slate-500 leading-relaxed">{securityNote}</p>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 (내부) ─────────────────────────────────────────────

type PageState = 'loading' | 'error' | 'form' | 'success';

function CompleteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [contractName, setContractName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // 정산 계좌
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankBookPhoto, setBankBookPhoto] = useState<string | null>(null);

  // 본인 확인
  const [residentId, setResidentId] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  // 서명
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signName, setSignName] = useState('');

  // 토큰으로 계약 정보 조회
  useEffect(() => {
    if (!token) {
      setPageState('error');
      setErrorMsg('유효하지 않은 링크입니다.');
      return;
    }

    fetch(`/api/affiliate/contracts/complete?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setContractName(data.data.name);
          setPageState('form');
        } else {
          setPageState('error');
          setErrorMsg(data.message || '유효하지 않은 링크입니다.');
        }
      })
      .catch(() => {
        setPageState('error');
        setErrorMsg('네트워크 오류가 발생했습니다.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!bankName.trim()) {
      setSubmitError('은행명을 입력해 주세요.');
      return;
    }
    if (!bankAccountHolder.trim()) {
      setSubmitError('예금주를 입력해 주세요.');
      return;
    }
    if (!bankAccount.trim()) {
      setSubmitError('계좌번호를 입력해 주세요.');
      return;
    }
    if (!bankBookPhoto) {
      setSubmitError('통장 사본 사진을 업로드해 주세요.');
      return;
    }
    if (!residentId.trim()) {
      setSubmitError('주민등록번호를 입력해 주세요.');
      return;
    }
    if (!idPhoto) {
      setSubmitError('신분증 사진을 업로드해 주세요.');
      return;
    }
    if (!signatureDataUrl && !signName.trim()) {
      setSubmitError('서명 또는 성명을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/contracts/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          bankName: bankName.trim(),
          bankAccount: bankAccount.trim(),
          bankAccountHolder: bankAccountHolder.trim(),
          bankBookUrl: bankBookPhoto,
          residentId: residentId.trim(),
          idPhotoUrl: idPhoto,
          signatureImageUrl: signatureDataUrl || undefined,
          signName: signName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSubmitError(data.message || '오류가 발생했습니다.');
        return;
      }
      setPageState('success');
    } catch {
      setSubmitError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 로딩 화면 ────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">확인 중...</p>
        </div>
      </div>
    );
  }

  // ── 에러 화면 ────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">링크 오류</h1>
            <p className="text-gray-500 mt-2 text-sm">{errorMsg}</p>
          </div>
          <p className="text-sm text-gray-600">문의: 010-3289-3800</p>
        </div>
      </div>
    );
  }

  // ── 성공 화면 ────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">서류 제출 완료!</h1>
            <p className="text-gray-500 mt-2 text-sm">
              담당자가 확인 후 최종 아이디·비밀번호를 이메일로 발송해 드립니다.
            </p>
          </div>
          <p className="text-sm text-gray-600">문의: 010-3289-3800</p>
        </div>
      </div>
    );
  }

  // ── 서류 제출 폼 ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 환영 헤더 */}
      <div className="bg-blue-700 px-4 py-6 text-center">
        <div className="max-w-xl mx-auto space-y-1">
          <p className="text-blue-100 text-sm font-medium">크루즈닷 파트너스</p>
          <h1 className="text-white text-2xl font-extrabold">
            🎉 {contractName}님, 승인되었습니다!
          </h1>
          <p className="text-blue-100 text-sm mt-2">
            아래 서류를 제출하면 계약이 완료됩니다.<br />
            이후 아이디·비밀번호가 최종 발급됩니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-6 space-y-5">

        {/* ① 정산 계좌 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-indigo-700 px-5 py-3.5">
            <h2 className="text-white font-bold text-sm">① 정산 계좌</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 leading-relaxed">
              수수료 정산 및 소득세 신고 목적으로만 사용됩니다. 인가된 담당자만 열람 가능합니다.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  은행명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="국민은행"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예금주 <span className="text-red-500">*</span>
                </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                계좌번호 <span className="text-red-500">*</span>
              </label>
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
              required
              hint="통장 앞면 전체가 보이도록 촬영해 주세요 (계좌번호·예금주 명확히 보이게)"
              securityNote="본 서류는 수수료 정산 및 「소득세법」상 원천징수 신고 목적으로만 수집됩니다. 「개인정보 보호법」 제29조에 따른 안전성 확보 조치가 적용되며, 인가된 담당자만 열람 가능합니다."
              onChange={setBankBookPhoto}
              preview={bankBookPhoto}
            />
          </div>
        </section>

        {/* ② 본인 확인 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-slate-700 px-5 py-3.5">
            <h2 className="text-white font-bold text-sm">② 본인 확인</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-sm font-semibold text-amber-800">법적 본인인증 필수 서류</p>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">
                반려 또는 계약 미체결 시 즉시 파기합니다.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주민등록번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                placeholder="000000-0000000"
                maxLength={14}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none font-mono"
              />
              <div className="mt-1.5 flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700 leading-relaxed">
                  프리랜서 용역 소득세 신고(원천징수) 목적으로만 수집됩니다. (소득세법 제145조)
                </p>
              </div>
            </div>
            <FileUpload
              label="신분증 사진"
              required
              hint="주민등록증 또는 운전면허증 · 이름·주민번호·사진이 모두 보이도록 촬영"
              securityNote="본 서류는 인가된 담당자만 열람 가능하며 「개인정보 보호법」에 따라 관리됩니다. 반려 시 즉시 파기됩니다."
              onChange={setIdPhoto}
              preview={idPhoto}
            />
          </div>
        </section>

        {/* ③ 서명 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-purple-700 px-5 py-3.5">
            <h2 className="text-white font-bold text-sm">③ 서명</h2>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">직접 서명</p>
              <SignatureCanvas onSigned={setSignatureDataUrl} />
            </div>
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
            {signatureDataUrl && (
              <div className="flex justify-end">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1.5">을 ({contractName})</p>
                  <Image src={signatureDataUrl} alt="서명" width={80} height={56} className="w-20 h-14 object-contain border border-dashed border-gray-300 rounded mx-auto" />
                </div>
              </div>
            )}
          </div>
        </section>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{submitError}</div>
        )}

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
          ) : '계약 서류 제출'}
        </button>

        <p className="text-center text-sm text-gray-600 pb-4">
          문의: 010-3289-3800
        </p>
      </form>
    </div>
  );
}

// ── Suspense 래퍼 (useSearchParams 요구사항) ──────────────────────────

export default function CompleteContractPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    }>
      <CompleteForm />
    </Suspense>
  );
}
