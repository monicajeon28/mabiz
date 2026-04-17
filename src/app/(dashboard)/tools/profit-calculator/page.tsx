'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { CARD_FEE_RATE, FREE_AGENT_COMMISSION_RATE } from '@/lib/constants/affiliate';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

function pct(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function cls(n: number): string {
  return n < 0 ? 'text-red-600 font-bold' : 'text-slate-900 font-bold';
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

type InputMode = 'pct' | 'amount'; // 어느 쪽을 사용자가 입력했는지

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ProfitCalculatorPage() {
  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role;

  if (role === 'FREE_SALES' || role === 'AGENT') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">접근 권한이 없습니다</p>
      </div>
    );
  }

  // 1단계 — 기본 단가
  const [salePrice, setSalePrice] = useState<string>('1000000');
  const [costPrice, setCostPrice] = useState<string>('800000');

  // 2단계 — 대리점장 수당 (% or 금액)
  const [agentPctInput, setAgentPctInput] = useState<string>('5.0');
  const [agentAmtInput, setAgentAmtInput] = useState<string>('');
  const [agentMode, setAgentMode] = useState<InputMode>('pct');

  // 소속판매원 수당 (% or 금액)
  const [memberPctInput, setMemberPctInput] = useState<string>('3.0');
  const [memberAmtInput, setMemberAmtInput] = useState<string>('');
  const [memberMode, setMemberMode] = useState<InputMode>('pct');

  // 자유판매원 고정 3% — lib/constants/affiliate.ts의 FREE_AGENT_COMMISSION_RATE 사용
  const FREE_AGENT_PCT = FREE_AGENT_COMMISSION_RATE;

  // ─── 파생 계산 (useMemo) ─────────────────────────────────────────────────

  const calc = useMemo(() => {
    const sale = parseFloat(salePrice.replace(/,/g, '')) || 0;
    const cost = parseFloat(costPrice.replace(/,/g, '')) || 0;

    const cardFee = sale * CARD_FEE_RATE;
    const operatingProfit = sale - cost;           // 영업이익
    const netProfitBeforeTax = operatingProfit - cardFee; // 세전순이익
    const operatingMargin = sale > 0 ? (operatingProfit / sale) * 100 : 0;
    const netMargin = sale > 0 ? (netProfitBeforeTax / sale) * 100 : 0;

    // 대리점장 수당 (세전순이익 기준)
    let agentPct: number;
    let agentAmt: number;
    if (agentMode === 'pct') {
      agentPct = parseFloat(agentPctInput) || 0;
      agentAmt = netProfitBeforeTax * (agentPct / 100);
    } else {
      agentAmt = parseFloat(agentAmtInput.replace(/,/g, '')) || 0;
      agentPct = netProfitBeforeTax > 0 ? (agentAmt / netProfitBeforeTax) * 100 : 0;
    }

    // 소속판매원 수당 (세전순이익 기준)
    let memberPct: number;
    let memberAmt: number;
    if (memberMode === 'pct') {
      memberPct = parseFloat(memberPctInput) || 0;
      memberAmt = netProfitBeforeTax * (memberPct / 100);
    } else {
      memberAmt = parseFloat(memberAmtInput.replace(/,/g, '')) || 0;
      memberPct = netProfitBeforeTax > 0 ? (memberAmt / netProfitBeforeTax) * 100 : 0;
    }

    // 자유판매원 수당 (세전순이익 기준)
    const freeAmt = netProfitBeforeTax * (FREE_AGENT_PCT / 100);

    // 대리점장 오버라이딩 = 대리점장% - 자유판매원 3%
    const overridingPct = Math.max(agentPct - FREE_AGENT_PCT, 0);
    const overridingAmt = netProfitBeforeTax * (overridingPct / 100);

    // 본사 순이익 = 세전순이익 - 대리점장수당 - 소속판매원수당
    const hqProfit = netProfitBeforeTax - agentAmt - memberAmt;
    const hqMargin = sale > 0 ? (hqProfit / sale) * 100 : 0;

    // 법인세 22% 참고 (영업이익 기준)
    const corporateTax = operatingProfit * 0.22;
    const afterTaxProfit = hqProfit - corporateTax;

    // 경고: 수당 합계가 세전순이익 초과 여부
    const totalAllowance = agentAmt + memberAmt;
    const allowanceOverflow = totalAllowance > netProfitBeforeTax;

    return {
      sale, cost,
      cardFee, operatingProfit, netProfitBeforeTax, operatingMargin, netMargin,
      agentPct, agentAmt,
      memberPct, memberAmt,
      freeAmt,
      overridingPct, overridingAmt,
      hqProfit, hqMargin,
      corporateTax, afterTaxProfit,
      allowanceOverflow,
    };
  }, [salePrice, costPrice, agentMode, agentPctInput, agentAmtInput, memberMode, memberPctInput, memberAmtInput]);

  // 입력 검증
  const sale = calc.sale;
  const cost = calc.cost;
  const inputError =
    sale <= 0 ? '판매가를 입력하세요.' :
    cost < 0 ? '입금가는 0 이상이어야 합니다.' :
    cost >= sale ? '입금가는 판매가보다 작아야 합니다.' :
    null;

  // ─── 핸들러 ──────────────────────────────────────────────────────────────

  function handleAgentPct(v: string) {
    setAgentPctInput(v);
    setAgentMode('pct');
  }
  function handleAgentAmt(v: string) {
    setAgentAmtInput(v);
    setAgentMode('amount');
  }
  function handleMemberPct(v: string) {
    setMemberPctInput(v);
    setMemberMode('pct');
  }
  function handleMemberAmt(v: string) {
    setMemberAmtInput(v);
    setMemberMode('amount');
  }

  // ─── 렌더링 ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">수익 계산기</h1>
        <p className="text-sm text-slate-500 mt-1">판매가와 원가를 입력하면 수익 구조와 수당 분배를 자동 계산합니다.</p>
      </div>

      {/* ── 섹션 1: 기본 단가 입력 ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">1단계 — 기본 단가 입력</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* 판매가 */}
          <div className="flex items-center gap-3">
            <label className="w-28 text-sm font-medium text-slate-700 shrink-0">판매가</label>
            <div className="flex-1 relative">
              <input
                type="number"
                min={0}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-right pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="0"
              />
              <span className="absolute right-3 top-2 text-sm text-slate-400">원</span>
            </div>
          </div>
          {/* 입금가 */}
          <div className="flex items-center gap-3">
            <label className="w-28 text-sm font-medium text-slate-700 shrink-0">입금가</label>
            <div className="flex-1 relative">
              <input
                type="number"
                min={0}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-right pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="0"
              />
              <span className="absolute right-3 top-2 text-sm text-slate-400">원</span>
            </div>
          </div>
          {/* 카드수수료 자동 */}
          <div className="flex items-center gap-3">
            <span className="w-28 text-sm text-slate-500 shrink-0">카드수수료 {(CARD_FEE_RATE * 100).toFixed(1)}%</span>
            <span className="flex-1 text-sm text-right text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {fmt(calc.cardFee)} 원 <span className="text-slate-400">(자동)</span>
            </span>
          </div>

          {/* 입력 오류 */}
          {inputError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inputError}</p>
          )}
        </div>

        {/* 결과 요약 */}
        {!inputError && (
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">영업이익 <span className="text-xs text-slate-400">(판매가 - 입금가)</span></span>
              <span className={cls(calc.operatingProfit)}>
                {fmt(calc.operatingProfit)} 원
                <span className="ml-2 text-slate-500 font-normal text-xs">{pct(calc.operatingMargin)}%</span>
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">세전순이익 <span className="text-xs text-slate-400">(영업이익 - 카드수수료)</span></span>
              <span className={cls(calc.netProfitBeforeTax)}>
                {fmt(calc.netProfitBeforeTax)} 원
                <span className="ml-2 text-slate-500 font-normal text-xs">{pct(calc.netMargin)}%</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 pt-1">* 세금은 영업이익 기준으로 납부합니다.</p>
          </div>
        )}
      </section>

      {/* ── 섹션 2: 수당 분배 계산기 ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">2단계 — 수당 분배 계산기</h2>
          <p className="text-xs text-slate-400 mt-0.5">% 또는 금액 중 하나를 입력하면 나머지가 자동 계산됩니다. 기준: 세전순이익</p>
        </div>
        <div className="px-6 py-5 space-y-5">

          {/* 수당 합계 초과 경고 */}
          {calc.allowanceOverflow && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-700">
              수당 합계({fmt(calc.agentAmt + calc.memberAmt)}원)가 세전순이익({fmt(calc.netProfitBeforeTax)}원)을 초과합니다.
            </div>
          )}

          {/* 대리점장 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="w-28 text-sm font-semibold text-slate-700 shrink-0">대리점장</label>
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={agentMode === 'pct' ? agentPctInput : pct(calc.agentPct)}
                    onChange={(e) => handleAgentPct(e.target.value)}
                    onFocus={() => setAgentMode('pct')}
                    className={`w-full border rounded-lg px-3 py-2 text-sm text-right pr-7 focus:outline-none focus:ring-2 focus:ring-slate-400 ${agentMode === 'pct' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50'}`}
                    placeholder="0.0"
                  />
                  <span className="absolute right-2 top-2 text-sm text-slate-400">%</span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    value={agentMode === 'amount' ? agentAmtInput : Math.round(calc.agentAmt).toString()}
                    onChange={(e) => handleAgentAmt(e.target.value)}
                    onFocus={() => setAgentMode('amount')}
                    className={`w-full border rounded-lg px-3 py-2 text-sm text-right pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400 ${agentMode === 'amount' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50'}`}
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-2 text-sm text-slate-400">원</span>
                </div>
              </div>
            </div>

            {/* 소속판매원 (대리점장 하위) */}
            <div className="ml-6 pl-3 border-l-2 border-slate-200 space-y-2">
              <div className="flex items-center gap-3">
                <label className="w-24 text-sm font-medium text-slate-600 shrink-0">소속판매원</label>
                <div className="flex flex-1 gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={memberMode === 'pct' ? memberPctInput : pct(calc.memberPct)}
                      onChange={(e) => handleMemberPct(e.target.value)}
                      onFocus={() => setMemberMode('pct')}
                      className={`w-full border rounded-lg px-3 py-2 text-sm text-right pr-7 focus:outline-none focus:ring-2 focus:ring-slate-400 ${memberMode === 'pct' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50'}`}
                      placeholder="0.0"
                    />
                    <span className="absolute right-2 top-2 text-sm text-slate-400">%</span>
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      value={memberMode === 'amount' ? memberAmtInput : Math.round(calc.memberAmt).toString()}
                      onChange={(e) => handleMemberAmt(e.target.value)}
                      onFocus={() => setMemberMode('amount')}
                      className={`w-full border rounded-lg px-3 py-2 text-sm text-right pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400 ${memberMode === 'amount' ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50'}`}
                      placeholder="0"
                    />
                    <span className="absolute right-2 top-2 text-sm text-slate-400">원</span>
                  </div>
                </div>
              </div>

              {/* 자유판매원 고정 3% */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm text-slate-500 shrink-0">자유판매원</span>
                <div className="flex flex-1 gap-2">
                  <div className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right text-slate-500">
                    3.0% <span className="text-xs">(고정)</span>
                  </div>
                  <div className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right text-slate-600">
                    {fmt(calc.freeAmt)} 원
                  </div>
                </div>
              </div>

              {/* 대리점장 오버라이딩 */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm text-slate-500 shrink-0">
                  오버라이딩
                  <span className="block text-xs text-slate-400">대리점장-3%</span>
                </span>
                <div className="flex flex-1 gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right text-slate-600">
                    {pct(calc.overridingPct)}%
                  </div>
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right text-slate-600">
                    {fmt(calc.overridingAmt)} 원
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 본사 순이익 */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 space-y-1">
          <div className="flex justify-between items-baseline text-sm">
            <span className="text-slate-600 font-medium">본사 순이익</span>
            <span className={`text-lg ${cls(calc.hqProfit)}`}>
              {fmt(calc.hqProfit)} 원
              <span className="ml-2 text-slate-500 font-normal text-sm">{pct(calc.hqMargin)}%</span>
            </span>
          </div>
          <p className="text-xs text-slate-400">= 세전순이익 - 대리점장 수당 - 소속판매원 수당</p>
        </div>
      </section>

      {/* ── 섹션 3: 법인세 참고 ── */}
      <section className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-200">
          <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">참고 — 법인세 22% 예시 계산</h2>
          <p className="text-xs text-amber-600 mt-0.5">실제 세율은 과세표준과 세무 처리에 따라 다를 수 있습니다.</p>
        </div>
        <div className="px-6 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-amber-700">영업이익 기준 법인세 (22%)</span>
            <span className="font-semibold text-amber-900">{fmt(calc.corporateTax)} 원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-amber-700">세후 본사 순이익 (참고용)</span>
            <span className={`font-semibold ${calc.afterTaxProfit < 0 ? 'text-red-600' : 'text-amber-900'}`}>
              {fmt(calc.afterTaxProfit)} 원
            </span>
          </div>
          <p className="text-xs text-amber-600 pt-1">* 세금은 영업이익 기준으로 납부하며, 본 계산기는 참고용입니다.</p>
        </div>
      </section>

      {/* ── 섹션 4: 계산 요약 테이블 ── */}
      {!inputError && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">전체 계산 요약</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: '판매가', value: fmt(calc.sale) + ' 원', sub: '' },
              { label: '입금가', value: fmt(calc.cost) + ' 원', sub: '' },
              { label: `카드수수료 (${(CARD_FEE_RATE * 100).toFixed(1)}%)`, value: fmt(calc.cardFee) + ' 원', sub: '' },
              { label: '영업이익', value: fmt(calc.operatingProfit) + ' 원', sub: pct(calc.operatingMargin) + '%', highlight: true },
              { label: '세전순이익', value: fmt(calc.netProfitBeforeTax) + ' 원', sub: pct(calc.netMargin) + '%', highlight: true },
              { label: '대리점장 수당', value: fmt(calc.agentAmt) + ' 원', sub: pct(calc.agentPct) + '%' },
              { label: '소속판매원 수당', value: fmt(calc.memberAmt) + ' 원', sub: pct(calc.memberPct) + '%' },
              { label: '자유판매원 수당 (고정)', value: fmt(calc.freeAmt) + ' 원', sub: '3.0%' },
              { label: '대리점장 오버라이딩', value: fmt(calc.overridingAmt) + ' 원', sub: pct(calc.overridingPct) + '%' },
              { label: '본사 순이익', value: fmt(calc.hqProfit) + ' 원', sub: pct(calc.hqMargin) + '%', highlight: true, red: calc.hqProfit < 0 },
            ].map((row) => (
              <div key={row.label} className={`flex justify-between items-center px-6 py-3 text-sm ${row.highlight ? 'bg-slate-50' : ''}`}>
                <span className={`${row.highlight ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{row.label}</span>
                <span className={`font-medium ${row.red ? 'text-red-600' : 'text-slate-900'}`}>
                  {row.value}
                  {row.sub && <span className="ml-2 text-xs text-slate-400">{row.sub}</span>}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
