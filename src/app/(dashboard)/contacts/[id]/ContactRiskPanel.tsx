"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, ExternalLink } from "lucide-react";
import { logger } from "@/lib/logger";

interface RiskPanelProps {
  contactId: string;
}

interface RiskData {
  flags: string[];
  riskScore: number; // 0-100
  severity: "GREEN" | "YELLOW" | "RED";
  details: Array<{
    flag: string;
    label: string;
    severity: string;
    action: string;
  }>;
}

export default function ContactRiskPanel({ contactId }: RiskPanelProps) {
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchRiskData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/contacts/${contactId}/risk-flags`, { signal: controller.signal });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const result = await res.json();
        if (result.ok) {
          setRiskData(result.data);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        logger.error("[ContactRiskPanel] Risk 데이터 조회 실패", { err, contactId });
      } finally {
        setLoading(false);
      }
    };

    fetchRiskData();
    return () => controller.abort();
  }, [contactId]);

  if (loading || !riskData || riskData.flags.length === 0) {
    return null;
  }

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "RED":
        return { bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle, color: "text-red-700" };
      case "YELLOW":
        return { bg: "bg-yellow-50", border: "border-yellow-200", icon: AlertCircle, color: "text-yellow-700" };
      case "GREEN":
        return { bg: "bg-green-50", border: "border-green-200", icon: Info, color: "text-green-700" };
      default:
        return { bg: "bg-gray-50", border: "border-gray-200", icon: Info, color: "text-gray-700" };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 71) return { bg: "bg-red-100", text: "text-red-700", label: "높음" };
    if (score >= 31) return { bg: "bg-yellow-100", text: "text-yellow-700", label: "중간" };
    return { bg: "bg-green-100", text: "text-green-700", label: "낮음" };
  };

  const config = getSeverityConfig(riskData.severity);
  const scoreConfig = getScoreColor(riskData.riskScore);
  const IconComponent = config.icon;

  return (
    <div className={`border ${config.border} ${config.bg} rounded-xl p-6`}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <IconComponent className={`w-8 h-8 ${config.color}`} />
          <div>
            <h2 className={`text-xl font-bold ${config.color}`}>🚨 주의 신호</h2>
            <p className="text-base text-gray-600 mt-1">조기 감지된 거래 신호 (실시간 분석)</p>
          </div>
        </div>

        {/* Risk Score 배지 */}
        <div className="text-right">
          <div className={`inline-flex items-center gap-3 px-5 py-3 ${scoreConfig.bg} rounded-lg`}>
            <span className={`text-4xl font-bold ${scoreConfig.text}`}>{riskData.riskScore}</span>
            <div>
              <p className={`text-sm font-semibold ${scoreConfig.text}`}>{scoreConfig.label}</p>
              <p className="text-sm text-gray-500">위험 수준</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Signal List */}
      <div className="space-y-4">
        {riskData.details.map((detail) => {
          const flagSeverityConfig = getSeverityConfig(detail.severity);
          const severityIcon = detail.severity === "RED" ? "🔴" : detail.severity === "YELLOW" ? "🟠" : "🟢";
          return (
            <div
              key={detail.flag}
              className={`border ${flagSeverityConfig.border} ${flagSeverityConfig.bg} rounded-lg p-5`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className={`font-bold text-base ${flagSeverityConfig.color}`}>
                    {severityIcon} {detail.label}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">[신호 ID: {detail.flag}]</p>
                </div>
                <span
                  className={`px-3 py-1.5 text-sm font-bold rounded-full whitespace-nowrap ml-2 ${
                    detail.severity === "RED"
                      ? "bg-red-200 text-red-700"
                      : detail.severity === "YELLOW"
                      ? "bg-yellow-200 text-yellow-700"
                      : "bg-blue-200 text-blue-700"
                  }`}
                >
                  {detail.severity === "RED" ? "즉시" : detail.severity === "YELLOW" ? "주의" : "안전"}
                </span>
              </div>

              <p className="text-base text-gray-700 mt-3 leading-relaxed">
                <strong>📋 권장 조치:</strong> <br/>{detail.action}
              </p>
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="mt-8 pt-5 border-t border-gray-200">
        <button className="flex items-center gap-3 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base font-bold min-h-12">
          <ExternalLink className="w-5 h-5" />
          주의 신호 대시보드 보기
        </button>
      </div>
    </div>
  );
}
