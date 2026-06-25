'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CARD_FEE_RATE } from '@/lib/constants/affiliate';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function fmt(n: number): string { return Math.round(n).toLocaleString('ko-KR'); }
function pct(n: number, digits = 1): string { return n.toFixed(digits); }
function cls(n: number): string { return n < 0 ? 'text-red-600 font-bold' : 'text-slate-900 font-bold'; }

// ─── 타입 ────────────────────────────────────────────────────────────────────

type InputMode = 'pct' | 'amount';

// DB에서 오는 저장 항목 (Neon → API → 프론트엔드)
interface SavedCalc {
  id: string;
  title: string;
  savedAt: string;
  salePrice: number;
  costPrice: number;
  agentMode: string;
  agentPct: number;
  agentAmt: number;
  memberMode: string;
  memberPct: number;
  memberAmt: number;
  freeAmt: number;
  freePct: number;
  overridingAmt: number;
  overridingPct: number;
  snapshotSale: number;
  snapshotNetProfit: number;
  snapshotHqProfit: number;
  exchangeRateSnapshot: number | null;
}

// ─── 재사용 입력 컴포넌트 ──────────────────────────────────────────────────────

function DualInput({
  label, labelWidth = 'w-28',
  krwValue, krwPlaceholder = '0', onKrwChange, krwActive = true,
  usdValue, onUsdChange, rateReady,
  suffix,
}: {
  label: string; labelWidth?: string;
  krwValue: string; krwPlaceholder?: string; onKrwChange: (v: string) => void; krwActive?: boolean;
  usdValue: string; onUsdChange: (v: string) => void; rateReady: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className={`${labelWidth} text-sm font-medium text-slate-700 shrink-0`}>{label}</label>
      <div className="flex flex-1 gap-1.5">
        <div className="relative flex-1">
          <input
            type="number" min={0} value={krwValue} onChange={e => onKrwChange(e.target.value)}
            className={`w-full border rounded-lg px-2 py-2 text-sm text-right pr-8 focus:outline-none focus:ring-2 focus:ring-slate-400 ${krwActive ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
            placeholder={krwPlaceholder}
          />
          <span className="absolute right-2 top-2 text-xs text-slate-400">원</span>
        </div>
        <div className="relative flex-1">
          <input
            type="number" min={0} value={usdValue} onChange={e => onUsdChange(e.target.value)}
            disabled={!rateReady}
            className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-2 py-2 text-sm text-right pr-7 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            placeholder={rateReady ? '0.00' : '…'}
          />
          <span className="absolute right-2 top-2 text-xs text-emerald-500">$</span>
        </div>
        {suffix}
      </div>
    </div>
  );
}

// ─── 계산기 본체 ──────────────────────────────────────────────────────────────

function CalculatorContent() {
  // ─ 환율
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [rateDate, setRateDate] = useState<string>('');
  const [rateError, setRateError] = useState(false);
  const [rateKey, setRateKey] = useState(0); // 재시도 트리거
  const rateReady = exchangeRate > 0;

  const toUsd = (krw: number) => rateReady ? (krw / exchangeRate).toFixed(2) : '';
  const toKrw = (usd: number) => String(Math.round(usd * exchangeRate));

  // 렌더링 시점의 KRW 입력값을 추적 — 환율이 나중에 도착해도 USD 필드를 올바르게 계산하기 위해
  const inputsRef = useRef({
    salePrice: '1000000', costPrice: '800000',
    agentMode: 'pct' as InputMode, agentAmtInput: '',
    memberMode: 'pct' as InputMode, memberAmtInput: '',
    freeAgentAmtInput: '', overridingAmtInput: '',
  });

  useEffect(() => {
    const controller = new AbortController();
    setRateError(false);
    fetch('/api/tools/exchange-rate', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('rate-fetch-failed'); return r.json(); })
      .then((d: { rate?: number; date?: string; error?: string }) => {
        if (d.error || typeof d.rate !== 'number' || d.rate <= 0) {
          setRateError(true);
          return;
        }
        const rate = d.rate;
        setExchangeRate(rate);
        setRateDate(d.date ?? '');
        // 현재 입력값 기준으로 USD 재계산 (환율 도착 전에 입력된 값 포함)
        const inp = inputsRef.current;
        setSaleUsd((parseFloat(inp.salePrice || '0') / rate).toFixed(2));
        setCostUsd((parseFloat(inp.costPrice || '0') / rate).toFixed(2));
        if (inp.agentMode === 'amount') setAgentUsd((parseFloat(inp.agentAmtInput || '0') / rate).toFixed(2));
        if (inp.memberMode === 'amount') setMemberUsd((parseFloat(inp.memberAmtInput || '0') / rate).toFixed(2));
        const freeVal = parseFloat(inp.freeAgentAmtInput || '0');
        if (freeVal > 0) setFreeAgentUsd((freeVal / rate).toFixed(2));
        const overVal = parseFloat(inp.overridingAmtInput || '0');
        if (overVal > 0) setOverridingUsd((overVal / rate).toFixed(2));
      })
      .catch(e => { if (e.name !== 'AbortError') setRateError(true); });
    return () => controller.abort();
  }, [rateKey]); // rateKey 변경 시 재시도

  // ─ 판매가
  const [salePrice, setSalePrice] = useState('1000000');
  const [saleUsd, setSaleUsd] = useState('');
  const onSaleKrw = (v: string) => { setSalePrice(v); if (rateReady) setSaleUsd(toUsd(parseFloat(v) || 0)); };
  const onSaleUsd = (v: string) => { setSaleUsd(v); setSalePrice(toKrw(parseFloat(v) || 0)); };

  // ─ 입금가
  const [costPrice, setCostPrice] = useState('800000');
  const [costUsd, setCostUsd] = useState('');
  const onCostKrw = (v: string) => { setCostPrice(v); if (rateReady) setCostUsd(toUsd(parseFloat(v) || 0)); };
  const onCostUsd = (v: string) => { setCostUsd(v); setCostPrice(toKrw(parseFloat(v) || 0)); };

  // ─ 지사장
  const [agentPctInput, setAgentPctInput] = useState('5.0');
  const [agentAmtInput, setAgentAmtInput] = useState('');
  const [agentUsd, setAgentUsd] = useState('');
  const [agentMode, setAgentMode] = useState<InputMode>('pct');
  const onAgentPct = (v: string) => { setAgentPctInput(v); setAgentMode('pct'); };
  const onAgentAmt = (v: string) => { setAgentAmtInput(v); setAgentMode('amount'); if (rateReady) setAgentUsd(toUsd(parseFloat(v) || 0)); };
  const onAgentUsd = (v: string) => { setAgentUsd(v); setAgentAmtInput(toKrw(parseFloat(v) || 0)); setAgentMode('amount'); };

  // ─ 소속대리점장
  const [memberPctInput, setMemberPctInput] = useState('3.0');
  const [memberAmtInput, setMemberAmtInput] = useState('');
  const [memberUsd, setMemberUsd] = useState('');
  const [memberMode, setMemberMode] = useState<InputMode>('pct');
  const onMemberPct = (v: string) => { setMemberPctInput(v); setMemberMode('pct'); };
  const onMemberAmt = (v: string) => { setMemberAmtInput(v); setMemberMode('amount'); if (rateReady) setMemberUsd(toUsd(parseFloat(v) || 0)); };
  const onMemberUsd = (v: string) => { setMemberUsd(v); setMemberAmtInput(toKrw(parseFloat(v) || 0)); setMemberMode('amount'); };


  // ─ 자유대리점장
  const [freeAgentAmtInput, setFreeAgentAmtInput] = useState('');
  const [freeAgentUsd, setFreeAgentUsd] = useState('');
  const onFreeAmt = (v: string) => { setFreeAgentAmtInput(v); if (rateReady) setFreeAgentUsd(toUsd(parseFloat(v) || 0)); };
  const onFreeUsd = (v: string) => { setFreeAgentUsd(v); setFreeAgentAmtInput(toKrw(parseFloat(v) || 0)); };

  // ─ 오버라이딩
  const [overridingAmtInput, setOverridingAmtInput] = useState('');
  const [overridingUsd, setOverridingUsd] = useState('');
  const onOverridingAmt = (v: string) => { setOverridingAmtInput(v); if (rateReady) setOverridingUsd(toUsd(parseFloat(v) || 0)); };
  const onOverridingUsd = (v: string) => { setOverridingUsd(v); setOverridingAmtInput(toKrw(parseFloat(v) || 0)); };

  // inputsRef를 렌더마다 최신값으로 동기화 (비동기 환율 콜백에서 사용)
  inputsRef.current = { salePrice, costPrice, agentMode, agentAmtInput, memberMode, memberAmtInput, freeAgentAmtInput, overridingAmtInput };

  // ─ 계산
  const calc = useMemo(() => {
    const sale = parseFloat(salePrice.replace(/,/g, '')) || 0;
    const cost = parseFloat(costPrice.replace(/,/g, '')) || 0;
    const cardFee = sale * CARD_FEE_RATE;
    const operatingProfit = sale - cost;
    const netProfitBeforeTax = operatingProfit - cardFee;
    const operatingMargin = sale > 0 ? (operatingProfit / sale) * 100 : 0;
    const netMargin = sale > 0 ? (netProfitBeforeTax / sale) * 100 : 0;

    let agentPct: number, agentAmt: number;
    if (agentMode === 'pct') {
      agentPct = parseFloat(agentPctInput) || 0;
      agentAmt = netProfitBeforeTax * (agentPct / 100);
    } else {
      agentAmt = parseFloat(agentAmtInput.replace(/,/g, '')) || 0;
      agentPct = netProfitBeforeTax > 0 ? (agentAmt / netProfitBeforeTax) * 100 : 0;
    }

    let memberPct: number, memberAmt: number;
    if (memberMode === 'pct') {
      memberPct = parseFloat(memberPctInput) || 0;
      memberAmt = netProfitBeforeTax * (memberPct / 100);
    } else {
      memberAmt = parseFloat(memberAmtInput.replace(/,/g, '')) || 0;
      memberPct = netProfitBeforeTax > 0 ? (memberAmt / netProfitBeforeTax) * 100 : 0;
    }

    const freeAmt = parseFloat(freeAgentAmtInput.replace(/,/g, '')) || 0;
    const freeAgentPct = netProfitBeforeTax > 0 ? (freeAmt / netProfitBeforeTax) * 100 : 0;
    const overridingAmt = parseFloat(overridingAmtInput.replace(/,/g, '')) || 0;
    const overridingPct = netProfitBeforeTax > 0 ? (overridingAmt / netProfitBeforeTax) * 100 : 0;

    const hqProfit = netProfitBeforeTax - agentAmt - memberAmt - freeAmt - overridingAmt;
    const hqMargin = sale > 0 ? (hqProfit / sale) * 100 : 0;
    const corporateTax = operatingProfit * 0.22;
    const afterTaxProfit = hqProfit - corporateTax;
    const totalAllowance = agentAmt + memberAmt + freeAmt + overridingAmt;
    const allowanceOverflow = totalAllowance > netProfitBeforeTax;

    return {
      sale, cost, cardFee, operatingProfit, netProfitBeforeTax, operatingMargin, netMargin,
      agentPct, agentAmt, memberPct, memberAmt, freeAgentPct, freeAmt,
      overridingPct, overridingAmt, hqProfit, hqMargin,
      corporateTax, afterTaxProfit, allowanceOverflow,
    };
  }, [salePrice, costPrice, agentMode, agentPctInput, agentAmtInput, memberMode, memberPctInput, memberAmtInput, freeAgentAmtInput, overridingAmtInput]);

  const inputError =
    calc.sale <= 0 ? '판매가를 입력하세요.' :
    calc.cost < 0 ? '입금가는 0 이상이어야 합니다.' :
    calc.cost >= calc.sale ? '입금가는 판매가보다 작아야 합니다.' : null;

  // ─ 저장 / 불러오기 (Neon DB via API)
  const [savedCalcs, setSavedCalcs] = useState<SavedCalc[]>([]);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [detailCalc, setDetailCalc] = useState<SavedCalc | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 목록 초기 로드
  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingList(true);
    fetch('/api/tools/profit-calculations', { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { items: SavedCalc[] }) => setSavedCalcs(d.items))
      .catch(e => { if (e.name !== 'AbortError') { /* 목록 조회 실패는 조용히 처리 */ } })
      .finally(() => setIsLoadingList(false));
    return () => controller.abort();
  }, []);

  async function doSave() {
    const title = saveTitle.trim() || `계산 ${new Date().toLocaleDateString('ko-KR')}`;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/tools/profit-calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          salePrice: parseFloat(salePrice) || 0,
          costPrice: parseFloat(costPrice) || 0,
          agentMode,
          agentPct: calc.agentPct,
          agentAmt: calc.agentAmt,
          memberMode,
          memberPct: calc.memberPct,
          memberAmt: calc.memberAmt,
          freeAmt: calc.freeAmt,
          freePct: calc.freeAgentPct,
          overridingAmt: calc.overridingAmt,
          overridingPct: calc.overridingPct,
          snapshotSale: calc.sale,
          snapshotNetProfit: calc.netProfitBeforeTax,
          snapshotHqProfit: calc.hqProfit,
          exchangeRateSnapshot: exchangeRate || null,
        }),
      });
      if (!res.ok) {
        setSaveError(res.status === 403
          ? '저장 기능은 조직에 소속된 계정만 사용할 수 있습니다.'
          : '저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      const data = await res.json() as { item: SavedCalc };
      setSavedCalcs(prev => [data.item, ...prev].slice(0, 50));
      setSaveTitle('');
      setShowSaveInput(false);
    } catch {
      setSaveError('네트워크 오류로 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  function doLoad(entry: SavedCalc) {
    setShowPanel(false);    // 모바일 패널 닫기
    setShowSaveInput(false); // 저장 입력창이 열려 있었으면 닫기

    const salePriceStr    = String(Math.round(entry.salePrice));
    const costPriceStr    = String(Math.round(entry.costPrice));
    const agentModeVal    = entry.agentMode as InputMode;
    const agentAmtStr     = entry.agentMode === 'amount' ? String(Math.round(entry.agentAmt)) : '';
    const memberModeVal   = entry.memberMode as InputMode;
    const memberAmtStr    = entry.memberMode === 'amount' ? String(Math.round(entry.memberAmt)) : '';
    const freeAmtStr      = entry.freeAmt > 0 ? String(Math.round(entry.freeAmt)) : '';
    const overridingAmtStr = entry.overridingAmt > 0 ? String(Math.round(entry.overridingAmt)) : '';

    // inputsRef 즉시 갱신 — 환율 콜백이 리렌더 전에 도착해도 올바른 KRW 값 사용
    inputsRef.current = {
      salePrice: salePriceStr, costPrice: costPriceStr,
      agentMode: agentModeVal, agentAmtInput: agentAmtStr,
      memberMode: memberModeVal, memberAmtInput: memberAmtStr,
      freeAgentAmtInput: freeAmtStr, overridingAmtInput: overridingAmtStr,
    };

    setSalePrice(salePriceStr);
    setCostPrice(costPriceStr);
    setSaleUsd(toUsd(entry.salePrice));
    setCostUsd(toUsd(entry.costPrice));
    // 지사장
    setAgentMode(agentModeVal);
    if (agentModeVal === 'pct') { setAgentPctInput(String(entry.agentPct)); setAgentAmtInput(''); }
    else { setAgentAmtInput(agentAmtStr); setAgentUsd(toUsd(entry.agentAmt)); }
    // 소속대리점장
    setMemberMode(memberModeVal);
    if (memberModeVal === 'pct') { setMemberPctInput(String(entry.memberPct)); setMemberAmtInput(''); }
    else { setMemberAmtInput(memberAmtStr); setMemberUsd(toUsd(entry.memberAmt)); }
    // 자유대리점장 / 오버라이딩
    setFreeAgentAmtInput(freeAmtStr);
    setFreeAgentUsd(entry.freeAmt > 0 ? toUsd(entry.freeAmt) : '');
    setOverridingAmtInput(overridingAmtStr);
    setOverridingUsd(entry.overridingAmt > 0 ? toUsd(entry.overridingAmt) : '');
  }

  function doDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    // 삭제 대상이 현재 세부확인 모달에 열려 있으면 닫기
    if (detailCalc?.id === id) setDetailCalc(null);
    // Optimistic update — 스냅샷 보관 후 롤백에 사용
    const snapshot = savedCalcs;
    setSavedCalcs(prev => prev.filter(c => c.id !== id));
    fetch(`/api/tools/profit-calculations?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(r => { if (!r.ok) throw new Error(); })
      .catch(() => { setSavedCalcs(snapshot); }); // 롤백
  }

  // ─ USD 표시 (% 모드일 때 calc에서 파생)
  const agentUsdDisplay = agentMode === 'pct' ? toUsd(calc.agentAmt) : agentUsd;
  const memberUsdDisplay = memberMode === 'pct' ? toUsd(calc.memberAmt) : memberUsd;

  // ─ 렌더링 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-4 items-start">
      {detailCalc && (
        <DetailModal
          calc={detailCalc}
          onClose={() => setDetailCalc(null)}
          onLoad={(c) => { doLoad(c); setDetailCalc(null); }}
        />
      )}

      {/* ── 왼쪽: 계산기 ── */}
      <div className="flex-1 min-w-0 space-y-5 pb-12">

        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">수익 계산기</h1>
              <p className="text-sm text-slate-500 mt-1">원 또는 달러로 입력 — 나머지는 자동 변환됩니다.</p>
            </div>
            {/* 환율 배지 */}
            <div className={`text-sm rounded-xl px-4 py-2 border font-mono ${rateError ? 'bg-red-50 border-red-200 text-red-600' : rateReady ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 animate-pulse'}`}>
              {rateError
                ? <span className="flex items-center gap-2">환율 로드 실패 <button onClick={() => setRateKey(k => k + 1)} className="text-xs underline hover:text-red-800">재시도</button></span>
                : rateReady ? <>$1 = {fmt(exchangeRate)}원 <span className="text-slate-400 font-normal ml-1">({rateDate})</span></>
                : '환율 불러오는 중…'}
            </div>
          </div>
          {/* 모바일: 저장 목록 버튼 */}
          <button
            onClick={() => setShowPanel(p => !p)}
            className="mt-3 lg:hidden w-full text-sm border border-blue-200 bg-white/70 rounded-lg py-2 text-blue-700 font-medium"
          >
            {showPanel ? '저장 목록 닫기' : `저장 목록 보기 (${isLoadingList ? '…' : savedCalcs.length}건)`}
          </button>
        </div>

        {/* 모바일 패널 */}
        {showPanel && (
          <div className="lg:hidden">
            <SavedPanel
              savedCalcs={savedCalcs} isLoading={isLoadingList} isSaving={isSaving}
              saveTitle={saveTitle} setSaveTitle={setSaveTitle}
              showSaveInput={showSaveInput} setShowSaveInput={setShowSaveInput}
              onSave={doSave} onLoad={doLoad} onDelete={doDelete} onDetail={setDetailCalc}
            />
          </div>
        )}

        {/* ── 섹션 1: 기본 단가 ── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">1단계 — 기본 단가</h2>
            <p className="text-xs text-slate-400 mt-0.5">원 또는 달러($) 중 하나를 입력하면 나머지가 자동 변환됩니다.</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <DualInput label="판매가" krwValue={salePrice} onKrwChange={onSaleKrw} usdValue={saleUsd} onUsdChange={onSaleUsd} rateReady={rateReady} />
            <DualInput label="입금가" krwValue={costPrice} onKrwChange={onCostKrw} usdValue={costUsd} onUsdChange={onCostUsd} rateReady={rateReady} />
            <div className="flex items-center gap-2">
              <span className="w-28 text-sm text-slate-500 shrink-0">카드수수료 {(CARD_FEE_RATE * 100).toFixed(1)}%</span>
              <div className="flex flex-1 gap-1.5">
                <span className="flex-1 text-sm text-right text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2">{fmt(calc.cardFee)} 원</span>
                <span className="flex-1 text-sm text-right text-emerald-500 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-2">{rateReady ? `$${toUsd(calc.cardFee)}` : '—'}</span>
              </div>
            </div>
            {inputError && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inputError}</p>}
          </div>
          {!inputError && (
            <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 space-y-1.5">
              {([
                { label: '영업이익', krw: calc.operatingProfit, margin: calc.operatingMargin },
                { label: '세전순이익', krw: calc.netProfitBeforeTax, margin: calc.netMargin },
              ] as { label: string; krw: number; margin: number }[]).map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-slate-600">{row.label}</span>
                  <span className={cls(row.krw)}>
                    {fmt(row.krw)} 원
                    {rateReady && <span className="ml-1.5 text-emerald-600 font-normal">(${toUsd(row.krw)})</span>}
                    <span className="ml-2 text-slate-400 font-normal text-xs">{pct(row.margin)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 섹션 2: 수당 분배 ── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">2단계 — 수당 분배</h2>
            <p className="text-xs text-slate-400 mt-0.5">%, 원, 달러 중 하나를 입력하면 나머지가 자동 계산됩니다.</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {calc.allowanceOverflow && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-700">
                수당 합계({fmt(calc.agentAmt + calc.memberAmt + calc.freeAmt + calc.overridingAmt)}원)가 세전순이익을 초과합니다.
              </div>
            )}

            {/* 지사장 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="w-28 text-sm font-semibold text-slate-700 shrink-0">지사장</label>
                <div className="flex flex-1 gap-1.5">
                  {/* % */}
                  <div className="relative w-20 shrink-0">
                    <input type="number" min={0} max={100} step={0.1}
                      value={agentMode === 'pct' ? agentPctInput : pct(calc.agentPct)}
                      onChange={e => onAgentPct(e.target.value)}
                      onFocus={() => setAgentMode('pct')}
                      className={`w-full border rounded-lg px-2 py-2 text-sm text-right pr-6 focus:outline-none focus:ring-2 focus:ring-slate-400 ${agentMode === 'pct' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                      placeholder="0.0" />
                    <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                  </div>
                  {/* 원 */}
                  <div className="relative flex-1">
                    <input type="number" min={0}
                      value={agentMode === 'amount' ? agentAmtInput : Math.round(calc.agentAmt).toString()}
                      onChange={e => onAgentAmt(e.target.value)}
                      onFocus={() => { if (agentMode !== 'amount') { setAgentAmtInput(Math.round(calc.agentAmt).toString()); setAgentMode('amount'); } }}
                      className={`w-full border rounded-lg px-2 py-2 text-sm text-right pr-8 focus:outline-none focus:ring-2 focus:ring-slate-400 ${agentMode === 'amount' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                      placeholder="0" />
                    <span className="absolute right-2 top-2 text-xs text-slate-400">원</span>
                  </div>
                  {/* $ */}
                  <div className="relative flex-1">
                    <input type="number" min={0}
                      value={agentUsdDisplay}
                      onChange={e => onAgentUsd(e.target.value)}
                      disabled={!rateReady}
                      className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-2 py-2 text-sm text-right pr-6 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-40"
                      placeholder={rateReady ? '0.00' : '…'} />
                    <span className="absolute right-2 top-2 text-xs text-emerald-500">$</span>
                  </div>
                </div>
              </div>

              {/* 소속/자유대리점장/오버라이딩 */}
              <div className="ml-5 pl-3 border-l-2 border-slate-200 space-y-2">
                {/* 소속대리점장 */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-sm text-slate-600 shrink-0">소속대리점장</label>
                  <div className="flex flex-1 gap-1.5">
                    <div className="relative w-20 shrink-0">
                      <input type="number" min={0} max={100} step={0.1}
                        value={memberMode === 'pct' ? memberPctInput : pct(calc.memberPct)}
                        onChange={e => onMemberPct(e.target.value)}
                        onFocus={() => setMemberMode('pct')}
                        className={`w-full border rounded-lg px-2 py-2 text-sm text-right pr-6 focus:outline-none focus:ring-2 focus:ring-slate-400 ${memberMode === 'pct' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                        placeholder="0.0" />
                      <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                    </div>
                    <div className="relative flex-1">
                      <input type="number" min={0}
                        value={memberMode === 'amount' ? memberAmtInput : Math.round(calc.memberAmt).toString()}
                        onChange={e => onMemberAmt(e.target.value)}
                        onFocus={() => { if (memberMode !== 'amount') { setMemberAmtInput(Math.round(calc.memberAmt).toString()); setMemberMode('amount'); } }}
                        className={`w-full border rounded-lg px-2 py-2 text-sm text-right pr-8 focus:outline-none focus:ring-2 focus:ring-slate-400 ${memberMode === 'amount' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                        placeholder="0" />
                      <span className="absolute right-2 top-2 text-xs text-slate-400">원</span>
                    </div>
                    <div className="relative flex-1">
                      <input type="number" min={0}
                        value={memberUsdDisplay}
                        onChange={e => onMemberUsd(e.target.value)}
                        disabled={!rateReady}
                        className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-2 py-2 text-sm text-right pr-6 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-40"
                        placeholder={rateReady ? '0.00' : '…'} />
                      <span className="absolute right-2 top-2 text-xs text-emerald-500">$</span>
                    </div>
                  </div>
                </div>

                {/* 자유대리점장 */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-sm text-slate-600 shrink-0">자유대리점장</label>
                  <div className="flex flex-1 gap-1.5">
                    <div className="relative flex-1">
                      <input type="number" min={0} value={freeAgentAmtInput} onChange={e => onFreeAmt(e.target.value)}
                        className="w-full border border-slate-400 bg-white rounded-lg px-2 py-2 text-sm text-right pr-8 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        placeholder="0" />
                      <span className="absolute right-2 top-2 text-xs text-slate-400">원</span>
                    </div>
                    <div className="relative flex-1">
                      <input type="number" min={0} value={freeAgentUsd} onChange={e => onFreeUsd(e.target.value)}
                        disabled={!rateReady}
                        className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-2 py-2 text-sm text-right pr-6 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-40"
                        placeholder={rateReady ? '0.00' : '…'} />
                      <span className="absolute right-2 top-2 text-xs text-emerald-500">$</span>
                    </div>
                    <div className="w-20 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm text-right text-slate-500">
                      {pct(calc.freeAgentPct)}%
                    </div>
                  </div>
                </div>

                {/* 오버라이딩 */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-sm text-slate-600 shrink-0">오버라이딩</label>
                  <div className="flex flex-1 gap-1.5">
                    <div className="relative flex-1">
                      <input type="number" min={0} value={overridingAmtInput} onChange={e => onOverridingAmt(e.target.value)}
                        className="w-full border border-slate-400 bg-white rounded-lg px-2 py-2 text-sm text-right pr-8 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        placeholder="0" />
                      <span className="absolute right-2 top-2 text-xs text-slate-400">원</span>
                    </div>
                    <div className="relative flex-1">
                      <input type="number" min={0} value={overridingUsd} onChange={e => onOverridingUsd(e.target.value)}
                        disabled={!rateReady}
                        className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-2 py-2 text-sm text-right pr-6 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-40"
                        placeholder={rateReady ? '0.00' : '…'} />
                      <span className="absolute right-2 top-2 text-xs text-emerald-500">$</span>
                    </div>
                    <div className="w-20 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm text-right text-slate-500">
                      {pct(calc.overridingPct)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 본사 순이익 */}
          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-slate-700">본사 순이익</span>
              <span className={`text-lg ${cls(calc.hqProfit)}`}>
                {fmt(calc.hqProfit)} 원
                {rateReady && <span className="ml-2 text-base text-emerald-600 font-normal">(${toUsd(calc.hqProfit)})</span>}
                <span className="ml-2 text-slate-400 font-normal text-sm">{pct(calc.hqMargin)}%</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">= 세전순이익 − 지사장 − 소속대리점장 − 자유대리점장 − 오버라이딩</p>
          </div>
        </section>

        {/* ── 저장 버튼 ── */}
        {!inputError && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 space-y-2">
            {showSaveInput ? (
              <div className="flex gap-2">
                <input
                  type="text" value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isSaving && doSave()}
                  placeholder={`제목 (기본: 계산 ${new Date().toLocaleDateString('ko-KR')})`}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus disabled={isSaving}
                />
                <button onClick={doSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60">
                  {isSaving ? '저장 중…' : '저장'}
                </button>
                <button onClick={() => { setShowSaveInput(false); setSaveError(null); }} disabled={isSaving} className="px-3 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-60">취소</button>
              </div>
            ) : (
              <button
                onClick={() => { setShowSaveInput(true); setSaveError(null); }}
                className="w-full py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
              >
                + 현재 계산 저장하기
              </button>
            )}
            {saveError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}
          </div>
        )}

        {/* ── 법인세 ── */}
        <section className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200">
            <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">참고 — 법인세 22%</h2>
            <p className="text-xs text-amber-600 mt-0.5">실제 세율은 과세표준과 세무 처리에 따라 다를 수 있습니다.</p>
          </div>
          <div className="px-5 py-3 space-y-1.5">
            {[
              { label: '영업이익 기준 법인세 (22%)', v: calc.corporateTax },
              { label: '세후 본사 순이익 (참고용)', v: calc.afterTaxProfit },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-amber-700">{row.label}</span>
                <span className={`font-semibold ${row.v < 0 ? 'text-red-600' : 'text-amber-900'}`}>
                  {fmt(row.v)} 원
                  {rateReady && <span className="ml-1.5 text-emerald-600 font-normal text-xs">(${toUsd(row.v)})</span>}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 전체 요약 ── */}
        {!inputError && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">전체 계산 요약</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { label: '판매가', krw: calc.sale },
                { label: '입금가', krw: calc.cost },
                { label: `카드수수료 (${(CARD_FEE_RATE * 100).toFixed(1)}%)`, krw: calc.cardFee },
                { label: '영업이익', krw: calc.operatingProfit, sub: pct(calc.operatingMargin) + '%', hi: true },
                { label: '세전순이익', krw: calc.netProfitBeforeTax, sub: pct(calc.netMargin) + '%', hi: true },
                { label: '지사장 수당', krw: calc.agentAmt, sub: pct(calc.agentPct) + '%' },
                { label: '소속대리점장 수당', krw: calc.memberAmt, sub: pct(calc.memberPct) + '%' },
                { label: '자유대리점장 수당', krw: calc.freeAmt, sub: pct(calc.freeAgentPct) + '%' },
                { label: '지사장 오버라이딩', krw: calc.overridingAmt, sub: pct(calc.overridingPct) + '%' },
                { label: '본사 순이익', krw: calc.hqProfit, sub: pct(calc.hqMargin) + '%', hi: true, red: calc.hqProfit < 0 },
              ].map(row => (
                <div key={row.label} className={`flex justify-between items-center px-5 py-2.5 text-sm ${row.hi ? 'bg-slate-50' : ''}`}>
                  <span className={row.hi ? 'font-semibold text-slate-800' : 'text-slate-600'}>{row.label}</span>
                  <span className={`font-medium ${row.red ? 'text-red-600' : 'text-slate-900'}`}>
                    {fmt(row.krw)} 원
                    {rateReady && <span className="ml-1.5 text-xs text-emerald-500 font-normal">${toUsd(row.krw)}</span>}
                    {row.sub && <span className="ml-2 text-xs text-slate-400">{row.sub}</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── 오른쪽: 저장 목록 패널 (desktop) ── */}
      <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-4 self-start">
        <SavedPanel
          savedCalcs={savedCalcs} isLoading={isLoadingList} isSaving={isSaving}
          saveTitle={saveTitle} setSaveTitle={setSaveTitle}
          showSaveInput={showSaveInput} setShowSaveInput={setShowSaveInput}
          onSave={doSave} onLoad={doLoad} onDelete={doDelete} onDetail={setDetailCalc}
        />
      </div>
    </div>
  );
}

// ─── 세부확인 모달 ────────────────────────────────────────────────────────────

function DetailModal({ calc, onClose, onLoad }: { calc: SavedCalc; onClose: () => void; onLoad: (c: SavedCalc) => void }) {
  const rows: { label: string; value: string; highlight?: boolean; red?: boolean }[] = [
    { label: '판매가', value: `${Math.round(calc.salePrice).toLocaleString('ko-KR')} 원` },
    { label: '입금가', value: `${Math.round(calc.costPrice).toLocaleString('ko-KR')} 원` },
    { label: '세전순이익', value: `${Math.round(calc.snapshotNetProfit).toLocaleString('ko-KR')} 원`, highlight: true },
    { label: `지사장 수당 (${calc.agentMode === 'pct' ? calc.agentPct.toFixed(1) + '%' : '금액'})`, value: `${Math.round(calc.agentAmt).toLocaleString('ko-KR')} 원` },
    { label: `소속대리점장 수당 (${calc.memberMode === 'pct' ? calc.memberPct.toFixed(1) + '%' : '금액'})`, value: `${Math.round(calc.memberAmt).toLocaleString('ko-KR')} 원` },
    { label: `자유대리점장 수당 (${calc.freePct.toFixed(1)}%)`, value: `${Math.round(calc.freeAmt).toLocaleString('ko-KR')} 원` },
    { label: `오버라이딩 수당 (${calc.overridingPct.toFixed(1)}%)`, value: `${Math.round(calc.overridingAmt).toLocaleString('ko-KR')} 원` },
    { label: '본사 순이익', value: `${Math.round(calc.snapshotHqProfit).toLocaleString('ko-KR')} 원`, highlight: true, red: calc.snapshotHqProfit < 0 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-base font-semibold text-slate-900 line-clamp-1">{calc.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{new Date(calc.savedAt).toLocaleString('ko-KR')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 divide-y divide-slate-100">
          {rows.map(row => (
            <div key={row.label} className={`flex justify-between items-center py-2 text-sm ${row.highlight ? 'bg-slate-50 -mx-5 px-5' : ''}`}>
              <span className="text-slate-500">{row.label}</span>
              <span className={`font-semibold ${row.red ? 'text-red-600' : row.highlight ? 'text-blue-700' : 'text-slate-800'}`}>{row.value}</span>
            </div>
          ))}
          {calc.exchangeRateSnapshot && (
            <div className="flex justify-between items-center py-2 text-xs text-slate-400">
              <span>저장 당시 환율</span>
              <span>$1 = {Math.round(calc.exchangeRateSnapshot).toLocaleString('ko-KR')} 원</span>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t flex gap-2">
          <button
            onClick={() => { onLoad(calc); onClose(); }}
            className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >계산기에 불러오기</button>
          <button onClick={onClose} className="flex-1 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200">닫기</button>
        </div>
      </div>
    </div>
  );
}

// ─── 저장 목록 패널 컴포넌트 ──────────────────────────────────────────────────

function SavedPanel({
  savedCalcs, isLoading, isSaving,
  saveTitle, setSaveTitle, showSaveInput, setShowSaveInput,
  onSave, onLoad, onDelete, onDetail,
}: {
  savedCalcs: SavedCalc[];
  isLoading: boolean;
  isSaving: boolean;
  saveTitle: string; setSaveTitle: (v: string) => void;
  showSaveInput: boolean; setShowSaveInput: (v: boolean) => void;
  onSave: () => void;
  onLoad: (c: SavedCalc) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDetail: (c: SavedCalc) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">저장된 계산 ({savedCalcs.length})</h2>
        {!showSaveInput && (
          <button
            onClick={() => setShowSaveInput(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >+ 저장</button>
        )}
      </div>

      {showSaveInput && (
        <div className="px-4 py-3 border-b border-slate-100 bg-blue-50 space-y-2">
          <input
            type="text" value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isSaving && onSave()}
            placeholder="제목 입력 (선택)"
            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus disabled={isSaving}
          />
          <div className="flex gap-2">
            <button onClick={onSave} disabled={isSaving} className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60">
              {isSaving ? '저장 중…' : '저장'}
            </button>
            <button onClick={() => setShowSaveInput(false)} disabled={isSaving} className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-60">취소</button>
          </div>
        </div>
      )}

      <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
        {isLoading ? (
          <p className="px-4 py-8 text-sm text-center text-slate-400 animate-pulse">불러오는 중…</p>
        ) : savedCalcs.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-slate-400">저장된 계산이 없습니다.</p>
        ) : (
          savedCalcs.map(c => (
            <div key={c.id} className="group relative hover:bg-slate-50 transition">
              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={e => onDelete(c.id, e)}
                className="absolute top-2 right-3 z-10 text-slate-300 hover:text-red-400 text-xs px-1 py-0.5"
                aria-label="삭제"
              >✕</button>
              {/* 요약 영역 */}
              <div className="px-4 py-3 pr-8">
                <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-1 pr-2">{c.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(c.savedAt).toLocaleString('ko-KR')}</p>
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">판매가</span>
                    <span className="text-slate-700">{Math.round(c.snapshotSale).toLocaleString('ko-KR')} 원</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">본사 순이익</span>
                    <span className={`font-semibold ${c.snapshotHqProfit < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                      {Math.round(c.snapshotHqProfit).toLocaleString('ko-KR')} 원
                    </span>
                  </div>
                </div>
                {/* 액션 버튼 2개 */}
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => onDetail(c)}
                    className="flex-1 py-1 text-xs border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 transition"
                  >세부확인</button>
                  <button
                    type="button"
                    onClick={() => onLoad(c)}
                    className="flex-1 py-1 text-xs border border-blue-200 rounded-md text-blue-600 hover:bg-blue-50 transition"
                  >불러오기</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 페이지 래퍼 (권한 체크) ──────────────────────────────────────────────────

export default function ProfitCalculatorPage() {
  const router = useRouter();
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('auth-failed'); return r.json(); })
      .then((d: { ok: boolean; role: string }) => {
        if (!d.ok) { router.replace('/dashboard'); return; }
        setBlocked(d.role === 'FREE_SALES' || d.role === 'AGENT');
      })
      .catch(e => { if (e.name !== 'AbortError') router.replace('/dashboard'); });
    return () => controller.abort();
  }, [router]);

  if (blocked === null) return null;
  if (blocked) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-600 text-sm">접근 권한이 없습니다</p>
    </div>
  );

  return <CalculatorContent />;
}
