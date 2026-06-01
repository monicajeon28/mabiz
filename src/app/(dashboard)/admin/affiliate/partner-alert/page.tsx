"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Send,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/lib/api/use-toast";

type PartnerAlert = {
  partnerId: string;
  name: string;
  email?: string;
  phone?: string;
  riskScore: number;
  riskLevel: "RED" | "YELLOW" | "GREEN";
  automationRate: number;
  monthlyIncomeGoal?: number;
  totalRevenue?: number;
};

const RISK_CONFIG = {
  RED: {
    label: "긴급",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: AlertTriangle,
  },
  YELLOW: {
    label: "주의",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: AlertCircle,
  },
  GREEN: {
    label: "정상",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle,
  },
};

type SmsStats = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  clicked: number;
  successRate: number;
  clickRate: number;
};

export default function PartnerAlertPage() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [riskLevel, setRiskLevel] = useState<"ALL" | "RED" | "YELLOW" | "GREEN">(
    "ALL"
  );
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<"day0" | "day1" | "day2" | "day3">(
    "day0"
  );
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const totalPages = Math.ceil(total / 50);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
    });
    if (riskLevel !== "ALL") params.set("riskLevel", riskLevel);

    fetch(`/api/affiliate/partner-alert?${params}`)
      .then((r) => r.json())
      .then((d: any) => {
        if (d.ok) {
          setPartners(d.data);
          setTotal(d.total);
        } else {
          setPartners([]);
          setTotal(0);
          toast({
            title: "로드 실패",
            description: d.error,
            variant: "destructive",
          });
        }
      })
      .catch((err) => {
        setPartners([]);
        setTotal(0);
        toast({
          title: "네트워크 오류",
          description: err.message,
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [page, riskLevel, toast]);

  // 통계 로드
  const loadStats = useCallback(() => {
    setStatsLoading(true);
    fetch(`/api/affiliate/partner-alert/stats?days=7`)
      .then((r) => r.json())
      .then((d: any) => {
        if (d.ok) {
          setStats(d.summary);
        }
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    load();
    loadStats();
  }, [load, loadStats]);

  const handleSendSms = async (partnerId: string) => {
    setSendingId(partnerId);
    try {
      const r = await fetch(`/api/affiliate/partner-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, day: selectedDay }),
      });

      const d = await r.json();
      if (!r.ok || !d.ok) {
        toast({
          title: "SMS 발송 실패",
          description: d.error || "요청을 처리할 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "SMS 발송 완료",
        description: `${d.message?.substring(0, 50)}...`,
      });

      load();
    } catch (err) {
      toast({
        title: "오류",
        description: err instanceof Error ? err.message : "요청 실패",
        variant: "destructive",
      });
    } finally {
      setSendingId(null);
    }
  };

  // 위험도별 통계
  const redCount = partners.filter((p) => p.riskLevel === "RED").length;
  const yellowCount = partners.filter((p) => p.riskLevel === "YELLOW").length;
  const greenCount = partners.filter((p) => p.riskLevel === "GREEN").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">파트너 위험도 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">
          파트너 성과를 모니터링하고 Alert SMS를 발송하세요
        </p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 font-medium">전체 파트너</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{total}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600 font-medium">긴급 (RED)</p>
          <p className="text-2xl font-bold text-red-700 mt-2">{redCount}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-600 font-medium">주의 (YELLOW)</p>
          <p className="text-2xl font-bold text-yellow-700 mt-2">{yellowCount}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">정상 (GREEN)</p>
          <p className="text-2xl font-bold text-green-700 mt-2">{greenCount}</p>
        </div>

        {/* SMS 통계 */}
        {statsLoading ? (
          <>
            <div className="bg-gray-100 rounded-lg p-4 animate-pulse h-20" />
            <div className="bg-gray-100 rounded-lg p-4 animate-pulse h-20" />
          </>
        ) : stats ? (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">SMS 성공율</p>
              <p className="text-2xl font-bold text-blue-700 mt-2">
                {stats.successRate}%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.sent}/{stats.total}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">클릭율</p>
              <p className="text-2xl font-bold text-purple-700 mt-2">
                {stats.clickRate}%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.clicked}/{stats.sent} opened
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex gap-3 flex-wrap">
        <select
          value={riskLevel}
          onChange={(e) => {
            setRiskLevel(e.target.value as any);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">전체 위험도</option>
          <option value="RED">긴급 (RED)</option>
          <option value="YELLOW">주의 (YELLOW)</option>
          <option value="GREEN">정상 (GREEN)</option>
        </select>

        <div className="flex gap-2 ml-auto">
          <label className="text-sm text-gray-600 font-medium flex items-center gap-2">
            SMS Day:
            <select
              value={selectedDay}
              onChange={(e) =>
                setSelectedDay(e.target.value as "day0" | "day1" | "day2" | "day3")
              }
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="day0">Day 0</option>
              <option value="day1">Day 1</option>
              <option value="day2">Day 2</option>
              <option value="day3">Day 3</option>
            </select>
          </label>
        </div>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">모니터링할 파트너가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    파트너명
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    연락처
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    위험도 점수
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    상태
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    자동화율
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    월 매출
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partners.map((partner) => {
                  const cfg = RISK_CONFIG[partner.riskLevel];
                  const Icon = cfg.icon;
                  return (
                    <tr key={partner.partnerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {partner.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {partner.phone || partner.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {partner.riskScore}점
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-sm font-medium ${cfg.bgColor} ${cfg.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{
                                width: `${partner.automationRate}%`,
                              }}
                              suppressHydrationWarning
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-10">
                            {partner.automationRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-sm">
                        {partner.totalRevenue
                          ? `₩${(Number(partner.totalRevenue) / 1000000).toFixed(0)}M`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSendSms(partner.partnerId)}
                          disabled={sendingId === partner.partnerId}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                          title={`SMS 발송 (${selectedDay})`}
                        >
                          {sendingId === partner.partnerId ? (
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                총 {total.toLocaleString()}명
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-2 text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
