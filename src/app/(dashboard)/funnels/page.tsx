"use client";

import { useState, useEffect } from "react";
import { Plus, GitBranch, Play, Pause, ChevronRight } from "lucide-react";

type FunnelStage = {
  id: string; order: number; name: string;
  triggerType: string; triggerOffset: number; channel: string; messageContent: string | null;
};
type Funnel = {
  id: string; name: string; description: string | null; isActive: boolean;
  stages: FunnelStage[];
  _count: { stages: number };
};

const VIP_CARE_STAGES = [
  { name: "예약 확인",     triggerType: "DAYS_AFTER", triggerOffset: 0,    channel: "SMS" },
  { name: "자유여행 준비", triggerType: "DAYS_AFTER", triggerOffset: 7,    channel: "SMS" },
  { name: "항공 예약",     triggerType: "DDAY",       triggerOffset: -150, channel: "SMS" },
  { name: "브이로그 공유", triggerType: "DDAY",       triggerOffset: -90,  channel: "SMS" },
  { name: "맛집 정보",     triggerType: "DDAY",       triggerOffset: -60,  channel: "SMS" },
  { name: "여행 꿀팁",     triggerType: "DDAY",       triggerOffset: -50,  channel: "SMS" },
  { name: "준비물 안내",   triggerType: "DDAY",       triggerOffset: -40,  channel: "SMS" },
  { name: "KTX 예매",      triggerType: "DDAY",       triggerOffset: -30,  channel: "SMS" },
  { name: "오리엔테이션",  triggerType: "DDAY",       triggerOffset: -15,  channel: "SMS" },
  { name: "준비물 체크",   triggerType: "DDAY",       triggerOffset: -7,   channel: "SMS" },
  { name: "카톡방 초대",   triggerType: "DDAY",       triggerOffset: -7,   channel: "SMS" },
  { name: "터미널 안내",   triggerType: "DDAY",       triggerOffset: -1,   channel: "SMS" },
  { name: "출발 당일",     triggerType: "DDAY",       triggerOffset: 0,    channel: "SMS" },
  { name: "후기 요청",     triggerType: "DAYS_AFTER", triggerOffset: 2,    channel: "SMS" },
];

export default function FunnelsPage() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/funnels")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setFunnels(d.funnels); })
      .finally(() => setLoading(false));
  }, []);

  const createVipCareFunnel = async () => {
    setCreating(true);
    const res = await fetch("/api/funnels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "VIP 케어 타임라인 (기본)",
        description: "결제 완료 고객 전용 — D-150 ~ D+2 자동 케어",
        stages: VIP_CARE_STAGES.map((s, i) => ({ ...s, order: i })),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setFunnels((prev) => [data.funnel, ...prev]);
    }
    setCreating(false);
  };

  const triggerLabel = (s: FunnelStage) => {
    if (s.triggerType === "DDAY") {
      return s.triggerOffset < 0 ? `D${s.triggerOffset}` : s.triggerOffset === 0 ? "D-day" : `D+${s.triggerOffset}`;
    }
    return s.triggerOffset === 0 ? "등록 즉시" : `등록 후 ${s.triggerOffset}일`;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy-900">퍼널 자동화</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vercel Cron 매시간 자동 발송</p>
        </div>
        <div className="flex gap-2">
          {funnels.length === 0 && !loading && (
            <button
              onClick={createVipCareFunnel}
              disabled={creating}
              className="flex items-center gap-1.5 bg-gold-500 text-navy-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gold-300 disabled:opacity-50"
            >
              {creating ? "생성 중..." : "🚢 VIP 케어 기본 생성"}
            </button>
          )}
          <button
            onClick={createVipCareFunnel}
            disabled={creating}
            className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> 새 퍼널
          </button>
        </div>
      </div>

      {/* Cron 상태 */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <p className="text-sm font-medium text-green-800">Vercel Cron 활성 — 매시간 자동 발송</p>
        </div>
        <p className="text-xs text-green-600 mt-1 ml-4">야간 발송 차단 (21시~08시) · 수신거부 자동 제외</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : funnels.length === 0 ? (
        <div className="text-center py-16">
          <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">퍼널이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">VIP 케어 기본 퍼널을 먼저 만들어보세요</p>
        </div>
      ) : (
        <div className="space-y-4">
          {funnels.map((funnel) => (
            <div key={funnel.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* 퍼널 헤더 */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className={`w-2.5 h-2.5 rounded-full ${funnel.isActive ? "bg-green-400" : "bg-gray-300"}`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{funnel.name}</h3>
                  {funnel.description && <p className="text-xs text-gray-400 mt-0.5">{funnel.description}</p>}
                </div>
                <span className="text-sm text-gray-500">{funnel.stages.length}단계</span>
              </div>

              {/* 스테이지 미리보기 (가로 스크롤) */}
              <div className="flex gap-2 p-4 overflow-x-auto">
                {funnel.stages.slice(0, 8).map((stage, i) => (
                  <div key={stage.id} className="flex items-center gap-1 shrink-0">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center min-w-[80px]">
                      <p className="text-xs text-gold-500 font-bold">{triggerLabel(stage)}</p>
                      <p className="text-xs text-gray-700 mt-0.5 truncate max-w-[72px]">{stage.name}</p>
                    </div>
                    {i < Math.min(funnel.stages.length - 1, 7) && (
                      <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
                    )}
                  </div>
                ))}
                {funnel.stages.length > 8 && (
                  <div className="flex items-center text-xs text-gray-400 shrink-0">
                    +{funnel.stages.length - 8}개
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
