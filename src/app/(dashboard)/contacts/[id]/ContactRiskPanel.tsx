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
    const fetchRiskData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/contacts/${contactId}/risk-flags`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const result = await res.json();
        if (result.ok) {
          setRiskData(result.data);
        }
      } catch (err) {
        logger.error("[ContactRiskPanel] Risk 데이터 조회 실패", { err, contactId });
      } finally {
        setLoading(false);
      }
    };

    fetchRiskData();
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
          <IconComponent className={`w-6 h-6 ${config.color}`} />
          <div>
            <h2 className={`text-lg font-bold ${config.color}`}>거래 위험도</h2>
            <p className="text-sm text-gray-600 mt-1">자동 감지된 10개 신호 분석</p>
          </div>
        </div>

        {/* Risk Score 배지 */}
        <div className="text-right">
          <div className={`inline-flex items-center gap-2 px-4 py-2 ${scoreConfig.bg} rounded-lg`}>
            <span className={`text-3xl font-bold ${scoreConfig.text}`}>{riskData.riskScore}</span>
            <div>
              <p className={`text-xs font-semibold ${scoreConfig.text}`}>{scoreConfig.label}</p>
              <p className="text-xs text-gray-500">위험도 점수</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Flag 리스트 */}
      <div className="space-y-3">
        {riskData.details.map((detail) => {
          const flagSeverityConfig = getSeverityConfig(detail.severity);
          return (
            <div
              key={detail.flag}
              className={`border ${flagSeverityConfig.border} ${flagSeverityConfig.bg} rounded-lg p-4`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className={`font-semibold ${flagSeverityConfig.color}`}>{detail.label}</p>
                  <p className="text-xs text-gray-500 mt-1">[{detail.flag}]</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    detail.severity === "P0"
                      ? "bg-red-200 text-red-700"
                      : detail.severity === "P1"
                      ? "bg-yellow-200 text-yellow-700"
                      : "bg-blue-200 text-blue-700"
                  }`}
                >
                  {detail.severity}
                </span>
              </div>

              <p className="text-sm text-gray-700 mt-2">
                <strong>📋 추천 액션:</strong> {detail.action}
              </p>
            </div>
          );
        })}
      </div>

      {/* 액션 버튼 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <ExternalLink className="w-4 h-4" />
          위험도 대시보드에서 자세히 보기
        </button>
      </div>
    </div>
  );
}
