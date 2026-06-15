"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Clock, Info } from "lucide-react";

interface RiskAlert {
  contactId: string;
  name: string;
  phone: string;
  riskLevel: "danger" | "warning" | "info";
  riskReason: string;
  daysOverdue: number;
  recommendation: string;
  urgency: string;
}

export function RiskAlertView() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/dashboard/risk-alerts");
        const data = await res.json();
        setAlerts(data);
      } catch (err) {
        console.error("위험도 로드 실패", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000); // 5분마다
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-4 text-center">위험도 분석 중...</div>;
  }

  const dangerAlerts = alerts.filter((a) => a.riskLevel === "danger");
  const warningAlerts = alerts.filter((a) => a.riskLevel === "warning");
  const infoAlerts = alerts.filter((a) => a.riskLevel === "info");

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">위험 신호 알림</h1>
        <p className="text-gray-500 mt-1">
          {dangerAlerts.length}명 긴급 | {warningAlerts.length}명 주의 |{" "}
          {infoAlerts.length}명 정보
        </p>
      </div>

      {/* 긴급: 7일 이상 미응답 */}
      {dangerAlerts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-red-600">
              🔴 [긴급] {dangerAlerts.length}명 - 7일 이상 미응답
            </h2>
          </div>
          <div className="space-y-3">
            {dangerAlerts.map((alert) => (
              <RiskAlertCard key={alert.contactId} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* 주의: 기한 48시간 */}
      {warningAlerts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-6 h-6 text-yellow-600" />
            <h2 className="text-xl font-bold text-yellow-600">
              🟡 [주의] {warningAlerts.length}명 - 기한 임박
            </h2>
          </div>
          <div className="space-y-3">
            {warningAlerts.map((alert) => (
              <RiskAlertCard key={alert.contactId} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* 정보: 준비 부족 */}
      {infoAlerts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-blue-600">
              🔵 [정보] {infoAlerts.length}명 - 준비 상태
            </h2>
          </div>
          <div className="space-y-3">
            {infoAlerts.map((alert) => (
              <RiskAlertCard key={alert.contactId} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">위험 상태인 고객이 없습니다 ✨</p>
        </div>
      )}
    </div>
  );
}

function RiskAlertCard({ alert }: { alert: RiskAlert }) {
  const colorMap = {
    danger: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-700",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
    },
  };

  const colors = colorMap[alert.riskLevel];

  return (
    <div className={`${colors.bg} border-l-4 ${colors.border} p-4 rounded-lg`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`font-bold text-lg ${colors.text}`}>{alert.name}</p>
          <p className="text-sm text-gray-600">{alert.phone}</p>
        </div>
        <span className="text-sm bg-white px-3 py-1 rounded border font-medium">
          {alert.urgency}
        </span>
      </div>

      <div className="bg-white p-3 rounded mb-3 border">
        <p className="text-sm text-gray-700">{alert.riskReason}</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          💡 추천: <span className="font-bold">{alert.recommendation}</span>
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          조치하기
        </button>
      </div>
    </div>
  );
}
