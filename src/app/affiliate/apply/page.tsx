'use client';

/**
 * /affiliate/apply — 대리점/판매원 계약 신청서 (공개 페이지)
 *
 * 등급:
 *   330만원 → 판매원 (SALES_AGENT)
 *   540만원 → 판매원 프리미엄 (SALES_AGENT)
 *   750만원 → 대리점 (BRANCH_MANAGER)
 *
 * 입력 항목:
 *   개인정보(이름/연락처/이메일/주소/주민번호) +
 *   정산계좌(은행/계좌번호/예금주) +
 *   서명(캔버스) + 도장(이미지 업로드) +
 *   필수 동의 5개
 */

import { useRef, useState, useEffect } from 'react';
import { CheckCircle, Loader2, PenLine, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { CONTRACT_PRICE_TIERS, type PriceTierKey } from '@/lib/affiliate/priceTiers';

// ── 동의 항목 정의 ───────────────────────────────────────────
const CONSENTS = [
  {
    key: 'consentPrivacy' as const,
    label: '개인정보 처리 동의 (필수)',
    detail:
      '수집한 개인정보(성명, 연락처, 주민번호, 계좌정보)는 계약 체결 및 수수료 정산 목적으로만 활용되며, 계약 종료 후 5년간 보관 후 파기합니다.',
  },
  {
    key: 'consentNonCompete' as const,
    label: '경업금지 조항 동의 (필수)',
    detail:
      '계약 기간 및 계약 종료 후 1년간 동종 크루즈 판매업에 종사하거나 유사 서비스를 운영하지 않을 것에 동의합니다.',
  },
  {
    key: 'consentDbUse' as const,
    label: 'DB 활용 동의 (필수)',
    detail:
      '회사가 제공하는 고객 DB 및 마케팅 자료는 계약 목적의 영업 활동에만 활용하며, 제3자에게 유출하지 않을 것에 동의합니다.',
  },
  {
    key: 'consentPenalty' as const,
    label: '위약금 조항 동의 (필수)',
    detail:
      '계약 위반 시 계약금의 2배에 해당하는 위약금이 발생할 수 있음을 인지하고 동의합니다.',
  },
  {
    key: 'consentRefund' as const,
    label: '환불 정책 동의 (필수)',
    detail:
      '계약 체결 후 7일 이내에 환불 요청 가능하며, 이후에는 원칙적으로 환불이 불가합니다.',
  },
] as const;

type ConsentKey = (typeof CONSENTS)[number]['key'];

// ── 서명 캔버스 ──────────────────────────────────────────────
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawing(true);
    onChange(canvas.toDataURL());
  }

  function endDraw() {
    drawing.current = false;
    lastPos.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-32 cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-gray-400 flex items-center gap-1.5">
              <PenLine className="w-4 h-4" />
              여기에 서명하세요
            </p>
          </div>
        )}
      </div>
      {hasDrawing && (
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
        >
          <Trash2 className="w-3 h-3" />
          서명 지우기
        </button>
      )}
    </div>
  );
}

// ── 도장 업로드 ─────────────────────────────────────────────
function StampUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-28 h-28 border-2 border-gray-300 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
          <img src={value} alt="도장" className="max-w-full max-h-full object-contain p-1" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 bg-white rounded-full p-0.5 text-red-500 hover:text-red-700 shadow"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-28 h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
          <Upload className="w-5 h-5 text-gray-400 mb-1" />
          <span className="text-xs text-gray-400 text-center leading-tight">
            도장 이미지<br />업로드
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
      <p className="text-xs text-gray-400">PNG/JPG, 도장 또는 서명 날인</p>
    </div>
  );
}

// ── 동의 항목 ────────────────────────────────────────────────
function ConsentItem({
  item,
  checked,
  onChange,
}: {
  item: (typeof CONSENTS)[number];
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border p-3 transition-colors ${checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
            checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
          }`}
        >
          {checked && <Check className="w-3 h-3 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm font-medium cursor-pointer ${checked ? 'text-blue-800' : 'text-gray-700'}`}
              onClick={() => onChange(!checked)}
            >
              {item.label}
            </span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          {open && (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">{item.detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function AffiliateApplyPage() {
  const [step, setStep] = useState<'form' | 'done'>('form');

  // 등급 선택
  const [tier, setTier] = useState<PriceTierKey>('SALES_330');

  // 개인 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [residentId, setResidentId] = useState('');

  // 정산 계좌
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');

  // 서명 / 도장
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [stampDataUrl, setStampDataUrl] = useState<string | null>(null);

  // 동의
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    consentPrivacy: false,
    consentNonCompete: false,
    consentDbUse: false,
    consentPenalty: false,
    consentRefund: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTier = CONTRACT_PRICE_TIERS[tier];
  const allConsented = Object.values(consents).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError('이름과 연락처는 필수입니다.');
      return;
    }
    if (!allConsented) {
      setError('모든 필수 동의 항목에 체크해 주세요.');
      return;
    }
    if (!signatureDataUrl) {
      setError('서명을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
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
          signatureImageUrl: signatureDataUrl,
          stampImageUrl: stampDataUrl || undefined,
          tierKey: tier,
          amount: selectedTier.priceKRW,
          ...consents,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? '오류가 발생했습니다.');
        return;
      }
      setStep('done');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-5">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">신청이 완료되었습니다</h1>
          <div className="bg-blue-50 rounded-xl p-4 text-left space-y-1.5">
            <p className="text-sm font-semibold text-blue-800">신청 등급: {selectedTier.label}</p>
            <p className="text-sm text-blue-700">계약금: {selectedTier.priceKRW.toLocaleString()}원</p>
            <p className="text-sm text-blue-700">수수료: {selectedTier.commissionRate}%</p>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            담당자가 확인 후 입력하신 연락처로 연락드리겠습니다.<br />
            보통 1~2 영업일 내로 안내드립니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-1 pt-2">
          <h1 className="text-2xl font-bold text-gray-900">대리점 · 판매원 계약 신청</h1>
          <p className="text-sm text-gray-500">아래 계약서를 작성하신 후 제출하시면 담당자가 연락드립니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ① 등급 선택 */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-800">① 계약 등급 선택</h2>
            <div className="grid grid-cols-1 gap-3">
              {(Object.entries(CONTRACT_PRICE_TIERS) as [PriceTierKey, typeof CONTRACT_PRICE_TIERS[PriceTierKey]][]).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTier(key)}
                  className={`flex items-start justify-between p-4 rounded-xl border-2 text-left transition-all ${
                    tier === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <div className={`font-semibold text-sm ${tier === key ? 'text-blue-800' : 'text-gray-900'}`}>
                      {t.label}
                      <span className="ml-2 text-xs font-normal text-gray-500">{t.description}</span>
                    </div>
                    <div className={`text-xs mt-0.5 ${t.memberType === 'BRANCH_MANAGER' ? 'text-purple-600' : 'text-green-600'} font-medium`}>
                      {t.memberType === 'BRANCH_MANAGER' ? '🏢 대리점장 계정 발급' : '👤 판매원 계정 발급'}
                    </div>
                  </div>
                  <div className={`text-lg font-bold shrink-0 ml-3 ${tier === key ? 'text-blue-700' : 'text-gray-700'}`}>
                    {(t.priceKRW / 10_000).toLocaleString()}만원
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ② 계약자 정보 */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-800">② 계약자 정보</h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="성명" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  className={INPUT}
                />
              </Field>
              <Field label="연락처" required>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  required
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label="이메일">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hong@example.com"
                className={INPUT}
              />
            </Field>

            <Field label="주소">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="서울시 강남구 …"
                className={INPUT}
              />
            </Field>

            <Field label="주민등록번호">
              <input
                type="text"
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                placeholder="000000-0000000"
                maxLength={14}
                className={INPUT}
              />
              <p className="text-xs text-gray-400 mt-1">원천징수 신고 목적으로만 사용됩니다.</p>
            </Field>
          </section>

          {/* ③ 정산 계좌 */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-800">③ 정산 계좌 정보</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="은행명">
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="국민은행"
                  className={INPUT}
                />
              </Field>
              <Field label="예금주">
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="홍길동"
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label="계좌번호">
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="123-456-789012"
                className={INPUT}
              />
            </Field>
          </section>

          {/* ④ 필수 동의 */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">④ 필수 동의 항목</h2>
              <button
                type="button"
                onClick={() => {
                  const allChecked = Object.values(consents).every(Boolean);
                  setConsents(Object.fromEntries(
                    CONSENTS.map((c) => [c.key, !allChecked])
                  ) as Record<ConsentKey, boolean>);
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                {Object.values(consents).every(Boolean) ? '전체 해제' : '전체 동의'}
              </button>
            </div>
            <div className="space-y-2">
              {CONSENTS.map((item) => (
                <ConsentItem
                  key={item.key}
                  item={item}
                  checked={consents[item.key]}
                  onChange={(v) => setConsents((prev) => ({ ...prev, [item.key]: v }))}
                />
              ))}
            </div>
          </section>

          {/* ⑤ 서명 & 도장 */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-800">⑤ 서명 &amp; 도장 <span className="text-red-500">*</span></h2>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">서명 (마우스 또는 손가락으로 직접 서명)</label>
              <SignaturePad onChange={setSignatureDataUrl} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">도장 (선택 — 도장 이미지 파일 업로드)</label>
              <StampUpload value={stampDataUrl} onChange={setStampDataUrl} />
            </div>
          </section>

          {/* 에러 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 제출 요약 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-blue-800">신청 내용 확인</p>
            <p className="text-blue-700">등급: {selectedTier.label} ({selectedTier.priceKRW.toLocaleString()}원)</p>
            <p className="text-blue-700">역할: {selectedTier.memberType === 'BRANCH_MANAGER' ? '대리점장' : '판매원'} 계정 자동 생성</p>
            <p className="text-blue-700">수수료: {selectedTier.commissionRate}%</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            계약 신청서 제출
          </button>

          <p className="text-xs text-center text-gray-400 pb-4">
            입력하신 정보는 계약 체결 및 수수료 정산 목적으로만 사용됩니다.
          </p>
        </form>
      </div>
    </div>
  );
}

const INPUT =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
