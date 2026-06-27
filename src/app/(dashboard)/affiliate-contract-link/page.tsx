'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const TIERS = [
  { key: 'SALES_330', label: '마케터 (330만원)' },
  { key: 'SALES_540', label: '대리점장1 (540만원)' },
  { key: 'BRANCH_750', label: '대리점장2 / 지사 (750만원)' },
] as const;

export default function AffiliateContractLinkPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) { router.replace('/'); return; }
        const ctx = await res.json();
        if (ctx.role !== 'GLOBAL_ADMIN') { router.replace('/'); return; }
        setAuthChecked(true);
      } catch { router.replace('/'); }
    })();
  }, [router]);

  const [form, setForm] = useState({ name: '', phone: '', email: '', tierKey: 'BRANCH_750' });
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState<{ signUrl: string; expiresAt: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const issue = async () => {
    setErr(null); setResult(null);
    if (!form.name.trim() || !form.phone.trim()) { setErr('이름과 연락처는 필수입니다.'); return; }
    setIssuing(true);
    try {
      const res = await fetch('/api/affiliate/contracts/issue-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) setResult({ signUrl: data.signUrl, expiresAt: data.expiresAt });
      else setErr(data.message ?? '발급에 실패했습니다.');
    } catch {
      setErr('네트워크 오류가 발생했습니다.');
    } finally {
      setIssuing(false);
    }
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.signUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // clipboard 미지원/거부 — 수동 복사 안내
      window.prompt('아래 링크를 복사하세요:', result.signUrl);
    });
  };

  if (!authChecked) return <div className="p-8 text-gray-500">확인 중…</div>;

  const label = 'block text-sm font-semibold text-gray-800 mb-1';
  const input = 'w-full h-12 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">계약서 링크 발급</h1>
        <p className="mt-1 text-base text-gray-600">계약 대상에게 보낼 서명 링크를 만듭니다. 대상이 링크에서 정보등록·서명하면 보관됩니다.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div>
          <label className={label}>이름 <span className="text-red-500">*</span></label>
          <input className={input} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 홍길동" />
        </div>
        <div>
          <label className={label}>연락처 <span className="text-red-500">*</span></label>
          <input className={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
        </div>
        <div>
          <label className={label}>이메일 (선택)</label>
          <input className={input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="example@email.com" />
        </div>
        <div>
          <label className={label}>계약 등급</label>
          <select className={input} value={form.tierKey} onChange={(e) => set('tierKey', e.target.value)}>
            {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        {err && <p className="text-sm text-red-600 font-medium">{err}</p>}

        <button type="button" onClick={issue} disabled={issuing}
          className="w-full h-14 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
          {issuing ? '발급 중…' : '서명 링크 발급하기'}
        </button>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
          <p className="text-base font-bold text-green-800">✅ 링크가 발급되었습니다</p>
          <div className="flex items-center gap-2">
            <input readOnly value={result.signUrl} className="flex-1 h-12 px-3 border border-green-300 rounded-lg text-sm bg-white" />
            <button onClick={copy} className="h-12 px-4 bg-green-600 text-white rounded-lg font-semibold whitespace-nowrap">
              {copied ? '복사됨!' : '링크 복사'}
            </button>
          </div>
          <p className="text-sm text-gray-600">이 링크를 대상에게 문자/카톡으로 보내세요. 유효기간: {new Date(result.expiresAt).toLocaleDateString('ko-KR')}까지</p>
        </div>
      )}
    </div>
  );
}
