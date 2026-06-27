'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';

type ContractInfo = {
  name: string;
  phone: string;
  email: string | null;
  tierKey: string | null;
  tierLabel: string | null;
  expiresAt: string | null;
};

export default function AffiliateSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<ContractInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    email: '', address: '', residentId: '',
    bankName: '', bankAccount: '', bankAccountHolder: '',
  });
  const [consents, setConsents] = useState({
    consentPrivacy: false, consentNonCompete: false, consentDbUse: false,
    consentPenalty: false, consentRefund: false,
  });
  const [err, setErr] = useState<string | null>(null);

  // ── 계약 정보 로드 ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/public/affiliate-sign/${token}`);
        const data = await res.json();
        if (!alive) return;
        if (data.ok) {
          setInfo(data.contract);
          setForm((f) => ({ ...f, email: data.contract.email ?? '' }));
        } else {
          setLoadError(data.message ?? '링크를 확인할 수 없습니다.');
        }
      } catch {
        if (alive) setLoadError('네트워크 오류가 발생했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  // ── 서명 캔버스 ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();
    hasInk.current = true;
  };
  const end = () => { drawing.current = false; };
  const clearSig = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  };

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const allConsent = Object.values(consents).every(Boolean);

  const submit = useCallback(async () => {
    setErr(null);
    if (!hasInk.current) { setErr('서명을 해주세요.'); return; }
    if (!allConsent) { setErr('필수 동의 항목에 모두 체크해주세요.'); return; }
    setSubmitting(true);
    try {
      const signatureImageUrl = canvasRef.current!.toDataURL('image/png');
      const res = await fetch(`/api/public/affiliate-sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...consents, signatureImageUrl }),
      });
      const data = await res.json();
      if (data.ok) setDone(true);
      else setErr(data.message ?? '제출에 실패했습니다.');
    } catch {
      setErr('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [token, form, consents, allConsent]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">불러오는 중…</div>;
  }
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-xl font-bold text-gray-800 mb-2">링크를 열 수 없습니다</p>
          <p className="text-base text-gray-600">{loadError}</p>
        </div>
      </div>
    );
  }
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-6xl mb-4">✅</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">제출 완료</p>
          <p className="text-base text-gray-600">계약서가 제출되었습니다. 검토 후 담당자가 안내드립니다.</p>
        </div>
      </div>
    );
  }

  const label = 'block text-sm font-semibold text-gray-800 mb-1';
  const input = 'w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">(주)마비즈컴퍼니 교육·시스템 지원 계약</h1>
          {info?.tierLabel && <p className="mt-1 text-base text-blue-700 font-semibold">{info.tierLabel} 계약</p>}
          <p className="mt-1 text-sm text-gray-500">{info?.name} 님 ({info?.phone})</p>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          아래 정보를 입력하고 서명하시면 계약서가 제출됩니다. 입력하신 내용은 안전하게 보관됩니다.
        </div>

        <div className="space-y-3">
          <div>
            <label className={label}>이메일</label>
            <input className={input} type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="example@email.com" />
          </div>
          <div>
            <label className={label}>주소</label>
            <input className={input} value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="도로명 주소" />
          </div>
          <div>
            <label className={label}>주민등록번호</label>
            <input className={input} value={form.residentId} onChange={(e) => setField('residentId', e.target.value)} placeholder="000000-0000000" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={label}>은행</label><input className={input} value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} /></div>
            <div className="col-span-2"><label className={label}>계좌번호</label><input className={input} value={form.bankAccount} onChange={(e) => setField('bankAccount', e.target.value)} /></div>
          </div>
          <div><label className={label}>예금주</label><input className={input} value={form.bankAccountHolder} onChange={(e) => setField('bankAccountHolder', e.target.value)} /></div>
        </div>

        {/* 동의 */}
        <div className="space-y-2 rounded-lg bg-gray-50 border border-gray-200 p-3">
          {[
            ['consentPrivacy', '개인정보 수집·이용에 동의합니다 (필수)'],
            ['consentDbUse', '고객 데이터 활용 정책에 동의합니다 (필수)'],
            ['consentNonCompete', '경업금지·영업비밀 보호 조항에 동의합니다 (필수)'],
            ['consentPenalty', '콘텐츠·브랜드 보호 및 위약 조항에 동의합니다 (필수)'],
            ['consentRefund', '교육 환불 규정에 동의합니다 (필수)'],
          ].map(([k, t]) => (
            <label key={k} className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 w-5 h-5" checked={consents[k as keyof typeof consents]}
                onChange={(e) => setConsents((c) => ({ ...c, [k]: e.target.checked }))} />
              <span>{t}</span>
            </label>
          ))}
        </div>

        {/* 서명 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={label}>서명</label>
            <button type="button" onClick={clearSig} className="text-sm text-gray-500 underline">지우기</button>
          </div>
          <canvas
            ref={canvasRef} width={520} height={180}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none"
            onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
          />
        </div>

        {err && <p className="text-sm text-red-600 font-medium">{err}</p>}

        <button type="button" onClick={submit} disabled={submitting}
          className="w-full h-14 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
          {submitting ? '제출 중…' : '서명하고 제출하기'}
        </button>
      </div>
    </div>
  );
}
